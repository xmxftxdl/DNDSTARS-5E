import type { AccountStoryEventV1, AccountStoryTimelineMarkerV1 } from '../../lib/accountApi'

export const STORY_CANVAS_CLICK_MOVE_THRESHOLD_PX = 5
export const STORY_TIMELINE_MARKER_MIN_Y = 16
export const STORY_TIMELINE_MARKER_MAX_Y = 50_000

type StoryTimelineKind = NonNullable<AccountStoryTimelineMarkerV1['timelineKind']>

export interface StoryTimeClue {
  key: string
  label: string
  timelineKind: StoryTimelineKind
  relativeOffsetMinutes?: number
  gameTimeWorldMinute?: number
}

const CHINESE_DIGITS: Readonly<Record<string, number>> = {
  '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
}

function stableTimelineMarkerId(value: string): string {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return `story-time-analysis-${(hash >>> 0).toString(36)}`
}

function normalizedTimeKey(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN').replace(/[\s·•・—_:：，。、“”‘’（）()【】[\]-]+/g, '')
}

function parsedChineseNumber(value: string): number | null {
  const normalized = value.normalize('NFKC').trim()
  if (/^\d+$/.test(normalized)) return Number(normalized)
  if (!/^[零〇一二两三四五六七八九十百]+$/.test(normalized)) return null
  if (!/[十百]/.test(normalized)) {
    const digits = Array.from(normalized).map((character) => CHINESE_DIGITS[character])
    return digits.some((digit) => digit === undefined) ? null : Number(digits.join(''))
  }
  let total = 0
  let current = 0
  for (const character of normalized) {
    const digit = CHINESE_DIGITS[character]
    if (digit !== undefined) {
      current = digit
      continue
    }
    const unit = character === '百' ? 100 : 10
    total += (current || 1) * unit
    current = 0
  }
  return total + current
}

function relativeTimeClue(value: string): Pick<StoryTimeClue, 'key' | 'label' | 'relativeOffsetMinutes' | 'timelineKind'> | null {
  const compact = normalizedTimeKey(value)
  if (!compact || /^(?:时间)?(?:未注明|未知|待定|待确定|不详)$/.test(compact)) return null
  if (/^(?:故事|剧情|冒险)?开始(?:之)?前$|^开场前$/.test(compact)) {
    return { key: 'before-start', label: '故事开始前', timelineKind: 'history' }
  }
  if (/^(?:(?:故事|剧情|冒险)?开始(?:时)?|开场(?:时)?)$/.test(compact)) {
    return { key: 'offset:0', label: '故事开始', relativeOffsetMinutes: 0, timelineKind: 'current' }
  }

  const withoutStart = compact.replace(/^(?:故事|剧情|冒险)?开始后/, '')
  const hasStoryStartPrefix = withoutStart !== compact
  const ordinal = withoutStart.match(/^第([0-9零〇一二两三四五六七八九十百]+)(小时|时|天|日)(?:内|结束时)?$/)
  const elapsed = withoutStart.match(/^([0-9零〇一二两三四五六七八九十百]+)(小时|时|天|日)后$/)
    ?? (hasStoryStartPrefix ? withoutStart.match(/^([0-9零〇一二两三四五六七八九十百]+)(小时|时|天|日)$/) : null)
  const match = ordinal ?? elapsed
  if (!match) return null
  const amount = parsedChineseNumber(match[1]!)
  if (!amount || amount > 10_000) return null
  const isHour = match[2] === '小时' || match[2] === '时'
  const relativeOffsetMinutes = amount * (isHour ? 60 : 1_440)
  return {
    key: `offset:${relativeOffsetMinutes}`,
    label: ordinal ? `第 ${amount} ${isHour ? '小时' : '天'}` : `${amount} ${isHour ? '小时' : '天'}后`,
    relativeOffsetMinutes,
    timelineKind: 'current',
  }
}

/** Converts an analysis time phrase into a stable marker key without inventing clock time. */
export function storyTimeClueForEvent(event: AccountStoryEventV1): StoryTimeClue | null {
  const label = event.timeLabel.trim().slice(0, 160)
  const relative = relativeTimeClue(label)
  const gameTimeWorldMinute = Number.isSafeInteger(event.gameTimeWorldMinute) && Number(event.gameTimeWorldMinute) >= 0
    ? Number(event.gameTimeWorldMinute)
    : undefined
  if (relative) return {
    ...relative,
    timelineKind: relative.timelineKind === 'history' ? 'history' : event.timelineKind ?? relative.timelineKind,
    ...(gameTimeWorldMinute === undefined ? {} : { gameTimeWorldMinute }),
  }
  if (!label || /^(?:时间)?(?:未注明|未知|待定|待确定|不详)$/.test(normalizedTimeKey(label))) return null
  return {
    key: gameTimeWorldMinute === undefined ? `text:${normalizedTimeKey(label)}` : `absolute:${gameTimeWorldMinute}`,
    label,
    timelineKind: event.timelineKind ?? 'current',
    ...(gameTimeWorldMinute === undefined ? {} : { gameTimeWorldMinute }),
  }
}

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

/**
 * Rebuilds only analysis-owned markers. Manual markers and DM-edited marker fields
 * remain untouched, while generated lines stay below the last card in their time bucket.
 * Duplicate source-less markers from the legacy graph are discarded as migration debris.
 */
