import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RECIPE_TAG_GROUPS,
  type RecipeTag,
  normalizeRecipeTags,
  toggleRecipeTag,
  withSyncedTimeTag,
} from '@hub/shared'
import {
  MAX_PARSE_IMAGES,
  analyzeRecipe,
  fetchHousehold,
  fetchRecipe,
  fileToDataUrl,
  fileToVisionDataUrl,
  getEditIdFromLocation,
  getTokenFromLocation,
  saveRecipe,
  uploadRecipeImage,
  type Ingredient,
  type RecipeDraft,
  type Step,
} from './api'
import s from './App.module.css'

type Phase = 'form' | 'needsText' | 'analyzing' | 'loading' | 'review' | 'success' | 'error-token' | 'error-recipe'

type ParsePhoto = { id: string; previewUrl: string; file: File }

const LINK_ANALYZE_STAGES = ['Fetching the page', 'Reading the recipe', 'Asking ChatGPT', 'Finding a photo']
const PHOTO_ANALYZE_STAGES = ['Reading the photo', 'Asking ChatGPT', 'Building the draft']
const TEXT_ANALYZE_STAGES = ['Reading the recipe', 'Asking ChatGPT', 'Building the draft']

function emptyDraft(): RecipeDraft {
  return {
    title: '',
    servings: 4,
    prepMin: 0,
    cookMin: 0,
    tags: [],
    ingredients: [{ qty: 1, unit: '', name: '' }],
    steps: [{ text: '' }],
    sourceUrl: null,
    imageUrl: null,
    color: 'fjord',
    icon: 'pot',
  }
}

