import { useState } from 'react'
import type { PinRequest } from '../app/nav'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import s from './PinDialog.module.css'

// TODO: compare against household_settings.parent_pin_hash (hash on the client, compare server-side).
const checkPin = (pin: string) => pin.length === 4

export default function PinDialog({ request, onClose }: { request: PinRequest; onClose: () => void }) {
  const [pin, setPin] = useState('')
  const [approved, setApproved] = useState(false)

  const press = (k: string) => {
    if (k === 'del') setPin((p) => p.slice(0, -1))
    else if (k === 'cancel') onClose()
    else {
      const next = (pin + k).slice(0, 4)
      setPin(next)
      if (next.length === 4 && checkPin(next)) {
        setApproved(true)
        request.onSuccess()
      }
    }
  }
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'cancel', '0', 'del']

  return (
    <div className={s.scrim}>
      <div role="dialog" aria-modal="true" aria-label="Parent PIN" className={s.dialog}>
        {approved ? (
          <>
            <span className={`${s.success} anim-pop`}><Icon name="tick" size={56} stroke={2.8} /></span>
            <div className={s.text}>
              <h1 className={s.title}>Approved</h1>
              {request.detail && <p className={s.detail}>{request.detail}</p>}
            </div>
            <Button size="xl" block onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <span className={s.lock}><Icon name="lock" size={32} stroke={2.2} /></span>
            <div className={s.text}>
              <h1 className={s.title}>Parent PIN</h1>
              <p className={s.detail}>{request.title}{request.detail && <><br /><strong>{request.detail}</strong></>}</p>
            </div>
            <div className={s.dots} aria-live="polite" aria-label={`${pin.length} of 4 digits entered`}>
              {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? `${s.dot} ${s.dotOn}` : s.dot} />)}
            </div>
            <div className={s.pad}>
              {keys.map((k) => {
                const digit = /\d/.test(k)
                return (
                  <button key={k} type="button" className={digit ? `${s.key} ${s.digit}` : s.key}
                    aria-label={k === 'del' ? 'Delete digit' : k === 'cancel' ? 'Cancel' : k} onClick={() => press(k)}>
                    {k === 'del' ? <Icon name="backspace" size={32} stroke={2} /> : k === 'cancel' ? 'Cancel' : k}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
