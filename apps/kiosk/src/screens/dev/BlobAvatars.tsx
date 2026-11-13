import { useState } from 'react'
import {
  BLOB_CHARACTER_IDS,
  BlobAvatar,
  type BlobAnimation,
  type BlobCharacterId,
  type BlobColorway,
} from '../../components/BlobAvatar'
import { MEMBER_COLOR_PRESETS } from '@hub/shared'
import { Label, Panel } from '../../components/primitives'
import s from './BlobAvatars.module.css'

const COLORWAYS: BlobColorway[] = [...MEMBER_COLOR_PRESETS]

const MOTIONS: { id: BlobAnimation; label: string }[] = [
  { id: 'squish', label: 'Squish' },
  { id: 'hop', label: 'Happy Hop' },
  { id: 'blink', label: 'Blink' },
  { id: 'wiggle', label: 'Wiggle' },
  { id: 'nod', label: 'Nod' },
  { id: 'celebrate', label: 'Celebrate' },
]

const SIZES: { px: number; label: string }[] = [
  { px: 28, label: 'Compact assignee' },
  { px: 48, label: 'Profile chip' },
  { px: 96, label: 'Standard profile' },
  { px: 200, label: 'Large selection' },
]

function characterLabel(id: BlobCharacterId) {
  return id.charAt(0).toUpperCase() + id.slice(1)
}

/**
 * Isolated playground at `/dev/blob-avatars`.
 * Not wired into the kiosk sidebar or ScreenId union.
 */
export default function BlobAvatars() {
  const [character, setCharacter] = useState<BlobCharacterId>('pebble')
  const [colorway, setColorway] = useState<BlobColorway>('moss')
  const [animation, setAnimation] = useState<BlobAnimation>('idle')
  const [animationKey, setAnimationKey] = useState(0)

  const play = (next: BlobAnimation) => {
    setAnimation(next)
    setAnimationKey((n) => n + 1)
  }

  const reset = () => {
    setAnimation('idle')
    setAnimationKey((n) => n + 1)
  }

  const name = characterLabel(character)

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <p className={s.topline}>Chung Family Hub · Avatar study</p>
        <h1 className={s.title}>Meet {name}</h1>
        <p className={s.lede}>
          Soft family blobs for the hub. Tap the hero to squish; try colors, sizes, and
          one-shot motions before wiring them into profiles and chores.
        </p>

        <section className={s.hero} aria-label="Character preview" data-color={colorway}>
          <div className={s.heroStage}>
            <BlobAvatar
              character={character}
              size={200}
              colorway={colorway}
              animation={animation}
              animationKey={animationKey}
              showBackground={false}
              ariaLabel={`Animate ${name}`}
              onClick={() => play('squish')}
            />
          </div>
          <p className={s.heroName}>{name}</p>
          <p className={s.currentMotion}>
            Motion: <strong>{animation}</strong>
          </p>
        </section>

        <section className={s.section} aria-label="Characters">
          <h2 className={s.sectionTitle}>Characters</h2>
          <div className={s.swatches}>
            {BLOB_CHARACTER_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={[s.swatch, character === id && s.swatchOn].filter(Boolean).join(' ')}
                aria-pressed={character === id}
                onClick={() => { setCharacter(id); setAnimation('idle'); setAnimationKey((n) => n + 1) }}
              >
                <BlobAvatar character={id} size={40} colorway={colorway} showBackground decorative />
                <span>{characterLabel(id)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={s.section} aria-label="Colorway">
          <h2 className={s.sectionTitle}>Family colorways</h2>
          <div className={s.swatches}>
            {COLORWAYS.map((c) => (
              <button
                key={c}
                type="button"
                className={[s.swatch, colorway === c && s.swatchOn].filter(Boolean).join(' ')}
                aria-pressed={colorway === c}
                onClick={() => setColorway(c)}
              >
                <BlobAvatar character={character} size={40} colorway={c} showBackground decorative />
                <span>{c}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={s.section} aria-label="Animation playground">
          <h2 className={s.sectionTitle}>How should {name} move?</h2>
          <div className={s.controls}>
            {MOTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={[s.control, animation === m.id && s.controlOn].filter(Boolean).join(' ')}
                aria-pressed={animation === m.id}
                onClick={() => play(m.id)}
              >
                {m.label}
              </button>
            ))}
            <button type="button" className={s.control} onClick={reset}>
              Reset
            </button>
          </div>
        </section>

        <section className={s.section} aria-label="Size comparison">
          <h2 className={s.sectionTitle}>Size comparison</h2>
          <Panel pad="md">
            <div className={s.sizes}>
              {SIZES.map((size) => (
                <div className={s.sizeCard} key={size.px}>
                  <BlobAvatar character={character} size={size.px} colorway={colorway} decorative />
                  <span className={s.sizeLabel}>
                    {size.px}px
                    <span className={s.sizeName}>{size.label}</span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <p className={s.sectionNote}>
            The 28px face is intentionally tiny — check it on the real touchscreen.
          </p>
        </section>

        <section className={s.section} aria-label="Background comparison">
          <h2 className={s.sectionTitle}>Background comparison</h2>
          <div className={s.bgGrid} data-color={colorway}>
            <div className={`${s.bgCard} ${s.bgTint}`}>
              <BlobAvatar character={character} size={96} colorway={colorway} showBackground={false} decorative />
              <span className={s.bgLabel}>Member tint</span>
            </div>
            <div className={`${s.bgCard} ${s.bgSurface}`}>
              <BlobAvatar character={character} size={96} colorway={colorway} showBackground={false} decorative />
              <span className={s.bgLabel}>App surface</span>
            </div>
            <div className={`${s.bgCard} ${s.bgApp}`}>
              <BlobAvatar character={character} size={96} colorway={colorway} showBackground={false} decorative />
              <span className={s.bgLabel}>App background</span>
            </div>
          </div>
        </section>

        <section className={s.section} aria-label="Example UI integration">
          <h2 className={s.sectionTitle}>Example UI integration</h2>
          <div className={s.examples}>
            <div className={s.example}>
              <Label>Profile card</Label>
              <div className={s.profileCard} data-color={colorway}>
                <BlobAvatar character={character} size={72} colorway={colorway} showBackground={false} decorative />
                <div className={s.profileText}>
                  <span className={s.profileName}>Daniel</span>
                  <span className={s.profileMeta}>3 left today · 120 stars</span>
                </div>
              </div>
            </div>

            <div className={s.example}>
              <Label>Chore row</Label>
              <div className={s.choreRow}>
                <span className={s.choreCheck} aria-hidden="true" />
                <span className={s.choreTitle}>Feed Pippin</span>
                <BlobAvatar
                  character={character}
                  size={28}
                  colorway={colorway}
                  ariaLabel="Assigned to Daniel"
                />
              </div>
            </div>

            <div className={s.example}>
              <Label>Profile selection</Label>
              <div className={s.pickRow}>
                <button type="button" className={`${s.pick} ${s.pickOn}`} data-color={colorway} aria-pressed="true">
                  <BlobAvatar character={character} size={48} colorway={colorway} showBackground={false} decorative />
                  Daniel
                </button>
                <button type="button" className={s.pick} data-color="clay" aria-pressed="false">
                  <BlobAvatar character="mochi" size={48} colorway="clay" showBackground={false} decorative />
                  Shelby
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
