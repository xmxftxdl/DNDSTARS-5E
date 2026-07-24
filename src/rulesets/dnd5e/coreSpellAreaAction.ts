import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { moveDnd5eCoreSpellArea } from './coreSpellAreas'
import { resolveDnd5eHeadlessAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'

export interface PreparedDnd5eCoreSpellAreaMove {
  action: SharedPlayerActionState
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  areaId: string
  targetCell: { col: number; row: number }
  economy: 'action' | 'bonusAction'
  geometry?: MapGeometryState
  impactTargetId?: string
}

export function prepareDnd5eCoreSpellAreaMove(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy: Dnd5eTurnEconomyCounts
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
  if (
    !actor || !actorToken || !area || area.sourceKind !== 'core-spell' ||
    area.sourceCharacterId !== actor.id || area.sourceTokenId !== actorToken.id || !area.movement ||
    !Number.isInteger(payload.targetCell.col) || !Number.isInteger(payload.targetCell.row)
  ) return { ok: false, reason: 'invalid-target' }
  if (
    area.concentrationId &&
    (!actor.concentrating || actor.dnd5eCombatState?.concentrationSpellId !== area.concentrationId)
  ) {
    return { ok: false, reason: 'concentration-ended' }
  }
  const moved = moveDnd5eCoreSpellArea({
    map: input.map, geometry: input.geometry,
    areaId: area.id, sourceTokenId: actorToken.id, targetCell: payload.targetCell,
  })
  if (!moved.ok) return moved
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.action.combatId ?? `map-${input.map.id}`,
    round: input.action.round,
    turnSlotId: input.initiativeOrder[input.action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant) return { ok: false, reason: 'combatant-missing' }
  actorCombatant.turn = {
    ...actorCombatant.turn,
    actionAvailable: input.turnEconomy.action.current > 0,
    bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0,
    movementRemaining: input.turnEconomy.movement.current,
  }
  return {
    ok: true,
    prepared: {
      action: input.action,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      areaId: area.id,
      targetCell: { ...payload.targetCell },
      economy: area.movement.economy === 'action' ? 'action' : 'bonusAction',
      geometry: input.geometry,
      impactTargetId: moved.impactTargetId,
    },
  }
}

export function resolvePreparedDnd5eCoreSpellAreaMove(input: {
  prepared: PreparedDnd5eCoreSpellAreaMove
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const moved = moveDnd5eCoreSpellArea({
    map: prepared.map,
    geometry: prepared.geometry,
    areaId: prepared.areaId,
    sourceTokenId: prepared.action.actorTokenId,
    targetCell: prepared.targetCell,
  })
  if (!moved.ok) {
    return { result: { ok: false, state: prepared.state, events: [], reason: 'invalid-class-feature' } }
  }
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'move-persistent-area', actorId: prepared.action.actorTokenId,
    areaId: prepared.areaId, economy: prepared.economy,
  })
  if (!result.ok) return { result }
  return {
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: moved.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
    }),
  }
}
