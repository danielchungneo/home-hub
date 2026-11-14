import { useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  MEMBER_COLOR_PRESET_OPTIONS,
  isHexColor,
  isMemberColorPreset,
  normalizeHexColor,
  normalizePersonColor,
  resolveThemeColor,
} from '@hub/shared'
import { memberColorProps } from '../lib/colors'
import s from './ColorPicker.module.css'

type Props = {
  value: string
  onChange: (color: string) => void
  /** Accessible name for the preset group. */
  label?: string
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const n = normalizeHexColor(hex) ?? '#55623F'
  const r = parseInt(n.slice(1, 3), 16) / 255
  const g = parseInt(n.slice(3, 5), 16) / 255
  const b = parseInt(n.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  const s = max === 0 ? 0 : d / max
  return { h: h * 360, s, v: max }
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}

/**
 * Preset swatches plus a touch-friendly custom hue / saturation picker.
 * System `slate` is intentionally omitted.
 */
export function ColorPicker({ value, onChange, label = 'Color' }: Props) {
  const baseId = useId()
  const wheelRef = useRef<HTMLDivElement>(null)
  const resolved = resolveThemeColor(value)
  const customActive = isHexColor(value)
  const [open, setOpen] = useState(customActive)
  const hsv = useMemo(() => hexToHsv(resolved.deep), [resolved.deep])

  const pickPreset = (preset: string) => {
    onChange(preset)
    setOpen(false)
  }

  const pickCustom = (hex: string) => {
    const next = normalizePersonColor(hex, 'plum')
    onChange(next)
    setOpen(true)
  }

  const setFromWheel = (clientX: number, clientY: number) => {
    const el = wheelRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
    pickCustom(hsvToHex(hsv.h, x, 1 - y))
  }

  const onWheelPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromWheel(e.clientX, e.clientY)
  }

  const onWheelMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    setFromWheel(e.clientX, e.clientY)
  }

  return (
    <div className={s.root}>
      <div className={s.swatches} role="group" aria-label={label}>
        {MEMBER_COLOR_PRESET_OPTIONS.map((c) => {
          const on = isMemberColorPreset(value) && value === c.value
          return (
            <button
              key={c.value}
              type="button"
              {...memberColorProps(c.value)}
              aria-pressed={on}
              aria-label={c.label}
              className={on ? `${s.swatch} ${s.preset} ${s.swatchOn}` : `${s.swatch} ${s.preset}`}
              onClick={() => pickPreset(c.value)}
            />
          )
        })}
        <button
          type="button"
          aria-pressed={customActive}
          aria-label="Custom color"
          className={
            customActive
              ? `${s.swatch} ${s.custom} ${s.customFilled} ${s.swatchOn}`
              : `${s.swatch} ${s.custom}`
          }
          style={customActive ? { background: resolved.deep } : undefined}
          onClick={() => {
            setOpen(true)
            if (!customActive) pickCustom(resolved.deep)
          }}
        />
      </div>

      {open && (
        <div className={s.customPanel} aria-label="Custom color picker">
          <div
            ref={wheelRef}
            className={s.sv}
            style={{ backgroundColor: hsvToHex(hsv.h, 1, 1) }}
            onPointerDown={onWheelPointer}
            onPointerMove={onWheelMove}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.s * 100)}
            aria-label="Saturation and brightness"
          >
            <span
              className={s.svThumb}
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: resolved.deep }}
            />
          </div>

          <label className={s.hueRow} htmlFor={`${baseId}-hue`}>
            <span className="sr-only">Hue</span>
            <input
              id={`${baseId}-hue`}
              type="range"
              min={0}
              max={360}
              value={Math.round(hsv.h)}
              className={s.hue}
              aria-label="Hue"
              onChange={(e) => pickCustom(hsvToHex(Number(e.target.value), Math.max(hsv.s, 0.35), Math.max(hsv.v, 0.35)))}
            />
          </label>

          <label className={s.nativeRow} htmlFor={`${baseId}-native`}>
            <span className={s.nativeLabel}>Color wheel</span>
            <input
              id={`${baseId}-native`}
              type="color"
              value={normalizeHexColor(resolved.deep) ?? '#55623F'}
              className={s.native}
              aria-label="Pick a custom color"
              onChange={(e) => pickCustom(e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  )
}
