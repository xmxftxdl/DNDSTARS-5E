import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { mapGeometryRuntimeForMap, mapGeometryTokenElevation } from '../../lib/mapGeometry'
import { areOpposedCombatTokens, dnd5eCombatTokenSide } from '../../lib/opportunityAttacks'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { resolveDnd5eAttackOutcome } from './attackResolution'
import {
  dnd5eBlurImposesAttackDisadvantage,
  dnd5eAttackerIsUnseenForAttack,
  dnd5eTargetArmorClassForAttack,
  dnd5eTargetIsUnseenForAttack,
  dnd5eCombatantHasConcentrationEffect,
  dnd5eEffectiveSizeRank,
  dnd5eFrightenedAttackDisadvantage,
  dnd5eHelpAttackApplies,
  dnd5eTotemBearGuardianDisadvantage,
  dnd5eTotemWolfPackAdvantage,
  dnd5eMonsterTargetEligibilityAllows,
  dnd5eTranquilityWardCheck,
  reconcileDnd5eSourceLinkedRelations,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterActionRoll,
  type Dnd5eMonsterMechanicRoll,
  type Dnd5eMonsterMultiattackStepResolutionV1,
} from './headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  dnd5eMapTokenCanThreatenRangedAttacker,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import {
  getDnd5eSrdMonster,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterWeaponAttack,
} from './monsters'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import {
  dnd5eMonsterMultiattackConstraint,
  dnd5eMonsterMultiattackSupportsSingleTarget,
} from './monsterMultiattackConstraints'
import { dnd5eMonsterMultiattackRuntimeActionIds } from './monsterDynamicMultiattack'
import {
  dnd5eAllocateMonsterMultiattackTargets,
  type Dnd5eMonsterMultiattackTargetOccurrence,
} from './monsterMultiattackTargets'
import { dnd5eMonsterMultiattackChildResourcesAvailable } from './monsterMultiattackResources'
import {
  dnd5eMonsterCompositeChildResourceAvailable,
  dnd5eMonsterActionNeedsCompositeRuntime,
  prepareDnd5eMonsterCompositeRuntimePlan,
  type Dnd5eMonsterCompositeRuntimePlan,
} from './monsterCompositeRuntime'
import { dnd5eEligibleMonsterMechanics, dnd5eMonsterMechanicDiceRequirements } from './monsterAutomation'
import {
  dnd5eMonsterAssassinateAutomaticCritical,
  dnd5eMonsterAttackTraitAdvantage,
  dnd5eMonsterEffectiveWeaponAttack,
  dnd5eMonsterPackTacticsApplies,
  dnd5eMonsterTraitDamageDefinitions,
  dnd5eMonsterWeaponAttackWithTriggeredTraits,
  dnd5eMonsterWeaponAttackAtDistance,
  dnd5eMonsterWeaponAttackAgainstConditions,
  type Dnd5eMonsterAttackTraitContext,
  type Dnd5eMonsterTraitDamageDefinition,
} from './monsterGenericAbilities'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5eIsIncapacitated, dnd5ePreventsAttackAdvantage, dnd5eTargetGrantsAttackAdvantage, dnd5eTargetIsDodging } from './passiveDefenses'
import { imposeDnd5eRollDisadvantage, resolveDnd5eRollMode } from './rollMode'
import { dnd5eActiveWeaponDamageD4Mode } from './activeEffects'
import {
  dnd5eMonsterWeaponIdForUnderwater,
  dnd5eUnderwaterWeaponAttack,
} from './environmentRules'

export type Dnd5eMonsterAttackRejectReason =
  | 'invalid-actor'
  | 'invalid-target'
  | 'invalid-stat-block'
  | 'invalid-action'
  | 'target-out-of-range'
  | 'combatant-missing'

export interface PreparedDnd5eMonsterAttack {
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actorToken: Token
  targetToken: Token
  monster: Dnd5eMonsterStatBlock
  action: Dnd5eMonsterAction
  attacks: readonly {
    id: string
    name: string
    attack: Dnd5eMonsterWeaponAttack
    sequenceIndex: number
    targetToken: Token
    targetArmorClass: number
    distanceFeet: number
    targetAttackMode: 'normal' | 'advantage' | 'disadvantage'
    packTactics: boolean
    tranquilityWard?: ReturnType<typeof dnd5eTranquilityWardCheck>
    monsterAttackTraitContext: Dnd5eMonsterAttackTraitContext
  }[]
  targetOccurrences: readonly Dnd5eMonsterMultiattackTargetOccurrence[]
  compositeRuntime?: Dnd5eMonsterCompositeRuntimePlan
  targetArmorClass: number
  distanceFeet: number
  targetAttackMode: 'normal' | 'advantage' | 'disadvantage'
  attackModes: readonly ('normal' | 'advantage' | 'disadvantage')[]
  packTactics: boolean
  viciousMockeryAttackDisadvantage: boolean
  tranquilityWard?: ReturnType<typeof dnd5eTranquilityWardCheck>
  blessed: boolean
  baned: boolean
  sizeDamageD4Mode?: 'add' | 'subtract'
  /** Submitted count die for a variable-length Multiattack. */
  randomRepeatRoll?: number
  monsterAttackTraitContext: Dnd5eMonsterAttackTraitContext
}

