import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-import-token",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
}

type Ingredient = { qty: number; unit: string; name: string }
type Step = { text: string; tip?: string; timerMin?: number; uses?: string[] }

type RecipeDraft = {
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
  color: "moss" | "clay" | "honey" | "fjord" | "plum"
  icon: string
}

type Extracted = {
  platform: string
  title: string | null
  description: string | null
  imageUrl: string | null
  jsonLd: unknown | null
  text: string
  thin: boolean
}

const RECIPE_MEALS = ["Breakfast", "Lunch", "Dinner", "Snack", "Side", "Dessert"] as const
const RECIPE_TIMES = ["Quick", "Medium", "Long"] as const
const RECIPE_CUISINES = [
  "American", "Mexican", "Italian", "Chinese", "Japanese", "Korean", "Thai", "Indian",
  "Mediterranean", "Middle Eastern", "French", "Greek", "Vietnamese", "Caribbean", "British", "Other",
] as const
const ALLOWED_RECIPE_TAGS = new Set<string>([...RECIPE_MEALS, ...RECIPE_TIMES, ...RECIPE_CUISINES])

function timeTagForMinutes(totalMin: number) {
  const total = Math.max(0, Math.round(totalMin) || 0)
  if (total <= 30) return "Quick"
  if (total <= 60) return "Medium"
  return "Long"
}

function normalizeRecipeTags(tags: unknown, prepMin: number, cookMin: number): string[] {
  const meals: string[] = []
  const cuisines: string[] = []
  let time: string | null = null
  const raw = Array.isArray(tags) ? tags.map(String) : []
  for (const tag of raw) {
    const trimmed = tag.trim()
    if (!ALLOWED_RECIPE_TAGS.has(trimmed)) continue
    if ((RECIPE_MEALS as readonly string[]).includes(trimmed)) {
      if (!meals.includes(trimmed)) meals.push(trimmed)
      continue
    }
    if ((RECIPE_CUISINES as readonly string[]).includes(trimmed)) {
      if (!cuisines.includes(trimmed)) cuisines.push(trimmed)
      continue
    }
    if ((RECIPE_TIMES as readonly string[]).includes(trimmed) && !time) time = trimmed
  }
  if (!time) time = timeTagForMinutes(prepMin + cookMin)
  return [...meals, time, ...cuisines]
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function requireEnv(name: string) {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

function adminClient() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function resolveHousehold(admin: SupabaseClient, token: string | null) {
  if (!token) return null
  const { data, error } = await admin
    .from("households")
    .select("id, name, import_token")
    .eq("import_token", token)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

function detectPlatform(url: string) {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase()
    } catch {
      return ""
    }
  })()
  if (host.includes("instagram.com")) return "instagram"
  if (host.includes("facebook.com") || host.includes("fb.watch")) return "facebook"
  if (host.includes("tiktok.com")) return "tiktok"
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube"
  if (host.includes("pinterest.")) return "pinterest"
  return "web"
}

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function metaContent(html: string, property: string) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["'][^>]*>`,
    "i",
  )
  const m = html.match(re)
  return m?.[1] || m?.[2] || null
}

function extractJsonLdRecipes(html: string): unknown | null {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1]!)
      const nodes = Array.isArray(parsed) ? parsed : [parsed]
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue
        const n = node as Record<string, unknown>
        if (n["@type"] === "Recipe") return n
        if (Array.isArray(n["@graph"])) {
          const recipe = (n["@graph"] as unknown[]).find((g) => {
            const t = (g as Record<string, unknown>)?.["@type"]
            return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))
          })
          if (recipe) return recipe
        }
        const t = n["@type"]
        if (Array.isArray(t) && t.includes("Recipe")) return n
      }
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }
  return null
}

