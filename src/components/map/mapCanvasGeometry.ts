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

