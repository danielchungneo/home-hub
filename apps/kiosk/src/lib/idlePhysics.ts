/** Lightweight 2D hangout physics for the idle cast (Pi-friendly). */

export type IdleBody = {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  r: number
  mass: number
}

export type IdleRect = {
  x: number
  y: number
  w: number
  h: number
}

export type IdleBounds = {
  width: number
  height: number
  pad: number
}

const MIN_SPEED = 24
const MAX_SPEED = 48
/** Brief extra speed after a blob hit, then settleSpeed eases back. */
const HIT_SPEED = 68
/** How fast a post-hit boost eases back to cruise speed (px/s²). */
const BOOST_DECAY = 52
/** Extra gap after resolving overlap so they clear contact. */
const SEPARATION_SLACK = 10
/** Ignore repeat hits for the same pair briefly so they can leave contact. */
const PAIR_COOLDOWN_MS = 400

/** Collision radius matching BlobAvatar's tint circle (`r=47` in a 100 viewBox). */
export function avatarRadius(size: number) {
  return size * 0.47
}

export function randomVelocity(speed = 28 + Math.random() * 14): { vx: number; vy: number } {
  const angle = Math.random() * Math.PI * 2
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed }
}

/** Keep a cruise speed floor; ease boosted speeds back down instead of hard-clamping. */
export function settleSpeed(body: IdleBody, dt: number) {
  const speed = Math.hypot(body.vx, body.vy)
  if (speed < 0.01) {
    const next = randomVelocity(MIN_SPEED)
    body.vx = next.vx
    body.vy = next.vy
    return
  }
  if (speed < MIN_SPEED) {
    const scale = MIN_SPEED / speed
    body.vx *= scale
    body.vy *= scale
    return
  }
  if (speed > MAX_SPEED) {
    const next = Math.max(MAX_SPEED, speed - BOOST_DECAY * dt)
    const scale = next / speed
    body.vx *= scale
    body.vy *= scale
  }
}

function overlapsRect(body: IdleBody, rect: IdleRect, margin = 0) {
  const cx = Math.max(rect.x - margin, Math.min(body.x, rect.x + rect.w + margin))
  const cy = Math.max(rect.y - margin, Math.min(body.y, rect.y + rect.h + margin))
  const dx = body.x - cx
  const dy = body.y - cy
  return dx * dx + dy * dy < body.r * body.r
}

function overlapsBody(a: IdleBody, b: IdleBody, pad = 2) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const min = a.r + b.r + pad
  return dx * dx + dy * dy < min * min
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** Place a body in free space; falls back to a safe mid-screen point. */
export function spawnBody(
  id: string,
  radius: number,
  bounds: IdleBounds,
  obstacles: IdleRect[],
  others: IdleBody[],
): IdleBody {
  const mass = Math.max(1, radius * radius)
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = bounds.pad + radius + Math.random() * Math.max(1, bounds.width - 2 * (bounds.pad + radius))
    const y = bounds.pad + radius + Math.random() * Math.max(1, bounds.height - 2 * (bounds.pad + radius))
    const vel = randomVelocity()
    const candidate: IdleBody = { id, x, y, vx: vel.vx, vy: vel.vy, r: radius, mass }
    if (obstacles.some((rect) => overlapsRect(candidate, rect, 10))) continue
    if (others.some((other) => overlapsBody(candidate, other, 12))) continue
    return candidate
  }
  const vel = randomVelocity()
  return {
    id,
    x: bounds.width * (0.3 + Math.random() * 0.4),
    y: bounds.height * (0.3 + Math.random() * 0.4),
    vx: vel.vx,
    vy: vel.vy,
    r: radius,
    mass,
  }
}

function bounceWalls(body: IdleBody, bounds: IdleBounds) {
  const minX = bounds.pad + body.r
  const maxX = bounds.width - bounds.pad - body.r
  const minY = bounds.pad + body.r
  const maxY = bounds.height - bounds.pad - body.r
  if (body.x < minX) { body.x = minX; body.vx = Math.abs(body.vx) }
  else if (body.x > maxX) { body.x = maxX; body.vx = -Math.abs(body.vx) }
  if (body.y < minY) { body.y = minY; body.vy = Math.abs(body.vy) }
  else if (body.y > maxY) { body.y = maxY; body.vy = -Math.abs(body.vy) }
}

