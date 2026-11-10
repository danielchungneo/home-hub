/**
 * Manually invoke the calendar-sync edge function.
 *   pnpm google:calendar-sync
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in packages/google-calendar/.env')
  process.exit(1)
}

const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/calendar-sync`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({}),
})

const text = await res.text()
if (!res.ok) {
  console.error(`Sync failed (${res.status}): ${text}`)
  process.exit(1)
}
console.log(text || `OK ${res.status}`)
