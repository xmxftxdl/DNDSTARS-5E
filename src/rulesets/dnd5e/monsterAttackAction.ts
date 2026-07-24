import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
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
  dnd5eFrightenedAttackDisadvantage,
  dnd5eHelpAttackApplies,
  dnd5eTranquilityWardCheck,
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
import { dnd5eMonsterEffectiveWeaponAttack, dnd5eMonsterHasGenericAbility } from './monsterGenericAbilities'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5eIsIncapacitated, dnd5ePreventsAttackAdvantage, dnd5eTargetGrantsAttackAdvantage, dnd5eTargetIsDodging } from './passiveDefenses'
import { imposeDnd5eRollDisadvantage, resolveDnd5eRollMode } from './rollMode'
import { dnd5eActiveWeaponDamageD4Mode } from './activeEffects'
import { mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
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

  const indexedAction = monster.actions[input.actionIndex ?? 0]
    ?? monster.actions.find((action) => action.kind === 'weapon-attack')
  if (!indexedAction) return { ok: false, reason: 'invalid-action' }
  const multiattack = indexedAction.kind === 'weapon-attack'
    ? monster.actions.find((action) => action.kind === 'multiattack' && action.sequence?.includes(indexedAction.id) && dnd5eMonsterActionAutomation(action) === 'headless')
    : undefined
  const action = multiattack ?? indexedAction
  if (dnd5eMonsterActionAutomation(action) !== 'headless') return { ok: false, reason: 'invalid-action' }
  const attackIds = action.kind === 'multiattack' ? action.sequence ?? [] : [action.id]
  const attacks = attackIds.flatMap((actionId) => {
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
  const distanceFeet = tokenFootprintDistanceCells(actorToken, targetToken, input.map)
    * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  const allAttacksInRange = attacks.every(({ attack }) => distanceFeet <= (
    attack.mode === 'melee'
      ? attack.reachFeet ?? 5
      : attack.mode === 'ranged'
        ? attack.rangeFeet?.long ?? attack.rangeFeet?.normal ?? 0
        : Math.max(attack.reachFeet ?? 5, attack.rangeFeet?.long ?? attack.rangeFeet?.normal ?? 0)
  ))
  if (!allAttacksInRange) return { ok: false, reason: 'target-out-of-range' }
  const environment = mapGeometryRuntimeForMap(input.map.id)?.environment
  const underwaterAttacks = attacks.map(({ id, name, attack }) => {
    const usesRangedAttack = attack.mode === 'ranged' ||
      (attack.mode === 'melee-or-ranged' && distanceFeet > (attack.reachFeet ?? 5))
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
  const packTactics = dnd5eMonsterHasGenericAbility(monster, 'pack-tactics') && input.map.tokens.some((candidate) => {
    if (candidate.id === actorToken.id || candidate.id === targetToken.id || candidate.type === 'obstacle' || (candidate.hp ?? 1) <= 0) return false
    if (areOpposedCombatTokens(actorToken, candidate)) return false
    const ally = snapshot.state.combatants[candidate.id]
    return !!ally && !dnd5eIsIncapacitated(ally) &&
      tokenFootprintDistanceCells(candidate, targetToken, input.map) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) <= 5
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
    const usesRangedAttack = attack.mode === 'ranged' || (attack.mode === 'melee-or-ranged' && distanceFeet > (attack.reachFeet ?? 5))
    const rangeDisadvantage = usesRangedAttack && (
      rangedThreatened || distanceFeet > (attack.rangeFeet?.normal ?? 0)
    )
    if (!rangeDisadvantage && !underwaterAttacks[attackIndex]?.disadvantage) return targetAttackMode
    return imposeDnd5eRollDisadvantage(targetAttackMode, 'ranged-attack').mode
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
  })
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
