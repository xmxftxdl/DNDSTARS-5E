import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import { isMovementLocked } from './combatStatus'
import { isTokenAlive } from './combatTokens'
import { cellDistance, isWithinMovementRange, pixelToCell, snapTokenToGridCenter } from './gridCombat'

export type CombatMovementMode = 'turn-move' | 'agile-leap' | 'dm-override'

export type CombatMovementFailureReason =
  | 'combat-ended'
  | 'stale-turn'
  | 'invalid-actor'
  | 'insufficient-ap'
  | 'out-of-range'
  | 'movement-locked'

export interface CombatMovementRequest {
  map: BattleMap
  characters: Character[]
  actorTokenId: string
  characterId?: string
  targetPosition: { x: number; y: number }
  mode: CombatMovementMode
  active?: boolean
  currentTurnTokenId?: string
}

export interface CombatMovementSuccess {
  ok: true
  mode: CombatMovementMode
  token: Token
  actor?: Character
  from: { x: number; y: number }
  to: { x: number; y: number }
  feet: number
  apCost: number
  characterPatch?: Partial<Character>
}

export interface CombatMovementFailure {
  ok: false
  reason: CombatMovementFailureReason
}

export type CombatMovementResult = CombatMovementSuccess | CombatMovementFailure

export function resolveCombatMovement(request: CombatMovementRequest): CombatMovementResult {
  if (request.active === false && request.mode !== 'dm-override') {
    return { ok: false, reason: 'combat-ended' }
  }

  const token = request.map.tokens.find((item) => item.id === request.actorTokenId)
  if (!token) return { ok: false, reason: 'invalid-actor' }

  const characterId = request.characterId ?? token.characterId
  const actor = characterId ? request.characters.find((character) => character.id === characterId) : undefined
  const requiresPlayerActor = request.mode !== 'dm-override'

  if (requiresPlayerActor) {
    if (!actor || token.type !== 'player' || token.characterId !== actor.id) {
      return { ok: false, reason: 'invalid-actor' }
    }
    if (!isTokenAlive(token, request.characters)) {
      return { ok: false, reason: 'invalid-actor' }
    }
    if (request.currentTurnTokenId && request.currentTurnTokenId !== token.id && request.mode === 'turn-move') {
      return { ok: false, reason: 'stale-turn' }
    }
    if (isMovementLocked(actor.conditions)) {
      return { ok: false, reason: 'movement-locked' }
    }
  }

  const to = snapTokenToGridCenter(request.targetPosition.x, request.targetPosition.y, token, request.map)
  const from = { x: token.x, y: token.y }
  const feetPerCell = request.map.feetPerCell ?? 5
  const feet = cellDistance(pixelToCell(from.x, from.y, request.map), pixelToCell(to.x, to.y, request.map)) * feetPerCell

  if (request.mode === 'dm-override') {
    return {
      ok: true,
      mode: request.mode,
      token,
      actor,
      from,
      to,
      feet,
      apCost: 0,
    }
  }

  if (!actor) return { ok: false, reason: 'invalid-actor' }

  const movementFeet = request.mode === 'agile-leap' ? actor.combatBuffs?.agileLeapMoveFeet ?? 0 : actor.speed
  if (movementFeet <= 0) return { ok: false, reason: 'out-of-range' }
  if (!isWithinMovementRange(from, to, movementFeet, request.map)) {
    return { ok: false, reason: 'out-of-range' }
  }

  if (request.mode === 'agile-leap') {
    return {
      ok: true,
      mode: request.mode,
      token,
      actor,
      from,
      to,
      feet,
      apCost: 0,
      characterPatch: {
        combatBuffs: { ...actor.combatBuffs, agileLeapMoveFeet: undefined },
      },
    }
  }

  if (actor.currentAP < 1) return { ok: false, reason: 'insufficient-ap' }

  return {
    ok: true,
    mode: request.mode,
    token,
    actor,
    from,
    to,
    feet,
    apCost: 1,
    characterPatch: { currentAP: actor.currentAP - 1 },
  }
}