function monsterAttackAllowsDistance(
  attack: Dnd5eMonsterWeaponAttack,
  distanceFeet: number,
): boolean {
  if (attack.mode === 'melee') return distanceFeet <= (attack.reachFeet ?? 5)
  if (attack.mode === 'ranged') {
    return distanceFeet <= (attack.rangeFeet?.long ?? attack.rangeFeet?.normal ?? 0)
  }
  return distanceFeet <= Math.max(
    attack.reachFeet ?? 5,
    attack.rangeFeet?.long ?? attack.rangeFeet?.normal ?? 0,
  )
}

function sourceLinkedRelationTargetIds(
  state: Dnd5eHeadlessCombatState,
  sourceActorId: string,
  slotGroup: string,
): string[] {
  return Object.values(state.combatants).flatMap((target) =>
    target.classState.activeEffects?.some((effect) =>
      effect.relation != null &&
      effect.dependsOnEffectId == null &&
      effect.relation.sourceActorId === sourceActorId &&
      effect.relation.slotGroup === slotGroup &&
      effect.source.actorId === sourceActorId)
      ? [target.id]
      : [])
}

function monsterMultiattackResourcesAvailableForPreparation(input: {
  monster: Dnd5eMonsterStatBlock
  action: Dnd5eMonsterAction
  rechargeReadyByActionId?: Readonly<Record<string, boolean>>
  usesByActionId?: Readonly<Record<string, { current: number; max: number }>>
}): boolean {
  const resources = {
    rechargeReadyByActionId: input.rechargeReadyByActionId,
    usesByActionId: input.usesByActionId,
  }
  const composite = prepareDnd5eMonsterCompositeRuntimePlan(
    input.monster,
    input.action,
  )
  if (!composite) {
    return dnd5eMonsterMultiattackChildResourcesAvailable(
      input.monster,
      input.action,
      resources,
    )
  }
  return composite.children.every((child) =>
    child.skipPolicy === 'when-resource-unavailable' ||
    dnd5eMonsterCompositeChildResourceAvailable(child, resources))
}

