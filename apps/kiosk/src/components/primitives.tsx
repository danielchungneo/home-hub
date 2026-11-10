import type { HTMLAttributes, ReactNode } from 'react'
import type { MemberColor } from '@hub/shared'
import { Icon } from './Icon'
import s from './primitives.module.css'

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------- Panel: the white rounded surface everything sits on ---------- */
interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'aside'
  pad?: 'none' | 'sm' | 'md' | 'lg'
}
export function Panel({ as: Tag = 'section', pad = 'md', className, ...rest }: PanelProps) {
  return <Tag className={cx(s.panel, s[`pad-${pad}`], className)} {...rest} />
}

/* ---------- Eyebrow / section label: small caps, tracked ---------- */
export function Label({ children, className, as: Tag = 'span' }: { children: ReactNode; className?: string; as?: 'span' | 'h2' | 'h3' }) {
  return <Tag className={cx(s.label, className)}>{children}</Tag>
}

/* ---------- Avatar: colored circle with a serif initial ---------- */
export function Avatar({ initial, color, size = 'md', muted }: { initial: string; color: MemberColor; size?: 'xs' | 'sm' | 'md' | 'lg'; muted?: boolean }) {
  return (
    <span data-color={color} className={cx(s.avatar, s[`avatar-${size}`], muted && s.avatarMuted)} aria-hidden="true">
      {initial}
    </span>
  )
}

/* ---------- Progress bar ---------- */
export function Progress({ value, label, tone = 'member' }: { value: number; label: string; tone?: 'member' | 'ink' }) {
  const pct = Math.max(0, Math.min(1, value))
  return (
    <div className={s.track} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
      {/* scaleX instead of width: compositor-only, no layout on the Pi */}
      <div className={cx(s.fill, tone === 'ink' && s.fillInk)} style={{ transform: `scaleX(${pct})` }} />
    </div>
  )
}

/* ---------- Switch (role=switch) ---------- */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={cx(s.switch, checked && s.switchOn)} onClick={() => onChange(!checked)}>
      <span className={s.knob} />
    </button>
  )
}

/* ---------- Chip: toggleable filter pill ---------- */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={selected} className={cx(s.chip, selected && s.chipOn)} onClick={onClick}>
      {children}
    </button>
  )
}

/* ---------- Check box visual (put inside a larger button) ---------- */
export function CheckMark({ checked, size = 56 }: { checked: boolean; size?: number }) {
  return (
    <span className={cx(s.check, checked && s.checkOn, checked && 'anim-pop')} style={{ width: size, height: size }} aria-hidden="true">
      {checked && <Icon name="tick" size={Math.round(size / 2)} stroke={3} />}
    </span>
  )
}

/* ---------- Icon tile: tinted rounded square with an illustration icon ---------- */
export function IconTile({ icon, color, size = 64 }: { icon: Parameters<typeof Icon>[0]['name']; color?: MemberColor; size?: number }) {
  return (
    <span data-color={color} className={s.tile} style={{ width: size, height: size }} aria-hidden="true">
      <Icon name={icon} size={Math.round(size * 0.62)} stroke={2.2} />
    </span>
  )
}

/* ---------- Segmented control ---------- */
interface SegOption<T extends string> { value: T; label: string; sub?: string }
export function Segmented<T extends string>({
  options, value, onChange, label, variant = 'rail', block,
}: { options: SegOption<T>[]; value: T; onChange: (v: T) => void; label: string; variant?: 'rail' | 'member'; block?: boolean }) {
  return (
    <div role="group" aria-label={label} className={cx(s.seg, variant === 'member' && s.segMember, block && s.segBlock)}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} className={cx(s.segBtn, o.value === value && s.segOn)} onClick={() => onChange(o.value)}>
          <span>{o.label}</span>
          {o.sub && <span className={s.segSub}>{o.sub}</span>}
        </button>
      ))}
    </div>
  )
}

/* ---------- Status pill (header) ---------- */
export function StatusPill({ children, tone = 'ok' }: { children: ReactNode; tone?: 'ok' | 'off' }) {
  return (
    <span className={s.status}>
      <span className={cx(s.dot, tone === 'off' && s.dotOff)} />
      {children}
    </span>
  )
}

/* ---------- Rail: pill track that groups header buttons (prev · Today · next) ---------- */
export function Rail({ children, label }: { children: ReactNode; label?: string }) {
  return <div role="group" aria-label={label} className={s.seg}>{children}</div>
}
