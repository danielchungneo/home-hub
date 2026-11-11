import { useEffect, useState } from 'react'
import type { PinRequest } from '../app/nav'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { useVerifyParentPin } from '../data/hooks'
import s from './PinDialog.module.css'

export default function PinDialog({ request, onClose }: { request: PinRequest; onClose: () => void }) {
  const verify = useVerifyParentPin()
  const [pin, setPin] = useState('')
  const [approved, setApproved] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPin('')
    setApproved(false)
    setWrong(false)
    setBusy(false)
  }, [request.title, request.detail, request.captureOnly])

  const press = (k: string) => {
    if (busy) return
    if (k === 'del') {
      setWrong(false)
      setPin((p) => p.slice(0, -1))
      return
    }
    if (k === 'cancel') {
      onClose()
      return
    }
    setWrong(false)
    const next = (pin + k).slice(0, 4)
    setPin(next)
    if (next.length === 4) {
      if (request.captureOnly) {
        setApproved(true)
        request.onSuccess(next)
        return
      }
      setBusy(true)
      void verify.mutateAsync(next)
        .then((ok) => {
          if (ok) {
            setApproved(true)
            request.onSuccess(next)
          } else {
            setWrong(true)
            setPin('')
          }
        })
        .catch((err: unknown) => {
          console.error('[hub] PIN verify failed', err)
          setWrong(true)
          setPin('')
        })
        .finally(() => setBusy(false))
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
            <div
              className={wrong ? `${s.dots} ${s.dotsWrong}` : s.dots}
              aria-live="polite"
              aria-label={wrong ? 'Incorrect PIN' : `${pin.length} of 4 digits entered`}
            >
              {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? `${s.dot} ${s.dotOn}` : s.dot} />)}
            </div>
            {wrong && <p className={s.wrong} role="alert">That PIN doesn’t match. Try again.</p>}
            <div className={s.pad}>
              {keys.map((k) => {
                const digit = /\d/.test(k)
                return (
                  <button key={k} type="button" className={digit ? `${s.key} ${s.digit}` : s.key}
                    disabled={busy}
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
