import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-list-token",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
}

type ShareContext = {
  tokenId: string
  token: string
  householdId: string
  listId: string
  listName: string
  expiresAt: string
}

type ListItemRow = {
  id: string
  text: string
  quantity: string | null
  category: string | null
  checked_at: string | null
  sort_order: number
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function requireEnv(name: string) {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

function adminClient() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function itemPayload(row: ListItemRow) {
  return {
    id: row.id,
    text: row.text,
    qty: row.quantity,
    category: row.category || "Added",
    checked: Boolean(row.checked_at),
  }
}

async function resolveShare(admin: SupabaseClient, token: string | null): Promise<ShareContext | null> {
  if (!token) return null
  const { data, error } = await admin
    .from("list_share_tokens")
    .select("id, token, household_id, list_id, expires_at, revoked_at, lists(name)")
    .eq("token", token)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.revoked_at) return null
  if (new Date(data.expires_at).getTime() <= Date.now()) return null

  const listRel = data.lists as { name: string } | { name: string }[] | null
  const listName = Array.isArray(listRel) ? listRel[0]?.name : listRel?.name
  if (!listName) return null

  return {
    tokenId: data.id,
    token: data.token,
    householdId: data.household_id,
    listId: data.list_id,
    listName,
    expiresAt: data.expires_at,
  }
}

async function fetchItems(admin: SupabaseClient, listId: string, householdId: string) {
  const { data, error } = await admin
    .from("list_items")
    .select("id, text, quantity, category, checked_at, sort_order")
    .eq("list_id", listId)
    .eq("household_id", householdId)
    .order("sort_order")
    .order("created_at")
  if (error) throw new Error(error.message)
  return (data as ListItemRow[]).map(itemPayload)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const admin = adminClient()
    const url = new URL(req.url)
    const pathParts = url.pathname.split("/").filter(Boolean)
    const leaf = pathParts[pathParts.length - 1] || "list-share"
    const action = url.searchParams.get("action") || (leaf === "list-share" ? "list" : leaf)
    const token = req.headers.get("x-list-token") || url.searchParams.get("token")
    const share = await resolveShare(admin, token)
    if (!share) return json({ error: "Invalid or expired list token" }, 401)

    if (req.method === "GET" && (action === "list" || action === "")) {
      const items = await fetchItems(admin, share.listId, share.householdId)
      return json({
        list: {
          id: share.listId,
          name: share.listName,
          expiresAt: share.expiresAt,
          items,
        },
      })
    }

    if (req.method === "PATCH" && (action === "toggle" || action === "list" || action === "")) {
      const body = await req.json() as { id?: string; checked?: boolean }
      if (!body.id || typeof body.checked !== "boolean") {
        return json({ error: "Provide id and checked" }, 400)
      }
      const { data, error } = await admin
        .from("list_items")
        .update({ checked_at: body.checked ? new Date().toISOString() : null })
        .eq("id", body.id)
        .eq("list_id", share.listId)
        .eq("household_id", share.householdId)
        .select("id, text, quantity, category, checked_at, sort_order")
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return json({ error: "Item not found" }, 404)
      return json({ item: itemPayload(data as ListItemRow) })
    }

    if (req.method === "POST" && (action === "add" || action === "list" || action === "")) {
      const body = await req.json() as { text?: string; qty?: string | null }
      const text = body.text?.trim()
      if (!text) return json({ error: "Provide text" }, 400)
      const qty = body.qty?.trim() || null

      const { data: maxRow } = await admin
        .from("list_items")
        .select("sort_order")
        .eq("list_id", share.listId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle()
      const sortOrder = (maxRow?.sort_order ?? -1) + 1

      const { data, error } = await admin
        .from("list_items")
        .insert({
          household_id: share.householdId,
          list_id: share.listId,
          text,
          quantity: qty,
          category: "Added",
          sort_order: sortOrder,
        })
        .select("id, text, quantity, category, checked_at, sort_order")
        .single()
      if (error) throw new Error(error.message)
      return json({ item: itemPayload(data as ListItemRow) })
    }

    return json({ error: "Not found" }, 404)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message }, 500)
  }
})