export function prepareDnd5eMonsterAttack(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  targetTokenId: string
  /** Exact target for each concrete runtime occurrence; one entry is legacy. */
  targetTokenIds?: readonly string[]
  actionIndex?: number
  multiattackContinuation?: {
    schemaVersion: 1
    parentActionId: string
    occurrenceIndex: number
  }
  turnEconomy?: Dnd5eTurnEconomyCounts
  targetTurnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
  randomRepeatRoll?: number
}): { ok: true; prepared: PreparedDnd5eMonsterAttack } | { ok: false; reason: Dnd5eMonsterAttackRejectReason } {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId && token.type !== 'obstacle')
  const actorCharacter = actorToken?.characterId
    ? input.characters.find((character) => character.id === actorToken.characterId)
    : undefined
  const statBlockId = actorToken?.type === 'enemy'
    ? actorToken.poolId
    : actorCharacter?.dnd5eCombatState?.wildShapeFormId
  if (!actorToken || !statBlockId) return { ok: false, reason: 'invalid-actor' }
  const targetToken = input.map.tokens.find((token) => token.id === input.targetTokenId && token.id !== actorToken.id && token.type !== 'obstacle')
  if (!targetToken || !areOpposedCombatTokens(actorToken, targetToken)) return { ok: false, reason: 'invalid-target' }
  const monster = getDnd5eSrdMonster(statBlockId)
  if (!monster) return { ok: false, reason: 'invalid-stat-block' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const target = snapshot.state.combatants[targetToken.id]
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant || !target) {
    return { ok: false, reason: 'combatant-missing' }
  }
  snapshot.state.initiativeIndex = actorIndex
  reconcileDnd5eSourceLinkedRelations(snapshot.state)

  const indexedAction = monster.actions[input.actionIndex ?? 0]
    ?? monster.actions.find((action) => action.kind === 'weapon-attack')
  if (!indexedAction) return { ok: false, reason: 'invalid-action' }
  if (input.multiattackContinuation) {
    const receipt =
      actorCombatant.classState.monsterMultiattackContinuation
    const turnSlotId =
      snapshot.state.initiativeSlotIds?.[actorIndex] ??
      snapshot.state.turnSlotId ??
      actorCombatant.id
    if (
      !receipt ||
      receipt.schemaVersion !== 1 ||
      receipt.combatId !== snapshot.state.combatId ||
      receipt.round !== snapshot.state.round ||
      receipt.turnKey !==
        `${snapshot.state.combatId}:${snapshot.state.round}:${turnSlotId}` ||
      receipt.parentActionId !== input.multiattackContinuation.parentActionId ||
      receipt.nextOccurrenceIndex !==
        input.multiattackContinuation.occurrenceIndex ||
      receipt.sequenceActionIds[receipt.nextOccurrenceIndex] !==
        indexedAction.id
    ) return { ok: false, reason: 'invalid-action' }
  }
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const distanceFeet = Math.max(
    tokenFootprintDistanceCells(actorToken, targetToken, input.map) *
      Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL),
    Math.abs(
      mapGeometryTokenElevation(geometry, actorToken) -
        mapGeometryTokenElevation(geometry, targetToken),
    ),
  )
  const multiattack = !input.multiattackContinuation &&
    indexedAction.kind === 'weapon-attack'
    ? monster.actions.find((action) => {
        if (
          action.kind !== 'multiattack' ||
          !(
            action.sequence?.includes(indexedAction.id) ||
            action.randomRepeat?.actionId === indexedAction.id
          ) ||
          dnd5eMonsterActionAutomation(action) !== 'headless' ||
          (
            !dnd5eMonsterMultiattackSupportsSingleTarget(monster.id, action.id) &&
            (input.targetTokenIds?.length ?? 1) < 2
          ) ||
          (
            dnd5eMonsterMultiattackConstraint(monster.id, action.id)
              ?.requiresActorAirborne === true &&
            actorCombatant.airborne !== true
          ) ||
          !monsterMultiattackResourcesAvailableForPreparation({
            monster,
            action,
            rechargeReadyByActionId:
              actorCombatant.classState.monsterRechargeReadyByActionId,
            usesByActionId:
              actorCombatant.classState.monsterActionUsesByActionId,
          })
        ) return false
        const sequence = dnd5eMonsterMultiattackRuntimeActionIds({
          monster,
          action,
          actor: actorCombatant,
          randomRepeatCount: input.randomRepeatRoll,
          unresolvedRandomRepeat: 'minimum',
        }) ?? []
        const runtimePlan = prepareDnd5eMonsterCompositeRuntimePlan(monster, action)
        return sequence.every((actionId) => {
          const definition = monster.actions.find((candidate) => candidate.id === actionId)
          if (!definition || dnd5eMonsterActionAutomation(definition) !== 'headless') {
            return false
          }
          if (!definition.attack) {
            return runtimePlan?.children.some((child) =>
              child.action.id === definition.id) === true
          }
          const effectiveAttack = dnd5eMonsterEffectiveWeaponAttack(
            definition.attack,
            Math.max(0, actorToken.hp ?? monster.hitPoints.average),
            Math.max(1, actorToken.maxHp ?? monster.hitPoints.average),
          )
          if (
            effectiveAttack.targetMaxSizeRank != null &&
            dnd5eEffectiveSizeRank(target) > effectiveAttack.targetMaxSizeRank
          ) return false
          return monsterAttackAllowsDistance(
            dnd5eMonsterWeaponAttackAtDistance(
              effectiveAttack,
              distanceFeet,
              action.sequenceAttackMode,
            ),
            distanceFeet,
          )
        })
      })
    : undefined
  const action = multiattack ?? indexedAction
  if (dnd5eMonsterActionAutomation(action) !== 'headless') return { ok: false, reason: 'invalid-action' }
  if (
    input.randomRepeatRoll != null &&
    (
      action.kind !== 'multiattack' ||
      !action.randomRepeat ||
      !Number.isInteger(input.randomRepeatRoll) ||
      input.randomRepeatRoll < action.randomRepeat.minimum ||
      input.randomRepeatRoll > action.randomRepeat.maximum ||
      input.randomRepeatRoll > action.randomRepeat.dieSides
    )
  ) return { ok: false, reason: 'invalid-action' }
  if (
    (
      !dnd5eMonsterMultiattackSupportsSingleTarget(monster.id, action.id) &&
      (input.targetTokenIds?.length ?? 1) < 2
    ) ||
    (
      dnd5eMonsterMultiattackConstraint(monster.id, action.id)
        ?.requiresActorAirborne === true &&
      actorCombatant.airborne !== true
    )
  ) return { ok: false, reason: 'invalid-action' }
  if (
    !monsterMultiattackResourcesAvailableForPreparation({
      monster,
      action,
      rechargeReadyByActionId:
        actorCombatant.classState.monsterRechargeReadyByActionId,
      usesByActionId:
        actorCombatant.classState.monsterActionUsesByActionId,
    })
  ) return { ok: false, reason: 'invalid-action' }
  const attackIds = action.kind === 'multiattack'
    ? dnd5eMonsterMultiattackRuntimeActionIds({
        monster,
        action,
        actor: actorCombatant,
        randomRepeatCount: input.randomRepeatRoll,
        unresolvedRandomRepeat: 'minimum',
      }) ?? []
    : [action.id]
  const compositeRuntime = dnd5eMonsterActionNeedsCompositeRuntime(monster, action)
    ? prepareDnd5eMonsterCompositeRuntimePlan(monster, action)
    : undefined
  const multiattackConstraint = action.kind === 'multiattack'
    ? dnd5eMonsterMultiattackConstraint(monster.id, action.id)
    : undefined
  for (
    const requirement of
    multiattackConstraint?.requiredSourceLinkedRelationsAtStart ?? []
  ) {
    const eligibleLinkedTargets = sourceLinkedRelationTargetIds(
      snapshot.state,
      actorToken.id,
      requirement.slotGroup,
    ).filter((targetId) => {
      const linkedTarget = snapshot.state.combatants[targetId]
      return !!linkedTarget &&
        linkedTarget.currentHp > 0 &&
        !linkedTarget.deathSaves.dead &&
        (
          requirement.targetMaxSizeRank == null ||
          dnd5eEffectiveSizeRank(linkedTarget) <=
            requirement.targetMaxSizeRank
        )
    })
    if (new Set(eligibleLinkedTargets).size < requirement.count) {
      return { ok: false, reason: 'invalid-action' }
    }
  }
  const submittedTargetIds = input.targetTokenIds?.length
    ? input.targetTokenIds
    : [targetToken.id]
  // The tactical planner allocates the maximum possible occurrence count for
  // a random-repeat action before the authoritative repeat die is rolled.
  // Once the roll is known, retain the stable prefix that corresponds to the
  // concrete runtime sequence instead of rejecting the otherwise valid plan
  // because it contains targets for occurrences that did not materialize.
  const requestedTargetIds =
    action.kind === 'multiattack' &&
    action.randomRepeat &&
    submittedTargetIds.length > attackIds.length
      ? submittedTargetIds.slice(0, attackIds.length)
      : submittedTargetIds
  const requestedTargetTokens = [...new Set(requestedTargetIds)].flatMap(
    (targetId) => {
      const candidate = input.map.tokens.find((token) =>
        token.id === targetId &&
        token.id !== actorToken.id &&
        token.type !== 'obstacle' &&
        areOpposedCombatTokens(actorToken, token))
      return candidate ? [candidate] : []
    },
  )
  if (requestedTargetTokens.length !== new Set(requestedTargetIds).size) {
    return { ok: false, reason: 'invalid-target' }
  }
  const targetOccurrences = action.kind === 'multiattack'
    ? dnd5eAllocateMonsterMultiattackTargets({
        monsterId: monster.id,
        actionId: action.id,
        actionIds: attackIds,
        candidates: requestedTargetTokens,
        preferredTargetId: targetToken.id,
        requestedTargetIds,
        canTarget: ({ sequenceIndex, actionId, targetId, assigned }) => {
          const child = monster.actions.find((candidate) =>
            candidate.id === actionId)
          if (
            child?.targetEligibility != null &&
            !dnd5eMonsterTargetEligibilityAllows(
              snapshot.state,
              actorToken.id,
              targetId,
              child,
            ) &&
            dnd5eMonsterMultiattackConstraint(monster.id, action.id)
              ?.occurrences?.find((occurrence) =>
                occurrence.occurrenceIndex === sequenceIndex)
              ?.skipWhenTargetEligibilityUnavailable !== true
          ) return false
          if (
            child?.relationRequirement?.kind !==
            'target-linked-to-source'
          ) return true
          const slotGroup = child.relationRequirement.slotGroup
          if (
            sourceLinkedRelationTargetIds(
              snapshot.state,
              actorToken.id,
              slotGroup,
            ).includes(targetId)
          ) return true
          return assigned.some((occurrence) => {
            if (occurrence.targetId !== targetId) return false
            const prior = monster.actions.find((candidate) =>
              candidate.id === occurrence.actionId)
            return prior?.attack?.onHitEffects?.some((effect) =>
              effect.kind === 'source-linked-condition' &&
              effect.relation.slotGroup === slotGroup) === true
          })
        },
      })
    : requestedTargetIds.length === 1 &&
        dnd5eMonsterTargetEligibilityAllows(
          snapshot.state,
          actorToken.id,
          targetToken.id,
          action,
        )
      ? [{ sequenceIndex: 0, actionId: action.id, targetId: targetToken.id }]
      : undefined
  if (!targetOccurrences) return { ok: false, reason: 'invalid-target' }
  let attacks = attackIds.flatMap((actionId, sequenceIndex) => {
    const definition = monster.actions.find((candidate) => candidate.id === actionId)
    const occurrenceTargetId = targetOccurrences[sequenceIndex]?.targetId
    const occurrenceTarget = requestedTargetTokens.find((candidate) =>
      candidate.id === occurrenceTargetId)
    const occurrenceDistanceFeet = occurrenceTarget
      ? Math.max(
          tokenFootprintDistanceCells(
            actorToken,
            occurrenceTarget,
            input.map,
          ) * Math.max(
            1,
            input.map.feetPerCell ?? DND_FEET_PER_CELL,
          ),
          Math.abs(
            mapGeometryTokenElevation(geometry, actorToken) -
              mapGeometryTokenElevation(geometry, occurrenceTarget),
          ),
        )
      : 0
    return definition?.attack && dnd5eMonsterActionAutomation(definition) === 'headless'
      && occurrenceTarget
      ? [{
          id: definition.id,
          name: definition.name,
          sequenceIndex,
          targetToken: occurrenceTarget,
          distanceFeet: occurrenceDistanceFeet,
          attack: dnd5eMonsterWeaponAttackAtDistance(
            dnd5eMonsterEffectiveWeaponAttack(
              definition.attack,
              Math.max(0, actorToken.hp ?? monster.hitPoints.average),
              Math.max(1, actorToken.maxHp ?? monster.hitPoints.average),
            ),
            occurrenceDistanceFeet,
            action.kind === 'multiattack'
              ? action.sequenceAttackMode
              : undefined,
          ),
        }]
      : []
  })
  if (
    (attacks.length === 0 && !compositeRuntime) ||
    (attacks.length !== attackIds.length && !compositeRuntime)
  ) return { ok: false, reason: 'invalid-action' }
  const allAttacksInRange = attacks.every(({ attack, distanceFeet: attackDistance }) =>
    monsterAttackAllowsDistance(attack, attackDistance))
  if (!allAttacksInRange) return { ok: false, reason: 'target-out-of-range' }
  const environment = mapGeometryRuntimeForMap(input.map.id)?.environment
  const underwaterAttacks = attacks.map(({ id, name, attack, distanceFeet: attackDistance }) => {
    const usesRangedAttack = attack.mode === 'ranged'
    return dnd5eUnderwaterWeaponAttack({
      environment,
      weaponId: dnd5eMonsterWeaponIdForUnderwater(id, name),
      mode: usesRangedAttack ? 'ranged' : 'melee',
      distanceFeet: attackDistance,
      normalRangeFeet: attack.rangeFeet?.normal,
      hasSwimmingSpeed: (monster.speed.swim ?? 0) > 0,
    })
  })
  if (underwaterAttacks.some((result) => result.automaticMiss)) {
    return { ok: false, reason: 'target-out-of-range' }
  }

  // 每次地图动作都会重建独立 Headless 快照。战斗可能已经推进到先攻
  // 列表中的任意怪物，因此不能沿用 startDnd5eHeadlessCombat 的第 0 位。
  // 移动适配器也执行同样的对齐；攻击若遗漏，会在怪物移动成功后被
  // Headless 以“不是当前行动者”拒绝。
  attacks = attacks.map((entry) => {
    const occurrenceTarget = snapshot.state.combatants[entry.targetToken.id]
    return {
      ...entry,
      attack: dnd5eMonsterWeaponAttackAgainstConditions(
        monster,
        entry.attack,
        occurrenceTarget?.conditions ?? [],
      ),
    }
  })
  const actorTurnKey =
    `${snapshot.state.combatId}:${snapshot.state.round}:${
      snapshot.state.initiativeSlotIds?.[actorIndex] ??
      snapshot.state.turnSlotId ??
      actorCombatant.id
    }`
  const actorSideForTraits = dnd5eCombatTokenSide(actorToken)
  const attackTraitContexts = attacks.map((entry) => {
    const occurrenceTarget =
      snapshot.state.combatants[entry.targetToken.id]!
    const adjacentActiveAllyNearTarget = input.map.tokens.some((candidate) => {
      const ally = snapshot.state.combatants[candidate.id]
      return candidate.id !== actorToken.id &&
        candidate.id !== entry.targetToken.id &&
        candidate.type !== 'obstacle' &&
        !!ally &&
        actorSideForTraits != null &&
        dnd5eCombatTokenSide(candidate) === actorSideForTraits &&
        ally.currentHp > 0 &&
        !ally.deathSaves.dead &&
        !dnd5eIsIncapacitated(ally) &&
        tokenFootprintDistanceCells(
          candidate,
          entry.targetToken,
          input.map,
        ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) <= 5
    })
    return {
      combatId: snapshot.state.combatId,
      round: snapshot.state.round,
      targetCurrentHp: occurrenceTarget.currentHp,
      targetMaxHp: occurrenceTarget.maxHp,
      targetSurprisedCombatId:
        occurrenceTarget.classState.surprisedCombatId,
      targetSurpriseResolvedCombatId:
        occurrenceTarget.classState.surpriseResolvedCombatId,
      targetHasTakenTurn:
        occurrenceTarget.classState.turnStartResolvedTurnKey?.startsWith(
          `${snapshot.state.combatId}:`,
        ) === true,
      adjacentActiveAllyNearTarget,
      turnKey: actorTurnKey,
      usedTurnKeys: actorCombatant.classState.declarativeUsedTurnKeys,
      actorRecklessActive:
        actorCombatant.classState.recklessAttackTurnKey === actorTurnKey,
    } satisfies Dnd5eMonsterAttackTraitContext
  })
  attacks = attacks.map((entry, attackIndex) => ({
    ...entry,
    attack: dnd5eMonsterWeaponAttackWithTriggeredTraits(
      monster,
      entry.attack,
      attackTraitContexts[attackIndex]!,
    ),
  }))
  const fallbackTargetState = snapshot.state.combatants[targetToken.id]!
  const fallbackAdjacentActiveAllyNearTarget = input.map.tokens.some(
    (candidate) => {
      const ally = snapshot.state.combatants[candidate.id]
      return candidate.id !== actorToken.id &&
        candidate.id !== targetToken.id &&
        candidate.type !== 'obstacle' &&
        !!ally &&
        actorSideForTraits != null &&
        dnd5eCombatTokenSide(candidate) === actorSideForTraits &&
        ally.currentHp > 0 &&
        !ally.deathSaves.dead &&
        !dnd5eIsIncapacitated(ally) &&
        tokenFootprintDistanceCells(
          candidate,
          targetToken,
          input.map,
        ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) <= 5
    },
  )
  const monsterAttackTraitContext =
    attackTraitContexts[0] ?? {
      combatId: snapshot.state.combatId,
      round: snapshot.state.round,
      targetCurrentHp: fallbackTargetState.currentHp,
      targetMaxHp: fallbackTargetState.maxHp,
      targetSurprisedCombatId:
        fallbackTargetState.classState.surprisedCombatId,
      targetSurpriseResolvedCombatId:
        fallbackTargetState.classState.surpriseResolvedCombatId,
      targetHasTakenTurn:
        fallbackTargetState.classState.turnStartResolvedTurnKey?.startsWith(
          `${snapshot.state.combatId}:`,
        ) === true,
      adjacentActiveAllyNearTarget: fallbackAdjacentActiveAllyNearTarget,
      turnKey: actorTurnKey,
      usedTurnKeys: actorCombatant.classState.declarativeUsedTurnKeys,
      actorRecklessActive:
        actorCombatant.classState.recklessAttackTurnKey === actorTurnKey,
    }
  if (attacks.some(({ attack, targetToken: attackTargetToken }) => {
    const occurrenceTarget = snapshot.state.combatants[attackTargetToken.id]
    return !occurrenceTarget || (
      attack.targetMaxSizeRank != null &&
      dnd5eEffectiveSizeRank(occurrenceTarget) > attack.targetMaxSizeRank
    )
  })) return { ok: false, reason: 'invalid-target' }
  for (const { attack, targetToken: attackTargetToken } of attacks) {
    const relationEffect = attack.onHitEffects?.find((effect) =>
      effect.kind === 'source-linked-condition')
    if (!relationEffect || relationEffect.relation.whenCapacityFull !== 'linked-target-only') continue
    const linkedTargetIds = sourceLinkedRelationTargetIds(
      snapshot.state,
      actorToken.id,
      relationEffect.relation.slotGroup,
    )
    if (
      linkedTargetIds.length >= relationEffect.relation.capacity &&
      !linkedTargetIds.includes(attackTargetToken.id)
    ) return { ok: false, reason: 'invalid-target' }
  }
  for (const [tokenId, economy] of Object.entries(input.turnEconomyByToken ?? {})) {
    const combatant = snapshot.state.combatants[tokenId]
    if (!combatant) continue
    combatant.turn = {
      ...combatant.turn,
      actionAvailable: economy.action.current > 0,
      bonusActionAvailable: economy.bonusAction.current > 0,
      reactionAvailable: economy.reaction.current > 0,
      movementRemaining: economy.movement.current,
    }
  }
  if (input.turnEconomy) {
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }
  if (input.targetTurnEconomy) {
    target.turn = {
      ...target.turn,
      actionAvailable: input.targetTurnEconomy.action.current > 0,
      bonusActionAvailable: input.targetTurnEconomy.bonusAction.current > 0,
      reactionAvailable: input.targetTurnEconomy.reaction.current > 0,
      movementRemaining: input.targetTurnEconomy.movement.current,
    }
  }
  const actorProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const actorSide = dnd5eCombatTokenSide(actorToken)
  const rangedThreatened = input.map.tokens.some((candidate) => {
    const candidateCombatant = snapshot.state.combatants[candidate.id]
    return candidate.id !== actorToken.id && candidate.type !== 'obstacle' && areOpposedCombatTokens(actorToken, candidate) &&
      dnd5eMapTokenCanThreatenRangedAttacker(actorCombatant, candidate, candidateCombatant) &&
      tokenFootprintDistanceCells(actorToken, candidate, input.map) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) <= 5
  })
  const baseAttackModes: PreparedDnd5eMonsterAttack['attackModes'][number][] = []
  const preparedAttacks: PreparedDnd5eMonsterAttack['attacks'] =
    attacks.map((entry, attackIndex) => {
    const attack = entry.attack
    const attackTargetToken = entry.targetToken
    const attackTarget = snapshot.state.combatants[attackTargetToken.id]!
    const attackDistance = entry.distanceFeet
    const targetProne = attackTarget.conditions.some((condition) =>
      ['prone', '倒地'].includes(condition.toLowerCase()))
    const packTactics = dnd5eMonsterPackTacticsApplies({
      monster,
      actorId: actorToken.id,
      targetId: attackTargetToken.id,
      candidates: input.map.tokens.flatMap((candidate) => {
        const ally = snapshot.state.combatants[candidate.id]
        if (candidate.type === 'obstacle' || !ally) return []
        return [{
          id: candidate.id,
          alliedWithActor:
            actorSide != null &&
            dnd5eCombatTokenSide(candidate) === actorSide,
          currentHp: ally.currentHp,
          incapacitated: dnd5eIsIncapacitated(ally),
          distanceFeetToTarget:
            tokenFootprintDistanceCells(
              candidate,
              attackTargetToken,
              input.map,
            ) *
            Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL),
        }]
      }),
    })
    const targetGrantsAdvantage =
      !dnd5ePreventsAttackAdvantage(attackTarget) &&
      (
        dnd5eTargetGrantsAttackAdvantage(attackTarget) ||
        !!attackTarget.classState.recklessAttackTurnKey ||
        !!attackTarget.classState.stunnedByActorId ||
        dnd5eAttackerIsUnseenForAttack(
          snapshot.state,
          actorToken.id,
          attackTargetToken.id,
        ) ||
        dnd5eHelpAttackApplies(
          snapshot.state,
          actorCombatant,
          attackTarget,
        ) ||
        (targetProne && attackDistance <= 5) ||
        dnd5eTotemWolfPackAdvantage(
          snapshot.state,
          actorCombatant,
          attackTarget,
          attack.mode !== 'ranged',
        ) ||
        packTactics
      )
    const targetImposesDisadvantage =
      dnd5eTargetIsDodging(attackTarget) ||
      dnd5eBlurImposesAttackDisadvantage(
        snapshot.state,
        actorToken.id,
        attackTargetToken.id,
      ) ||
      dnd5eFrightenedAttackDisadvantage(snapshot.state, actorCombatant) ||
      dnd5eTargetIsUnseenForAttack(
        snapshot.state,
        actorToken.id,
        attackTargetToken.id,
      ) ||
      actorProne ||
      (targetProne && attackDistance > 5) ||
      dnd5eTotemBearGuardianDisadvantage(
        snapshot.state,
        actorCombatant,
        attackTarget,
      )
    baseAttackModes.push(resolveDnd5eRollMode({
      advantage: [{
        active: targetGrantsAdvantage,
        reason: 'monster-attack-advantage',
      }],
      disadvantage: [{
        active: targetImposesDisadvantage,
        reason: 'monster-attack-disadvantage',
      }],
    }).mode)
    const relationEffect = attack.onHitEffects?.find((effect) =>
      effect.kind === 'source-linked-condition')
    const relationAdvantage = relationEffect?.relation.attackAdvantageAgainstLinkedTarget === true &&
      sourceLinkedRelationTargetIds(
        snapshot.state,
        actorToken.id,
        relationEffect.relation.slotGroup,
      ).includes(attackTargetToken.id)
    const relationAttackMode = resolveDnd5eRollMode({
      advantage: [{
        active:
          targetGrantsAdvantage ||
          relationAdvantage ||
          dnd5eMonsterAttackTraitAdvantage(
            monster,
            attack,
            attackTraitContexts[attackIndex]!,
          ),
        reason: relationAdvantage ? 'source-linked-target' : 'monster-attack-advantage',
      }],
      disadvantage: [{
        active: targetImposesDisadvantage,
        reason: 'monster-attack-disadvantage',
      }],
    }).mode
    const usesRangedAttack = attack.mode === 'ranged'
    const rangeDisadvantage = usesRangedAttack && (
      rangedThreatened || attackDistance > (attack.rangeFeet?.normal ?? 0)
    )
    const targetAttackMode =
      !rangeDisadvantage && !underwaterAttacks[attackIndex]?.disadvantage
        ? relationAttackMode
        : imposeDnd5eRollDisadvantage(
            relationAttackMode,
            'ranged-attack',
          ).mode
    return {
      ...entry,
      targetArmorClass: dnd5eTargetArmorClassForAttack(
        snapshot.state,
        actorToken.id,
        attackTargetToken.id,
      ),
      targetAttackMode,
      packTactics,
      tranquilityWard: dnd5eTranquilityWardCheck(
        actorCombatant,
        attackTarget,
        snapshot.state,
      ),
      monsterAttackTraitContext: attackTraitContexts[attackIndex]!,
    }
  })
  const attackModes = preparedAttacks.map((entry) => entry.targetAttackMode)
  const primaryPreparedAttack = preparedAttacks[0]
  const targetAttackMode =
    baseAttackModes[0] ?? primaryPreparedAttack?.targetAttackMode ?? 'normal'
  const packTactics = primaryPreparedAttack?.packTactics ?? false
  return {
    ok: true,
    prepared: {
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actorToken,
      targetToken,
      monster,
      action,
      attacks: preparedAttacks,
      targetOccurrences,
      compositeRuntime,
      targetArmorClass:
        primaryPreparedAttack?.targetArmorClass ??
        dnd5eTargetArmorClassForAttack(
          snapshot.state,
          actorToken.id,
          targetToken.id,
        ),
      distanceFeet: primaryPreparedAttack?.distanceFeet ?? distanceFeet,
      targetAttackMode,
      attackModes,
      packTactics,
      viciousMockeryAttackDisadvantage: dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant),
      tranquilityWard: dnd5eTranquilityWardCheck(actorCombatant, target, snapshot.state),
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
      sizeDamageD4Mode: dnd5eActiveWeaponDamageD4Mode(actorCombatant.classState.activeEffects),
      randomRepeatRoll: input.randomRepeatRoll,
      monsterAttackTraitContext,
    },
  }
}

