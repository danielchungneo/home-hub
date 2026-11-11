import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const publicDir = join(root, 'public-host')
const vercelShop = resolve(root, '../../../smart-home/Chung Smart Home/spotify-nfc/shop')

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

mkdirSync(publicDir, { recursive: true })
writeFileSync(join(publicDir, 'index.html'), inlined)
console.log(`Wrote public-host/index.html (${Math.round(inlined.length / 1024)} KB)`)

if (existsSync(dirname(vercelShop))) {
  mkdirSync(vercelShop, { recursive: true })
  writeFileSync(join(vercelShop, 'index.html'), inlined)
  console.log(`Wrote ${vercelShop}/index.html for Vercel /shop`)
}
