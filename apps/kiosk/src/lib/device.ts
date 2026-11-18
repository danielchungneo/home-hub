/** Same-origin `/api/device` on the Pi (Caddy → hub-device.py). */

const base = '/api/device'

export type WifiRestartResult = {
  ok: boolean
  error?: string
  detail?: string | null
}

export async function restartWifi(): Promise<WifiRestartResult> {
  let res: Response
  try {
    res = await fetch(`${base}/wifi/restart`, { method: 'POST' })
  } catch {
    throw new Error('Wi‑Fi helper isn’t reachable. Is hub-device running on the Pi?')
  }

  let data: WifiRestartResult = { ok: false }
  try {
    data = (await res.json()) as WifiRestartResult
  } catch {
    throw new Error(res.ok ? 'Unexpected response from Wi‑Fi helper' : `Wi‑Fi restart failed (${res.status})`)
  }

  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Wi‑Fi restart failed (${res.status})`)
  }
  return data
}
