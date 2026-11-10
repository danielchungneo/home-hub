/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_KIOSK_EMAIL?: string
  readonly VITE_KIOSK_PASSWORD?: string
  /** Optional override; default is same-origin `/api/music` (Caddy / Vite proxy). */
  readonly VITE_MUSIC_AGENT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
