import { createClient } from '@supabase/supabase-js'
import type { Database } from '@hub/shared'
import { config } from './config'

/** Service-role client: bypasses RLS. Only runs on the Pi, never in the browser. */
export const db = createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export type SpeakerRow = Database['public']['Tables']['speakers']['Row']
export type CommandRow = Database['public']['Tables']['jukebox_commands']['Row']
