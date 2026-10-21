import { dnd5eSavingThrowMode } from './passiveDefenses'
import type { Dnd5eActiveEffectSavingThrowRoll } from './activeEffects'
import { dnd5eAttackActionSlot } from './attackActionSlot'
import { dnd5eOrdinaryAttacksUsed } from './attackActionHistory'
import { dnd5eCharacterDistinctTargetBonusFeature } from './characterWeaponAttackSlot'
import { prepareDnd5eAttackTeleportDestination } from './attackTeleportDestination'
import { resolveDnd5eAttackTeleportLanding, attackTeleportArrivalConsumedAction, type Dnd5eAttackTeleportArrival } from './attackTeleportLanding'
import { dnd5eCharacterHasPluginFeature, dnd5ePluginFeaturesAvailableForCharacter } from './pluginApi'
import { planDnd5eDismountPlacement } from './mountedPlacement'
import {resolveDnd5eActionWithEscapeEjection,type Dnd5eEscapeEjectionRolls,type Dnd5eEscapeEjectionRequest} from './persistentAreaEscapeEjection'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { Dnd5eBasicActionPayload, Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { endDnd5eDreamContact } from './dreamContact'
import type { D20RollMode } from '../contracts'
import {
  dnd5eAbilityCheckRollMode,
  dnd5eBestActiveEffectEscapeOption,
  dnd5eBestGrappleDefense,
  dnd5eBasicAttackTargetEligible,
  dnd5eBasicHelpTargetEligible,
  dnd5eBasicWakeTargetEligible,
  dnd5eActiveEffectRemovalAllowed,
  resolveDnd5eHeadlessAction,
  type Dnd5eCombatEvent,
  type Dnd5eAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eUnsupportedAirborneFallPreview,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, dnd5eRequestedInitiativeActorIndex, prepareDnd5eExplorationActor, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eEffectiveAttacksPerAttackAction, dnd5eCharacterRageDeathDeferralActive } from './pluginApi'
import {
  dnd5eAvailableRestrictedExtraActionKinds,
  dnd5eEscapableGrapples,
} from './activeEffects'
import {
  cellKey,
  DND_FEET_PER_CELL,
  mapCellExtent,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenFootprintDistanceCells,
  tokenOccupiedCellsAt,
} from '../../lib/gridCombat'
import {
  mapGeometryMovementBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
} from '../../lib/mapGeometry'
import { dnd5eActivityBasicActionGrantMatchesV1 } from './activities/dnd5eActivityBasicActionGrant'
import { dnd5eAnimateDeadControlledUndead, dnd5eCreateUndeadControlledUndead } from './animateDead'
import { dnd5eAnimateObjectsControlledCreature } from './animateObjects'
import { DND5E_FLAME_BLADE_RELEASED_SUSPENSION } from './sustainedSpellControls'

const SAFE_ANIMATE_DEAD_COMMAND_TARGET_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i

export type Dnd5eBasicActionRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'invalid-target'
  | 'action-unavailable'
  | 'combatant-missing'
  | 'invalid-dice'

export interface PreparedDnd5eBasicAction {
  attackTeleportPrelude?: {
    originalState: Dnd5eHeadlessCombatState
    map: BattleMap
    characters: readonly Character[]
    events: Dnd5eCombatEvent[]
  }
  attackActionTeleport?: {
    preparationInput: Parameters<typeof prepareDnd5ePlayerBasicAction>[0]
    featureId: string
    originalState: Dnd5eHeadlessCombatState
    from: { x: number; y: number }
    fromElevationFeet: number
    distanceFeet: number
    worldMinute?: number
  }
  distinctTargetBonusAttackFeatureId?: string
  action: SharedPlayerActionState
  payload: Dnd5eBasicActionPayload
  map: BattleMap
  characters: readonly Character[]
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Readonly<Record<string, string>>
  actor: Character
  actorTokenId: string
  spendsAction: boolean
  spendsBonusAction: boolean
  attackNumber?: number
  actorRollKind?: 'ability-check' | 'saving-throw'
  actorRollMode: D20RollMode
  targetRollMode: D20RollMode
  actorContestSkill?: 'athletics' | 'acrobatics'
  actorCheckAbility?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
  escapeEffectId?: string
  dismissEffectId?: string
  targetDefense?: 'athletics' | 'acrobatics'
  pushTo?: { x: number; y: number }
  pushDistanceFeet?: number
  activityBasicActionGrantId?: string
}

export function planDnd5eShovePushDestination(
  map: BattleMap,
  actorTokenId: string,
  targetTokenId: string,
  distanceFeet = 5,
) {
  const actor = map.tokens.find((token) => token.id === actorTokenId)
  const target = map.tokens.find((token) => token.id === targetTokenId)
  if (!actor || !target) return undefined
  const targetCell = tokenAnchorCellFromPixel(target.x, target.y, target, map)
  // Different footprints have different anchor offsets; use centers for direction.
  const dc = Math.sign(target.x - actor.x)
  const dr = Math.sign(target.y - actor.y)
  if (dc === 0 && dr === 0) return undefined
  const cellCount = Math.max(1, Math.floor(distanceFeet / 5))
  const destinationCell = { col: targetCell.col + dc * cellCount, row: targetCell.row + dr * cellCount }
  const { cols, rows } = mapCellExtent(map)
  const to = tokenCenterForAnchorCell(destinationCell, target, map)
  const footprint = tokenOccupiedCellsAt(target, map, to)
  const occupied = new Set(map.tokens
    .filter((token) => token.id !== target.id && (token.type !== 'obstacle' || token.obstacleKind !== 'marker'))
    .flatMap((token) => tokenOccupiedCellsAt(token, map, token))
    .map(cellKey))
  const geometry = mapGeometryRuntimeForMap(map.id)
  const pathBlocked = Array.from({ length: cellCount }, (_, index) => ({
    col: targetCell.col + dc * (index + 1),
    row: targetCell.row + dr * (index + 1),
  })).some((cell) => {
    const step = tokenCenterForAnchorCell(cell, target, map)
    return tokenOccupiedCellsAt(target, map, step).some((occupiedCell) => occupied.has(cellKey(occupiedCell))) ||
      mapGeometryMovementBlocked({ geometry, map, token: target, to: step }).blocked ||
      mapGeometryPlacementBlocked({ geometry, map, token: target, at: step }).blocked
  })
  if (
    footprint.some((cell) => cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) ||
    footprint.some((cell) => occupied.has(cellKey(cell))) ||
    mapGeometryMovementBlocked({ geometry, map, token: target, to }).blocked ||
    mapGeometryPlacementBlocked({ geometry, map, token: target, at: to }).blocked ||
    pathBlocked
  ) return undefined
  return to
}

export function triggerDnd5eReadiedAction(input: {
  combatId: string
  round: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  turnEconomy: Dnd5eTurnEconomyCounts
}): {
  ok: true
  actor: Character
  result: Extract<Dnd5eActionResult, { ok: true }>
  application: Dnd5eMapResultPlan
} | { ok: false; reason: Dnd5eBasicActionRejectReason | 'reaction-unavailable' } {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId && token.characterId)
  const actor = actorToken?.characterId
    ? input.characters.find((character) => character.id === actorToken.characterId)
    : undefined
  if (!actorToken || !actor || (actor.currentHp <= 0 && !dnd5eCharacterRageDeathDeferralActive(actor))) return { ok: false, reason: 'invalid-actor' }
  if (!actor.dnd5eCombatState?.readiedAction) return { ok: false, reason: 'invalid-action' }
  if (input.turnEconomy.reaction.current < 1) return { ok: false, reason: 'reaction-unavailable' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    turnSlotId: input.initiativeOrder.find((entry) => entry.tokenId === actorToken.id)?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,

  })
  const combatant = snapshot.state.combatants[actorToken.id]
  if (!combatant) return { ok: false, reason: 'combatant-missing' }
  combatant.turn.reactionAvailable = true
  const result = resolveDnd5eHeadlessAction(snapshot.state, {
    type: 'trigger-readied-action',
    actorId: actorToken.id,
  })
  if (!result.ok) {
    return { ok: false, reason: result.reason === 'reaction-unavailable' ? result.reason : 'invalid-action' }
  }
  return {
    ok: true,
    actor,
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      events: [...result.events],
    }),
  }
}

