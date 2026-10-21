// Planar annulus dimensions are in feet; callers retain their cell/height clips.
function local(area, map, point) {
  const anchor = area.anchorCell
  if (!anchor) return undefined
  const scale = (map.feetPerCell ?? 5) / map.gridSize
  return { x: (point.x - (map.gridOffsetX ?? 0) - (anchor.col + .5) * map.gridSize) * scale,
    y: (point.y - (map.gridOffsetY ?? 0) - (anchor.row + .5) * map.gridSize) * scale }
}

export function annularAreaOverlapsBox(area, map, point, halfSizePixels) {
  const p = local(area, map, point), g = area.circularGeometry
  if (!p || !g || g.innerRadiusFeet == null) return false
  const half = halfSizePixels * (map.feetPerCell ?? 5) / map.gridSize
  const near = Math.hypot(Math.max(0, Math.abs(p.x) - half), Math.max(0, Math.abs(p.y) - half))
  const far = Math.hypot(Math.abs(p.x) + half, Math.abs(p.y) + half)
  return near < g.radiusFeet && far > g.innerRadiusFeet
}

export function annularAreaRayIntervals(area, map, from, to) {
  const p = local(area, map, from), q = local(area, map, to), g = area.circularGeometry
  if (!p || !q || !g || g.innerRadiusFeet == null) return []
  const dx = q.x - p.x, dy = q.y - p.y, a = dx * dx + dy * dy
  const b = 2 * (p.x * dx + p.y * dy), norm = p.x * p.x + p.y * p.y
  if (a < 1e-12) return norm >= g.innerRadiusFeet ** 2 && norm <= g.radiusFeet ** 2 ? [[0, 1]] : []
  const cuts = [0, 1]
  for (const radius of [g.innerRadiusFeet, g.radiusFeet]) {
    const discriminant = b * b - 4 * a * (norm - radius * radius)
    if (discriminant < 0) continue
    const root = Math.sqrt(discriminant)
    for (const t of [(-b - root) / (2 * a), (-b + root) / (2 * a)]) if (t > 0 && t < 1) cuts.push(t)
  }
  cuts.sort((x, y) => x - y)
  const intervals = []
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i] - cuts[i - 1] < 1e-12) continue
    const t = (cuts[i] + cuts[i - 1]) / 2, distance = Math.hypot(p.x + dx * t, p.y + dy * t)
    if (distance >= g.innerRadiusFeet && distance <= g.radiusFeet) intervals.push([cuts[i - 1], cuts[i]])
  }
  return intervals
}
