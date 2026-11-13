import { useEffect, useRef, useState } from 'react'
import { useNav } from '../../app/nav'
import { AppShell, PageHeader } from '../../components/AppShell'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { MemberBlobAvatar } from '../../components/MemberBlobAvatar'
import type { BlobAnimation } from '../../components/BlobAvatar'
import { Label } from '../../components/primitives'
import { useCountUp } from '../../hooks/useCountUp'
import { memberColorProps } from '../../lib/colors'
import type { Reward, RewardAisle } from '../../types'
import { ProductSheet, Star } from './ProductSheet'
import { StockShop } from './StockShop'
import { useRewards } from './useRewards'
import s from './Rewards.module.css'

type Aisle = 'all' | RewardAisle | 'afford'
const AISLES: { id: Aisle; label: string }[] = [
  { id: 'all', label: 'Everything' }, { id: 'Treats', label: 'Treats' }, { id: 'Time off', label: 'Time off' },
  { id: 'Family fun', label: 'Family fun' }, { id: 'afford', label: 'I can afford' },
]
const PER_SHELF = 4
const STARS_PER_JAR_STAR = 20
const JAR = [[4, 0, -20], [30, 0, 12], [54, 0, -6], [16, 22, 24], [42, 22, -14], [4, 44, 8], [28, 44, -24], [52, 44, 16], [16, 66, -4], [40, 66, 20]]

