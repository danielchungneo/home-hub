import { useState } from 'react'
import { useNav } from '../app/nav'
import { AppShell, PageHeader } from '../components/AppShell'
import { Button } from '../components/Button'
import { Avatar, IconTile, Label, Panel } from '../components/primitives'
import { useDecideRedemption, useLedger, useMembers, usePendingRedemptions, useRedeem, useRewards } from '../data/hooks'
import { useLive } from '../data/live'
import type { LedgerEntry, Member, Redemption } from '@hub/shared'
import type { Reward } from '../lib/types'
import s from './Rewards.module.css'

export default function Rewards() {
  const members = useMembers()
  const rewards = useRewards()
  const ledger = useLedger()
  const pending = usePendingRedemptions()
  useLive('points_ledger', 'ledger')
  useLive('reward_redemptions', 'redemptions')

  if (!members.data || !rewards.data || !ledger.data || !pending.data) return <AppShell>{null}</AppShell>
  return <RewardsView members={members.data} rewards={rewards.data} ledger={ledger.data} pending={pending.data} />
}

function RewardsView({ members, rewards, ledger, pending }: {
  members: Member[]; rewards: Reward[]; ledger: LedgerEntry[]; pending: Redemption[]
}) {
  const { requirePin } = useNav()
  const redeem = useRedeem()
  const decide = useDecideRedemption()
  const earners = members.filter((m) => m.earnsPoints)
  const nonEarners = members.filter((m) => !m.earnsPoints)
  const [selected, setSelected] = useState(earners[0].id)

  // Balance is always derived from the ledger, never stored (design doc §2.3).
  const balance = (id: string) => ledger.filter((l) => l.memberId === id).reduce((sum, l) => sum + l.delta, 0)
  const thisWeek = (id: string) => ledger.filter((l) => l.memberId === id && l.delta > 0 && l.when !== 'Last week').reduce((sum, l) => sum + l.delta, 0)
  const sel = earners.find((m) => m.id === selected)!

  const approve = (r: Redemption) => {
    const reward = rewards.find((x) => x.id === r.rewardId)!
    const member = members.find((m) => m.id === r.memberId)!
    requirePin({
      title: `To approve ${member.name}’s reward`,
      detail: `${reward.title} · ${reward.cost} points`,
      onSuccess: () => decide.mutate({ id: r.id, status: 'approved' }),
    })
  }

  return (
    <AppShell>
      <PageHeader title="Rewards" actions={<Button variant="rail" size="lg" pill icon="lock">Edit rewards</Button>} />

      {pending.map((r) => {
        const reward = rewards.find((x) => x.id === r.rewardId)!
        const member = members.find((m) => m.id === r.memberId)!
        return (
          <div key={r.id} data-color={member.color} className={`${s.request} anim-pop`} role="status">
            <IconTile icon={reward.icon} color={reward.color} size={60} />
            <div className={s.requestText}>
              <span className={s.requestEyebrow}>Waiting for a parent</span>
              <span className={s.requestTitle}>{member.name} wants “{reward.title}” · {reward.cost} points</span>
            </div>
            <Button variant="secondary" size="lg" onClick={() => decide.mutate({ id: r.id, status: 'denied' })}>Not now</Button>
            <Button size="lg" icon="lock" onClick={() => approve(r)}>Approve with PIN</Button>
          </div>
        )
      })}

      <div className={s.body}>
        <section className={s.side} aria-label="Points balances">
          {earners.map((m) => (
            <button key={m.id} type="button" data-color={m.color} aria-pressed={m.id === selected}
              className={m.id === selected ? `${s.balance} ${s.balanceOn}` : s.balance} onClick={() => setSelected(m.id)}>
              <Avatar initial={m.initial} color={m.color} />
              <span className={s.balanceWho}>
                <span className={s.balanceName}>{m.name}</span>
                <span className={s.balanceWeek}>+{thisWeek(m.id)} this week</span>
              </span>
              <span className={s.balanceNum}>
                <span className={s.balanceValue}>{balance(m.id)}</span>
                <Label>points</Label>
              </span>
            </button>
          ))}
          {nonEarners.map((m) => (
            <div key={m.id} className={s.notYet}>
              <Avatar initial={m.initial} color={m.color} muted />
              <span>{m.name}’s points turn on in Settings once he’s ready for chores.</span>
            </div>
          ))}
          <Panel pad="sm" className={s.history}>
            <Label>{sel.name}’s history</Label>
            {ledger.filter((l) => l.memberId === selected && l.when !== 'Last week').slice(0, 6).map((l) => (
              <div key={l.id} className={s.ledgerRow}>
                <span className={s.ledgerText}>
                  <span className={s.ledgerReason}>{l.reason}</span>
                  <span className={s.ledgerWhen}>{l.when}</span>
                </span>
                <span className={l.delta >= 0 ? s.plus : s.minus}>{l.delta >= 0 ? `+${l.delta}` : `−${-l.delta}`}</span>
              </div>
            ))}
          </Panel>
        </section>

        <Panel className={s.catalog} aria-label="Reward catalog">
          <div className={s.catalogHead}>
            <h2 className={s.h2}>Treat yourself</h2>
            <span className={s.catalogMeta}>Redeeming for {sel.name} · {balance(selected)} points</span>
          </div>
          <div className={s.grid}>
            {rewards.map((r) => {
              const need = r.cost - balance(selected)
              return (
                <div key={r.id} data-color={r.color} className={s.reward}>
                  <span className={s.rewardArt}><IconTile icon={r.icon} color={r.color} size={112} /></span>
                  <span className={s.rewardHead}>
                    <span className={s.rewardTitle}>{r.title}</span>
                    <span className={s.rewardCost}>{r.cost}</span>
                  </span>
                  {need <= 0
                    ? <Button block onClick={() => redeem.mutate({ memberId: selected, rewardId: r.id })}>Redeem</Button>
                    : <Button block variant="secondary" disabled>{need} more points</Button>}
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
    </AppShell>
  )
}
