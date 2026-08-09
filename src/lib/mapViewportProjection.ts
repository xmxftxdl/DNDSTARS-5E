export interface MapViewportTransform {
  x: number
  y: number
  scale: number
}

/** Projects one map-world point into the map container's CSS pixel space. */
export function mapWorldPointToViewport(
  point: { x: number; y: number },
  viewport: MapViewportTransform,
): { left: number; top: number } {
  return {
    left: viewport.x + point.x * viewport.scale,
    top: viewport.y + point.y * viewport.scale,
  }
}
