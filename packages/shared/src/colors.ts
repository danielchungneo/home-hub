/**
 * Person / accent colors for the hub.
 *
 * Named presets are CSS tokens (`data-color="moss"` …). Family / Home /
 * “Up for grabs” use the system-only `slate` token, which is never offered
 * in member pickers. Members may also store a custom `#RRGGBB` hex.
 */

/** Selectable named colors for people, lists, rewards, recipes. */
export const MEMBER_COLOR_PRESETS = [
  'moss',
  'clay',
  'honey',
  'fjord',
  'plum',
  'pine',
  'berry',
  'sand',
  'ocean',
  'rose',
] as const

export type MemberColor = (typeof MEMBER_COLOR_PRESETS)[number]

/** Shared identities only — Family, Home column, Up for grabs. Not in pickers. */
export const SYSTEM_COLOR = 'slate' as const
export type SystemColor = typeof SYSTEM_COLOR

export type ThemeColorToken = MemberColor | SystemColor

/** Labels for preset swatches in Profiles / Settings. */
export const MEMBER_COLOR_PRESET_OPTIONS: { value: MemberColor; label: string }[] = [
  { value: 'moss', label: 'Moss' },
  { value: 'clay', label: 'Clay' },
  { value: 'honey', label: 'Honey' },
  { value: 'fjord', label: 'Fjord' },
  { value: 'plum', label: 'Plum' },
  { value: 'pine', label: 'Pine' },
  { value: 'berry', label: 'Berry' },
  { value: 'sand', label: 'Sand' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'rose', label: 'Rose' },
]

/** Deep + tint hex for every named token (mirrors `tokens.css`). */
export const THEME_COLOR_HEX: Record<ThemeColorToken, { deep: string; tint: string }> = {
  moss: { deep: '#55623F', tint: '#E9EDE1' },
  clay: { deep: '#7D513C', tint: '#F3E7DF' },
  honey: { deep: '#735623', tint: '#F4ECDA' },
  fjord: { deep: '#4B6270', tint: '#E4EAEE' },
  plum: { deep: '#6E5A72', tint: '#EDE6F0' },
  pine: { deep: '#3F5E4A', tint: '#E2EBE5' },
  berry: { deep: '#7A4555', tint: '#F0E4E8' },
  sand: { deep: '#8A6F4B', tint: '#F2EBE0' },
  ocean: { deep: '#3E6B6A', tint: '#E2ECEB' },
  rose: { deep: '#8B5E5E', tint: '#F1E6E6' },
  slate: { deep: '#6B6560', tint: '#EBE8E4' },
}

const PRESET_SET = new Set<string>(MEMBER_COLOR_PRESETS)
const TOKEN_SET = new Set<string>([...MEMBER_COLOR_PRESETS, SYSTEM_COLOR])

const HEX_RE = /^#([0-9A-Fa-f]{6})$/

export function isMemberColorPreset(value: string): value is MemberColor {
  return PRESET_SET.has(value)
}

export function isThemeColorToken(value: string): value is ThemeColorToken {
  return TOKEN_SET.has(value)
}

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value)
}

/** Normalize to `#RRGGBB` or null. */
export function normalizeHexColor(value: string): string | null {
  const raw = value.trim()
  const withHash = raw.startsWith('#') ? raw : `#${raw}`
  if (!HEX_RE.test(withHash)) return null
  return withHash.toUpperCase()
}

/** Soft tint (~12% color + 88% white), matching the named palette style. */
export function tintFromHex(hex: string): string {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return THEME_COLOR_HEX.moss.tint
  const r = parseInt(normalized.slice(1, 3), 16)
  const g = parseInt(normalized.slice(3, 5), 16)
  const b = parseInt(normalized.slice(5, 7), 16)
  const mix = (c: number) => Math.round(c * 0.12 + 255 * 0.88)
  return `#${[mix(r), mix(g), mix(b)].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export function resolveThemeColor(color: string | null | undefined): { deep: string; tint: string; token?: ThemeColorToken } {
  const value = (color ?? 'moss').trim()
  if (isThemeColorToken(value)) {
    const pair = THEME_COLOR_HEX[value]
    return { deep: pair.deep, tint: pair.tint, token: value }
  }
  const hex = normalizeHexColor(value)
  if (hex) return { deep: hex, tint: tintFromHex(hex) }
  return { ...THEME_COLOR_HEX.moss, token: 'moss' }
}

/** Persistable person color: named preset or `#RRGGBB`. Rejects system `slate`. */
export function normalizePersonColor(value: string | null | undefined, fallback: MemberColor = 'plum'): string {
  const raw = (value ?? '').trim()
  if (isMemberColorPreset(raw)) return raw
  const hex = normalizeHexColor(raw)
  if (hex) return hex
  return fallback
}

/** Coerce a DB `member_color` (may include system `slate`) into a selectable preset. */
export function coerceMemberColor(value: string | null | undefined, fallback: MemberColor = 'fjord'): MemberColor {
  const raw = (value ?? '').trim()
  if (isMemberColorPreset(raw)) return raw
  return fallback
}
