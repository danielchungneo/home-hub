import { useMemo, useState } from 'react'
import { useNav } from '../app/nav'
import { AppShell, PageHeader, settingsSleepLabel } from '../components/AppShell'
import { Button } from '../components/Button'
import { ColorPicker } from '../components/ColorPicker'
import { Icon, type IconName } from '../components/Icon'
import { SoftKeyboard } from '../components/SoftKeyboard'
import { MemberBlobAvatar } from '../components/MemberBlobAvatar'
import { IconTile, Label, Panel, Segmented, Switch } from '../components/primitives'
import {
  useAllMembers,
  useAssignCalendarSource,
  useAthleteProfiles,
  useCalendarSources,
  useCreateMember,
  useDeleteMember,
  useHouseholdSettings,
  useJukeboxCommand,
  useJukeboxState,
  useMembers,
  useSetParentPin,
  useSpeakers,
  useToggleCalendarSource,
  useUpdateHouseholdSettings,
  useUpdateMember,
  useUpsertAthleteProfile,
  type MemberInput,
} from '../data/hooks'
import { useLive } from '../data/live'
import { useClock } from '../hooks/useClock'
import { memberColorProps } from '../lib/colors'
import { formatTimeOfDay } from '../lib/format'
import { who } from '../lib/members'
import type { AthleteProfile, CardioKind, HouseholdSettings, Member, MemberColor } from '@hub/shared'
import s from './Settings.module.css'

type SectionId = 'family' | 'workout' | 'calendars' | 'music' | 'sleep' | 'weather' | 'pin'

