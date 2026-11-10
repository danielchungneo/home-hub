import { useEffect, useState } from 'react'
import { IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Label } from '../../components/primitives'
import { totalLengthMs, trackTime } from '../../lib/jukeboxMedia'
import type { Track } from '@hub/shared'
import { Cover, Equalizer, artVars } from './parts'
import type { Jukebox } from './useJukebox'
import s from './Jukebox.module.css'

function Elapsed({ jb }: { jb: Jukebox }) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!jb.player.playing) return
    const id = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [jb.player.playing, jb.player.current, jb.player.positionMs])
  return <>{trackTime(jb.elapsedMs())}</>
}

function ProgressBar({ jb, track, thin }: { jb: Jukebox; track: Track; thin?: boolean }) {
  const duration = track.durationMs || jb.player.durationMs || 1
  const { playing, positionAt } = jb.player
  return (
    <div className={thin ? `${s.progress} ${s.progressThin}` : s.progress} role="progressbar" aria-label="Song progress"
      aria-valuemin={0} aria-valuemax={Math.round(duration / 1000)} aria-valuenow={Math.round(jb.elapsedMs() / 1000)}>
      <span
        key={`${track.uri}-${positionAt}-${jb.player.positionMs}`}
        className={s.progressFill}
        style={{ animationDuration: `${duration}ms`, animationDelay: `-${jb.elapsedMs()}ms`, animationPlayState: playing ? 'running' : 'paused' }}
      />
    </div>
  )
}

export function statusLine(jb: Jukebox) {
  const { playing, speakerId, from } = jb.player
  const name = jb.speakers.find((sp) => sp.id === speakerId)?.name ?? 'speaker'
  return `${playing ? 'Playing in' : 'Paused in'} ${name}${from ? ` · from ${from}` : ''}`
}

export function NowPlaying({ jb }: { jb: Jukebox }) {
  const { player } = jb
  const track = player.track
  if (!track) {
    return (
      <section className={`${s.panel} ${s.nothing}`}>
        <span className={s.emptyTitle}>Nothing playing</span>
        <span>Pick a song, album or playlist to get started.</span>
      </section>
    )
  }

  const duration = track.durationMs || player.durationMs

  return (
    <div className={s.nowLayout}>
      <section aria-label="Now playing" className={player.playing ? s.stage : `${s.stage} ${s.stagePaused}`} style={artVars(track.art)}>
        <span className={s.glow} aria-hidden="true" />
        <div className={s.stageMain}>
          <div className={s.artWrap}>
            <span className={s.ring} aria-hidden="true" />
            <span className={s.ring} aria-hidden="true" />
            <span className={s.ring} aria-hidden="true" />
            <span className={s.vinyl} aria-hidden="true"><span className={s.vinylDisc}><span className={s.vinylLabel} /></span></span>
            <div className={s.bigArt}><div className={s.bigArtInner}><Cover item={track} size={400} /></div></div>
          </div>
          <div className={s.nowInfo}>
            <div className={s.nowText}>
              <span className={s.nowStatus}>{statusLine(jb)}</span>
              <span className={s.nowTitle}>{track.title}</span>
              <span className={s.nowArtist}>{track.artist}</span>
              {track.album && <span className={s.nowAlbum}>{track.album}</span>}
            </div>
            <div className={s.scrub}>
              <ProgressBar jb={jb} track={{ ...track, durationMs: duration }} />
              <div className={s.times}><span><Elapsed jb={jb} /></span><span>{trackTime(duration)}</span></div>
            </div>
            <div className={s.controls}>
              <IconButton icon="shuffle" label="Shuffle" aria-pressed={player.shuffle} size="lg" variant={player.shuffle ? 'primary' : 'surface'} onClick={jb.toggleShuffle} />
              <IconButton icon="prev" label="Previous song" size="xl" variant="surface" onClick={jb.prev} />
              <button type="button" className={s.bigPlay} aria-label={player.playing ? 'Pause' : 'Play'} onClick={jb.toggle}>
                <Icon name={player.playing ? 'pause' : 'play'} size={46} />
              </button>
              <IconButton icon="next" label="Next song" size="xl" variant="surface" onClick={jb.next} />
              <IconButton icon="repeat" label="Repeat" aria-pressed={player.repeat} size="lg" variant={player.repeat ? 'primary' : 'surface'} onClick={jb.toggleRepeat} />
            </div>
            <div className={s.volume}>
              <IconButton icon="minus" label="Volume down" variant="surface" onClick={() => jb.volume(-1)} />
              <span className={s.volMid}>
                Volume {player.volume}
                <span className={s.volTrack}><span className={s.volFill} style={{ transform: `scaleX(${player.volume / 10})` }} /></span>
              </span>
              <IconButton icon="plus" label="Volume up" variant="surface" onClick={() => jb.volume(1)} />
            </div>
          </div>
        </div>
        <div className={s.speakers}>
          <Label>Play on</Label>
          {jb.speakers.map((sp) => {
            const on = sp.id === player.speakerId
            return (
              <button key={sp.id} type="button" aria-pressed={on} onClick={() => jb.setSpeaker(sp.id)}
                className={[s.speaker, on && s.speakerOn, !sp.available && s.speakerAsleep].filter(Boolean).join(' ')}>
                <Icon name="speaker" size={20} />
                {sp.available ? sp.name : `${sp.name} · asleep`}
              </button>
            )
          })}
        </div>
      </section>

      <aside aria-label="Up next" className={`${s.panel} ${s.queuePanel}`}>
        <div className={s.queueHead}>
          <div>
            <h2 className={s.queueTitle}>Up next</h2>
            <span className={s.queueMeta}>
              {jb.queueTracks.length
                ? `${jb.queueTracks.length} ${jb.queueTracks.length === 1 ? 'song' : 'songs'} · ${totalLengthMs(jb.queueTracks)}`
                : 'Queue is empty'}
            </span>
          </div>
          {jb.queueTracks.length > 0 && <button type="button" className={s.clear} onClick={jb.clearQueue}>Clear</button>}
        </div>
        <ol className={`${s.queueList} scroll-y`}>
          {jb.queueTracks.map((t, i) => (
            <li key={`${t.uri}-${i}`} className={s.queueRow}>
              <span className={s.grip} aria-hidden="true"><Icon name="grip" size={18} /></span>
              <button type="button" className={s.rowMain} aria-label={`Play ${t.title} now`} onClick={() => jb.playFromQueue(i)}>
                <span className={s.rowArt}><Cover item={t} size={52} /></span>
                <span className={s.rowText}>
                  <span className={s.rowTitle}>{t.title}</span>
                  <span className={s.rowSub}>{t.artist} · {trackTime(t.durationMs)}</span>
                </span>
              </button>
              <IconButton icon="arrow-up" label={`Move ${t.title} up`} round={false} disabled={i === 0} onClick={() => jb.moveUp(i)} />
              <IconButton icon="close" label={`Remove ${t.title} from queue`} round={false} onClick={() => jb.remove(i)} />
            </li>
          ))}
        </ol>
        {!jb.queueTracks.length && (
          <div className={s.empty}>
            <span className={s.emptyTitle}>Nothing queued</span>
            <span>Add songs from Songs, Playlists or Albums, or tap Play next to slot one in right after this song.</span>
          </div>
        )}
        <span className={s.queueFoot}>{player.from ? `Playing from ${player.from} · stops when the queue runs out` : 'Stops when the queue runs out'}</span>
      </aside>
    </div>
  )
}