export default function Rewards() {
  const { requirePin } = useNav()
  const shop = useRewards()
  const { rewards, balance, price, deal, shoppers, members } = shop
  const [whoId, setWhoId] = useState<string | null>(null)
  const [aisle, setAisle] = useState<Aisle>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [stocking, setStocking] = useState(false)
  const [leaving, setLeaving] = useState<Record<string, 'approved' | 'declined'>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [shopperMotion, setShopperMotion] = useState<BlobAnimation>('idle')
  const [shopperMotionKey, setShopperMotionKey] = useState(0)
  const [celebrateId, setCelebrateId] = useState<string | null>(null)
  const [celebrateKey, setCelebrateKey] = useState(0)
  const walletRef = useRef<HTMLSpanElement>(null)
  const timers = useRef<number[]>([])
  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }
  const bumpShopper = (motion: BlobAnimation) => {
    setShopperMotion(motion)
    setShopperMotionKey((n) => n + 1)
  }
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])
  useEffect(() => { const r = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(r) }, [])
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])
  useEffect(() => {
    if (!shoppers.length) return
    setWhoId((id) => (id && shoppers.some((m) => m.id === id) ? id : shoppers[0].id))
  }, [shoppers])

  if (!shop.ready || !whoId) return <AppShell>{null}</AppShell>

  const me = shoppers.find((m) => m.id === whoId) ?? shoppers[0]
  const partnerOf = (id: string) => shoppers.find((m) => m.id !== id) ?? me
  const bal = balance(me.id)
  const wish = rewards.find((r) => r.id === shop.wishlist[me.id])
  const affordable = rewards.filter((r) => price(r) <= bal)
  const list = rewards.filter((r) => aisle === 'all' || (aisle === 'afford' ? price(r) <= bal : r.aisle === aisle))
  const shelves = Array.from({ length: Math.ceil(list.length / PER_SHELF) }, (_, i) => list.slice(i * PER_SHELF, i * PER_SHELF + PER_SHELF))
  const open = openId ? rewards.find((r) => r.id === openId) : undefined
  const receipt = shop.ledger.filter((l) => l.memberId === me.id && l.when !== 'Last week')

  const approve = (id: string) => {
    const r = shop.pending.find((x) => x.id === id)!
    const reward = rewards.find((x) => x.id === r.rewardId)!
    const buyer = members.find((m) => m.id === r.memberId)!
    requirePin({
      title: `To approve ${buyer.name}’s reward`,
      detail: `${reward.title} · ${r.cost} stars`,
      onSuccess: () => {
        setLeaving((l) => ({ ...l, [id]: 'approved' }))
        setCelebrateId(buyer.id)
        setCelebrateKey((n) => n + 1)
        if (buyer.id === whoId) bumpShopper('celebrate')
        later(1300, () => { shop.approve(id); setToast(`${buyer.name}’s ${reward.title.toLowerCase()} is approved. Enjoy!`) })
      },
    })
  }
  const decline = (id: string) => {
    setLeaving((l) => ({ ...l, [id]: 'declined' }))
    later(450, () => { shop.decline(id); setToast('Not now. The stars went back to the wallet.') })
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Rewards · spend the stars you earn"
        title="The Star Shop"
        actions={<>
          <Label>Shopping as</Label>
          <div role="group" aria-label="Shopping as" className={s.shoppers}>
            {shoppers.map((m) => (
              <button key={m.id} type="button" {...memberColorProps(m.color)} aria-pressed={m.id === me.id} className={s.shopper} onClick={() => setWhoId(m.id)}>
                <span className={s.shopperAvatar}>
                  <MemberBlobAvatar
                    memberId={m.id}
                    size={40}
                    showBackground={false}
                    decorative
                    animation={m.id === me.id ? shopperMotion : m.id === celebrateId ? 'celebrate' : 'idle'}
                    animationKey={m.id === me.id ? shopperMotionKey : m.id === celebrateId ? celebrateKey : 0}
                  />
                </span>
                <span className={s.shopperText}>
                  <span className={s.shopperName}>{m.name}</span>
                  <span className={s.shopperStars}><Star size={13} />{balance(m.id)} stars</span>
                </span>
              </button>
            ))}
          </div>
          <Button
            variant="rail"
            size="lg"
            pill
            icon="lock"
            onClick={() => requirePin({ title: 'To stock the shop', onSuccess: () => setStocking(true) })}
          >
            Stock the shop
          </Button>
        </>}
      />

      <div className={s.body}>
        <div className={s.main}>
          {/* ---------- Wallet (re-keyed per shopper so it fills up again) ---------- */}
          <section key={me.id} {...memberColorProps(me.color)} className={s.wallet} aria-label={`${me.name}’s stars`}>
            <span className={s.jar} aria-hidden="true">
              <svg width="132" height="148" viewBox="0 0 132 148" className={s.jarSvg}>
                <rect x="34" y="6" width="64" height="16" rx="5" className={s.jarLid} />
                <path d="M30 26h72a10 10 0 0 1 10 10v94a14 14 0 0 1-14 14H34a14 14 0 0 1-14-14V36a10 10 0 0 1 10-10z" className={s.jarGlass} />
              </svg>
              <span className={s.jarStars}>
                {JAR.slice(0, Math.min(JAR.length, Math.round(bal / STARS_PER_JAR_STAR))).map(([x, b, r], i) => (
                  <span key={i} className={s.jarStar} style={{ left: x, bottom: b, ['--r' as string]: `${r}deg`, ['--n' as string]: i }}><Star size={30} /></span>
                ))}
              </span>
            </span>
            <div className={s.balance}>
              <span className={s.walletKicker}>{me.name}’s stars</span>
              <span className={s.balanceRow}>
                <WalletNumber value={bal} refEl={walletRef} />
                <span className={s.balanceStar}><Star size={40} /></span>
              </span>
              <span className={s.week}>+{shop.earnedThisWeek(me.id)} earned this week</span>
            </div>
            <span className={s.walletRule} />
            <div className={s.goal}>
              <span className={s.goalArt}>
                <Icon name={wish?.icon ?? 'star'} size={54} stroke={2.2} />
                {wish && <span className={s.goalHeart}><Icon name="heart-solid" size={16} /></span>}
              </span>
              <span className={s.goalText}>
                <Label>Saving for</Label>
                <span className={s.goalTitle}>{wish?.title ?? 'Tap ♥ on a reward to save for it'}</span>
                {wish && <>
                  <span className={s.goalTrack}><span className={s.goalFill} style={{ transform: `scaleX(${ready ? Math.min(1, bal / price(wish)) : 0})` }} /></span>
                  <span className={bal >= price(wish) ? `${s.goalLine} ${s.goalReady}` : s.goalLine}>
                    {bal >= price(wish) ? 'You have enough. Treat yourself!' : weeksLine(price(wish) - bal, shop.earnedThisWeek(me.id))}
                  </span>
                </>}
              </span>
            </div>
          </section>

          {/* ---------- Aisles ---------- */}
          <div className={s.aisleRow}>
            <div role="group" aria-label="Shop aisles" className={s.aisles}>
              {AISLES.map((a) => (
                <button key={a.id} type="button" aria-pressed={a.id === aisle} className={s.aisle} onClick={() => setAisle(a.id)}>
                  {a.label}
                  <span className={s.aisleCount}>{rewards.filter((r) => a.id === 'all' || (a.id === 'afford' ? price(r) <= bal : r.aisle === a.id)).length}</span>
                </button>
              ))}
            </div>
            <span className={s.affordLine}><span className={s.affordDot} />
              {affordable.length ? `You can afford ${affordable.length} thing${affordable.length > 1 ? 's' : ''} right now` : 'Keep going, almost there!'}
            </span>
          </div>

          {/* ---------- Shelves (re-keyed so items drop back in) ---------- */}
          <section key={`${me.id}-${aisle}`} className={`${s.shelves} scroll-y`} aria-label="Rewards">
            {shelves.map((row, si) => (
              <div key={si} className={s.shelf}>
                <div className={s.shelfItems}>
                  {row.map((r, i) => (
                    <ShopItem key={r.id} reward={r} price={price(r)} balance={bal} isDeal={Boolean(deal && r.id === deal.rewardId)}
                      n={si * PER_SHELF + i} onOpen={() => setOpenId(r.id)} />
                  ))}
                </div>
                <span className={s.plank} aria-hidden="true" />
              </div>
            ))}
            {!shelves.length && <span className={s.emptyAisle}>Nothing here yet. Keep earning, it fills up fast.</span>}
          </section>
        </div>

        {/* ---------- Deal, approvals, receipt ---------- */}
        <aside className={s.side}>
          {deal && (
            <button type="button" className={s.deal} onClick={() => setOpenId(deal.rewardId)}>
              <span className={s.dealGlow} aria-hidden="true" />
              <span className={s.dealArt}><Icon name={deal.reward.icon} size={64} stroke={2.2} /></span>
              <span className={s.dealText}>
                <span className={s.dealKicker}>Deal of the week · ends {deal.ends}</span>
                <span className={s.dealTitle}>{deal.reward.title}</span>
                <span className={s.dealPrice}><Star size={18} />{deal.cost}<s className={s.was}>{deal.reward.cost}</s><span className={s.save}>Save {deal.reward.cost - deal.cost}</span></span>
              </span>
            </button>
          )}

          {shop.pending.map((p) => {
            const reward = rewards.find((r) => r.id === p.rewardId)!
            const buyer = members.find((m) => m.id === p.memberId)!
            const state = leaving[p.id]
            return (
              <section key={p.id} {...memberColorProps(buyer.color)} className={[s.ticket, state === 'declined' && s.ticketOut, state === 'approved' && s.ticketDone].filter(Boolean).join(' ')} aria-label="Waiting for approval">
                <span className={s.ticketTop}>
                  <span data-color={reward.color} className={s.ticketArt}><Icon name={reward.icon} size={32} stroke={2.2} /></span>
                  <span className={s.ticketText}>
                    <span className={s.ticketKicker}>{buyer.name} wants · waiting for {partnerOf(buyer.id).name}</span>
                    <span className={s.ticketTitle}>{reward.title} · {p.cost} stars</span>
                  </span>
                </span>
                {state === 'approved' ? <span className={s.approved}>Approved</span> : (
                  <span className={s.ticketActions}>
                    <Button variant="secondary" pill onClick={() => decline(p.id)}>Not now</Button>
                    <Button pill icon="lock" className={s.grow} onClick={() => approve(p.id)}>Approve with PIN</Button>
                  </span>
                )}
              </section>
            )
          })}

          <section key={me.id} className={s.receipt} aria-label={`${me.name}’s receipt`}>
            <span className={s.receiptHead}>
              <span className={s.receiptTitle}>{me.name}’s receipt</span>
              <Label>This week</Label>
            </span>
            <div className={`${s.receiptRows} scroll-y`}>
              {receipt.map((l, i) => (
                <div key={l.id} className={s.receiptRow} style={{ ['--n' as string]: i }}>
                  <span className={s.receiptText}><span className={s.receiptReason}>{l.reason}</span><span className={s.receiptWhen}>{l.when}</span></span>
                  <span className={l.delta >= 0 ? s.plus : s.minus}>{l.delta >= 0 ? `+${l.delta}` : `−${-l.delta}`}</span>
                </div>
              ))}
            </div>
            <span className={s.receiptTotal}>Balance <span className={s.receiptBal}>{bal}<Star size={20} /></span></span>
          </section>
        </aside>
      </div>

      {open && (
        <ProductSheet
          key={open.id}
          reward={open}
          price={price(open)}
          balance={bal}
          isDeal={Boolean(deal && open.id === deal.rewardId)}
          wished={shop.wishlist[me.id] === open.id}
          approver={partnerOf(me.id).name}
          shopperName={me.name}
          walletRef={walletRef}
          onWish={() => {
            const was = shop.wishlist[me.id] === open.id
            shop.toggleWish(me.id, open.id)
            if (!was) setToast(`Saving for ${open.title}. It’s on your wallet now.`)
          }}
          onBuy={() => { shop.buy(me.id, open); bumpShopper('hop') }}
          onClose={(bought) => { setOpenId(null); if (bought) setToast(`Sent to ${partnerOf(me.id).name} to approve`) }}
        />
      )}

      {stocking && (
        <StockShop
          rewards={rewards}
          onClose={() => setStocking(false)}
          onToast={setToast}
        />
      )}

      {toast && <div role="status" className={s.toast}><Icon name="tick" size={20} stroke={3} />{toast}</div>}
    </AppShell>
  )
}