export function previewDnd5eMonsterAttack(
  prepared: PreparedDnd5eMonsterAttack,
  attackIndex: number,
  d20: number,
  d20Second?: number,
  protectedAttack = false,
  blessRoll?: number,
  baneRoll?: number,
) {
  const definition = prepared.attacks[attackIndex]
  if (!definition) throw new RangeError('monster attack index is out of range')
  const mode = dnd5eMonsterAttackModeWithProtection(
    dnd5ePreparedMonsterAttackMode(prepared, attackIndex),
    protectedAttack,
  )
  const rolls = mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const resolved = resolveDnd5eAttackOutcome({
    attack: rules.resolveAttack({
      rolls,
      mode,
      modifier: definition.attack.toHit + (blessRoll ?? 0) - (baneRoll ?? 0),
      targetAc: definition.targetArmorClass,
    }),
    criticalThreshold: definition.attack.criticalThreshold,
    automaticCritical: dnd5eMonsterAssassinateAutomaticCritical(
      prepared.monster,
      definition.monsterAttackTraitContext,
    ),
  })
  const sourceLinkedEffect = definition.attack.onHitEffects?.find((effect) =>
    effect.kind === 'source-linked-condition')
  const automaticallyHits =
    sourceLinkedEffect?.kind === 'source-linked-condition' &&
    sourceLinkedEffect.relation.attackAutomaticallyHitsLinkedTarget === true &&
    sourceLinkedRelationTargetIds(
      prepared.state,
      prepared.actorToken.id,
      sourceLinkedEffect.relation.slotGroup,
    ).includes(definition.targetToken.id)
  return automaticallyHits
    ? { ...resolved, hit: true, critical: false }
    : resolved
}

