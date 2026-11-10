import { useState } from 'react'
import { AppShell, PageHeader } from '../components/AppShell'
import { Button } from '../components/Button'
import { Icon, type IconName } from '../components/Icon'
import { Avatar, IconTile, Label, Panel, Switch } from '../components/primitives'
import { MEMBERS, SETTINGS } from '../data/mock'
import type { Member, MemberColor, Routine } from '@hub/shared'
import s from './Settings.module.css'

type SectionId = 'family' | 'calendars' | 'music' | 'sleep' | 'weather' | 'pin'
const SECTIONS: { id: SectionId; label: string; sub: string; icon: IconName; color: MemberColor }[] = [
  { id: 'family', label: 'Family', sub: 'Members, colors, routines', icon: 'sofa', color: 'moss' },
  { id: 'calendars', label: 'Calendars', sub: '4 Google calendars', icon: 'calendar', color: 'fjord' },
  { id: 'music', label: 'Music & speakers', sub: 'Spotify · 5 speakers', icon: 'music', color: 'clay' },
  { id: 'sleep', label: 'Sleep & screen', sub: `${SETTINGS.sleepStart} – ${SETTINGS.sleepEnd}`, icon: 'moon', color: 'fjord' },
  { id: 'weather', label: 'Location & weather', sub: 'Header forecast', icon: 'sun', color: 'honey' },
  { id: 'pin', label: 'Parent PIN', sub: 'Approvals and settings', icon: 'key', color: 'clay' },
]

type Row = { label: string; hint?: string } & ({ toggle: boolean } | { value: string })
const ROWS: Record<Exclude<SectionId, 'family'>, Row[]> = {
  calendars: [
    { label: 'Family', hint: 'Google · shows as Family', toggle: true },
    { label: 'Daniel', hint: 'Google · shows as Daniel', toggle: true },
    { label: 'Shelby', hint: 'Google · shows as Shelby', toggle: true },
    { label: 'US holidays', hint: 'Google', toggle: false },
    { label: 'Edit events on the hub', hint: 'Planned for a later version', value: 'Phone only for now' },
    { label: 'Sync every', value: '5 minutes' },
  ],
  music: [
    { label: 'Spotify account', hint: 'Linked from the phone app', value: 'Connected' },
    { label: 'Default speaker', value: 'Kitchen' },
    { label: 'Speakers', hint: 'Echo and Google speakers via Spotify Connect', value: '5 found' },
    { label: 'Show “wake the speaker” tips', hint: 'When a speaker drops off the list', toggle: true },
  ],
  sleep: [
    { label: 'Sleep on a schedule', toggle: true },
    { label: 'Sleep hours', value: `${SETTINGS.sleepStart} – ${SETTINGS.sleepEnd}` },
    { label: 'While asleep, show', value: 'Dim clock' },
    { label: 'Start slideshow after', value: `${SETTINGS.idleMinutes} minutes idle` },
    { label: 'Wake on', hint: 'Motion sensor could come later', value: 'Tap' },
  ],
  weather: [
    { label: 'Location', hint: 'Used only for the forecast', value: '[YOUR TOWN]' },
    { label: 'Units', value: '°F' },
    { label: 'Refresh every', value: '30 minutes' },
  ],
  pin: [
    { label: 'Change PIN', value: '••••' },
    { label: 'Approving rewards', hint: 'Needs the PIN', toggle: true },
    { label: 'Opening settings', hint: 'Needs the PIN', toggle: true },
    { label: 'Deleting things', hint: 'Needs the PIN', toggle: true },
    { label: 'Lock again after', value: '5 minutes' },
  ],
}

const COLORS: { value: MemberColor; label: string }[] = [
  { value: 'moss', label: 'Moss' }, { value: 'clay', label: 'Clay' }, { value: 'honey', label: 'Honey' }, { value: 'fjord', label: 'Fjord' }, { value: 'plum', label: 'Plum' },
]
const ROUTINES: { value: Routine; label: string }[] = [
  { value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }, { value: 'evening', label: 'Evening' }, { value: 'chores', label: 'Chores' },
]

