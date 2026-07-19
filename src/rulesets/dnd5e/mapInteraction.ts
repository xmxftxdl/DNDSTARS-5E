import type { BattleMap, Token } from '../../store/maps'
import type { MapGeometryDoor, MapGeometryState } from '../../lib/mapGeometry'

export type Dnd5eMapInteractionOperation = 'open' | 'close' | 'unlock' | 'break' | 'inspect' | 'search'
export type Dnd5eMapInteractionMethod = 'interact' | 'key' | 'thieves-tools' | 'force' | 'perception' | 'investigation'

export type Dnd5eMapInteractionPayload =
  | {
      doorId: string
      operation: Exclude<Dnd5eMapInteractionOperation, 'search'>
      method?: Dnd5eMapInteractionMethod
    }
  | {
      operation: 'search'
      point: { x: number; y: number }
      method: 'perception' | 'investigation'
    }

export interface PreparedDnd5eMapInteraction {
  door?: MapGeometryDoor
  interactionId: string
  label: string
  blindSearch: boolean
  operation: Dnd5eMapInteractionOperation
  method: Dnd5eMapInteractionMethod
  dc?: number
  checkAbility?: 'str' | 'dex' | 'int' | 'wis'
  checkSkill?: 'athletics' | 'sleightOfHand' | 'investigation' | 'perception'
  spendAction: boolean
  turnCost: 'object-interaction' | 'action'
  automaticSuccess: boolean
  nextDoorState?: 'open' | 'closed'
}

export type PrepareDnd5eMapInteractionResult =
  | { ok: true; prepared: PreparedDnd5eMapInteraction }
  | { ok: false; reason: string }

const DEFAULT_LOCK_PICK_DC = 15
const DEFAULT_BREAK_DC = 15
const DEFAULT_SECRET_DC = 15

function doorMidpoint(door: MapGeometryDoor) {
  return {
    x: (door.points[0].x + door.points[1].x) / 2,
    y: (door.points[0].y + door.points[1].y) / 2,
  }
}

function withinInteractionReach(map: BattleMap, actor: Token, door: MapGeometryDoor): boolean {
  const midpoint = doorMidpoint(door)
  const gridSize = Math.max(1, map.gridSize)
  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  const reachPx = (5 / feetPerCell) * gridSize + gridSize * Math.max(1, actor.size) * 0.5
  return Math.hypot(actor.x - midpoint.x, actor.y - midpoint.y) <= reachPx
}

function finiteMapPoint(map: BattleMap, point: { x: number; y: number }): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.y >= 0 && point.x <= map.width && point.y <= map.height
}

function prepareBlindSecretDoorSearch(input: {
  map: BattleMap
  geometry?: MapGeometryState
  actor: Token
  payload: Extract<Dnd5eMapInteractionPayload, { operation: 'search' }>
}): PrepareDnd5eMapInteractionResult {
  const { point } = input.payload
  if (!finiteMapPoint(input.map, point)) return { ok: false, reason: 'invalid-search-point' }
  const gridSize = Math.max(1, input.map.gridSize)
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const actorSearchReachPx = (10 / feetPerCell) * gridSize + gridSize * Math.max(1, input.actor.size) * 0.5
  if (Math.hypot(input.actor.x - point.x, input.actor.y - point.y) > actorSearchReachPx) {
    return { ok: false, reason: 'search-area-out-of-reach' }
  }
  const targetRadiusPx = (5 / feetPerCell) * gridSize
  const door = (input.geometry?.doors ?? [])
    .filter((candidate) => candidate.secret && Math.hypot(
      doorMidpoint(candidate).x - point.x,
      doorMidpoint(candidate).y - point.y,
    ) <= targetRadiusPx)
    .sort((left, right) => {
      const leftPoint = doorMidpoint(left)
      const rightPoint = doorMidpoint(right)
      return Math.hypot(leftPoint.x - point.x, leftPoint.y - point.y) -
        Math.hypot(rightPoint.x - point.x, rightPoint.y - point.y)
    })[0]
  const method = input.payload.method
  return {
    ok: true,
    prepared: {
      ...(door ? { door } : {}),
      interactionId: `search:${Math.round(point.x)}:${Math.round(point.y)}`,
      label: '选定区域',
      blindSearch: true,
      operation: 'search',
      method,
      dc: door?.interaction?.secretDc ?? DEFAULT_SECRET_DC,
      checkAbility: method === 'investigation' ? 'int' : 'wis',
      checkSkill: method,
      turnCost: 'action',
      spendAction: true,
      automaticSuccess: false,
    },
  }
}

