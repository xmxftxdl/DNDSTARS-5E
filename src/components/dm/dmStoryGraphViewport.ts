const MIN_ZOOM = 0.25
const MAX_ZOOM = 1.8

export function clampStoryGraphZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}

export function storyGraphFitZoom(input: {
  viewportWidth: number
  viewportHeight: number
  canvasWidth: number
  canvasHeight: number
  padding?: number
}): number {
  const padding = Math.max(0, input.padding ?? 48)
  const availableWidth = Math.max(1, input.viewportWidth - padding * 2)
  const availableHeight = Math.max(1, input.viewportHeight - padding * 2)
  return clampStoryGraphZoom(Math.min(
    availableWidth / Math.max(1, input.canvasWidth),
    availableHeight / Math.max(1, input.canvasHeight),
    1.1,
  ))
}

export function storyGraphCenteredScroll(input: {
  viewportWidth: number
  viewportHeight: number
  canvasWidth: number
  canvasHeight: number
  zoom: number
}): { left: number; top: number } {
  return {
    left: Math.max(0, (input.canvasWidth * input.zoom - input.viewportWidth) / 2),
    top: Math.max(0, (input.canvasHeight * input.zoom - input.viewportHeight) / 2),
  }
}

export function storyGraphAnchoredScroll(input: {
  viewportWidth: number
  viewportHeight: number
  canvasWidth: number
  canvasHeight: number
  previousZoom: number
  nextZoom: number
  scrollLeft: number
  scrollTop: number
  anchorX: number
  anchorY: number
}): { left: number; top: number } {
  const previousOffsetX = Math.max(0, (input.viewportWidth - input.canvasWidth * input.previousZoom) / 2)
  const previousOffsetY = Math.max(0, (input.viewportHeight - input.canvasHeight * input.previousZoom) / 2)
  const graphX = (input.scrollLeft + input.anchorX - previousOffsetX) / input.previousZoom
  const graphY = (input.scrollTop + input.anchorY - previousOffsetY) / input.previousZoom
  const nextOffsetX = Math.max(0, (input.viewportWidth - input.canvasWidth * input.nextZoom) / 2)
  const nextOffsetY = Math.max(0, (input.viewportHeight - input.canvasHeight * input.nextZoom) / 2)
  return {
    left: Math.max(0, nextOffsetX + graphX * input.nextZoom - input.anchorX),
    top: Math.max(0, nextOffsetY + graphY * input.nextZoom - input.anchorY),
  }
}
