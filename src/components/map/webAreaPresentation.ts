export interface WebStrandSpec {
  points: number[]
  opacity: number
  width: number
  closed?: boolean
}

/**
 * Shared mature web geometry used by both the entrance animation and the
 * persistent map area. Keeping one geometry source prevents the handoff from
 * changing the spell into an unrelated placeholder visual.
 */
export function createWebAreaStrands(width: number, height: number): WebStrandSpec[] {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const halfWidth = safeWidth / 2
  const halfHeight = safeHeight / 2
  const minimumExtent = Math.min(safeWidth, safeHeight)

  const spokes = Array.from({ length: 14 }, (_, index) => {
    const angle = index / 14 * Math.PI * 2
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const extent = 1 / Math.max(
      Math.abs(cosine) / Math.max(1, halfWidth),
      Math.abs(sine) / Math.max(1, halfHeight),
    )
    const endX = cosine * extent
    const endY = sine * extent
    const bend = Math.sin(index * 2.17) * minimumExtent * 0.035
    return {
      points: [
        0, 0,
        endX * 0.34 - sine * bend, endY * 0.34 + cosine * bend,
        endX * 0.68 + sine * bend * 0.7, endY * 0.68 - cosine * bend * 0.7,
        endX, endY,
      ],
      opacity: 0.52 + index % 3 * 0.13,
      width: Math.max(1.2, minimumExtent * (index % 4 === 0 ? 0.013 : 0.008)),
    }
  })

  const rings = [0.2, 0.36, 0.54, 0.73, 0.91].map((radiusScale, ringIndex) => {
    const points = Array.from({ length: 18 }, (_, pointIndex) => {
      const angle = pointIndex / 18 * Math.PI * 2
      const wobble = 1 + Math.sin(pointIndex * 2.63 + ringIndex * 1.71) * 0.045
      return [
        Math.cos(angle) * halfWidth * radiusScale * wobble,
        Math.sin(angle) * halfHeight * radiusScale * wobble,
      ]
    }).flat()
    return {
      points,
      closed: true,
      opacity: 0.44 + ringIndex * 0.08,
      width: Math.max(1.1, minimumExtent * 0.009),
    }
  })

  return [...spokes, ...rings]
}
