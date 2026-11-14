import { useEffect, useMemo, useState } from 'react'
import { aisleSortKey } from '@hub/shared'
import {
  addItem,
  clearList,
  fetchList,
  getTokenFromLocation,
  removeItem,
  toggleItem,
  type ShopItem,
  type ShopList,
} from './api'
import s from './App.module.css'

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

function groupOpen(items: ShopItem[]) {
  const open = items.filter((i) => !i.checked)
  const groups = open.reduce<Record<string, ShopItem[]>>((acc, item) => {
    ;(acc[item.category] ??= []).push(item)
    return acc
  }, {})
  return Object.entries(groups).sort(([a], [b]) => aisleSortKey(a) - aisleSortKey(b) || a.localeCompare(b))
}

export function App() {
  const token = useMemo(() => getTokenFromLocation(), [])
  const [list, setList] = useState<ShopList | null>(null)
  const [error, setError] = useState<string | null>(token ? null : 'missing')
  const [draft, setDraft] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      try {
        const res = await fetchList(token!)
        if (!cancelled) {
          setList(res.list)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load list')
      }
    }

    void load()
    const id = window.setInterval(() => void load(), 3000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [token])

  async function onToggle(item: ShopItem) {
    if (!token || busyId) return
    const next = !item.checked
    setBusyId(item.id)
    setList((prev) =>
      prev
        ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? { ...i, checked: next } : i)) }
        : prev,
    )
    try {
      const res = await toggleItem(token, item.id, next)
      setList((prev) =>
        prev
          ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? res.item : i)) }
          : prev,
      )
    } catch (err) {
      setList((prev) =>
        prev
          ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? { ...i, checked: item.checked } : i)) }
          : prev,
      )
      setError(err instanceof Error ? err.message : 'Could not update item')
    } finally {
      setBusyId(null)
    }
  }

  async function onRemove(item: ShopItem) {
    if (!token || busyId) return
    setBusyId(item.id)
    const previous = list
    setList((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.id !== item.id) } : prev))
    try {
      await removeItem(token, item.id)
      setError(null)
    } catch (err) {
      setList(previous)
      setError(err instanceof Error ? err.message : 'Could not remove item')
    } finally {
      setBusyId(null)
    }
  }

  async function onClearList() {
    if (!token || !list?.items.length || clearing) return
    setClearing(true)
    const previous = list
    setList((prev) => (prev ? { ...prev, items: [] } : prev))
    try {
      await clearList(token)
      setConfirmClear(false)
      setError(null)
    } catch (err) {
      setList(previous)
      setError(err instanceof Error ? err.message : 'Could not clear list')
    } finally {
      setClearing(false)
    }
  }

  async function onAdd() {
    if (!token) return
    const text = draft.trim()
    if (!text || adding) return
    setAdding(true)
    try {
      const res = await addItem(token, text)
      setList((prev) => (prev ? { ...prev, items: [...prev.items, res.item] } : prev))
      setDraft('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add item')
    } finally {
      setAdding(false)
    }
  }

  if (error === 'missing' || (!token && error)) {
    return (
      <main className={s.page}>
        <div className={s.error}>
          <h1>Open from the hub</h1>
          <p>Scan the QR on Lists to shop with this phone.</p>
        </div>
      </main>
    )
  }

  if (!list && error) {
    return (
      <main className={s.page}>
        <div className={s.error}>
          <h1>Link expired</h1>
          <p>{error}. Ask someone at home to open Shop on phone again.</p>
        </div>
      </main>
    )
  }

  if (!list) {
    return (
      <main className={s.page}>
        <p className={s.loading}>Loading your list…</p>
      </main>
    )
  }

  const open = list.items.filter((i) => !i.checked)
  const checked = list.items.filter((i) => i.checked)
  const groups = groupOpen(list.items)

  return (
    <main className={s.page}>
      <header className={s.head}>
        <div className={s.headText}>
          <p className={s.eyebrow}>Shopping</p>
          <h1 className={s.title}>{list.name}</h1>
          <p className={s.summary}>{open.length} to get · {checked.length} in the cart</p>
        </div>
        {list.items.length > 0 && (
          confirmClear ? (
            <div className={s.clearConfirm}>
              <button type="button" className={s.clearKeep} disabled={clearing} onClick={() => setConfirmClear(false)}>
                Keep
              </button>
              <button type="button" className={s.clearGo} disabled={clearing} onClick={() => void onClearList()}>
                {clearing ? 'Clearing…' : 'Clear all'}
              </button>
            </div>
          ) : (
            <button type="button" className={s.clearBtn} onClick={() => setConfirmClear(true)}>
              Clear list
            </button>
          )
        )}
      </header>

      {error && error !== 'missing' && <p className={s.banner} role="status">{error}</p>}

      <form
        className={s.addRow}
        onSubmit={(e) => {
          e.preventDefault()
          void onAdd()
        }}
      >
        <label className="sr-only" htmlFor="add-item">Add an item</label>
        <input
          id="add-item"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Forgot something?"
          autoComplete="off"
          enterKeyHint="done"
        />
        <button type="submit" className={s.addBtn} disabled={adding || !draft.trim()}>
          Add
        </button>
      </form>

      {open.length === 0 ? (
        <p className={s.empty}>{list.items.length ? 'Everything’s in the cart. Nice work.' : 'List is empty. Add something above.'}</p>
      ) : (
        <div className={s.groups}>
          {groups.map(([cat, items]) => (
            <section key={cat} className={s.group} aria-label={cat}>
              <h2 className={s.groupLabel}>{cat}</h2>
              {items.map((item) => (
                <div key={item.id} className={s.row}>
                  <button
                    type="button"
                    className={s.item}
                    aria-pressed={false}
                    aria-label={`Check off ${item.text}`}
                    disabled={busyId === item.id}
                    onClick={() => void onToggle(item)}
                  >
                    <span className={s.check} aria-hidden="true" />
                    <span className={s.itemText}>{item.text}</span>
                    {item.qty && <span className={s.qty}>{item.qty}</span>}
                  </button>
                  <button
                    type="button"
                    className={s.remove}
                    aria-label={`Remove ${item.text}`}
                    disabled={busyId === item.id}
                    onClick={() => void onRemove(item)}
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {checked.length > 0 && (
        <section className={s.done} aria-label="In the cart">
          <h2 className={s.doneHead}>In the cart · {checked.length}</h2>
          {checked.map((item) => (
            <div key={item.id} className={s.row}>
              <button
                type="button"
                className={s.doneItem}
                aria-pressed={true}
                aria-label={`Put back ${item.text}`}
                disabled={busyId === item.id}
                onClick={() => void onToggle(item)}
              >
                <span className={`${s.check} ${s.checkOn}`} aria-hidden="true"><CheckIcon /></span>
                <span className={s.strike}>{item.text}</span>
              </button>
              <button
                type="button"
                className={s.remove}
                aria-label={`Remove ${item.text}`}
                disabled={busyId === item.id}
                onClick={() => void onRemove(item)}
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
