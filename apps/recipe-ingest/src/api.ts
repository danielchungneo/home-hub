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

export function getEditIdFromLocation() {
  return new URLSearchParams(window.location.search).get('edit')
}

export function fetchHousehold(token: string) {
  return call<{ household: { id: string; name: string } }>(token, '/household?action=household', {
    method: 'GET',
  })
}

export function fetchRecipe(token: string, id: string) {
  return call<{ recipe: RecipeDraft & { id: string } }>(
    token,
    `?action=recipe&id=${encodeURIComponent(id)}`,
    { method: 'GET' },
  )
}

export function analyzeRecipe(
  token: string,
  input: { url?: string; text?: string; images?: string[] },
) {
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

/** Matches PHOTO_SHORT_SIDE in the recipe-import function: the kiosk never shows photos bigger than this. */
const PHOTO_SHORT_SIDE = 640
/** Long side for vision OCR — enough for dense screenshot text without megapixel dumps. */
const VISION_LONG_SIDE = 1536
export const MAX_PARSE_IMAGES = 4

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read photo'))
    reader.readAsDataURL(file)
  })
}

async function shrinkToDataUrl(
  file: File,
  opts: { mode: 'short' | 'long'; size: number; quality: number },
) {
  const src = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = src
    await img.decode()
    const dim = opts.mode === 'short'
      ? Math.min(img.naturalWidth, img.naturalHeight)
      : Math.max(img.naturalWidth, img.naturalHeight)
    const scale = opts.size / dim
    if (scale >= 1) {
      // Still re-encode large non-JPEG sources as JPEG for predictable payload size.
      if (file.type === 'image/jpeg' || file.type === 'image/jpg') return await readAsDataUrl(file)
    }
    const canvas = document.createElement('canvas')
    const w = scale >= 1 ? img.naturalWidth : Math.round(img.naturalWidth * scale)
    const h = scale >= 1 ? img.naturalHeight : Math.round(img.naturalHeight * scale)
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return await readAsDataUrl(file)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', opts.quality)
  } catch {
    return await readAsDataUrl(file)
  } finally {
    URL.revokeObjectURL(src)
  }
}

/** Phone photos are often 12 MP; shrink to the kiosk's size as JPEG before uploading. */
export async function fileToDataUrl(file: File) {
  return shrinkToDataUrl(file, { mode: 'short', size: PHOTO_SHORT_SIDE, quality: 0.8 })
}

/** Shrink a recipe card/screenshot for OpenAI vision parse (higher res than kiosk hero). */
export async function fileToVisionDataUrl(file: File) {
  return shrinkToDataUrl(file, { mode: 'long', size: VISION_LONG_SIDE, quality: 0.85 })
}
