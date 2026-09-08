import type { BattleMap, Token } from '../../store/maps'
import {
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
  mapGeometryDoorPhysicalState,
  type MapGeometryDoor,
  type MapGeometryDoorPhysicalState,
  type MapGeometryState,
} from '../../lib/mapGeometry'
import { SKILLS, type AbilityKey } from '../../lib/dnd'
import type { SceneInteractionPoint } from '../../lib/sceneOrchestration'
import {
  dnd5eArcaneLockAuthorizedTokenV1,
  dnd5eArcaneLockIsActive,
  dnd5eArcaneLockPasswordMatchesV1,
  type Dnd5eArcaneLockSuppressionV1,
} from './mapObjectState'

export type Dnd5eMapInteractionOperation =
  | 'open'
  | 'close'
  | 'unlock'
  | 'break'
  | 'inspect'
  | 'search'
  | 'interact-point'
export type Dnd5eMapInteractionMethod =
  | 'interact'
  | 'key'
  | 'password'
  | 'thieves-tools'
  | 'force'
  | 'perception'
  | 'investigation'
  | 'scene-point'

export type Dnd5eMapInteractionPayload =
  | {
      doorId: string
      operation: Exclude<Dnd5eMapInteractionOperation, 'search' | 'interact-point'>
      method?: Dnd5eMapInteractionMethod
      /** Submitted only for a password attempt and never persisted or logged. */
      spokenPassword?: string
    }
  | {
      operation: 'search'
      point: { x: number; y: number }
      method: 'perception' | 'investigation'
    }
  | {
      operation: 'interact-point'
      interactionPointId: string
    }

export interface PreparedDnd5eMapInteraction {
  door?: MapGeometryDoor
  point?: SceneInteractionPoint
  interactionId: string
  label: string
  blindSearch: boolean
  operation: Dnd5eMapInteractionOperation
  method: Dnd5eMapInteractionMethod
  dc?: number
  checkAbility?: AbilityKey
  checkSkill?: string
  rollMode?: 'normal' | 'advantage' | 'disadvantage'
  spendAction: boolean
  turnCost: 'object-interaction' | 'action'
  automaticSuccess: boolean
  nextDoorState?: 'open' | 'closed'
  nextDoorPhysicalState?: MapGeometryDoorPhysicalState
  nextArcaneLockSuppression?: Dnd5eArcaneLockSuppressionV1
}

export type PrepareDnd5eMapInteractionResult =
  | { ok: true; prepared: PreparedDnd5eMapInteraction }
  | { ok: false; reason: string }

/** Mirrors the host-side direct-open gate used by the player interaction UI. */
export function dnd5eMapInteractionCanOpenDoorDirectly(input: {
  door: MapGeometryDoor
  actorTokenId: string | undefined
  worldMinute?: number
  combatId?: string
  round?: number
}): boolean {
  if (mapGeometryDoorOpenState(input.door) !== 'closed') return false
  const lockState = mapGeometryDoorLockState(input.door)
  if (lockState === 'jammed') return false
  const arcaneLockActive = dnd5eArcaneLockIsActive({
    lock: input.door.dnd5eArcaneLock,
    worldMinute: input.worldMinute,
    combatId: input.combatId,
    round: input.round,
  })
  const actorBypassesArcaneLock = arcaneLockActive && !!input.actorTokenId &&
    dnd5eArcaneLockAuthorizedTokenV1(input.door.dnd5eArcaneLock, input.actorTokenId)
  if (arcaneLockActive && !actorBypassesArcaneLock) return false
  return lockState !== 'locked' || actorBypassesArcaneLock
}

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

function withinPointReach(map: BattleMap, actor: Token, point: SceneInteractionPoint): boolean {
  const gridSize = Math.max(1, map.gridSize)
  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  const configuredReachPx = (point.interactionRadiusFeet / feetPerCell) * gridSize
  const actorRadiusPx = gridSize * Math.max(1, actor.size) * 0.5
  return Math.hypot(actor.x - point.x, actor.y - point.y) <= configuredReachPx + actorRadiusPx
}