/** Circle vs AABB: push out on the shallow axis and flip that velocity. */
function bounceObstacle(body: IdleBody, rect: IdleRect, margin = 10) {
  const left = rect.x - margin
  const top = rect.y - margin
  const right = rect.x + rect.w + margin
  const bottom = rect.y + rect.h + margin

  const closestX = Math.max(left, Math.min(body.x, right))
  const closestY = Math.max(top, Math.min(body.y, bottom))
  const dx = body.x - closestX
  const dy = body.y - closestY
  const distSq = dx * dx + dy * dy
  if (distSq >= body.r * body.r) return false

  if (distSq < 0.0001) {
    const toL = body.x - left
    const toR = right - body.x
    const toT = body.y - top
    const toB = bottom - body.y
    const m = Math.min(toL, toR, toT, toB)
    if (m === toL) { body.x = left - body.r; body.vx = -Math.abs(body.vx) }
    else if (m === toR) { body.x = right + body.r; body.vx = Math.abs(body.vx) }
    else if (m === toT) { body.y = top - body.r; body.vy = -Math.abs(body.vy) }
    else { body.y = bottom + body.r; body.vy = Math.abs(body.vy) }
    return true
  }

  const dist = Math.sqrt(distSq)
  const nx = dx / dist
  const ny = dy / dist
  const overlap = body.r - dist
  body.x += nx * overlap
  body.y += ny * overlap
  const vn = body.vx * nx + body.vy * ny
  if (vn < 0) {
    body.vx -= 2 * vn * nx
    body.vy -= 2 * vn * ny
  }
  return true
}

/** Push two overlapping circles apart along their centers. */
function separate(a: IdleBody, b: IdleBody, nx: number, ny: number, overlap: number) {
  const total = a.mass + b.mass
  a.x -= nx * overlap * (b.mass / total)
  a.y -= ny * overlap * (b.mass / total)
  b.x += nx * overlap * (a.mass / total)
  b.y += ny * overlap * (a.mass / total)
}

/**
 * Send both blobs away from the contact point in opposite directions.
 * nx points from a → b, so a goes −n and b goes +n.
 */
function redirectOnHit(a: IdleBody, b: IdleBody, nx: number, ny: number) {
  a.vx = -nx * HIT_SPEED
  a.vy = -ny * HIT_SPEED
  b.vx = nx * HIT_SPEED
  b.vy = ny * HIT_SPEED
}

export type BodyCollision = { a: string; b: string; impact: number }

export type PhysicsStepOptions = {
  /** Epoch ms — used with pairCool to avoid repeat bounces while leaving contact. */
  now?: number
  /** Pair key → cooldown-until timestamp. */
  pairCool?: Map<string, number>
}

/** Integrate one frame. Returns fresh blob-blob hits (not cooldown repeats). */
export function stepPhysics(
  bodies: IdleBody[],
  bounds: IdleBounds,
  obstacles: IdleRect[],
  dt: number,
  options: PhysicsStepOptions = {},
): BodyCollision[] {
  const collisions: BodyCollision[] = []
  const step = Math.min(dt, 1 / 20)
  const now = options.now ?? 0
  const pairCool = options.pairCool

  for (const body of bodies) {
    body.x += body.vx * step
    body.y += body.vy * step
    bounceWalls(body, bounds)
    for (const rect of obstacles) bounceObstacle(body, rect)
  }

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]
      const b = bodies[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy) || 0.001
      const minDist = a.r + b.r
      if (dist >= minDist) continue

      const nx = dx / dist
      const ny = dy / dist
      const overlap = minDist - dist + SEPARATION_SLACK
      separate(a, b, nx, ny, overlap)

      const key = pairKey(a.id, b.id)
      const cooledUntil = pairCool?.get(key) ?? 0
      // Still overlapping during cooldown: keep separating, don't re-bounce.
      if (now && now < cooledUntil) continue

      const impact = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny)
      redirectOnHit(a, b, nx, ny)
      if (pairCool && now) pairCool.set(key, now + PAIR_COOLDOWN_MS)
      collisions.push({ a: a.id, b: b.id, impact })
    }
  }

  for (const body of bodies) settleSpeed(body, step)
  return collisions
}
