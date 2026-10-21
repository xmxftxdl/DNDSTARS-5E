/** Swept creature footprint against a saved physical circular pillar. */
export function pillarBlocksMovement(area, map, token, from, to, fromHeight, toHeight) {
  if (!area?.circularGeometry || area.blocking?.movement !== true ||
      !area.entityProfile || (area.entityCurrentHitPoints ?? area.entityProfile.hitPoints) <= 0 ||
      area.vertical?.mode !== 'volume') return false
  const anchor = area.anchorCell ?? area.cells?.[0]
  if (!anchor) return false
  const scale = (map.feetPerCell ?? 5) / Math.max(1, map.gridSize)
  const x = (from.x - (map.gridOffsetX ?? 0) - (anchor.col + .5) * map.gridSize) * scale
  const y = (from.y - (map.gridOffsetY ?? 0) - (anchor.row + .5) * map.gridSize) * scale
  const dx = (to.x - from.x) * scale, dy = (to.y - from.y) * scale
  const width = (token.size ?? 1) * (map.feetPerCell ?? 5)
  const radius = area.circularGeometry.radiusFeet + width / 2
  const a = dx * dx + dy * dy, b = 2 * (x * dx + y * dy), c = x * x + y * y - radius * radius
  let start = 0, end = 1
  if (a < 1e-12) {
    if (c >= -1e-8) return false
  } else {
    const discriminant = b * b - 4 * a * c
    if (discriminant <= 1e-8) return false
    const root = Math.sqrt(discriminant)
    start = Math.max(start, (-b - root) / (2 * a))
    end = Math.min(end, (-b + root) / (2 * a))
    if (start >= end - 1e-8) return false
  }
  const low = area.vertical.baseElevationFeet - Math.max(5, width)
  const high = area.vertical.baseElevationFeet + area.vertical.heightFeet
  const dz = toHeight - fromHeight
  if (Math.abs(dz) < 1e-12) return fromHeight > low + 1e-8 && fromHeight < high - 1e-8
  const t1 = (low - fromHeight) / dz, t2 = (high - fromHeight) / dz
  return Math.max(start, Math.min(t1, t2)) < Math.min(end, Math.max(t1, t2)) - 1e-8
}
