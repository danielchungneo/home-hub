import { useEffect, useMemo, useRef, useState } from 'react'
import { SYSTEM_COLOR } from '@hub/shared'
import { IconButton } from '../../components/Button'
import { Icon, type IconName } from '../../components/Icon'
import { MemberBlobAvatar } from '../../components/MemberBlobAvatar'
import { Switch } from '../../components/primitives'
import { memberColorProps } from '../../lib/colors'
import { DAY_LONG, DAY_SHORT, EVERY_DAY, WEEKDAYS, WEEKENDS, daysLabel, isoDate } from '../../lib/tasks'
import type { Frequency, Member, Schedule, TaskTemplate } from '../../types'
import type { NewTask } from './useTasks'
import s from './AddTaskSheet.module.css'

export interface SheetPreset { assignee?: string; frequency?: Frequency }

const ICONS: IconName[] = ['plant', 'leaf', 'droplet', 'sparkle', 'broom', 'trash', 'dish', 'pot', 'cart', 'bag', 'shirt', 'bed', 'car', 'key', 'mail', 'dumbbell', 'book', 'sofa']
const TITLE_MAX = 32
const CLOSE_MS = 300
/** "Every day" → "every day", but keep "Mon, Wed" capitalised. */
const presetText = (label: string) => (['Every day', 'Weekdays', 'Weekends'].includes(label) ? label.toLowerCase() : label)

/**
 * Add a task: 1 pick from the library (or create a new library task), 2 who, 3 how often, 4 points.
 * Typing needs the on-screen keyboard on the Pi (see DESIGN_SYSTEM.md §11).
 */
