import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const outDir = resolve(root, '../../supabase/functions/recipe-ingest')
const publicDir = join(root, 'public-host')

if (!existsSync(dist)) {
  console.error('Missing dist/. Run vite build first.')
  process.exit(1)
}

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const assetsDir = join(dist, 'assets')
const assets = existsSync(assetsDir) ? readdirSync(assetsDir) : []
const jsName = assets.find((f) => f.endsWith('.js'))
const cssName = assets.find((f) => f.endsWith('.css'))
if (!jsName) {
  console.error('No JS bundle found in dist/assets')
  process.exit(1)
}

const js = readFileSync(join(assetsDir, jsName), 'utf8')
const css = cssName ? readFileSync(join(assetsDir, cssName), 'utf8') : ''

const inlined = html
  .replace(/<script type="module" crossorigin src="\.\/assets\/[^"]+"><\/script>/, () => `<script type="module">${js}</script>`)
  .replace(/<link rel="stylesheet"[^>]*href="\.\/assets\/[^"]+"[^>]*>/, () => (css ? `<style>${css}</style>` : ''))

mkdirSync(outDir, { recursive: true })
mkdirSync(publicDir, { recursive: true })
writeFileSync(join(publicDir, 'index.html'), inlined)

// Edge function only redirects; Supabase Forces text/plain + CSP sandbox on HTML bodies.
writeFileSync(
  join(outDir, 'index.ts'),
  `import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const PAGE =
  "https://zgobtwaajbwxdtiatjyq.supabase.co/storage/v1/object/public/recipe-ingest/index.html"

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    })
  }
  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  const target = token ? \`\${PAGE}?token=\${encodeURIComponent(token)}\` : PAGE
  return Response.redirect(target, 302)
})
`,
)

console.log(`Wrote public-host/index.html (${Math.round(inlined.length / 1024)} KB) and redirecting recipe-ingest function`)
