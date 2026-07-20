import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { CombatTransaction } from '../../lib/combatTransaction'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { resolveDnd5eAttackOutcome } from './attackResolution'
import { dnd5eConditionHitIsAutomaticCritical } from './conditions'
import { dnd5eMonkMartialArtsEligible, dnd5eOffHandWeaponAttackProfile, dnd5eWeaponAttackProfile, dnd5eWeaponRangeFeet, type Dnd5eWeaponAttackProfile } from './equipment'
import { dnd5eAttacksPerAttackAction, dnd5eClassDefinitionForCharacter } from './classes'
import { imposeDnd5eRollDisadvantage, resolveDnd5eRollMode } from './rollMode'
import {
  dnd5eAttackerIsUnseenForAttack,
  dnd5eFrightenedAttackDisadvantage,
  dnd5eHelpAttackApplies,
  dnd5eTargetArmorClassForAttack,
  dnd5eTargetIsUnseenForAttack,
  dnd5eCombatantHasConcentrationEffect,
  dnd5eTranquilityWardCheck,
  dnd5eIsFavoredEnemy,
  dnd5eWeaponClassDamageDefinitions,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eClassDamageDefinition,
  type Dnd5eClassDamageRolls,
  type Dnd5eCuttingWordsUse,
  type Dnd5eStandAgainstTideUse,
  type Dnd5eHeadlessCombatState,
  type Dnd5eWeaponClassDamageContext,
  type Dnd5eTranquilitySaveRoll,
} from './headlessCombatEngine'
import {
  applyDnd5eAttackCoverOverride,
  createDnd5eMapCombatSnapshot,
  dnd5eAttackCoverForPair,
  dnd5eMapTokenCanThreatenRangedAttacker,
  planDnd5eMapResultApplication,
  type Dnd5eAttackCoverSnapshot,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5ePreventsAttackAdvantage, dnd5eTargetGrantsAttackAdvantage, dnd5eTargetIsDodging } from './passiveDefenses'

export type Dnd5eEquipmentAttackRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'invalid-target'
  | 'not-dnd5e-class'
  | 'no-weapon'
  | 'target-out-of-range'
  | 'attack-action-spent'
  | 'divine-smite-unavailable'
  | 'reckless-attack-unavailable'
  | 'frenzy-attack-unavailable'
  | 'off-hand-attack-unavailable'
  | 'horde-breaker-unavailable'
  | 'stunning-strike-unavailable'
  | 'foe-slayer-unavailable'
  | 'combatant-missing'

export interface PreparedDnd5eEquipmentAttack {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  actorToken: Token
  targetToken: Token
  profile: Dnd5eWeaponAttackProfile
  targetArmorClass: number
  cover: Dnd5eAttackCoverSnapshot & { overriddenByDm: boolean }
  distanceFeet: number
  attackNumber: number
  attacksAllowed: number
  spendsAction: boolean
  spendsBonusAction: boolean
  countsTowardAttackAction: boolean
  attackMode: 'normal' | 'advantage' | 'disadvantage'
  classDamageContext: Dnd5eWeaponClassDamageContext
  stunningStrike?: {
    saveDc: number
    saveModifier: number
    saveMode: 'normal' | 'disadvantage'
    blessed: boolean
    baned: boolean
  }
  tranquilityWard?: ReturnType<typeof dnd5eTranquilityWardCheck>
  foeSlayerAttackBonus: number
  offHandAttack: boolean
  blessed: boolean
  baned: boolean
}

