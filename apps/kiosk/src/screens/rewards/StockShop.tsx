import { useEffect, useRef, useState } from 'react'
import { Button, IconButton } from '../../components/Button'
import { Icon, type IconName } from '../../components/Icon'
import { SoftKeyboard } from '../../components/SoftKeyboard'
import { useCreateReward, useDeleteReward, useUpdateReward, type RewardInput } from '../../data/hooks'
import type { MemberColor, Reward, RewardAisle } from '../../types'
import { Star } from './ProductSheet'
import s from './StockShop.module.css'

const AISLES: RewardAisle[] = ['Treats', 'Time off', 'Family fun']
const COLORS: MemberColor[] = ['moss', 'clay', 'honey', 'fjord', 'plum', 'pine', 'berry', 'sand', 'ocean', 'rose']
const ICONS: IconName[] = [
  'star', 'moon', 'bed', 'utensils', 'mug', 'broom', 'sofa', 'sparkle', 'dish', 'bag',
  'cart', 'car', 'bath', 'book', 'dumbbell', 'leaf', 'sun', 'shirt', 'key', 'plant',
]
const TITLE_MAX = 32
const BLURB_MAX = 80
const CLOSE_MS = 300

type Mode = 'list' | 'edit' | 'confirmDelete'
type Field = 'title' | 'blurb' | null

const blank = (): RewardInput => ({
  title: '',
  blurb: '',
  aisle: 'Treats',
  cost: 50,
  icon: 'star',
  color: 'fjord',
})

/**
 * Parent-only catalog editor opened after the PIN on "Stock the shop".
 * Create, edit, or retire (soft-delete) rewards on the shelves.
 */
