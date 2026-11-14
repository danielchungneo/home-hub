export type ShopItem = {
  id: string
  text: string
  qty: string | null
  category: string
  checked: boolean
}

export type ShopList = {
  id: string
  name: string
  expiresAt: string
  items: ShopItem[]
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
  || 'https://zgobtwaajbwxdtiatjyq.supabase.co'

function shareBase() {
  return `${supabaseUrl}/functions/v1/list-share`
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${shareBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-list-token': token,
      ...(init?.headers ?? {}),
    },
  })
  const data = await res.json() as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export function getTokenFromLocation() {
  return new URLSearchParams(window.location.search).get('token')
}

export function fetchList(token: string) {
  return call<{ list: ShopList }>(token, '?action=list', { method: 'GET' })
}

export function toggleItem(token: string, id: string, checked: boolean) {
  return call<{ item: ShopItem }>(token, '?action=toggle', {
    method: 'PATCH',
    body: JSON.stringify({ id, checked }),
  })
}

export function addItem(token: string, text: string, qty?: string) {
  return call<{ item: ShopItem }>(token, '?action=add', {
    method: 'POST',
    body: JSON.stringify({ text, qty: qty || null }),
  })
}

export function removeItem(token: string, id: string) {
  return call<{ ok: true; id: string }>(token, '?action=item', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export function clearList(token: string) {
  return call<{ ok: true }>(token, '?action=clear', {
    method: 'DELETE',
  })
}
