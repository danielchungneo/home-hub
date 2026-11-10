import type { CSSProperties, ReactNode } from 'react'

/*
 * One inline-SVG icon set for the whole kiosk. No icon library, no network,
 * no emoji font required. Every icon is a stroke drawing in currentColor, so
 * color comes from CSS (`color: var(--member)` etc.).
 *
 * Two families:
 *  - "illustration" icons (48×48 grid) for tasks, rewards, recipes, nav.
 *  - "ui" icons (24×24 grid) for chevrons, plus, play, lock and other controls.
 * Add new icons to the matching family, using the same stroke style.
 */

const ILLUSTRATION = {
  mug: <><path d="M10 18h22v14a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8z" /><path d="M32 22h3a5 5 0 0 1 0 10h-3" /><path d="M16 7c-2 3 2 4 0 7M22 7c-2 3 2 4 0 7M28 7c-2 3 2 4 0 7" /></>,
  dumbbell: <><path d="M5 20v8M43 20v8M16 24h16" /><rect x="9" y="14" width="7" height="20" rx="2" /><rect x="32" y="14" width="7" height="20" rx="2" /></>,
  bed: <><path d="M6 38V12M6 30h36v8M42 30v-6a4 4 0 0 0-4-4H21v10" /><rect x="9" y="21" width="9" height="6" rx="3" /></>,
  mail: <><rect x="6" y="12" width="36" height="24" rx="4" /><path d="M7 14l17 13 17-13" /></>,
  pot: <><path d="M8 21h32M10 21v11a6 6 0 0 0 6 6h16a6 6 0 0 0 6-6V21M4 23h4M40 23h4M17 21a7 5 0 0 1 14 0M22 15h4" /><path d="M17 6c-1 2 1 3 0 5M31 6c-1 2 1 3 0 5" /></>,
  dish: <><circle cx="22" cy="26" r="15" /><circle cx="22" cy="26" r="8" /><path d="M40 6v7M36.5 9.5h7" /></>,
  key: <><circle cx="15" cy="24" r="7" /><path d="M22 24h20M36 24v6M41 24v5" /></>,
  trash: <path d="M9 14h30M18 14v-4h12v4M12 14l2 25a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3l2-25M21 21v14M27 21v14" />,
  leaf: <><path d="M9 39C9 21 21 9 40 9c0 19-11 30-27 30z" /><path d="M9 39l17-17" /></>,
  car: <><path d="M6 34v-4a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" /><path d="M11 26l4-8a3 3 0 0 1 3-2h12a3 3 0 0 1 3 2l4 8" /><circle cx="14" cy="37" r="3.5" fill="var(--color-surface)" /><circle cx="34" cy="37" r="3.5" fill="var(--color-surface)" /></>,
  plant: <><path d="M14 30h20l-2 12H16z" /><path d="M24 30V17" /><path d="M24 23c-6 0-10-4-10-10 6 0 10 4 10 10zM24 18c0-6 4-10 10-10 0 6-4 10-10 10z" /></>,
  bag: <><rect x="8" y="16" width="32" height="25" rx="6" /><path d="M18 16v-3a6 6 0 0 1 12 0v3M8 27h32M21 27v5h6v-5" /></>,
  cart: <><path d="M4 8h6l5 22h22l4-15H12" /><circle cx="18" cy="38" r="3" /><circle cx="34" cy="38" r="3" /></>,
  shirt: <path d="M17 8l-9 5-4 9 6 3v17h28V25l6-3-4-9-9-5c0 4-3 6-7 6s-7-2-7-6z" />,
  sparkle: <><path d="M22 6c1 9 4 12 13 13-9 1-12 4-13 13-1-9-4-12-13-13 9-1 12-4 13-13z" /><path d="M37 31c.5 3 1.5 4 4.5 4.5-3 .5-4 1.5-4.5 4.5-.5-3-1.5-4-4.5-4.5 3-.5 4-1.5 4.5-4.5z" /></>,
  droplet: <><path d="M24 6c8 10 13 17 13 23a13 13 0 0 1-26 0c0-6 5-13 13-23z" /><path d="M18 30a6 6 0 0 0 6 6" /></>,
  bottle: <><path d="M21 13v-3a3 3 0 0 1 6 0v3" /><rect x="17" y="13" width="14" height="5" rx="1.5" /><path d="M18 18h12v20a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4zM18 26h4M18 32h4" /></>,
  sun: <><circle cx="24" cy="24" r="8" /><path d="M24 4v5M24 39v5M4 24h5M39 24h5M10 10l3.5 3.5M34.5 34.5L38 38M38 10l-3.5 3.5M13.5 34.5L10 38" /></>,
  sunrise: <path d="M6 36h36M13 36a11 11 0 0 1 22 0M24 12v6M11 21l3.5 3M37 21l-3.5 3M17 42h14" />,
  moon: <><path d="M36 31A15 15 0 1 1 19 9a12 12 0 0 0 17 22z" /><path d="M37 7v6M34 10h6" /></>,
  stroller: <><path d="M10 22a14 14 0 0 1 14-14v14z" /><path d="M7 22h31a12 12 0 0 1-12 12h-7A12 12 0 0 1 7 22zM38 22l3-8h4M19 34l-4 4M27 34l4 4" /><circle cx="14" cy="40" r="3" /><circle cx="33" cy="40" r="3" /></>,
  bath: <><path d="M6 24h36v4a10 10 0 0 1-10 10H16A10 10 0 0 1 6 28zM12 24V12a4 4 0 0 1 8 0M14 38l-2 4M34 38l2 4" /><circle cx="27" cy="16" r="2.5" /><circle cx="34" cy="11" r="3" /><circle cx="35" cy="19" r="2" /></>,
  book: <path d="M24 12c-4-3-10-4-18-3v26c8-1 14 0 18 3 4-3 10-4 18-3V9c-8-1-14 0-18 3zM24 12v26" />,
  sofa: <><path d="M8 22v-6a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v6" /><path d="M4 26a4 4 0 0 1 8 0v4h24v-4a4 4 0 0 1 8 0v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM10 36v4M38 36v4" /></>,
  broom: <><path d="M36 5L23 25" /><path d="M17 23l11 7-4 12c-7 0-13-4-16-9z" /><path d="M14 35l6 3M19 41l3-6" /></>,
  calendar: <><rect x="6" y="9" width="36" height="33" rx="5" /><path d="M6 19h36M15 5v8M33 5v8" /><path d="M16 28h.01M24 28h.01M32 28h.01M16 35h.01M24 35h.01" strokeWidth="3.4" /></>,
  check: <><rect x="6" y="6" width="36" height="36" rx="10" /><path d="M15 24l6 6 12-13" /></>,
  star: <path d="M24 5l5.6 11.6 12.6 1.8-9.1 8.9 2.2 12.6L24 34l-11.3 5.9 2.2-12.6-9.1-8.9 12.6-1.8z" />,
  utensils: <path d="M14 5v12a5 5 0 0 0 10 0V5M19 5v38M34 43V5c-5 3-7 9-7 15v6h7" />,
  photo: <><rect x="5" y="9" width="38" height="30" rx="5" /><circle cx="16" cy="19" r="4" /><path d="M5 34l11-10 9 8 6-5 12 10" /></>,
  list: <><path d="M18 12h24M18 24h24M18 36h24" /><circle cx="8" cy="12" r="2.5" /><circle cx="8" cy="24" r="2.5" /><circle cx="8" cy="36" r="2.5" /></>,
  music: <><path d="M18 36V10l24-5v26" /><circle cx="12" cy="36" r="6" /><circle cx="36" cy="31" r="6" /><path d="M18 17l24-5" /></>,
  gear: <><circle cx="24" cy="24" r="6" /><path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M38.1 9.9l-4.2 4.2M14.1 33.9l-4.2 4.2" /><circle cx="24" cy="24" r="13" /></>,
} satisfies Record<string, ReactNode>