const CARDIO_OPTIONS: { id: CardioKind; label: string }[] = [
  { id: 'run', label: 'Run' },
  { id: 'walk', label: 'Walk' },
  { id: 'bike', label: 'Bike' },
  { id: 'swim', label: 'Swim' },
]
const EQUIPMENT_OPTIONS = ['Pull-up bar', 'Bands', 'Dumbbells', 'Kettlebell', 'Yoga mat']

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
  const members = useMembers()
  const toggle = useToggleCalendarSource()
  const assign = useAssignCalendarSource()
  useLive('calendar_sources', 'calendarSources')
  const list = sources.data ?? []
  const whoOptions = useMemo(
    () => [...(members.data ?? []).map((m) => m.id), 'family'] as string[],
    [members.data],
  )

  return (
    <div className={s.rows}>
      {list.map((src) => {
        const person = who(src.memberId ?? 'family')
        const hint = src.accountKey ? `Google · ${src.accountKey}` : 'Google'
        return (
          <div key={src.id} className={s.row} {...memberColorProps(src.color ?? person.color)}>
            <span className={s.rowText}>
              <span>{src.name}</span>
              <small>{hint}</small>
            </span>
            <Button
              variant="secondary"
              className={s.value}
              aria-label={`Show ${src.name} as ${person.name}. Tap to change.`}
              onClick={() => {
                const cur = src.memberId ?? 'family'
                const next = cycle(whoOptions, cur)
                void assign.mutateAsync({ id: src.id, memberId: next === 'family' ? null : next })
              }}
            >
              {person.name}
            </Button>
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
      <p className={s.speakerEmpty}>
        New Google calendars (like Outlook work) need a re-link: <code>pnpm google:calendar-login -- --member daniel</code>, then set “shows as” above and sync from Calendar.
      </p>
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

type MemberField = 'name' | 'roleLabel' | null

const blankMember = (): MemberInput => ({
  name: '',
  role: 'child',
  roleLabel: '',
  color: 'plum',
  avatar: 'pebble',
  earnsPoints: true,
  active: true,
})

function titleCaseName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)\S/g, (ch) => ch.toUpperCase())
}

function FamilySettings({ members }: { members: Member[] }) {
  const { requirePin } = useNav()
  const settings = useHouseholdSettings()
  const update = useUpdateMember()
  const create = useCreateMember()
  const remove = useDeleteMember()

  const [editingId, setEditingId] = useState<string | null | 'new'>(null)
  const [draft, setDraft] = useState<MemberInput>(blankMember())
  const [field, setField] = useState<MemberField>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editing = editingId && editingId !== 'new' ? members.find((m) => m.id === editingId) : undefined
  const open = editingId !== null

  const openNew = () => {
    setEditingId('new')
    setDraft(blankMember())
    setField('name')
    setConfirmDelete(false)
    setError(null)
  }
  const openEdit = (m: Member) => {
    setEditingId(m.id)
    setDraft({
      name: m.name,
      role: m.role,
      roleLabel: m.roleLabel,
      color: m.color,
      avatar: m.avatar || 'pebble',
      earnsPoints: m.earnsPoints,
      active: m.active,
    })
    setField(null)
    setConfirmDelete(false)
    setError(null)
  }
  const closeEditor = () => {
    if (busy) return
    setEditingId(null)
    setField(null)
    setConfirmDelete(false)
    setError(null)
  }

  const canSave = draft.name.trim().length > 0

  const save = async () => {
    if (!canSave || busy || editingId === null) return
    setBusy(true)
    setError(null)
    const input: MemberInput = {
      name: titleCaseName(draft.name),
      role: draft.role,
      roleLabel: draft.roleLabel.trim() || (draft.role === 'parent' ? 'Parent' : 'Child'),
      color: draft.color,
      avatar: draft.avatar || 'pebble',
      earnsPoints: draft.earnsPoints,
      active: draft.active,
    }
    try {
      if (editingId === 'new') await create.mutateAsync(input)
      else await update.mutateAsync({ id: editingId, ...input })
      setEditingId(null)
      setField(null)
      setConfirmDelete(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save that person.')
    } finally {
      setBusy(false)
    }
  }

  const runDelete = async () => {
    if (!editing || busy) return
    setBusy(true)
    setError(null)
    try {
      await remove.mutateAsync(editing.id)
      setConfirmDelete(false)
      setEditingId(null)
      setField(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t remove that person.')
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  const askDelete = () => {
    if (!editing) return
    const proceed = () => setConfirmDelete(true)
    if (settings.data?.pinProtectDeletes) {
      requirePin({
        title: `To remove ${editing.name}`,
        detail: 'This deletes their tasks, stars, and wishlist.',
        onSuccess: proceed,
      })
    } else {
      proceed()
    }
  }

  const keyboardValue = field === 'name' ? draft.name : field === 'roleLabel' ? draft.roleLabel : ''
  const onKeyboard = (next: string) => {
    if (field === 'name') setDraft((d) => ({ ...d, name: next.slice(0, 24) }))
    if (field === 'roleLabel') setDraft((d) => ({ ...d, roleLabel: next.slice(0, 24) }))
  }

  const quickPatch = (
    id: string,
    p: Omit<Parameters<typeof update.mutate>[0], 'id'>,
  ) => void update.mutateAsync({ id, ...p }).catch(() => {})

  return (
    <>
      <div className={s.members}>
        {members.map((m) => (
          <div key={m.id} {...memberColorProps(m.color)} className={m.active ? s.member : `${s.member} ${s.memberInactive}`}>
            <div className={s.memberHead}>
              <MemberBlobAvatar memberId={m.id} size={72} showBackground={!m.active} decorative />
              <span className={s.memberName}>
                <strong>{m.name}</strong>
                <span>
                  {m.active ? '' : 'Inactive · '}
                  {m.role === 'parent' ? 'Parent' : 'Child · no login'} · {m.roleLabel}
                  {' · '}Name and look live in Profiles
                </span>
              </span>
              <button type="button" className={s.edit} aria-label={`Edit ${m.name}`} onClick={() => openEdit(m)}>
                <Icon name="pencil" size={22} />
              </button>
            </div>
            <div className={s.pointsRow}>
              <span>Earns points</span>
              <Switch
                checked={m.earnsPoints}
                label={`${m.name} earns points`}
                onChange={(v) => quickPatch(m.id, { earnsPoints: v })}
              />
            </div>
            <div className={s.pointsRow}>
              <span>Active in the hub</span>
              <Switch
                checked={m.active}
                label={`${m.name} is active`}
                onChange={(v) => quickPatch(m.id, { active: v })}
              />
            </div>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="lg" icon="plus" className={s.addMember} onClick={openNew}>
        Add a family member
      </Button>

      {open && (
        <div className={s.confirmScrim} onClick={closeEditor}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-editor-title"
            className={s.memberDialog}
            onClick={(e) => e.stopPropagation()}
          >
            {confirmDelete && editing ? (
              <>
                <div className={s.confirmText}>
                  <h2 id="member-editor-title" className={s.confirmTitle}>Remove {editing.name}?</h2>
                  <p className={s.confirmDetail}>
                    This permanently deletes their tasks, star balance, redemptions, and wishlist.
                    Calendars and list assignments stay, but won’t show as {editing.name}.
                    Prefer hiding them? Mark inactive instead.
                  </p>
                </div>
                {error && <p className={s.formError}>{error}</p>}
                <div className={s.confirmActions}>
                  <Button variant="secondary" size="lg" block disabled={busy} onClick={() => setConfirmDelete(false)}>
                    Keep {editing.name}
                  </Button>
                  <Button variant="primary" size="lg" block icon="trash" disabled={busy} onClick={() => void runDelete()}>
                    {busy ? 'Removing…' : 'Remove forever'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className={s.confirmText}>
                  <h2 id="member-editor-title" className={s.confirmTitle}>
                    {editingId === 'new' ? 'Add a family member' : `Edit ${editing?.name ?? 'member'}`}
                  </h2>
                  <p className={s.confirmDetail}>
                    {editingId === 'new'
                      ? 'Start with a name and role. They can pick their color and avatar in Profiles.'
                      : 'Manage role, points, and whether they show in the hub. Name, color, and avatar live in Profiles.'}
                  </p>
                </div>

                {editingId === 'new' && (
                  <>
                    <label className={s.addField}>
                      <Icon name="sofa" size={24} stroke={2.6} />
                      <span className="sr-only">Name</span>
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value.slice(0, 24) }))}
                        onFocus={() => setField('name')}
                        placeholder="Name"
                        autoComplete="off"
                        inputMode="none"
                      />
                    </label>

                    <div className={s.field}>
                      <Label>Starting color</Label>
                      <ColorPicker
                        value={draft.color}
                        onChange={(color) => setDraft((d) => ({ ...d, color }))}
                        label="Starting color"
                      />
                    </div>
                  </>
                )}

                <label className={s.addField}>
                  <Icon name="pencil" size={24} stroke={2.6} />
                  <span className="sr-only">Role label</span>
                  <input
                    value={draft.roleLabel}
                    onChange={(e) => setDraft((d) => ({ ...d, roleLabel: e.target.value.slice(0, 24) }))}
                    onFocus={() => setField('roleLabel')}
                    placeholder={draft.role === 'parent' ? 'Dad, Mom…' : 'Kid, baby care…'}
                    autoComplete="off"
                    inputMode="none"
                  />
                </label>

                <Segmented
                  label="Role"
                  block
                  value={draft.role}
                  onChange={(role) => setDraft((d) => ({ ...d, role }))}
                  options={[
                    { value: 'parent', label: 'Parent', sub: 'Can approve' },
                    { value: 'child', label: 'Child', sub: 'No login' },
                  ]}
                />

                <div className={s.pointsRow}>
                  <span>Earns points</span>
                  <Switch
                    checked={draft.earnsPoints}
                    label="Earns points"
                    onChange={(v) => setDraft((d) => ({ ...d, earnsPoints: v }))}
                  />
                </div>
                <div className={s.pointsRow}>
                  <span>Active in the hub</span>
                  <Switch
                    checked={draft.active}
                    label="Active in the hub"
                    onChange={(v) => setDraft((d) => ({ ...d, active: v }))}
                  />
                </div>

                {error && <p className={s.formError}>{error}</p>}

                <div className={s.confirmActions}>
                  <Button variant="primary" size="lg" block disabled={!canSave || busy} onClick={() => void save()}>
                    {busy ? 'Saving…' : editingId === 'new' ? 'Add member' : 'Save'}
                  </Button>
                  <Button variant="secondary" size="lg" block disabled={busy} onClick={closeEditor}>
                    Cancel
                  </Button>
                  {editingId !== 'new' && (
                    <Button variant="ghost" size="lg" block icon="trash" disabled={busy} onClick={askDelete}>
                      Remove forever
                    </Button>
                  )}
                </div>

                {field && (
                  <SoftKeyboard
                    value={keyboardValue}
                    onChange={onKeyboard}
                    onDone={() => setField(null)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function blankAthlete(memberId: string): AthleteProfile {
  return {
    memberId,
    coachEnabled: false,
    daysPerWeek: 4,
    preferredCardio: ['run', 'walk'],
    equipment: [],
  }
}

function WorkoutCoachSettings({ members }: { members: Member[] }) {
  const { requirePin } = useNav()
  const profilesQ = useAthleteProfiles()
  const upsert = useUpsertAthleteProfile()
  useLive('athlete_profiles', 'athleteProfiles')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [avoid, setAvoid] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const adults = members.filter((m) => m.active && m.role === 'parent')
  const profiles = profilesQ.data ?? []
  const profileFor = (id: string) => profiles.find((p) => p.memberId === id) ?? blankAthlete(id)
  const editing = editingId ? adults.find((m) => m.id === editingId) : undefined
  const draft = editingId ? profileFor(editingId) : null

  const save = async (next: AthleteProfile, opts?: { pin?: boolean }) => {
    const run = async () => {
      setBusy(true)
      setError(null)
      try {
        await upsert.mutateAsync({
          memberId: next.memberId,
          coachEnabled: next.coachEnabled,
          daysPerWeek: next.daysPerWeek,
          preferredCardio: next.preferredCardio,
          equipment: next.equipment,
          limitations: next.limitations,
          goals: next.goals,
          easyPace: next.easyPace,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Couldn’t save coach settings.')
      } finally {
        setBusy(false)
      }
    }
    if (opts?.pin) {
      requirePin({
        title: next.coachEnabled ? `Turn on Workout coach for ${who(next.memberId).name}` : `Turn off Workout coach for ${who(next.memberId).name}`,
        detail: 'Parent mode',
        onSuccess: () => void run(),
      })
      return
    }
    await run()
  }

  return (
    <>
      <p className={s.confirmDetail}>
        Each adult can opt in. The coach plans their day from the last month; stars only come from finishing a plan part.
      </p>
      <div className={s.members}>
        {adults.map((m) => {
          const p = profileFor(m.id)
          return (
            <div key={m.id} {...memberColorProps(m.color)} className={s.member}>
              <div className={s.memberHead}>
                <MemberBlobAvatar memberId={m.id} size={72} decorative />
                <span className={s.memberName}>
                  <strong>{m.name}</strong>
                  <span>{p.coachEnabled ? `${p.daysPerWeek} days / week` : 'Coach off'}</span>
                </span>
                <button type="button" className={s.edit} aria-label={`Edit coach for ${m.name}`} onClick={() => { setEditingId(m.id); setAvoid(p.limitations ?? ''); setError(null) }}>
                  <Icon name="pencil" size={22} />
                </button>
              </div>
              <div className={s.pointsRow}>
                <span>Workout coach</span>
                <Switch
                  checked={p.coachEnabled}
                  label={`${m.name} workout coach`}
                  onChange={(v) => void save({ ...p, coachEnabled: v }, { pin: true })}
                />
              </div>
            </div>
          )
        })}
      </div>

      {editing && draft && (
        <div className={s.confirmScrim} onClick={() => !busy && setEditingId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-editor-title"
            className={s.memberDialog}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.confirmText}>
              <h2 id="coach-editor-title" className={s.confirmTitle}>{editing.name}’s coach</h2>
              <p className={s.confirmDetail}>Days, preferred cardio, gear, and anything to avoid.</p>
            </div>

            <div className={s.pointsRow}>
              <span>Workout coach</span>
              <Switch
                checked={draft.coachEnabled}
                label="Workout coach"
                onChange={(v) => void save({ ...draft, coachEnabled: v }, { pin: true })}
              />
            </div>

            <div className={s.field}>
              <Label>Days per week</Label>
              <Segmented
                label="Days per week"
                block
                value={String(draft.daysPerWeek)}
                onChange={(v) => void save({ ...draft, daysPerWeek: Number(v) })}
                options={[3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))}
              />
            </div>

            <div className={s.field}>
              <Label>Preferred cardio</Label>
              <div className={s.chipRow}>
                {CARDIO_OPTIONS.map((c) => {
                  const on = draft.preferredCardio.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      className={on ? `${s.chip} ${s.chipOn}` : s.chip}
                      onClick={() => {
                        const preferredCardio = on
                          ? draft.preferredCardio.filter((x) => x !== c.id)
                          : [...draft.preferredCardio, c.id]
                        void save({ ...draft, preferredCardio: preferredCardio.length ? preferredCardio : ['walk'] })
                      }}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={s.field}>
              <Label>Equipment</Label>
              <div className={s.chipRow}>
                {EQUIPMENT_OPTIONS.map((eq) => {
                  const on = draft.equipment.includes(eq)
                  return (
                    <button
                      key={eq}
                      type="button"
                      aria-pressed={on}
                      className={on ? `${s.chip} ${s.chipOn}` : s.chip}
                      onClick={() => {
                        const equipment = on
                          ? draft.equipment.filter((x) => x !== eq)
                          : [...draft.equipment, eq]
                        void save({ ...draft, equipment })
                      }}
                    >
                      {eq}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className={s.addField}>
              <Icon name="leaf" size={24} stroke={2.6} />
              <span className="sr-only">Anything the coach should avoid</span>
              <input
                value={avoid}
                onChange={(e) => setAvoid(e.target.value.slice(0, 160))}
                onBlur={() => {
                  if ((draft.limitations ?? '') !== avoid.trim()) {
                    void save({ ...draft, limitations: avoid.trim() || undefined })
                  }
                }}
                placeholder="Anything the coach should avoid"
                autoComplete="off"
              />
            </label>

            {error && <p className={s.formError}>{error}</p>}
            <div className={s.confirmActions}>
              <Button variant="secondary" size="lg" block disabled={busy} onClick={() => setEditingId(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function Settings() {
  const now = useClock()
  const { settingsUnlockedUntil } = useNav()
  const speakers = useSpeakers()
  const calendarSources = useCalendarSources()
  const members = useAllMembers()
  const settings = useHouseholdSettings()
  useLive('members', 'members')

  const speakerCount = speakers.data?.length ?? 0
  const calendarCount = calendarSources.data?.length ?? 0
  const [section, setSection] = useState<SectionId>('family')

  const lockMinsLeft = Math.max(0, Math.ceil((settingsUnlockedUntil - now.getTime()) / 60_000))

  const sections: { id: SectionId; label: string; sub: string; icon: IconName; color: MemberColor }[] = [
    { id: 'family', label: 'Family', sub: 'Add, hide, remove members', icon: 'sofa', color: 'moss' },
    { id: 'workout', label: 'Workout coach', sub: 'Opt in, days, gear, limits', icon: 'dumbbell', color: 'honey' },
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
          ) : section === 'workout' ? (
            members.data ? <WorkoutCoachSettings members={members.data} /> : null
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
