import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { config } from './config'
import { searchMusic } from './spotify/webApi'

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(json)
}

function readUrl(req: IncomingMessage) {
  return new URL(req.url ?? '/', `http://127.0.0.1:${config.httpPort}`)
}

/** Tiny localhost API for the kiosk (search). Proxied by Caddy at /api/music/*. */
export function startHttpServer() {
  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        })
        res.end()
        return
      }

      const url = readUrl(req)
      if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
        send(res, 200, { ok: true })
        return
      }

      if (req.method === 'GET' && url.pathname === '/search') {
        const q = url.searchParams.get('q') ?? ''
        const results = await searchMusic(q)
        send(res, 200, { results })
        return
      }

      send(res, 404, { error: 'Not found' })
    } catch (err) {
      console.error('[music-agent] http error', err instanceof Error ? err.message : err)
      send(res, 500, { error: err instanceof Error ? err.message : 'Server error' })
    }
  })

  server.listen(config.httpPort, '127.0.0.1', () => {
    console.log(`[music-agent] http://127.0.0.1:${config.httpPort} (search API)`)
  })

  return server
}
