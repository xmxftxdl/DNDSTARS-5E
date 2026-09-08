import type { AccountStoryEventLinkV1, AccountStoryEventV1 } from '../../lib/accountApi'
import { storyTimeClueForEvent } from './dmStoryTimelineMarkers'

export const STORY_GRAPH_NODE_WIDTH = 304
export const STORY_GRAPH_NODE_HEIGHT = 154
export const STORY_GRAPH_NODE_GAP_X = 124
export const STORY_GRAPH_NODE_GAP_Y = 112
export const STORY_GRAPH_MIN_CANVAS_WIDTH = 1_280

const EDGE_LABEL_HEIGHT = 30
const EDGE_LABEL_MIN_WIDTH = 96
const EDGE_LABEL_MAX_WIDTH = 380

export interface StoryGraphEdgeLabelLayout {
  linkId: string
  x: number
  y: number
  width: number
  height: number
}

interface StoryGraphMetrics {
  nodeWidth: number
  nodeHeight: number
  nodeGapX: number
  nodeGapY: number
  minCanvasWidth: number
  top: number
}

const EDIT_METRICS: StoryGraphMetrics = {
  nodeWidth: STORY_GRAPH_NODE_WIDTH,
  nodeHeight: STORY_GRAPH_NODE_HEIGHT,
  nodeGapX: STORY_GRAPH_NODE_GAP_X,
  nodeGapY: STORY_GRAPH_NODE_GAP_Y,
  minCanvasWidth: STORY_GRAPH_MIN_CANVAS_WIDTH,
  top: 64,
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function intersectionArea(left: Rect, right: Rect, padding = 0): number {
  const width = Math.min(left.x + left.width + padding, right.x + right.width + padding)
    - Math.max(left.x - padding, right.x - padding)
  const height = Math.min(left.y + left.height + padding, right.y + right.height + padding)
    - Math.max(left.y - padding, right.y - padding)
  return width > 0 && height > 0 ? width * height : 0
}

function cubicPoint(start: number, controlA: number, controlB: number, end: number, t: number): number {
  const inverse = 1 - t
  return inverse ** 3 * start
    + 3 * inverse ** 2 * t * controlA
    + 3 * inverse * t ** 2 * controlB
    + t ** 3 * end
}

/**
 * Places branch labels beside their connector while keeping them away from cards and
 * from labels already placed. This is intentionally deterministic so a refresh does
 * not make the graph appear to jump.
 */
export function layoutStoryGraphEdgeLabels(
  links: readonly AccountStoryEventLinkV1[],
  positions: Readonly<Record<string, { x: number; y: number }>>,
  labelForLink: (link: AccountStoryEventLinkV1) => string,
  metrics: Pick<StoryGraphMetrics, 'nodeWidth' | 'nodeHeight'> = EDIT_METRICS,
): StoryGraphEdgeLabelLayout[] {
  const nodeRects = Object.values(positions).map((position) => ({
    x: position.x,
    y: position.y,
    width: metrics.nodeWidth,
    height: metrics.nodeHeight,
  }))
  const placed: StoryGraphEdgeLabelLayout[] = []

  for (const [linkIndex, link] of links.entries()) {
    const label = labelForLink(link)
    const from = positions[link.fromEventId]
    const to = positions[link.toEventId]
    if (!label || !from || !to) continue

    const width = Math.min(EDGE_LABEL_MAX_WIDTH, Math.max(EDGE_LABEL_MIN_WIDTH, label.length * 13 + 28))
    const startX = from.x + metrics.nodeWidth / 2
    const startY = from.y + metrics.nodeHeight
    const endX = to.x + metrics.nodeWidth / 2
    const endY = to.y
    const bend = Math.max(64, Math.abs(endY - startY) * 0.46)
    const tOrder = [0.5, 0.38, 0.62, 0.28, 0.72]
    const yOffsets = [0, -38, 38, -76, 76]
    const xOffsets = [0, -56, 56, -112, 112]
    const candidates: Rect[] = []

    for (const t of tOrder) {
      const centerX = cubicPoint(startX, startX, endX, endX, t)
      const centerY = cubicPoint(startY, startY + bend, endY - bend, endY, t)
      for (const yOffset of yOffsets) {
        for (const xOffset of xOffsets) {
          candidates.push({
            x: centerX + xOffset - width / 2,
            y: centerY + yOffset - EDGE_LABEL_HEIGHT / 2,
            width,
            height: EDGE_LABEL_HEIGHT,
          })
        }
      }
    }

    const preferred = candidates[0]!
    let best = preferred
    let bestScore = Number.POSITIVE_INFINITY
    for (const candidate of candidates) {
      const nodeCollision = nodeRects.reduce((total, node) => total + intersectionArea(candidate, node, 14), 0)
      const labelCollision = placed.reduce((total, previous) => total + intersectionArea(candidate, previous, 10), 0)
      const displacement = Math.abs(candidate.x - preferred.x) * 0.25 + Math.abs(candidate.y - preferred.y) * 0.4
      const boundsPenalty = candidate.x < 12 || candidate.y < 12 ? 1_000_000 : 0
      const stableTieBreak = ((linkIndex + candidates.indexOf(candidate)) % 7) * 0.001
      const score = boundsPenalty + nodeCollision * 100 + labelCollision * 180 + displacement + stableTieBreak
      if (score < bestScore) {
        best = candidate
        bestScore = score
      }
    }

    placed.push({ linkId: link.id, ...best })
  }

  return placed
}

function layoutStoryGraphPositions(
  events: readonly AccountStoryEventV1[],
  links: readonly AccountStoryEventLinkV1[],
  metrics: StoryGraphMetrics,
): Record<string, { x: number; y: number }> {
  const ids = new Set(events.map((event) => event.id))
  const incoming = new Map(events.map((event) => [event.id, 0]))
  const outgoing = new Map(events.map((event) => [event.id, [] as string[]]))
  let validLinkCount = 0
  for (const link of links) {
    if (!ids.has(link.fromEventId) || !ids.has(link.toEventId) || link.fromEventId === link.toEventId) continue
    validLinkCount += 1
    incoming.set(link.toEventId, (incoming.get(link.toEventId) ?? 0) + 1)
    outgoing.get(link.fromEventId)?.push(link.toEventId)
  }

  // An empty graph is still useful as a chronological event list. Putting every root on level
  // zero creates an extremely wide, mostly clipped strip, so keep the analysis order vertically.
  if (validLinkCount === 0) {
    const centeredX = (metrics.minCanvasWidth - metrics.nodeWidth) / 2
    return Object.fromEntries(events.map((event, index) => [event.id, {
      x: centeredX,
      y: metrics.top + index * (metrics.nodeHeight + metrics.nodeGapY),
    }]))
  }

  const levels = new Map<string, number>()
  const queue = events.filter((event) => (incoming.get(event.id) ?? 0) === 0).map((event) => event.id)
  if (queue.length === 0 && events[0]) queue.push(events[0].id)
  queue.forEach((id) => levels.set(id, 0))
  const processed = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift()!
    if (processed.has(id)) continue
    processed.add(id)
    const level = levels.get(id) ?? 0
    for (const targetId of outgoing.get(id) ?? []) {
      levels.set(targetId, Math.max(levels.get(targetId) ?? 0, level + 1))
      incoming.set(targetId, (incoming.get(targetId) ?? 1) - 1)
      if ((incoming.get(targetId) ?? 0) <= 0) queue.push(targetId)
    }
  }
  let fallbackLevel = Math.max(0, ...levels.values())
  for (const event of events) if (!levels.has(event.id)) levels.set(event.id, ++fallbackLevel)

  // Causal depth is the primary layout constraint. Distinct, explicitly ordered
  // analysis time buckets add a second floor so two different hours cannot share
  // one row and produce overlapping separators.
  const chronology = [...events]
    .filter((event) => event.source === 'analysis-timeline' && storyTimeClueForEvent(event))
    .sort((left, right) => (
      (left.timelineOrder ?? Number.MAX_SAFE_INTEGER) - (right.timelineOrder ?? Number.MAX_SAFE_INTEGER)
      || events.indexOf(left) - events.indexOf(right)
    ))
  const groups: Array<{ key: string; events: AccountStoryEventV1[] }> = []
  const byTimeKey = new Map<string, { key: string; events: AccountStoryEventV1[] }>()
  for (const event of chronology) {
    const key = storyTimeClueForEvent(event)!.key
    const existing = byTimeKey.get(key)
    if (existing) existing.events.push(event)
    else {
      const group = { key, events: [event] }
      groups.push(group)
      byTimeKey.set(key, group)
    }
  }
  let previousTimeLevel = -1
  for (const group of groups) {
    const baseLevels = group.events.map((event) => levels.get(event.id) ?? 0)
    const shift = Math.max(0, previousTimeLevel + 1 - Math.min(...baseLevels))
    for (const event of group.events) levels.set(event.id, (levels.get(event.id) ?? 0) + shift)
    previousTimeLevel = Math.max(previousTimeLevel, ...group.events.map((event) => levels.get(event.id) ?? 0))
  }

  const byLevel = new Map<number, AccountStoryEventV1[]>()
  for (const event of events) {
    const level = levels.get(event.id) ?? 0
    byLevel.set(level, [...(byLevel.get(level) ?? []), event])
  }
  const maxColumns = Math.max(1, ...[...byLevel.values()].map((entries) => entries.length))
  const fullRowWidth = maxColumns * metrics.nodeWidth + (maxColumns - 1) * metrics.nodeGapX
  const layoutWidth = Math.max(metrics.minCanvasWidth, fullRowWidth + 120)
  const positionById = new Map<string, { x: number; y: number }>()
  for (const [level, entries] of byLevel) {
    const rowWidth = entries.length * metrics.nodeWidth + (entries.length - 1) * metrics.nodeGapX
    const startX = (layoutWidth - rowWidth) / 2
    entries.forEach((event, column) => positionById.set(event.id, {
      x: startX + column * (metrics.nodeWidth + metrics.nodeGapX),
      y: metrics.top + level * (metrics.nodeHeight + metrics.nodeGapY),
    }))
  }
  return Object.fromEntries(events.map((event) => [event.id, positionById.get(event.id) ?? event.graphPosition ?? { x: 0, y: 0 }]))
}

export function layoutStoryGraphEvents(events: readonly AccountStoryEventV1[], links: readonly AccountStoryEventLinkV1[]): AccountStoryEventV1[] {
  const positions = layoutStoryGraphPositions(events, links, EDIT_METRICS)
  return events.map((event) => ({ ...event, graphPosition: positions[event.id] }))
}

export function prioritizeSelectedStoryEntries<T extends { id: string }>(entries: readonly T[], selectedIds: readonly string[]): T[] {
  const selected = new Set(selectedIds)
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => Number(selected.has(right.entry.id)) - Number(selected.has(left.entry.id)) || left.index - right.index)
    .map(({ entry }) => entry)
}
