import { useEffect, useState } from 'react'
import { Button, IconButton } from '../components/Button'
import { Icon } from '../components/Icon'
import { Label, Switch } from '../components/primitives'
import { useRecipes } from '../data/hooks'
import { quantity } from '../lib/format'
import { ingredientsForStep } from '../lib/stepIngredients'
import s from './Cooking.module.css'

/** Keep the display awake while cooking (Wake Lock API when the browser has it). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => { lock = l }).catch(() => {})
    return () => { lock?.release().catch(() => {}) }
  }, [])
}

function formatClock(totalSec: number) {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const sec = String(totalSec % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

function useCountdown(totalSec: number, running: boolean, resetKey: number) {
  const [left, setLeft] = useState(totalSec)
  useEffect(() => setLeft(totalSec), [totalSec, resetKey])
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000)
    return () => window.clearInterval(id)
  }, [running])
  return { left, display: formatClock(left), done: left === 0 && totalSec > 0 }
}

export default function Cooking({ recipeId, onExit }: { recipeId: string; onExit: () => void }) {
  const { data: recipes = [] } = useRecipes()
  const recipe = recipes.find((r) => r.id === recipeId) ?? recipes[0]
  const [i, setI] = useState(0)
  const [timerOn, setTimerOn] = useState(false)
  const [durationMin, setDurationMin] = useState(5)
  const [running, setRunning] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  useWakeLock()

  const steps = recipe?.steps ?? []
  const step = steps[i]
  const defaultMin = step?.timerMin && step.timerMin > 0 ? Math.round(step.timerMin) : null

  useEffect(() => {
    setI(0)
  }, [recipeId])

  useEffect(() => {
    const next = defaultMin ?? 5
    setDurationMin(next)
    setTimerOn(defaultMin != null)
    setRunning(false)
    setResetKey((k) => k + 1)
  }, [i, recipeId, defaultMin])

  const totalSec = Math.max(0, durationMin) * 60
  const { left, display, done } = useCountdown(timerOn ? totalSec : 0, timerOn && running, resetKey)
  const uses = ingredientsForStep(step, recipe?.ingredients ?? [])
  const last = steps.length > 0 && i === steps.length - 1

  const goTo = (n: number) => {
    setI(n)
    setRunning(false)
  }

  const bumpDuration = (delta: number) => {
    setRunning(false)
    setDurationMin((m) => Math.min(240, Math.max(1, m + delta)))
    setResetKey((k) => k + 1)
  }

  const resetTimer = () => {
    setRunning(false)
    setResetKey((k) => k + 1)
  }

  if (!recipe || !steps.length || !step) {
    return (
      <div className={s.page}>
        <header className={s.header}>
          <Button variant="rail" size="lg" pill icon="close" onClick={onExit}>Exit</Button>
          <div className={s.titles}>
            <Label>Cooking mode</Label>
            <span className={s.recipe}>Recipe not found</span>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Button variant="rail" size="lg" pill icon="close" onClick={onExit}>Exit</Button>
        <div className={s.titles}>
          <Label>Cooking mode</Label>
          <span className={s.recipe}>{recipe.title}</span>
        </div>
        <span className={s.pill}><Icon name="sun" size={22} />Screen stays on</span>
      </header>

      <div className={s.progress}>
        {steps.map((st, k) => (
          <button key={k} type="button" aria-label={`Go to step ${k + 1}`} aria-current={k === i ? 'step' : undefined} className={s.seg} onClick={() => goTo(k)}>
            <span className={k < i ? s.barDone : k === i ? s.barNow : s.bar} />
            {st.timerMin ? <span className={s.segTimer} aria-hidden /> : null}
          </button>
        ))}
      </div>

      <div className={s.body}>
        <section className={s.stepCard} aria-live="polite">
          <span className={s.stepNum}>Step {i + 1} of {steps.length}</span>
          <p key={i} className={`${s.stepText} anim-rise`}>{step.text}</p>
          <span className={s.flex} />
          {step.tip && <span className={s.tip}>Tip: {step.tip}</span>}
        </section>

        <aside className={s.side}>
          <div className={timerOn ? s.timer : s.timerOff}>
            <div className={s.timerHead}>
              <Label className={timerOn ? s.timerLabel : undefined}>Timer</Label>
              <Switch
                checked={timerOn}
                label={timerOn ? 'Timer on' : 'Timer off'}
                onChange={(on) => {
                  setTimerOn(on)
                  setRunning(false)
                  if (on && durationMin < 1) setDurationMin(defaultMin ?? 5)
                }}
              />
            </div>

            {timerOn ? (
              <>
                <span className={done ? `${s.timerValue} ${s.timerDone}` : s.timerValue} aria-live="polite">
                  {display}
                </span>
                <div className={s.timerEdit}>
                  <IconButton
                    variant="surface"
                    round={false}
                    icon="minus"
                    label="One minute less"
                    disabled={running || durationMin <= 1}
                    onClick={() => bumpDuration(-1)}
                  />
                  <span className={s.timerEditLabel}>{durationMin} min</span>
                  <IconButton
                    variant="surface"
                    round={false}
                    icon="plus"
                    label="One minute more"
                    disabled={running || durationMin >= 240}
                    onClick={() => bumpDuration(1)}
                  />
                </div>
                <div className={s.timerActions}>
                  <button
                    type="button"
                    className={running ? `${s.timerBtn} ${s.timerBtnOn}` : s.timerBtn}
                    onClick={() => setRunning((r) => !r)}
                    disabled={totalSec <= 0}
                  >
                    {done ? 'Finished' : running ? 'Pause' : left < totalSec ? 'Resume' : 'Start'}
                  </button>
                  <button
                    type="button"
                    className={s.timerReset}
                    onClick={resetTimer}
                    disabled={!timerOn || (left === totalSec && !running)}
                    aria-label="Reset timer"
                  >
                    Reset
                  </button>
                </div>
              </>
            ) : (
              <p className={s.timerHint}>
                {defaultMin
                  ? `Suggested ${defaultMin} min for this step — turn the timer on anytime.`
                  : 'Turn on a timer for this step whenever you need one.'}
              </p>
            )}
          </div>

          <div className={s.uses}>
            <Label>This step uses</Label>
            {uses.length > 0 ? uses.map((ing) => (
              <div key={ing.name} className={s.useRow}>
                <span className={s.useAmt}>{ing.qty ? `${quantity(ing.qty)}${ing.unit ? ` ${ing.unit}` : ''}` : 'To taste'}</span>
                <span>{ing.name}</span>
              </div>
            )) : (
              <span className={s.none}>No linked ingredients</span>
            )}
          </div>
        </aside>
      </div>

      <footer className={s.footer}>
        <Button variant="secondary" size="xl" disabled={i === 0} onClick={() => goTo(i - 1)}>Back</Button>
        <Button size="xl" onClick={() => (last ? onExit() : goTo(i + 1))}>{last ? 'Done cooking' : 'Next step'}</Button>
      </footer>
    </div>
  )
}
