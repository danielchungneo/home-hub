import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const KROGER_TOKEN_URL = "https://api.kroger.com/v1/connect/oauth2/token"
const KROGER_API = "https://api.kroger.com/v1"

type AisleLocation = {
  description?: string
  number?: string
  bayNumber?: string
  side?: string
}

type ProductHit = {
  aisleLocations?: AisleLocation[]
  categories?: string[]
  description?: string
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

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ").replace(/[’']/g, "'")
}

function searchTerm(name: string) {
  let term = normalizeName(name)
  term = term.split(",")[0] ?? term
  term = term.replace(/\s*\([^)]*\)\s*/g, " ")
  term = term
    .replace(
      /\b(fresh|dried|minced|chopped|diced|sliced|peeled|deveined|grated|shredded|crushed|ground|whole|large|small|medium|optional|to taste|finely|roughly|thinly)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim()
  return term.split(" ").filter(Boolean).slice(0, 4).join(" ")
}

function aisleLabel(aisles: AisleLocation[] | undefined, categories: string[] | undefined) {
  const first = aisles?.[0]
  if (first?.description?.trim()) return first.description.trim()
  if (first?.number) return `Aisle ${first.number}`
  const cat = categories?.[0]?.trim()
  if (cat) {
    // Kroger categories look like "Dairy|Milk" — take the head department.
    return cat.split("|")[0]!.trim()
  }
  return null
}

let cachedToken: { value: string; expiresAt: number } | null = null

async function krogerToken() {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.value

  const clientId = requireEnv("KROGER_CLIENT_ID")
  const clientSecret = requireEnv("KROGER_CLIENT_SECRET")
  const basic = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(KROGER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: "grant_type=client_credentials&scope=product.compact",
  })
  const data = await res.json() as { access_token?: string; expires_in?: number; error?: string }
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || `Kroger token failed (${res.status})`)
  }
  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in ?? 1800) * 1000,
  }
  return cachedToken.value
}

async function krogerGet(path: string, token: string) {
  const res = await fetch(`${KROGER_API}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  })
  const data = await res.json() as { data?: unknown; error?: string; message?: string }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Kroger request failed (${res.status})`)
  }
  return data
}

async function resolveLocationId(opts: {
  token: string
  locationId?: string | null
  zip?: string | null
  lat?: number | null
  lon?: number | null
}) {
  if (opts.locationId && /^\d{8}$/.test(opts.locationId)) return opts.locationId

  const params = new URLSearchParams({ "filter.limit": "1", "filter.chain": "KROGER" })
  if (opts.zip) {
    params.set("filter.zipCode.near", opts.zip)
  } else if (opts.lat != null && opts.lon != null) {
    params.set("filter.lat.near", String(opts.lat))
    params.set("filter.lon.near", String(opts.lon))
  } else {
    throw new Error("Need a Kroger location id, zip, or lat/lon")
  }

  const data = await krogerGet(`/locations?${params}`, opts.token)
  const rows = (data.data as Array<{ locationId?: string }> | undefined) ?? []
  const id = rows[0]?.locationId
  if (!id) throw new Error("No nearby Kroger found")
  return id
}

async function lookupAisle(token: string, locationId: string, term: string) {
  if (!term) return null
  const params = new URLSearchParams({
    "filter.term": term,
    "filter.locationId": locationId,
    "filter.limit": "3",
    "filter.fulfillment": "ais",
  })
  const data = await krogerGet(`/products?${params}`, token)
  const products = (data.data as ProductHit[] | undefined) ?? []
  for (const product of products) {
    const label = aisleLabel(product.aisleLocations, product.categories)
    if (label) return label
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Missing authorization" }, 401)

    const supabaseUrl = requireEnv("SUPABASE_URL")
    const anonKey = requireEnv("SUPABASE_ANON_KEY")
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401)

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("household_id")
      .eq("id", userData.user.id)
      .maybeSingle()
    if (profileError) throw new Error(profileError.message)
    if (!profile?.household_id) return json({ error: "No household" }, 403)

    const body = await req.json() as {
      names?: string[]
      locationId?: string | null
      zip?: string | null
      lat?: number | null
      lon?: number | null
      persistLocation?: boolean
    }
    const names = [...new Set((body.names ?? []).map((n) => n.trim()).filter(Boolean))]
    if (!names.length) return json({ error: "Provide names" }, 400)

    const { data: settings } = await admin
      .from("household_settings")
      .select("kroger_location_id, location_zip")
      .eq("household_id", profile.household_id)
      .maybeSingle()

    const { data: household } = await admin
      .from("households")
      .select("location_lat, location_lon")
      .eq("id", profile.household_id)
      .maybeSingle()

    const token = await krogerToken()
    const locationId = await resolveLocationId({
      token,
      locationId: body.locationId || settings?.kroger_location_id,
      zip: body.zip || settings?.location_zip,
      lat: body.lat ?? household?.location_lat,
      lon: body.lon ?? household?.location_lon,
    })

    if (body.persistLocation !== false && settings && locationId !== settings.kroger_location_id) {
      await admin
        .from("household_settings")
        .update({ kroger_location_id: locationId })
        .eq("household_id", profile.household_id)
    }

    const aisles: Record<string, string> = {}
    // Sequential to stay gentle on Kroger rate limits; meal plans are small.
    for (const name of names) {
      const key = normalizeName(name)
      const term = searchTerm(name)
      try {
        const label = await lookupAisle(token, locationId, term)
        if (label) aisles[key] = label
      } catch {
        // Skip individual misses; caller keeps heuristic fallback.
      }
    }

    return json({ locationId, aisles })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message }, 500)
  }
})