export function prepareDnd5eEquipmentAttack(input: {
  action: SharedPlayerActionState
  /** Trusted DM-host ruling supplied after the player request reaches authority. */
  dmCoverOverride?: Dnd5eAttackCoverSnapshot['cover']
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  attacksUsed: number
  attackActionsAvailable?: number
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
}): { ok: true; prepared: PreparedDnd5eEquipmentAttack } | { ok: false; reason: Dnd5eEquipmentAttackRejectReason } {
  const { action } = input
  if (action.type !== 'dnd5e-weapon-attack' || !action.targetTokenId) return { ok: false, reason: 'invalid-action' }
  const requestedCoverOverride = action.dnd5eWeaponAttackOptions?.coverOverride
  if (requestedCoverOverride != null && action.sourceMode !== 'dm') return { ok: false, reason: 'invalid-action' }
  const coverOverride = input.dmCoverOverride ?? requestedCoverOverride
  const actor = input.characters.find((character) => character.id === action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === action.actorTokenId && token.characterId === action.characterId)
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  if (!dnd5eClassDefinitionForCharacter(actor)) return { ok: false, reason: 'not-dnd5e-class' }
  const targetToken = input.map.tokens.find((token) => token.id === action.targetTokenId)
  if (!targetToken || targetToken.id === actorToken.id || targetToken.type === 'obstacle') return { ok: false, reason: 'invalid-target' }
  const offHandAttack = action.dnd5eWeaponAttackOptions?.offHandAttack === true
  const profile = offHandAttack ? dnd5eOffHandWeaponAttackProfile(actor) : dnd5eWeaponAttackProfile(actor)
  if (!profile) return { ok: false, reason: 'no-weapon' }
  if (
    offHandAttack && (
      input.attacksUsed < 1 || (input.turnEconomy?.bonusAction.current ?? 1) < 1 ||
      action.dnd5eWeaponAttackOptions?.frenzyAttack || action.dnd5eWeaponAttackOptions?.hordeBreakerAttack
    )
  ) return { ok: false, reason: 'off-hand-attack-unavailable' }
  const distanceFeet = tokenFootprintDistanceCells(actorToken, targetToken, input.map) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  if (distanceFeet > dnd5eWeaponRangeFeet(profile)) return { ok: false, reason: 'target-out-of-range' }
  const divineSmiteSlotLevel = action.dnd5eWeaponAttackOptions?.divineSmiteSlotLevel
  if (divineSmiteSlotLevel != null) {
    const slot = actor.classResources?.[`dnd5e-spell-slot-${divineSmiteSlotLevel}`]
    if (
      actor.charClass !== '圣武士' || actor.level < 2 || profile.mode !== 'melee' ||
      !Number.isInteger(divineSmiteSlotLevel) || divineSmiteSlotLevel < 1 || divineSmiteSlotLevel > 9 ||
      !slot || slot.current < 1
    ) return { ok: false, reason: 'divine-smite-unavailable' }
  }
  const turnSlotId = input.initiativeOrder[action.initiativeIndex]?.slotId
  const turnKey = `${action.combatId ?? `map-${input.map.id}`}:${Math.max(1, action.round)}:${turnSlotId ?? actorToken.id}`
  const recklessAlreadyActive = actor.dnd5eCombatState?.recklessAttackTurnKey === turnKey
  const recklessAttack = action.dnd5eWeaponAttackOptions?.recklessAttack === true
  if (
    recklessAttack && (
      actor.charClass !== '野蛮人' || actor.level < 2 || profile.mode !== 'melee' || profile.attackAbility !== 'str' ||
      input.attacksUsed !== 0
    )
  ) return { ok: false, reason: 'reckless-attack-unavailable' }
  const frenzyAttack = action.dnd5eWeaponAttackOptions?.frenzyAttack === true
  const barbarianSubclass = actor.dnd5eClassChoices?.classes?.barbarian?.subclass
  if (
    frenzyAttack && (
      actor.charClass !== '野蛮人' || barbarianSubclass !== 'berserker' || actor.level < 3 ||
      actor.dnd5eCombatState?.raging !== true || actor.dnd5eCombatState?.frenzying !== true ||
      actor.dnd5eCombatState?.frenzyStartedTurnKey === turnKey || profile.mode !== 'melee' ||
      (input.turnEconomy?.bonusAction.current ?? 1) < 1
    )
  ) return { ok: false, reason: 'frenzy-attack-unavailable' }
  const hordeBreakerAttack = action.dnd5eWeaponAttackOptions?.hordeBreakerAttack === true
  const rangerChoices = actor.dnd5eClassChoices?.classes?.ranger
  const hordeBreakerSelected = actor.charClass === '游侠' && actor.level >= 3 && rangerChoices?.subclass === 'hunter' &&
    rangerChoices.selections?.['hunters-prey']?.includes('horde-breaker') === true
  const hordeSourceToken = actor.dnd5eCombatState?.hordeBreakerSourceTargetId
    ? input.map.tokens.find((token) => token.id === actor.dnd5eCombatState?.hordeBreakerSourceTargetId)
    : undefined
  if (
    hordeBreakerAttack && (
      frenzyAttack || !hordeBreakerSelected || actor.dnd5eCombatState?.hordeBreakerOpportunityTurnKey !== turnKey ||
      actor.dnd5eCombatState?.hordeBreakerUsedTurnKey === turnKey || !hordeSourceToken ||
      hordeSourceToken.id === targetToken.id || !areOpposedCombatTokens(actorToken, hordeSourceToken) ||
      !areOpposedCombatTokens(actorToken, targetToken) ||
      tokenFootprintDistanceCells(hordeSourceToken, targetToken, input.map) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) > 5
    )
  ) return { ok: false, reason: 'horde-breaker-unavailable' }
  const stunningStrike = action.dnd5eWeaponAttackOptions?.stunningStrike === true
  if (
    stunningStrike && (
      actor.charClass !== '武僧' || actor.level < 5 || profile.mode !== 'melee' ||
      (actor.classResources?.['dnd5e-ki']?.current ?? 0) < 1
    )
  ) return { ok: false, reason: 'stunning-strike-unavailable' }
  const foeSlayer = action.dnd5eWeaponAttackOptions?.foeSlayer
  const specialAttack = frenzyAttack || hordeBreakerAttack || offHandAttack
  const attacksPerAction = dnd5eAttacksPerAttackAction(actor)
  const attacksAllowed = specialAttack ? 1 : attacksPerAction * Math.max(1, Math.floor(input.attackActionsAvailable ?? 1))
  if (!specialAttack && input.attacksUsed >= attacksAllowed) return { ok: false, reason: 'attack-action-spent' }
  const spendsAction = !specialAttack && input.attacksUsed % attacksPerAction === 0
  if (!specialAttack && spendsAction && input.turnEconomy && input.turnEconomy.action.current < 1) {
    return { ok: false, reason: 'attack-action-spent' }
  }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: action.combatId ?? `map-${input.map.id}`,
    round: action.round,
    turnSlotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const target = snapshot.state.combatants[targetToken.id]
  if (actorIndex < 0 || !snapshot.state.combatants[actorToken.id] || !target) return { ok: false, reason: 'combatant-missing' }
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (coverOverride != null) {
    applyDnd5eAttackCoverOverride(snapshot.state, actorToken.id, targetToken.id, coverOverride)
  }
  const effectiveCover = dnd5eAttackCoverForPair(snapshot.state, actorToken.id, targetToken.id)
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
  const foeSlayerAttackBonus = foeSlayer
    ? Math.max(0, rules.abilityModifier(actorCombatant.abilities.wis))
    : 0
  if (
    foeSlayer && (
      actor.charClass !== '游侠' || actor.level < 20 || foeSlayerAttackBonus <= 0 ||
      actorCombatant.classState.foeSlayerTurnKey === turnKey || !dnd5eIsFavoredEnemy(actorCombatant, target)
    )
  ) return { ok: false, reason: 'foe-slayer-unavailable' }
  if (input.turnEconomy) {
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
    }
  }
  const adjacentEnemyOfTarget = input.map.tokens.some((token) => {
    if (token.id === actorToken.id || token.id === targetToken.id || !areOpposedCombatTokens(token, targetToken)) return false
    const combatant = snapshot.state.combatants[token.id]
    return !!combatant && combatant.currentHp > 0 && tokenFootprintDistanceCells(token, targetToken, input.map) *
      Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) <= 5
  })
  const classDamageContext: Dnd5eWeaponClassDamageContext = {
    mode: profile.mode,
    distanceFeet,
    normalRangeFeet: profile.rangeFeet?.normal,
    longRangeFeet: profile.rangeFeet?.long,
    finesse: profile.finesse,
    strengthBased: profile.attackAbility === 'str',
    monkMartialArtsEligible: dnd5eMonkMartialArtsEligible(actor),
    weaponDamageSides: profile.damage.sides,
    damageType: profile.damage.type,
    adjacentEnemyOfTarget,
    divineSmiteSlotLevel,
    recklessAttack,
    frenzyAttack,
    twoWeaponBonusAttack: offHandAttack,
    hordeBreakerEligible: hordeBreakerSelected,
    hordeBreakerAttack,
    stunningStrike,
    foeSlayer,
  }
  const actorProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const targetProne = target.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const attackerHasAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
    (dnd5eTargetGrantsAttackAdvantage(target) || dnd5eHelpAttackApplies(snapshot.state, actorCombatant, target) || actorCombatant.classState.hiddenCheckTotal != null || recklessAttack || recklessAlreadyActive || !!target.classState.stunnedByActorId ||
      dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id) || (targetProne && distanceFeet <= 5))
  const attackerHasDisadvantage = (actor.exhaustionLevel ?? 0) >= 3 ||
    dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant) ||
    dnd5eFrightenedAttackDisadvantage(snapshot.state, actorCombatant) || actorProne || (targetProne && distanceFeet > 5) ||
    (profile.mode === 'ranged' && (
      distanceFeet > (profile.rangeFeet?.normal ?? 0) ||
      input.map.tokens.some((candidate) => {
        const candidateCombatant = snapshot.state.combatants[candidate.id]
        return candidate.id !== actorToken.id && candidate.type !== 'obstacle' &&
          areOpposedCombatTokens(actorToken, candidate) &&
          dnd5eMapTokenCanThreatenRangedAttacker(actorCombatant, candidate, candidateCombatant) &&
          tokenFootprintDistanceCells(actorToken, candidate, input.map) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) <= 5
      })
    ))
  const targetImposesDisadvantage = dnd5eTargetIsDodging(target) || attackerHasDisadvantage ||
    dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id)
  const attackMode = resolveDnd5eRollMode({
    advantage: [{ active: attackerHasAdvantage, reason: 'equipment-attack-advantage' }],
    disadvantage: [{ active: targetImposesDisadvantage, reason: 'equipment-attack-disadvantage' }],
  }).mode
  const stunningStrikeResolution = stunningStrike
    ? {
        saveDc: 8 + rules.proficiencyBonus(actor.level) + rules.abilityModifier(actor.abilities.wis),
        saveModifier: target.savingThrowBonuses.con ?? rules.abilityModifier(target.abilities.con),
        saveMode: target.exhaustionLevel >= 3 ? 'disadvantage' as const : 'normal' as const,
      }
    : undefined
  return {
    ok: true,
    prepared: {
      action,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      actorToken,
      targetToken,
      profile,
      targetArmorClass: dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, targetToken.id),
      cover: { ...effectiveCover, overriddenByDm: coverOverride != null },
      distanceFeet,
      attackNumber: specialAttack ? 1 : input.attacksUsed + 1,
      attacksAllowed,
      spendsAction,
      spendsBonusAction: frenzyAttack || offHandAttack,
      countsTowardAttackAction: !specialAttack,
      attackMode,
      classDamageContext,
      stunningStrike: stunningStrikeResolution ? {
        ...stunningStrikeResolution,
        blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, target.id, 'bless'),
        baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, target.id, 'bane'),
      } : undefined,
      tranquilityWard: dnd5eTranquilityWardCheck(actorCombatant, target, snapshot.state),
      foeSlayerAttackBonus: foeSlayer === 'attack' ? foeSlayerAttackBonus : 0,
      offHandAttack,
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
    },
  }
}

