import {dnd5eTempleEntryRequirements} from './templeEntry'
import { dnd5eJumpLaunchPoint } from './jumpLaunchPoint'
import { mapForSolidMaterialTraversal, mapGeometryForSolidMaterialTraversal } from '../../lib/mapSolidMaterialTraversal'
import { appendDnd5eSolidExitMovementTraces, settleDnd5eSolidMaterialExit, replayDnd5eSolidExitFeatherFallChoices, type Dnd5eSolidExitFeatherFallChoice } from './solidMaterialExitSettlement'
import { dnd5eHeadlessAreaTraversalModifiers } from './headlessAreaTraversal'
import { dnd5ePersistentAreaDirectionalMovementCostAt } from './persistentAreaGeometry'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { isMovementLocked } from '../../lib/combatStatus'
import {
  mapGeometryRuntimeForMap,
  mapGeometryMovementBlocked,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import { dnd5eCompanionGuardCanTraverse } from './companionGuardArea'
import {
  dnd5eEffectiveFlySpeed,
  dnd5eEffectiveMovementPoolSpeed,
  dnd5eEffectiveOptionalMovementSpeed,
  dnd5eEffectiveSpeed,
  dnd5eEffectiveWalkSpeed,
  dnd5eGrappleDragExtraMovementFeet,
  resolveDnd5eHeadlessAction,
  previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,
  resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,
  type Dnd5eUnsupportedAirborneFallPreview,
  type Dnd5eAction,
  type Dnd5eActionResult,
  type Dnd5eCombatEvent,
  type Dnd5eHeadlessCombatState,
  type Dnd5eOpeningAttackSavingThrowRoll,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { getDnd5eSrdMonster } from './monsters'
import {
  dnd5eActiveEnvironmentalCapabilities,
  dnd5eActiveSolidMaterialTraversals,
  dnd5eActiveJumpDistanceMultiplier,
  dnd5eActiveMovementBoundarySaves,
  dnd5eActiveMovementRepeatSaves,
  dnd5eSwallowedCorpseEscapePlan,
  effectiveDnd5eActiveEffects,
} from './activeEffects'
import { dnd5ePersistentAreaDifficultTerrainMultiplierAt, dnd5ePersistentAreaSpeedCostMultiplierAt } from './persistentAreaGeometry'
import {
  dnd5eRunningJumpSegments,
  dnd5eTraversalModeRemainingMovementFeet,
  dnd5eTraversalMovementCost,
  type Dnd5eTraversalMode,
} from './traversal'
import { dnd5eTurnMovementSpent } from './turnEconomy'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import type { PreparedDnd5eOpeningAttackSavingThrow } from './spellAction'

export interface Dnd5eMonsterMapMovementTrace {
  tokenId: string
  to: { x: number; y: number }
  path: Array<{ x: number; y: number }>
  pathElevationsFeet: number[]
}

export interface PreparedDnd5eMonsterMovementSavingThrows {
  actorToken: BattleMap['tokens'][number]
  characters: readonly Character[]
  state: Dnd5eHeadlessCombatState
  boundarySavingThrows: readonly {
    effectId: string
    sourceActorId: string
    sourceName: string
    requirement: PreparedDnd5eOpeningAttackSavingThrow
  }[]
  movementRepeatSavingThrows: readonly {
    effectId: string
    sourceActorId: string
    sourceName: string
    requirement: PreparedDnd5eOpeningAttackSavingThrow
  }[]
}

export function prepareDnd5eMonsterMovementSavingThrows(input: {
  worldMinute?: number
  targetElevationFeet?: number
  traversalMode?: Dnd5eTraversalMode
  readiedMovement?: {currentInitiativeIndex:number}
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  to: { x: number; y: number }
}): PreparedDnd5eMonsterMovementSavingThrows | null {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId && token.type === 'enemy')
  if (!actorToken) return null
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    worldMinute: input.worldMinute,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (!actorCombatant) return null
  const activeEffects = effectiveDnd5eActiveEffects(actorCombatant.classState.activeEffects)
  const requirementFor = (effectId: string, ability: Parameters<typeof dnd5eSavingThrowMode>[1], dc: number) => ({
    featureId: effectId,
    ability,
    dc,
    modifier: actorCombatant.savingThrowBonuses[ability] ??
      Math.floor((actorCombatant.abilities[ability] - 10) / 2),
    mode: dnd5eSavingThrowMode(actorCombatant, ability),
    blessed: activeEffects.some((effect) => effect.source.rulesId === 'bless'),
    baned: activeEffects.some((effect) => effect.source.rulesId === 'bane'),
    failureDamageMultiplier: 1,
  })
  const boundarySavingThrows = dnd5eActiveMovementBoundarySaves(actorCombatant.classState.activeEffects)
    .flatMap((boundary) => {
      const source = snapshot.state.combatants[boundary.sourceActorId]
      if (!source) return []
      const destinationDistance = Math.hypot(input.to.x - source.position.x, input.to.y - source.position.y)
      if (destinationDistance <= boundary.maximumDistanceFeet + 1e-6) return []
      return [{
        effectId: boundary.effectId,
        sourceActorId: source.id,
        sourceName: source.name,
        requirement: requirementFor(boundary.effectId, boundary.ability, boundary.dc),
      }]
    })
  const monster=actorToken.poolId?getDnd5eSrdMonster(actorToken.poolId):undefined
  if(!monster)return null
  const planned=planMonsterMovementPath(input,snapshot,actorToken,actorCombatant,monster)
  if(!planned.path)return null
  const route=[{...actorCombatant.position,elevationFeet:planned.actorElevationFeet},
    ...planned.path.points.map((point,index)=>({...point,elevationFeet:planned.path!.elevationsFeet[index]??planned.actorElevationFeet})),
    {...input.to,elevationFeet:planned.path.elevationsFeet.at(-1)??planned.actorElevationFeet}]
  boundarySavingThrows.push(...dnd5eTempleEntryRequirements(snapshot.state,actorCombatant,input.to,route.at(-1)!.elevationFeet,route).filter(entry=>!entry.denied).map(entry=>({
    effectId:entry.effectId,sourceActorId:entry.sourceActorId,sourceName:'神庙',requirement:{...requirementFor(entry.effectId,entry.ability,entry.dc),
      mode:dnd5eSavingThrowMode(actorCombatant,entry.ability,{sourceIsSpell:true,sourceIsMagical:true})}})))
  const moved = Math.hypot(input.to.x - actorToken.x, input.to.y - actorToken.y) > 1e-6
  const movementRepeatSavingThrows = moved
    ? dnd5eActiveMovementRepeatSaves(actorCombatant.classState.activeEffects)
      .flatMap((repeat) => {
        const source = snapshot.state.combatants[repeat.sourceActorId]
        if (!source) return []
        return [{
          effectId: repeat.effectId,
          sourceActorId: source.id,
          sourceName: source.name,
          requirement: requirementFor(repeat.effectId, repeat.ability, repeat.dc),
        }]
      })
    : []
  return {
    actorToken,
    characters: input.characters,
    state: snapshot.state,
    boundarySavingThrows,
    movementRepeatSavingThrows,
  }
}

function planMonsterMovementPath(input: Pick<Parameters<typeof resolveDnd5eMonsterMapMoveInternal>[0], 'map'|'characters'|'to'|'traversalMode'|'targetElevationFeet'|'readiedMovement'>,
  snapshot: Pick<ReturnType<typeof createDnd5eMapCombatSnapshot>,'state'>,
  actorToken: BattleMap['tokens'][number], actorCombatant: Dnd5eHeadlessCombatState['combatants'][string],
  monster: NonNullable<ReturnType<typeof getDnd5eSrdMonster>>) {
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
  const carriedTargetTokens = input.map.tokens.filter((candidate) => {
    const targetCombatant = snapshot.state.combatants[candidate.id]
    const characterEffects = candidate.characterId
      ? input.characters.find((character) => character.id === candidate.characterId)
          ?.dnd5eCombatState?.activeEffects
      : undefined
    const savedEffects = characterEffects ?? candidate.dnd5eCombatState?.activeEffects ??
      targetCombatant?.classState.activeEffects
    return savedEffects?.some((effect) =>
      !effect.dependsOnEffectId &&
      effect.relation?.movement === 'carry-target' &&
      effect.relation.sourceActorId === actorToken.id &&
      effect.source.actorId === actorToken.id)
  })
  const movingIds = new Set([
    actorToken.id,
    ...draggedTargetTokens.map((target) => target.id),
    ...carriedTargetTokens.map((target) => target.id),
  ])
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
  const automaticallyUsesFlight = actorCanFly && (
    actorElevationFeet > actorGroundElevationFeet ||
    targetElevationFeet > targetGroundElevationFeet
  )
  const traversalMode = input.traversalMode ?? (automaticallyUsesFlight ? 'fly' : 'walk')
  const usesFlight = traversalMode === 'fly'
  const usesLongJump = traversalMode === 'long-jump-running' || traversalMode === 'long-jump-standing'
  const environmentalCapabilities = dnd5eActiveEnvironmentalCapabilities(
    actorCombatant.classState.activeEffects, actorCombatant,
  )
  const path = findMapGeometryPath({
    geometry, map: pathfindingMap, token: actorToken, to: input.to,
    passThroughSolidMaterials: dnd5eActiveSolidMaterialTraversals(actorCombatant.classState.activeEffects)
      .flatMap(source => source.rule.materials),
    canTraverseEdge: (from, to) => dnd5eCompanionGuardCanTraverse(input.map, actorToken, from, to),
    allowOpenUnlockedDoors: !input.readiedMovement,
    climbVerticalSurfaces: traversalMode === 'climb',
    canClimb: traversalMode === 'climb' || (monster.speed.climb ?? 0) > 0,
    canSwim: traversalMode === 'swim' || (monster.speed.swim ?? 0) > 0 ||
      environmentalCapabilities.treatsLiquidSurfacesAsSolidGround,
    canFly: usesFlight,
    targetElevationFeet,
    maximumTerrainStepFeet: usesLongJump ? 10_000 : 10,
    passThroughTokenIds: environmentalCapabilities.canOccupyCreatureSpaces
      ? input.map.tokens.filter((token) => token.id !== actorToken.id).map((token) => token.id)
      : undefined,
    allowOccupiedDestination: environmentalCapabilities.canOccupyCreatureSpaces,
    minimumPassageGapInches: environmentalCapabilities.minimumPassageGapInches,
    ignoreDifficultTerrainMaterials: environmentalCapabilities.ignoredDifficultTerrainMaterials,
    ignoreDifficultTerrain: usesLongJump || environmentalCapabilities.ignoresDifficultTerrain,
    additionalDifficultTerrainMultiplier: (token, position) => usesLongJump
      ? 1
      : dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: input.map, token, position }),
    additionalMovementCostPerFoot: (token, from, to) => dnd5ePersistentAreaDirectionalMovementCostAt({ map: input.map, token, from, to }),
    additionalSpeedCostMultiplier: (token, position) =>
      dnd5ePersistentAreaSpeedCostMultiplierAt({ map: input.map, token, position }),
  })
  return {draggedTargetTokens,carriedTargetTokens,pathfindingMap,geometry,actorElevationFeet,actorGroundElevationFeet,targetGroundElevationFeet,targetElevationFeet,effectiveFlySpeed,traversalMode,usesFlight,usesLongJump,environmentalCapabilities,path}
}

