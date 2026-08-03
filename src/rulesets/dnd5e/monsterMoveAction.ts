import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { isMovementLocked } from '../../lib/combatStatus'
import {
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import {
  dnd5eEffectiveFlySpeed,
  dnd5eEffectiveSpeed,
  dnd5eGrappleDragExtraMovementFeet,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eCombatEvent,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { getDnd5eSrdMonster } from './monsters'
import { dnd5ePersistentAreaDifficultTerrainMultiplierAt, dnd5ePersistentAreaSpeedCostMultiplierAt } from './persistentAreaGeometry'
import { dnd5eTraversalMovementCost } from './traversal'

export interface Dnd5eMonsterMapMovementTrace {
  tokenId: string
  to: { x: number; y: number }
  path: Array<{ x: number; y: number }>
  pathElevationsFeet: number[]
}

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
  fallingDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
}): { ok: true; result: Dnd5eActionResult; application?: Dnd5eMapResultPlan; distanceFeet: number; path: Array<{ x: number; y: number }>; doorsToOpen: string[]; traversalMode?: 'walk' | 'fly'; movementTraces?: readonly Dnd5eMonsterMapMovementTrace[] } | { ok: false; reason: 'invalid-actor' | 'combatant-missing' | 'movement-locked' | 'movement-blocked' | 'object-interaction-unavailable' } {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId && token.type === 'enemy')
  const monster = actorToken?.poolId ? getDnd5eSrdMonster(actorToken.poolId) : undefined
  if (!actorToken || !monster) return { ok: false, reason: 'invalid-actor' }
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
  if (isMovementLocked(actorCombatant.conditions)) return { ok: false, reason: 'movement-locked' }
  const draggedTargetTokens = input.map.tokens.filter((candidate) => {
    const targetCombatant = snapshot.state.combatants[candidate.id]
    return targetCombatant?.classState.activeEffects?.some((effect) =>
      effect.standardCondition === 'grappled' &&
      !effect.dependsOnEffectId &&
      effect.relation?.kind === 'grapple' &&
      effect.relation.movement === 'drag-target' &&
      effect.relation.sourceActorId === actorToken.id &&
      effect.source.actorId === actorToken.id)
  })
  const movingIds = new Set([actorToken.id, ...draggedTargetTokens.map((target) => target.id)])
  const pathfindingMap = {
    ...input.map,
    tokens: input.map.tokens.filter((candidate) => !movingIds.has(candidate.id)),
  }
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const actorElevationFeet = mapGeometryTokenElevation(geometry, actorToken)
  const actorGroundElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, actorToken)
  const targetGroundElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, input.to)
  const targetElevationFeet = Number.isFinite(input.targetElevationFeet)
    ? Math.max(targetGroundElevationFeet, input.targetElevationFeet!)
    : actorElevationFeet > actorGroundElevationFeet
      ? Math.max(targetGroundElevationFeet, actorElevationFeet)
      : targetGroundElevationFeet
  const effectiveFlySpeed = dnd5eEffectiveFlySpeed(actorCombatant)
  const actorCanFly = (effectiveFlySpeed ?? 0) > 0
  const usesFlight = actorCanFly && (
    actorElevationFeet > actorGroundElevationFeet ||
    targetElevationFeet > targetGroundElevationFeet
  )
  const traversalMode = usesFlight ? 'fly' as const : 'walk' as const
  const path = findMapGeometryPath({
    geometry, map: pathfindingMap, token: actorToken, to: input.to,
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
  const draggedMovementTraces: Dnd5eMonsterMapMovementTrace[] = []
  if (draggedTargetTokens.length > 0) {
    const openedDoorIds = new Set(path.doorsToOpen)
    const dragGeometry = geometry && openedDoorIds.size > 0
      ? {
          ...geometry,
          doors: geometry.doors.map((door) => openedDoorIds.has(door.id)
            ? { ...door, state: 'open' as const, openState: 'open' as const }
            : door),
        }
      : geometry
    const dragMap = pathfindingMap
    const sourcePathStart = path.points[0] ?? { x: actorToken.x, y: actorToken.y }
    const sourceElevationStart = path.elevationsFeet[0] ?? actorElevationFeet
    for (const draggedTarget of draggedTargetTokens) {
      const draggedElevationStart = mapGeometryTokenElevation(geometry, draggedTarget)
      let draggedToken = { ...draggedTarget, elevationFeet: draggedElevationStart }
      let expectedFrom = { x: draggedTarget.x, y: draggedTarget.y }
      const translatedPath = [{ ...expectedFrom }]
      const translatedElevationsFeet = [draggedElevationStart]
      for (let index = 1; index < path.points.length; index += 1) {
        const sourcePoint = path.points[index]
        const expectedTo = {
          x: draggedTarget.x + sourcePoint.x - sourcePathStart.x,
          y: draggedTarget.y + sourcePoint.y - sourcePathStart.y,
        }
        const expectedElevation = draggedElevationStart +
          (path.elevationsFeet[index] ?? sourceElevationStart) - sourceElevationStart
        const draggedSegment = findMapGeometryPath({
          geometry: dragGeometry,
          map: dragMap,
          token: draggedToken,
          to: expectedTo,
          allowOpenUnlockedDoors: false,
          canClimb: (monster.speed.climb ?? 0) > 0,
          canSwim: (monster.speed.swim ?? 0) > 0,
          canFly: usesFlight,
          targetElevationFeet: expectedElevation,
          additionalDifficultTerrainMultiplier: (token, position) =>
            dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: input.map, token, position }),
          additionalSpeedCostMultiplier: (token, position) =>
            dnd5ePersistentAreaSpeedCostMultiplierAt({ map: input.map, token, position }),
        })
        const followsTranslatedSegment = draggedSegment?.points.length === 2 &&
          draggedSegment.points[0].x === expectedFrom.x &&
          draggedSegment.points[0].y === expectedFrom.y &&
          draggedSegment.points[1].x === expectedTo.x &&
          draggedSegment.points[1].y === expectedTo.y &&
          draggedSegment.elevationsFeet.at(-1) === expectedElevation
        if (!followsTranslatedSegment) return { ok: false, reason: 'movement-blocked' }
        expectedFrom = expectedTo
        draggedToken = { ...draggedToken, ...expectedTo, elevationFeet: expectedElevation }
        translatedPath.push(expectedTo)
        translatedElevationsFeet.push(expectedElevation)
      }
      draggedMovementTraces.push({
        tokenId: draggedTarget.id,
        to: { ...expectedFrom },
        path: translatedPath,
        pathElevationsFeet: translatedElevationsFeet,
      })
    }
  }
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
  // Use the same authoritative movement pool that Headless validates below.
  // Monsters with a faster fly speed expose that speed as their combat turn
  // movement; using only their walk speed here would underquote flight cost and
  // make an otherwise legal move roll back as invalid-class-feature.
  const walkSpeed = Math.max(1, dnd5eEffectiveSpeed(actorCombatant))
  const traversal = dnd5eTraversalMovementCost({
    distanceFeet: path.distanceFeet,
    baseMovementCostFeet: path.movementCostFeet,
    elevationGainFeet: usesFlight
      ? Math.abs(finalElevationFeet - actorElevationFeet)
      : Math.max(0, finalElevationFeet - actorElevationFeet),
    mode: traversalMode,
    profile: {
      strengthScore: actorCombatant.abilities.str,
      strengthModifier: Math.floor((actorCombatant.abilities.str - 10) / 2),
      walkSpeed,
      climbSpeed: monster.speed.climb,
      swimSpeed: monster.speed.swim,
      flySpeed: effectiveFlySpeed,
    },
  })
  if (!traversal.ok) return { ok: false, reason: 'movement-blocked' }
  const locomotionCostFeet = traversal.movementCostFeet +
    (isProne && !standFromProne ? path.distanceFeet : 0)
  const movementCostFeet = locomotionCostFeet +
    (standFromProne ? Math.floor(dnd5eEffectiveSpeed(actorCombatant) / 2) : 0) +
    dnd5eGrappleDragExtraMovementFeet(actionState, actorToken.id, locomotionCostFeet)
  const result = resolveDnd5eHeadlessAction(
    actionState,
    {
      type: 'move', actorId: actorToken.id, to: input.to, distance: path.distanceFeet,
      movementCost: movementCostFeet, movementCostIncludesDrag: true,
      traversalMode,
      toElevationFeet: finalElevationFeet,
      toGroundElevationFeet: mapGeometryTerrainElevationAtPoint(geometry, input.to),
      standFromProne,
      fallingDamageRollsByCombatantId: input.fallingDamageRollsByCombatantId,
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
    traversalMode,
    movementTraces: [
      {
        tokenId: actorToken.id,
        to: input.to,
        path: path.points,
        pathElevationsFeet: path.elevationsFeet,
      },
      ...draggedMovementTraces,
    ],
    application: planDnd5eMapResultApplication({
      state: transactionResult.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      openedDoorIds: path.doorsToOpen,
      events: [...transactionResult.events],
    }),
  }
}
