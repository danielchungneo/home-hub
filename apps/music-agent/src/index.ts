import { config } from './config'
import { db } from './db'
import { startHttpServer } from './http'
import { drainPending, enqueueCommand, syncPlaybackState } from './worker'
import { refreshSpeakers } from './speakers'
import type { CommandRow } from './db'

async function main() {
  console.log(`[music-agent] starting for household ${config.householdId}`)
  const http = startHttpServer()

  try {
    await refreshSpeakers()
  } catch (err) {
    console.warn('[music-agent] initial speaker refresh failed', err instanceof Error ? err.message : err)
  }

  await drainPending()

  const channel = db
    .channel(`jukebox:${config.householdId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'jukebox_commands',
        filter: `household_id=eq.${config.householdId}`,
      },
      (payload) => {
        const row = payload.new as CommandRow
        if (row.status !== 'pending') return
        void enqueueCommand(row)
      },
    )
    .subscribe((status) => {
      console.log(`[music-agent] realtime ${status}`)
    })

  const syncTimer = setInterval(() => void syncPlaybackState(), 5_000)
  const speakerTimer = setInterval(() => void refreshSpeakers().catch(() => {}), 60_000)

  const shutdown = async () => {
    clearInterval(syncTimer)
    clearInterval(speakerTimer)
    http.close()
    await db.removeChannel(channel)
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
}

main().catch((err) => {
  console.error('[music-agent] fatal', err)
  process.exit(1)
})
