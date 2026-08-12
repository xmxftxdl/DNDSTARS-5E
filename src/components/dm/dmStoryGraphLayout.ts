import type { AccountStoryEventLinkV1, AccountStoryEventV1 } from '../../lib/accountApi'

export const STORY_GRAPH_NODE_WIDTH = 304
export const STORY_GRAPH_NODE_HEIGHT = 210
export const STORY_GRAPH_NODE_GAP_X = 124
export const STORY_GRAPH_NODE_GAP_Y = 176
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
): StoryGraphEdgeLabelLayout[] {
  const nodeRects = Object.values(positions).map((position) => ({
    x: position.x,
    y: position.y,
    width: STORY_GRAPH_NODE_WIDTH,
    height: STORY_GRAPH_NODE_HEIGHT,
  }))
  const placed: StoryGraphEdgeLabelLayout[] = []

  for (const [linkIndex, link] of links.entries()) {
    const label = labelForLink(link)
    const from = positions[link.fromEventId]
    const to = positions[link.toEventId]
    if (!label || !from || !to) continue

    const width = Math.min(EDGE_LABEL_MAX_WIDTH, Math.max(EDGE_LABEL_MIN_WIDTH, label.length * 13 + 28))
    const startX = from.x + STORY_GRAPH_NODE_WIDTH / 2
    const startY = from.y + STORY_GRAPH_NODE_HEIGHT
    const endX = to.x + STORY_GRAPH_NODE_WIDTH / 2
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

export function layoutStoryGraphEvents(events: readonly AccountStoryEventV1[], links: readonly AccountStoryEventLinkV1[]): AccountStoryEventV1[] {
  const ids = new Set(events.map((event) => event.id))
  const incoming = new Map(events.map((event) => [event.id, 0]))
  const outgoing = new Map(events.map((event) => [event.id, [] as string[]]))
  for (const link of links) {
    if (!ids.has(link.fromEventId) || !ids.has(link.toEventId) || link.fromEventId === link.toEventId) continue
    incoming.set(link.toEventId, (incoming.get(link.toEventId) ?? 0) + 1)
    outgoing.get(link.fromEventId)?.push(link.toEventId)
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

  const byLevel = new Map<number, AccountStoryEventV1[]>()
  for (const event of events) {
    const level = levels.get(event.id) ?? 0
    byLevel.set(level, [...(byLevel.get(level) ?? []), event])
  }
  const maxColumns = Math.max(1, ...[...byLevel.values()].map((entries) => entries.length))
  const fullRowWidth = maxColumns * STORY_GRAPH_NODE_WIDTH + (maxColumns - 1) * STORY_GRAPH_NODE_GAP_X
  const layoutWidth = Math.max(STORY_GRAPH_MIN_CANVAS_WIDTH, fullRowWidth + 160)
  const positionById = new Map<string, { x: number; y: number }>()
  for (const [level, entries] of byLevel) {
    const rowWidth = entries.length * STORY_GRAPH_NODE_WIDTH + (entries.length - 1) * STORY_GRAPH_NODE_GAP_X
    const startX = (layoutWidth - rowWidth) / 2
    entries.forEach((event, column) => positionById.set(event.id, {
      x: startX + column * (STORY_GRAPH_NODE_WIDTH + STORY_GRAPH_NODE_GAP_X),
      y: 64 + level * (STORY_GRAPH_NODE_HEIGHT + STORY_GRAPH_NODE_GAP_Y),
    }))
  }
  return events.map((event) => ({ ...event, graphPosition: positionById.get(event.id) ?? event.graphPosition }))
}

export function prioritizeSelectedStoryEntries<T extends { id: string }>(entries: readonly T[], selectedIds: readonly string[]): T[] {
  const selected = new Set(selectedIds)
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => Number(selected.has(right.entry.id)) - Number(selected.has(left.entry.id)) || left.index - right.index)
    .map(({ entry }) => entry)
}