export function StockShop({ rewards, onClose, onToast }: {
  rewards: Reward[]
  onClose: () => void
  onToast: (msg: string) => void
}) {
  const create = useCreateReward()
  const update = useUpdateReward()
  const remove = useDeleteReward()

  const [closing, setClosing] = useState(false)
  const [mode, setMode] = useState<Mode>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RewardInput>(blank)
  const [field, setField] = useState<Field>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const close = () => { setClosing(true); timer.current = window.setTimeout(onClose, CLOSE_MS) }
  const editing = editId ? rewards.find((r) => r.id === editId) : undefined

  const openNew = () => {
    setEditId(null)
    setDraft(blank())
    setMode('edit')
    setField('title')
  }
  const openEdit = (r: Reward) => {
    setEditId(r.id)
    setDraft({ title: r.title, blurb: r.blurb, aisle: r.aisle, cost: r.cost, icon: r.icon, color: r.color })
    setMode('edit')
    setField(null)
  }
  const backToList = () => { setMode('list'); setEditId(null); setField(null) }

  const canSave = draft.title.trim().length > 0 && draft.blurb.trim().length > 0 && draft.cost > 0

  const save = async () => {
    if (!canSave || busy) return
    setBusy(true)
    const input: RewardInput = {
      title: draft.title.trim(),
      blurb: draft.blurb.trim(),
      aisle: draft.aisle,
      cost: draft.cost,
      icon: draft.icon,
      color: draft.color,
    }
    try {
      if (editId) {
        await update.mutateAsync({ id: editId, ...input })
        onToast(`Updated “${input.title}”.`)
      } else {
        await create.mutateAsync(input)
        onToast(`Added “${input.title}” to the shop.`)
      }
      backToList()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Couldn’t save that reward.')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!editId || busy) return
    setBusy(true)
    const title = editing?.title ?? 'Reward'
    try {
      await remove.mutateAsync(editId)
      onToast(`Removed “${title}” from the shop.`)
      backToList()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Couldn’t remove that reward.')
      setMode('edit')
    } finally {
      setBusy(false)
    }
  }

  const keyboardValue = field === 'title' ? draft.title : field === 'blurb' ? draft.blurb : ''
  const onKeyboard = (next: string) => {
    if (field === 'title') setDraft((d) => ({ ...d, title: next.slice(0, TITLE_MAX) }))
    if (field === 'blurb') setDraft((d) => ({ ...d, blurb: next.slice(0, BLURB_MAX) }))
  }

  return (
    <div className={s.layer} data-closing={closing}>
      <div className={s.scrim} onClick={close} />
      <section role="dialog" aria-modal="true" aria-labelledby="stock-shop-title" className={s.sheet}>
        <header className={s.head}>
          <span className={s.headText}>
            <span className={s.kicker}>
              {mode === 'list' && `${rewards.length} on the shelves`}
              {mode === 'edit' && (editId ? 'Edit reward' : 'New reward')}
              {mode === 'confirmDelete' && 'Remove from the shop'}
            </span>
            <span id="stock-shop-title" className={s.title}>
              {mode === 'list' && 'Stock the shop'}
              {mode === 'edit' && (editId ? editing?.title ?? 'Edit' : 'Add a reward')}
              {mode === 'confirmDelete' && 'Take it off the shelf?'}
            </span>
          </span>
          <span className={s.headActions}>
            {mode === 'list' && (
              <Button size="lg" pill icon="plus" onClick={openNew}>Add reward</Button>
            )}
            <IconButton size="lg" icon="close" label="Close" onClick={close} />
          </span>
        </header>

        {mode === 'list' && (
          <>
            <div className={`${s.list} scroll-y`}>
              <button type="button" className={s.addRow} onClick={openNew}>
                <span className={s.addIcon}><Icon name="plus" size={28} stroke={3} /></span>
                <span className={s.addText}>
                  <span className={s.addTitle}>Add a reward</span>
                  <span className={s.addSub}>New treat, time off, or family fun</span>
                </span>
              </button>
              {rewards.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  data-color={r.color}
                  className={s.row}
                  style={{ ['--n' as string]: i }}
                  onClick={() => openEdit(r)}
                >
                  <span className={s.rowArt}><Icon name={r.icon} size={36} stroke={2.2} /></span>
                  <span className={s.rowText}>
                    <span className={s.rowAisle}>{r.aisle}</span>
                    <span className={s.rowTitle}>{r.title}</span>
                    <span className={s.rowBlurb}>{r.blurb}</span>
                  </span>
                  <span className={s.rowCost}><Star size={18} />{r.cost}</span>
                  <Icon name="pencil" size={22} />
                </button>
              ))}
              {!rewards.length && (
                <div className={s.empty}>
                  <span className={s.emptyTitle}>Nothing on the shelves yet</span>
                  <span className={s.emptyText}>Start with Add a reward above.</span>
                </div>
              )}
            </div>
            <footer className={s.foot}>
              <span className={s.hint}>Tap a reward to edit it. Retiring keeps past redemptions intact.</span>
            </footer>
          </>
        )}

        {mode === 'edit' && (
          <>
            <div className={`${s.form} scroll-y`} data-color={draft.color}>
              <div className={s.preview}>
                <span className={s.previewArt}><Icon name={draft.icon as IconName} size={72} stroke={2.2} /></span>
                <span className={s.previewText}>
                  <span className={s.previewAisle}>{draft.aisle}</span>
                  <span className={s.previewTitle}>{draft.title.trim() || 'Untitled reward'}</span>
                  <span className={s.previewBlurb}>{draft.blurb.trim() || 'One line for the product sheet'}</span>
                </span>
                <span className={s.previewCost}><Star size={22} />{draft.cost}</span>
              </div>

              <label className={s.field}>
                <span className={s.fieldLabel}>Title</span>
                <button type="button" className={s.fieldBtn} onClick={() => setField('title')}>
                  {draft.title || <span className={s.placeholder}>Sleep in Saturday</span>}
                </button>
              </label>

              <label className={s.field}>
                <span className={s.fieldLabel}>Blurb</span>
                <button type="button" className={s.fieldBtn} onClick={() => setField('blurb')}>
                  {draft.blurb || <span className={s.placeholder}>Someone else has the early shift with Noah.</span>}
                </button>
              </label>

              <div className={s.field}>
                <span className={s.fieldLabel}>Aisle</span>
                <div role="group" aria-label="Aisle" className={s.chips}>
                  {AISLES.map((a) => (
                    <button key={a} type="button" aria-pressed={draft.aisle === a} className={s.chip} onClick={() => setDraft((d) => ({ ...d, aisle: a }))}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className={s.costRow}>
                <span className={s.fieldLabel}>Price in stars</span>
                <span className={s.stepper}>
                  <IconButton variant="surface" icon="minus" label="Cheaper" onClick={() => setDraft((d) => ({ ...d, cost: Math.max(5, d.cost - 5) }))} />
                  <span key={draft.cost} className={`${s.costValue} anim-pop`} aria-live="polite">{draft.cost}</span>
                  <IconButton variant="surface" icon="plus" label="More stars" onClick={() => setDraft((d) => ({ ...d, cost: Math.min(500, d.cost + 5) }))} />
                </span>
              </div>

              <div className={s.field}>
                <span className={s.fieldLabel}>Color</span>
                <div role="group" aria-label="Color" className={s.colors}>
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      data-color={c}
                      aria-pressed={draft.color === c}
                      aria-label={c}
                      className={s.swatch}
                      onClick={() => setDraft((d) => ({ ...d, color: c }))}
                    />
                  ))}
                </div>
              </div>

              <div className={s.field}>
                <span className={s.fieldLabel}>Icon</span>
                <div role="group" aria-label="Icon" className={s.icons}>
                  {ICONS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={draft.icon === name}
                      aria-label={name}
                      className={s.iconChoice}
                      onClick={() => setDraft((d) => ({ ...d, icon: name }))}
                    >
                      <Icon name={name} size={28} stroke={2.4} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <footer className={s.foot}>
              {editId ? (
                <Button variant="secondary" size="lg" pill onClick={() => setMode('confirmDelete')}>Remove</Button>
              ) : (
                <button type="button" className={s.cancel} onClick={backToList}>Cancel</button>
              )}
              <span className={s.grow} />
              {editId && <button type="button" className={s.cancel} onClick={backToList}>Back</button>}
              <Button size="lg" pill disabled={!canSave || busy} onClick={() => void save()}>
                {editId ? 'Save changes' : 'Add to shop'}
              </Button>
            </footer>
          </>
        )}

        {mode === 'confirmDelete' && editing && (
          <>
            <div className={s.confirm}>
              <span data-color={editing.color} className={s.confirmArt}><Icon name={editing.icon} size={64} stroke={2.2} /></span>
              <p className={s.confirmText}>
                <strong>{editing.title}</strong> comes off the shelves. Past purchases stay in the ledger; anyone saving for it will need a new goal.
              </p>
            </div>
            <footer className={s.foot}>
              <button type="button" className={s.cancel} onClick={() => setMode('edit')}>Keep it</button>
              <span className={s.grow} />
              <Button size="lg" pill disabled={busy} onClick={() => void confirmDelete()}>Remove from shop</Button>
            </footer>
          </>
        )}
      </section>

      {field && (
        <SoftKeyboard
          value={keyboardValue}
          onChange={onKeyboard}
          onDone={() => setField(null)}
        />
      )}
    </div>
  )
}
