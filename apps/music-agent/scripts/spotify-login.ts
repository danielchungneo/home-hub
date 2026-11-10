/**
 * One-time Spotify OAuth on your Windows/Mac PC.
 * Run: pnpm --filter @hub/music-agent spotify:login
 *
 * Spotify app redirect URI must be exactly: http://127.0.0.1:8888/callback
 * Paste the printed refresh token into apps/music-agent/.env as SPOTIFY_REFRESH_TOKEN.
 */
import { createServer } from 'node:http'
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })

const clientId = process.env.SPOTIFY_CLIENT_ID
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
const redirectUri = 'http://127.0.0.1:8888/callback'
const scopes = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')

if (!clientId || !clientSecret) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in apps/music-agent/.env first.')
  process.exit(1)
}

const authUrl =
  'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
  }).toString()

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1:8888')
    if (url.pathname !== '/callback') {
      res.writeHead(404).end('Not found')
      return
    }
    const code = url.searchParams.get('code')
    const err = url.searchParams.get('error')
    if (err || !code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end(`Auth failed: ${err ?? 'missing code'}`)
      server.close()
      process.exit(1)
    }

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })
    const data = (await tokenRes.json()) as { refresh_token?: string; error?: string }
    if (!tokenRes.ok || !data.refresh_token) {
      res.writeHead(500, { 'Content-Type': 'text/plain' }).end(`Token exchange failed: ${data.error ?? tokenRes.status}`)
      server.close()
      process.exit(1)
    }

    console.log('\nSPOTIFY_REFRESH_TOKEN=' + data.refresh_token)
    console.log('\nPaste that into apps/music-agent/.env, then you can close this window.\n')
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(
      '<h1>Spotify linked</h1><p>Copy the refresh token from the terminal into <code>apps/music-agent/.env</code>, then close this tab.</p>',
    )
    server.close()
  } catch (e) {
    console.error(e)
    res.writeHead(500).end('Error')
    server.close()
    process.exit(1)
  }
})

server.listen(8888, '127.0.0.1', () => {
  console.log('Open this URL in your browser and approve Spotify:\n')
  console.log(authUrl + '\n')
})
