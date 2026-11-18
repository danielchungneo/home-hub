import { MEMBER_COLOR_PRESETS, type Member } from '@hub/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AVAILABLE_BLOB_CHARACTERS,
  BlobAvatar,
  parseBlobCharacter,
  playBlobMotion,
  type BlobAnimation,
  type BlobCharacterId,
} from '../components/BlobAvatar'
import { Icon } from '../components/Icon'
import { useJukeboxState, useMembers, useWeather } from '../data/hooks'
import { useLive } from '../data/live'
import { useClock } from '../hooks/useClock'
import { memberColorProps } from '../lib/colors'
import { clock, longDate } from '../lib/format'
import {
  avatarRadius,
  spawnBody,
  stepPhysics,
  type IdleBody,
  type IdleBounds,
  type IdleRect,
} from '../lib/idlePhysics'
import s from './Idle.module.css'

/** Soft one-shots keep faces alive on top of the bounce physics. */
/** Ambient face motion — wiggle is reserved for collision hits. */
const PEACEFUL_MOTIONS: BlobAnimation[] = ['blink', 'nod', 'squish', 'hop']
const RARE_MOTIONS: BlobAnimation[] = ['celebrate', 'hop']
const CAST_CAP = 11
/** Physics runs at 30 Hz, simulated a segment ahead; the compositor interpolates between keyframes. */
const STEP_MS = 1000 / 30
const SEGMENT_MS = 2000
const SEGMENT_KEYFRAMES = 20
/**
 * The cast moves, then rests completely still. While anything animates, Chromium redraws a 1080p
 * frame ~60×/s in the GPU process, which kept the Pi 3 at its soft temperature limit; at rest
 * nothing animates, so it draws nothing. Both are whole segments; speed eases over one segment.
 */
const MOVE_MS = 20_000
const REST_MS = 40_000
const RAMP_MS = SEGMENT_MS

/** Travel scale for a moment in the move phase: eases up from 0 and back down to 0 (smoothstep). */
function paceAt(t: number) {
  const r = Math.max(0, Math.min(1, t / RAMP_MS, (MOVE_MS - t) / RAMP_MS))
  return r * r * (3 - 2 * r)
}
/** Whole-avatar hit reaction on the wrapper inside each buddy (physics owns the buddy's translate). */
const HIT_WIGGLE: Keyframe[] = ([
  [0, 'rotate(0deg) scale(1)'],
  [0.16, 'rotate(-18deg) scale(1.08)'],
  [0.32, 'rotate(16deg) scale(1.1)'],
  [0.48, 'rotate(-12deg) scale(1.06)'],
  [0.64, 'rotate(10deg) scale(1.04)'],
  [0.8, 'rotate(-5deg) scale(1.02)'],
  [1, 'rotate(0deg) scale(1)'],
] as [number, string][]).map(([offset, transform]) => ({ offset, transform, easing: 'ease-in-out' }))
const HIT_WIGGLE_MS = 620
const BLOOMS: { color: string; className: string; soft?: boolean }[] = [
  { color: 'moss', className: s.bloom0 },
  { color: 'clay', className: s.bloom1 },
  { color: 'honey', className: s.bloom2 },
  { color: 'fjord', className: s.bloom3 },
  { color: 'plum', className: s.bloom4 },
  { color: 'berry', className: s.bloom5 },
  { color: 'ocean', className: s.bloom6 },
  { color: 'pine', className: s.bloom7 },
  { color: 'rose', className: s.bloom8, soft: true },
  { color: 'sand', className: s.bloom9, soft: true },
  { color: 'honey', className: s.bloom10, soft: true },
  { color: 'fjord', className: s.bloom11, soft: true },
]
const CONFETTI: { color: string; className: string }[] = [
  { color: 'honey', className: s.dot0 },
  { color: 'berry', className: s.dot1 },
  { color: 'fjord', className: s.dot2 },
  { color: 'moss', className: s.dot3 },
  { color: 'plum', className: s.dot4 },
  { color: 'clay', className: s.dot5 },
  { color: 'ocean', className: s.dot6 },
  { color: 'rose', className: s.dot7 },
  { color: 'sand', className: s.dot8 },
  { color: 'pine', className: s.dot9 },
  { color: 'berry', className: s.dot10 },
  { color: 'moss', className: s.dot11 },
  { color: 'plum', className: s.dot12 },
  { color: 'ocean', className: s.dot13 },
]

