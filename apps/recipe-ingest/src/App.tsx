import { useEffect, useMemo, useState } from 'react'
import {
  RECIPE_TAG_GROUPS,
  type RecipeTag,
  normalizeRecipeTags,
  toggleRecipeTag,
  withSyncedTimeTag,
} from '@hub/shared'
import {
  analyzeRecipe,
  fetchHousehold,
  fileToDataUrl,
  getTokenFromLocation,
  saveRecipe,
  uploadRecipeImage,
  type Ingredient,
  type RecipeDraft,
  type Step,
} from './api'
import s from './App.module.css'

type Phase = 'form' | 'needsText' | 'analyzing' | 'review' | 'success' | 'error-token'

const ANALYZE_STAGES = ['Fetching the page', 'Reading the recipe', 'Asking ChatGPT', 'Finding a photo']

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
  const [phase, setPhase] = useState<Phase>(token ? 'form' : 'error-token')
  const [householdName, setHouseholdName] = useState('your kitchen')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stageIdx, setStageIdx] = useState(0)
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
    if (phase !== 'analyzing') return
    setStageIdx(0)
    const id = window.setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, ANALYZE_STAGES.length - 1))
    }, 900)
    return () => window.clearInterval(id)
  }, [phase])

  async function runAnalyze(extraText?: string) {
    if (!token) return
    setError(null)
    setPhase('analyzing')
    try {
      const result = await analyzeRecipe(token, {
        url: url.trim() || undefined,
        text: (extraText ?? text).trim() || undefined,
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
        title: draft.title.trim() || 'Untitled recipe',
        ingredients: draft.ingredients.filter((i) => i.name.trim()),
        steps: draft.steps.filter((st) => st.text.trim()),
        tags: normalizeRecipeTags(draft.tags, { prepMin: draft.prepMin, cookMin: draft.cookMin }),
      }
      await saveRecipe(token, cleaned)
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

  if (phase === 'error-token') {
    return (
      <main className={s.page}>
        <p className={s.eyebrow}>Recipe box</p>
        <h1 className={s.title}>Link needed</h1>
        <p className={s.lede}>Scan the QR code on the kitchen hub to open this page with your family token.</p>
      </main>
    )
  }

  return (
    <main className={`${s.page} ${s.fadeIn}`}>
      <p className={s.eyebrow}>{householdName}</p>
      <h1 className={s.title}>
        {phase === 'success' ? 'Recipe saved' : phase === 'review' ? 'Review recipe' : 'Add a recipe'}
      </h1>
      <p className={s.lede}>
        {phase === 'success'
          ? 'It is in the family recipe box on the hub.'
          : phase === 'review'
            ? 'Edit anything that looks off, then save it to the hub.'
            : 'Paste a webpage or social video link. We will turn it into a cookable recipe.'}
      </p>

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
              disabled={!url.trim() && !text.trim()}
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
            {ANALYZE_STAGES.map((label, i) => (
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
            <label className={s.photoButton}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                disabled={uploadingPhoto}
                onChange={(e) => void onPhotoSelected(e.target.files?.[0] ?? null)}
              />
              {uploadingPhoto ? 'Uploading…' : draft.imageUrl ? 'Replace photo' : 'Add photo'}
            </label>
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
              {saving ? 'Saving…' : 'Save to recipe box'}
            </button>
            <button type="button" className={s.secondary} onClick={() => { setPhase('form'); setError(null) }}>
              Start over
            </button>
          </div>
        </section>
      )}

      {phase === 'success' && (
        <section className={`${s.panel} ${s.success}`}>
          <div className={s.successMark} aria-hidden>✓</div>
          <h2 className={s.title} style={{ fontSize: 30 }}>{draft.title}</h2>
          <p className={s.lede}>Added to the family recipe box.</p>
          <div className={s.actions}>
            <button
              type="button"
              className={s.primary}
              onClick={() => {
                setUrl('')
                setText('')
                setMessage(null)
                setDraft(emptyDraft())
                setPhase('form')
              }}
            >
              Add another
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
