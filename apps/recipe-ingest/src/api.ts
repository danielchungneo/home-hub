export type Ingredient = { qty: number; unit: string; name: string }
export type Step = { text: string; tip?: string; timerMin?: number }

export type RecipeDraft = {
  title: string
  servings: number
  prepMin: number
  cookMin: number
  tags: string[]
  ingredients: Ingredient[]
  steps: Step[]
  sourceUrl: string | null
  imageUrl: string | null
  imagePath?: string | null
  id?: string
  color: 'moss' | 'clay' | 'honey' | 'fjord' | 'plum'
  icon: string
}

export type AnalyzeResult =
  | {
      needsText: true
      platform?: string
      message?: string
      preview?: { title: string | null; description: string | null; imageUrl: string | null }
    }
  | {
      needsText: false
      draft: RecipeDraft
      platform?: string
    }

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
  || 'https://zgobtwaajbwxdtiatjyq.supabase.co'

function importBase() {
  return `${supabaseUrl}/functions/v1/recipe-import`
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${importBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-import-token': token,
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

export function fetchHousehold(token: string) {
  return call<{ household: { id: string; name: string } }>(token, '/household?action=household', {
    method: 'GET',
  })
}

export function analyzeRecipe(token: string, input: { url?: string; text?: string }) {
  return call<AnalyzeResult>(token, '?action=analyze', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function saveRecipe(token: string, draft: RecipeDraft, id?: string) {
  return call<{ recipe: RecipeDraft & { id: string; imagePath?: string | null } }>(token, '?action=save', {
    method: 'POST',
    body: JSON.stringify({ draft, id: id ?? draft.id }),
  })
}

export function uploadRecipeImage(token: string, dataUrl: string, recipeId?: string) {
  return call<{ recipeId: string; imagePath: string; imageUrl: string | null }>(token, '?action=upload-image', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, recipeId }),
  })
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read photo'))
    reader.readAsDataURL(file)
  })
}
