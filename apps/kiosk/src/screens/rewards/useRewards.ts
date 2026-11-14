import { useCallback, useMemo } from 'react'
import {
  useDecideRedemption,
  useLedger,
  useMembers,
  usePendingRedemptions,
  useRedeem,
  useRewardDeal,
  useRewards as useRewardsQuery,
  useToggleWishlist,
  useWishlist,
} from '../../data/hooks'
import { useLive } from '../../data/live'
import type { Member, Reward, RewardDeal } from '../../types'

/**
 * Star Shop state over Supabase. Balance is always the sum of the ledger.
 * Buying inserts a redemption (a trigger holds the stars); declining refunds
 * via another trigger. Approve only flips status.
 */
export function useRewards() {
  const membersQ = useMembers()
  const rewardsQ = useRewardsQuery()
  const ledgerQ = useLedger()
  const pendingQ = usePendingRedemptions()
  const dealQ = useRewardDeal()
  const wishlistQ = useWishlist()
  useLive('points_ledger', 'ledger')
  useLive('reward_redemptions', 'redemptions', 'ledger')
  useLive('reward_deals', 'rewardDeal')
  useLive('rewards', 'rewards')

  const redeem = useRedeem()
  const decide = useDecideRedemption()
  const wishMut = useToggleWishlist()

  const members = membersQ.data ?? []
  const rewards = rewardsQ.data ?? []
  const ledger = ledgerQ.data ?? []
  const pending = pendingQ.data ?? []
  const wishlist = wishlistQ.data ?? {}

  const ready = Boolean(membersQ.data && rewardsQ.data && ledgerQ.data && pendingQ.data)

  const balance = useCallback(
    (memberId: string) => ledger.filter((l) => l.memberId === memberId).reduce((n, l) => n + l.delta, 0),
    [ledger],
  )
  const earnedThisWeek = useCallback(
    (memberId: string) =>
      ledger
        .filter((l) => l.memberId === memberId && l.delta > 0 && l.when !== 'Last week')
        .reduce((n, l) => n + l.delta, 0),
    [ledger],
  )

  const dealRow = dealQ.data
  const price = useCallback(
    (r: Reward) => (dealRow && r.id === dealRow.rewardId ? dealRow.cost : r.cost),
    [dealRow],
  )

  const deal = useMemo(() => {
    if (!dealRow) return null
    const reward = rewards.find((r) => r.id === dealRow.rewardId)
    if (!reward) return null
    return { ...dealRow, reward } satisfies RewardDeal & { reward: Reward }
  }, [dealRow, rewards])

  const buy = useCallback(
    (memberId: string, reward: Reward) => {
      const cost = price(reward)
      redeem.mutate({ memberId, rewardId: reward.id, cost })
      return { id: `pending-${Date.now()}`, memberId, rewardId: reward.id, cost }
    },
    [price, redeem],
  )

  const approve = useCallback(
    (id: string) => decide.mutate({ id, status: 'approved' }),
    [decide],
  )

  const decline = useCallback(
    (id: string) => decide.mutate({ id, status: 'denied' }),
    [decide],
  )

  const toggleWish = useCallback(
    (memberId: string, rewardId: string) => wishMut.mutate({ memberId, rewardId }),
    [wishMut],
  )

  const shoppers: Member[] = useMemo(() => members.filter((m) => m.earnsPoints), [members])

  return {
    ready,
    members,
    shoppers,
    rewards,
    ledger,
    pending,
    wishlist,
    deal,
    balance,
    earnedThisWeek,
    price,
    buy,
    approve,
    decline,
    toggleWish,
  }
}
