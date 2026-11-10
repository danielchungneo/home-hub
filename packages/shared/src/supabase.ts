import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type HubClientOptions = SupabaseClientOptions<'public'>;

/**
 * Typed Supabase client factory for Vite (kiosk) and Expo (mobile).
 * Pass platform-specific auth storage via `options.auth.storage` when needed.
 */
export function createHubClient(url: string, key: string, options?: HubClientOptions) {
  if (!url || !key) {
    throw new Error('createHubClient requires both url and key');
  }

  return createClient<Database>(url, key, {
    ...options,
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      ...options?.auth,
    },
  });
}

export type HubClient = ReturnType<typeof createHubClient>;