type IdleBuddy = {
  id: string
  kind: 'member' | 'guest'
  character: BlobCharacterId
  color: string
  size: number
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function buildCast(members: Member[]): IdleBuddy[] {
  const family = members.slice(0, 5)
  const usedChars = new Set(family.map((m) => parseBlobCharacter(m.avatar)))
  const usedColors = new Set(family.map((m) => m.color))
  const guestChars = AVAILABLE_BLOB_CHARACTERS.filter((c) => !usedChars.has(c))
  const guestColors = [
    ...MEMBER_COLOR_PRESETS.filter((c) => !usedColors.has(c)),
    ...MEMBER_COLOR_PRESETS,
  ]
  const guests = guestChars.slice(0, Math.max(0, CAST_CAP - family.length))

  const cast: IdleBuddy[] = family.map((m, i) => ({
    id: `member:${m.id}`,
    kind: 'member' as const,
    character: parseBlobCharacter(m.avatar),
    color: m.color,
    size: i === 0 ? 188 : 168 - i * 6,
  }))
  guests.forEach((character, i) => {
    cast.push({
      id: `guest:${character}`,
      kind: 'guest',
      character,
      color: guestColors[i % guestColors.length],
      size: 96 + ((i * 11) % 28),
    })
  })
  return cast
}

function screenBounds(): IdleBounds {
  return { width: window.innerWidth || 1920, height: window.innerHeight || 1080, pad: 20 }
}

/** The cards blobs bounce off. Reads layout, so it runs on mount, resize and content changes only. */
function obstacleRects(els: (HTMLElement | null)[]): IdleRect[] {
  return els.flatMap((el) => {
    if (!el) return []
    const r = el.getBoundingClientRect()
    return [{ x: r.left, y: r.top, w: r.width, h: r.height }]
  })
}

/** Screensaver: physics hangout with clock, date, and weather. Tap dismisses (App). */
export default function Idle() {
  const now = useClock()
  const weather = useWeather()
  const jukebox = useJukeboxState()
  const membersQ = useMembers()
  useLive('jukebox_state', 'jukeboxState')
  useLive('members', 'members')

  const cast = useMemo(() => buildCast(membersQ.data ?? []), [membersQ.data])
  const [ready, setReady] = useState(false)

  const weatherRef = useRef<HTMLDivElement>(null)
  const clockRef = useRef<HTMLDivElement>(null)
  const playingRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLSpanElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef(new Map<string, HTMLDivElement>())
  const bodiesRef = useRef<IdleBody[]>([])
  const obstaclesRef = useRef<IdleRect[]>([])
  const boundsRef = useRef<IdleBounds>({ width: 1920, height: 1080, pad: 24 })
  const bumpCoolRef = useRef(new Map<string, number>())
  const pairCoolRef = useRef(new Map<string, number>())
  /** True while the cast is resting; face motions hold off so nothing animates. */
  const restingRef = useRef(false)

  const w = weather.data
  const playing = jukebox.data?.nowPlaying

  const measure = useCallback(() => {
    boundsRef.current = screenBounds()
    obstaclesRef.current = obstacleRects([weatherRef.current, clockRef.current, playingRef.current, hintRef.current])
  }, [])

  // The cards only move when their content changes (weather loads, a song starts, the minute ticks).
  useEffect(() => { measure() }, [measure, w, playing, now])

  // Face motions go straight to the avatar's DOM node. Routing them through React state re-rendered
  // the whole Idle tree about once a second, which was most of its remaining main-thread cost.
  const playMotion = (id: string, anim: BlobAnimation) => {
    playBlobMotion(nodeRefs.current.get(id), anim)
  }

  // Face one-shots on a peaceful timer (separate from physics).
  useEffect(() => {
    if (!cast.length || reducedMotion()) return
    const timers: number[] = []
    let cancelled = false

    const schedule = () => {
      const delay = 900 + Math.floor(Math.random() * 1100)
      timers.push(window.setTimeout(() => {
        if (cancelled || !cast.length) return
        if (restingRef.current) { schedule(); return }
        const pick = cast[Math.floor(Math.random() * cast.length)]
        const pool = Math.random() < 0.1 ? RARE_MOTIONS : PEACEFUL_MOTIONS
        playMotion(pick.id, pool[Math.floor(Math.random() * pool.length)])
        schedule()
      }, delay))
    }

    timers.push(window.setTimeout(() => {
      cast.forEach((buddy, i) => {
        timers.push(window.setTimeout(
          () => playMotion(buddy.id, PEACEFUL_MOTIONS[i % PEACEFUL_MOTIONS.length]),
          400 + i * 140,
        ))
      })
      schedule()
    }, 700))

    return () => {
      cancelled = true
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [cast])

  // Bounce physics: spawn randomly, drift, rebound off walls / cards / each other.
  useEffect(() => {
    if (!cast.length) return
    const motionOk = !reducedMotion()

    measure()
    pairCoolRef.current.clear()
    const bodies: IdleBody[] = []
    for (const buddy of cast) {
      // Match the visible tint circle (not the full square hit-box).
      bodies.push(spawnBody(
        buddy.id,
        avatarRadius(buddy.size),
        boundsRef.current,
        obstaclesRef.current,
        bodies,
      ))
    }
    bodiesRef.current = bodies

    // Pixels only (no -50% translate) so the compositor can run the keyframes off the main thread.
    const half = new Map(cast.map((b) => [b.id, b.size / 2]))
    const position = (body: IdleBody) => {
      const h = half.get(body.id) ?? 0
      return `translate3d(${(body.x - h).toFixed(1)}px, ${(body.y - h).toFixed(1)}px, 0)`
    }

    // Paint initial positions (and static layout when motion is reduced).
    for (const body of bodies) {
      const node = nodeRefs.current.get(body.id)
      if (node) node.style.transform = position(body)
    }
    setReady(true)

    if (!motionOk) return

    // Writing transforms every frame cost the Pi 3 ~15 ms of main thread per frame. Instead, simulate
    // one segment ahead and hand each blob its path as Web Animations keyframes, which the
    // compositor plays smoothly; the main thread only wakes once per segment.
    const nodes = nodeRefs.current
    const steps = Math.round(SEGMENT_MS / STEP_MS)
    const sampleEvery = steps / SEGMENT_KEYFRAMES
    const timers: number[] = []
    const running = new Map<string, Animation>()
    let segmentTimer = 0
    /** How far into the current move phase this segment starts. */
    let phaseMs = 0

    // Hold still: pin each blob where its last path ended and drop the animations, so the
    // compositor has nothing to draw until the next move phase. Night sky comes out with rest.
    const rest = () => {
      for (const b of bodies) {
        const node = nodes.get(b.id)
        if (node) node.style.transform = position(b)
      }
      running.forEach((a) => a.cancel())
      running.clear()
      restingRef.current = true
      // Day while they bump; night when they stop — DOM attr only (no cast re-render).
      pageRef.current?.setAttribute('data-sky', 'night')
      segmentTimer = window.setTimeout(() => {
        restingRef.current = false
        phaseMs = 0
        pageRef.current?.setAttribute('data-sky', 'day')
        segment()
      }, REST_MS)
    }

    const segment = () => {
      const start = performance.now()
      const paths = new Map(bodies.map((b) => [b.id, [{ transform: position(b) }]]))
      for (let i = 1; i <= steps; i++) {
        const at = start + i * STEP_MS
        const bumps = stepPhysics(bodies, boundsRef.current, obstaclesRef.current, STEP_MS / 1000, {
          now: at,
          pairCool: pairCoolRef.current,
          pace: paceAt(phaseMs + i * STEP_MS),
        })
        if (i % sampleEvery === 0) for (const b of bodies) paths.get(b.id)!.push({ transform: position(b) })

        // Big hit wiggle on both blobs (face + whole avatar shell), timed to when the hit plays.
        for (const bump of bumps) {
          for (const id of [bump.a, bump.b]) {
            if (at < (bumpCoolRef.current.get(id) ?? 0)) continue
            bumpCoolRef.current.set(id, at + HIT_WIGGLE_MS)
            timers.push(window.setTimeout(() => {
              playMotion(id, 'wiggle')
              nodes.get(id)?.firstElementChild?.animate(HIT_WIGGLE, HIT_WIGGLE_MS)
            }, at - start))
          }
        }
      }
      for (const b of bodies) {
        const node = nodes.get(b.id)
        if (!node) continue
        // Two transform animations on one element can't be composited, so drop the finished segment.
        const previous = running.get(b.id)
        running.set(b.id, node.animate(paths.get(b.id)!, { duration: SEGMENT_MS, fill: 'forwards' }))
        previous?.cancel()
      }
      phaseMs += SEGMENT_MS
      // The last segment eases to a stop; rest once it has played.
      segmentTimer = window.setTimeout(phaseMs >= MOVE_MS ? rest : segment, SEGMENT_MS)
    }

    pageRef.current?.setAttribute('data-sky', 'day')
    segment()
    window.addEventListener('resize', measure)

    return () => {
      window.clearTimeout(segmentTimer)
      timers.forEach((t) => window.clearTimeout(t))
      running.forEach((a) => a.cancel())
      restingRef.current = false
      pageRef.current?.setAttribute('data-sky', 'day')
      window.removeEventListener('resize', measure)
    }
  }, [cast, measure])

  return (
    <div ref={pageRef} className={s.page} data-sky="day" role="dialog" aria-label="Idle. Tap anywhere to open the hub.">
      <div className={s.stage} aria-hidden="true">
        <div className={s.floor} />
        <div className={s.floorNight} />
        <span className={s.sun} />
        <span className={s.moon} />
        {[s.skyStar0, s.skyStar1, s.skyStar2, s.skyStar3, s.skyStar4, s.skyStar5, s.skyStar6].map((star) => (
          <span key={star} className={`${s.skyStar} ${star}`} />
        ))}
        {/* Static on purpose: ~27 looping layers at 1080p kept the Pi 3's GPU and CPU pinned. */}
        {BLOOMS.map((bloom) => (
          <span
            key={bloom.className}
            {...memberColorProps(bloom.color)}
            className={[s.bloom, bloom.soft ? s.bloomSoft : '', bloom.className].filter(Boolean).join(' ')}
          />
        ))}
        {CONFETTI.map((dot) => (
          <span key={dot.className} {...memberColorProps(dot.color)} className={`${s.confetti} ${dot.className}`} />
        ))}
        <span className={s.accentWash} />
      </div>

      <div ref={weatherRef} className={s.weatherStamp}>
        {w ? (
          <>
            <span className={s.weatherIcon}><Icon name={w.icon} size={28} /></span>
            <span className={s.weatherTemp}>{w.temp}°</span>
            <span className={s.weatherMeta}>
              {w.condition.toLowerCase()} · high {w.high}°
            </span>
          </>
        ) : (
          <span className={s.weatherMeta}>Set a location in Settings</span>
        )}
      </div>

      {playing ? (
        <div ref={playingRef} className={`${s.playing} anim-fade`}>
          <span className={s.playingIcon}><Icon name="music" size={22} /></span>
          <span className={s.playingText}>
            <strong>{playing.title}</strong>
            <span>{playing.artist ? `Playing · ${playing.artist}` : 'Playing'}</span>
          </span>
        </div>
      ) : null}

      <div className={s.playground} aria-label="Family and friends hanging out">
        {cast.map((buddy, i) => (
          <div
            key={buddy.id}
            ref={(node) => {
              if (node) nodeRefs.current.set(buddy.id, node)
              else nodeRefs.current.delete(buddy.id)
            }}
            {...memberColorProps(buddy.color)}
            className={[
              s.buddy,
              buddy.kind === 'guest' ? s.guest : s.member,
              ready ? s.buddyIn : '',
            ].filter(Boolean).join(' ')}
            style={{ ['--n' as string]: i }}
          >
            <div>
              <BlobAvatar
                character={buddy.character}
                colorway={buddy.color}
                size={buddy.size}
                showBackground
                decorative
              />
            </div>
          </div>
        ))}
      </div>

      <div className={s.info}>
        <div ref={clockRef} className={s.clockBlock}>
          <div className={s.time}>{clock(now)}</div>
          <div className={s.date}>{longDate(now)}</div>
        </div>
        <span ref={hintRef} className={s.hint}>Tap anywhere</span>
      </div>
    </div>
  )
}