function WalletNumber({ value, refEl }: { value: number; refEl: React.RefObject<HTMLSpanElement> }) {
  const shown = useCountUp(value)
  return <span ref={refEl} key={value} className={s.balanceNum} aria-live="polite">{shown}</span>
}

function weeksLine(need: number, perWeek: number) {
  const weeks = Math.max(1, Math.ceil(need / Math.max(perWeek, 1)))
  return `${need} more stars · about ${weeks} week${weeks > 1 ? 's' : ''} of chores`
}

/* ---------------- One item on the shelf ---------------- */

function ShopItem({ reward: r, price, balance, isDeal, n, onOpen }: {
  reward: Reward; price: number; balance: number; isDeal: boolean; n: number; onOpen: () => void
}) {
  const ready = price <= balance
  return (
    <div className={s.item} data-color={r.color} style={{ ['--n' as string]: n, ['--swing' as string]: n % 2 ? '4deg' : '-5deg' }}>
      <button type="button" className={s.card} onClick={onOpen}
        aria-label={`${r.title}, ${price} stars${ready ? '' : `, ${price - balance} more to go`}`}>
        <span className={s.art}>
          <Icon name={r.icon} size={76} stroke={2.2} />
          {ready && <span className={s.shine} aria-hidden="true" />}
          {ready && <span className={s.ribbon}>You can get this</span>}
          {isDeal && <span className={s.dealBadge}>Deal of the week</span>}
        </span>
        <span className={s.cardBody}>
          <span className={s.cardTitles}>
            <span className={s.cardAisle}>{r.aisle}</span>
            <span className={s.cardTitle}>{r.title}</span>
          </span>
          {ready
            ? <span className={s.leftAfter}><Icon name="tick" size={16} stroke={3} />{balance - price} stars left after</span>
            : <span className={s.saving}>
                <span className={s.savingTrack}><span className={s.savingFill} style={{ transform: `scaleX(${Math.min(1, balance / price)})` }} /></span>
                <span className={s.savingText}>{price - balance} more stars</span>
              </span>}
        </span>
      </button>
      <span className={ready ? `${s.tag} ${s.tagReady}` : s.tag} aria-hidden="true">
        <span className={s.string} />
        <span className={s.tagBody}><Star size={18} />{isDeal && <s className={s.tagWas}>{r.cost}</s>}{price}</span>
      </span>
    </div>
  )
}
