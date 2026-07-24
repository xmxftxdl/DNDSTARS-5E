import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { Dnd5eTurnEconomyByToken, Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eCharacterClassLevel } from './multiclass'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { resolveDnd5eAttackOutcome } from './attackResolution'
import { dnd5eConditionHitIsAutomaticCritical } from './conditions'
import { dnd5eAttackModeWithProtection } from './equipmentAttackAction'
import { resolveDnd5eRollMode } from './rollMode'
import {
  dnd5eMonkMartialArtsEligible,
  dnd5eWeaponAttackProfile,
  dnd5eWeaponRangeFeet,
  dnd5eWearingUnproficientArmor,
  type Dnd5eWeaponAttackProfile,
} from './equipment'
import {
  dnd5eBlurImposesAttackDisadvantage,
  dnd5eAttackerIsUnseenForAttack,
  dnd5eCombatantHasConcentrationEffect,
  dnd5eFrightenedAttackDisadvantage,
  dnd5eHelpAttackApplies,
  dnd5eTargetIsUnseenForAttack,
  dnd5eTargetArmorClassForAttack,
  dnd5eTranquilityWardCheck,
  dnd5eWeaponClassDamageDefinitions,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eClassDamageDefinition,
  type Dnd5eClassDamageRolls,
  type Dnd5eCuttingWordsUse,
  type Dnd5eHeadlessCombatState,
  type Dnd5eWeaponClassDamageContext,
  type Dnd5eTranquilitySaveRoll,
  type Dnd5eStandAgainstTideUse,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, dnd5eMapTokenCanThreatenRangedAttacker, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5ePreventsAttackAdvantage, dnd5eTargetGrantsAttackAdvantage, dnd5eTargetIsDodging } from './passiveDefenses'

export type Dnd5eHunterMultiattackFeature = 'volley' | 'whirlwind-attack'

export type Dnd5eHunterMultiattackRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'feature-locked'
  | 'wrong-weapon'
  | 'invalid-center'
  | 'center-out-of-range'
  | 'no-targets'
  | 'action-unavailable'
  | 'combatant-missing'

export interface PreparedDnd5eHunterMultiattackTarget {
  token: Token
  distanceFeet: number
  armorClass: number
  attackMode: 'normal' | 'advantage' | 'disadvantage'
  classDamageContext: Dnd5eWeaponClassDamageContext
  tranquilityWard?: ReturnType<typeof dnd5eTranquilityWardCheck>
}

export interface PreparedDnd5eHunterMultiattack {
  action: SharedPlayerActionState
  feature: Dnd5eHunterMultiattackFeature
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  actorToken: Token
  centerToken: Token
  profile: Dnd5eWeaponAttackProfile
  targets: readonly PreparedDnd5eHunterMultiattackTarget[]
  blessed: boolean
  baned: boolean
}

function distanceFeet(left: Token, right: Token, map: BattleMap): number {
  return tokenFootprintDistanceCells(left, right, map) * Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
}

function syncTurnEconomy(
  state: Dnd5eHeadlessCombatState,
  economies: Readonly<Record<string, Dnd5eTurnEconomyCounts>> | undefined,
): void {
  for (const [tokenId, economy] of Object.entries(economies ?? {})) {
    const combatant = state.combatants[tokenId]
    if (!combatant) continue
    combatant.turn = {
      ...combatant.turn,
      actionAvailable: economy.action.current > 0,
      bonusActionAvailable: economy.bonusAction.current > 0,
      reactionAvailable: economy.reaction.current > 0,
      movementRemaining: economy.movement.current,
    }
  }
}

