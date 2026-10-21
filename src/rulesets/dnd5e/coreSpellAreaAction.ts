import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import { persistentAreaMovementScope, persistentAreaMovementScopeMatches } from './persistentAreaMovementScope'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { collectDnd5ePersistentAreaTriggers } from './pluginAreas'
import type { Character } from '../../types/character'
import { createDnd5eMapCombatSnapshot, dnd5eRequestedInitiativeActorIndex, planDnd5eMapResultApplication, prepareDnd5eExplorationActor, type Dnd5eMapResultPlan } from './mapBridge'
import { getDnd5eCoreSpellAreaDeclaration, moveDnd5eCoreSpellArea } from './coreSpellAreas'
import { endDnd5eConcentration, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import {
  resolveDnd5eActionWithAirborneFallPreview,
  type Dnd5eAirborneFallDamageRolls,
  type Dnd5eAirborneFallPreview,
} from './airborneFallActionResolution'
import { dnd5eUtilityProjectionMovementEconomy } from './utilityProjection'
import { planDnd5ePersistentAreaCarry } from './persistentAreaCarry'
import { recordDnd5eStraightMovement } from './straightMovementStreak'

export interface PreparedDnd5eCoreSpellAreaMove {
  worldMinute?: number
  action: SharedPlayerActionState
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  areaId: string
  targetCell: { col: number; row: number }
  targetCells?: readonly { col: number; row: number }[]
  targetElevationFeet?: number
  continuationTurnKey?: string
  continuationScope?: ReturnType<typeof persistentAreaMovementScope>
  economy: 'action' | 'bonusAction' | 'none'
  geometry?: MapGeometryState
  impactTargetId?: string
}

/** Preview may overlap only creatures whose contact the sweep must subsequently settle. */
function sweepCarryPreview(map: BattleMap, area: Dnd5ePluginArea, nextArea: Dnd5ePluginArea,
  areaPath: readonly {x:number;y:number;elevationFeet:number}[] | undefined, round: number, turnKey?: string) {
  if (area.vertical?.mode !== 'volume' || (area.vertical.shape !== 'sphere' && !area.circularGeometry?.radiusFeet) ||
    nextArea.vertical?.mode !== 'volume' || !area.anchorCell || !nextArea.anchorCell ||
    !area.movement?.carryRestrainedTargets || !area.triggers?.some(t=>t.timing==='on-area-move-impact')) return {areaPath}
  const path = areaPath ?? [
    {x:map.gridOffsetX+(area.anchorCell.col+.5)*map.gridSize,y:map.gridOffsetY+(area.anchorCell.row+.5)*map.gridSize,elevationFeet:area.vertical.baseElevationFeet},
    {x:map.gridOffsetX+(nextArea.anchorCell.col+.5)*map.gridSize,y:map.gridOffsetY+(nextArea.anchorCell.row+.5)*map.gridSize,elevationFeet:nextArea.vertical.baseElevationFeet},
  ]
  return {areaPath:path,pendingContactTargetIds:collectDnd5ePersistentAreaTriggers({map,areaId:area.id,
    timing:'on-area-move-impact',round,turnKey,areaSweep:{areaId:area.id,path}}).map(candidate=>candidate.targetToken.id)}
}

function moveAreaWithTurnBudget(input: Parameters<typeof moveDnd5eCoreSpellArea>[0], action: SharedPlayerActionState, turnKey?: string, scope?: ReturnType<typeof persistentAreaMovementScope>) {
  if (scope) { action = { ...action, combatId: scope.combatId, round: scope.round }; turnKey = scope.turnKey }
  const area = input.map.dnd5ePluginAreas?.find(candidate => candidate.id === input.areaId)
  const receipt = area?.movementContinuation
  const continued = !!(area?.movement && receipt && action.combatId && turnKey &&
    receipt.combatId === action.combatId && receipt.round === action.round && receipt.turnKey === turnKey &&
    Number.isFinite(receipt.remainingFeet) && receipt.remainingFeet >= 0 && receipt.remainingFeet <= area.movement.maximumFeet)
  const budgetMap = continued ? { ...input.map, dnd5ePluginAreas: input.map.dnd5ePluginAreas?.map(candidate =>
    candidate.id === area!.id ? { ...candidate, movement: { ...area!.movement!, maximumFeet: receipt!.remainingFeet } } : candidate) } : input.map
  const moved = moveDnd5eCoreSpellArea({ ...input, map: budgetMap })
  if (!moved.ok) return { moved, continued }
  const candidates = area?.movement?.economy === 'bonus-action' ? area.grantedActivities?.filter(grant => {
    const activity = getRegisteredDnd5eActivity(area.pluginId, grant.activityId)
    return activity?.activation.kind === 'bonus-action' && activity.outcomes.some(outcome => outcome.operations.some(operation =>
      operation.kind === 'relocate-granting-area' && operation.retainMovementBudget === true))
  }) ?? [] : []
  const opened = !continued && action.combatId && turnKey && candidates.length === 1
    ? { combatId: action.combatId, turnKey, round: action.round, remainingFeet: area!.movement!.maximumFeet, pendingActivityId: candidates[0].activityId } : undefined
  const budget = continued ? receipt : opened
  if (!budget) return { moved, continued }
  const nextArea = { ...moved.area, movement: area!.movement,
    movementContinuation: { ...budget, remainingFeet: Math.max(0, budget.remainingFeet - moved.distanceFeet) } }
  return { continued, moved: { ...moved, area: nextArea, map: { ...moved.map,
    dnd5ePluginAreas: moved.map.dnd5ePluginAreas?.map(candidate => candidate.id === area!.id ? nextArea : candidate) } } }
}

export function prepareDnd5eCoreSpellAreaMove(input: {
  worldMinute?: number
  worldSecondRemainder?: number
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  geometry?: MapGeometryState
}): { ok: true; prepared: PreparedDnd5eCoreSpellAreaMove } | { ok: false; reason: string } {
  const payload = input.action.dnd5ePersistentAreaMove
  if (input.action.type !== 'dnd5e-persistent-area-move' || !payload) {
    return { ok: false, reason: 'invalid-action' }
  }
  const actor = input.characters.find((candidate) => candidate.id === input.action.characterId)
  const actorToken = input.map.tokens.find((candidate) =>
    candidate.id === input.action.actorTokenId && candidate.characterId === actor?.id,
  )
  const area = input.map.dnd5ePluginAreas?.find((candidate) => candidate.id === payload.areaId)
  const declaredMovement = area?.coreSpellId
    ? getDnd5eCoreSpellAreaDeclaration(area.coreSpellId)?.movement
    : undefined
  const movement = area?.movement ?? declaredMovement
  if (
    !actor || !actorToken || !area ||
    area.sourceCharacterId !== actor.id || area.sourceTokenId !== actorToken.id || !movement ||
    !Number.isInteger(payload.targetCell.col) || !Number.isInteger(payload.targetCell.row) ||
    (payload.targetCells?.some((cell) => !Number.isInteger(cell.col) || !Number.isInteger(cell.row)) ?? false)
  ) return { ok: false, reason: 'invalid-target' }
  if (
    area.concentrationId &&
    (!actor.concentrating || actor.dnd5eCombatState?.concentrationSpellId !== area.concentrationId)
  ) {
    return { ok: false, reason: 'concentration-ended' }
  }
  const movementEconomy = area.coreSpellId
    ? dnd5eUtilityProjectionMovementEconomy(actor, area.coreSpellId, movement.economy)
    : movement.economy
  const continuationScope = persistentAreaMovementScope({ mapId: input.map.id, actorId: actorToken.id,
    combatId: input.action.combatId, round: input.action.round, turnKey: input.turnEconomy?.turnKey,
    worldMinute: input.worldMinute, worldSecondRemainder: input.worldSecondRemainder })
  if (!input.action.combatId && !continuationScope && area.grantedActivities?.some(grant =>
    getRegisteredDnd5eActivity(area.pluginId, grant.activityId)?.outcomes.some(outcome =>
      outcome.operations.some(operation => operation.kind === 'relocate-granting-area' && operation.retainMovementBudget)))) {
    return { ok: false, reason: 'invalid-target' }
  }
  const { moved, continued } = moveAreaWithTurnBudget({
    characters: input.characters,
    worldMinute: input.worldMinute,
    round: input.action.round,
    map: input.map, geometry: input.geometry,
    areaId: area.id, sourceTokenId: actorToken.id, targetCell: payload.targetCell,
    targetCells: payload.targetCells,
    targetElevationFeet: payload.targetElevationFeet,
  }, input.action, input.turnEconomy?.turnKey, continuationScope)
  if (!moved.ok) return moved
  const carried = moved.map.dnd5ePluginAreas?.some(candidate => candidate.id === area.id)
    ? planDnd5ePersistentAreaCarry({ map: input.map, characters: input.characters, area, nextArea: moved.area,
      ...sweepCarryPreview(input.map,area,moved.area,moved.areaPath,input.action.round,input.turnEconomy?.turnKey), geometry: input.geometry }) : []
  if (!carried) return { ok: false, reason: 'movement-blocked' }
  const missingParticipants = carried.filter(move => !input.initiativeOrder.some(entry => entry.tokenId === move.targetId))
  const lastInitiative = Math.min(0, ...input.initiativeOrder.map(entry => entry.roll)) - 1
  const initiativeOrder = [...input.initiativeOrder, ...missingParticipants.map(move => {
    const token = input.map.tokens.find(candidate => candidate.id === move.targetId)!
    return { tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: lastInitiative }
  })]
  const snapshot = createDnd5eMapCombatSnapshot({
    worldMinute: input.worldMinute,
    combatId: input.action.combatId ?? `map-${input.map.id}`,
    round: input.action.round,
    turnSlotId: input.initiativeOrder[input.action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder,
    geometry: input.geometry,
  })
  const actorIndex = dnd5eRequestedInitiativeActorIndex(
    snapshot.state,
    actorToken.id,
    input.action.initiativeIndex,
  )
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant) return { ok: false, reason: 'combatant-missing' }
  if (!input.action.combatId?.trim()) prepareDnd5eExplorationActor(snapshot.state, actorToken.id)
  if (input.turnEconomy) {
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }
  return {
    ok: true,
    prepared: {
      worldMinute: input.worldMinute,
      action: input.action,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      areaId: area.id,
      targetCell: { ...payload.targetCell },
      targetElevationFeet: payload.targetElevationFeet,
      targetCells: payload.targetCells?.map((cell) => ({ ...cell })),
      continuationTurnKey: input.turnEconomy?.turnKey,
      continuationScope,
      economy: continued || movementEconomy === 'none'
        ? 'none'
        : movementEconomy === 'action' ? 'action' : 'bonusAction',
      geometry: input.geometry,
      impactTargetId: moved.impactTargetId,
    },
  }
}

export function resolvePreparedDnd5eCoreSpellAreaMove(input: {
  prepared: PreparedDnd5eCoreSpellAreaMove
  currentMovementScope?: ReturnType<typeof persistentAreaMovementScope>
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
}): {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  sphereSweep?: {
    startApplication: Dnd5eMapResultPlan
    path: readonly { x: number; y: number; elevationFeet: number }[]
  }
  airborneFalls?: readonly Dnd5eAirborneFallPreview[]
} {
  const { prepared } = input
  if ('currentMovementScope' in input &&
    !persistentAreaMovementScopeMatches(prepared.continuationScope, input.currentMovementScope)) {
    return { result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' } }
  }
  const { moved } = moveAreaWithTurnBudget({
    characters: prepared.characters,
    worldMinute: prepared.worldMinute,
    round: prepared.action.round,
    map: prepared.map,
    geometry: prepared.geometry,
    areaId: prepared.areaId,
    sourceTokenId: prepared.action.actorTokenId,
    targetCell: prepared.targetCell,
    targetCells: prepared.targetCells,
    targetElevationFeet: prepared.targetElevationFeet,
  }, prepared.action, prepared.continuationTurnKey, prepared.continuationScope)
  if (!moved.ok) {
    return { result: { ok: false, state: prepared.state, events: [], reason: 'invalid-class-feature' } }
  }
  const area = prepared.map.dnd5ePluginAreas?.find(candidate => candidate.id === prepared.areaId)
  const carried = area && moved.map.dnd5ePluginAreas?.some(candidate => candidate.id === area.id)
    ? planDnd5ePersistentAreaCarry({ map: prepared.map, characters: prepared.characters, area, nextArea: moved.area,
      ...sweepCarryPreview(prepared.map,area,moved.area,moved.areaPath,prepared.action.round,prepared.continuationTurnKey), geometry: prepared.geometry }) : []
  if (!carried || carried.some(move => !prepared.state.combatants[move.targetId])) {
    return { result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' } }
  }
  let { result, airborneFalls } = resolveDnd5eActionWithAirborneFallPreview(prepared.state, {
    type: 'move-persistent-area', actorId: prepared.action.actorTokenId,
    areaId: prepared.areaId, economy: prepared.economy,
  }, input.airborneFallDamageRollsByCombatantId)
  if (!result.ok) return { result, airborneFalls }
  // Retain the paid action state at the starting positions. Contact settlement
  // must carry creatures incrementally rather than start from the final map.
  const sphereSweep = area?.vertical?.mode === 'volume' && (area.vertical.shape === 'sphere' || !!area.circularGeometry?.radiusFeet) &&
    area.movement?.carryRestrainedTargets && area.triggers?.some(trigger => trigger.timing === 'on-area-move-impact') &&
    area.anchorCell && moved.area.anchorCell && moved.area.vertical?.mode === 'volume'
    ? {
        startApplication: planDnd5eMapResultApplication({ state: structuredClone(result.state), map: prepared.map,
          characters: prepared.characters, characterIdByCombatantId: prepared.characterIdByCombatantId,
          events: [...result.events], geometry: prepared.geometry }),
        path: moved.areaPath ?? [
          { x: prepared.map.gridOffsetX + (area.anchorCell.col + .5) * prepared.map.gridSize,
            y: prepared.map.gridOffsetY + (area.anchorCell.row + .5) * prepared.map.gridSize,
            elevationFeet: area.vertical.baseElevationFeet },
          { x: prepared.map.gridOffsetX + (moved.area.anchorCell.col + .5) * prepared.map.gridSize,
            y: prepared.map.gridOffsetY + (moved.area.anchorCell.row + .5) * prepared.map.gridSize,
            elevationFeet: moved.area.vertical.baseElevationFeet },
        ],
      } : undefined
  const events = [...result.events]
  result = { ...result, events }
  for (const move of carried) {
    result.state.combatants[move.targetId].position = { ...move.to }
    if(move.toElevationFeet!==undefined){
      const target=result.state.combatants[move.targetId]
      target.elevationFeet=move.toElevationFeet;target.groundElevationFeet=move.groundElevationFeet
      target.airborne=move.toElevationFeet>(move.groundElevationFeet??0)
    }
    events.push({ type: 'moved', actorId: move.targetId, sourceActorId: prepared.action.actorTokenId,
      from: move.from, to: move.to, fromElevationFeet:move.fromElevationFeet,toElevationFeet:move.toElevationFeet,distance: move.distanceFeet, movementKind: 'forced' })
  }
  recordDnd5eStraightMovement(result.state, events)
  if (
    moved.area.concentrationId &&
    !moved.map.dnd5ePluginAreas?.some((area) => area.id === prepared.areaId)
  ) {
    const source = result.state.combatants[prepared.action.actorTokenId]
    if (source?.classState.concentrationSpellId === moved.area.concentrationId) {
      endDnd5eConcentration(result.state, source, events)
    }
  }
  return {
    result,
    airborneFalls,
    sphereSweep,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: moved.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
      events,
      geometry: prepared.geometry,
    }),
  }
}

