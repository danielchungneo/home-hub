import { useMemo, useState } from 'react'
import { useNav } from '../app/nav'
import { AppShell, PageHeader, settingsSleepLabel } from '../components/AppShell'
import { Button } from '../components/Button'
import { Icon, type IconName } from '../components/Icon'
import { Avatar, IconTile, Label, Panel, Switch } from '../components/primitives'
import {
  useCalendarSources,
  useHouseholdSettings,
  useJukeboxCommand,
  useJukeboxState,
  useMembers,
  useSetParentPin,
  useSpeakers,
  useToggleCalendarSource,
  useUpdateHouseholdSettings,
  useUpdateMember,
} from '../data/hooks'
import { useLive } from '../data/live'
import { useClock } from '../hooks/useClock'
import { formatTimeOfDay } from '../lib/format'
import { who } from '../lib/members'
import type { HouseholdSettings, Member, MemberColor, Routine } from '@hub/shared'
import s from './Settings.module.css'

type SectionId = 'family' | 'calendars' | 'music' | 'sleep' | 'weather' | 'pin'

const COLORS: { value: MemberColor; label: string }[] = [
  { value: 'moss', label: 'Moss' }, { value: 'clay', label: 'Clay' }, { value: 'honey', label: 'Honey' }, { value: 'fjord', label: 'Fjord' }, { value: 'plum', label: 'Plum' },
]
const ROUTINES: { value: Routine; label: string }[] = [
  { value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }, { value: 'evening', label: 'Evening' }, { value: 'chores', label: 'Chores' },
]

const IDLE_OPTIONS = [3, 5, 10, 15, 30]
const SLIDE_OPTIONS = [10, 15, 20, 30, 45]
const LOCK_OPTIONS = [1, 2, 5, 10, 15]
const SLEEP_STARTS = ['21:00', '21:30', '22:00', '22:30', '23:00']
const SLEEP_ENDS = ['05:00', '05:30', '06:00', '06:30', '07:00']

function cycle<T>(options: T[], current: T): T {
  const i = options.findIndex((v) => v === current)
  return options[(i + 1) % options.length]!
}

function normalizeTime(value: string) {
  return value.slice(0, 5)
}

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

function SleepSettings({ settings }: { settings: HouseholdSettings }) {
  const update = useUpdateHouseholdSettings()
  const patch = (input: Partial<HouseholdSettings>) => void update.mutateAsync(input).catch(() => {})

  return (
    <div className={s.rows}>
      <div className={s.row}>
        <span className={s.rowText}><span>Sleep hours</span><small>Dim clock overnight</small></span>
        <Button
          variant="secondary"
          iconRight="chevron-right"
          className={s.value}
          onClick={() => patch({
            sleepStart: cycle(SLEEP_STARTS, normalizeTime(settings.sleepStart)),
            sleepEnd: settings.sleepEnd,
          })}
        >
          {settingsSleepLabel(settings.sleepStart, settings.sleepEnd)}
        </Button>
      </div>
      <div className={s.row}>
        <span className={s.rowText}><span>Wake time</span></span>
        <Button
          variant="secondary"
          iconRight="chevron-right"
          className={s.value}
          onClick={() => patch({ sleepEnd: cycle(SLEEP_ENDS, normalizeTime(settings.sleepEnd)) })}
        >
          {formatTimeOfDay(settings.sleepEnd)}
        </Button>
      </div>
      <div className={s.row}>
        <span className={s.rowText}><span>While asleep, show</span></span>
        <Button variant="secondary" className={s.value}>Dim clock</Button>
      </div>
      <div className={s.row}>
        <span className={s.rowText}><span>Start slideshow after</span></span>
        <Button
          variant="secondary"
          iconRight="chevron-right"
          className={s.value}
          onClick={() => patch({ idleMinutes: cycle(IDLE_OPTIONS, settings.idleMinutes) })}
        >
          {settings.idleMinutes} minutes idle
        </Button>
      </div>
      <div className={s.row}>
        <span className={s.rowText}><span>Each slideshow photo</span></span>
        <Button
          variant="secondary"
          iconRight="chevron-right"
          className={s.value}
          onClick={() => patch({ slideSeconds: cycle(SLIDE_OPTIONS, settings.slideSeconds) })}
        >
          {settings.slideSeconds} seconds
        </Button>
      </div>
      <div className={s.row}>
        <span className={s.rowText}><span>Wake on</span><small>Motion sensor could come later</small></span>
        <Button variant="secondary" className={s.value}>Tap</Button>
      </div>
    </div>
  )
}