export function prepareDnd5eHunterMultiattack(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Dnd5eTurnEconomyByToken
}): { ok: true; prepared: PreparedDnd5eHunterMultiattack } | { ok: false; reason: Dnd5eHunterMultiattackRejectReason } {
  const feature = input.action.dnd5eWeaponAttackOptions?.hunterMultiattack
  if (input.action.type !== 'dnd5e-weapon-attack' || !feature || !input.action.targetTokenId) {
    return { ok: false, reason: 'invalid-action' }
  }
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === input.action.actorTokenId && token.characterId === actor?.id)
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  const choices = actor.dnd5eClassChoices?.classes?.ranger
  if (
    dnd5eCharacterClassLevel(actor, 'ranger') < 11 || choices?.subclass !== 'hunter' ||
    !choices.selections?.multiattack?.includes(feature)
  ) return { ok: false, reason: 'feature-locked' }
  const profile = dnd5eWeaponAttackProfile(actor)
  if (
    !profile ||
    (feature === 'volley'
      ? profile.mode !== 'ranged' || profile.properties.some((property) => property.includes('装填'))
      : profile.mode !== 'melee')
  ) {
    return { ok: false, reason: 'wrong-weapon' }
  }
  if (input.turnEconomy.action.current < 1) return { ok: false, reason: 'action-unavailable' }
  const centerToken = input.map.tokens.find((token) => token.id === input.action.targetTokenId && token.type !== 'obstacle')
  if (!centerToken || centerToken.id === actorToken.id) return { ok: false, reason: 'invalid-center' }
  const centerRange = feature === 'volley' ? dnd5eWeaponRangeFeet(profile) : 5
  if (distanceFeet(actorToken, centerToken, input.map) > centerRange) return { ok: false, reason: 'center-out-of-range' }

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
  syncTurnEconomy(snapshot.state, input.turnEconomyByToken)
  actorCombatant.turn = {
    ...actorCombatant.turn,
    actionAvailable: input.turnEconomy.action.current > 0,
    bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0,
    movementRemaining: input.turnEconomy.movement.current,
  }

  const targetTokens = input.map.tokens.filter((token) => {
    if (token.id === actorToken.id || token.type === 'obstacle' || !areOpposedCombatTokens(actorToken, token)) return false
    const combatant = snapshot.state.combatants[token.id]
    if (!combatant || combatant.currentHp <= 0 || combatant.deathSaves.dead) return false
    return feature === 'volley'
      ? distanceFeet(centerToken, token, input.map) <= 10
      : distanceFeet(actorToken, token, input.map) <= 5
  })
  if (targetTokens.length < 1) return { ok: false, reason: 'no-targets' }

  const rangedThreatened = feature === 'volley' && input.map.tokens.some((candidate) => {
    const candidateCombatant = snapshot.state.combatants[candidate.id]
    return candidate.id !== actorToken.id && candidate.type !== 'obstacle' && areOpposedCombatTokens(actorToken, candidate) &&
      dnd5eMapTokenCanThreatenRangedAttacker(actorCombatant, candidate, candidateCombatant) &&
      distanceFeet(actorToken, candidate, input.map) <= 5
  })

  const targets = targetTokens.map((token, targetIndex): PreparedDnd5eHunterMultiattackTarget => {
    const target = snapshot.state.combatants[token.id]!
    const targetDistance = distanceFeet(actorToken, token, input.map)
    const actorProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
    const targetProne = target.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
    const targetGrantsAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
      (dnd5eTargetGrantsAttackAdvantage(target) || (targetIndex === 0 && actorCombatant.classState.hiddenCheckTotal != null) ||
        !!target.classState.recklessAttackTurnKey || !!target.classState.stunnedByActorId ||
        dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, token.id) ||
        (targetIndex === 0 && dnd5eHelpAttackApplies(snapshot.state, actorCombatant, target)) ||
        (targetProne && targetDistance <= 5))
    const targetImposesDisadvantage = dnd5eTargetIsDodging(target) ||
      dnd5eBlurImposesAttackDisadvantage(snapshot.state, actorToken.id, token.id) || actorCombatant.exhaustionLevel >= 3 ||
      dnd5eWearingUnproficientArmor(actor) ||
      dnd5eFrightenedAttackDisadvantage(snapshot.state, actorCombatant) ||
      (targetIndex === 0 && dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant)) ||
      dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, token.id) || actorProne || (targetProne && targetDistance > 5) ||
      (feature === 'volley' && (rangedThreatened || targetDistance > (profile.rangeFeet?.normal ?? 0)))
    const attackMode = resolveDnd5eRollMode({
      advantage: [{ active: targetGrantsAdvantage, reason: 'hunter-multiattack-advantage' }],
      disadvantage: [{ active: targetImposesDisadvantage, reason: 'hunter-multiattack-disadvantage' }],
    }).mode
    const adjacentEnemyOfTarget = input.map.tokens.some((candidate) => {
      if (candidate.id === actorToken.id || candidate.id === token.id || !areOpposedCombatTokens(actorToken, candidate)) return false
      const combatant = snapshot.state.combatants[candidate.id]
      return !!combatant && combatant.currentHp > 0 && distanceFeet(candidate, token, input.map) <= 5
    })
    return {
      token,
      distanceFeet: targetDistance,
      armorClass: dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, token.id),
      attackMode,
      classDamageContext: {
        mode: profile.mode,
        distanceFeet: targetDistance,
        normalRangeFeet: profile.rangeFeet?.normal,
        longRangeFeet: profile.rangeFeet?.long,
        finesse: profile.finesse,
        strengthBased: profile.attackAbility === 'str',
        monkMartialArtsEligible: dnd5eMonkMartialArtsEligible(actor),
        weaponDamageSides: profile.damage.sides,
        damageType: profile.damage.type,
        adjacentEnemyOfTarget,
        hordeBreakerEligible: choices.selections?.['hunters-prey']?.includes('horde-breaker') === true,
      },
      tranquilityWard: dnd5eTranquilityWardCheck(actorCombatant, target, snapshot.state),
    }
  })
  return {
    ok: true,
    prepared: {
      action: input.action,
      feature,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      actorToken,
      centerToken,
      profile,
      targets,
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
    },
  }
}

