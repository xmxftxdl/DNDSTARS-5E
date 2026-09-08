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

export function storyGraphNewNodePosition(input: {
  viewportWidth: number
  viewportHeight: number
  scrollLeft: number
  scrollTop: number
  zoom: number
  nodeWidth: number
  nodeHeight: number
  occupied: ReadonlyArray<{ x: number; y: number }>
  gap?: number
  margin?: number
}): { x: number; y: number } {
  const zoom = Math.max(0.01, input.zoom)
  const gap = Math.max(0, input.gap ?? 24)
  const margin = Math.max(0, input.margin ?? 24)
  const visibleLeft = input.scrollLeft / zoom
  const visibleTop = input.scrollTop / zoom
  const visibleWidth = input.viewportWidth / zoom
  const visibleHeight = input.viewportHeight / zoom
  const usableWidth = Math.max(input.nodeWidth, visibleWidth - margin * 2)
  const usableHeight = Math.max(input.nodeHeight, visibleHeight - margin * 2)
  const columns = Math.max(1, Math.floor((usableWidth + gap) / (input.nodeWidth + gap)))
  const rows = Math.max(1, Math.floor((usableHeight + gap) / (input.nodeHeight + gap)))
  const originX = Math.max(0, visibleLeft + (visibleWidth - (columns * input.nodeWidth + (columns - 1) * gap)) / 2)
  const originY = Math.max(0, visibleTop + (visibleHeight - (rows * input.nodeHeight + (rows - 1) * gap)) / 2)
  const centerX = visibleLeft + visibleWidth / 2
  const centerY = visibleTop + visibleHeight / 2
  const overlaps = (candidate: { x: number; y: number }) => input.occupied.some((position) => (
    candidate.x < position.x + input.nodeWidth + gap
    && candidate.x + input.nodeWidth + gap > position.x
    && candidate.y < position.y + input.nodeHeight + gap
    && candidate.y + input.nodeHeight + gap > position.y
  ))
  const candidates = Array.from({ length: columns * rows }, (_, index) => ({
    x: originX + (index % columns) * (input.nodeWidth + gap),
    y: originY + Math.floor(index / columns) * (input.nodeHeight + gap),
  })).sort((left, right) => (
    Math.hypot(left.x + input.nodeWidth / 2 - centerX, left.y + input.nodeHeight / 2 - centerY)
    - Math.hypot(right.x + input.nodeWidth / 2 - centerX, right.y + input.nodeHeight / 2 - centerY)
  ))
  const available = candidates.find((candidate) => !overlaps(candidate))
  const fallback = available ?? {
    x: Math.max(0, centerX - input.nodeWidth / 2),
    y: Math.max(0, centerY - input.nodeHeight / 2),
  }
  return { x: Math.round(fallback.x * 100) / 100, y: Math.round(fallback.y * 100) / 100 }
}