function prepareSceneInteractionPoint(input: {
  map: BattleMap
  actor: Token
  payload: Extract<Dnd5eMapInteractionPayload, { operation: 'interact-point' }>
  interactionPoints?: readonly SceneInteractionPoint[]
}): PrepareDnd5eMapInteractionResult {
  const point = input.interactionPoints?.find((candidate) => candidate.id === input.payload.interactionPointId)
  if (!point || !point.enabled || !point.visibleToPlayers) {
    return { ok: false, reason: 'interaction-point-not-found' }
  }
  if (!finiteMapPoint(input.map, point)) return { ok: false, reason: 'invalid-interaction-point' }
  if (!withinPointReach(input.map, input.actor, point)) {
    return { ok: false, reason: 'interaction-point-out-of-reach' }
  }
  if (!point.check) return { ok: false, reason: 'interaction-point-check-unavailable' }
  const [selectionKind, selectionKey] = point.check.selection.split(':')
  if (selectionKind === 'save') return { ok: false, reason: 'interaction-point-check-unavailable' }
  const skill = selectionKind === 'skill'
    ? SKILLS.find((candidate) => candidate.key === selectionKey)
    : undefined
  const checkAbility = selectionKind === 'ability'
    ? selectionKey as AbilityKey
    : skill?.ability
  if (!checkAbility || (selectionKind === 'skill' && !skill)) {
    return { ok: false, reason: 'interaction-point-check-unavailable' }
  }
  return {
    ok: true,
    prepared: {
      point,
      interactionId: `scene-point:${point.id}`,
      label: point.name,
      blindSearch: false,
      operation: 'interact-point',
      method: 'scene-point',
      dc: point.check.dc,
      checkAbility,
      ...(skill ? { checkSkill: skill.key } : {}),
      rollMode: point.check.mode,
      spendAction: true,
      turnCost: 'action',
      automaticSuccess: false,
    },
  }
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
  interactionPoints?: readonly SceneInteractionPoint[]
  hasMatchingKey?: boolean
  hasThievesTools?: boolean
  worldMinute?: number
  combatId?: string
  round?: number
}): PrepareDnd5eMapInteractionResult {
  const payload = input.payload
  if (payload.operation === 'interact-point') {
    return prepareSceneInteractionPoint({
      map: input.map,
      actor: input.actor,
      payload,
      interactionPoints: input.interactionPoints,
    })
  }
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
  if (payload.spokenPassword != null && (
    payload.method !== 'password' || !payload.spokenPassword.trim() ||
    payload.spokenPassword.normalize('NFKC').trim().length > 120
  )) return { ok: false, reason: 'invalid-arcane-lock-password' }

  const interaction = door.interaction
  const operation = payload.operation
  const openState = mapGeometryDoorOpenState(door)
  const lockState = mapGeometryDoorLockState(door)
  const physicalState = mapGeometryDoorPhysicalState(door)
  const arcaneLockActive = dnd5eArcaneLockIsActive({
    lock: door.dnd5eArcaneLock,
    worldMinute: input.worldMinute,
    combatId: input.combatId,
    round: input.round,
  })
  const actorBypassesArcaneLock = arcaneLockActive && dnd5eArcaneLockAuthorizedTokenV1(
    door.dnd5eArcaneLock,
    input.actor.id,
  )
  if (operation === 'open') {
    if (openState === 'open') return { ok: false, reason: 'door-already-open' }
    if (payload.method === 'password') {
      if (!arcaneLockActive || !payload.spokenPassword || !dnd5eArcaneLockPasswordMatchesV1(
        door.dnd5eArcaneLock,
        payload.spokenPassword,
      )) return { ok: false, reason: 'arcane-lock-password-invalid' }
      const suppression: Dnd5eArcaneLockSuppressionV1 = input.combatId && Number.isInteger(input.round)
        ? { kind: 'combat-round', combatId: input.combatId, throughRound: Number(input.round) + 9 }
        : { kind: 'campaign-time', untilWorldMinute: Math.max(0, Math.floor(input.worldMinute ?? 0)) + 1 }
      return {
        ok: true,
        prepared: {
          door, interactionId: `${operation}:${door.id}:password`, label: door.label,
          blindSearch: false, operation, method: 'password', spendAction: false,
          turnCost: 'object-interaction', automaticSuccess: true, nextDoorState: 'open',
          nextArcaneLockSuppression: suppression,
        },
      }
    }
    if (arcaneLockActive && !actorBypassesArcaneLock) return { ok: false, reason: 'door-arcane-locked' }
    if (lockState === 'locked' && !actorBypassesArcaneLock) return { ok: false, reason: 'door-locked' }
    if (lockState === 'jammed') return { ok: false, reason: 'door-jammed' }
    return { ok: true, prepared: { door, interactionId: `${operation}:${door.id}`, label: door.label, blindSearch: false, operation, method: 'interact', spendAction: false, turnCost: 'object-interaction', automaticSuccess: true, nextDoorState: 'open' } }
  }
  if (operation === 'close') {
    if (openState !== 'open') return { ok: false, reason: 'door-not-open' }
    if (physicalState === 'destroyed') return { ok: false, reason: 'door-destroyed' }
    return { ok: true, prepared: { door, interactionId: `${operation}:${door.id}`, label: door.label, blindSearch: false, operation, method: 'interact', spendAction: false, turnCost: 'object-interaction', automaticSuccess: true, nextDoorState: 'closed' } }
  }
  if (operation === 'unlock') {
    if (lockState === 'jammed') return { ok: false, reason: 'door-jammed' }
    if (lockState !== 'locked' && !arcaneLockActive) return { ok: false, reason: 'door-not-locked' }
    if (payload.method === 'key' && input.hasMatchingKey && !arcaneLockActive) {
      return { ok: true, prepared: { door, interactionId: `${operation}:${door.id}`, label: door.label, blindSearch: false, operation, method: 'key', spendAction: false, turnCost: 'object-interaction', automaticSuccess: true, nextDoorState: 'closed' } }
    }
    if (interaction?.requiresThievesTools !== false && !input.hasThievesTools) {
      return { ok: false, reason: 'thieves-tools-required' }
    }
    return {
      ok: true,
      prepared: {
        door, interactionId: `${operation}:${door.id}`, label: door.label, blindSearch: false,
        operation, method: 'thieves-tools',
        dc: (interaction?.lockPickDc ?? DEFAULT_LOCK_PICK_DC) + (arcaneLockActive ? 10 : 0),
        checkAbility: 'dex', checkSkill: 'sleightOfHand', spendAction: true, turnCost: 'action', automaticSuccess: false,
        nextDoorState: arcaneLockActive ? 'open' : 'closed',
      },
    }
  }
  if (operation === 'break') {
    if (openState === 'open') return { ok: false, reason: 'door-already-open' }
    return {
      ok: true,
      prepared: {
        door, interactionId: `${operation}:${door.id}`, label: door.label, blindSearch: false,
        operation, method: 'force', dc: (interaction?.breakDc ?? DEFAULT_BREAK_DC) + (arcaneLockActive ? 10 : 0),
        checkAbility: 'str', checkSkill: 'athletics', spendAction: true, turnCost: 'action', automaticSuccess: false,
        nextDoorState: 'open',
        nextDoorPhysicalState: 'broken',
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
}): {
  success: boolean
  total?: number
  dc?: number
  nextDoorState?: 'open' | 'closed'
  nextDoorPhysicalState?: MapGeometryDoorPhysicalState
  nextArcaneLockSuppression?: Dnd5eArcaneLockSuppressionV1
  revealSecret: boolean
} {
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
    ...(success && input.prepared.nextDoorPhysicalState
      ? { nextDoorPhysicalState: input.prepared.nextDoorPhysicalState }
      : {}),
    ...(success && input.prepared.nextArcaneLockSuppression
      ? { nextArcaneLockSuppression: input.prepared.nextArcaneLockSuppression }
      : {}),
    revealSecret: success && (input.prepared.operation === 'inspect' || input.prepared.operation === 'search') && !!input.prepared.door?.secret,
  }
}
