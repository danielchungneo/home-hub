import { useMemo, useState } from 'react'
import { AppShell, PageHeader } from '../components/AppShell'
import { Button } from '../components/Button'
import { Icon, type IconName } from '../components/Icon'
import { Avatar, IconTile, Label, Panel, Switch } from '../components/primitives'
import { useCalendarSources, useJukeboxCommand, useJukeboxState, useSpeakers, useToggleCalendarSource } from '../data/hooks'
import { useLive } from '../data/live'
import { MEMBERS, SETTINGS } from '../data/mock'
import { who } from '../lib/members'
import type { Member, MemberColor, Routine } from '@hub/shared'
import s from './Settings.module.css'

type SectionId = 'family' | 'calendars' | 'music' | 'sleep' | 'weather' | 'pin'

type Row = { label: string; hint?: string } & ({ toggle: boolean } | { value: string })
const ROWS: Record<Exclude<SectionId, 'family' | 'music' | 'calendars'>, Row[]> = {
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

function CalendarSettings() {
  const sources = useCalendarSources()
  const toggle = useToggleCalendarSource()
  useLive('calendar_sources', 'calendarSources')
  const list = sources.data ?? []

  return (
    <div className={s.rows}>
      {list.map((src) => {
        const person = who(src.memberId ?? 'family')
        const hint = [
          src.accountKey ? `Google · ${src.accountKey}` : 'Google',
          `shows as ${person.name}`,
        ].join(' · ')
        return (
          <div key={src.id} className={s.row} data-color={src.color ?? person.color}>
            <span className={s.rowText}>
              <span>{src.name}</span>
              <small>{hint}</small>
            </span>
            <Switch
              checked={src.enabled}
              label={`Show ${src.name}`}
              onChange={(enabled) => void toggle.mutateAsync({ id: src.id, enabled })}
            />
          </div>
        )
      })}
      {!list.length && (
        <p className={s.speakerEmpty}>
          No calendars linked yet. On your PC run <code>pnpm google:calendar-login</code> for each Google account.
        </p>
      )}
      <div className={s.row}>
        <span className={s.rowText}>
          <span>Edit events on the hub</span>
          <small>Planned for a later version</small>
        </span>
        <Button variant="secondary" className={s.value}>Phone only for now</Button>
      </div>
      <div className={s.row}>
        <span className={s.rowText}>
          <span>Sync every</span>
          <small>Edge function on a schedule</small>
        </span>
        <Button variant="secondary" className={s.value}>5 minutes</Button>
      </div>
    </div>
  )
}

function MusicSettings() {
  const speakers = useSpeakers()
  const state = useJukeboxState()
  const command = useJukeboxCommand()
  useLive('speakers', 'speakers')
  useLive('jukebox_state', 'jukeboxState')

  const list = speakers.data ?? []
  const available = list.filter((sp) => sp.available).length
  const currentId = state.data?.speakerId ?? list.find((sp) => sp.available)?.id ?? list[0]?.id ?? null
  const current = list.find((sp) => sp.id === currentId)
  const [wakeTips, setWakeTips] = useState(true)
  const [picking, setPicking] = useState(false)

  const speakerHint = useMemo(() => {
    if (!list.length) return 'Add speakers in the database seed, then refresh'
    if (!available) return 'None on Spotify Connect right now — try Refresh'
    return `${available} available · ${list.length} total`
  }, [list.length, available])

  const setDefault = (id: string) => {
    setPicking(false)
    void command.mutateAsync({ type: 'transfer', speakerId: id, payload: {} }).catch(() => {})
  }

  return (
    <div className={s.rows}>
      <div className={s.row}>
        <span className={s.rowText}>
          <span>Spotify account</span>
          <small>Tokens live on the Pi music-agent</small>
        </span>
        <Button variant="secondary" className={s.value}>Linked on the Pi</Button>
      </div>
      <div className={s.row}>
        <span className={s.rowText}>
          <span>Default speaker</span>
          <small>{current ? `${current.name} · ${current.kind}` : 'None selected yet'}</small>
        </span>
        <Button
          variant="secondary"
          iconRight="chevron-right"
          className={s.value}
          onClick={() => setPicking((v) => !v)}
        >
          {current?.name ?? 'Choose'}
        </Button>
      </div>
      {picking && (
        <div className={s.speakerPicker} role="listbox" aria-label="Choose default speaker">
          {list.map((sp) => (
            <button
              key={sp.id}
              type="button"
              role="option"
              aria-selected={sp.id === currentId}
              className={sp.id === currentId ? `${s.speakerOption} ${s.speakerOptionOn}` : s.speakerOption}
              onClick={() => setDefault(sp.id)}
            >
              <Icon name="speaker" size={22} />
              <span className={s.rowText}>
                <span>{sp.name}</span>
                <small>{sp.available ? 'Available' : 'Asleep / offline'} · {sp.kind}</small>
              </span>
            </button>
          ))}
          {!list.length && <p className={s.speakerEmpty}>No speakers yet.</p>}
        </div>
      )}
      <div className={s.row}>
        <span className={s.rowText}>
          <span>Speakers</span>
          <small>{speakerHint}</small>
        </span>
        <Button
          variant="secondary"
          icon="refresh"
          className={s.value}
          onClick={() => void command.mutateAsync({ type: 'refresh_speakers' }).catch(() => {})}
        >
          Refresh
        </Button>
      </div>
      <div className={s.row}>
        <span className={s.rowText}>
          <span>Show “wake the speaker” tips</span>
          <small>When a speaker drops off Spotify Connect</small>
        </span>
        <Switch checked={wakeTips} label="Show wake the speaker tips" onChange={setWakeTips} />
      </div>
    </div>
  )
}

export default function Settings() {
  const speakers = useSpeakers()
  const calendarSources = useCalendarSources()
  const speakerCount = speakers.data?.length ?? 0
  const calendarCount = calendarSources.data?.length ?? 0
  const [section, setSection] = useState<SectionId>('family')
  const [members, setMembers] = useState<Member[]>(MEMBERS)
  const [toggles, setToggles] = useState<Record<string, boolean>>({})
  const patch = (id: string, p: Partial<Member>) => setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)))

  const sections: { id: SectionId; label: string; sub: string; icon: IconName; color: MemberColor }[] = [
    { id: 'family', label: 'Family', sub: 'Members, colors, routines', icon: 'sofa', color: 'moss' },
    { id: 'calendars', label: 'Calendars', sub: calendarCount ? `${calendarCount} Google calendar${calendarCount === 1 ? '' : 's'}` : 'Link Google accounts', icon: 'calendar', color: 'fjord' },
    { id: 'music', label: 'Music & speakers', sub: speakerCount ? `Spotify · ${speakerCount} speakers` : 'Spotify · speakers', icon: 'music', color: 'clay' },
    { id: 'sleep', label: 'Sleep & screen', sub: `${SETTINGS.sleepStart} – ${SETTINGS.sleepEnd}`, icon: 'moon', color: 'fjord' },
    { id: 'weather', label: 'Location & weather', sub: 'Header forecast', icon: 'sun', color: 'honey' },
    { id: 'pin', label: 'Parent PIN', sub: 'Approvals and settings', icon: 'key', color: 'clay' },
  ]
  const current = sections.find((x) => x.id === section)!

  return (
    <AppShell>
      <PageHeader
        eyebrow="Parent mode"
        title="Settings"
        actions={<span className={s.unlocked}><Icon name="unlock" size={20} />Unlocked · locks again in 5 min</span>}
      />
      <div className={s.layout}>
        <nav className={s.sections} aria-label="Settings sections">
          {sections.map((x) => (
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
          ) : section === 'calendars' ? (
            <CalendarSettings />
          ) : section === 'music' ? (
            <MusicSettings />
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
