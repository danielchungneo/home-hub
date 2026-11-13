import { useEffect, useRef, useState } from 'react'
import { IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { MemberBlobAvatar } from '../../components/MemberBlobAvatar'
import { leaveBy } from '../../lib/calendar'
import { memberColorProps } from '../../lib/colors'
import { hourLabel } from '../../lib/format'
import { who } from '../../lib/members'
import type { CalendarEvent } from '@hub/shared'
import s from './Calendar.module.css'

/** The event's box, relative to the grid panel. */
export interface Anchor { top: number; left: number; right: number; height: number; boxWidth: number; boxHeight: number }

const W = 420
const H_EST = 400
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Details card that grows out of the tapped event (transform-origin = the event's side). */
export function EventDetails({ event: e, anchor: a, onClose }: { event: CalendarEvent; anchor: Anchor; onClose: () => void }) {
  const [reminded, setReminded] = useState(false)
  const [ring, setRing] = useState(0)
  const [closing, setClosing] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])
  const w = who(e.who)

  const right = a.right + 10 + W <= a.boxWidth - 12
  const left = right ? a.right + 10 : Math.max(12, a.left - 10 - W)
  const top = Math.max(16, Math.min(a.top - 40, a.boxHeight - H_EST - 16))
  const originY = Math.max(24, a.top - top + Math.min(a.height, 60) / 2)
  const close = () => { setClosing(true); timer.current = window.setTimeout(onClose, 180) }

  return <>
    <div className={s.popScrim} onClick={close} />
    <div role="dialog" aria-label={e.title} {...memberColorProps(w.color, { left, top, width: W, transformOrigin: `${right ? 'left' : 'right'} ${originY}px` })} className={s.pop} data-closing={closing}>
      <div className={s.popHead}>
        <span className={s.popAvatar}>
          <MemberBlobAvatar memberId={w.id} size={52} showBackground={false} decorative />
        </span>
        <span className={s.popWho}>
          <span className={s.popKicker}>{w.name}</span>
          <span className={s.popWhen}>{DAY_LONG[e.day]} · {hourLabel(e.start)} – {hourLabel(e.end)}</span>
        </span>
        <IconButton variant="surface" icon="close" label="Close" onClick={close} />
      </div>
      <div className={s.popBody}>
        <span className={s.popTitle}>{e.title}</span>
        {e.where && <span className={s.popWhere}><PinIcon />{e.where}</span>}
        {e.travelMin && <span className={s.popLeave}><Icon name="car" size={20} stroke={3} />{leaveBy(e)}</span>}
        {e.note && <span className={s.popNote}>{e.note}</span>}
        <div className={s.popActions}>
          <button type="button" className={reminded ? `${s.remind} ${s.remindOn}` : s.remind}
            onClick={() => { setReminded((r) => !r); setRing((n) => n + 1) }}>
            <span key={ring} className={reminded ? s.bell : s.bellIdle}><BellIcon /></span>
            {reminded ? 'Reminder set · 30 min before' : 'Remind me'}
          </button>
          <button type="button" className={s.edit}>Edit</button>
        </div>
      </div>
    </div>
  </>
}

function PinIcon() {
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
}
function BellIcon() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" /></svg>
}
