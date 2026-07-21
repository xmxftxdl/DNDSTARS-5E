import { publishSharedEvent } from './sharedApi'

export const MAP_TABLETOP_CHANNEL = 'map-tabletop'
export const MAP_PING_LIFETIME_MS = 3_200
export const MAP_ANNOTATION_LIFETIME_MS = 30 * 60 * 1_000

export type MapTabletopTool = 'none' | 'focus' | 'arrow' | 'circle'

export interface MapTabletopPoint {
  x: number
  y: number
}

interface MapTabletopEventBase {
  id: string
  mapId: string
  memberId: string
  memberName: string
  role: 'dm' | 'player'
  createdAt: number
  expiresAt: number
}

export interface MapTabletopPing extends MapTabletopEventBase {
  type: 'ping'
  point: MapTabletopPoint
}

export interface MapTabletopFocus extends MapTabletopEventBase {
  type: 'focus'
  point: MapTabletopPoint
  scale?: number
}

export interface MapTabletopAnnotation extends MapTabletopEventBase {
  type: 'annotation'
  shape: 'arrow' | 'circle'
  from: MapTabletopPoint
  to: MapTabletopPoint
  color: string
}

export interface MapTabletopClear extends MapTabletopEventBase {
  type: 'clear-annotations'
}

export type MapTabletopEvent =
  | MapTabletopPing
  | MapTabletopFocus
  | MapTabletopAnnotation
  | MapTabletopClear

export interface MapTabletopState {
  pings: MapTabletopPing[]
  annotations: MapTabletopAnnotation[]
  focus: MapTabletopFocus | null
}

export const EMPTY_MAP_TABLETOP_STATE: MapTabletopState = {
  pings: [],
  annotations: [],
  focus: null,
}

function validPoint(value: unknown): value is MapTabletopPoint {
  if (!value || typeof value !== 'object') return false
  const point = value as Partial<MapTabletopPoint>
  return Number.isFinite(point.x) && Number.isFinite(point.y) &&
    Math.abs(Number(point.x)) <= 1_000_000 && Math.abs(Number(point.y)) <= 1_000_000
}

export function parseMapTabletopEvent(value: unknown): MapTabletopEvent | null {
  if (!value || typeof value !== 'object') return null
  const event = value as Partial<MapTabletopEvent>
  if (
    typeof event.id !== 'string' || event.id.length < 8 || event.id.length > 160 ||
    typeof event.mapId !== 'string' || !event.mapId || event.mapId.length > 160 ||
    typeof event.memberId !== 'string' || !event.memberId || event.memberId.length > 160 ||
    typeof event.memberName !== 'string' || !event.memberName || event.memberName.length > 80 ||
    (event.role !== 'dm' && event.role !== 'player') ||
    !Number.isFinite(event.createdAt) || !Number.isFinite(event.expiresAt)
  ) return null
  if ((event.type === 'ping' || event.type === 'focus') && validPoint(event.point)) {
    if (event.type === 'focus' && event.scale != null && (!Number.isFinite(event.scale) || event.scale < 0.1 || event.scale > 4)) {
      return null
    }
    return event as MapTabletopPing | MapTabletopFocus
  }
  if (event.type === 'annotation') {
    if (
      (event.shape !== 'arrow' && event.shape !== 'circle') ||
      !validPoint(event.from) || !validPoint(event.to) ||
      typeof event.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(event.color)
    ) return null
    return event as MapTabletopAnnotation
  }
  return event.type === 'clear-annotations' ? event as MapTabletopClear : null
}

export function reduceMapTabletopState(
  current: MapTabletopState,
  value: unknown,
  now = Date.now(),
): MapTabletopState {
  const event = parseMapTabletopEvent(value)
  const pings = current.pings.filter((ping) => ping.expiresAt > now)
  const annotations = current.annotations.filter((annotation) => annotation.expiresAt > now)
  const focus = current.focus?.expiresAt && current.focus.expiresAt > now ? current.focus : null
  if (!event || event.expiresAt <= now) return { pings, annotations, focus }
  if (event.type === 'ping') {
    return { pings: [...pings.filter((ping) => ping.id !== event.id), event].slice(-24), annotations, focus }
  }
  if (event.type === 'focus') return { pings, annotations, focus: event }
  if (event.type === 'clear-annotations') {
    return { pings, annotations: annotations.filter((annotation) => annotation.mapId !== event.mapId), focus }
  }
  return {
    pings,
    annotations: [...annotations.filter((annotation) => annotation.id !== event.id), event].slice(-120),
    focus,
  }
}

export function mapTabletopForMap(state: MapTabletopState, mapId: string, now = Date.now()) {
  return {
    pings: state.pings.filter((ping) => ping.mapId === mapId && ping.expiresAt > now),
    annotations: state.annotations.filter((annotation) => annotation.mapId === mapId && annotation.expiresAt > now),
    focus: state.focus?.mapId === mapId && state.focus.expiresAt > now ? state.focus : null,
  }
}

export async function publishMapTabletopPing(mapId: string, point: MapTabletopPoint): Promise<void> {
  await publishSharedEvent(MAP_TABLETOP_CHANNEL, { type: 'ping', mapId, point })
}

export async function publishMapTabletopFocus(mapId: string, point: MapTabletopPoint, scale?: number): Promise<void> {
  await publishSharedEvent(MAP_TABLETOP_CHANNEL, { type: 'focus', mapId, point, ...(scale ? { scale } : {}) })
}

export async function publishMapTabletopAnnotation(input: {
  mapId: string
  shape: 'arrow' | 'circle'
  from: MapTabletopPoint
  to: MapTabletopPoint
  color?: string
}): Promise<void> {
  await publishSharedEvent(MAP_TABLETOP_CHANNEL, {
    type: 'annotation',
    mapId: input.mapId,
    shape: input.shape,
    from: input.from,
    to: input.to,
    color: input.color ?? '#fbbf24',
  })
}

export async function clearMapTabletopAnnotations(mapId: string): Promise<void> {
  await publishSharedEvent(MAP_TABLETOP_CHANNEL, { type: 'clear-annotations', mapId })
}
