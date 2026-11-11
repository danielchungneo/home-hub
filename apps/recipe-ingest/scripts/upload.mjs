import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const htmlPath = join(root, 'public-host/index.html')
const envPath = resolve(root, '../kiosk/.env')

if (!existsSync(htmlPath)) {
  console.error('Missing public-host/index.html. Run build first.')
  process.exit(1)
}
if (!existsSync(envPath)) {
  console.error('Missing apps/kiosk/.env for upload credentials.')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i), line.slice(i + 1)]
    }),
)

const base = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!base || !key) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing in kiosk .env')
  process.exit(1)
}

const html = readFileSync(htmlPath)
const url = `${base}/storage/v1/object/recipe-ingest/index.html`
const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    apikey: key,
    'Content-Type': 'text/html; charset=utf-8',
    'x-upsert': 'true',
  },
  body: html,
})

if (!res.ok) {
  console.error(`Upload failed: ${res.status} ${await res.text()}`)
  process.exit(1)
}

console.log(`Uploaded ${base}/storage/v1/object/public/recipe-ingest/index.html`)
