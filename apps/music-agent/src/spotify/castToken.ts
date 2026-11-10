import { createHmac } from 'node:crypto'
import { config } from '../config'

type CastToken = { accessToken: string; expiresAt: number }
let cached: CastToken | null = null

/**
 * Current Spotify web-player TOTP secrets (ASCII digit bytes used directly as HMAC key).
 * Spotify rotates these; newest first. Captured scheme matches spotcast / Lyrix / eIsland (totpVer 61).
 */
const TOTP_SECRETS: { version: number; secret: number[] }[] = [
  {
    version: 61,
    secret: [
      51, 55, 54, 49, 51, 54, 51, 56, 55, 53, 51, 56, 52, 53, 57, 56, 57, 51, 56, 56, 51,
      51, 49, 50, 51, 49, 48, 57, 49, 49, 57, 57, 50, 56, 52, 55, 49, 49, 50, 52, 52, 56,
      56, 57, 52, 52, 49, 48, 50, 49, 48, 53, 49, 49, 50, 57, 55, 49, 48, 56,
    ],
  },
  {
    version: 60,
    secret: [
      55, 48, 49, 48, 51, 55, 56, 49, 49, 57, 56, 55, 55, 57, 51, 51, 57, 48, 55, 57, 52,
      56, 52, 49, 51, 54, 56, 51, 56, 49, 55, 53, 55, 55, 57, 57, 51, 55, 54, 52, 57, 50,
      55, 52, 55, 51,
    ],
  },
  {
    version: 59,
    secret: [
      49, 49, 52, 57, 57, 54, 56, 55, 52, 57, 57, 53, 51, 53, 57, 49, 48, 57, 52, 53, 51,
      53, 54, 55, 56, 50, 55, 54, 57, 51, 55, 49, 55, 56, 51, 56, 52, 55, 57, 54, 53, 55,
      49, 48, 52, 52, 55, 52, 51, 49, 50, 53, 49, 48, 56, 50, 56, 49, 50, 49, 49, 52, 50,
      49, 55, 56, 57, 57, 57, 54,
    ],
  },
]

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const hmac = createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[19]! & 0x0f
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

function totp(secret: Buffer, unixSeconds: number): string {
  return hotp(secret, Math.floor(unixSeconds / 30))
}

async function serverTime(): Promise<number> {
  const res = await fetch('https://open.spotify.com/api/server-time', {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Origin: 'https://open.spotify.com',
    },
  })
  const text = await res.text()
  if (!text.trim().startsWith('{')) {
    throw new Error(`server-time returned non-JSON (${res.status})`)
  }
  const data = JSON.parse(text) as { serverTime?: number }
  if (typeof data.serverTime !== 'number') throw new Error('server-time missing serverTime')
  return data.serverTime
}

/**
 * Access token from the Spotify web-player cookies (sp_dc + optional sp_key).
 * Needed to authenticate the Cast Spotify receiver on Google speakers.
 * Unofficial — Spotify can change this without notice.
 */
export async function getCastAccessToken(): Promise<string> {
  if (!config.spotifySpDc) {
    throw new Error('SPOTIFY_SP_DC is not set. Cast wake needs the open.spotify.com sp_dc cookie.')
  }
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken

  const sTime = await serverTime()
  const cTime = Math.floor(Date.now() / 1000)
  const cookie = config.spotifySpKey
    ? `sp_dc=${config.spotifySpDc}; sp_key=${config.spotifySpKey}`
    : `sp_dc=${config.spotifySpDc}`

  const headers = {
    Cookie: cookie,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Origin: 'https://open.spotify.com',
    Referer: 'https://open.spotify.com/',
  }

  const failures: string[] = []
  for (const { version, secret } of TOTP_SECRETS) {
    const code = totp(Buffer.from(secret), sTime)
    const params = new URLSearchParams({
      reason: 'transport',
      productType: 'web-player',
      totp: code,
      totpServer: code,
      totpVer: String(version),
      sTime: String(sTime),
      cTime: String(cTime),
    })

    const res = await fetch(`https://open.spotify.com/api/token?${params}`, {
      headers,
      redirect: 'manual',
    })

    if (res.status === 302) {
      const location = res.headers.get('location') ?? ''
      if (location.includes('_authfailed=1')) {
        throw new Error(
          'Spotify rejected sp_dc (auth failed). Re-copy sp_dc and sp_key from open.spotify.com without logging out.',
        )
      }
      failures.push(`v${version} redirect`)
      continue
    }

    const text = await res.text()
    if (!text.trim().startsWith('{')) {
      failures.push(`v${version} → ${res.status} non-JSON`)
      continue
    }
    const data = JSON.parse(text) as {
      accessToken?: string
      accessTokenExpirationTimestampMs?: number
      error?: { message?: string } | string
    }
    if (data.accessToken) {
      cached = {
        accessToken: data.accessToken,
        expiresAt: data.accessTokenExpirationTimestampMs ?? Date.now() + 30 * 60_000,
      }
      console.log(`[music-agent] cast token ok (totpVer ${version})`)
      return cached.accessToken
    }
    const err = typeof data.error === 'string' ? data.error : data.error?.message ?? `HTTP ${res.status}`
    failures.push(`v${version} → ${err}`)
  }

  throw new Error(
    `Could not get Cast token from sp_dc (${failures.join('; ')}). Re-copy sp_dc/sp_key, or Spotify rotated TOTP secrets again.`,
  )
}
