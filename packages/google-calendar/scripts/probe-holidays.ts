import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })

const HOLIDAY_ID = 'en.usa#holiday@group.v.calendar.google.com'

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: row } = await db
  .from('integrations')
  .select('refresh_token, access_token, expires_at')
  .eq('provider', 'google_calendar')
  .single()

async function accessToken() {
  if (row!.access_token && row!.expires_at && Date.parse(row!.expires_at) > Date.now() + 60_000) {
    return row!.access_token as string
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: row!.refresh_token as string,
      grant_type: 'refresh_token',
    }),
  })
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error('refresh failed')
  return data.access_token
}

const access = await accessToken()
const headers = { Authorization: `Bearer ${access}` }

async function check(label: string, url: string) {
  const res = await fetch(url, { headers })
  const text = await res.text()
  console.log(`\n=== ${label} ===`)
  console.log('http', res.status)
  console.log(text.slice(0, 800))
}

await check('calendarList raw', 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250&showHidden=true')
await check('calendars.get holidays', `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(HOLIDAY_ID)}`)
await check(
  'events.list holidays (next 30d)',
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(HOLIDAY_ID)}/events?` +
    new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      maxResults: '5',
    }),
)
await check(
  'calendarList.insert holidays',
  'POST_PLACEHOLDER',
)

// Try subscribe via calendarList.insert
{
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: HOLIDAY_ID }),
  })
  const text = await res.text()
  console.log('\n=== calendarList.insert holidays ===')
  console.log('http', res.status)
  console.log(text.slice(0, 800))
}

await check('calendarList after insert', 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250&showHidden=true')