export function MiniPlayer({ jb, onOpen }: { jb: Jukebox; onOpen: () => void }) {
  const { player } = jb
  const track = player.track
  if (!track) return null
  const duration = track.durationMs || player.durationMs
  return (
    <section aria-label="Player" className={player.playing ? s.mini : `${s.mini} ${s.stagePaused}`} style={artVars(track.art)}>
      <button type="button" className={s.miniTrack} aria-label={`Open now playing: ${track.title}`} onClick={onOpen}>
        <span className={s.miniArtWrap}>
          <span className={s.miniPulse} aria-hidden="true" />
          <span className={s.miniArt}><Cover item={track} size={76} /></span>
        </span>
        <span className={s.miniText}>
          <span className={s.miniStatus}><Equalizer playing={player.playing} />{statusLine(jb)}</span>
          <span className={s.miniTitle}>{track.title}</span>
          <span className={s.miniArtist}>{track.artist}</span>
        </span>
        <Icon name="chevron-up" size={24} />
      </button>
      <div className={s.miniCenter}>
        <div className={s.miniControls}>
          <IconButton icon="prev" label="Previous song" variant="surface" onClick={jb.prev} />
          <button type="button" className={s.miniPlay} aria-label={player.playing ? 'Pause' : 'Play'} onClick={jb.toggle}>
            <Icon name={player.playing ? 'pause' : 'play'} size={26} />
          </button>
          <IconButton icon="next" label="Next song" variant="surface" onClick={jb.next} />
        </div>
        <div className={s.miniScrub}>
          <span><Elapsed jb={jb} /></span>
          <ProgressBar jb={jb} track={{ ...track, durationMs: duration }} thin />
          <span>{trackTime(duration)}</span>
        </div>
      </div>
      <div className={s.miniRight}>
        <button type="button" className={s.upNext} onClick={onOpen}>
          <Icon name="queue" size={22} />
          {jb.queueTracks.length ? `Up next · ${jb.queueTracks.length}` : 'Queue empty'}
        </button>
      </div>
    </section>
  )
}