function resolveDnd5eMonsterMapMoveInternal(input: {
  transactionId?: string
  effectRollDice?: Readonly<Record<string, readonly number[]>>
  worldMinute?: number
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  to: { x: number; y: number }
  targetElevationFeet?: number
  traversalMode?: Dnd5eTraversalMode
  dash?: boolean
  disengage?: boolean
  nimbleEscape?: 'disengage'
  /** Off-turn movement purchased by the immediately preceding legendary action. */
  legendaryMovement?: { currentInitiativeIndex: number }
  readiedMovement?: { currentInitiativeIndex: number; segment?: 'continue' | 'finish' }
  /** Host-selected checkpoint of one jump; never taken from a player request. */
  jumpSegment?: 'continue' | 'finish'
  jumpApproachCheckpoint?: true
  turnEconomy?: Dnd5eTurnEconomyCounts
  boundarySavingThrows?: readonly (Dnd5eOpeningAttackSavingThrowRoll & { effectId: string })[]
  movementRepeatSavingThrows?: readonly (Dnd5eOpeningAttackSavingThrowRoll & { effectId: string })[]
  fallingDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
  deferMovementRepeatSavingThrows?: true
  deferSolidMaterialExit?: boolean
  solidExitFeatherFallChoices?: readonly Dnd5eSolidExitFeatherFallChoice[]
  airborneFallDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
}, previewOnly = false): { ok: true; result: Dnd5eActionResult; solidExitReactionState?: import('./headlessCombatEngine').Dnd5eHeadlessCombatState; airborneFalls?: readonly Dnd5eUnsupportedAirborneFallPreview[]; application?: Dnd5eMapResultPlan; previewApplication?: Dnd5eMapResultPlan; distanceFeet: number; path: Array<{ x: number; y: number }>; doorsToOpen: string[]; traversalMode?: Dnd5eTraversalMode; movementTraces?: readonly Dnd5eMonsterMapMovementTrace[] } | { ok: false; solidExitReactionState?: never; airborneFalls?: never; reason: 'invalid-actor' | 'combatant-missing' | 'movement-locked' | 'movement-blocked' | 'object-interaction-unavailable' | 'jump-too-far' | 'jump-too-high' | 'cannot-fly'; unaffordablePath?: readonly { x: number; y: number }[] } {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId && token.type === 'enemy')
  const monster = actorToken?.poolId ? getDnd5eSrdMonster(actorToken.poolId) : undefined
  if (!actorToken || !monster) return { ok: false, reason: 'invalid-actor' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    worldMinute: input.worldMinute,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant) return { ok: false, reason: 'combatant-missing' }
  if (input.readiedMovement && (actorCombatant.classState.readiedAction?.actionKind !== 'move' ||
    input.legendaryMovement || input.dash || input.disengage || input.nimbleEscape || dnd5eSwallowedCorpseEscapePlan(actorCombatant.classState.activeEffects))) return { ok: false, reason: 'movement-blocked' }
  if (isMovementLocked(actorCombatant.conditions)) return { ok: false, reason: 'movement-locked' }
  const swallowedCorpseEscapePlan = dnd5eSwallowedCorpseEscapePlan(
    actorCombatant.classState.activeEffects,
  )
  const {draggedTargetTokens,carriedTargetTokens,pathfindingMap,geometry,actorElevationFeet,effectiveFlySpeed,traversalMode,usesFlight,path}=planMonsterMovementPath(input,snapshot,actorToken,actorCombatant,monster)
  if (!path) return { ok: false, reason: 'movement-blocked' }
  if (input.legendaryMovement && (input.dash || input.disengage || input.nimbleEscape || path.doorsToOpen.length > 0)) {
    return { ok: false, reason: 'movement-blocked' }
  }
  if (path.doorsToOpen.length > 1) return { ok: false, reason: 'movement-blocked' }
  if (input.turnEconomy) {
    actorCombatant.turn = {
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
      movementRemaining: input.turnEconomy.movement.current,
      movementSpent: dnd5eTurnMovementSpent(input.turnEconomy),
    }
  }
  const ordinaryMovement = { remaining: actorCombatant.turn.movementRemaining, spent: actorCombatant.turn.movementSpent }
  if (input.readiedMovement) {
    actorCombatant.turn.movementRemaining = actorCombatant.classState.readiedAction?.movementExecution?.remaining ?? dnd5eEffectiveMovementPoolSpeed(actorCombatant)
    actorCombatant.turn.movementSpent = actorCombatant.classState.readiedAction?.movementExecution?.spent ?? 0
  }
  const finalElevationFeet = path.elevationsFeet.at(-1) ?? actorElevationFeet
  const verticalDistanceFeet = Math.abs(finalElevationFeet - actorElevationFeet)
  const distanceFeet = path.distanceFeet + (traversalMode === 'climb' ? 0 : verticalDistanceFeet)
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
          passThroughSolidMaterials: dnd5eActiveSolidMaterialTraversals(snapshot.state.combatants[draggedTarget.id]?.classState.activeEffects)
            .flatMap(source => source.rule.materials),
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
          additionalMovementCostPerFoot: (token, from, to) => dnd5ePersistentAreaDirectionalMovementCostAt({ map: input.map, token, from, to }),
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
  const carriedMovementTraces: Dnd5eMonsterMapMovementTrace[] =
    carriedTargetTokens.map((target) => ({
      tokenId: target.id,
      to: {
        x: target.x + input.to.x - actorToken.x,
        y: target.y + input.to.y - actorToken.y,
      },
      path: path.points.map((point) => ({
        x: target.x + point.x - actorToken.x,
        y: target.y + point.y - actorToken.y,
      })),
      pathElevationsFeet: path.elevationsFeet.map((elevation) =>
        mapGeometryTokenElevation(geometry, target) + elevation - actorElevationFeet),
    }))
  // A carrier's traversal spell does not grant that spell to another creature.
  if (dnd5eActiveSolidMaterialTraversals(actorCombatant.classState.activeEffects).length) {
    for (const trace of carriedMovementTraces) {
      const target = carriedTargetTokens.find(token => token.id === trace.tokenId)!
      const materials = dnd5eActiveSolidMaterialTraversals(snapshot.state.combatants[target.id]?.classState.activeEffects)
        .flatMap(source => source.rule.materials)
      for (let index = 1; index < trace.path.length; index += 1) {
        if (mapGeometryMovementBlocked({
          map: mapForSolidMaterialTraversal(pathfindingMap, materials),
          geometry: mapGeometryForSolidMaterialTraversal(geometry, materials),
          token: { ...target, ...trace.path[index - 1], elevationFeet: trace.pathElevationsFeet[index - 1] },
          to: trace.path[index],
          toElevationFeet: trace.pathElevationsFeet[index],
        }).blocked) return { ok: false, reason: 'movement-blocked' }
      }
    }
  }
  let actionState = { ...snapshot.state, initiativeIndex: input.readiedMovement?.currentInitiativeIndex ?? input.legendaryMovement?.currentInitiativeIndex ?? actorIndex }
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
  if (input.disengage) {
    const disengaged = resolveDnd5eHeadlessAction(actionState, {
      type: 'disengage',
      actorId: actorToken.id,
    })
    if (!disengaged.ok) return {
      ok: true,
      result: disengaged,
      distanceFeet,
      path: path.points,
      doorsToOpen: path.doorsToOpen,
    }
    actionState = disengaged.state
    priorEvents.push(...disengaged.events)
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
  const movementPoolSpeed = dnd5eEffectiveMovementPoolSpeed(actorCombatant)
  const walkSpeed = dnd5eEffectiveWalkSpeed(actorCombatant)
  const runningJump = traversalMode === 'long-jump-running'
    ? dnd5eRunningJumpSegments({
        distanceFeet: path.distanceFeet,
        approachFeetAlready: input.jumpSegment && actorCombatant.classState.jumpMovementProgress
          ? actorCombatant.runningJumpMinimumApproachFeet ?? 10 : actorCombatant.classState.runningJumpApproachFeet,
        minimumApproachFeet: actorCombatant.runningJumpMinimumApproachFeet,
      })
    : undefined
  if (runningJump && !runningJump.hasRunningStart) {
    if(input.jumpSegment==='continue' && runningJump.jumpDistanceFeet===0)
      return resolveDnd5eMonsterMapMoveInternal({...input,traversalMode:'walk',jumpSegment:undefined,jumpApproachCheckpoint:true},previewOnly)
    return { ok: false, reason: 'jump-too-far' }
  }
  const jumpLaunch = dnd5eJumpLaunchPoint({path:path.points,elevationsFeet:path.elevationsFeet,approachFeet:runningJump?.approachFeetIncluded ?? 0,coordinateUnitsPerFoot:input.map.gridSize/(input.map.feetPerCell ?? 5)})
  const traversalProfile = {
    strengthScore: actorCombatant.abilities.str,
    strengthModifier: Math.floor((actorCombatant.abilities.str - 10) / 2),
    movementPoolSpeed,
    walkSpeed,
    climbSpeed: dnd5eEffectiveOptionalMovementSpeed(actorCombatant, 'climb'),
    swimSpeed: dnd5eEffectiveOptionalMovementSpeed(actorCombatant, 'swim'),
    flySpeed: effectiveFlySpeed,
    verticalJumpBonusFeet: jumpLaunch ? dnd5eHeadlessAreaTraversalModifiers(snapshot.state, actorCombatant, jumpLaunch).verticalJumpBonusFeet : 0,
    jumpDistanceMultiplier: dnd5eActiveJumpDistanceMultiplier(
      actorCombatant.classState.activeEffects,
    ),
  }
  const traversal = dnd5eTraversalMovementCost({
    distanceFeet: runningJump?.jumpDistanceFeet ?? path.distanceFeet,
    baseMovementCostFeet: input.jumpApproachCheckpoint || traversalMode === 'long-jump-running' || traversalMode === 'long-jump-standing'
      ? path.unroundedMovementCostFeet ?? path.movementCostFeet : path.movementCostFeet,
    elevationGainFeet: traversalMode === 'climb' ? 0 : usesFlight
      ? Math.abs(finalElevationFeet - actorElevationFeet)
      : Math.max(0, finalElevationFeet - actorElevationFeet),
    mode: traversalMode,
    profile: traversalProfile,
  })
  if (!traversal.ok) return { ok: false, reason: traversal.reason }
  const jumpProgress = input.jumpSegment ? actorCombatant.classState.jumpMovementProgress : undefined
  if (jumpProgress) {
    const totalJump = dnd5eTraversalMovementCost({distanceFeet:jumpProgress.distanceFeet+(runningJump?.jumpDistanceFeet??path.distanceFeet),
      elevationGainFeet:Math.max(0,finalElevationFeet-jumpProgress.launchElevationFeet),mode:traversalMode,profile:traversalProfile})
    if (!totalJump.ok) return {ok:false,reason:totalJump.reason}
  }
  const locomotionCostFeet = traversal.movementCostFeet +
    (isProne && !standFromProne ? path.distanceFeet : 0)
  const movementCostFeet = locomotionCostFeet +
    (standFromProne ? Math.floor(dnd5eEffectiveSpeed(actorCombatant) / 2) : 0) +
    dnd5eGrappleDragExtraMovementFeet(actionState, actorToken.id, locomotionCostFeet) +
    (swallowedCorpseEscapePlan?.movementCostFeet ?? 0)
  const movementActor = actionState.combatants[actorToken.id] ?? actorCombatant
  const modeMovementRemainingFeet = dnd5eTraversalModeRemainingMovementFeet({
    movementRemainingFeet: movementActor.turn.movementRemaining,
    movementSpentFeet: movementActor.turn.movementSpent ?? 0,
    mode: traversalMode,
    profile: traversalProfile,
  })
  if (movementCostFeet > modeMovementRemainingFeet) {
    return { ok: false, reason: 'movement-blocked', unaffordablePath: path.points }
  }
  const movementAction: Extract<Dnd5eAction, { type: 'move' }> = {
      effectRollDice: input.effectRollDice,
      type: 'move', actorId: actorToken.id, to: input.to, distance: path.distanceFeet,
      jumpSegment: input.jumpSegment,
      hostMovementPath:[{...actorCombatant.position,elevationFeet:actorElevationFeet},
        ...path.points.map((point,index)=>({...point,elevationFeet:path.elevationsFeet[index]??actorElevationFeet})),{...input.to,elevationFeet:finalElevationFeet}],
      monsterLegendaryMovement: input.legendaryMovement ? true : undefined,
      jumpDistance: runningJump?.jumpDistanceFeet,
      jumpPath: runningJump ? path.points : undefined,
      jumpPathElevationsFeet: runningJump ? path.elevationsFeet : undefined,
      climbDistanceIncludesElevation: traversalMode === 'climb' ? true : undefined,
      movementCost: movementCostFeet, movementCostIncludesDrag: true,
      traversalMode,
      toElevationFeet: finalElevationFeet,
      toGroundElevationFeet: mapGeometryTerrainElevationAtPoint(geometry, input.to),
      boundarySavingThrows: input.boundarySavingThrows,
      movementRepeatSavingThrows: input.movementRepeatSavingThrows,
      standFromProne,
      fallingDamageRollsByCombatantId: input.fallingDamageRollsByCombatantId,
  }
  if (input.readiedMovement) {
    actionState.combatants[actorToken.id].turn.movementRemaining = ordinaryMovement.remaining
    actionState.combatants[actorToken.id].turn.movementSpent = ordinaryMovement.spent
  }
  const result = resolveDnd5eHeadlessAction(actionState, input.readiedMovement
    ? { type: 'trigger-readied-action', actorId: actorToken.id, moveExecution: movementAction, movementSegment:input.readiedMovement.segment, effectRollDice: input.effectRollDice }
    : movementAction, { transactionId: input.transactionId }, {deferMovementRepeatSavingThrows:input.deferMovementRepeatSavingThrows})

  if (!result.ok) return { ok: true, result, distanceFeet, path: path.points, doorsToOpen: path.doorsToOpen }
  if (result.movementBlocked) {
    // Auto-open is part of the unperformed path. Restore only its free-object
    // interaction, retaining prior Dash/Disengage and the settled save costs.
    const unopenedDoor = path.doorsToOpen[0]
    if (unopenedDoor) result.state.combatants[actorToken.id].turn.objectInteractionAvailable =
      snapshot.state.combatants[actorToken.id].turn.objectInteractionAvailable
    const settled = { ...result, events: [...priorEvents, ...result.events].filter(event => !unopenedDoor || !(
      event.type === 'turn-resource-spent' && event.actorId === actorToken.id && event.resource === 'objectInteraction' ||
      event.type === 'object-action-taken' && event.actorId === actorToken.id && event.action === 'interact-object' && event.interactionId === `open:${unopenedDoor}`
    )) }
    return { ok: true, result: settled, distanceFeet: 0, path: [{ x: actorToken.x, y: actorToken.y }],
      doorsToOpen: [], movementTraces: [], traversalMode,
      [previewOnly ? 'previewApplication' : 'application']: planDnd5eMapResultApplication({ state: settled.state, map: input.map, characters: input.characters,
        characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...settled.events] }) }
  }
  // The map adapter has already validated these relations against the same
  // snapshot used by Headless. Keep the coupled map projection authoritative
  // even when a legacy saved effect is accepted by the schema but omitted by
  // active-effect reconciliation. This also makes old engulf saves migrate
  // forward without leaving the carried token behind visually.
  const carriedMovementEvents: Dnd5eCombatEvent[] = []
  for (const movement of carriedMovementTraces) {
    const carried = result.state.combatants[movement.tokenId]
    if (!carried) continue
    const from = { ...carried.position }
    if (from.x === movement.to.x && from.y === movement.to.y) continue
    carried.position = { ...movement.to }
    carried.elevationFeet = movement.pathElevationsFeet.at(-1) ?? carried.elevationFeet
    carried.groundElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, movement.to)
    carried.airborne = (carried.elevationFeet ?? 0) > (carried.groundElevationFeet ?? 0) + 1e-4
    carriedMovementEvents.push({
      type: 'moved',
      actorId: carried.id,
      from,
      to: carried.position,
      distance: path.distanceFeet,
    })
  }
  // Preflight is not a commit: opportunity attacks can change the actor before
  // the final endpoint, concentration ending and falling are calculated.
  if (previewOnly) return {
    ok: true, result: { ...result, events: [...priorEvents, ...result.events, ...carriedMovementEvents] },
    distanceFeet, path: path.points, doorsToOpen: path.doorsToOpen, traversalMode,
    movementTraces: [{ tokenId: actorToken.id, to: input.to, path: path.points, pathElevationsFeet: path.elevationsFeet },
      ...draggedMovementTraces, ...carriedMovementTraces],
    previewApplication: planDnd5eMapResultApplication({ state: structuredClone(result.state), map: input.map,
      characters: input.characters, characterIdByCombatantId: snapshot.characterIdByCombatantId,
      openedDoorIds: path.doorsToOpen, events: [...priorEvents, ...result.events, ...carriedMovementEvents] }),
  }
  const exit = input.deferSolidMaterialExit
    ? { ok: true as const, state: result.state, events: [] as Dnd5eCombatEvent[] }
    : settleDnd5eSolidMaterialExit({ state: result.state, map: input.map, geometry, actorId: actorToken.id })
  if (!exit.ok) return { ok: false, reason: 'movement-blocked' }
  const pushedIds = exit.events.flatMap(event => event.type === 'moved' ? [event.actorId] : [])
  const reactions = replayDnd5eSolidExitFeatherFallChoices(snapshot.state, exit.state, pushedIds, input.solidExitFeatherFallChoices)
  if (!reactions.ok) return { ok: false, reason: 'movement-blocked' }
  exit.state = reactions.state
  exit.events.push(...reactions.events)
  const falls = pushedIds.length
    ? previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(snapshot.state, exit.state, pushedIds) : []
  if (falls.length) {
    if (input.airborneFallDamageRollsByCombatantId == null) return { ok: true,
      result: { ok: false, state: snapshot.state, events: [], reason: 'invalid-dice' }, airborneFalls: falls, solidExitReactionState: exit.state,
      distanceFeet: 0, path: [{ x: actorToken.x, y: actorToken.y }], doorsToOpen: [] }
    const landed = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(snapshot.state, exit.state,
      input.airborneFallDamageRollsByCombatantId, pushedIds)
    if (!landed.ok) return { ok: true, result: landed, airborneFalls: falls,
      distanceFeet: 0, path: [{ x: actorToken.x, y: actorToken.y }], doorsToOpen: [] }
    exit.state = landed.state
    exit.events.push(...landed.events)
  }
  const transactionResult: Dnd5eActionResult = {
    ...result,
    state: exit.state,
    events: [...priorEvents, ...result.events, ...carriedMovementEvents, ...exit.events],
  }
  return {
    ok: true,
    result: transactionResult,
    distanceFeet,
    path: path.points,
    doorsToOpen: path.doorsToOpen,
    traversalMode,
    movementTraces: appendDnd5eSolidExitMovementTraces([
      {
        tokenId: actorToken.id,
        to: input.to,
        path: path.points,
        pathElevationsFeet: path.elevationsFeet,
      },
      ...draggedMovementTraces,
      ...carriedMovementTraces,
    ], exit.events),
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

/** Authoritative settlement, including endpoint ejection and fall interrupts. */
export function resolveDnd5eMonsterMapMove(input: Parameters<typeof resolveDnd5eMonsterMapMoveInternal>[0]) {
  return resolveDnd5eMonsterMapMoveInternal(input)
}

/** Validate a route before opportunity attacks; deliberately produces no application. */
export function previewDnd5eMonsterMapMove(input: Parameters<typeof resolveDnd5eMonsterMapMoveInternal>[0]) {
  return resolveDnd5eMonsterMapMoveInternal(input, true)
}
