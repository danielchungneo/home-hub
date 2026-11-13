import type { ReactNode } from 'react'
import { useNav } from '../app/nav'
import { useHouseholdSettings, useWeather } from '../data/hooks'
import { useClock } from '../hooks/useClock'
import { formatTimeOfDay, time, weekday } from '../lib/format'
import type { ScreenId } from '@hub/shared'
import { Icon, type IconName } from './Icon'
import s from './AppShell.module.css'

const TABS: { id: ScreenId; label: string; icon: IconName }[] = [
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'tasks', label: 'Tasks', icon: 'check' },
  { id: 'rewards', label: 'Rewards', icon: 'star' },
  { id: 'meals', label: 'Meals', icon: 'utensils' },
  { id: 'recipes', label: 'Recipes', icon: 'book' },
  { id: 'lists', label: 'Lists', icon: 'list' },
  { id: 'jukebox', label: 'Jukebox', icon: 'music' },
  { id: 'profiles', label: 'Profiles', icon: 'sofa' },
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
      <div className={s.brand}>Chung</div>
      {TABS.map((t) => (
        <NavItem key={t.id} label={t.label} icon={t.icon} active={screen === t.id} onClick={() => go(t.id)} />
      ))}
      <div className={s.spacer} />
      <NavItem label="Sleep" icon="moon" active={false} onClick={sleep} />
      <NavItem label="Settings" icon="gear" active={screen === 'settings'} onClick={openSettings} />
    </nav>
  )
}

function NavItem({ label, icon, active, onClick }: { label: string; icon: IconName; active: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-current={active ? 'page' : undefined} className={active ? `${s.item} ${s.active}` : s.item} onClick={onClick}>
      <Icon name={icon} size={active ? 30 : 28} />
      <span>{label}</span>
    </button>
  )
}

/** Sidebar + scrollable page area. Every tab screen renders inside this. */
export function AppShell({ children, fab }: { children: ReactNode; fab?: ReactNode }) {
  return (
    <div className={s.shell}>
      <Sidebar />
      <main className={s.main}>{children}</main>
      {fab}
    </div>
  )
}

/** Uppercase line above a page title. Defaults to "Saturday · 9:42 AM · 52° partly sunny". */
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
