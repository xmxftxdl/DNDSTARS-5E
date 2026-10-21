/** A single directed line in the Host's full sampled path, including elevation. */
export function dnd5ePathIsStraightLine(
  points: readonly { x: number; y: number }[], elevationsFeet: readonly number[],
): boolean {
  if (points.length < 2 || elevationsFeet.length !== points.length ||
    !points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)) ||
    !elevationsFeet.every(Number.isFinite)) return false
  const start = points[0], end = points.at(-1)!
  const direction = [end.x - start.x, end.y - start.y, elevationsFeet.at(-1)! - elevationsFeet[0]]
  const length = Math.hypot(...direction)
  if (length <= 1e-6) return false
  const unit = direction.map(value => value / length)
  let previous = 0
  return points.every((point, index) => {
    const offset = [point.x - start.x, point.y - start.y, elevationsFeet[index] - elevationsFeet[0]]
    const projection = offset.reduce((sum, value, axis) => sum + value * unit[axis], 0)
    const error = Math.hypot(...offset.map((value, axis) => value - projection * unit[axis]))
    const valid = error <= 1e-6 && projection >= previous - 1e-6 && projection <= length + 1e-6
    previous = projection
    return valid
  })
}
