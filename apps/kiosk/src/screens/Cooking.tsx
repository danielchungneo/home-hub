import { useEffect, useState } from 'react'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { Label } from '../components/primitives'
import { RECIPES } from '../data/mock'
import { quantity } from '../lib/format'
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

function useCountdown(totalSec: number, running: boolean) {
  const [left, setLeft] = useState(totalSec)
  useEffect(() => setLeft(totalSec), [totalSec])
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000)
    return () => window.clearInterval(id)
  }, [running])
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  const sec = String(left % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export default function Cooking({ recipeId, onExit }: { recipeId: string; onExit: () => void }) {
  const recipe = RECIPES.find((r) => r.id === recipeId) ?? RECIPES[0]
  const [i, setI] = useState(recipeId === 'sheetpan' ? 4 : 0)
  const [running, setRunning] = useState(false)
  useWakeLock()

  const step = recipe.steps[i]
  const last = i === recipe.steps.length - 1
  const timer = useCountdown((step.timerMin ?? 0) * 60, running)
  const uses = recipe.ingredients.filter((g) => step.uses?.includes(g.name))
  const goTo = (n: number) => { setI(n); setRunning(false) }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Button variant="rail" size="lg" pill icon="close" onClick={onExit}>Exit</Button>
        <div className={s.titles}>
          <Label>Cooking mode</Label>
          <span className={s.recipe}>{recipe.title}</span>
        </div>
        <span className={s.pill}><Icon name="sun" size={22} />Screen stays on</span>
        <span className={s.pill}><Icon name="music" size={22} />Dinner Jazz · Kitchen</span>
      </header>

      <div className={s.progress}>
        {recipe.steps.map((_, k) => (
          <button key={k} type="button" aria-label={`Go to step ${k + 1}`} aria-current={k === i ? 'step' : undefined} className={s.seg} onClick={() => goTo(k)}>
            <span className={k < i ? s.barDone : k === i ? s.barNow : s.bar} />
          </button>
        ))}
      </div>

      <div className={s.body}>
        <section className={s.stepCard} aria-live="polite">
          <span className={s.stepNum}>Step {i + 1} of {recipe.steps.length}</span>
          <p key={i} className={`${s.stepText} anim-rise`}>{step.text}</p>
          <span className={s.flex} />
          {step.tip && <span className={s.tip}>Tip: {step.tip}</span>}
        </section>

        <aside className={s.side}>
          {step.timerMin != null && (
            <div className={s.timer}>
              <Label className={s.timerLabel}>Timer</Label>
              <span className={s.timerValue}>{timer}</span>
              <button type="button" className={running ? `${s.timerBtn} ${s.timerBtnOn}` : s.timerBtn} onClick={() => setRunning((r) => !r)}>
                {running ? 'Pause timer' : 'Start timer'}
              </button>
            </div>
          )}
          <div className={s.uses}>
            <Label>For this step</Label>
            {uses.length ? uses.map((g) => (
              <div key={g.name} className={s.use}>
                <span className={s.useAmt}>{g.qty ? `${quantity(g.qty)}${g.unit ? ' ' + g.unit : ''}` : 'To taste'}</span>
                <span>{g.name}</span>
              </div>
            )) : <span className={s.none}>Nothing new to grab for this step.</span>}
          </div>
        </aside>
      </div>

      <div className={s.nav}>
        <Button variant="rail" size="xl" icon="chevron-left" className={s.back} disabled={i === 0} onClick={() => goTo(i - 1)}>Back</Button>
        <Button variant="success" size="xl" iconRight="chevron-right" className={s.next} onClick={() => (last ? onExit() : goTo(i + 1))}>
          {last ? 'Done' : 'Next step'}
        </Button>
      </div>
    </div>
  )
}