export function App() {
  const token = useMemo(() => getTokenFromLocation(), [])
  const editId = useMemo(() => getEditIdFromLocation(), [])
  const editing = Boolean(editId)
  const [phase, setPhase] = useState<Phase>(() => {
    if (!token) return 'error-token'
    return editId ? 'loading' : 'form'
  })
  const [householdName, setHouseholdName] = useState('your kitchen')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [parsePhotos, setParsePhotos] = useState<ParsePhoto[]>([])
  const parsePhotosRef = useRef(parsePhotos)
  parsePhotosRef.current = parsePhotos
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stageIdx, setStageIdx] = useState(0)
  const [analyzeStages, setAnalyzeStages] = useState(LINK_ANALYZE_STAGES)
  const [draft, setDraft] = useState<RecipeDraft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    if (!token) return
    fetchHousehold(token)
      .then((r) => setHouseholdName(r.household.name))
      .catch(() => setPhase('error-token'))
  }, [token])

  useEffect(() => {
    if (!token || !editId) return
    let cancelled = false
    setPhase('loading')
    setError(null)
    fetchRecipe(token, editId)
      .then((r) => {
        if (cancelled) return
        setDraft({
          ...r.recipe,
          tags: normalizeRecipeTags(r.recipe.tags, {
            prepMin: r.recipe.prepMin,
            cookMin: r.recipe.cookMin,
          }),
          ingredients: r.recipe.ingredients.length
            ? r.recipe.ingredients
            : [{ qty: 1, unit: '', name: '' }],
          steps: r.recipe.steps.length ? r.recipe.steps : [{ text: '' }],
        })
        setPhase('review')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setPhase('error-recipe')
      })
    return () => { cancelled = true }
  }, [token, editId])

  useEffect(() => {
    if (phase !== 'analyzing') return
    setStageIdx(0)
    const id = window.setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, analyzeStages.length - 1))
    }, 900)
    return () => window.clearInterval(id)
  }, [phase, analyzeStages])

  useEffect(() => {
    return () => {
      for (const photo of parsePhotosRef.current) URL.revokeObjectURL(photo.previewUrl)
    }
  }, [])

  function clearParsePhotos() {
    setParsePhotos((prev) => {
      for (const photo of prev) URL.revokeObjectURL(photo.previewUrl)
      return []
    })
  }

  function onParsePhotosSelected(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!incoming.length) {
      setError('Please choose photo images.')
      return
    }
    setParsePhotos((prev) => {
      const room = MAX_PARSE_IMAGES - prev.length
      if (room <= 0) {
        setError(`You can add up to ${MAX_PARSE_IMAGES} photos.`)
        return prev
      }
      const next = incoming.slice(0, room).map((file) => ({
        id: crypto.randomUUID(),
        previewUrl: URL.createObjectURL(file),
        file,
      }))
      if (incoming.length > room) {
        setError(`Only ${MAX_PARSE_IMAGES} photos allowed — extras were skipped.`)
      }
      return [...prev, ...next]
    })
  }

  function removeParsePhoto(id: string) {
    setParsePhotos((prev) => {
      const victim = prev.find((p) => p.id === id)
      if (victim) URL.revokeObjectURL(victim.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  async function runAnalyze(extraText?: string) {
    if (!token) return
    setError(null)
    const hasUrl = Boolean(url.trim())
    const hasPhotos = parsePhotos.length > 0
    setAnalyzeStages(hasPhotos ? PHOTO_ANALYZE_STAGES : hasUrl ? LINK_ANALYZE_STAGES : TEXT_ANALYZE_STAGES)
    setPhase('analyzing')
    try {
      const images = hasPhotos
        ? await Promise.all(parsePhotos.map((p) => fileToVisionDataUrl(p.file)))
        : undefined
      const result = await analyzeRecipe(token, {
        url: url.trim() || undefined,
        text: (extraText ?? text).trim() || undefined,
        images,
      })
      if (result.needsText) {
        setMessage(result.message || 'Paste the caption or recipe text to continue.')
        setPhase('needsText')
        return
      }
      setDraft({
        ...result.draft,
        tags: normalizeRecipeTags(result.draft.tags, {
          prepMin: result.draft.prepMin,
          cookMin: result.draft.cookMin,
        }),
        ingredients: result.draft.ingredients.length ? result.draft.ingredients : [{ qty: 1, unit: '', name: '' }],
        steps: result.draft.steps.length ? result.draft.steps : [{ text: '' }],
      })
      clearParsePhotos()
      setPhase('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPhase(text || message ? 'needsText' : 'form')
    }
  }

  async function onSave() {
    if (!token) return
    setSaving(true)
    setError(null)
    try {
      const cleaned: RecipeDraft = {
        ...draft,
        id: draft.id ?? editId ?? undefined,
        title: draft.title.trim() || 'Untitled recipe',
        ingredients: draft.ingredients.filter((i) => i.name.trim()),
        steps: draft.steps.filter((st) => st.text.trim()),
        tags: normalizeRecipeTags(draft.tags, { prepMin: draft.prepMin, cookMin: draft.cookMin }),
      }
      await saveRecipe(token, cleaned, cleaned.id)
      setPhase('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function onPhotoSelected(file: File | null) {
    if (!token || !file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo image.')
      return
    }
    if (file.size > 5_000_000) {
      setError('Photo must be under 5MB.')
      return
    }
    setUploadingPhoto(true)
    setError(null)
    try {
      const dataUrl = await fileToDataUrl(file)
      const uploaded = await uploadRecipeImage(token, dataUrl, draft.id)
      setDraft((d) => ({
        ...d,
        id: d.id ?? uploaded.recipeId,
        imagePath: uploaded.imagePath,
        imageUrl: uploaded.imageUrl ?? dataUrl,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploadingPhoto(false)
    }
  }

  function updateIngredient(index: number, patch: Partial<Ingredient>) {
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  function updateStep(index: number, patch: Partial<Step>) {
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  function resetForm() {
    setUrl('')
    setText('')
    setMessage(null)
    clearParsePhotos()
    setDraft(emptyDraft())
    setPhase('form')
  }

  const canAnalyze = Boolean(url.trim() || text.trim() || parsePhotos.length)

  if (phase === 'error-token') {
    return (
      <main className={s.page}>
        <p className={s.eyebrow}>Recipe box</p>
        <h1 className={s.title}>Link needed</h1>
        <p className={s.lede}>Scan the QR code on the kitchen hub to open this page with your family token.</p>
      </main>
    )
  }

  if (phase === 'error-recipe') {
    return (
      <main className={s.page}>
        <p className={s.eyebrow}>{householdName}</p>
        <h1 className={s.title}>Recipe not found</h1>
        <p className={s.lede}>{error || 'Scan the edit QR again from the kitchen hub.'}</p>
      </main>
    )
  }

  if (phase === 'loading') {
    return (
      <main className={`${s.page} ${s.fadeIn}`}>
        <p className={s.eyebrow}>{householdName}</p>
        <h1 className={s.title}>Loading recipe</h1>
        <p className={s.lede}>Pulling the current card from the hub…</p>
        <section className={`${s.panel} ${s.analyzing}`}>
          <div className={s.orbit} aria-hidden />
        </section>
      </main>
    )
  }

  const heading =
    phase === 'success'
      ? (editing ? 'Recipe updated' : 'Recipe saved')
      : phase === 'review'
        ? (editing ? 'Edit recipe' : 'Review recipe')
        : 'Add a recipe'
  const lede =
    phase === 'success'
      ? (editing ? 'Changes are on the family recipe box on the hub.' : 'It is in the family recipe box on the hub.')
      : phase === 'review'
        ? (editing ? 'Change anything on your phone, then save to update the hub.' : 'Edit anything that looks off, then save it to the hub.')
        : 'Paste a link, add notes, or snap a photo of a recipe card or screenshot.'

  return (
    <main className={`${s.page} ${s.fadeIn}`}>
      <p className={s.eyebrow}>{householdName}</p>
      <h1 className={s.title}>{heading}</h1>
      <p className={s.lede}>{lede}</p>

      {(phase === 'form' || phase === 'needsText') && (
        <section className={s.panel}>
          <label className={s.label}>
            Recipe link
            <input
              className={s.input}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </label>
          <div className={s.label}>
            Photo of recipe
            <div className={s.parsePhotoGrid}>
              {parsePhotos.map((photo) => (
                <div key={photo.id} className={s.parsePhotoThumb}>
                  <img src={photo.previewUrl} alt="" />
                  <button
                    type="button"
                    className={s.parsePhotoRemove}
                    aria-label="Remove photo"
                    onClick={() => removeParsePhoto(photo.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
              {parsePhotos.length < MAX_PARSE_IMAGES && (
                <label className={s.parsePhotoAdd}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      onParsePhotosSelected(e.target.files)
                      e.target.value = ''
                    }}
                  />
                  {parsePhotos.length ? 'Add more' : 'Add photos'}
                </label>
              )}
            </div>
            <p className={s.hint}>Up to {MAX_PARSE_IMAGES} pages or screenshots. These are for reading the recipe — add a food photo later if you want.</p>
          </div>
          <label className={s.label}>
            {phase === 'needsText' ? 'Caption or recipe text' : 'Caption / notes (optional)'}
            <textarea
              className={s.textarea}
              placeholder={phase === 'needsText'
                ? 'Paste the Instagram/Facebook caption or the recipe text…'
                : 'Useful for social videos when the page is locked down'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          {message && <p className={s.error}>{message}</p>}
          {error && <p className={s.error}>{error}</p>}
          <div className={s.actions}>
            <button
              type="button"
              className={s.primary}
              disabled={!canAnalyze}
              onClick={() => void runAnalyze()}
            >
              Analyze recipe
            </button>
          </div>
        </section>
      )}

      {phase === 'analyzing' && (
        <section className={`${s.panel} ${s.analyzing}`}>
          <div className={s.orbit} aria-hidden />
          <h2 className={s.title} style={{ fontSize: 28 }}>Working on it</h2>
          <p className={s.lede} style={{ marginBottom: 0 }}>This usually takes a few seconds.</p>
          <div className={s.stages} aria-live="polite">
            {analyzeStages.map((label, i) => (
              <div
                key={label}
                className={`${s.stage} ${i === stageIdx ? s.stageOn : ''} ${i < stageIdx ? s.stageDone : ''}`}
              >
                <span className={s.dot} />
                {label}
              </div>
            ))}
          </div>
        </section>
      )}

      {phase === 'review' && (
        <section className={s.panel}>
          <div className={s.photoBlock}>
            {draft.imageUrl ? (
              <img className={s.heroImage} src={draft.imageUrl} alt="" />
            ) : (
              <div className={s.photoEmpty}>No photo yet</div>
            )}
            <div className={s.photoActions}>
              <label className={s.photoButton}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  disabled={uploadingPhoto}
                  onChange={(e) => {
                    void onPhotoSelected(e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                />
                {uploadingPhoto ? 'Uploading…' : 'Take photo'}
              </label>
              <label className={s.photoButton}>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploadingPhoto}
                  onChange={(e) => {
                    void onPhotoSelected(e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                />
                {uploadingPhoto ? 'Uploading…' : 'Choose from library'}
              </label>
            </div>
            {draft.imageUrl && (
              <button
                type="button"
                className={s.ghost}
                disabled={uploadingPhoto}
                onClick={() => setDraft({ ...draft, imageUrl: null, imagePath: null })}
              >
                Remove photo
              </button>
            )}
          </div>
          <label className={s.label}>
            Title
            <input className={s.input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <div className={s.row}>
            <label className={s.label}>
              Servings
              <input
                className={s.input}
                type="number"
                min={1}
                value={draft.servings}
                onChange={(e) => setDraft({ ...draft, servings: Number(e.target.value) || 1 })}
              />
            </label>
            <label className={s.label}>
              Prep min
              <input
                className={s.input}
                type="number"
                min={0}
                value={draft.prepMin}
                onChange={(e) => {
                  const prepMin = Number(e.target.value) || 0
                  setDraft({ ...draft, prepMin, tags: withSyncedTimeTag(draft.tags, prepMin, draft.cookMin) })
                }}
              />
            </label>
          </div>
          <label className={s.label}>
            Cook min
            <input
              className={s.input}
              type="number"
              min={0}
              value={draft.cookMin}
              onChange={(e) => {
                const cookMin = Number(e.target.value) || 0
                setDraft({ ...draft, cookMin, tags: withSyncedTimeTag(draft.tags, draft.prepMin, cookMin) })
              }}
            />
          </label>
          {RECIPE_TAG_GROUPS.map((group) => (
            <div key={group.id} className={s.label}>
              {group.label}
              <div className={s.tagChips}>
                {group.tags.map((tag) => {
                  const on = draft.tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={on ? `${s.tagChip} ${s.tagChipOn}` : s.tagChip}
                      aria-pressed={on}
                      onClick={() => setDraft({ ...draft, tags: toggleRecipeTag(draft.tags, tag as RecipeTag) })}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div className={s.label}>Ingredients</div>
          <div className={s.list}>
            {draft.ingredients.map((ing, i) => (
              <div className={s.item} key={`ing-${i}`}>
                <input
                  className={s.input}
                  type="number"
                  step="any"
                  value={ing.qty}
                  aria-label="Quantity"
                  onChange={(e) => updateIngredient(i, { qty: Number(e.target.value) || 0 })}
                />
                <input
                  className={s.input}
                  value={ing.unit}
                  aria-label="Unit"
                  placeholder="unit"
                  onChange={(e) => updateIngredient(i, { unit: e.target.value })}
                />
                <input
                  className={s.input}
                  value={ing.name}
                  aria-label="Ingredient"
                  placeholder="ingredient"
                  onChange={(e) => updateIngredient(i, { name: e.target.value })}
                />
              </div>
            ))}
            <button
              type="button"
              className={s.ghost}
              onClick={() => setDraft({ ...draft, ingredients: [...draft.ingredients, { qty: 1, unit: '', name: '' }] })}
            >
              Add ingredient
            </button>
          </div>

          <div className={s.label}>Steps</div>
          <div className={s.list}>
            {draft.steps.map((step, i) => (
              <div className={s.itemFull} key={`step-${i}`}>
                <span className={s.stepNum}>{i + 1}</span>
                <textarea
                  className={s.textarea}
                  value={step.text}
                  onChange={(e) => updateStep(i, { text: e.target.value })}
                />
              </div>
            ))}
            <button
              type="button"
              className={s.ghost}
              onClick={() => setDraft({ ...draft, steps: [...draft.steps, { text: '' }] })}
            >
              Add step
            </button>
          </div>

          {error && <p className={s.error}>{error}</p>}
          <div className={s.actions}>
            <button type="button" className={s.primary} disabled={saving} onClick={() => void onSave()}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save to recipe box'}
            </button>
            {!editing && (
              <button type="button" className={s.secondary} onClick={() => { setPhase('form'); setError(null) }}>
                Start over
              </button>
            )}
          </div>
        </section>
      )}

      {phase === 'success' && (
        <section className={`${s.panel} ${s.success}`}>
          <div className={s.successMark} aria-hidden>✓</div>
          <h2 className={s.title} style={{ fontSize: 30 }}>{draft.title}</h2>
          <p className={s.lede}>
            {editing ? 'Updated on the family recipe box.' : 'Added to the family recipe box.'}
          </p>
          {!editing && (
            <div className={s.actions}>
              <button type="button" className={s.primary} onClick={resetForm}>
                Add another
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
