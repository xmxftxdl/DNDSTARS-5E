import {
  previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,
  resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,
  type Dnd5eCombatEvent, type Dnd5eHeadlessCombatState, type Dnd5eActionResult,
} from './headlessCombatEngine'
import { planDnd5eMapResultApplication } from './mapBridge'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'

/** Host-staged arrival effects; never part of the player's action payload.
 * Destination authorization is checked against the original preparation first.
 */
export interface Dnd5eAttackTeleportArrival {
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  characters: readonly Character[]
  events: readonly Dnd5eCombatEvent[]
}

export function attackTeleportArrivalConsumedAction(arrival: Dnd5eAttackTeleportArrival | undefined, actorId: string) {
  return arrival?.events.some(event => event.type === 'persistent-area-triggered' &&
    event.targetId === actorId && event.actionConsumed) === true
}

/** Stage landing before an attack; the caller still owns the atomic commit and subsequent attack. */
export function resolveDnd5eAttackTeleportLanding(input: {
  teleport: { originalState: Dnd5eHeadlessCombatState; featureId: string; from: { x: number; y: number };
    fromElevationFeet: number; distanceFeet: number }
  state: Dnd5eHeadlessCombatState; actorId: string; map: BattleMap; characters: readonly Character[]
  characterIdByCombatantId: Readonly<Record<string, string>>
  includeSupportedDestination?: boolean
  arrival?: Dnd5eAttackTeleportArrival
  rolls?: Readonly<Record<string, readonly number[]>>
}) {
  const { teleport } = input
  const state = input.arrival?.state ?? input.state
  const characters = input.arrival?.characters ?? input.characters
  const map = input.arrival
    ? { ...input.map, dnd5ePluginAreas: input.arrival.map.dnd5ePluginAreas }
    : input.map
  const falls = previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(
    teleport.originalState, state, [input.actorId])
  if (!falls.length && !input.includeSupportedDestination) return undefined
  const keys = new Set(falls.flatMap(fall => [fall.combatantId,
    ...(fall.collision ? [fall.collision.rollKey] : fall.collisionCandidates?.map(collision => collision.rollKey) ?? [])]))
  const rolls = input.rolls && Object.fromEntries(Object.entries(input.rolls).filter(([id]) => keys.has(id)))
  const result: Dnd5eActionResult = falls.length
    ? resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(
      teleport.originalState, state, rolls, [input.actorId])
    : { ok: true, state: structuredClone(state), events: [] }
  if (!result.ok) return { ok: false as const, result, falls }
  const actor = input.state.combatants[input.actorId]
  const events: Dnd5eCombatEvent[] = [{ type: 'teleported', actorId: actor.id, spellId: teleport.featureId,
    from: { ...teleport.from }, to: { ...actor.position }, distanceFeet: teleport.distanceFeet,
    fromElevationFeet: teleport.fromElevationFeet, toElevationFeet: actor.elevationFeet ?? 0 },
    ...(input.arrival?.events ?? []), ...result.events]
  const plan = planDnd5eMapResultApplication({ state: result.state, map, characters,
    baselineCharacters: input.characters, characterIdByCombatantId: { ...input.characterIdByCombatantId }, events })
  const remaining = input.rolls && Object.fromEntries(Object.entries(input.rolls).filter(([id]) => !keys.has(id)))
  return { ok: true as const, state: result.state, events, plan, falls,
    remainingRolls: remaining && Object.keys(remaining).length ? remaining : undefined }
}
