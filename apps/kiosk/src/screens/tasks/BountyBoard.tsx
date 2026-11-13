import { useEffect, useRef, useState } from 'react'
import { IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { memberColorProps } from '../../lib/colors'
import { bountyDue } from '../../lib/tasks'
import type { Bounty, Member, TaskTemplate } from '../../types'
import s from './Tasks.module.css'

const TILTS = [-1.2, 0.8, -0.5, 1.1, -0.9, 0.6]
/** Lift (260ms) + fly to the person's list (560ms). Matches the claimFly keyframes. */
const CLAIM_MS = 820

/** Up-for-grabs tickets. Claiming flies the ticket over to the person's weekly list. */
export function BountyBoard({ bounties, members, member, today, template, onClaim, onAdd }: {
  bounties: Bounty[]; members: Member[]; member: Member; today: number; template: (id: string) => TaskTemplate
  onClaim: (bountyId: string) => void; onAdd: () => void
}) {
  const [flying, setFlying] = useState<string | null>(null)
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const open = bounties.filter((b) => !b.claimedBy)
  const claimed = bounties.filter((b) => b.claimedBy)
  const canClaim = member.earnsPoints

  const claim = (id: string) => {
    if (!canClaim || flying) return
    setFlying(id)
    timer.current = window.setTimeout(() => { setFlying(null); onClaim(id) }, CLAIM_MS)
  }

  return (
    <aside className={s.board} aria-label="Bounty board">
      <div className={s.boardHead}>
        <span className={s.boardTitles}>
          <span className={s.boardKicker}>Bounty board · {open.length} open</span>
          <span className={s.boardTitle}>Up for grabs</span>
          <span className={s.boardSub}>Whoever claims it gets the points.</span>
        </span>
        <IconButton variant="surface" icon="plus" label="Add a bounty" onClick={onAdd} />
      </div>
      <ul className={`${s.tickets} scroll-y`}>
        {[...open, ...claimed].map((b, i) => {
          const tpl = template(b.templateId)
          const who = b.claimedBy ? members.find((m) => m.id === b.claimedBy) : undefined
          return (
            <li key={b.id} {...memberColorProps(who?.color, { ['--tilt' as string]: `${TILTS[i % TILTS.length]}deg` })}
              className={[s.ticket, who && s.ticketTaken, flying === b.id && s.ticketFlying].filter(Boolean).join(' ')}>
              <span className={s.pin} aria-hidden="true" />
              <span className={s.ticketTile}><Icon name={tpl.icon} size={36} stroke={2.2} /></span>
              <span className={s.ticketText}>
                <span className={s.ticketTitle}>{tpl.title}</span>
                <span className={s.ticketDue}>{bountyDue(b.dueDay, today)}</span>
              </span>
              {who ? (
                <span className={s.stamp}>{who.name} claimed</span>
              ) : (
                <span className={s.ticketSide}>
                  <span className={s.ticketPts}><Icon name="star-solid" size={20} className={s.star} />{b.points}</span>
                  <button type="button" className={s.claim} {...memberColorProps(member.color)} disabled={!canClaim} onClick={() => claim(b.id)}>
                    {canClaim ? `Claim for ${member.name}` : 'Pick a grown-up'}
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
