import { useState } from 'react'
import { Icon } from './Icon'
import s from './SoftKeyboard.module.css'

/**
 * On-screen keyboard for the wall kiosk. Chromium in cage has no OS soft
 * keyboard, so text fields (search) need an in-app pad — same idea as the PIN
 * dialog's number pad.
 */

const ALPHA = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

const NUMERIC = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['-', "'", '.', ',', '&', '!', '?', '(', ')'],
  ['@', '#', ':', ';', '/', '"', '_', '+'],
]

export function SoftKeyboard({
  value,
  onChange,
  onDone,
}: {
  value: string
  onChange: (next: string) => void
  onDone: () => void
}) {
  const [mode, setMode] = useState<'alpha' | 'num'>('alpha')
  const rows = mode === 'alpha' ? ALPHA : NUMERIC

  return (
    <div className={s.root} role="group" aria-label="On-screen keyboard">
      {rows.map((row, i) => (
        <div key={i} className={s.row}>
          {i === 1 && <span className={s.spacer} aria-hidden />}
          {row.map((k) => (
            <button key={k} type="button" className={s.key} onClick={() => onChange(value + k)}>
              {k}
            </button>
          ))}
          {i === 2 && (
            <button type="button" className={`${s.key} ${s.action}`} aria-label="Backspace" onClick={() => onChange(value.slice(0, -1))}>
              <Icon name="backspace" size={28} stroke={2} />
            </button>
          )}
          {i === 1 && <span className={s.spacer} aria-hidden />}
        </div>
      ))}
      <div className={s.row}>
        <button
          type="button"
          className={`${s.key} ${s.action}`}
          aria-label={mode === 'alpha' ? 'Show numbers and symbols' : 'Show letters'}
          onClick={() => setMode((m) => (m === 'alpha' ? 'num' : 'alpha'))}
        >
          {mode === 'alpha' ? '123' : 'ABC'}
        </button>
        <button type="button" className={`${s.key} ${s.space}`} aria-label="Space" onClick={() => onChange(value + ' ')}>
          space
        </button>
        <button type="button" className={`${s.key} ${s.action}`} disabled={!value} onClick={() => onChange('')}>
          Clear
        </button>
        <button type="button" className={`${s.key} ${s.done}`} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}