export function prepareDnd5ePlayerBasicAction(input: {
  /** Host world clock; never read from the shared player action. */
  worldMinute?: number
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy: Dnd5eTurnEconomyCounts
}): { ok: true; prepared: PreparedDnd5eBasicAction } | { ok: false; reason: Dnd5eBasicActionRejectReason } {
  const payload = input.action.dnd5eBasicAction
  if (input.action.type !== 'dnd5e-basic-action' || !payload) return { ok: false, reason: 'invalid-action' }
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const token = input.map.tokens.find((candidate) =>
    candidate.id === input.action.actorTokenId && candidate.characterId === input.action.characterId,
  )
  if (!actor || actor.rulesetId !== 'dnd5e-2014-srd-5.1' || (actor.currentHp <= 0 && !dnd5eCharacterRageDeathDeferralActive(actor)) || !token) {
    return { ok: false, reason: 'invalid-actor' }
  }
  const teleport = (payload.kind === 'grapple' || payload.kind === 'shove') && payload.attackActionTeleport
  if (teleport) {
    const feature = dnd5ePluginFeaturesAvailableForCharacter(actor).find(candidate =>
      candidate.automation === 'full' && candidate.declarativeAbility?.mechanic?.kind === 'attack-action-teleport' &&
      dnd5eCharacterHasPluginFeature(actor, candidate.id))
    const mechanic = feature?.declarativeAbility?.mechanic
    if (!feature || mechanic?.kind !== 'attack-action-teleport' ||
      !input.action.combatId || input.initiativeOrder[input.action.initiativeIndex]?.tokenId !== token.id ||
      (payload.kind !== 'grapple' && payload.kind !== 'shove') || payload.activityBasicActionGrantId)
      return { ok: false, reason: 'action-unavailable' }
    const destination = prepareDnd5eAttackTeleportDestination({ map: input.map,
      actorTokenId: token.id, characters: input.characters, targetCell: teleport.targetCell,
      targetElevationFeet: teleport.elevationFeet, rangeFeet: mechanic.rangeFeet, worldMinute: input.worldMinute })
    if (!destination.ok) return { ok: false, reason: 'invalid-target' }
    const movedMap = { ...input.map, tokens: input.map.tokens.map(candidate => candidate.id === token.id
      ? { ...candidate, ...destination.to, elevationFeet: destination.elevationFeet } : candidate) }
    const ready = prepareDnd5ePlayerBasicAction({ ...input, map: movedMap,
      action: { ...input.action, dnd5eBasicAction: { ...payload, attackActionTeleport: undefined } } })
    if (!ready.ok) return ready
    const original = createDnd5eMapCombatSnapshot({ combatId: input.action.combatId, worldMinute: input.worldMinute,
      round: input.action.round, turnSlotId: input.initiativeOrder[input.action.initiativeIndex]?.slotId,
      map: input.map, characters: input.characters, initiativeOrder: input.initiativeOrder,
      additionalCreatureTokenIds: input.map.tokens.filter(candidate => candidate.type !== 'obstacle').map(candidate => candidate.id) })
    return { ok: true, prepared: { ...ready.prepared, action: input.action, payload, map: input.map,
      attackActionTeleport: { preparationInput: input, featureId: feature.id, originalState: original.state,
        from: { x: token.x, y: token.y }, fromElevationFeet: original.state.combatants[token.id]?.elevationFeet ?? 0,
        distanceFeet: destination.distanceFeet, worldMinute: input.worldMinute } } }
  }
  if (
    (payload.kind === 'other-action' || payload.kind === 'other-bonus-action') &&
    (
      (payload.description != null && typeof payload.description !== 'string') ||
      (typeof payload.description === 'string' && payload.description.length > 320)
    )
  ) {
    return { ok: false, reason: 'invalid-action' }
  }
  if ((payload.kind === 'dismiss-effect' || payload.kind === 'set-flame-blade-manifestation') &&
    !/^[a-z0-9][a-z0-9:._-]{0,255}$/i.test(payload.effectId)) {
    return { ok: false, reason: 'invalid-action' }
  }
  if (payload.kind === 'command-animate-dead' || payload.kind === 'command-animate-objects') {
    const command = typeof payload.command === 'string' ? payload.command.normalize('NFKC').trim() : ''
    if (
      !command || command.length > 320 ||
      !Array.isArray(payload.targetTokenIds) ||
      payload.targetTokenIds.length < 1 || payload.targetTokenIds.length > 18 ||
      payload.targetTokenIds.some((targetId) =>
        typeof targetId !== 'string' || !SAFE_ANIMATE_DEAD_COMMAND_TARGET_ID.test(targetId)) ||
      new Set(payload.targetTokenIds).size !== payload.targetTokenIds.length
    ) return { ok: false, reason: 'invalid-action' }
  }
  const requestedBasicActionGrantId =
    (payload.kind === 'grapple' || payload.kind === 'shove')
      ? payload.activityBasicActionGrantId
      : undefined
  const basicActionGrant = requestedBasicActionGrantId
    ? actor.dnd5eCombatState?.activityBasicActionGrants?.[requestedBasicActionGrantId]
    : undefined
  const basicActionGranted = requestedBasicActionGrantId != null &&
    dnd5eActivityBasicActionGrantMatchesV1(
      basicActionGrant,
      input.turnEconomy.turnKey ?? '',
      payload.kind as 'grapple' | 'shove',
    )
  if (requestedBasicActionGrantId != null && !basicActionGranted) {
    return { ok: false, reason: 'action-unavailable' }
  }
  const replacesAttack = (payload.kind === 'grapple' || payload.kind === 'shove') && !basicActionGranted
  const freeSelfDismissal = payload.kind === 'dismiss-effect' &&
    (payload.targetTokenId == null || payload.targetTokenId === token.id) &&
    actor.dnd5eCombatState?.activeEffects?.some(effect => effect.id === payload.effectId &&
      effect.removal?.action?.economy === 'free' && effect.removal.action.selfOnly === true &&
      effect.removal.action.maxDistanceFeet === 0 && effect.removal.action.abilityCheck == null) === true
  const freeAction = freeSelfDismissal || payload.kind === 'release-grapple' || payload.kind === 'mount' || payload.kind === 'dismount' ||
    (payload.kind === 'set-flame-blade-manifestation' && !payload.manifested)
  const spendsBonusAction = basicActionGranted ||
    payload.kind === 'other-bonus-action' || payload.kind === 'command-animate-dead' || payload.kind === 'command-animate-objects' ||
    (payload.kind === 'set-flame-blade-manifestation' && payload.manifested) ||
    (payload.kind === 'dash' && payload.sourceSpellId === 'expeditious-retreat')
  const attacksPerAction = dnd5eEffectiveAttacksPerAttackAction(actor, !input.action.combatId || input.initiativeOrder[input.action.initiativeIndex]?.tokenId === token.id)
  const ordinaryAttacksUsed = dnd5eOrdinaryAttacksUsed(actor.dnd5eCombatState?.attackActionHistory,
    input.turnEconomy.turnKey, input.turnEconomy.attacksUsed)
  if (replacesAttack && !Number.isSafeInteger(ordinaryAttacksUsed)) return { ok: false, reason: 'action-unavailable' }
  const ordinarySlot = replacesAttack ? dnd5eAttackActionSlot({ attacksPerAction,
    actionCount: Math.max(1, input.turnEconomy.action.max), attacksUsed: ordinaryAttacksUsed }) : undefined
  const distinctTargetFeature = replacesAttack && (!ordinarySlot || ordinarySlot.spendsAction) &&
    (payload.kind === 'grapple' || payload.kind === 'shove')
    ? dnd5eCharacterDistinctTargetBonusFeature(actor, input.turnEconomy.turnKey, payload.targetTokenId) : undefined
  const attackSlot = distinctTargetFeature ? { attackNumber: input.turnEconomy.attacksUsed + 1,
    attacksAllowed: input.turnEconomy.attacksUsed + 1, spendsAction: false } : ordinarySlot
  const attackNumber = attackSlot ? input.turnEconomy.attacksUsed + 1 : undefined
  const spendsAction = !freeAction && !spendsBonusAction &&
    (!replacesAttack || attackSlot?.spendsAction === true)
  const restrictedActionKind = payload.kind === 'dash' ? 'dash'
    : payload.kind === 'hide' ? 'hide'
      : payload.kind === 'use-object' ? 'use-object'
        : undefined
  const restrictedActionAvailable = restrictedActionKind != null &&
    dnd5eAvailableRestrictedExtraActionKinds({
      effects: actor.dnd5eCombatState?.activeEffects,
      usesByEffect: actor.dnd5eCombatState?.restrictedExtraActionUsesByEffect,
      turnKey: input.turnEconomy.turnKey,
    }).includes(restrictedActionKind)
  if (replacesAttack && !attackSlot) return { ok: false, reason: 'action-unavailable' }
  if (spendsAction && input.turnEconomy.action.current < 1 && !restrictedActionAvailable) {
    return { ok: false, reason: 'action-unavailable' }
  }
  if (spendsBonusAction && input.turnEconomy.bonusAction.current < 1) return { ok: false, reason: 'action-unavailable' }
  const targetTokenId = 'targetTokenId' in payload ? payload.targetTokenId : undefined
  if (payload.kind === 'dismiss-effect' && payload.targetTokenId !== undefined &&
    (typeof payload.targetTokenId !== 'string' || !payload.targetTokenId.trim())) return { ok: false, reason: 'invalid-target' }
  if (targetTokenId && !input.map.tokens.some((candidate) => candidate.id === targetTokenId)) {
    return { ok: false, reason: 'invalid-target' }
  }
  const snapshot = createDnd5eMapCombatSnapshot({
    worldMinute: input.worldMinute,
    combatId: input.action.combatId ?? `map-${input.map.id}`,
    round: input.action.round,
    turnSlotId: input.initiativeOrder[input.action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
    additionalCreatureTokenIds: input.map.tokens.filter(candidate => candidate.type !== 'obstacle').map(candidate => candidate.id),
  })
  const actorIndex = dnd5eRequestedInitiativeActorIndex(
    snapshot.state,
    token.id,
    input.action.initiativeIndex,
  )
  const combatant = snapshot.state.combatants[token.id]
  if (actorIndex < 0 || !combatant) return { ok: false, reason: 'combatant-missing' }
  if (!input.action.combatId && payload.kind === 'dismiss-effect') {
    prepareDnd5eExplorationActor(snapshot.state, token.id)
  }
  if (payload.kind === 'command-animate-dead') {
    const feetPerCell = Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
    const targets = payload.targetTokenIds.map((targetId) =>
      input.map.tokens.find((candidate) => candidate.id === targetId))
    if (targets.some((target) =>
      !target || target.dnd5eSummon?.controlEnded === true ||
      !(dnd5eAnimateDeadControlledUndead(target, actor.id) ||
        dnd5eCreateUndeadControlledUndead(target, actor.id)) ||
      tokenFootprintDistanceCells(token, target, input.map) * feetPerCell >
        (target?.dnd5eSummon?.featureId === 'spell:create-undead' ? 120 : 60)
    )) return { ok: false, reason: 'invalid-target' }
  }
  if (payload.kind === 'command-animate-objects') {
    const feetPerCell = Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
    const targets = payload.targetTokenIds.map((targetId) =>
      input.map.tokens.find((candidate) => candidate.id === targetId))
    if (targets.some((target) =>
      !target || !dnd5eAnimateObjectsControlledCreature(target, actor.id) ||
      tokenFootprintDistanceCells(token, target, input.map) * feetPerCell > 500
    )) return { ok: false, reason: 'invalid-target' }
  }
  if (payload.kind === 'dash' && payload.sourceSpellId === 'expeditious-retreat' && (
    actor.dnd5eCombatState?.concentrationSpellId !== 'expeditious-retreat' ||
    !actor.dnd5eCombatState?.activeEffects?.some((effect) =>
      effect.source.kind === 'spell' &&
      effect.source.rulesId === 'expeditious-retreat' &&
      effect.definitionId === 'srd-5.1:spell:expeditious-retreat' &&
      effect.duration.type === 'concentration'
    )
  )) return { ok: false, reason: 'invalid-action' }
  const targetCombatant = targetTokenId ? snapshot.state.combatants[targetTokenId] : undefined
  if (payload.kind === 'help' && !dnd5eBasicHelpTargetEligible(snapshot.state, token.id, payload.targetTokenId, payload.helpKind)) return { ok: false, reason: 'invalid-target' }
  if (payload.kind === 'wake' && !dnd5eBasicWakeTargetEligible(snapshot.state, token.id, payload.targetTokenId)) return { ok: false, reason: 'invalid-target' }
  if ((payload.kind === 'grapple' || payload.kind === 'shove') &&
    !dnd5eBasicAttackTargetEligible(snapshot.state, token.id, payload.targetTokenId)) return { ok: false, reason: 'invalid-target' }
  const selectedGrapple = payload.kind === 'escape-grapple' && targetCombatant
    ? dnd5eEscapableGrapples(combatant.classState.activeEffects).find((grapple) =>
        grapple.grapplerId === targetCombatant.id)
    : undefined
  const selectedGrappleEffect = selectedGrapple
    ? combatant.classState.activeEffects?.find((effect) => effect.id === selectedGrapple.effectId)
    : undefined
  if (payload.kind === 'escape-grapple' && (!targetCombatant || !selectedGrappleEffect)) {
    return { ok: false, reason: 'invalid-target' }
  }
  const releasedGrappleEffect = payload.kind === 'release-grapple' && targetCombatant
    ? targetCombatant.classState.activeEffects?.find((effect) =>
        effect.standardCondition === 'grappled' &&
        effect.dependsOnEffectId == null &&
        effect.escapeCheck == null &&
        effect.source.kind === 'feature' &&
        effect.source.rulesId === 'basic-action:grapple' &&
        effect.source.actorId === combatant.id &&
        effect.relation?.kind === 'grapple' &&
        effect.relation.sourceActorId === combatant.id &&
        effect.relation.sourceActionId === 'basic-action:grapple' &&
        effect.relation.slotGroup === 'free-hand' &&
        effect.relation.maxDistanceFeet === 5)
    : undefined
  if (payload.kind === 'release-grapple' && (!targetCombatant || !releasedGrappleEffect)) {
    return { ok: false, reason: 'invalid-target' }
  }
  const escapeEffect = payload.kind === 'escape-effect'
    ? combatant.classState.activeEffects?.find((effect) => !effect.suspendedBy?.length &&
      (effect.escapeCheck?.economy === 'action' || effect.escapeSavingThrow?.economy === 'action'))
    : selectedGrappleEffect?.escapeCheck?.economy === 'action' || selectedGrappleEffect?.escapeSavingThrow?.economy === 'action'
      ? selectedGrappleEffect
      : undefined
  if (payload.kind === 'escape-effect' && !escapeEffect) {
    return { ok: false, reason: 'invalid-target' }
  }
  const dismissEffect = payload.kind === 'dismiss-effect'
    ? (targetTokenId ? targetCombatant : combatant)?.classState.activeEffects?.find((effect) =>
        effect.id === payload.effectId &&
        (effect.removal?.action?.economy === 'action' || effect.removal?.action?.economy === 'free') &&
        effect.removal.action.maxDistanceFeet >= 0)
    : undefined
  if (payload.kind === 'dismiss-effect' && (!dismissEffect ||
    !dnd5eActiveEffectRemovalAllowed(snapshot.state, combatant.id, targetTokenId ?? combatant.id, payload.effectId))) {
    return { ok: false, reason: 'invalid-target' }
  }
  const flameBladeEffect = payload.kind === 'set-flame-blade-manifestation'
    ? combatant.classState.activeEffects?.find((effect) =>
        effect.id === payload.effectId &&
        effect.source.kind === 'spell' &&
        effect.source.rulesId === 'flame-blade' &&
        effect.definitionId === 'srd-5.1:spell:flame-blade' &&
        effect.duration.type === 'concentration' &&
        combatant.classState.concentrationSpellId === 'flame-blade')
    : undefined
  const flameBladeSuspensions = flameBladeEffect?.suspendedBy ?? []
  const validFlameBladeTransition = payload.kind !== 'set-flame-blade-manifestation' || (
    flameBladeEffect != null && (
      payload.manifested
        ? flameBladeSuspensions.length === 1 &&
          flameBladeSuspensions[0] === DND5E_FLAME_BLADE_RELEASED_SUSPENSION
        : flameBladeSuspensions.length === 0
    )
  )
  if (!validFlameBladeTransition) return { ok: false, reason: 'invalid-target' }
  const dismissibleWardingBond = payload.kind === 'dismiss-warding-bond' &&
    Object.values(snapshot.state.combatants).some((target) =>
      target.classState.activeEffects?.some((effect) =>
        effect.definitionId === 'srd-5.1:spell:warding-bond' &&
        effect.source.actorId === combatant.id,
      ),
    )
  if (payload.kind === 'dismiss-warding-bond' && !dismissibleWardingBond) {
    return { ok: false, reason: 'invalid-target' }
  }
  const escapingGrapple = payload.kind === 'escape-grapple' && !escapeEffect
  const escapeOption = escapeEffect?.escapeCheck
    ? dnd5eBestActiveEffectEscapeOption(combatant, escapeEffect.escapeCheck, escapeEffect.standardCondition === 'grappled')
    : undefined
  const escapeAbility = escapeOption?.ability ?? escapeEffect?.escapeSavingThrow?.ability
  const escapeSkill = escapeOption?.skill
  const actorContestSkill = escapingGrapple
    ? dnd5eBestGrappleDefense(combatant, true).skill
    : escapeSkill ?? (replacesAttack ? 'athletics' : undefined)
  const targetDefense = escapingGrapple
    ? 'athletics'
    : targetCombatant && replacesAttack ? dnd5eBestGrappleDefense(targetCombatant).skill : undefined
  const pushDistanceFeet = payload.kind === 'shove'
    ? 5 + (basicActionGrant?.shovePushDistanceBonusFeet ?? 0)
    : undefined
  const pushTo = payload.kind === 'shove' && payload.outcome === 'push' && targetTokenId
    ? planDnd5eShovePushDestination(input.map, token.id, targetTokenId, pushDistanceFeet)
    : undefined
  if (payload.kind === 'shove' && payload.outcome === 'push' && !pushTo) return { ok: false, reason: 'invalid-target' }
  const dismissAbilityCheck = dismissEffect?.removal?.action?.abilityCheck
  const actorCheck = dismissAbilityCheck
    ? { ability: dismissAbilityCheck.ability, skill: dismissAbilityCheck.skill }
    : escapeOption
    ? { ability: escapeOption.ability, skill: escapeOption.skill }
    : payload.kind === 'hide'
      ? { ability: 'dex' as const, skill: 'stealth' }
      : actorContestSkill === 'acrobatics'
        ? { ability: 'dex' as const, skill: 'acrobatics' }
        : { ability: 'str' as const, skill: 'athletics' }
  const actorRollKind = escapeEffect?.escapeSavingThrow ? 'saving-throw' as const : 'ability-check' as const
  const actorRollMode = escapeEffect?.escapeSavingThrow
    ? dnd5eSavingThrowMode(combatant, escapeEffect.escapeSavingThrow.ability, {
        effectVisible: true, sourceIsSpell: escapeEffect.source.kind === 'spell', sourceIsMagical: escapeEffect.source.magical === true,
      })
    : escapeOption?.mode ?? dnd5eAbilityCheckRollMode(combatant, { ...actorCheck, grappleEscape: escapingGrapple })
  const targetRollMode = targetCombatant && targetDefense
    ? dnd5eAbilityCheckRollMode(targetCombatant, {
        ability: targetDefense === 'acrobatics' ? 'dex' : 'str',
        skill: targetDefense,
      })
    : 'normal'
  combatant.turn = {
    actionAvailable: input.turnEconomy.action.current > 0,
    bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0,
    objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
    movementRemaining: input.turnEconomy.movement.current,
  }
  return {
    ok: true,
    prepared: {
      action: input.action,
      payload,
      map: input.map,
      characters: input.characters,
      state: { ...snapshot.state, initiativeIndex: freeSelfDismissal && input.action.combatId
        ? input.action.initiativeIndex : actorIndex },
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      actor,
      actorTokenId: token.id,
      spendsAction,
      distinctTargetBonusAttackFeatureId: distinctTargetFeature?.id,
      spendsBonusAction,
      attackNumber,
      actorRollKind,
      actorRollMode,
      targetRollMode,
      actorContestSkill,
      actorCheckAbility: dismissAbilityCheck?.ability ?? escapeAbility,
      escapeEffectId: escapeEffect?.id,
      dismissEffectId: dismissEffect?.id,
      targetDefense,
      pushTo,
      pushDistanceFeet,
      activityBasicActionGrantId: requestedBasicActionGrantId,
    },
  }
}

export type PreparedDnd5eBasicActionResolution = Omit<PreparedDnd5eBasicAction, 'actor' | 'action'>

/** Host-only stage: resolve teleport and landing before requesting either contest die. */
export function resolvePreparedDnd5eBasicActionLanding(input: {
  prepared: PreparedDnd5eBasicActionResolution
  arrival?: Dnd5eAttackTeleportArrival
  airborneFallDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
}): {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  airborneFalls?: readonly Dnd5eUnsupportedAirborneFallPreview[]
  remainingRolls?: Readonly<Record<string, readonly number[]>>
  preparedAfterLanding?: PreparedDnd5eBasicActionResolution
} {
  const { prepared } = input
  const payload = prepared.payload
  const teleport = prepared.attackActionTeleport
  if (teleport) {
    const actor = prepared.state.combatants[prepared.actorTokenId]
    const character = prepared.characters.find(candidate => candidate.id === prepared.characterIdByCombatantId[prepared.actorTokenId])
    const feature = character && dnd5ePluginFeaturesAvailableForCharacter(character).find(candidate =>
      candidate.id === teleport.featureId && candidate.automation === 'full' &&
      dnd5eCharacterHasPluginFeature(character, candidate.id))
    const mechanic = feature?.declarativeAbility?.mechanic
    const request = (payload.kind === 'grapple' || payload.kind === 'shove') && payload.attackActionTeleport
    const destination = request && mechanic?.kind === 'attack-action-teleport' &&
      prepareDnd5eAttackTeleportDestination({ map: prepared.map, actorTokenId: prepared.actorTokenId,
        characters: prepared.characters, targetCell: request.targetCell,
        targetElevationFeet: request.elevationFeet, rangeFeet: mechanic.rangeFeet, worldMinute: teleport.worldMinute })
    if (!actor?.pluginFeatureIds.includes(teleport.featureId) || !prepared.state.active ||
      prepared.state.initiativeOrder[prepared.state.initiativeIndex] !== actor.id ||
      prepared.spendsBonusAction || prepared.activityBasicActionGrantId ||
      !destination || !destination.ok || destination.to.x !== actor.position.x ||
      destination.to.y !== actor.position.y || destination.elevationFeet !== (actor.elevationFeet ?? 0)) {
      return { result: { ok: false, reason: 'invalid-target', state: structuredClone(teleport.originalState), events: [] } }
    }
    const landing = resolveDnd5eAttackTeleportLanding({ includeSupportedDestination: true, arrival: input.arrival, teleport, state: prepared.state,
      actorId: prepared.actorTokenId, map: prepared.map, characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId, rolls: input.airborneFallDamageRollsByCombatantId })
    if (landing) {
      if (!landing.ok) return { result: landing.result, airborneFalls: landing.falls }
      const request = teleport.preparationInput
      const originalPayload = request.action.dnd5eBasicAction
      if (!originalPayload || (originalPayload.kind !== 'grapple' && originalPayload.kind !== 'shove'))
        return { result: { ok: false, reason: 'invalid-class-feature', state: structuredClone(teleport.originalState), events: [] } }
      const resumed = prepareDnd5ePlayerBasicAction({ ...request, map: landing.plan.map, characters: landing.plan.characters,
        action: { ...request.action, dnd5eBasicAction: { ...originalPayload, attackActionTeleport: undefined } } })
      if (!resumed.ok || attackTeleportArrivalConsumedAction(input.arrival, prepared.actorTokenId)) {
        if (prepared.spendsAction) {
          landing.state.combatants[prepared.actorTokenId].turn.actionAvailable = false
          landing.events.push({ type: 'turn-resource-spent', actorId: prepared.actorTokenId, resource: 'action' })
        }
        return { result: { ok: true, state: landing.state, events: landing.events },
          application: planDnd5eMapResultApplication({ state: landing.state,
            map: { ...prepared.map, dnd5ePluginAreas: landing.plan.map.dnd5ePluginAreas },
            characters: landing.plan.characters, baselineCharacters: prepared.characters,
            characterIdByCombatantId: { ...prepared.characterIdByCombatantId }, events: landing.events }) }
      }
      return { result: { ok: true, state: landing.state, events: landing.events },
        remainingRolls: landing.remainingRolls,
        preparedAfterLanding: { ...resumed.prepared, attackTeleportPrelude: {
          originalState: teleport.originalState, map: prepared.map, characters: prepared.characters,
          events: landing.events,
        } } }

    }
  }
  return { result: { ok: true, state: prepared.state, events: [] }, preparedAfterLanding: prepared }
}

export function resolvePreparedDnd5ePlayerBasicAction(input: {
  optionalBonusDice?: Dnd5eAction['optionalBonusDice']
  actorDisadvantageNegationChoice?: Dnd5eActiveEffectSavingThrowRoll['disadvantageNegationChoice']
  targetDisadvantageNegationChoice?: Dnd5eActiveEffectSavingThrowRoll['disadvantageNegationChoice']
  prepared: PreparedDnd5eBasicActionResolution
  /** Supplied only after Host confirmation, never read from the shared player payload. */
  mountApprovedByHost?: boolean
  actorD20?: number
  actorD20Second?: number
  actorHalflingLuckyD20?: number
  actorHalflingLuckyD20Second?: number
  targetD20?: number
  targetD20Second?: number
  targetHalflingLuckyD20?: number
  targetHalflingLuckyD20Second?: number
  pushToElevationFeet?: number
  pushToGroundElevationFeet?: number
  fallingDamageRolls?: readonly number[]
  escapeEjectionRolls?: Readonly<Record<string,Dnd5eEscapeEjectionRolls>>
  airborneFallDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
}): {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  escapeEjections?: Dnd5eEscapeEjectionRequest[]
  airborneFalls?: readonly Dnd5eUnsupportedAirborneFallPreview[]
} {
  const { prepared, actorD20 = 0, actorD20Second, targetD20 = 0, targetD20Second } = input
  const payload = prepared.payload
  const prelude = prepared.attackTeleportPrelude
  if (prelude) {
    const continuation = resolvePreparedDnd5ePlayerBasicAction({ ...input,
      prepared: { ...prepared, attackTeleportPrelude: undefined } })
    if (!continuation.result.ok) return { ...continuation,
      result: { ...continuation.result, state: structuredClone(prelude.originalState), events: [] } }
    const events = [...prelude.events, ...continuation.result.events]
    return { ...continuation, result: { ...continuation.result, events },
      application: planDnd5eMapResultApplication({ state: continuation.result.state,
        map: { ...prelude.map, dnd5ePluginAreas: (continuation.application?.map ?? prepared.map).dnd5ePluginAreas },
        characters: continuation.application?.characters ?? prepared.characters, baselineCharacters: prelude.characters,
        characterIdByCombatantId: { ...prepared.characterIdByCombatantId }, events }) }
  }
  const teleport = prepared.attackActionTeleport
  if (teleport) {
    const landing = resolvePreparedDnd5eBasicActionLanding(input)
    if (!landing.preparedAfterLanding) return landing
    if (landing.preparedAfterLanding !== prepared) return resolvePreparedDnd5ePlayerBasicAction({ ...input,
      prepared: landing.preparedAfterLanding, airborneFallDamageRollsByCombatantId: landing.remainingRolls })
  }
  const dismountTo = payload.kind === 'dismount'
    ? planDnd5eDismountPlacement(prepared.map, prepared.actorTokenId, payload.targetTokenId, payload.direction)
    : undefined
  if (payload.kind === 'dismount' && !dismountTo) return {
    result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
  }
  let action: Dnd5eAction
  switch (payload.kind) {
    case 'mount': action = { type: 'mount-creature', actorId: prepared.actorTokenId,
      targetId: payload.targetTokenId, hostApproved: input.mountApprovedByHost === true }; break
    case 'dismount': action = { type: 'dismount-creature', actorId: prepared.actorTokenId,
      targetId: payload.targetTokenId, to: dismountTo,
      groundElevationFeet: mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(prepared.map.id), dismountTo!) }; break
    case 'dash': action = {
      type: 'dash', actorId: prepared.actorTokenId, sourceSpellId: payload.sourceSpellId,
    }; break
    case 'hide': action = {
      type: 'hide',
      disadvantageNegationChoice: input.actorDisadvantageNegationChoice,
      actorId: prepared.actorTokenId,
      d20: actorD20,
      d20Second: actorD20Second,
      halflingLuckyD20: input.actorHalflingLuckyD20,
      halflingLuckyD20Second: input.actorHalflingLuckyD20Second,
    }; break
    case 'help': action = { type: 'help', actorId: prepared.actorTokenId, targetId: payload.targetTokenId, helpKind: payload.helpKind }; break
    case 'ready': action = { type: 'ready', actorId: prepared.actorTokenId, trigger: payload.trigger, actionKind: payload.actionKind, targetId: payload.targetTokenId }; break
    case 'use-object': action = { type: 'use-object', actorId: prepared.actorTokenId, interactionId: payload.interactionId }; break
    case 'grapple': action = {
      distinctTargetBonusAttackFeatureId: prepared.distinctTargetBonusAttackFeatureId,
      type: 'grapple', actorId: prepared.actorTokenId, targetId: payload.targetTokenId,
      actorDisadvantageNegationChoice: input.actorDisadvantageNegationChoice,
          targetDisadvantageNegationChoice: input.targetDisadvantageNegationChoice,
          actorD20, actorD20Second, targetD20, targetD20Second,
      actorHalflingLuckyD20: input.actorHalflingLuckyD20,
      actorHalflingLuckyD20Second: input.actorHalflingLuckyD20Second,
      targetHalflingLuckyD20: input.targetHalflingLuckyD20,
      targetHalflingLuckyD20Second: input.targetHalflingLuckyD20Second,
      targetDefense: prepared.targetDefense ?? payload.targetDefense,
      spendAction: prepared.spendsAction,
      spendBonusAction: prepared.spendsBonusAction,
      activityBasicActionGrantId: prepared.activityBasicActionGrantId,
    }; break
    case 'shove': action = {
      distinctTargetBonusAttackFeatureId: prepared.distinctTargetBonusAttackFeatureId,
      type: 'shove', actorId: prepared.actorTokenId, targetId: payload.targetTokenId,
      actorDisadvantageNegationChoice: input.actorDisadvantageNegationChoice,
          targetDisadvantageNegationChoice: input.targetDisadvantageNegationChoice,
          actorD20, actorD20Second, targetD20, targetD20Second,
      actorHalflingLuckyD20: input.actorHalflingLuckyD20,
      actorHalflingLuckyD20Second: input.actorHalflingLuckyD20Second,
      targetHalflingLuckyD20: input.targetHalflingLuckyD20,
      targetHalflingLuckyD20Second: input.targetHalflingLuckyD20Second,
      targetDefense: prepared.targetDefense ?? payload.targetDefense, outcome: payload.outcome,
      pushTo: prepared.pushTo,
      pushDistanceFeet: prepared.pushDistanceFeet,
      pushToElevationFeet: input.pushToElevationFeet,
      pushToGroundElevationFeet: input.pushToGroundElevationFeet,
      fallingDamageRolls: input.fallingDamageRolls,
      spendAction: prepared.spendsAction,
      spendBonusAction: prepared.spendsBonusAction,
      activityBasicActionGrantId: prepared.activityBasicActionGrantId,
    }; break
    case 'release-grapple': action = {
      type: 'release-grapple',
      actorId: prepared.actorTokenId,
      targetId: payload.targetTokenId,
    }; break
    case 'escape-grapple': action = prepared.escapeEffectId
      ? {
          type: 'escape-active-effect',
          disadvantageNegationChoice: input.actorDisadvantageNegationChoice,
          actorId: prepared.actorTokenId,
          effectId: prepared.escapeEffectId,
          d20: actorD20,
          d20Second: actorD20Second,
          halflingLuckyD20: input.actorHalflingLuckyD20,
          halflingLuckyD20Second: input.actorHalflingLuckyD20Second,
        }
      : {
          type: 'escape-grapple',
          actorId: prepared.actorTokenId,
          grapplerId: payload.targetTokenId,
          actorDisadvantageNegationChoice: input.actorDisadvantageNegationChoice,
          targetDisadvantageNegationChoice: input.targetDisadvantageNegationChoice,
          actorD20,
          actorD20Second,
          actorHalflingLuckyD20: input.actorHalflingLuckyD20,
          actorHalflingLuckyD20Second: input.actorHalflingLuckyD20Second,
          targetD20,
          targetD20Second,
          targetHalflingLuckyD20: input.targetHalflingLuckyD20,
          targetHalflingLuckyD20Second: input.targetHalflingLuckyD20Second,
        }; break
    case 'escape-effect': action = {
      type: 'escape-active-effect',
          disadvantageNegationChoice: input.actorDisadvantageNegationChoice,
      actorId: prepared.actorTokenId,
      effectId: prepared.escapeEffectId ?? '',
      d20: actorD20,
      d20Second: actorD20Second,
      halflingLuckyD20: input.actorHalflingLuckyD20,
      halflingLuckyD20Second: input.actorHalflingLuckyD20Second,
    }; break
    case 'dismiss-effect': action = {
      type: 'remove-active-effect',
      disadvantageNegationChoice: input.actorDisadvantageNegationChoice,
      actorId: prepared.actorTokenId,
      targetId: payload.targetTokenId ?? prepared.actorTokenId,
      effectId: prepared.dismissEffectId ?? '',
      d20: prepared.actorCheckAbility ? actorD20 : undefined,
      d20Second: prepared.actorCheckAbility ? actorD20Second : undefined,
      halflingLuckyD20: prepared.actorCheckAbility ? input.actorHalflingLuckyD20 : undefined,
      halflingLuckyD20Second: prepared.actorCheckAbility ? input.actorHalflingLuckyD20Second : undefined,
    }; break
    case 'set-flame-blade-manifestation': action = {
      type: 'set-flame-blade-manifestation',
      actorId: prepared.actorTokenId,
      effectId: payload.effectId,
      manifested: payload.manifested,
    }; break
    case 'dismiss-warding-bond': action = {
      type: 'dismiss-warding-bond',
      actorId: prepared.actorTokenId,
    }; break
    case 'wake': action = {
      type: 'wake-sleeping-creature', actorId: prepared.actorTokenId, targetId: payload.targetTokenId,
    }; break
    case 'command-animate-dead': {
      const targetNames = payload.targetTokenIds.map((targetId) =>
        prepared.map.tokens.find((token) => token.id === targetId)?.label ?? targetId)
      const command = payload.command.normalize('NFKC').trim()
      const heading = `向 ${targetNames.length} 个受控亡灵（${targetNames.join('、')}）下达同一心灵命令：`
      action = {
        type: 'adjudicate-basic-action',
        actorId: prepared.actorTokenId,
        economy: 'bonusAction',
        description: `${heading}${command}`.slice(0, 320),
      }
      break
    }
    case 'command-animate-objects': {
      const targetNames = payload.targetTokenIds.map((targetId) =>
        prepared.map.tokens.find((token) => token.id === targetId)?.label ?? targetId)
      const command = payload.command.normalize('NFKC').trim()
      const heading = `向 ${targetNames.length} 个活化物件（${targetNames.join('、')}）下达同一心灵命令：`
      action = {
        type: 'adjudicate-basic-action',
        actorId: prepared.actorTokenId,
        economy: 'bonusAction',
        description: `${heading}${command}`.slice(0, 320),
      }
      break
    }
    case 'other-action':
    case 'other-bonus-action': action = {
      type: 'adjudicate-basic-action',
      economyOnly: payload.economyOnly,
      actorId: prepared.actorTokenId,
      economy: payload.kind === 'other-bonus-action' ? 'bonusAction' : 'action',
      description: payload.description?.trim() ||
        (payload.kind === 'other-bonus-action' ? '玩家声明一个其他附赠动作。' : '玩家声明一个其他动作。'),
    }; break
  }
  action = {
    ...action,
    optionalBonusDice: input.optionalBonusDice,
    airborneFallDamageRollsByCombatantId: input.airborneFallDamageRollsByCombatantId,
  }
  const resolution = resolveDnd5eActionWithEscapeEjection({before:prepared.state,action,map:prepared.map,
    characters:prepared.characters,characterIdByCombatantId:prepared.characterIdByCombatantId,rolls:input.escapeEjectionRolls})
  const {result}=resolution
  if (!result.ok) return teleport
    ? { ...resolution, result: { ...result, state: structuredClone(teleport.originalState), events: [] } }
    : resolution
  if (teleport) {
    const destination = prepared.state.combatants[prepared.actorTokenId]
    result.events = [{ type: 'teleported', actorId: prepared.actorTokenId, spellId: teleport.featureId,
      from: { ...teleport.from }, to: { ...destination.position }, distanceFeet: teleport.distanceFeet,
      fromElevationFeet: teleport.fromElevationFeet, toElevationFeet: destination.elevationFeet ?? 0 }, ...result.events]
  }
  const application = planDnd5eMapResultApplication({
    state: result.state,
    map: prepared.map,
    characters: prepared.characters,
    characterIdByCombatantId: prepared.characterIdByCombatantId,
    events: [...result.events],
  })
  const sourceCharacterId = prepared.characterIdByCombatantId[prepared.actorTokenId]
  const session = prepared.characters.find(character => character.id === sourceCharacterId)?.dnd5eDreamContact
  if (session && result.events.some(event => event.type === 'active-effect-manually-removed' &&
    event.success && event.actorId === prepared.actorTokenId && event.targetId === prepared.actorTokenId &&
    event.effectId === `dream-trance:${session.id}`)) {
    // Publish session completion with effect removal, without waiting for a
    // later clock reconciliation to observe the missing trance.
    application.characters = application.characters.map(character => {
      if (character.id !== sourceCharacterId) return character
      const ended = endDnd5eDreamContact(character, 'voluntary')
      application.characterPatches = { ...application.characterPatches,
        [character.id]: { ...application.characterPatches?.[character.id], dnd5eDreamContact: ended.dnd5eDreamContact } }
      return ended
    })
  }
  return {
    ...resolution,
    application,
  }
}


