export interface Point {
  x: number
  y: number
}

export function measurePointsEqual(a: Point, b: Point): boolean {
  return Math.hypot(b.x - a.x, b.y - a.y) < 1.5
}

export function tabletopLinePoints(points: readonly Point[]): number[] {
  return points.flatMap((point) => [point.x, point.y])
}

export function tabletopStrokeIntersectsBox(points: readonly Point[], from: Point, to: Point): boolean {
  const min = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y) }
  const max = { x: Math.max(from.x, to.x), y: Math.max(from.y, to.y) }
  return points.some((a, index) => {
    const b = points[index + 1] ?? a
    let enter = 0, leave = 1
    for (const axis of ['x', 'y'] as const) {
      const delta = b[axis] - a[axis]
      if (delta === 0) {
        if (a[axis] < min[axis] || a[axis] > max[axis]) return false
      } else {
        const first = (min[axis] - a[axis]) / delta
        const last = (max[axis] - a[axis]) / delta
        enter = Math.max(enter, Math.min(first, last))
        leave = Math.min(leave, Math.max(first, last))
        if (enter > leave) return false
      }
    }
    return true
  })
}

