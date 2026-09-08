export interface TokenMovementAnimationPoint {
  x: number
  y: number
}

export interface TokenMovementAnimation {
  id: string
  points: TokenMovementAnimationPoint[]
  durationMs: number
  issuedAt: number
}

const MAX_PATH_POINTS = 128
const MAX_ANIMATION_ID_LENGTH = 200
const MIN_DURATION_MS = 240
const MAX_DURATION_MS = 3_000
const MIN_LATE_OBSERVATION_WINDOW_MS = 180
const MAX_LATE_OBSERVATION_REPLAY_MS = 5_000

function finitePoint(value: unknown): value is TokenMovementAnimationPoint {
  if (!value || typeof value !== 'object') return false
  const point = value as Partial<TokenMovementAnimationPoint>
  return Number.isFinite(point.x) && Number.isFinite(point.y) &&
    Math.abs(point.x!) <= 1_000_000 && Math.abs(point.y!) <= 1_000_000
}

function dedupePoints(points: readonly TokenMovementAnimationPoint[]): TokenMovementAnimationPoint[] {
  return points.slice(0, MAX_PATH_POINTS).flatMap((point, index, entries) => {
    const previous = entries[index - 1]
    return previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 0.01
      ? []
      : [{ x: point.x, y: point.y }]
  })
}

function movementAnimationId(value: string): string {
  if (value.length <= MAX_ANIMATION_ID_LENGTH) return value
  // Summoned Token ids include the full authority transaction id. Combining
  // one with the combat and movement ids can legitimately exceed the shared
  // presentation schema's 200-character boundary. Keep a readable prefix and
  // hash the complete value so long ids that differ only after the prefix do
  // not collapse onto the same animation.
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193) >>> 0
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0
  }
  const suffix = `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`
  return `${value.slice(0, MAX_ANIMATION_ID_LENGTH - suffix.length - 1)}~${suffix}`
}

export function normalizeTokenMovementAnimation(value: unknown): TokenMovementAnimation | undefined {
  if (!value || typeof value !== 'object') return undefined
  const animation = value as Partial<TokenMovementAnimation>
  if (
    typeof animation.id !== 'string' || !animation.id || animation.id.length > 200 ||
    !Array.isArray(animation.points) || animation.points.length < 2 || animation.points.length > MAX_PATH_POINTS ||
    !animation.points.every(finitePoint) ||
    !Number.isFinite(animation.durationMs) || animation.durationMs! < MIN_DURATION_MS || animation.durationMs! > MAX_DURATION_MS ||
    !Number.isFinite(animation.issuedAt) || animation.issuedAt! < 0
  ) return undefined
  const points = dedupePoints(animation.points)
  if (points.length < 2) return undefined
  return {
    id: animation.id,
    points,
    durationMs: Math.round(animation.durationMs!),
    issuedAt: Math.round(animation.issuedAt!),
  }
}

export function createTokenMovementAnimation(input: {
  id: string
  path: readonly TokenMovementAnimationPoint[]
  finalPosition: TokenMovementAnimationPoint
  issuedAt?: number
}): TokenMovementAnimation | undefined {
  const path = dedupePoints([
    ...input.path.slice(0, MAX_PATH_POINTS - 1),
    input.finalPosition,
  ].filter(finitePoint))
  if (path.length < 2) return undefined
  const totalDistance = path.slice(1).reduce((sum, point, index) =>
    sum + Math.hypot(point.x - path[index].x, point.y - path[index].y), 0)
  const segmentDuration = (path.length - 1) * 130
  const distanceDuration = totalDistance * 3.5
  return {
    id: movementAnimationId(input.id),
    points: path,
    durationMs: Math.round(Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, Math.max(segmentDuration, distanceDuration)))),
    issuedAt: Math.round(input.issuedAt ?? Date.now()),
  }
}

/**
 * Gives a newly observed shared movement enough local time to be visible.
 *
 * Authority writes the final coordinates and the presentation timestamp in a
 * single snapshot. A slow save/SSE hop can therefore deliver a valid path only
 * after (or just before) its original animation window ends. Rebase only that
 * recent late arrival; genuinely old metadata stays expired so refreshing a
 * map never replays historical movement.
 */