export function synchronizeAnalysisStoryTimelineMarkers(
  events: readonly AccountStoryEventV1[],
  existingMarkers: readonly AccountStoryTimelineMarkerV1[] = [],
  options: { storyStartWorldMinute?: number; eventHeight?: number; fallbackGap?: number; dismissedSourceKeys?: readonly string[] } = {},
): AccountStoryTimelineMarkerV1[] {
  const groups = new Map<string, { clue: StoryTimeClue; events: AccountStoryEventV1[] }>()
  const dismissedSourceKeys = new Set(options.dismissedSourceKeys ?? [])
  for (const event of events) {
    if (event.source !== 'analysis-timeline') continue
    const clue = storyTimeClueForEvent(event)
    if (!clue || dismissedSourceKeys.has(clue.key) || !event.graphPosition) continue
    const group = groups.get(clue.key)
    if (group) {
      group.events.push(event)
      if (group.clue.gameTimeWorldMinute === undefined && clue.gameTimeWorldMinute !== undefined) group.clue.gameTimeWorldMinute = clue.gameTimeWorldMinute
      if (group.clue.timelineKind === 'conditional' && clue.timelineKind !== 'conditional') group.clue.timelineKind = clue.timelineKind
    } else {
      groups.set(clue.key, { clue: { ...clue }, events: [event] })
    }
  }

  const eventHeight = options.eventHeight ?? 154
  const fallbackGap = options.fallbackGap ?? 112
  const existingByKey = new Map(existingMarkers
    .filter((marker) => marker.source === 'analysis' && marker.sourceKey)
    .map((marker) => [marker.sourceKey!, marker]))
  const generatedMarkerIds = new Set([...groups.keys()].map(stableTimelineMarkerId))
  const generated = [...groups.values()].map(({ clue, events: sourceEvents }) => {
    const lastEventY = Math.max(...sourceEvents.map((event) => event.graphPosition!.y))
    const sourceIds = new Set(sourceEvents.map((event) => event.id))
    const y = storyTimelineYBelowEvent(
      lastEventY,
      eventHeight,
      events.filter((event) => !sourceIds.has(event.id)).flatMap((event) => event.graphPosition ? [event.graphPosition.y] : []),
      fallbackGap,
    )
    const relativeGameTime = clue.relativeOffsetMinutes !== undefined && Number.isSafeInteger(options.storyStartWorldMinute)
      ? Number(options.storyStartWorldMinute) + clue.relativeOffsetMinutes
      : undefined
    const gameTimeWorldMinute = clue.gameTimeWorldMinute ?? relativeGameTime
    const next: AccountStoryTimelineMarkerV1 = {
      id: stableTimelineMarkerId(clue.key),
      y,
      label: clue.label,
      source: 'analysis',
      sourceKey: clue.key,
      sourceEventIds: sourceEvents.map((event) => event.id),
      timelineKind: clue.timelineKind,
      ...(clue.relativeOffsetMinutes === undefined ? {} : { relativeOffsetMinutes: clue.relativeOffsetMinutes }),
      ...(Number.isSafeInteger(gameTimeWorldMinute) && Number(gameTimeWorldMinute) >= 0 ? { gameTimeWorldMinute: Number(gameTimeWorldMinute) } : {}),
    }
    // Older account-server builds persisted the stable generated ID but stripped
    // the source metadata. Recognize that ID as the same marker instead of keeping
    // it as a manual line and appending a duplicate with the very same React key.
    const existing = existingByKey.get(clue.key)
      ?? existingMarkers.find((marker) => marker.id === next.id)
    if (!existing) return next
    const edited = new Set(existing.dmEditedFields ?? [])
    if (existing.source !== 'analysis' || existing.sourceKey !== clue.key) {
      if (existing.y !== next.y) edited.add('y')
      if (existing.label !== next.label) edited.add('label')
      if (existing.gameTimeWorldMinute !== next.gameTimeWorldMinute) edited.add('gameTimeWorldMinute')
    }
    const merged: AccountStoryTimelineMarkerV1 = {
      ...next,
      id: existing.id,
      y: edited.has('y') ? existing.y : next.y,
      label: edited.has('label') ? existing.label : next.label,
      ...(edited.size > 0 ? { dmEditedFields: [...edited] } : {}),
    }
    if (edited.has('gameTimeWorldMinute')) {
      if (existing.gameTimeWorldMinute === undefined) delete merged.gameTimeWorldMinute
      else merged.gameTimeWorldMinute = existing.gameTimeWorldMinute
    }
    return merged
  })
  const legacyManualCounts = new Map<string, number>()
  for (const marker of existingMarkers) {
    if (marker.source !== undefined || marker.sourceKey) continue
    const key = `${marker.label.trim()}\u0000${marker.gameTimeWorldMinute ?? 'unbound'}`
    legacyManualCounts.set(key, (legacyManualCounts.get(key) ?? 0) + 1)
  }
  const manual = existingMarkers.filter((marker) => {
    if (marker.source === 'analysis' && marker.sourceKey) return false
    if (generatedMarkerIds.has(marker.id)) return false
    if (marker.source === undefined && !marker.sourceKey && marker.label.trim() === '时间待设置') return false
    if (marker.source !== undefined || marker.sourceKey) return true
    const key = `${marker.label.trim()}\u0000${marker.gameTimeWorldMinute ?? 'unbound'}`
    return (legacyManualCounts.get(key) ?? 0) < 2
  })
  return [...manual, ...generated].sort((left, right) => left.y - right.y || left.id.localeCompare(right.id))
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
    source: 'manual',
    ...(gameTimeWorldMinute === undefined ? {} : { gameTimeWorldMinute }),
  }
}
