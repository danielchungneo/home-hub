/**
 * Link one Google account for Calendar sync. Run once per person:
 *   pnpm google:calendar-login
 *   pnpm google:calendar-login -- --member shelby
 *
 * Google OAuth redirect URI must be exactly: http://127.0.0.1:8788/callback
 * Scope: calendar.readonly
 */
import { createServer } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Database } from '@hub/shared'

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })

const clientId = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const householdId = process.env.HOUSEHOLD_ID ?? '11111111-1111-1111-1111-111111111111'
const redirectUri = 'http://127.0.0.1:8788/callback'
const scopes = ['https://www.googleapis.com/auth/calendar.readonly', 'openid', 'email'].join(' ')

const MEMBER_IDS: Record<string, string | null> = {
  daniel: '22222222-2222-2222-2222-222222222201',
  shelby: '22222222-2222-2222-2222-222222222202',
  noah: '22222222-2222-2222-2222-222222222203',
  family: null,
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const memberSlug = (argValue('--member') ?? 'family').toLowerCase()
if (!(memberSlug in MEMBER_IDS)) {
  console.error(`Unknown --member ${memberSlug}. Use daniel|shelby|noah|family.`)
  process.exit(1)
}
const primaryMemberId = MEMBER_IDS[memberSlug]!

if (!clientId || !clientSecret || !supabaseUrl || !serviceKey) {
  console.error('Fill packages/google-calendar/.env (see .env.example) first.')
  process.exit(1)
}

const db = createClient<Database>(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    access_type: 'offline',
    prompt: 'consent',
  }).toString()

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

type CalendarListItem = {
  id?: string
  summary?: string
  primary?: boolean
  backgroundColor?: string
}

/** Google often omits subscribed "interesting" calendars from calendarList; holidays are still readable by id. */
const US_HOLIDAYS = {
  id: 'en.usa#holiday@group.v.calendar.google.com',
  summary: 'Holidays in United States',
}

async function exchangeCode(code: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = (await res.json()) as TokenResponse
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? `token ${res.status}`)
  }
  return data
}

async function fetchEmail(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = (await res.json()) as { email?: string; error?: { message?: string } }
  if (!res.ok || !data.email) throw new Error(data.error?.message ?? `userinfo ${res.status}`)
  return data.email
}

async function listCalendars(accessToken: string) {
  // showHidden includes subscribed calendars like US Holidays that aren't "owned".
  const out: CalendarListItem[] = []
  let pageToken: string | undefined
  for (;;) {
    const qs = new URLSearchParams({
      maxResults: '250',
      showHidden: 'true',
      showDeleted: 'false',
    })
    if (pageToken) qs.set('pageToken', pageToken)
    const res = await fetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList?${qs}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = (await res.json()) as {
      items?: CalendarListItem[]
      nextPageToken?: string
      error?: { message?: string }
    }
    if (!res.ok) throw new Error(data.error?.message ?? `calendarList ${res.status}`)
    out.push(...(data.items ?? []))
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return out
}

async function saveAccount(tokens: TokenResponse, email: string, calendars: CalendarListItem[]) {
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  const { data: existing } = await db
    .from('integrations')
    .select('id')
    .eq('household_id', householdId)
    .eq('provider', 'google_calendar')
    .eq('account_key', email)
    .maybeSingle()

  let integrationId = existing?.id as string | undefined
  if (integrationId) {
    const patch: Database['public']['Tables']['integrations']['Update'] = {
      access_token: tokens.access_token ?? null,
      expires_at: expiresAt,
      meta: { email },
    }
    if (tokens.refresh_token) patch.refresh_token = tokens.refresh_token
    const { error } = await db.from('integrations').update(patch).eq('id', integrationId)
    if (error) throw new Error(error.message)
  } else {
    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh_token. Revoke app access and try again with prompt=consent.')
    }
    const { data, error } = await db
      .from('integrations')
      .insert({
        household_id: householdId,
        provider: 'google_calendar',
        account_key: email,
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        meta: { email },
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    integrationId = data.id
  }

  // Merge in US Holidays when Google hides it from calendarList but the calendar is readable.
  const byId = new Map<string, CalendarListItem>()
  for (const cal of calendars) {
    if (cal.id) byId.set(cal.id, cal)
  }
  if (!byId.has(US_HOLIDAYS.id)) {
    const probe = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(US_HOLIDAYS.id)}/events?` +
        new URLSearchParams({ maxResults: '1', singleEvents: 'true' }),
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    )
    if (probe.ok) {
      byId.set(US_HOLIDAYS.id, { id: US_HOLIDAYS.id, summary: US_HOLIDAYS.summary, primary: false })
      console.log('\nNote: Google hid Holidays from calendarList; adding it by known calendar id.')
    }
  }

  console.log(`\nLinked Google account: ${email}`)
  console.log(`Primary member mapping: ${memberSlug}`)
  console.log('\nCalendars:')

  for (const cal of byId.values()) {
    if (!cal.id || !cal.summary) continue
    const memberId = cal.primary ? primaryMemberId : null
    const { error } = await db.from('calendar_sources').upsert(
      {
        household_id: householdId,
        integration_id: integrationId!,
        external_id: cal.id,
        name: cal.summary,
        member_id: memberId,
        account_email: email,
        enabled: true,
      },
      { onConflict: 'household_id,integration_id,external_id' },
    )
    if (error) throw new Error(error.message)
    const who = cal.primary ? memberSlug : 'family'
    console.log(`  - ${cal.summary}${cal.primary ? ' (primary)' : ''} → ${who}`)
  }

  console.log('\nDone. Run `pnpm google:calendar-sync` (or wait for the edge cron) to pull events.')
  console.log('Link another person with: pnpm google:calendar-login -- --member shelby\n')
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1:8788')
    if (url.pathname !== '/callback') {
      res.writeHead(404).end('Not found')
      return
    }
    const code = url.searchParams.get('code')
    const err = url.searchParams.get('error')
    if (err || !code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end(`Auth failed: ${err ?? 'missing code'}`)
      server.close()
      process.exit(1)
    }

    const tokens = await exchangeCode(code)
    const email = await fetchEmail(tokens.access_token!)
    const calendars = await listCalendars(tokens.access_token!)
    await saveAccount(tokens, email, calendars)

    res.writeHead(200, { 'Content-Type': 'text/html' }).end(
      `<h1>Google Calendar linked</h1><p>${email} is connected. You can close this tab.</p>`,
    )
    server.close()
    process.exit(0)
  } catch (e) {
    console.error(e)
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end(e instanceof Error ? e.message : 'Error')
    server.close()
    process.exit(1)
  }
})

server.listen(8788, '127.0.0.1', () => {
  console.log('Open this URL, pick a Google account, and approve calendar access:\n')
  console.log(authUrl + '\n')
  console.log(`After approval, calendars will map primary → ${memberSlug}, others → family.\n`)
})