export function prepareDnd5eMapInteraction(input: {
  map: BattleMap
  geometry?: MapGeometryState
  actor: Token
  payload: Dnd5eMapInteractionPayload
  hasMatchingKey?: boolean
  hasThievesTools?: boolean
}): PrepareDnd5eMapInteractionResult {
  const payload = input.payload
  if (payload.operation === 'search') {
    return prepareBlindSecretDoorSearch({
      map: input.map,
      geometry: input.geometry,
      actor: input.actor,
      payload,
    })
  }
  const door = input.geometry?.doors.find((candidate) => candidate.id === payload.doorId)
  if (!door) return { ok: false, reason: 'door-not-found' }
  if (!withinInteractionReach(input.map, input.actor, door)) return { ok: false, reason: 'door-out-of-reach' }

  const interaction = door.interaction
  const operation = payload.operation
  if (operation === 'open') {
    if (door.state === 'open') return { ok: false, reason: 'door-already-open' }
    if (door.state === 'locked') return { ok: false, reason: 'door-locked' }
    return { ok: true, prepared: { door, interactionId: `${operation}:${door.id}`, label: door.label, blindSearch: false, operation, method: 'interact', spendAction: false, turnCost: 'object-interaction', automaticSuccess: true, nextDoorState: 'open' } }
  }
  if (operation === 'close') {
    if (door.state !== 'open') return { ok: false, reason: 'door-not-open' }
    return { ok: true, prepared: { door, interactionId: `${operation}:${door.id}`, label: door.label, blindSearch: false, operation, method: 'interact', spendAction: false, turnCost: 'object-interaction', automaticSuccess: true, nextDoorState: 'closed' } }
  }
  if (operation === 'unlock') {
    if (door.state !== 'locked') return { ok: false, reason: 'door-not-locked' }
    if (payload.method === 'key' && input.hasMatchingKey) {
      return { ok: true, prepared: { door, interactionId: `${operation}:${door.id}`, label: door.label, blindSearch: false, operation, method: 'key', spendAction: false, turnCost: 'object-interaction', automaticSuccess: true, nextDoorState: 'closed' } }
    }
    if (interaction?.requiresThievesTools !== false && !input.hasThievesTools) {
      return { ok: false, reason: 'thieves-tools-required' }
    }
    return {
      ok: true,
      prepared: {
        door, interactionId: `${operation}:${door.id}`, label: door.label, blindSearch: false,
        operation, method: 'thieves-tools', dc: interaction?.lockPickDc ?? DEFAULT_LOCK_PICK_DC,
        checkAbility: 'dex', checkSkill: 'sleightOfHand', spendAction: true, turnCost: 'action', automaticSuccess: false,
        nextDoorState: 'closed',
      },
    }
  }
  if (operation === 'break') {
    if (door.state === 'open') return { ok: false, reason: 'door-already-open' }
    return {
      ok: true,
      prepared: {
        door, interactionId: `${operation}:${door.id}`, label: door.label, blindSearch: false,
        operation, method: 'force', dc: interaction?.breakDc ?? DEFAULT_BREAK_DC,
        checkAbility: 'str', checkSkill: 'athletics', spendAction: true, turnCost: 'action', automaticSuccess: false,
        nextDoorState: 'open',
      },
    }
  }
  const method = payload.method === 'investigation' ? 'investigation' : 'perception'
  return {
    ok: true,
    prepared: {
      door, interactionId: `${operation}:${door.id}`, label: door.label, blindSearch: false,
      operation, method, dc: interaction?.secretDc ?? DEFAULT_SECRET_DC,
      checkAbility: method === 'investigation' ? 'int' : 'wis',
      checkSkill: method, turnCost: 'action',
      spendAction: true,
      automaticSuccess: false,
    },
  }
}

export function resolveDnd5eMapInteraction(input: {
  prepared: PreparedDnd5eMapInteraction
  d20?: number
  modifier?: number
  adjustedDc?: number
  dmOverride?: 'success' | 'failure'
}): { success: boolean; total?: number; dc?: number; nextDoorState?: 'open' | 'closed'; revealSecret: boolean } {
  const dc = input.prepared.dc == null
    ? undefined
    : Math.max(0, Math.min(100, Math.floor(input.adjustedDc ?? input.prepared.dc)))
  const total = input.d20 == null ? undefined : input.d20 + (input.modifier ?? 0)
  const success = input.dmOverride === 'success'
    ? true
    : input.dmOverride === 'failure'
      ? false
      : input.prepared.automaticSuccess || (dc != null && total != null && total >= dc)
  return {
    success,
    ...(total == null ? {} : { total }),
    ...(dc == null ? {} : { dc }),
    ...(success && input.prepared.nextDoorState ? { nextDoorState: input.prepared.nextDoorState } : {}),
    revealSecret: success && (input.prepared.operation === 'inspect' || input.prepared.operation === 'search') && !!input.prepared.door?.secret,
  }
}
