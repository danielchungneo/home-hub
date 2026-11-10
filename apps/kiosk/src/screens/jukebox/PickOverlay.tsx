import type { Collection } from '@hub/shared'
import { Cover, artVars } from './parts'
import s from './Jukebox.module.css'

/** Total length of the pick animation. Keep in sync with --pick-total in Jukebox.module.css. */
export const PICK_MS = 2350
/** How long the color wash takes to fade off the Now playing screen. */
export const REVEAL_MS = 800

/**
 * Tap a cover on the wall: the sleeve lifts to the center, the record slides out and spins,
 * then rolls off the right edge while the sleeve fades, and the screen washes to the cover color.
 * Pure CSS keyframes on transform/opacity (see .pick* in Jukebox.module.css).
 */
export function PickOverlay({ item, line }: { item: Collection; line: string }) {
  return (
    <div className={s.pick} style={artVars(item.art)} role="status" aria-label={`Putting on ${item.title}`}>
      <span className={s.pickBackdrop} />
      <div className={s.pickStage}>
        <div className={s.pickRecord}>
          <div className={s.pickRecordSpin}><span className={s.vinylLabel} /></div>
        </div>
        <div className={s.pickSleeve}><Cover item={item} size={420} /></div>
      </div>
      <div className={s.pickText}>
        <span className={s.pickTitle}>{item.title}</span>
        <span className={s.pickLine}>{line}</span>
      </div>
      <span className={s.pickWash} />
    </div>
  )
}

/** The cover-colored wash fading away to reveal Now playing. */
export function Reveal({ item }: { item: Collection }) {
  return <span className={s.reveal} style={artVars(item.art)} aria-hidden="true" />
}
