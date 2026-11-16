import { config } from './config'
import { db } from './db'
import { startHttpServer } from './http'
import { drainPending, enqueueCommand, syncPlaybackState } from './worker'
import { refreshSpeakers } from './speakers'
import { isSpotifyRateLimited, spotifyRateLimitedUntil } from './spotify/webApi'
import type { CommandRow } from './db'

/** Poll now-playing often while active; idle / rate-limited stretches stay quiet. */
const SYNC_PLAYING_MS = 5_000
const SYNC_IDLE_MS = 30_000

async function main() {
  console.log(`[music-agent] starting for household ${config.householdId}`)
  const http = startHttpServer()

  // Do not hit Spotify on boot — a restart during a 429 window extends the lockout.
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

  let syncTimer: ReturnType<typeof setTimeout> | undefined
  const scheduleSync = (delayMs: number) => {
    clearTimeout(syncTimer)
    syncTimer = setTimeout(() => void runSync(), delayMs)
  }
  const runSync = async () => {
    if (isSpotifyRateLimited()) {
      const wait = Math.max(1_000, spotifyRateLimitedUntil() - Date.now())
      console.warn(`[music-agent] Spotify rate-limited; next sync in ${Math.ceil(wait / 1000)}s`)
      scheduleSync(wait)
      return
    }
    const playing = await syncPlaybackState()
    scheduleSync(playing ? SYNC_PLAYING_MS : SYNC_IDLE_MS)
  }
  // Quiet boot — avoid extending a 429 window with sync/device polls.
  scheduleSync(Math.max(SYNC_IDLE_MS, 60_000))

  let speakerTimer: ReturnType<typeof setInterval> | undefined
  const refreshSpeakersSafe = () => {
    if (isSpotifyRateLimited()) return
    void refreshSpeakers().catch((err) => {
      console.warn('[music-agent] speaker refresh failed', err instanceof Error ? err.message : err)
    })
  }
  setTimeout(() => {
    refreshSpeakersSafe()
    speakerTimer = setInterval(refreshSpeakersSafe, 60_000)
  }, 60_000)

  const shutdown = async () => {
    clearTimeout(syncTimer)
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
