import { createHubClient, type Database } from '@hub/shared'
import ws from 'ws'
import { config } from './config'

/** Service-role client: bypasses RLS. Only runs on the Pi, never in the browser. */
export const db = createHubClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  // Node 20 has no global WebSocket; supabase-js Realtime needs an explicit transport.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ws vs DOM WebSocket typings disagree on onerror
  realtime: { transport: ws as any },
})

export type SpeakerRow = Database['public']['Tables']['speakers']['Row']
export type CommandRow = Database['public']['Tables']['jukebox_commands']['Row']
