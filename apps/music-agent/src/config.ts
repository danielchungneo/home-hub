import { config as loadEnv } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}. Copy apps/music-agent/.env.example to .env and fill it in.`)
  return value
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  householdId: required('HOUSEHOLD_ID'),
  spotifyClientId: required('SPOTIFY_CLIENT_ID'),
  spotifyClientSecret: required('SPOTIFY_CLIENT_SECRET'),
  spotifyRefreshToken: required('SPOTIFY_REFRESH_TOKEN'),
  spotifySpDc: process.env.SPOTIFY_SP_DC?.trim() || '',
  spotifySpKey: process.env.SPOTIFY_SP_KEY?.trim() || '',
  castDiscoverMs: Number(process.env.CAST_DISCOVER_MS ?? 4000),
  wakeTimeoutMs: Number(process.env.WAKE_TIMEOUT_MS ?? 20_000),
  httpPort: Number(process.env.MUSIC_AGENT_HTTP_PORT ?? 8787),
}