export default function Settings() {
  const [section, setSection] = useState<SectionId>('family')
  const [members, setMembers] = useState<Member[]>(MEMBERS)
  const [toggles, setToggles] = useState<Record<string, boolean>>({})
  const current = SECTIONS.find((x) => x.id === section)!
  const patch = (id: string, p: Partial<Member>) => setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)))

  return (
    <AppShell>
      <PageHeader
        eyebrow="Parent mode"
        title="Settings"
        actions={<span className={s.unlocked}><Icon name="unlock" size={20} />Unlocked · locks again in 5 min</span>}
      />
      <div className={s.layout}>
        <nav className={s.sections} aria-label="Settings sections">
          {SECTIONS.map((x) => (
            <button key={x.id} type="button" aria-current={x.id === section ? 'page' : undefined}
              className={x.id === section ? `${s.section} ${s.sectionOn}` : s.section} onClick={() => setSection(x.id)}>
              <IconTile icon={x.icon} color={x.color} size={52} />
              <span className={s.sectionText}><strong>{x.label}</strong><span>{x.sub}</span></span>
            </button>
          ))}
        </nav>

        <Panel pad="lg" className={`${s.content} scroll-y`} aria-label={current.label}>
          <h2 className={s.h2}>{current.label}</h2>
          {section === 'family' ? (
            <>
              <div className={s.members}>
                {members.map((m) => (
                  <div key={m.id} data-color={m.color} className={s.member}>
                    <div className={s.memberHead}>
                      <Avatar initial={m.initial} color={m.color} size="lg" />
                      <span className={s.memberName}><strong>{m.name}</strong><span>{m.role === 'parent' ? 'Parent' : 'Child · no login'} · {m.roleLabel}</span></span>
                      <button type="button" className={s.edit} aria-label={`Edit ${m.name}`}><Icon name="pencil" size={22} /></button>
                    </div>
                    <div className={s.field}>
                      <Label>Color</Label>
                      <div className={s.swatches}>
                        {COLORS.map((c) => (
                          <button key={c.value} type="button" data-color={c.value} aria-pressed={m.color === c.value}
                            aria-label={c.label} className={m.color === c.value ? `${s.swatch} ${s.swatchOn}` : s.swatch}
                            onClick={() => patch(m.id, { color: c.value })}><span /></button>
                        ))}
                      </div>
                    </div>
                    <div className={s.field}>
                      <Label>Routines</Label>
                      <div className={s.routines}>
                        {ROUTINES.map((r) => {
                          const on = m.routines.includes(r.value)
                          return (
                            <button key={r.value} type="button" aria-pressed={on} className={on ? `${s.routine} ${s.routineOn}` : s.routine}
                              onClick={() => patch(m.id, { routines: on ? m.routines.filter((x) => x !== r.value) : [...m.routines, r.value] })}>
                              {r.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className={s.pointsRow}>
                      <span>Earns points</span>
                      <Switch checked={m.earnsPoints} label={`${m.name} earns points`} onChange={(v) => patch(m.id, { earnsPoints: v })} />
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="lg" icon="plus" className={s.addMember}>Add a family member</Button>
            </>
          ) : (
            <div className={s.rows}>
              {ROWS[section].map((r) => {
                const key = `${section}:${r.label}`
                return (
                  <div key={key} className={s.row}>
                    <span className={s.rowText}><span>{r.label}</span>{r.hint && <small>{r.hint}</small>}</span>
                    {'toggle' in r
                      ? <Switch checked={toggles[key] ?? r.toggle} label={r.label} onChange={(v) => setToggles((t) => ({ ...t, [key]: v }))} />
                      : <Button variant="secondary" iconRight="chevron-right" className={s.value}>{r.value}</Button>}
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  )
}