export function dnd5ePreparedMonsterTraitDamageDefinitions(
  prepared: PreparedDnd5eMonsterAttack,
  attackIndex: number,
  effectiveRollMode: 'normal' | 'advantage' | 'disadvantage',
  usedTurnKeys?: Readonly<Record<string, string>>,
): readonly Dnd5eMonsterTraitDamageDefinition[] {
  const definition = prepared.attacks[attackIndex]
  if (!definition) return []
  return dnd5eMonsterTraitDamageDefinitions(
    prepared.monster,
    definition.attack,
    {
      ...prepared.monsterAttackTraitContext,
      ...definition.monsterAttackTraitContext,
      effectiveRollMode,
      usedTurnKeys:
        usedTurnKeys ?? prepared.monsterAttackTraitContext.usedTurnKeys,
    },
  )
}

export function dnd5eMonsterAttackModeWithProtection(
  mode: PreparedDnd5eMonsterAttack['targetAttackMode'],
  protectedAttack: boolean,
): PreparedDnd5eMonsterAttack['targetAttackMode'] {
  return protectedAttack ? imposeDnd5eRollDisadvantage(mode, 'protection').mode : mode
}

export function dnd5ePreparedMonsterAttackMode(
  prepared: Pick<PreparedDnd5eMonsterAttack, 'targetAttackMode' | 'attackModes' | 'viciousMockeryAttackDisadvantage'>,
  attackIndex: number,
): PreparedDnd5eMonsterAttack['targetAttackMode'] {
  const baseMode = prepared.attackModes[attackIndex] ?? prepared.targetAttackMode
  if (!prepared.viciousMockeryAttackDisadvantage || attackIndex !== 0) return baseMode
  return imposeDnd5eRollDisadvantage(baseMode, 'vicious-mockery').mode
}

