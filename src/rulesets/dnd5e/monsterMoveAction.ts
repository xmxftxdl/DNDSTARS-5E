import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import { resolveDnd5eHeadlessAction, type Dnd5eActionResult } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { getDnd5eSrdMonster } from './monsters'
import { dnd5ePersistentAreaDifficultTerrainMultiplierAt, dnd5ePersistentAreaSpeedCostMultiplierAt } from './pluginAreas'

export function resolveDnd5eMonsterMapMove(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  to: { x: number; y: number }
  dash?: boolean
  turnEconomy?: Dnd5eTurnEconomyCounts
}): { ok: true; result: Dnd5eActionResult; application?: Dnd5eMapResultPlan; distanceFeet: number; path: Array<{ x: number; y: number }>; doorsToOpen: string[] } | { ok: false; reason: 'invalid-actor' | 'combatant-missing' | 'movement-blocked' | 'object-interaction-unavailable' } {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId && token.type === 'enemy')
  const monster = actorToken?.poolId ? getDnd5eSrdMonster(actorToken.poolId) : undefined
  if (!actorToken || !monster) return { ok: false, reason: 'invalid-actor' }
  const path = findMapGeometryPath({
    geometry: mapGeometryRuntimeForMap(input.map.id), map: input.map, token: actorToken, to: input.to,
    allowOpenUnlockedDoors: true,
    canClimb: (monster.speed.climb ?? 0) > 0,
    canSwim: (monster.speed.swim ?? 0) > 0,
    additionalDifficultTerrainMultiplier: (token, position) =>
      dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: input.map, token, position }),
    additionalSpeedCostMultiplier: (token, position) =>
      dnd5ePersistentAreaSpeedCostMultiplierAt({ map: input.map, token, position }),
  })
  if (!path) return { ok: false, reason: 'movement-blocked' }
  if (path.doorsToOpen.length > 1) return { ok: false, reason: 'movement-blocked' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant) return { ok: false, reason: 'combatant-missing' }
  if (input.turnEconomy) {
    actorCombatant.turn = {
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }
  const distanceFeet = path.distanceFeet
  let actionState = { ...snapshot.state, initiativeIndex: actorIndex }
  if (path.doorsToOpen.length === 1) {
    if (input.turnEconomy && (input.turnEconomy.objectInteraction?.current ?? 1) < 1) {
      return { ok: false, reason: 'object-interaction-unavailable' }
    }
    const interacted = resolveDnd5eHeadlessAction(actionState, {
      type: 'interact-object',
      actorId: actorToken.id,
      interactionId: `open:${path.doorsToOpen[0]}`,
    })
    if (!interacted.ok) {
      return { ok: true, result: interacted, distanceFeet, path: path.points, doorsToOpen: path.doorsToOpen }
    }
    actionState = interacted.state
  }
  if (input.dash) {
    const dashed = resolveDnd5eHeadlessAction(actionState, { type: 'dash', actorId: actorToken.id })
    if (!dashed.ok) return { ok: true, result: dashed, distanceFeet, path: path.points, doorsToOpen: path.doorsToOpen }
    actionState = dashed.state
  }
  const result = resolveDnd5eHeadlessAction(
    actionState,
    {
      type: 'move', actorId: actorToken.id, to: input.to, distance: distanceFeet, movementCost: path.movementCostFeet,
      standFromProne: actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase())),
    },
  )
  if (!result.ok) return { ok: true, result, distanceFeet, path: path.points, doorsToOpen: path.doorsToOpen }
  return {
    ok: true,
    result,
    distanceFeet,
    path: path.points,
    doorsToOpen: path.doorsToOpen,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    }),
  }
}