export function AddTaskSheet({ members, preset, templates, now, onClose, onSave }: {
  members: Member[]
  preset: SheetPreset
  templates: TaskTemplate[]
  now: Date
  onClose: () => void
  onSave: (task: NewTask, isNew: boolean) => void
}) {
  const [closing, setClosing] = useState(false)
  const [query, setQuery] = useState('')
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newIcon, setNewIcon] = useState<IconName>('sparkle')
  const [assignee, setAssignee] = useState(preset.assignee ?? members[0]?.id ?? 'bounty')
  const [frequency, setFrequency] = useState<Frequency>(preset.assignee === 'bounty' ? 'weekly' : preset.frequency ?? 'daily')
  const [repeat, setRepeat] = useState(preset.assignee !== 'bounty')
  const [days, setDays] = useState<number[]>(EVERY_DAY)
  const [once, setOnce] = useState<'today' | 'tomorrow'>('today')
  const [every, setEvery] = useState<1 | 2>(1)
  const [dueDay, setDueDay] = useState(6)
  const [points, setPoints] = useState<number | null>(null)
  const [popDay, setPopDay] = useState<number | null>(null)
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const close = () => { setClosing(true); timer.current = window.setTimeout(onClose, CLOSE_MS) }

  const isBounty = assignee === 'bounty'
  const member = members.find((m) => m.id === assignee)
  const tpl = templateId ? templates.find((t) => t.id === templateId) : undefined
  const q = query.trim().toLowerCase()
  const options = useMemo(() => templates
    .filter((t) => !q || t.title.toLowerCase().includes(q))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, q ? 6 : 8), [templates, q])
  const mostUsed = useMemo(() => [...templates].sort((a, b) => b.uses - a.uses).slice(0, 6), [templates])
  const canCreate = !!q && !templates.some((t) => t.title.toLowerCase() === q)

  const pts = points ?? (tpl ? (isBounty ? Math.max(10, tpl.points) : tpl.points) : 10)
  const title = creating ? newTitle.trim() : tpl?.title ?? ''
  const earns = isBounty || !!member?.earnsPoints

  const pick = (t: TaskTemplate) => {
    setTemplateId(t.id); setCreating(false); setPoints(null)
    if (!isBounty) { setFrequency(t.frequency); setRepeat(true) }
  }
  const startCreate = () => {
    setCreating(true); setTemplateId(null)
    setNewTitle(query.trim().replace(/^./, (c) => c.toUpperCase()).slice(0, TITLE_MAX))
    setNewIcon('sparkle'); setPoints(earns ? 10 : 0)
  }
  const back = () => { setCreating(false); setTemplateId(null) }
  const chooseWho = (id: string) => {
    setAssignee(id)
    if (id === 'bounty') { setFrequency('weekly'); setRepeat(false); setPoints(Math.max(10, pts)) }
  }
  const toggleDay = (d: number) => {
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))
    setPopDay(d)
  }

  const schedule: Schedule = frequency === 'daily'
    ? (repeat ? { kind: 'days', days } : { kind: 'once', date: isoDate(once === 'today' ? now : new Date(now.getTime() + 864e5)) })
    : (repeat ? { kind: 'weekly', every, dueDay } : { kind: 'thisWeek', dueDay })

  const whenText = frequency === 'weekly'
    ? `${repeat ? (every === 1 ? 'every week' : 'every other week') : 'this week only'}, by ${DAY_LONG[dueDay]}`
    : repeat ? `daily, ${days.length ? presetText(daysLabel(days)) : '(pick days)'}` : `just ${once}`
  const whoText = isBounty ? 'Up for grabs' : member?.name ?? 'Someone'
  const summary = title ? `${whoText} · ${title} · ${whenText}${earns && pts ? ` · ${pts} pts` : ''}` : 'Pick a task from the library or type a new one'
  const cantSave = !title || (frequency === 'daily' && repeat && !days.length)

  const save = () => {
    if (cantSave) return
    onSave({
      templateId: creating ? undefined : templateId!,
      newTemplate: creating ? { title, icon: newIcon, points: pts, frequency } : undefined,
      assignee, frequency: isBounty ? 'weekly' : frequency, schedule, points: earns ? pts : 0,
    }, creating)
  }

  const whoChoices = [
    ...members.map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      sub: m.earnsPoints ? 'Earns points' : 'Baby care',
      blob: true as const,
    })),
    { id: 'bounty', name: 'Up for grabs', color: SYSTEM_COLOR, sub: 'Bounty board', blob: false as const },
  ]

  return (
    <div className={s.layer} data-closing={closing}>
      <div className={s.scrim} onClick={close} />
      <section role="dialog" aria-modal="true" aria-labelledby="add-task-title" className={s.sheet}>
        <header className={s.head}>
          <span className={s.headText}>
            <span className={s.kicker}>From the task library · {templates.length} saved tasks</span>
            <span id="add-task-title" className={s.title}>Add a task</span>
          </span>
          <IconButton size="lg" icon="close" label="Close" onClick={close} />
        </header>

        <div className={s.body}>
          {/* ---------- 1 · Task ---------- */}
          <div className={s.what}>
            <span className={s.step}>1 · Task</span>
            {!tpl && !creating && <>
              <div className={s.recent}>
                <span className={s.recentLabel}>Most used</span>
                {mostUsed.map((t) => (
                  <button key={t.id} type="button" className={s.recentChip} onClick={() => pick(t)}>
                    <span className={s.recentIcon}><Icon name={t.icon} size={26} stroke={2.2} /></span>{t.title}
                  </button>
                ))}
              </div>
              <div className={s.combo}>
                <label className={s.search}>
                  <Icon name="search" size={24} />
                  <span className="sr-only">Find or create a task</span>
                  <input role="combobox" aria-expanded="true" aria-controls="task-options" autoComplete="off"
                    value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a task, or type a new one"
                    onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) startCreate() }} />
                  {query && <IconButton variant="secondary" round={false} icon="close" label="Clear" onClick={() => setQuery('')} />}
                </label>
                <ul id="task-options" role="listbox" aria-label="Task library" className={`${s.options} scroll-y`}>
                  {options.map((t, i) => (
                    <li key={t.id} role="presentation" style={{ ['--n' as string]: i }}>
                      <button type="button" role="option" aria-selected="false" className={s.option} onClick={() => pick(t)}>
                        <span className={s.optionIcon}><Icon name={t.icon} size={30} stroke={2.2} /></span>
                        <span className={s.optionTitle}>{t.title}</span>
                        <span className={s.optionMeta}>{t.frequency === 'weekly' ? 'Weekly' : 'Daily'}{t.points ? ` · ${t.points} pts` : ''} · used {t.uses}×</span>
                      </button>
                    </li>
                  ))}
                  {canCreate && (
                    <li role="presentation">
                      <button type="button" role="option" aria-selected="false" className={s.create} onClick={startCreate}>
                        <span className={s.createIcon}><Icon name="plus" size={24} stroke={2.8} /></span>
                        <span className={s.createText}>
                          <span className={s.createTitle}>Create “{query.trim()}”</span>
                          <span className={s.createSub}>Saved to the task library so you can pick it next time</span>
                        </span>
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            </>}

            {tpl && (
              <div className={`${s.picked} anim-pop`} {...memberColorProps(member?.color ?? SYSTEM_COLOR)}>
                <span className={s.pickedIcon}><Icon name={tpl.icon} size={46} stroke={2.2} /></span>
                <span className={s.pickedText}>
                  <span className={s.pickedTitle}>{tpl.title}</span>
                  <span className={s.pickedMeta}>From the library · usually {tpl.frequency}{tpl.points ? ` · ${tpl.points} pts` : ''}</span>
                </span>
                <button type="button" className={s.change} onClick={back}>Change</button>
              </div>
            )}

            {creating && (
              <div className={`${s.newBox} anim-rise`}>
                <div className={s.newHead}>
                  <span className={s.newTag}>New</span>
                  <span className={s.newNote}>Goes into the task library for next time</span>
                  <button type="button" className={s.backLink} onClick={back}>Back to list</button>
                </div>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Name</span>
                  <input className={s.nameInput} value={newTitle} maxLength={TITLE_MAX} onChange={(e) => setNewTitle(e.target.value)} />
                </label>
                <div className={s.field}>
                  <span className={s.fieldLabel}>Icon</span>
                  <div role="group" aria-label="Icon" className={s.icons}>
                    {ICONS.map((n) => (
                      <button key={n} type="button" aria-pressed={n === newIcon} aria-label={n} className={s.iconChoice} onClick={() => setNewIcon(n)}>
                        <Icon name={n} size={36} stroke={2.2} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ---------- 2–4 ---------- */}
          <div className={`${s.how} scroll-y`}>
            <div className={s.group}>
              <span className={s.step}>2 · Who’s it for</span>
              <div role="group" aria-label="Who’s it for" className={s.who}>
                {whoChoices.map((w) => (
                  <button key={w.id} type="button" {...memberColorProps(w.color)} aria-pressed={assignee === w.id} className={s.whoBtn} onClick={() => chooseWho(w.id)}>
                    <span className={s.whoMark}>
                      {w.blob
                        ? <MemberBlobAvatar memberId={w.id} size={40} showBackground={false} decorative />
                        : '★'}
                    </span>
                    <span className={s.whoText}><span className={s.whoName}>{w.name}</span><span className={s.whoSub}>{w.sub}</span></span>
                  </button>
                ))}
              </div>
            </div>

            <div className={s.group}>
              <span className={s.step}>3 · How often</span>
              {!isBounty && (
                <div role="group" aria-label="Daily or weekly" className={s.seg}>
                  {(['daily', 'weekly'] as Frequency[]).map((f) => (
                    <button key={f} type="button" aria-pressed={frequency === f} className={s.segBtn} onClick={() => setFrequency(f)}>
                      <span className={s.segLabel}>{f === 'daily' ? 'Daily' : 'Weekly'}</span>
                      <span className={s.segSub}>{f === 'daily' ? 'On the Today list' : 'Once, any day before it’s due'}</span>
                    </button>
                  ))}
                </div>
              )}
              {!isBounty && (
                <div className={s.repeatRow}>
                  <span className={s.repeatText}>
                    <span className={s.repeatLabel}>Repeats</span>
                    <span className={s.repeatHint}>{frequency === 'weekly' ? (repeat ? 'Comes back after it resets on Sunday' : 'Just this week') : (repeat ? 'Shows up on the days you pick' : 'Just once')}</span>
                  </span>
                  <Switch checked={repeat} label="Repeats" onChange={setRepeat} />
                </div>
              )}

              {frequency === 'daily' && repeat && (
                <div className={`${s.stack} anim-rise`}>
                  <div className={s.chips}>
                    {([['Every day', EVERY_DAY], ['Weekdays', WEEKDAYS], ['Weekends', WEEKENDS]] as const).map(([label, set]) => (
                      <button key={label} type="button" aria-pressed={daysLabel(days) === label} className={s.preset} onClick={() => setDays([...set])}>{label}</button>
                    ))}
                  </div>
                  <div role="group" aria-label="Days" className={s.days}>
                    {DAY_SHORT.map((d, i) => (
                      <button key={d} type="button" aria-pressed={days.includes(i)} aria-label={DAY_LONG[i]}
                        className={`${s.day} ${popDay === i ? 'anim-pop' : ''}`} onAnimationEnd={() => setPopDay(null)} onClick={() => toggleDay(i)}>{d[0]}</button>
                    ))}
                  </div>
                </div>
              )}
              {frequency === 'daily' && !repeat && (
                <div className={`${s.chips} anim-rise`}>
                  {(['today', 'tomorrow'] as const).map((o) => (
                    <button key={o} type="button" aria-pressed={once === o} className={s.pill} onClick={() => setOnce(o)}>{o === 'today' ? 'Today' : 'Tomorrow'}</button>
                  ))}
                </div>
              )}
              {frequency === 'weekly' && (
                <div className={`${s.stack} anim-rise`}>
                  {repeat && !isBounty && (
                    <div className={s.chips}>
                      {([[1, 'Every week'], [2, 'Every other week']] as const).map(([n, label]) => (
                        <button key={n} type="button" aria-pressed={every === n} className={s.preset} onClick={() => setEvery(n)}>{label}</button>
                      ))}
                    </div>
                  )}
                  <span className={s.dueLabel}>Due by · any day before is fine</span>
                  <div role="group" aria-label="Due by" className={s.days}>
                    {DAY_SHORT.map((d, i) => (
                      <button key={d} type="button" aria-pressed={dueDay === i} aria-label={`Due ${DAY_LONG[i]}`} className={s.dueDay} onClick={() => setDueDay(i)}>{d}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {earns && (
              <div className={s.pointsRow}>
                <span className={s.repeatText}>
                  <span className={s.step}>4 · {isBounty ? 'Bounty points' : 'Points'}</span>
                  <span className={s.repeatHint}>{isBounty ? 'Goes to whoever claims it' : 'Added to the balance when it’s done'}</span>
                </span>
                <span className={s.stepper}>
                  <IconButton variant="surface" icon="minus" label="Fewer points" onClick={() => setPoints(Math.max(0, pts - 5))} />
                  <span key={pts} className={`${s.pointsValue} anim-pop`} aria-live="polite">{pts}</span>
                  <IconButton variant="surface" icon="plus" label="More points" onClick={() => setPoints(Math.min(100, pts + 5))} />
                </span>
              </div>
            )}
          </div>
        </div>

        <footer className={s.foot}>
          <span className={title ? s.summary : `${s.summary} ${s.summaryEmpty}`}>{summary}</span>
          <button type="button" className={s.cancel} onClick={close}>Cancel</button>
          <button type="button" className={s.save} disabled={cantSave} onClick={save}>{creating ? 'Save and add' : 'Add task'}</button>
        </footer>
      </section>
    </div>
  )
}
