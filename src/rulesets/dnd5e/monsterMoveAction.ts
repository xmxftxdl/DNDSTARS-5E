import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import {
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import {
  dnd5eEffectiveSpeed,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eCombatEvent,
} from './headlessCombatEngine'
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
  targetElevationFeet?: number
  dash?: boolean
  nimbleEscape?: 'disengage'
  turnEconomy?: Dnd5eTurnEconomyCounts
}): { ok: true; result: Dnd5eActionResult; application?: Dnd5eMapResultPlan; distanceFeet: number; path: Array<{ x: number; y: number }>; doorsToOpen: string[] } | { ok: false; reason: 'invalid-actor' | 'combatant-missing' | 'movement-blocked' | 'object-interaction-unavailable' } {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId && token.type === 'enemy')
  const monster = actorToken?.poolId ? getDnd5eSrdMonster(actorToken.poolId) : undefined
  if (!actorToken || !monster) return { ok: false, reason: 'invalid-actor' }
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const actorElevationFeet = mapGeometryTokenElevation(geometry, actorToken)
  const actorGroundElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, actorToken)
  const targetGroundElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, input.to)
  const targetElevationFeet = Number.isFinite(input.targetElevationFeet)
    ? Math.max(targetGroundElevationFeet, input.targetElevationFeet!)
    : actorElevationFeet > actorGroundElevationFeet
      ? Math.max(targetGroundElevationFeet, actorElevationFeet)
      : targetGroundElevationFeet
  const actorCanFly = (monster.speed.fly ?? 0) > 0
  const usesFlight = actorCanFly && (
    actorElevationFeet > actorGroundElevationFeet ||
    targetElevationFeet > targetGroundElevationFeet
  )
  const path = findMapGeometryPath({
    geometry, map: input.map, token: actorToken, to: input.to,
    allowOpenUnlockedDoors: true,
    canClimb: (monster.speed.climb ?? 0) > 0,
    canSwim: (monster.speed.swim ?? 0) > 0,
    canFly: usesFlight,
    targetElevationFeet,
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
  const finalElevationFeet = path.elevationsFeet.at(-1) ?? actorElevationFeet
  const verticalDistanceFeet = Math.abs(finalElevationFeet - actorElevationFeet)
  const distanceFeet = path.distanceFeet + verticalDistanceFeet
  let actionState = { ...snapshot.state, initiativeIndex: actorIndex }
  const priorEvents: Dnd5eCombatEvent[] = []
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
    priorEvents.push(...interacted.events)
  }
  if (input.nimbleEscape === 'disengage') {
    const escaped = resolveDnd5eHeadlessAction(actionState, {
      type: 'monster-nimble-escape',
      actorId: actorToken.id,
      option: 'disengage',
    })
    if (!escaped.ok) return {
      ok: true,
      result: escaped,
      distanceFeet,
      path: path.points,
      doorsToOpen: path.doorsToOpen,
    }
    actionState = escaped.state
    priorEvents.push(...escaped.events)
  }
  if (input.dash) {
    const dashed = resolveDnd5eHeadlessAction(actionState, { type: 'dash', actorId: actorToken.id })
    if (!dashed.ok) return { ok: true, result: dashed, distanceFeet, path: path.points, doorsToOpen: path.doorsToOpen }
    actionState = dashed.state
    priorEvents.push(...dashed.events)
  }
  const isProne = actorCombatant.conditions.some((condition) =>
    ['prone', '倒地'].includes(condition.toLowerCase()))
  const standingPrevented = actorCombatant.classState.activeEffects?.some((effect) =>
    effect.source.kind === 'spell' && effect.source.rulesId === 'hideous-laughter',
  ) === true
  // The core refuses an illegal "stand" command.  A disabled monster must
  // instead crawl (or choose another action), never lose its whole move to an
  // opaque invalid-class-feature rejection.
  const standFromProne = isProne && !standingPrevented && dnd5eEffectiveSpeed(actorCombatant) > 0
  const movementCostFeet = path.movementCostFeet + verticalDistanceFeet +
    (standFromProne ? Math.floor(dnd5eEffectiveSpeed(actorCombatant) / 2) : 0)
  const result = resolveDnd5eHeadlessAction(
    actionState,
    {
      type: 'move', actorId: actorToken.id, to: input.to, distance: path.distanceFeet, movementCost: movementCostFeet,
      traversalMode: usesFlight ? 'fly' : 'walk',
      toElevationFeet: finalElevationFeet,
      standFromProne,
    },
  )
  if (!result.ok) return { ok: true, result, distanceFeet, path: path.points, doorsToOpen: path.doorsToOpen }
  const transactionResult: Dnd5eActionResult = {
    ...result,
    events: [...priorEvents, ...result.events],
  }
  return {
    ok: true,
    result: transactionResult,
    distanceFeet,
    path: path.points,
    doorsToOpen: path.doorsToOpen,
    application: planDnd5eMapResultApplication({
      state: transactionResult.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    }),
  }
}
