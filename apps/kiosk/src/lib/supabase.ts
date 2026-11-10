import { createHubClient } from '@hub/shared'

function required(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (!value) throw new Error(`Missing ${name}. Copy apps/kiosk/.env.example to apps/kiosk/.env and fill it in.`)
  return value
}

const url = required('VITE_SUPABASE_URL')
const key = required('VITE_SUPABASE_PUBLISHABLE_KEY')
const email = required('VITE_KIOSK_EMAIL')
const password = required('VITE_KIOSK_PASSWORD')

export const supabase = createHubClient(url, key)

let signingIn: Promise<void> | null = null

/** Signs in as the kiosk device user, reusing the stored session when there is one. */
export function ensureSession(): Promise<void> {
  signingIn ??= (async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  })().catch((err: unknown) => {
    signingIn = null
    throw err
  })
  return signingIn
}
