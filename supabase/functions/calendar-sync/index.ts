import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const PROVIDER = "google_calendar"
const WINDOW_PAST_DAYS = 7
const WINDOW_FUTURE_DAYS = 60

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

type Integration = {
  id: string
  household_id: string
  account_key: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  meta: Record<string, unknown>
}

type Source = {
  id: string
  household_id: string
  integration_id: string
  external_id: string
  member_id: string | null
  sync_token: string | null
  enabled: boolean
}

type GoogleEvent = {
  id?: string
  status?: string
  summary?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
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

async function refreshAccessToken(integration: Integration) {
  const clientId = requireEnv("GOOGLE_CLIENT_ID")
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET")
  if (!integration.refresh_token) throw new Error(`No refresh_token for ${integration.account_key}`)

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: integration.refresh_token,
      grant_type: "refresh_token",
    }),
  })
  const data = await res.json() as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? `refresh ${res.status}`)
  }
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
  }
}

async function ensureAccessToken(
  db: ReturnType<typeof createClient>,
  integration: Integration,
): Promise<string> {
  const expires = integration.expires_at ? Date.parse(integration.expires_at) : 0
  if (integration.access_token && expires > Date.now() + 60_000) {
    return integration.access_token
  }
  const next = await refreshAccessToken(integration)
  await db
    .from("integrations")
    .update({ access_token: next.accessToken, expires_at: next.expiresAt })
    .eq("id", integration.id)
  integration.access_token = next.accessToken
  integration.expires_at = next.expiresAt
  return next.accessToken
}

function parseEventTimes(ev: GoogleEvent): { startsAt: string; endsAt: string; allDay: boolean } | null {
  if (ev.start?.date && ev.end?.date) {
    // All-day: Google end.date is exclusive. Store as UTC midnight bounds.
    const startsAt = `${ev.start.date}T00:00:00.000Z`
    const endDate = new Date(`${ev.end.date}T00:00:00.000Z`)
    endDate.setUTCDate(endDate.getUTCDate() - 1)
    const endsAt = `${endDate.toISOString().slice(0, 10)}T23:59:59.999Z`
    return { startsAt, endsAt, allDay: true }
  }
  if (ev.start?.dateTime && ev.end?.dateTime) {
    return {
      startsAt: new Date(ev.start.dateTime).toISOString(),
      endsAt: new Date(ev.end.dateTime).toISOString(),
      allDay: false,
    }
  }
  return null
}

async function listEventsPage(
  accessToken: string,
  calendarId: string,
  params: URLSearchParams,
): Promise<{ items: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string; gone?: boolean }> {
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status === 410) return { items: [], gone: true }
  const data = await res.json() as {
    items?: GoogleEvent[]
    nextPageToken?: string
    nextSyncToken?: string
    error?: { message?: string }
  }
  if (!res.ok) throw new Error(data.error?.message ?? `events.list ${res.status}`)
  return {
    items: data.items ?? [],
    nextPageToken: data.nextPageToken,
    nextSyncToken: data.nextSyncToken,
  }
}

async function syncSource(
  db: ReturnType<typeof createClient>,
  accessToken: string,
  source: Source,
) {
  let syncToken = source.sync_token
  let full = !syncToken
  const upserts: Record<string, unknown>[] = []
  const deleteIds: string[] = []

  const runPages = async (base: URLSearchParams) => {
    let pageToken: string | undefined
    let nextSyncToken: string | undefined
    for (;;) {
      const params = new URLSearchParams(base)
      if (pageToken) params.set("pageToken", pageToken)
      const page = await listEventsPage(accessToken, source.external_id, params)
      if (page.gone) return { gone: true as const }
      for (const ev of page.items) {
        if (!ev.id) continue
        if (ev.status === "cancelled") {
          deleteIds.push(ev.id)
          continue
        }
        const times = parseEventTimes(ev)
        if (!times) continue
        upserts.push({
          household_id: source.household_id,
          source_id: source.id,
          external_id: ev.id,
          title: ev.summary?.trim() || "(No title)",
          starts_at: times.startsAt,
          ends_at: times.endsAt,
          all_day: times.allDay,
          member_id: source.member_id,
        })
      }
      if (page.nextSyncToken) nextSyncToken = page.nextSyncToken
      if (!page.nextPageToken) return { gone: false as const, nextSyncToken }
      pageToken = page.nextPageToken
    }
  }

  let result = await (async () => {
    if (syncToken) {
      const params = new URLSearchParams({
        syncToken,
        singleEvents: "true",
        showDeleted: "true",
      })
      return await runPages(params)
    }
    return { gone: true as const }
  })()

  if (result.gone) {
    full = true
    syncToken = null
    const timeMin = new Date(Date.now() - WINDOW_PAST_DAYS * 86_400_000).toISOString()
    const timeMax = new Date(Date.now() + WINDOW_FUTURE_DAYS * 86_400_000).toISOString()
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      showDeleted: "true",
      orderBy: "startTime",
    })
    result = await runPages(params)
    if (result.gone) throw new Error(`Full sync failed for ${source.external_id}`)
  }

  if (full) {
    // Replace window: delete existing rows for this source then upsert fetched set.
    await db.from("events").delete().eq("source_id", source.id)
  } else if (deleteIds.length) {
    await db.from("events").delete().eq("source_id", source.id).in("external_id", deleteIds)
  }

  if (upserts.length) {
    const { error } = await db.from("events").upsert(upserts, {
      onConflict: "source_id,external_id",
    })
    if (error) throw new Error(error.message)
  }

  const now = new Date().toISOString()
  await db
    .from("calendar_sources")
    .update({
      sync_token: result.nextSyncToken ?? syncToken,
      last_synced_at: now,
    })
    .eq("id", source.id)

  return { upserted: upserts.length, deleted: deleteIds.length, full }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return json({ error: "Method not allowed" }, 405)
    }

    const supabaseUrl = requireEnv("SUPABASE_URL")
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: integrations, error: intErr } = await db
      .from("integrations")
      .select("id, household_id, account_key, access_token, refresh_token, expires_at, meta")
      .eq("provider", PROVIDER)
    if (intErr) throw new Error(intErr.message)

    const summary: unknown[] = []
    for (const integration of (integrations ?? []) as Integration[]) {
      try {
        const accessToken = await ensureAccessToken(db, integration)
        const { data: sources, error: srcErr } = await db
          .from("calendar_sources")
          .select("id, household_id, integration_id, external_id, member_id, sync_token, enabled")
          .eq("integration_id", integration.id)
          .eq("enabled", true)
        if (srcErr) throw new Error(srcErr.message)

        const sourceResults = []
        for (const source of (sources ?? []) as Source[]) {
          const r = await syncSource(db, accessToken, source)
          sourceResults.push({ sourceId: source.id, calendar: source.external_id, ...r })
        }

        await db
          .from("integrations")
          .update({
            meta: {
              ...(integration.meta ?? {}),
              email: integration.account_key,
              last_synced_at: new Date().toISOString(),
            },
          })
          .eq("id", integration.id)

        summary.push({
          account: integration.account_key,
          sources: sourceResults.length,
          results: sourceResults,
        })
      } catch (err) {
        summary.push({
          account: integration.account_key,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return json({ ok: true, accounts: summary.length, summary })
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