export function dnd5eAttackModeWithProtection(
  mode: PreparedDnd5eEquipmentAttack['attackMode'],
  protectedAttack: boolean,
): PreparedDnd5eEquipmentAttack['attackMode'] {
  return protectedAttack ? imposeDnd5eRollDisadvantage(mode, 'protection').mode : mode
}

export function previewDnd5eEquipmentAttack(
  prepared: PreparedDnd5eEquipmentAttack,
  d20: number,
  d20Second?: number,
  protectedAttack = false,
  blessRoll?: number,
  baneRoll?: number,
) {
  const mode = dnd5eAttackModeWithProtection(prepared.attackMode, protectedAttack)
  const rolls = mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const resolved = rules.resolveAttack({
    rolls,
    mode,
    modifier: prepared.profile.attackModifier + prepared.foeSlayerAttackBonus + (blessRoll ?? 0) - (baneRoll ?? 0),
    targetAc: prepared.targetArmorClass,
  })
  return resolveDnd5eAttackOutcome({
    attack: resolved,
    criticalThreshold: prepared.profile.criticalThreshold,
    automaticCritical: dnd5eConditionHitIsAutomaticCritical({
      target: prepared.state.combatants[prepared.targetToken.id],
      distanceFeet: prepared.distanceFeet,
    }),
  })
}

