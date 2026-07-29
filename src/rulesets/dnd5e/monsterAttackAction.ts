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
  dnd5eTranquilityWardCheck,
  reconcileDnd5eSourceLinkedRelations,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterActionRoll,
  type Dnd5eMonsterMechanicRoll,
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
  attacks: readonly { id: string; name: string; attack: Dnd5eMonsterWeaponAttack }[]
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
      effect.relation?.kind === 'grapple' &&
      effect.standardCondition === 'grappled' &&
      effect.dependsOnEffectId == null &&
      effect.relation.sourceActorId === sourceActorId &&
      effect.relation.slotGroup === slotGroup &&
      effect.source.actorId === sourceActorId)
      ? [target.id]
      : [])
}

export function prepareDnd5eMonsterAttack(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  targetTokenId: string
  actionIndex?: number
  turnEconomy?: Dnd5eTurnEconomyCounts
  targetTurnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
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
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const distanceFeet = Math.max(
    tokenFootprintDistanceCells(actorToken, targetToken, input.map) *
      Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL),
    Math.abs(
      mapGeometryTokenElevation(geometry, actorToken) -
        mapGeometryTokenElevation(geometry, targetToken),
    ),
  )
  const multiattack = indexedAction.kind === 'weapon-attack'
    ? monster.actions.find((action) => {
        if (
          action.kind !== 'multiattack' ||
          !action.sequence?.includes(indexedAction.id) ||
          dnd5eMonsterActionAutomation(action) !== 'headless'
        ) return false
        return action.sequence.every((actionId) => {
          const definition = monster.actions.find((candidate) => candidate.id === actionId)
          if (
            !definition?.attack ||
            dnd5eMonsterActionAutomation(definition) !== 'headless'
          ) return false
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
  const attackIds = action.kind === 'multiattack' ? action.sequence ?? [] : [action.id]
  let attacks = attackIds.flatMap((actionId) => {
    const definition = monster.actions.find((candidate) => candidate.id === actionId)
    return definition?.attack && dnd5eMonsterActionAutomation(definition) === 'headless'
      ? [{
          id: definition.id,
          name: definition.name,
          attack: dnd5eMonsterEffectiveWeaponAttack(
            definition.attack,
            Math.max(0, actorToken.hp ?? monster.hitPoints.average),
            Math.max(1, actorToken.maxHp ?? monster.hitPoints.average),
          ),
        }]
      : []
  })
  if (attacks.length !== attackIds.length || attacks.length === 0) return { ok: false, reason: 'invalid-action' }
  attacks = attacks.map((entry) => ({
    ...entry,
    attack: dnd5eMonsterWeaponAttackAtDistance(
      entry.attack,
      distanceFeet,
      action.kind === 'multiattack' ? action.sequenceAttackMode : undefined,
    ),
  }))
  const allAttacksInRange = attacks.every(({ attack }) =>
    monsterAttackAllowsDistance(attack, distanceFeet))
  if (!allAttacksInRange) return { ok: false, reason: 'target-out-of-range' }
  const environment = mapGeometryRuntimeForMap(input.map.id)?.environment
  const underwaterAttacks = attacks.map(({ id, name, attack }) => {
    const usesRangedAttack = attack.mode === 'ranged'
    return dnd5eUnderwaterWeaponAttack({
      environment,
      weaponId: dnd5eMonsterWeaponIdForUnderwater(id, name),
      mode: usesRangedAttack ? 'ranged' : 'melee',
      distanceFeet,
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
  attacks = attacks.map((entry) => ({
    ...entry,
    attack: dnd5eMonsterWeaponAttackAgainstConditions(monster, entry.attack, target.conditions),
  }))
  const actorTurnKey =
    `${snapshot.state.combatId}:${snapshot.state.round}:${
      snapshot.state.initiativeSlotIds?.[actorIndex] ??
      snapshot.state.turnSlotId ??
      actorCombatant.id
    }`
  const actorSideForTraits = dnd5eCombatTokenSide(actorToken)
  const adjacentActiveAllyNearTarget = input.map.tokens.some((candidate) => {
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
      tokenFootprintDistanceCells(candidate, targetToken, input.map) *
        Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) <= 5
  })
  const monsterAttackTraitContext: Dnd5eMonsterAttackTraitContext = {
    combatId: snapshot.state.combatId,
    round: snapshot.state.round,
    targetCurrentHp: target.currentHp,
    targetMaxHp: target.maxHp,
    targetSurprisedCombatId: target.classState.surprisedCombatId,
    targetSurpriseResolvedCombatId: target.classState.surpriseResolvedCombatId,
    targetHasTakenTurn:
      target.classState.turnStartResolvedTurnKey?.startsWith(
        `${snapshot.state.combatId}:`,
      ) === true,
    adjacentActiveAllyNearTarget,
    turnKey: actorTurnKey,
    usedTurnKeys: actorCombatant.classState.declarativeUsedTurnKeys,
    actorRecklessActive:
      actorCombatant.classState.recklessAttackTurnKey ===
      actorTurnKey,
  }
  attacks = attacks.map((entry) => ({
    ...entry,
    attack: dnd5eMonsterWeaponAttackWithTriggeredTraits(
      monster,
      entry.attack,
      monsterAttackTraitContext,
    ),
  }))
  if (attacks.some(({ attack }) =>
    attack.targetMaxSizeRank != null &&
    dnd5eEffectiveSizeRank(target) > attack.targetMaxSizeRank
  )) return { ok: false, reason: 'invalid-target' }
  for (const { attack } of attacks) {
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
      !linkedTargetIds.includes(targetToken.id)
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
  const targetProne = target.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const actorSide = dnd5eCombatTokenSide(actorToken)
  const packTactics = dnd5eMonsterPackTacticsApplies({
    monster,
    actorId: actorToken.id,
    targetId: targetToken.id,
    candidates: input.map.tokens.flatMap((candidate) => {
      const ally = snapshot.state.combatants[candidate.id]
      if (candidate.type === 'obstacle' || !ally) return []
      return [{
        id: candidate.id,
        alliedWithActor: actorSide != null && dnd5eCombatTokenSide(candidate) === actorSide,
        currentHp: ally.currentHp,
        incapacitated: dnd5eIsIncapacitated(ally),
        distanceFeetToTarget:
          tokenFootprintDistanceCells(candidate, targetToken, input.map) *
          Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL),
      }]
    }),
  })
  const targetGrantsAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
    (dnd5eTargetGrantsAttackAdvantage(target) || !!target.classState.recklessAttackTurnKey || !!target.classState.stunnedByActorId ||
      dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id) ||
      dnd5eHelpAttackApplies(snapshot.state, actorCombatant, target) || (targetProne && distanceFeet <= 5) || packTactics)
  const targetImposesDisadvantage = dnd5eTargetIsDodging(target) ||
    dnd5eBlurImposesAttackDisadvantage(snapshot.state, actorToken.id, targetToken.id) ||
    dnd5eFrightenedAttackDisadvantage(snapshot.state, actorCombatant) ||
    dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id) || actorProne || (targetProne && distanceFeet > 5)
  const targetAttackMode = resolveDnd5eRollMode({
    advantage: [{ active: targetGrantsAdvantage, reason: 'monster-attack-advantage' }],
    disadvantage: [{ active: targetImposesDisadvantage, reason: 'monster-attack-disadvantage' }],
  }).mode
  const rangedThreatened = input.map.tokens.some((candidate) => {
    const candidateCombatant = snapshot.state.combatants[candidate.id]
    return candidate.id !== actorToken.id && candidate.type !== 'obstacle' && areOpposedCombatTokens(actorToken, candidate) &&
      dnd5eMapTokenCanThreatenRangedAttacker(actorCombatant, candidate, candidateCombatant) &&
      tokenFootprintDistanceCells(actorToken, candidate, input.map) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) <= 5
  })
  const attackModes = attacks.map(({ attack }, attackIndex) => {
    const relationEffect = attack.onHitEffects?.find((effect) =>
      effect.kind === 'source-linked-condition')
    const relationAdvantage = relationEffect?.relation.attackAdvantageAgainstLinkedTarget === true &&
      sourceLinkedRelationTargetIds(
        snapshot.state,
        actorToken.id,
        relationEffect.relation.slotGroup,
      ).includes(targetToken.id)
    const relationAttackMode = resolveDnd5eRollMode({
      advantage: [{
        active:
          targetGrantsAdvantage ||
          relationAdvantage ||
          dnd5eMonsterAttackTraitAdvantage(monster, attack, monsterAttackTraitContext),
        reason: relationAdvantage ? 'source-linked-target' : 'monster-attack-advantage',
      }],
      disadvantage: [{
        active: targetImposesDisadvantage,
        reason: 'monster-attack-disadvantage',
      }],
    }).mode
    const usesRangedAttack = attack.mode === 'ranged'
    const rangeDisadvantage = usesRangedAttack && (
      rangedThreatened || distanceFeet > (attack.rangeFeet?.normal ?? 0)
    )
    if (!rangeDisadvantage && !underwaterAttacks[attackIndex]?.disadvantage) return relationAttackMode
    return imposeDnd5eRollDisadvantage(relationAttackMode, 'ranged-attack').mode
  })
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
      attacks,
      targetArmorClass: dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, targetToken.id),
      distanceFeet,
      targetAttackMode,
      attackModes,
      packTactics,
      viciousMockeryAttackDisadvantage: dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant),
      tranquilityWard: dnd5eTranquilityWardCheck(actorCombatant, target, snapshot.state),
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
      sizeDamageD4Mode: dnd5eActiveWeaponDamageD4Mode(actorCombatant.classState.activeEffects),
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
  return resolveDnd5eAttackOutcome({
    attack: rules.resolveAttack({
      rolls,
      mode,
      modifier: definition.attack.toHit + (blessRoll ?? 0) - (baneRoll ?? 0),
      targetAc: prepared.targetArmorClass,
    }),
    criticalThreshold: definition.attack.criticalThreshold,
    automaticCritical: dnd5eMonsterAssassinateAutomaticCritical(
      prepared.monster,
      prepared.monsterAttackTraitContext,
    ),
  })
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
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'monster-action',
    actorId: prepared.actorToken.id,
    actionId: prepared.action.id,
    mechanicRolls: input.mechanicRolls,
    rolls: input.rolls.map((roll, attackIndex) => ({
      ...roll,
      mode: dnd5ePreparedMonsterAttackMode(prepared, attackIndex),
      targetId: prepared.targetToken.id,
    })),
  })
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
