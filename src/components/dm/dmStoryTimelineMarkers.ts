import type { AccountStoryTimelineMarkerV1 } from '../../lib/accountApi'

export const STORY_CANVAS_CLICK_MOVE_THRESHOLD_PX = 5
export const STORY_TIMELINE_MARKER_MIN_Y = 16
export const STORY_TIMELINE_MARKER_MAX_Y = 50_000

export function storyCanvasGestureIsClick(deltaX: number, deltaY: number): boolean {
  return Math.hypot(deltaX, deltaY) < STORY_CANVAS_CLICK_MOVE_THRESHOLD_PX
}

export function clampStoryTimelineMarkerY(y: number): number {
  return Math.max(STORY_TIMELINE_MARKER_MIN_Y, Math.min(STORY_TIMELINE_MARKER_MAX_Y, Math.round(y)))
}

export function moveStoryTimelineMarkerY(startY: number, pointerDeltaY: number, zoom: number): number {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return clampStoryTimelineMarkerY(startY + pointerDeltaY / safeZoom)
}

export function storyTimelineMarkerIsReached(marker: AccountStoryTimelineMarkerV1, currentWorldMinute: number): boolean {
  return Number.isSafeInteger(marker.gameTimeWorldMinute)
    && Number(marker.gameTimeWorldMinute) <= currentWorldMinute
}

export function currentStoryTimelineY(
  markers: readonly AccountStoryTimelineMarkerV1[],
  currentWorldMinute: number,
): number | null {
  const reached = markers
    .filter((marker) => storyTimelineMarkerIsReached(marker, currentWorldMinute))
    .sort((left, right) => Number(right.gameTimeWorldMinute) - Number(left.gameTimeWorldMinute))
  return reached[0]?.y ?? null
}

export function storyEventIsBeforeTimeline(eventY: number, eventHeight: number, timelineY: number | null): boolean {
  return timelineY !== null && eventY + eventHeight <= timelineY
}

export function storyTimelineYBelowEvent(
  eventY: number,
  eventHeight: number,
  otherEventYs: readonly number[],
  fallbackGap: number,
): number {
  const eventBottom = eventY + eventHeight
  const nextEventY = Math.min(...otherEventYs.filter((candidateY) => candidateY > eventBottom))
  const y = Number.isFinite(nextEventY)
    ? eventBottom + (nextEventY - eventBottom) / 2
    : eventBottom + fallbackGap / 2
  return clampStoryTimelineMarkerY(y)
}

export function createStoryTimelineMarker(
  y: number,
  options: { label?: string; gameTimeWorldMinute?: number } = {},
): AccountStoryTimelineMarkerV1 {
  const gameTimeWorldMinute = Number.isSafeInteger(options.gameTimeWorldMinute) && Number(options.gameTimeWorldMinute) >= 0
    ? Number(options.gameTimeWorldMinute)
    : undefined
  return {
    id: `story-time-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    y: clampStoryTimelineMarkerY(y),
    label: options.label?.trim().slice(0, 160) || '时间待设置',
    ...(gameTimeWorldMinute === undefined ? {} : { gameTimeWorldMinute }),
  }
}
