import type { MapGeometryState } from '../../lib/mapGeometry'
import { joinAdjacentPolygons } from '../../lib/joinAdjacentPolygons'

/** Rejoin adjacent fragments only when their complete semantics and exact
 * simple union agree. Never fill gaps, duplicate overlapping soil or merge layers. */
export function coalesceLooseEarth(geometry: MapGeometryState): MapGeometryState {
  const obstacles = [...geometry.obstacles]
  const metadata = (region: typeof obstacles[number]) => {
    const { id: _id, points: _points, ...rest } = region
    return JSON.stringify(Object.fromEntries(Object.entries(rest).sort(([a], [b]) => a.localeCompare(b))))
  }
  let changed = false
  for (let i = 0; i < obstacles.length; i++) {
    if (obstacles[i].surfaceMaterial !== 'loose-earth' || obstacles[i].heightFeet <= 0) continue
    // Search within one run of identical paint semantics. Geometry fragments
    // need not be stored in spatial order, but a different layer is a barrier.
    for (let j = i + 1; j < obstacles.length; j++) {
      const a = obstacles[i], b = obstacles[j]
      if (metadata(a) !== metadata(b)) break
      const points = joinAdjacentPolygons(a.points, b.points)
      if (!points) continue
      obstacles[i] = { ...a, points }
      obstacles.splice(j, 1)
      changed = true
      // A later join can bridge two earlier nonadjacent fragments.
      i = -1
      break
    }
  }
  return changed ? { ...geometry, obstacles } : geometry
}