export function dnd5eEquipmentClassDamageDefinitions(
  prepared: PreparedDnd5eEquipmentAttack,
  critical: boolean,
  protectedAttack = false,
): readonly Dnd5eClassDamageDefinition[] {
  return dnd5eWeaponClassDamageDefinitions({
    state: prepared.state,
    actorId: prepared.actorToken.id,
    targetId: prepared.targetToken.id,
    context: prepared.classDamageContext,
    effectiveMode: dnd5eAttackModeWithProtection(prepared.attackMode, protectedAttack),
    critical,
  })
}

export function resolvePreparedDnd5eEquipmentAttack(input: {
  prepared: PreparedDnd5eEquipmentAttack
  d20: number
  d20Second?: number
  blessRoll?: number
  baneRoll?: number
  bardicInspirationRoll?: number
  strokeOfLuck?: boolean
  cuttingWords?: Dnd5eCuttingWordsUse
  cuttingWordsDamage?: Dnd5eCuttingWordsUse
  protectionReactionActorId?: string
  tranquilitySave?: Dnd5eTranquilitySaveRoll
  shieldSpellReaction?: boolean
  uncannyDodge?: boolean
  deflectMissilesD10?: number
  stunningStrikeSaveD20?: number
  stunningStrikeSaveD20Second?: number
  stunningStrikeSaveBlessRoll?: number
  stunningStrikeSaveBaneRoll?: number
  stunningStrikeSaveRerollD20?: number
  stunningStrikeSaveRerollD20Second?: number
  stunningStrikeBardicInspirationRoll?: number
  stunningStrikeDarkOnesOwnLuckRoll?: number
  hurlThroughHellDamageRolls?: readonly number[]
  standAgainstTide?: Dnd5eStandAgainstTideUse
  damageRolls: readonly number[]
  classDamageRolls?: readonly Dnd5eClassDamageRolls[]
  transaction?: CombatTransaction
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'attack',
    actorId: prepared.actorToken.id,
    targetId: prepared.targetToken.id,
    attackModifier: prepared.profile.attackModifier,
    criticalThreshold: prepared.profile.criticalThreshold,
    spendAction: prepared.spendsAction,
    spendBonusAction: prepared.spendsBonusAction,
    d20: input.d20,
    d20Second: input.d20Second,
    blessRoll: input.blessRoll,
    baneRoll: input.baneRoll,
    bardicInspirationRoll: input.bardicInspirationRoll,
    strokeOfLuck: input.strokeOfLuck,
    cuttingWords: input.cuttingWords,
    cuttingWordsDamage: input.cuttingWordsDamage,
    protectionReactionActorId: input.protectionReactionActorId,
    tranquilitySave: input.tranquilitySave,
    shieldSpellReaction: input.shieldSpellReaction,
    uncannyDodge: input.uncannyDodge,
    deflectMissilesD10: input.deflectMissilesD10,
    stunningStrikeSaveD20: input.stunningStrikeSaveD20,
    stunningStrikeSaveD20Second: input.stunningStrikeSaveD20Second,
    stunningStrikeSaveBlessRoll: input.stunningStrikeSaveBlessRoll,
    stunningStrikeSaveBaneRoll: input.stunningStrikeSaveBaneRoll,
    stunningStrikeSaveRerollD20: input.stunningStrikeSaveRerollD20,
    stunningStrikeSaveRerollD20Second: input.stunningStrikeSaveRerollD20Second,
    stunningStrikeBardicInspirationRoll: input.stunningStrikeBardicInspirationRoll,
    stunningStrikeDarkOnesOwnLuckRoll: input.stunningStrikeDarkOnesOwnLuckRoll,
    hurlThroughHellDamageRolls: input.hurlThroughHellDamageRolls,
    standAgainstTide: input.standAgainstTide,
    mode: prepared.attackMode,
    classDamageContext: prepared.classDamageContext,
    classDamageRolls: input.classDamageRolls,
    damage: {
      count: prepared.profile.damage.count,
      sides: prepared.profile.damage.sides,
      bonus: prepared.profile.damage.bonus,
      rolls: input.damageRolls,
      type: prepared.profile.damage.type,
    },
  }, { transaction: input.transaction })
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
