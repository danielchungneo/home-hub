import { useEffect, useRef, useState } from 'react'
import { IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import type { Reward } from '../../types'
import s from './ProductSheet.module.css'

/** The shop's star glyph (filled gold). Content color, like artwork. */
export function Star({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={s.star}>
      <path d="M12 3l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L2.9 9.7l6.3-.9z" />
    </svg>
  )
}

type Phase = 'details' | 'paying' | 'receipt'
const FLYERS = 7
const PAY_MS = 520      // stars land → the ledger row is written and the wallet counts down
const RECEIPT_MS = 900  // details swap for the receipt
const SPARKLES: [number, number, number, number][] = [[60, 70, 34, -10], [400, 90, 26, 20], [90, 470, 28, 12], [420, 500, 40, -16], [250, 40, 22, 30], [30, 280, 20, 0], [460, 300, 24, 18]]

interface Flight { x: number; y: number; dx: number; dy: number }

/**
 * Product sheet: details → Buy → stars fly from the wallet to the button → the receipt prints.
 * `onClose(true)` after a purchase so the screen can toast "Sent to … to approve".
 */
export function ProductSheet({ reward: r, price, balance, isDeal, wished, approver, shopperName, walletRef, onWish, onBuy, onClose }: {
  reward: Reward; price: number; balance: number; isDeal: boolean; wished: boolean
  approver: string; shopperName: string; walletRef: React.RefObject<HTMLElement>
  onWish: () => void; onBuy: () => void; onClose: (bought: boolean) => void
}) {
  const [phase, setPhase] = useState<Phase>('details')
  const [flight, setFlight] = useState<Flight | null>(null)
  const [closing, setClosing] = useState(false)
  const [heart, setHeart] = useState(0)
  const [startBal] = useState(balance)
  const buyRef = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])
  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const ok = price <= startBal
  const paid = phase !== 'details'
  const after = paid ? startBal - price : ok ? balance - price : price - balance

  const close = () => { setClosing(true); later(250, () => onClose(phase === 'receipt')) }
  const buy = () => {
    if (!ok || phase !== 'details') return
    const from = walletRef.current?.getBoundingClientRect()
    const to = buyRef.current?.getBoundingClientRect()
    if (from && to) setFlight({ x: from.left + 20, y: from.top + 20, dx: to.left + to.width / 2 - from.left - 20, dy: to.top + to.height / 2 - from.top - 20 })
    setPhase('paying')
    later(PAY_MS, onBuy)
    later(RECEIPT_MS, () => { setPhase('receipt'); setFlight(null) })
  }

  return (
    <div className={s.layer} data-closing={closing}>
      <div className={s.scrim} onClick={close} />
      <section role="dialog" aria-modal="true" aria-label={r.title} data-color={r.color} className={s.sheet}>
        <div className={s.art}>
          {SPARKLES.map(([x, y, size, rot], i) => (
            <svg key={i} aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={s.sparkle}
              style={{ left: x, top: y, ['--r' as string]: `${rot}deg`, ['--n' as string]: i }}>
              <path d="M12 2c.6 5.4 2.6 7.4 8 8-5.4.6-7.4 2.6-8 8-.6-5.4-2.6-7.4-8-8 5.4-.6 7.4-2.6 8-8z" />
            </svg>
          ))}
          <span className={s.artTile}><Icon name={r.icon} size={160} stroke={2} /></span>
          {isDeal && <span className={s.dealBadge}>Deal of the week</span>}
        </div>

        <div className={s.side}>
          <IconButton size="lg" icon="close" label="Close" className={s.close} onClick={close} />

          {phase !== 'receipt' ? (
            <div className={phase === 'paying' ? `${s.details} ${s.detailsPaying}` : s.details}>
              <span className={s.aisle}>{r.aisle}</span>
              <span className={s.title}>{r.title}</span>
              <span className={s.blurb}>{r.blurb}</span>
              <span className={s.spacer} />
              <div className={s.maths}>
                <span className={s.term}><span className={s.termLabel}>You have</span><span className={s.termValue}>{startBal}</span></span>
                <span className={s.op}>−</span>
                <span className={s.term}><span className={s.termLabel}>Price</span><span className={s.termValue}>{price}</span></span>
                <span className={s.op}>=</span>
                <span className={ok ? `${s.term} ${s.good}` : `${s.term} ${s.short}`}>
                  <span className={s.termLabel}>{ok ? 'Left after' : 'Still need'}</span>
                  <span className={s.termValue}>{after}</span>
                </span>
              </div>
              <div className={s.actions}>
                <button type="button" aria-pressed={wished} className={wished ? `${s.wish} ${s.wishOn}` : s.wish}
                  onClick={() => { onWish(); setHeart((n) => n + 1) }}>
                  <span key={heart} className={heart ? s.heartPop : undefined}><Icon name={wished ? 'heart-solid' : 'heart'} size={24} /></span>
                  {wished ? 'Saving for this' : 'Save for this'}
                </button>
                <button ref={buyRef} type="button" className={s.buy} disabled={!ok || paid} onClick={buy}>
                  <Star size={24} />
                  {ok ? `Buy for ${price} stars` : `${price - balance} more stars to go`}
                </button>
              </div>
            </div>
          ) : (
            <div className={s.done}>
              <div className={s.slip}>
                <span className={s.slipShop}>The Star Shop</span>
                <span className={s.slipWho}>Receipt · {shopperName}</span>
                <span className={s.slipRule} />
                <span className={s.slipLine}><span>{r.title}</span><span>{price} ★</span></span>
                <span className={`${s.slipLine} ${s.slipMuted}`}><span>Stars left</span><span>{startBal - price} ★</span></span>
                <span className={s.slipRule} />
                <span className={s.stamp}>Waiting for {approver}</span>
                <span className={s.torn} aria-hidden="true" />
              </div>
              <span className={s.doneText}>{approver} gets a tap on their phone. Once it’s approved, it’s yours.</span>
              <button type="button" className={s.doneBtn} onClick={close}>Done</button>
            </div>
          )}
        </div>
      </section>

      {flight && Array.from({ length: FLYERS }, (_, i) => (
        <span key={i} aria-hidden="true" className={s.flyer}
          style={{ left: flight.x, top: flight.y, ['--dx' as string]: `${flight.dx + (i % 3) * 18 - 18}px`, ['--dy' as string]: `${flight.dy - (i % 2) * 20}px`, ['--n' as string]: i }}>
          <Star size={34} />
        </span>
      ))}
    </div>
  )
}
