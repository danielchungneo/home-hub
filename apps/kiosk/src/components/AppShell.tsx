import type { ReactNode } from 'react'
import type { ScreenId, ThemeColorToken } from '@hub/shared'
import { useNav } from '../app/nav'
import { useHouseholdSettings, useWeather } from '../data/hooks'
import { useClock } from '../hooks/useClock'
import { memberColorProps } from '../lib/colors'
import { formatTimeOfDay, time, weekday } from '../lib/format'
import { TAB_COLOR } from '../lib/tabs'
import { Icon, type IconName } from './Icon'
import s from './AppShell.module.css'

const TABS: { id: ScreenId; label: string; icon: IconName }[] = [
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'tasks', label: 'Tasks', icon: 'check' },
  { id: 'rewards', label: 'Rewards', icon: 'star' },
  { id: 'workout', label: 'Workout', icon: 'dumbbell' },
  { id: 'meals', label: 'Meals', icon: 'utensils' },
  { id: 'recipes', label: 'Recipes', icon: 'book' },
  { id: 'lists', label: 'Lists', icon: 'list' },
  { id: 'jukebox', label: 'Jukebox', icon: 'music' },
  { id: 'profiles', label: 'Profiles', icon: 'people' },
]

/** Left icon rail. Sleep and Settings are pinned to the bottom. */
export function Sidebar() {
  const { screen, go, sleep, requirePin, settingsUnlockedUntil, markSettingsUnlocked } = useNav()
  const settings = useHouseholdSettings()

  const openSettings = () => {
    const protect = settings.data?.pinProtectSettings ?? true
    const unlocked = Date.now() < settingsUnlockedUntil
    if (!protect || unlocked) {
      go('settings')
      return
    }
    requirePin({
      title: 'To open Settings',
      detail: 'Parent mode',
      onSuccess: () => {
        const mins = settings.data?.pinLockMinutes ?? 5
        markSettingsUnlocked(Date.now() + mins * 60_000)
        go('settings')
      },
    })
  }

  return (
    <nav aria-label="Main" className={s.sidebar}>
      {TABS.map((t) => (
        <NavItem
          key={t.id}
          label={t.label}
          icon={t.icon}
          color={TAB_COLOR[t.id]}
          active={screen === t.id}
          onClick={() => go(t.id)}
        />
      ))}
      <div className={s.spacer} />
      <NavItem label="Sleep" icon="moon" color="slate" active={false} onClick={sleep} quiet />
      <NavItem
        label="Settings"
        icon="gear"
        color={TAB_COLOR.settings}
        active={screen === 'settings'}
        onClick={openSettings}
        quiet
      />
    </nav>
  )
}

function NavItem({
  label, icon, color, active, onClick, quiet,
}: {
  label: string
  icon: IconName
  color: ThemeColorToken
  active: boolean
  onClick: () => void
  /** Sleep / Settings — quieter idle, no always-on tint wash */
  quiet?: boolean
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      {...memberColorProps(color)}
      className={[s.item, quiet && s.quiet, active && s.active].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      <span className={s.iconWell} aria-hidden="true">
        <Icon name={icon} size={active ? 28 : 26} />
      </span>
      <span className={s.label}>{label}</span>
    </button>
  )
}

/** Sidebar + scrollable page area. Every tab screen renders inside this. */
export function AppShell({ children, fab }: { children: ReactNode; fab?: ReactNode }) {
  const { screen } = useNav()
  const tabColor = TAB_COLOR[screen] ?? 'slate'

  return (
    <div className={s.shell} {...memberColorProps(tabColor)} data-tab={screen}>
      <Sidebar />
      <main className={s.main}>{children}</main>
      {fab}
    </div>
  )
}

/** Line above a page title. Defaults to "Saturday · 9:42 AM · 52° partly sunny". */
export function HeaderMeta() {
  const now = useClock()
  const weather = useWeather()
  const w = weather.data
  const forecast = w ? `${w.temp}° ${w.condition.toLowerCase()}` : 'Set location in Settings'
  return <>{`${weekday(now)} · ${time(now)} · ${forecast}`}</>
}

export function PageHeader({ eyebrow, title, actions }: { eyebrow?: ReactNode; title: ReactNode; actions?: ReactNode }) {
  return (
    <header className={s.header}>
      <div className={s.titles}>
        <span className={s.eyebrow}>{eyebrow ?? <HeaderMeta />}</span>
        <h1 className={s.title}>{title}</h1>
      </div>
      {actions && <div className={s.actions}>{actions}</div>}
    </header>
  )
}

export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} className={s.fab} onClick={onClick}>
      <Icon name="plus" size={38} />
    </button>
  )
}

export function settingsSleepLabel(sleepStart: string, sleepEnd: string) {
  return `${formatTimeOfDay(sleepStart)} – ${formatTimeOfDay(sleepEnd)}`
}
