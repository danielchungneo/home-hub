import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import s from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'surface' | 'rail' | 'ghost' | 'member' | 'success'
type Size = 'md' | 'lg' | 'xl'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Fully rounded ends (header actions, chips). Default is the 16–20px rounded rectangle. */
  pill?: boolean
  icon?: IconName
  iconRight?: IconName
  block?: boolean
  children?: ReactNode
}

/**
 * The one button. Heights: md 56 · lg 64 · xl 88 (all ≥ --touch-min).
 * - primary: ink fill, the main action on a surface (Redeem, Add, Approve)
 * - secondary: sunken fill on surfaces (Not now, Add to meal plan)
 * - surface: white fill, the selected item inside a Rail ("Today")
 * - rail: oat-rail fill on the page background (header actions)
 * - ghost: no fill (sidebar-style, inside rails)
 * - member: filled with the nearest data-color member color
 * - success: moss fill (Next step, Done)
 */
export function Button({
  variant = 'primary', size = 'md', pill, icon, iconRight, block, className, children, type = 'button', ...rest
}: ButtonProps) {
  const cls = [s.btn, s[variant], s[size], pill && s.pill, block && s.block, className].filter(Boolean).join(' ')
  const iconSize = size === 'xl' ? 30 : 22
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  /** Required: icon-only buttons need an accessible name. */
  label: string
  variant?: Variant
  size?: Size
  round?: boolean
}

export function IconButton({ icon, label, variant = 'secondary', size = 'md', round = true, className, type = 'button', ...rest }: IconButtonProps) {
  const cls = [s.btn, s.square, s[variant], s[size], round && s.pill, className].filter(Boolean).join(' ')
  return (
    <button type={type} aria-label={label} className={cls} {...rest}>
      <Icon name={icon} size={size === 'xl' ? 34 : 22} />
    </button>
  )
}