export function prepareDnd5eMonsterAfterHitMechanics(
  prepared: PreparedDnd5eMonsterAttack,
  hit: boolean,
) {
  if (!hit) return []
  const actor = prepared.state.combatants[prepared.actorToken.id]
  if (!actor) return []
  return dnd5eEligibleMonsterMechanics(prepared.monster, 'after-hit', {
    combatId: prepared.state.combatId,
    round: prepared.state.round,
    actorId: actor.id,
    currentHp: actor.currentHp,
    maxHp: actor.maxHp,
    usedKeys: actor.classState.declarativeUsedTurnKeys,
  }).map((mechanic) => ({
    actorId: actor.id,
    actorName: actor.name,
    mechanicId: mechanic.id,
    mechanicName: mechanic.name,
    targetId: prepared.targetToken.id,
    effects: dnd5eMonsterMechanicDiceRequirements(mechanic),
  }))
}

export function resolvePreparedDnd5eMonsterAttack(input: {
  prepared: PreparedDnd5eMonsterAttack
  rolls: readonly Omit<Dnd5eMonsterActionRoll, 'targetId'>[]
  mechanicRolls?: readonly Dnd5eMonsterMechanicRoll[]
  compositeSteps?: readonly Dnd5eMonsterMultiattackStepResolutionV1[]
  settleAttackCount?: number
  multiattackContinuation?: {
    schemaVersion: 1
    parentActionId: string
    occurrenceIndex: number
  }
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const weaponRolls = input.rolls.map((roll, attackIndex) => ({
    ...roll,
    mode: dnd5ePreparedMonsterAttackMode(prepared, attackIndex),
    targetId:
      prepared.attacks[attackIndex]?.targetToken.id ??
      prepared.targetToken.id,
  }))
  const result = resolveDnd5eHeadlessAction(
    prepared.state,
    prepared.compositeRuntime
      ? {
          type: 'monster-multiattack-composite',
          schemaVersion: 1,
          actorId: prepared.actorToken.id,
          actionId: prepared.action.id,
          steps: input.compositeSteps ?? [],
        }
      : {
          type: 'monster-action',
          actorId: prepared.actorToken.id,
          actionId: prepared.action.id,
          randomRepeatRoll: prepared.randomRepeatRoll,
          settleAttackCount: input.settleAttackCount,
          multiattackContinuation: input.multiattackContinuation,
          mechanicRolls: input.mechanicRolls,
          rolls: weaponRolls,
        },
  )
  if (!result.ok) return { result }
  return {
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: prepared.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
    }),
  }
}