const UI = {
  'chevron-left': <path d="M15 5l-7 7 7 7" />,
  'chevron-right': <path d="M9 5l7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  tick: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  unlock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.5-2" /></>,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  play: <path d="M7 4l14 8-14 8z" fill="currentColor" />,
  pause: <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" stroke="none" />,
  prev: <path d="M6 5h2v14H6zM20 5v14L9 12z" fill="currentColor" stroke="none" />,
  next: <path d="M16 5h2v14h-2zM4 5v14l11-7z" fill="currentColor" stroke="none" />,
  'star-solid': <path d="M12 3l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L2.9 9.7l6.3-.9z" fill="currentColor" />,
  'star-outline': <path d="M12 3l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L2.9 9.7l6.3-.9z" />,
  backspace: <><path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" /><path d="M12 9l6 6M18 9l-6 6" /></>,
  'queue-add': <path d="M4 6h12M4 12h12M4 18h7M18 14v7M14.5 17.5h7" />,
  'play-next': <><path d="M4 6h16M4 12h9M4 18h9" /><path d="M16 14l5 3-5 3z" fill="currentColor" /></>,
  shuffle: <path d="M3 7h3l11 10h4M3 17h3l3-2.7M14 9.5L17 7h4M18 4l3 3-3 3M18 14l3 3-3 3" />,
  repeat: <path d="M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3" />,
  heart: <path d="M12 20s-7-4.4-9-8.6C1.6 8.4 3.4 5 6.8 5c2 0 3.4 1.2 5.2 3 1.8-1.8 3.2-3 5.2-3 3.4 0 5.2 3.4 3.8 6.4-2 4.2-9 8.6-9 8.6z" />,
  'heart-solid': <path d="M12 20s-7-4.4-9-8.6C1.6 8.4 3.4 5 6.8 5c2 0 3.4 1.2 5.2 3 1.8-1.8 3.2-3 5.2-3 3.4 0 5.2 3.4 3.8 6.4-2 4.2-9 8.6-9 8.6z" fill="currentColor" />,
  speaker: <><rect x="6" y="3" width="12" height="18" rx="3" /><circle cx="12" cy="14" r="3" /><path d="M12 7h.01" /></>,
  refresh: <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'arrow-up': <path d="M12 19V5M6 11l6-6 6 6" />,
  'chevron-up': <path d="M5 15l7-7 7 7" />,
  grip: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth="3.2" />,
  queue: <path d="M4 6h16M4 12h16M4 18h10" />,
} satisfies Record<string, ReactNode>

export type IllustrationName = keyof typeof ILLUSTRATION
export type UiIconName = keyof typeof UI
export type IconName = IllustrationName | UiIconName

interface IconProps {
  name: IconName
  size?: number
  /** Stroke width in the icon's own grid units. */
  stroke?: number
  className?: string
  style?: CSSProperties
  /** Give a label only when the icon is the sole content of something meaningful. */
  label?: string
}

export function Icon({ name, size = 24, stroke, className, style, label }: IconProps) {
  const isUi = name in UI
  const body = isUi ? UI[name as UiIconName] : ILLUSTRATION[name as IllustrationName]
  const vb = isUi ? 24 : 48
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vb} ${vb}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke ?? 2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {body}
    </svg>
  )
}