async function fetchOEmbed(url: string, platform: string) {
  const endpoints: Record<string, string> = {
    youtube: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    tiktok: `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
    instagram: `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/plugins/post/oembed.json/?url=${encodeURIComponent(url)}`,
  }
  const endpoint = endpoints[platform]
  if (!endpoint) return null
  try {
    const res = await fetch(endpoint, {
      headers: { "User-Agent": "Mozilla/5.0 HomeHubRecipeBot/1.0" },
    })
    if (!res.ok) return null
    return await res.json() as { title?: string; author_name?: string; thumbnail_url?: string; html?: string }
  } catch {
    return null
  }
}

async function extractFromUrl(url: string): Promise<Extracted> {
  const platform = detectPlatform(url)
  let html = ""
  let status = 0
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HomeHubRecipeBot/1.0; +https://github.com/chung-family/home-hub)",
        Accept: "text/html,application/xhtml+xml",
      },
    })
    status = res.status
    if (res.ok) html = await res.text()
  } catch {
    html = ""
  }

  const oembed = await fetchOEmbed(url, platform)
  const title = metaContent(html, "og:title") || metaContent(html, "twitter:title") || oembed?.title || null
  const description =
    metaContent(html, "og:description") ||
    metaContent(html, "twitter:description") ||
    metaContent(html, "description") ||
    null
  const imageUrl =
    metaContent(html, "og:image") ||
    metaContent(html, "twitter:image") ||
    oembed?.thumbnail_url ||
    null
  const jsonLd = html ? extractJsonLdRecipes(html) : null
  const text = [
    title,
    description,
    oembed?.author_name ? `Author: ${oembed.author_name}` : null,
    oembed?.html ? stripTags(oembed.html) : null,
    html ? stripTags(html).slice(0, 12000) : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  const thin = !jsonLd && text.replace(/\s+/g, " ").trim().length < 280
  return {
    platform,
    title,
    description,
    imageUrl,
    jsonLd,
    text,
    thin: thin || (!html && status >= 400),
  }
}

/** Pull a cooking duration from step text when the model omits timerMin. */
function inferTimerMin(text: string): number | undefined {
  const t = text.toLowerCase()
  const hour = t.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/)
  if (hour) return Math.max(1, Math.ceil(Number(hour[1]) * 60))
  const min = t.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)\b/)
  if (min) return Math.max(1, Math.ceil(Number(min[1])))
  const sec = t.match(/(\d+)\s*(?:seconds?|secs?|sec)\b/)
  if (sec) return Math.max(1, Math.ceil(Number(sec[1]) / 60))
  return undefined
}

const STOP_WORDS = new Set([
  "and", "or", "the", "a", "an", "of", "in", "to", "for", "with", "into", "on",
  "fresh", "large", "small", "finely", "chopped", "minced", "peeled", "ground",
  "dried", "white", "part", "optional", "about",
])

function inferStepUses(text: string, ingredients: Ingredient[]): string[] {
  const hay = text.toLowerCase()
  return ingredients.filter((ing) => {
    const primary = ing.name.toLowerCase().split(",")[0]!.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim()
    if (primary.length >= 3 && hay.includes(primary)) return true
    const aliases = [...ing.name.toLowerCase().matchAll(/\(([^)]+)\)/g)].flatMap((m) =>
      m[1]!.split(/\/|,| or /).map((p) => p.trim()).filter((p) => p.length >= 3),
    )
    if (aliases.some((a) => hay.includes(a))) return true
    const toks = primary.split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
    if (!toks.length) return false
    if (toks.some((t) => t.length >= 4 && hay.includes(t))) return true
    const hits = toks.filter((t) => hay.includes(t)).length
    return hits > 0 && hits >= Math.ceil(toks.length * 0.6)
  }).map((ing) => ing.name)
}

async function normalizeWithOpenAI(input: {
  url: string | null
  extracted: Extracted | null
  extraText: string | null
}): Promise<RecipeDraft> {
  const apiKey = requireEnv("OPENAI_API_KEY")
  const system = `You convert messy webpage or social-media recipe content into a clean cooking recipe for a family kitchen hub.
Return ONLY valid JSON matching this schema:
{
  "title": string,
  "servings": number,
  "prepMin": number,
  "cookMin": number,
  "tags": string[],
  "ingredients": [{"qty": number, "unit": string, "name": string}],
  "steps": [{"text": string, "tip"?: string, "timerMin"?: number, "uses"?: string[]}],
  "color": "moss"|"clay"|"honey"|"fjord"|"plum",
  "icon": string
}
Rules:
- qty is a number; use 0 for to taste / as needed.
- unit is short (cup, tbsp, tsp, g, oz, clove, can, pinch) or "" when none.
- Keep steps short, imperative, and suitable for a wall-mounted cooking mode.
- For every step that includes a wait/cook/bake/boil/simmer/rest/chill duration, set timerMin to that duration in whole minutes (round up 30+ seconds). Examples: "bake 25 minutes" → timerMin 25; "rest 5 min" → 5; "simmer 1 hour" → 60; "cook 90 seconds" → 2.
- Omit timerMin only when the step has no time element.
- For each step, set uses to the exact ingredient name strings from the ingredients list that this step uses. Leave uses empty only when the step truly uses none.
- tags MUST be chosen only from this fixed list (do not invent new tags):
  meals: Breakfast, Lunch, Dinner, Snack, Side, Dessert
  time: Quick (≤30 min total), Medium (31–60), Long (>60)
  cuisine/nationality: American, Mexican, Italian, Chinese, Japanese, Korean, Thai, Indian, Mediterranean, Middle Eastern, French, Greek, Vietnamese, Caribbean, British, Other
- Include 1–2 meal tags, exactly one time tag matching prepMin+cookMin, and 1 cuisine tag when clear (else Other or omit).
- icon should be one of: pot, bowl, bread, leaf, flame, fish, egg, mug, cart.
- Prefer the provided schema.org Recipe JSON when present.
- If content is incomplete, still produce a best-effort recipe and note uncertainty only in a step tip.`

  const userPayload = {
    sourceUrl: input.url,
    platform: input.extracted?.platform ?? null,
    schemaOrgRecipe: input.extracted?.jsonLd ?? null,
    pageTitle: input.extracted?.title ?? null,
    pageDescription: input.extracted?.description ?? null,
    pageText: input.extracted?.text?.slice(0, 10000) ?? null,
    pastedCaptionOrTranscript: input.extraText,
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
  })

  const body = await res.json() as {
    error?: { message?: string }
    choices?: { message?: { content?: string } }[]
  }
  if (!res.ok) throw new Error(body.error?.message ?? `OpenAI ${res.status}`)
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new Error("OpenAI returned empty content")

  const parsed = JSON.parse(content) as Partial<RecipeDraft>
  const ingredients = Array.isArray(parsed.ingredients)
    ? parsed.ingredients.map((i) => ({
      qty: typeof i?.qty === "number" ? i.qty : Number(i?.qty) || 0,
      unit: String(i?.unit ?? ""),
      name: String(i?.name ?? "").trim(),
    })).filter((i) => i.name)
    : []
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps.map((s) => {
      const text = String(s?.text ?? "").trim()
      const fromModel = typeof s?.timerMin === "number" && s.timerMin > 0
        ? Math.round(s.timerMin)
        : undefined
      const timerMin = fromModel ?? inferTimerMin(text)
      const named = Array.isArray((s as { uses?: unknown })?.uses)
        ? ((s as { uses?: unknown[] }).uses ?? []).map(String).filter(Boolean)
        : []
      const usesFromModel = named.filter((n) => ingredients.some((ing) => ing.name === n))
      const uses = usesFromModel.length ? usesFromModel : inferStepUses(text, ingredients)
      return {
        text,
        tip: s?.tip ? String(s.tip) : undefined,
        timerMin,
        uses: uses.length ? uses : undefined,
      }
    }).filter((s) => s.text)
    : []

  const colors = new Set(["moss", "clay", "honey", "fjord", "plum"])
  const color = colors.has(String(parsed.color)) ? parsed.color as RecipeDraft["color"] : "fjord"

  const prepMin = Math.max(0, Math.round(Number(parsed.prepMin) || 0))
  const cookMin = Math.max(0, Math.round(Number(parsed.cookMin) || 0))
  return {
    title: String(parsed.title || input.extracted?.title || "Untitled recipe").trim(),
    servings: Math.max(1, Math.round(Number(parsed.servings) || 4)),
    prepMin,
    cookMin,
    tags: normalizeRecipeTags(parsed.tags, prepMin, cookMin),
    ingredients,
    steps,
    sourceUrl: input.url,
    imageUrl: input.extracted?.imageUrl ?? null,
    color,
    icon: String(parsed.icon || "pot"),
  }
}

function extForContentType(contentType: string) {
  if (contentType.includes("png")) return "png"
  if (contentType.includes("webp")) return "webp"
  if (contentType.includes("gif")) return "gif"
  return "jpg"
}

async function storeImageBytes(
  admin: SupabaseClient,
  householdId: string,
  recipeId: string,
  bytes: Uint8Array,
  contentType: string,
) {
  if (!contentType.startsWith("image/")) return null
  if (bytes.byteLength > 5_000_000) return null
  const path = `${householdId}/${recipeId}.${extForContentType(contentType)}`
  const { error } = await admin.storage.from("recipe-images").upload(path, bytes, {
    contentType: contentType.split(";")[0]!,
    upsert: true,
  })
  if (error) return null
  return path
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null
  const contentType = match[1]!
  const binary = atob(match[2]!)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { bytes, contentType }
}

async function storeImage(
  admin: SupabaseClient,
  householdId: string,
  recipeId: string,
  imageUrl: string | null,
) {
  if (!imageUrl) return null
  try {
    if (imageUrl.startsWith("data:image/")) {
      const decoded = decodeDataUrl(imageUrl)
      if (!decoded) return null
      return await storeImageBytes(admin, householdId, recipeId, decoded.bytes, decoded.contentType)
    }
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 HomeHubRecipeBot/1.0" },
    })
    if (!res.ok) return null
    const contentType = res.headers.get("content-type") ?? "image/jpeg"
    const bytes = new Uint8Array(await res.arrayBuffer())
    return await storeImageBytes(admin, householdId, recipeId, bytes, contentType)
  } catch {
    return null
  }
}

function draftToRow(draft: RecipeDraft, householdId: string, imagePath: string | null) {
  const prepMin = Math.max(0, Math.round(Number(draft.prepMin) || 0))
  const cookMin = Math.max(0, Math.round(Number(draft.cookMin) || 0))
  return {
    household_id: householdId,
    title: draft.title,
    image_path: imagePath,
    servings: draft.servings,
    prep_min: prepMin,
    cook_min: cookMin,
    ingredients: draft.ingredients,
    steps: draft.steps,
    tags: normalizeRecipeTags(draft.tags, prepMin, cookMin),
    source_url: draft.sourceUrl,
    color: draft.color,
    icon: draft.icon,
  }
}

async function signedImageUrl(admin: SupabaseClient, path: string | null) {
  if (!path) return null
  const { data, error } = await admin.storage.from("recipe-images").createSignedUrl(path, 60 * 60 * 24 * 7)
  if (error) return null
  return data.signedUrl
}

function rowToClient(row: Record<string, unknown>, imageUrl: string | null) {
  return {
    id: row.id,
    title: row.title,
    servings: row.servings,
    prepMin: row.prep_min,
    cookMin: row.cook_min,
    tags: row.tags ?? [],
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    sourceUrl: row.source_url ?? null,
    imagePath: row.image_path ?? null,
    imageUrl,
    color: row.color,
    icon: row.icon,
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const admin = adminClient()
    const url = new URL(req.url)
    const pathParts = url.pathname.split("/").filter(Boolean)
    const leaf = pathParts[pathParts.length - 1] || "recipe-import"
    const action = url.searchParams.get("action") || (leaf === "recipe-import" ? "" : leaf)
    const token = req.headers.get("x-import-token") || url.searchParams.get("token")
    const household = await resolveHousehold(admin, token)
    if (!household) return json({ error: "Invalid or missing import token" }, 401)

    if (req.method === "POST" && (action === "analyze" || action === "")) {
      const body = await req.json() as { url?: string; text?: string }
      const sourceUrl = body.url?.trim() || null
      const extraText = body.text?.trim() || null
      if (!sourceUrl && !extraText) return json({ error: "Provide a url and/or text" }, 400)

      let extracted: Extracted | null = null
      if (sourceUrl) {
        try {
          new URL(sourceUrl)
        } catch {
          return json({ error: "Invalid url" }, 400)
        }
        extracted = await extractFromUrl(sourceUrl)
        if (extracted.thin && !extraText) {
          return json({
            needsText: true,
            platform: extracted.platform,
            preview: {
              title: extracted.title,
              description: extracted.description,
              imageUrl: extracted.imageUrl,
            },
            message: "This link did not expose enough recipe text. Paste the caption or recipe details and try again.",
          })
        }
      }

      const draft = await normalizeWithOpenAI({ url: sourceUrl, extracted, extraText })
      return json({ draft, needsText: false, platform: extracted?.platform ?? "text" })
    }

    if (req.method === "POST" && action === "upload-image") {
      const body = await req.json() as { dataUrl?: string; recipeId?: string }
      if (!body.dataUrl?.startsWith("data:image/")) {
        return json({ error: "Provide a dataUrl image" }, 400)
      }
      const decoded = decodeDataUrl(body.dataUrl)
      if (!decoded) return json({ error: "Invalid image data" }, 400)
      const recipeId = body.recipeId || crypto.randomUUID()
      const imagePath = await storeImageBytes(admin, household.id, recipeId, decoded.bytes, decoded.contentType)
      if (!imagePath) return json({ error: "Could not store image (max 5MB, image only)" }, 400)
      const imageUrl = await signedImageUrl(admin, imagePath)
      return json({ recipeId, imagePath, imageUrl })
    }

    if (req.method === "POST" && action === "save") {
      const body = await req.json() as { draft?: RecipeDraft; id?: string }
      if (!body.draft?.title) return json({ error: "Missing draft" }, 400)
      const draft = body.draft
      const recipeId = body.id || crypto.randomUUID()
      let imagePath = draft.imagePath ?? null
      if (!imagePath) {
        imagePath = await storeImage(admin, household.id, recipeId, draft.imageUrl)
      }
      const row = { id: recipeId, ...draftToRow(draft, household.id, imagePath) }
      const { data, error } = await admin.from("recipes").upsert(row).select("*").single()
      if (error) throw new Error(error.message)
      const imageUrl = await signedImageUrl(admin, data.image_path)
      return json({ recipe: rowToClient(data, imageUrl) })
    }

    if (req.method === "PATCH") {
      const body = await req.json() as {
        id?: string
        title?: string
        servings?: number
        prepMin?: number
        cookMin?: number
        tags?: string[]
        ingredients?: Ingredient[]
        steps?: Step[]
        color?: string
        icon?: string
        sourceUrl?: string | null
        imageUrl?: string | null
      }
      if (!body.id) return json({ error: "Missing id" }, 400)

      const updates: Record<string, unknown> = {}
      if (body.title !== undefined) updates.title = body.title
      if (body.servings !== undefined) updates.servings = body.servings
      if (body.prepMin !== undefined) updates.prep_min = body.prepMin
      if (body.cookMin !== undefined) updates.cook_min = body.cookMin
      if (body.ingredients !== undefined) updates.ingredients = body.ingredients
      if (body.steps !== undefined) updates.steps = body.steps
      if (body.color !== undefined) updates.color = body.color
      if (body.icon !== undefined) updates.icon = body.icon
      if (body.sourceUrl !== undefined) updates.source_url = body.sourceUrl
      if (body.imageUrl) {
        const path = await storeImage(admin, household.id, body.id, body.imageUrl)
        if (path) updates.image_path = path
      }

      if (body.tags !== undefined || body.prepMin !== undefined || body.cookMin !== undefined) {
        const { data: existing } = await admin
          .from("recipes")
          .select("tags, prep_min, cook_min")
          .eq("id", body.id)
          .eq("household_id", household.id)
          .maybeSingle()
        const prepMin = body.prepMin ?? existing?.prep_min ?? 0
        const cookMin = body.cookMin ?? existing?.cook_min ?? 0
        updates.tags = normalizeRecipeTags(body.tags ?? existing?.tags ?? [], prepMin, cookMin)
      }

      const { data, error } = await admin
        .from("recipes")
        .update(updates)
        .eq("id", body.id)
        .eq("household_id", household.id)
        .select("*")
        .single()
      if (error) throw new Error(error.message)
      const imageUrl = await signedImageUrl(admin, data.image_path)
      return json({ recipe: rowToClient(data, imageUrl) })
    }

    if (req.method === "GET" && action === "household") {
      return json({ household: { id: household.id, name: household.name } })
    }

    return json({ error: "Not found" }, 404)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message }, 500)
  }
})
