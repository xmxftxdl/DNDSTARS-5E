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
const MIN_DURATION_MS = 240
const MAX_DURATION_MS = 3_000

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
    id: input.id,
    points: path,
    durationMs: Math.round(Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, Math.max(segmentDuration, distanceDuration)))),
    issuedAt: Math.round(input.issuedAt ?? Date.now()),
  }
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
