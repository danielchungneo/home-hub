import { useEffect, useMemo, useState } from 'react'
import { Button, IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { memberColorProps } from '../../lib/colors'
import type { Exercise, Feel, Member, StrengthPlan } from '../../types'
import { FEELS, Star } from './parts'
import s from './Session.module.css'

/** One step of the circuit: a set of an exercise, or the rest after it. */
interface Step { kind: 'work' | 'rest'; ex: Exercise; exIndex: number; round: number; seconds?: number }

/** Circuit order: round 1 of every move, then round 2… (moves with fewer sets drop out). */
function buildSteps(plan: StrengthPlan): Step[] {
  const steps: Step[] = []
  for (let r = 0; r < plan.rounds; r++) {
    plan.exercises.forEach((ex, i) => {
      if (r >= ex.sets) return
      steps.push({ kind: 'work', ex, exIndex: i, round: r, seconds: ex.seconds })
      steps.push({ kind: 'rest', ex, exIndex: i, round: r, seconds: ex.restSec })
    })
  }
  steps.pop() // no rest after the very last set
  return steps
}

function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => { lock = l }).catch(() => {})
    return () => { lock?.release().catch(() => {}) }
  }, [])
}

const RING = 2 * Math.PI * 160

/**
 * Guided calisthenics session (full screen, like cooking mode).
 * Timed holds and rests count down once a second and advance on their own; rep sets wait for "Done".
 */
export function Session({ member, plan, onClose, onFinish }: {
  member: Member; plan: StrengthPlan; onClose: () => void; onFinish: (feel?: Feel) => void
}) {
  useWakeLock()
  const steps = useMemo(() => buildSteps(plan), [plan])
  const [i, setI] = useState(0)
  const [left, setLeft] = useState(steps[0]?.seconds ?? 0)
  const [paused, setPaused] = useState(false)
  const [finished, setFinished] = useState(false)
  const step = steps[i]
  const timed = step?.seconds !== undefined
  const workSets = steps.filter((x) => x.kind === 'work')
  const doneSets = steps.slice(0, i).filter((x) => x.kind === 'work').length

  const next = () => {
    if (i >= steps.length - 1) { setFinished(true); return }
    setI(i + 1)
    setLeft(steps[i + 1].seconds ?? 0)
  }

  // Tick only while a timed step is running.
  useEffect(() => {
    if (finished || paused || !timed) return
    if (left <= 0) { next(); return }
    const t = window.setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, paused, timed, finished, i])

  const upNext = steps.slice(i + 1).filter((x) => x.kind === 'work').slice(0, 3)
  const frac = timed && step.seconds ? left / step.seconds : 1

  return (
    <div className={s.session} {...memberColorProps(member.color)} role="dialog" aria-modal="true" aria-label={`${plan.title} workout`}>
      <header className={s.top}>
        <IconButton variant="surface" size="lg" icon="close" label="End workout" onClick={onClose} />
        <span className={s.topText}>
          <span className={s.kicker}>{member.name} · {plan.title}</span>
          <span className={s.roundLine}>{finished ? 'All done' : `Round ${step.round + 1} of ${plan.rounds}`}</span>
        </span>
        <span className={s.sets} aria-label={`${doneSets} of ${workSets.length} sets done`}>
          {workSets.map((_, k) => <span key={k} className={k < doneSets || finished ? `${s.setDot} ${s.setDotOn}` : s.setDot} />)}
        </span>
      </header>

      {!finished ? (
        <main key={i} className={step.kind === 'rest' ? `${s.stage} ${s.stageRest}` : s.stage}>
          <div className={s.left}>
            {step.kind === 'work' ? <>
              <span className={s.exKicker}>Move {step.exIndex + 1} of {plan.exercises.length} · set {step.round + 1} of {step.ex.sets}</span>
              <span className={s.exName}>{step.ex.name}</span>
              <span className={s.dose}>{step.ex.reps ? <>{step.ex.reps}<span className={s.doseUnit}>reps</span></> : <>{step.ex.seconds}<span className={s.doseUnit}>seconds</span></>}</span>
              <span className={s.cue}>{step.ex.cue}</span>
            </> : <>
              <span className={s.exKicker}>Rest</span>
              <span className={s.exName}>Breathe</span>
              <span className={s.cue}>Next: {steps[i + 1]?.ex.name}{steps[i + 1]?.ex.reps ? ` · ${steps[i + 1].ex.reps} reps` : steps[i + 1]?.ex.seconds ? ` · ${steps[i + 1].ex.seconds}s` : ''}</span>
            </>}
          </div>
          <div className={s.ringWrap}>
            <svg width="360" height="360" viewBox="0 0 360 360" className={s.ring} aria-hidden="true">
              <circle cx="180" cy="180" r="160" className={s.ringTrack} />
              {/* One small SVG stroke, updated once a second while a timer runs (the documented ring exception). */}
              <circle cx="180" cy="180" r="160" className={s.ringFill} strokeDasharray={RING} strokeDashoffset={RING * (1 - frac)} />
            </svg>
            <span className={s.ringText}>
              {timed
                ? <><span className={s.ringNum}>{left}</span><span className={s.ringUnit}>{step.kind === 'rest' ? 'rest' : 'seconds'}</span></>
                : <Icon name="dumbbell" size={120} stroke={2} />}
            </span>
          </div>
        </main>
      ) : (
        <main className={s.finish}>
          <span className={s.burst} aria-hidden="true">{Array.from({ length: 8 }, (_, k) => <span key={k} className={s.burstStar} style={{ ['--a' as string]: `${k * 45}deg` }}><Star size={34} /></span>)}</span>
          <span className={s.finishKicker}>{plan.title} · done</span>
          <span className={s.finishPts}>+{plan.points}<Star size={64} /></span>
          <span className={s.finishText}>{workSets.length} sets in about {plan.minutes} minutes. Your coach will plan tomorrow around this.</span>
          <span className={s.feelLabel}>How did that feel?</span>
          <span className={s.feels}>
            {FEELS.map((f) => <Button key={f.id} variant={f.id === 'right' ? 'primary' : 'secondary'} size="xl" pill onClick={() => onFinish(f.id)}>{f.label}</Button>)}
          </span>
        </main>
      )}

      {!finished && (
        <footer className={s.bottom}>
          <span className={s.upNext}>
            {upNext.length > 0 && <span className={s.upLabel}>Up next</span>}
            {upNext.map((x, k) => <span key={k} className={s.upChip}>{x.ex.name}</span>)}
          </span>
          {timed && <Button variant="secondary" size="xl" pill icon={paused ? 'play' : 'pause'} onClick={() => setPaused((p) => !p)}>{paused ? 'Resume' : 'Pause'}</Button>}
          <Button size="xl" pill iconRight="arrow-right" className={s.nextBtn} onClick={next}>
            {step.kind === 'rest' ? 'Skip rest' : i === steps.length - 1 ? 'Finish' : 'Done, next'}
          </Button>
        </footer>
      )}
    </div>
  )
}