export function previewDnd5eHunterMultiattack(
  prepared: PreparedDnd5eHunterMultiattack,
  attackIndex: number,
  d20: number,
  d20Second?: number,
  protectedAttack = false,
  blessRoll?: number,
  baneRoll?: number,
) {
  const target = prepared.targets[attackIndex]
  if (!target) throw new RangeError('hunter multiattack index is out of range')
  const mode = dnd5eAttackModeWithProtection(target.attackMode, protectedAttack)
  const rolls = mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const resolved = rules.resolveAttack({ rolls, mode, modifier: prepared.profile.attackModifier + (blessRoll ?? 0) - (baneRoll ?? 0), targetAc: target.armorClass })
  return {
    ...resolveDnd5eAttackOutcome({
      attack: resolved,
      criticalThreshold: prepared.profile.criticalThreshold,
      automaticCritical: dnd5eConditionHitIsAutomaticCritical({
        target: prepared.state.combatants[target.token.id],
        distanceFeet: target.distanceFeet,
      }),
    }),
    mode,
  }
}

export function dnd5eHunterMultiattackClassDamageDefinitions(
  prepared: PreparedDnd5eHunterMultiattack,
  attackIndex: number,
  critical: boolean,
  options: { protectedAttack?: boolean; colossusSlayerCommitted?: boolean } = {},
): readonly Dnd5eClassDamageDefinition[] {
  const target = prepared.targets[attackIndex]
  if (!target) throw new RangeError('hunter multiattack index is out of range')
  const definitions = dnd5eWeaponClassDamageDefinitions({
    state: prepared.state,
    actorId: prepared.actorToken.id,
    targetId: target.token.id,
    context: target.classDamageContext,
    effectiveMode: dnd5eAttackModeWithProtection(target.attackMode, !!options.protectedAttack),
    critical,
  })
  return options.colossusSlayerCommitted
    ? definitions.filter((definition) => definition.source !== 'colossus-slayer')
    : definitions
}

export interface Dnd5eHunterMultiattackResolutionRoll {
  d20: number
  d20Second?: number
  blessRoll?: number
  baneRoll?: number
  bardicInspirationRoll?: number
  cuttingWords?: Dnd5eCuttingWordsUse
  cuttingWordsDamage?: Dnd5eCuttingWordsUse
  protectionReactionActorId?: string
  shieldSpellReaction?: boolean
  uncannyDodge?: boolean
  deflectMissilesD10?: number
  tranquilitySave?: Dnd5eTranquilitySaveRoll
  damageRolls: readonly number[]
  classDamageRolls?: readonly Dnd5eClassDamageRolls[]
  standAgainstTide?: Dnd5eStandAgainstTideUse
}

export function resolvePreparedDnd5eHunterMultiattack(input: {
  prepared: PreparedDnd5eHunterMultiattack
  rolls: readonly Dnd5eHunterMultiattackResolutionRoll[]
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  if (input.rolls.length !== prepared.targets.length) {
    return { result: { ok: false, state: prepared.state, events: [], reason: 'invalid-dice' } }
  }
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'ranger-hunter-multiattack',
    actorId: prepared.actorToken.id,
    feature: prepared.feature,
    weaponMode: prepared.profile.mode,
    attackModifier: prepared.profile.attackModifier,
    criticalThreshold: prepared.profile.criticalThreshold,
    damage: { ...prepared.profile.damage },
    attacks: input.rolls.map((roll, index) => ({
      targetId: prepared.targets[index].token.id,
      d20: roll.d20,
      d20Second: roll.d20Second,
      blessRoll: roll.blessRoll,
      baneRoll: roll.baneRoll,
      bardicInspirationRoll: roll.bardicInspirationRoll,
      cuttingWords: roll.cuttingWords,
      cuttingWordsDamage: roll.cuttingWordsDamage,
      protectionReactionActorId: roll.protectionReactionActorId,
      shieldSpellReaction: roll.shieldSpellReaction,
      uncannyDodge: roll.uncannyDodge,
      deflectMissilesD10: roll.deflectMissilesD10,
      tranquilitySave: roll.tranquilitySave,
      mode: prepared.targets[index].attackMode,
      damageRolls: roll.damageRolls,
      classDamageContext: prepared.targets[index].classDamageContext,
      classDamageRolls: roll.classDamageRolls,
      standAgainstTide: roll.standAgainstTide,
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
