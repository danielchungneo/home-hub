import { MEMBER_COLOR_PRESETS, type Member } from '@hub/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AVAILABLE_BLOB_CHARACTERS,
  BlobAvatar,
  parseBlobCharacter,
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

function readRect(el: HTMLElement | null): IdleRect | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
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
  const [motions, setMotions] = useState<Record<string, { anim: BlobAnimation; key: number }>>({})
  const [hitKeys, setHitKeys] = useState<Record<string, number>>({})
  const [ready, setReady] = useState(false)

  const weatherRef = useRef<HTMLDivElement>(null)
  const clockRef = useRef<HTMLDivElement>(null)
  const playingRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLSpanElement>(null)
  const nodeRefs = useRef(new Map<string, HTMLDivElement>())
  const bodiesRef = useRef<IdleBody[]>([])
  const obstaclesRef = useRef<IdleRect[]>([])
  const boundsRef = useRef<IdleBounds>({ width: 1920, height: 1080, pad: 24 })
  const bumpCoolRef = useRef(new Map<string, number>())
  const pairCoolRef = useRef(new Map<string, number>())

  const playMotion = (id: string, anim: BlobAnimation) => {
    setMotions((prev) => ({
      ...prev,
      [id]: { anim, key: (prev[id]?.key ?? 0) + 1 },
    }))
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

    const measure = () => {
      const w = window.innerWidth || 1920
      const h = window.innerHeight || 1080
      boundsRef.current = { width: w, height: h, pad: 20 }
      const next: IdleRect[] = []
      for (const el of [weatherRef.current, clockRef.current, playingRef.current, hintRef.current]) {
        const rect = readRect(el)
        if (rect) next.push(rect)
      }
      obstaclesRef.current = next
    }

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

    const paint = (body: IdleBody) => {
      const node = nodeRefs.current.get(body.id)
      if (node) node.style.transform = `translate3d(${body.x}px, ${body.y}px, 0) translate(-50%, -50%)`
    }

    // Paint initial positions (and static layout when motion is reduced).
    for (const body of bodies) paint(body)
    setReady(true)

    if (!motionOk) return

    let raf = 0
    let last = performance.now()
    let measureAt = 0

    const tick = (nowTs: number) => {
      const dt = Math.min(0.05, (nowTs - last) / 1000)
      last = nowTs
      if (nowTs >= measureAt) {
        measure()
        measureAt = nowTs + 800
      }

      const bumps = stepPhysics(
        bodiesRef.current,
        boundsRef.current,
        obstaclesRef.current,
        dt,
        { now: nowTs, pairCool: pairCoolRef.current },
      )
      for (const body of bodiesRef.current) paint(body)

      // Big hit wiggle on both blobs (face + whole avatar shell).
      for (const bump of bumps) {
        for (const id of [bump.a, bump.b]) {
          const cooled = bumpCoolRef.current.get(id) ?? 0
          if (nowTs < cooled) continue
          bumpCoolRef.current.set(id, nowTs + 620)
          playMotion(id, 'wiggle')
          setHitKeys((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    const onResize = () => measure()
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [cast])

  const w = weather.data
  const playing = jukebox.data?.nowPlaying
  const motionOk = !reducedMotion()

  return (
    <div className={s.page} role="dialog" aria-label="Idle. Tap anywhere to open the hub.">
      <div className={s.stage} aria-hidden="true">
        <div className={s.floor} />
        {BLOOMS.map((bloom, i) => (
          <span
            key={bloom.className}
            {...memberColorProps(bloom.color)}
            className={[
              s.bloom,
              bloom.soft ? s.bloomSoft : '',
              bloom.className,
              motionOk ? s.bloomDrift : '',
            ].filter(Boolean).join(' ')}
            style={{ ['--n' as string]: i }}
          />
        ))}
        {CONFETTI.map((dot, i) => (
          <span
            key={dot.className}
            {...memberColorProps(dot.color)}
            className={[s.confetti, dot.className, motionOk ? s.confettiBob : ''].filter(Boolean).join(' ')}
            style={{ ['--n' as string]: i }}
          />
        ))}
        <span className={[s.accentWash, motionOk ? s.accentDrift : ''].filter(Boolean).join(' ')} />
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
        {cast.map((buddy, i) => {
          const motion = motions[buddy.id]
          const hitKey = hitKeys[buddy.id] ?? 0
          return (
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
              <div
                key={hitKey}
                className={hitKey > 0 ? s.hitWiggle : undefined}
              >
                <BlobAvatar
                  character={buddy.character}
                  colorway={buddy.color}
                  size={buddy.size}
                  showBackground
                  decorative
                  animation={motion?.anim ?? 'idle'}
                  animationKey={motion?.key ?? 0}
                />
              </div>
            </div>
          )
        })}
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