function WeatherSettings({ settings }: { settings: HouseholdSettings }) {
  const update = useUpdateHouseholdSettings()
  const location = [settings.locationLabel, settings.locationZip].filter(Boolean).join(' · ') || 'Not set'

  return (
    <div className={s.rows}>
      <div className={s.row}>
        <span className={s.rowText}><span>Location</span><small>Used only for the forecast</small></span>
        <Button variant="secondary" className={s.value}>{location}</Button>
      </div>
      <div className={s.row}>
        <span className={s.rowText}><span>Units</span></span>
        <Button
          variant="secondary"
          iconRight="chevron-right"
          className={s.value}
          onClick={() => void update.mutateAsync({ weatherUnits: settings.weatherUnits === 'f' ? 'c' : 'f' }).catch(() => {})}
        >
          {settings.weatherUnits === 'c' ? '°C' : '°F'}
        </Button>
      </div>
      <div className={s.row}>
        <span className={s.rowText}><span>Refresh every</span></span>
        <Button variant="secondary" className={s.value}>30 minutes</Button>
      </div>
    </div>
  )
}

function PinSettings({ settings }: { settings: HouseholdSettings }) {
  const { requirePin } = useNav()
  const update = useUpdateHouseholdSettings()
  const setPin = useSetParentPin()
  const patch = (input: Partial<HouseholdSettings>) => void update.mutateAsync(input).catch(() => {})

  const changePin = () => {
    requirePin({
      title: 'To change the parent PIN',
      detail: 'Enter the current PIN first',
      onSuccess: () => {
        requirePin({
          title: 'Choose a new PIN',
          detail: 'Four digits',
          captureOnly: true,
          onSuccess: (pin) => {
            if (pin) void setPin.mutateAsync(pin).catch(() => {})
          },
        })
      },
    })
  }

  return (
    <div className={s.rows}>
      <div className={s.row}>
        <span className={s.rowText}><span>Change PIN</span></span>
        <Button variant="secondary" iconRight="chevron-right" className={s.value} onClick={changePin}>••••</Button>
      </div>
      <div className={s.row}>
        <span className={s.rowText}><span>Approving rewards</span><small>Needs the PIN</small></span>
        <Switch
          checked={settings.pinProtectRewards}
          label="Approving rewards"
          onChange={(v) => patch({ pinProtectRewards: v })}
        />
      </div>
      <div className={s.row}>
        <span className={s.rowText}><span>Opening settings</span><small>Needs the PIN</small></span>
        <Switch
          checked={settings.pinProtectSettings}
          label="Opening settings"
          onChange={(v) => patch({ pinProtectSettings: v })}
        />
      </div>
      <div className={s.row}>
        <span className={s.rowText}><span>Deleting things</span><small>Needs the PIN</small></span>
        <Switch
          checked={settings.pinProtectDeletes}
          label="Deleting things"
          onChange={(v) => patch({ pinProtectDeletes: v })}
        />
      </div>
      <div className={s.row}>
        <span className={s.rowText}><span>Lock again after</span></span>
        <Button
          variant="secondary"
          iconRight="chevron-right"
          className={s.value}
          onClick={() => patch({ pinLockMinutes: cycle(LOCK_OPTIONS, settings.pinLockMinutes) })}
        >
          {settings.pinLockMinutes} minute{settings.pinLockMinutes === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  )
}

function FamilySettings({ members }: { members: Member[] }) {
  const update = useUpdateMember()
  const patch = (
    id: string,
    p: Omit<Parameters<typeof update.mutate>[0], 'id'>,
  ) => void update.mutateAsync({ id, ...p }).catch(() => {})

  return (
    <>
      <div className={s.members}>
        {members.map((m) => (
          <div key={m.id} data-color={m.color} className={s.member}>
            <div className={s.memberHead}>
              <Avatar initial={m.initial} color={m.color} size="lg" />
              <span className={s.memberName}>
                <strong>{m.name}</strong>
                <span>{m.role === 'parent' ? 'Parent' : 'Child · no login'} · {m.roleLabel}</span>
              </span>
              <button type="button" className={s.edit} aria-label={`Edit ${m.name}`}><Icon name="pencil" size={22} /></button>
            </div>
            <div className={s.field}>
              <Label>Color</Label>
              <div className={s.swatches}>
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    data-color={c.value}
                    aria-pressed={m.color === c.value}
                    aria-label={c.label}
                    className={m.color === c.value ? `${s.swatch} ${s.swatchOn}` : s.swatch}
                    onClick={() => patch(m.id, { color: c.value })}
                  >
                    <span />
                  </button>
                ))}
              </div>
            </div>
            <div className={s.field}>
              <Label>Routines</Label>
              <div className={s.routines}>
                {ROUTINES.map((r) => {
                  const on = m.routines.includes(r.value)
                  return (
                    <button
                      key={r.value}
                      type="button"
                      aria-pressed={on}
                      className={on ? `${s.routine} ${s.routineOn}` : s.routine}
                      onClick={() => patch(m.id, {
                        routines: on ? m.routines.filter((x) => x !== r.value) : [...m.routines, r.value],
                      })}
                    >
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className={s.pointsRow}>
              <span>Earns points</span>
              <Switch
                checked={m.earnsPoints}
                label={`${m.name} earns points`}
                onChange={(v) => patch(m.id, { earnsPoints: v })}
              />
            </div>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="lg" icon="plus" className={s.addMember}>Add a family member</Button>
    </>
  )
}

export default function Settings() {
  const now = useClock()
  const { settingsUnlockedUntil } = useNav()
  const speakers = useSpeakers()
  const calendarSources = useCalendarSources()
  const members = useMembers()
  const settings = useHouseholdSettings()
  useLive('members', 'members')

  const speakerCount = speakers.data?.length ?? 0
  const calendarCount = calendarSources.data?.length ?? 0
  const [section, setSection] = useState<SectionId>('family')

  const lockMinsLeft = Math.max(0, Math.ceil((settingsUnlockedUntil - now.getTime()) / 60_000))

  const sections: { id: SectionId; label: string; sub: string; icon: IconName; color: MemberColor }[] = [
    { id: 'family', label: 'Family', sub: 'Members, colors, routines', icon: 'sofa', color: 'moss' },
    { id: 'calendars', label: 'Calendars', sub: calendarCount ? `${calendarCount} Google calendar${calendarCount === 1 ? '' : 's'}` : 'Link Google accounts', icon: 'calendar', color: 'fjord' },
    { id: 'music', label: 'Music & speakers', sub: speakerCount ? `Spotify · ${speakerCount} speakers` : 'Spotify · speakers', icon: 'music', color: 'clay' },
    {
      id: 'sleep',
      label: 'Sleep & screen',
      sub: settings.data ? settingsSleepLabel(settings.data.sleepStart, settings.data.sleepEnd) : '…',
      icon: 'moon',
      color: 'fjord',
    },
    {
      id: 'weather',
      label: 'Location & weather',
      sub: settings.data?.locationLabel ?? 'Header forecast',
      icon: 'sun',
      color: 'honey',
    },
    { id: 'pin', label: 'Parent PIN', sub: 'Approvals and settings', icon: 'key', color: 'clay' },
  ]
  const current = sections.find((x) => x.id === section)!

  return (
    <AppShell>
      <PageHeader
        eyebrow="Parent mode"
        title="Settings"
        actions={
          <span className={s.unlocked}>
            <Icon name="unlock" size={20} />
            {lockMinsLeft > 0
              ? `Unlocked · locks again in ${lockMinsLeft} min`
              : 'Unlocked'}
          </span>
        }
      />
      <div className={s.layout}>
        <nav className={s.sections} aria-label="Settings sections">
          {sections.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-current={x.id === section ? 'page' : undefined}
              className={x.id === section ? `${s.section} ${s.sectionOn}` : s.section}
              onClick={() => setSection(x.id)}
            >
              <IconTile icon={x.icon} color={x.color} size={52} />
              <span className={s.sectionText}><strong>{x.label}</strong><span>{x.sub}</span></span>
            </button>
          ))}
        </nav>

        <Panel pad="lg" className={`${s.content} scroll-y`} aria-label={current.label}>
          <h2 className={s.h2}>{current.label}</h2>
          {section === 'family' ? (
            members.data ? <FamilySettings members={members.data} /> : null
          ) : section === 'calendars' ? (
            <CalendarSettings />
          ) : section === 'music' ? (
            <MusicSettings />
          ) : section === 'sleep' ? (
            settings.data ? <SleepSettings settings={settings.data} /> : null
          ) : section === 'weather' ? (
            settings.data ? <WeatherSettings settings={settings.data} /> : null
          ) : (
            settings.data ? <PinSettings settings={settings.data} /> : null
          )}
        </Panel>
      </div>
    </AppShell>
  )
}
