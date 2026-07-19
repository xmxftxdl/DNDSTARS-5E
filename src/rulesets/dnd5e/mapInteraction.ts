import type { BattleMap, Token } from '../../store/maps'
import type { MapGeometryDoor, MapGeometryState } from '../../lib/mapGeometry'

export type Dnd5eMapInteractionOperation = 'open' | 'close' | 'unlock' | 'break' | 'inspect'
export type Dnd5eMapInteractionMethod = 'interact' | 'key' | 'thieves-tools' | 'force' | 'perception' | 'investigation'

export interface Dnd5eMapInteractionPayload {
  doorId: string
  operation: Dnd5eMapInteractionOperation
  method?: Dnd5eMapInteractionMethod
}

export interface PreparedDnd5eMapInteraction {
  door: MapGeometryDoor
  operation: Dnd5eMapInteractionOperation
  method: Dnd5eMapInteractionMethod
  dc?: number
  checkAbility?: 'str' | 'dex' | 'int' | 'wis'
  checkSkill?: 'athletics' | 'sleightOfHand' | 'investigation' | 'perception'
  spendAction: boolean
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

export function prepareDnd5eMapInteraction(input: {
  map: BattleMap
  geometry?: MapGeometryState
  actor: Token
  payload: Dnd5eMapInteractionPayload
  hasMatchingKey?: boolean
  hasThievesTools?: boolean
}): PrepareDnd5eMapInteractionResult {
  const door = input.geometry?.doors.find((candidate) => candidate.id === input.payload.doorId)
  if (!door) return { ok: false, reason: 'door-not-found' }
  if (!withinInteractionReach(input.map, input.actor, door)) return { ok: false, reason: 'door-out-of-reach' }

  const interaction = door.interaction
  const operation = input.payload.operation
  if (operation === 'open') {
    if (door.state === 'open') return { ok: false, reason: 'door-already-open' }
    if (door.state === 'locked') return { ok: false, reason: 'door-locked' }
    return { ok: true, prepared: { door, operation, method: 'interact', spendAction: false, automaticSuccess: true, nextDoorState: 'open' } }
  }
  if (operation === 'close') {
    if (door.state !== 'open') return { ok: false, reason: 'door-not-open' }
    return { ok: true, prepared: { door, operation, method: 'interact', spendAction: false, automaticSuccess: true, nextDoorState: 'closed' } }
  }
  if (operation === 'unlock') {
    if (door.state !== 'locked') return { ok: false, reason: 'door-not-locked' }
    if (input.payload.method === 'key' && input.hasMatchingKey) {
      return { ok: true, prepared: { door, operation, method: 'key', spendAction: false, automaticSuccess: true, nextDoorState: 'closed' } }
    }
    if (interaction?.requiresThievesTools !== false && !input.hasThievesTools) {
      return { ok: false, reason: 'thieves-tools-required' }
    }
    return {
      ok: true,
      prepared: {
        door, operation, method: 'thieves-tools', dc: interaction?.lockPickDc ?? DEFAULT_LOCK_PICK_DC,
        checkAbility: 'dex', checkSkill: 'sleightOfHand', spendAction: true, automaticSuccess: false,
        nextDoorState: 'closed',
      },
    }
  }
  if (operation === 'break') {
    if (door.state === 'open') return { ok: false, reason: 'door-already-open' }
    return {
      ok: true,
      prepared: {
        door, operation, method: 'force', dc: interaction?.breakDc ?? DEFAULT_BREAK_DC,
        checkAbility: 'str', checkSkill: 'athletics', spendAction: true, automaticSuccess: false,
        nextDoorState: 'open',
      },
    }
  }
  const method = input.payload.method === 'investigation' ? 'investigation' : 'perception'
  return {
    ok: true,
    prepared: {
      door, operation, method, dc: interaction?.secretDc ?? DEFAULT_SECRET_DC,
      checkAbility: method === 'investigation' ? 'int' : 'wis',
      checkSkill: method,
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
    revealSecret: success && input.prepared.operation === 'inspect' && input.prepared.door.secret,
  }
}
