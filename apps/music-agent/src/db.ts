import { createClient } from '@supabase/supabase-js'
import type { Database } from '@hub/shared'
import ws from 'ws'
import { config } from './config'

/** Service-role client: bypasses RLS. Only runs on the Pi, never in the browser. */
export const db = createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  // Node 20 has no global WebSocket; supabase-js Realtime needs an explicit transport.
  realtime: { transport: ws as unknown as typeof WebSocket },
})

export type SpeakerRow = Database['public']['Tables']['speakers']['Row']
export type CommandRow = Database['public']['Tables']['jukebox_commands']['Row']
