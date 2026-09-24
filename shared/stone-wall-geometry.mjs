/** Slab intersection with each living stone panel. Cells remain an input and
 * selection aid; physical walls keep their actual 3/6-inch thickness. */
export function stoneWallIntersects(area, map, from, to, fromZ, toZ, radiusFeet = 0, creatureHeightFeet = 0) {
  if (!area.stoneWall && !area.forceWall) return false
  let start = area.forceWall?.start
  const panels = area.stoneWall?.panels ?? area.forceWall.angles.map(angle => {
    const radians = angle * Math.PI / 180, length = 10 / (map.feetPerCell ?? 5)
    const end = { col: start.col + Math.cos(radians) * length, row: start.row + Math.sin(radians) * length }
    const panel = { start, end }; start = end; return panel
  })
  const feet = map.feetPerCell ?? 5, scale = feet / map.gridSize
  const base = area.vertical?.mode === 'volume' ? area.vertical.baseElevationFeet : 0
  const height = area.vertical?.mode === 'volume' ? area.vertical.heightFeet : 10
  return panels.some(panel => {
    if (panel.hitPoints <= 0) return false
    const dx = panel.end.col - panel.start.col, dy = panel.end.row - panel.start.row
    const length = Math.hypot(dx, dy)
    if (length < 1e-6) return false
    const ux = dx / length, uy = dy / length
    const cx = (map.gridOffsetX ?? 0) + ((panel.start.col + panel.end.col) / 2 + .5) * map.gridSize
    const cy = (map.gridOffsetY ?? 0) + ((panel.start.row + panel.end.row) / 2 + .5) * map.gridSize
    const local = (point, z) => [
      ((point.x - cx) * ux + (point.y - cy) * uy) * scale,
      (-(point.x - cx) * uy + (point.y - cy) * ux) * scale, z,
    ]
    const a = local(from, fromZ), b = local(to, toZ)
    const halfLength = length * feet / 2 + radiusFeet
    const halfThickness = (area.forceWall ? 1 / 24 : area.stoneWall.mode === 'ice' ? .5 : area.stoneWall.mode === 'thin' ? .125 : .25) + radiusFeet
    const mins = [-halfLength, -halfThickness, base - creatureHeightFeet + (creatureHeightFeet > 0 ? 1e-5 : -1e-5)]
    const maxs = [halfLength, halfThickness, base + height - 1e-5]
    let enter = 0, exit = 1
    for (let axis = 0; axis < 3; axis++) {
      const d = b[axis] - a[axis]
      if (Math.abs(d) < 1e-8) { if (a[axis] < mins[axis] || a[axis] > maxs[axis]) return false; continue }
      const t1 = (mins[axis] - a[axis]) / d, t2 = (maxs[axis] - a[axis]) / d
      enter = Math.max(enter, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2))
      if (enter > exit) return false
    }
    return true
  })
}