export function tokenMovementAnimationForObservation(
  animation: TokenMovementAnimation,
  observedAt: number,
): TokenMovementAnimation {
  const completesAt = animation.issuedAt + animation.durationMs
  const remainingMs = completesAt - observedAt
  const minimumVisibleMs = Math.min(
    animation.durationMs,
    MIN_LATE_OBSERVATION_WINDOW_MS,
  )
  if (remainingMs >= minimumVisibleMs || observedAt < animation.issuedAt) return animation
  const lateByMs = Math.max(0, observedAt - completesAt)
  if (lateByMs > MAX_LATE_OBSERVATION_REPLAY_MS) return animation
  return { ...animation, issuedAt: Math.round(observedAt) }
}

export function truncateTokenMovementPath(
  path: readonly TokenMovementAnimationPoint[],
  finalPosition: TokenMovementAnimationPoint,
): TokenMovementAnimationPoint[] {
  if (path.length === 0) return [{ ...finalPosition }]
  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY
  path.forEach((point, index) => {
    const distance = Math.hypot(point.x - finalPosition.x, point.y - finalPosition.y)
    if (distance < closestDistance) {
      closestIndex = index
      closestDistance = distance
    }
  })
  const truncated = path.slice(0, closestIndex + 1).map((point) => ({ ...point }))
  if (closestDistance < 0.01) truncated[truncated.length - 1] = { ...finalPosition }
  else truncated.push({ ...finalPosition })
  return dedupePoints(truncated)
}

/** Builds the unplayed suffix after an interrupt checkpoint on the route. */
export function continueTokenMovementPath(
  path: readonly TokenMovementAnimationPoint[],
  checkpoint: TokenMovementAnimationPoint,
  finalPosition: TokenMovementAnimationPoint,
): TokenMovementAnimationPoint[] {
  const route = truncateTokenMovementPath(path, finalPosition)
  if (route.length < 2) return dedupePoints([checkpoint, finalPosition])
  let closestSegmentIndex = 0
  let closestSegmentRatio = 0
  let closestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < route.length - 1; index += 1) {
    const from = route[index]
    const to = route[index + 1]
    const dx = to.x - from.x
    const dy = to.y - from.y
    const lengthSquared = dx * dx + dy * dy
    const ratio = lengthSquared <= 0
      ? 0
      : Math.max(0, Math.min(1, (
          (checkpoint.x - from.x) * dx + (checkpoint.y - from.y) * dy
        ) / lengthSquared))
    const projected = { x: from.x + dx * ratio, y: from.y + dy * ratio }
    const distance = Math.hypot(checkpoint.x - projected.x, checkpoint.y - projected.y)
    if (distance < closestDistance) {
      closestDistance = distance
      closestSegmentIndex = index
      closestSegmentRatio = ratio
    }
  }
  const suffixStart = closestSegmentRatio >= 0.999
    ? closestSegmentIndex + 2
    : closestSegmentIndex + 1
  return dedupePoints([
    checkpoint,
    ...route.slice(suffixStart),
    finalPosition,
  ])
}

export function tokenMovementAnimationPosition(
  animation: TokenMovementAnimation,
  elapsedMs: number,
): TokenMovementAnimationPoint | undefined {
  if (elapsedMs < 0) return { ...animation.points[0] }
  if (elapsedMs >= animation.durationMs) return undefined
  const distances = animation.points.slice(1).map((point, index) =>
    Math.hypot(point.x - animation.points[index].x, point.y - animation.points[index].y))
  const totalDistance = distances.reduce((sum, distance) => sum + distance, 0)
  if (totalDistance <= 0) return { ...animation.points[animation.points.length - 1] }
  let remaining = totalDistance * (elapsedMs / animation.durationMs)
  for (let index = 0; index < distances.length; index += 1) {
    const segmentDistance = distances[index]
    if (remaining > segmentDistance && index < distances.length - 1) {
      remaining -= segmentDistance
      continue
    }
    const from = animation.points[index]
    const to = animation.points[index + 1]
    const ratio = segmentDistance <= 0 ? 1 : Math.max(0, Math.min(1, remaining / segmentDistance))
    return {
      x: from.x + (to.x - from.x) * ratio,
      y: from.y + (to.y - from.y) * ratio,
    }
  }
  return { ...animation.points[animation.points.length - 1] }
}
