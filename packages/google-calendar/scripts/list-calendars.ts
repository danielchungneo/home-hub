import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: row, error } = await db
  .from('integrations')
  .select('refresh_token, access_token, expires_at, account_key')
  .eq('provider', 'google_calendar')
  .single()

if (error || !row) {
  console.error(error?.message ?? 'no integration')
  process.exit(1)
}

async function accessToken() {
  if (row.access_token && row.expires_at && Date.parse(row.expires_at) > Date.now() + 60_000) {
    return row.access_token as string
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: row.refresh_token as string,
      grant_type: 'refresh_token',
    }),
  })
  const data = (await res.json()) as { access_token?: string; error?: string }
  if (!data.access_token) throw new Error(data.error ?? 'refresh failed')
  return data.access_token
}

const access = await accessToken()
const res = await fetch(
  'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250&showHidden=true&showDeleted=false',
  { headers: { Authorization: `Bearer ${access}` } },
)
const data = (await res.json()) as {
  items?: Array<{
    id?: string
    summary?: string
    primary?: boolean
    selected?: boolean
    hidden?: boolean
    accessRole?: string
  }>
  error?: unknown
}

console.log('account:', row.account_key)
console.log('http:', res.status, 'calendars:', data.items?.length ?? 0)
if (data.error) console.log('error:', JSON.stringify(data.error, null, 2))
for (const c of data.items ?? []) {
  console.log(
    `- ${c.summary ?? '(no summary)'} | id=${c.id} | primary=${!!c.primary} selected=${c.selected} hidden=${c.hidden} role=${c.accessRole}`,
  )
}
