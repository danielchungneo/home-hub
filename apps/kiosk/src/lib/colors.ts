import type { CSSProperties } from 'react'
import { isThemeColorToken, normalizeHexColor, resolveThemeColor } from '@hub/shared'

/**
 * Apply a person/system color the Scandi Calm way:
 * - named tokens → `data-color` (CSS variables from tokens.css)
 * - custom `#RRGGBB` → inline `--member` / `--member-tint`
 */
export function memberColorProps(
  color: string | null | undefined,
  extraStyle?: CSSProperties,
): { 'data-color'?: string; style?: CSSProperties } {
  const value = color?.trim()
  if (!value) return extraStyle ? { style: extraStyle } : {}
  if (isThemeColorToken(value)) {
    return extraStyle ? { 'data-color': value, style: extraStyle } : { 'data-color': value }
  }
  const hex = normalizeHexColor(value)
  const resolved = resolveThemeColor(hex ?? 'moss')
  const style = {
    '--member': resolved.deep,
    '--member-tint': resolved.tint,
    ...extraStyle,
  } as CSSProperties
  return { style }
}
