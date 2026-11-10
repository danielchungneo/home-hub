import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })

const householdId = process.env.HOUSEHOLD_ID ?? '11111111-1111-1111-1111-111111111111'
const holidayId = 'en.usa#holiday@group.v.calendar.google.com'

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: integ, error: iErr } = await db
  .from('integrations')
  .select('id, account_key')
  .eq('provider', 'google_calendar')
  .eq('household_id', householdId)
  .single()

if (iErr || !integ) {
  console.error(iErr?.message ?? 'No google_calendar integration')
  process.exit(1)
}

const { error } = await db.from('calendar_sources').upsert(
  {
    household_id: householdId,
    integration_id: integ.id,
    external_id: holidayId,
    name: 'Holidays in United States',
    member_id: null,
    account_email: integ.account_key,
    enabled: true,
  },
  { onConflict: 'household_id,integration_id,external_id' },
)

if (error) {
  console.error(error.message)
  process.exit(1)
}

console.log('Added Holidays in United States for', integ.account_key)
console.log('Run: pnpm google:calendar-sync')
