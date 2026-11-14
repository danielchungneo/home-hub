import s from './BlobAvatar.module.css'
import type { BlobAnimation } from './types'

const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const EASE_IN_OUT = 'ease-in-out'

/** Keyframes as [offset, transform]; the easing applies between each pair, like a CSS animation. */
function motion(duration: number, easing: string, frames: [number, string][]) {
  return { duration, keyframes: frames.map(([offset, transform]) => ({ offset, transform, easing })) }
}

/**
 * One-shot motions, sized with % so they scale with the avatar. They run on the whole <svg> box,
 * so % offsets are of the full size (the character fills ~60% of it). Blink runs on the eyes.
 */
const MOTIONS: Partial<Record<BlobAnimation, { duration: number; keyframes: Keyframe[] }>> = {
  squish: motion(480, EASE_OUT, [
    [0, 'scale(1, 1)'],
    [0.34, 'scale(1.09, 0.9)'],
    [0.66, 'scale(0.97, 1.05)'],
    [1, 'scale(1, 1)'],
  ]),
  hop: motion(580, EASE_OUT, [
    [0, 'translateY(0) scale(1)'],
    [0.35, 'translateY(-6%) scale(0.98, 1.04)'],
    [0.72, 'translateY(0) scale(1.06, 0.93)'],
    [1, 'translateY(0) scale(1)'],
  ]),
  wiggle: motion(620, EASE_IN_OUT, [
    [0, 'rotate(0) scale(1)'],
    [0.18, 'rotate(-16deg) scale(1.06)'],
    [0.36, 'rotate(14deg) scale(1.08)'],
    [0.54, 'rotate(-11deg) scale(1.04)'],
    [0.72, 'rotate(8deg) scale(1.02)'],
    [1, 'rotate(0) scale(1)'],
  ]),
  nod: motion(480, EASE_IN_OUT, [
    [0, 'rotate(0) translateY(0)'],
    [0.4, 'rotate(7deg) translateY(2%)'],
    [0.7, 'rotate(-2deg) translateY(0)'],
    [1, 'rotate(0) translateY(0)'],
  ]),
  celebrate: motion(720, EASE_OUT, [
    [0, 'translateY(0) rotate(0) scale(1)'],
    [0.24, 'translateY(-6%) rotate(-6deg) scale(1.04)'],
    [0.49, 'translateY(-8.5%) rotate(7deg) scale(1)'],
    [0.75, 'translateY(0) rotate(-3deg) scale(1.05, 0.95)'],
    [1, 'translateY(0) rotate(0) scale(1)'],
  ]),
  blink: motion(250, EASE_IN_OUT, [
    [0, 'scaleY(1)'],
    [0.35, 'scaleY(1)'],
    [0.5, 'scaleY(0.08)'],
    [0.7, 'scaleY(1)'],
    [1, 'scaleY(1)'],
  ]),
}

/** The motion currently playing on each avatar, so a new one replaces it (one transform animation at a time). */
const running = new WeakMap<Element, Animation>()

/**
 * Play a one-shot motion on a BlobAvatar with Web Animations. `el` is the avatar's character <svg>
 * or any element containing one avatar. No React state is involved, so callers that fire motions
 * often (Idle) don't re-render. Returns the animation, or null if there's nothing to play.
 */
export function playBlobMotion(el: Element | null | undefined, anim: BlobAnimation): Animation | null {
  const def = MOTIONS[anim]
  if (!def || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
  const svg = el.classList.contains(s.svg) ? el : el.querySelector(`.${CSS.escape(s.svg)}`)
  if (!svg) return null
  const target = anim === 'blink' ? svg.querySelector(`.${CSS.escape(s.eyes)}`) : svg
  if (!target) return null
  running.get(svg)?.cancel()
  const run = target.animate(def.keyframes, def.duration)
  running.set(svg, run)
  run.addEventListener('finish', () => { if (running.get(svg) === run) running.delete(svg) })
  return run
}
