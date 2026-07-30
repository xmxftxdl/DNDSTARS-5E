import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { Dnd5eSpellCastPayload, Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import {
  appendRollLedgerEntry,
  commitCombatTransaction,
  createCombatTransaction,
  rollbackCombatTransaction,
  type CombatTransaction,
} from '../../lib/combatTransaction'
import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from '../../lib/gridCombat'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { D20RollMode } from '../contracts'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eClassDefinition, dnd5ePactSlotLevel, type Dnd5eClassId } from './classes'
import { dnd5eAttackerIsUnseenForAttack, dnd5eBlurImposesAttackDisadvantage, dnd5eDirectedCombatantPairKey, dnd5eTargetArmorClassForAttack, dnd5eTargetIsUnseenForAttack, resolveDnd5eHeadlessAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5ePreventsAttackAdvantage, dnd5eSavingThrowMode, dnd5eTargetGrantsAttackAdvantage, dnd5eTargetIsDodging } from './passiveDefenses'
import { dnd5eConditionSavingThrowAutomaticallyFails } from './conditions'
import { resolveDnd5eRollMode } from './rollMode'
import {
  dnd5ePluginHeadlessActionDefinition,
  dnd5ePluginSpellDefinition,
  missingDnd5eRulesPluginRequirements,
  type RegisteredDnd5ePluginSpell,
} from './pluginApi'
import { dnd5eSpellcastingClassIdForSpell } from './spells'
import type { Dnd5eSpellConditionDuration, Dnd5eSpellMechanicsDefinition } from './spellMechanics'
import { dnd5eCharacterClassLevel } from './multiclass'
import { dnd5eWearingUnproficientArmor } from './equipment'
import { resolveDnd5eDamageDefenses } from './damageDefenses'
import { dnd5eLimitedMagicImmunityNegatesSpell } from './monsterGenericAbilities'
import {
  dnd5eSpellComponentCheck,
  dnd5eSpellComponentsAvailable,
  type Dnd5eSpellComponentCheck,
} from './spellComponents'

export type Dnd5ePluginSpellRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'plugin-missing'
  | 'room-rules-unavailable'
  | 'plugin-not-enabled-for-room'
  | 'plugin-version-mismatch'
  | 'spell-unavailable'
  | 'spell-not-known-or-prepared'
  | 'spellcasting-class-unavailable'
  | 'wild-shape-spellcasting-unavailable'
  | 'armor-proficiency-required'
  | 'spell-not-headless'
  | 'component-unavailable'
  | 'invalid-target'
  | 'target-out-of-range'
  | 'effect-line-blocked'
  | 'slot-unavailable'
  | 'action-unavailable'
  | 'bonus-action-unavailable'
  | 'combatant-missing'
  | 'invalid-dice'

export type Dnd5ePluginSpellComponentCheck = Dnd5eSpellComponentCheck

export interface PreparedDnd5ePluginSpellCast {
  action: SharedPlayerActionState
  payload: Dnd5eSpellCastPayload
  spell: RegisteredDnd5ePluginSpell
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  castingClassId: Dnd5eClassId
  castingClassLevel: number
  actorToken: Token
  targetToken: Token
  slotLevel: number
  castingTime: 'action' | 'bonus-action'
  componentCheck: Dnd5ePluginSpellComponentCheck
  attackModifier: number
  attackMode: D20RollMode
  saveDc: number
  saveModifier?: number
  saveMode?: D20RollMode
  saveAutomaticallyFails: boolean
  targetArmorClass: number
  damageDice: { count: number; sides: number; bonus: number }
  concentrationRounds?: number
  transaction: CombatTransaction
}

export interface Dnd5ePluginSpellResolutionRolls {
  attackD20?: number
  attackD20Second?: number
  savingThrowD20?: number
  savingThrowD20Second?: number
  damageRolls?: number[]
}

export interface Dnd5ePluginSpellResolution {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  transaction: CombatTransaction
  attackHit?: boolean
  critical?: boolean
  saveSucceeded?: boolean
  rawDamage?: number
  finalDamage?: number
}

/** 当前 Host 事务真正覆盖的插件法术子集；超出能力的声明必须回落到 DM 裁定。 */
export type SupportedDnd5ePluginSpell = RegisteredDnd5ePluginSpell & {
  automation: { mode: 'headless-action'; actionId: string }
  mechanics: Dnd5eSpellMechanicsDefinition
}

export function dnd5ePluginSpellAutomationSupported(spell: RegisteredDnd5ePluginSpell | undefined): spell is SupportedDnd5ePluginSpell {
  if (
    !spell || spell.automation.mode !== 'headless-action' || !spell.mechanics ||
    spell.mechanics.resolution === 'dm-adjudication' ||
    !dnd5ePluginHeadlessActionDefinition(spell.ownerPluginId, spell.automation.actionId)
  ) return false
  const unsupportedUpcast = spell.mechanics.upcast?.effects.some((effect) =>
    effect.kind !== 'damage-dice' && effect.kind !== 'flat-damage',
  ) === true
  return spell.mechanics.kind !== 'healing' &&
    (!!spell.mechanics.damage || !!spell.mechanics.conditions?.length) &&
    spell.range.shape == null && spell.range.sizeFeet == null &&
    ['self', 'touch', 'distance', 'sight'].includes(spell.range.type) &&
    !unsupportedUpcast
}

export function prepareDnd5ePluginSpellCast(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
  roomRequiredPlugins?: readonly { id: string; version: string; integrity?: string }[] | null
  now?: number
}): { ok: true; prepared: PreparedDnd5ePluginSpellCast } | { ok: false; reason: Dnd5ePluginSpellRejectReason } {
  const payload = input.action.dnd5eSpellCast
  if (input.action.type !== 'dnd5e-spell-cast' || !payload) return { ok: false, reason: 'invalid-action' }
  const spell = dnd5ePluginSpellDefinition(payload.spellId)
  if (!spell) return { ok: false, reason: 'plugin-missing' }
  if (!dnd5ePluginSpellAutomationSupported(spell)) return { ok: false, reason: 'spell-not-headless' }
  if (input.roomRequiredPlugins === null) return { ok: false, reason: 'room-rules-unavailable' }
  if (input.roomRequiredPlugins) {
    const requirement = input.roomRequiredPlugins.find((plugin) => plugin.id === spell.ownerPluginId)
    if (!requirement) return { ok: false, reason: 'plugin-not-enabled-for-room' }
    if (missingDnd5eRulesPluginRequirements([requirement]).length > 0) return { ok: false, reason: 'plugin-version-mismatch' }
  }
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === input.action.actorTokenId && token.characterId === input.action.characterId)
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  if (dnd5eWearingUnproficientArmor(actor)) {
    return { ok: false, reason: 'armor-proficiency-required' }
  }
  const castingClassId = dnd5eSpellcastingClassIdForSpell(actor, spell.id, payload.castingClassId, spell.classes)
  if (!castingClassId) return { ok: false, reason: 'spell-not-known-or-prepared' }
  const classDefinition = castingClassId ? dnd5eClassDefinition(castingClassId) : undefined
  const castingClassLevel = castingClassId ? dnd5eCharacterClassLevel(actor, castingClassId) : 0
  if (!classDefinition?.spellcasting || castingClassLevel < 1) {
    return { ok: false, reason: 'spellcasting-class-unavailable' }
  }
  if (actor.dnd5eCombatState?.wildShapeFormId && (classDefinition.id !== 'druid' || castingClassLevel < 18)) {
    return { ok: false, reason: 'wild-shape-spellcasting-unavailable' }
  }
  if (spell.castingTime.value !== 1 || !['action', 'bonus-action'].includes(spell.castingTime.unit)) {
    return { ok: false, reason: 'invalid-action' }
  }
  const castingTime = spell.castingTime.unit as 'action' | 'bonus-action'
  if (castingTime === 'action' && input.turnEconomy && input.turnEconomy.action.current < 1) return { ok: false, reason: 'action-unavailable' }
  if (castingTime === 'bonus-action' && input.turnEconomy && input.turnEconomy.bonusAction.current < 1) return { ok: false, reason: 'bonus-action-unavailable' }

  const componentCheck = dnd5ePluginSpellComponentCheck(actor, spell, castingClassId)
  if (!dnd5eSpellComponentsAvailable(componentCheck)) return { ok: false, reason: 'component-unavailable' }

  const requestedSlot = Math.floor(payload.slotLevel)
  const slotLevel = spell.level === 0
    ? 0
    : classDefinition.spellcasting.kind === 'pact' && spell.level <= 5
      ? dnd5ePactSlotLevel(castingClassLevel)
      : requestedSlot
  if (!Number.isInteger(requestedSlot) || requestedSlot < 0 || requestedSlot > 9 || slotLevel < spell.level) {
    return { ok: false, reason: 'slot-unavailable' }
  }
  if (spell.level > 0) {
    const resourceKey = classDefinition.spellcasting.kind === 'pact' && spell.level <= 5
      ? 'dnd5e-pact-slot'
      : `dnd5e-spell-slot-${slotLevel}`
    if ((actor.classResources?.[resourceKey]?.current ?? 0) < 1) return { ok: false, reason: 'slot-unavailable' }
  }

  const targetToken = spell.range.type === 'self'
    ? actorToken
    : input.map.tokens.find((token) => token.id === (payload.targetTokenId || input.action.targetTokenId))
  if (!targetToken || targetToken.type === 'obstacle') return { ok: false, reason: 'invalid-target' }
  const distanceFeet = tokenFootprintDistanceCells(actorToken, targetToken, input.map) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  const maximumRange = spell.range.type === 'self' ? 0 : spell.range.type === 'touch' ? 5 : spell.range.type === 'distance' ? (spell.range.feet ?? 0) : Number.POSITIVE_INFINITY
  if (distanceFeet > maximumRange) return { ok: false, reason: 'target-out-of-range' }

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
  const targetCombatant = snapshot.state.combatants[targetToken.id]
  if (actorIndex < 0 || !actorCombatant || !targetCombatant) return { ok: false, reason: 'combatant-missing' }
  const directedPairKey = dnd5eDirectedCombatantPairKey(actorToken.id, targetToken.id)
  if (snapshot.state.lineOfEffectBlockedByCombatantPair?.[directedPairKey]) {
    return { ok: false, reason: 'effect-line-blocked' }
  }
  for (const [tokenId, economy] of Object.entries(input.turnEconomyByToken ?? {})) {
    const combatant = snapshot.state.combatants[tokenId]
    if (!combatant) continue
    combatant.turn = { ...combatant.turn, actionAvailable: economy.action.current > 0, bonusActionAvailable: economy.bonusAction.current > 0, reactionAvailable: economy.reaction.current > 0, movementRemaining: economy.movement.current }
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
  const damage = spell.mechanics.damage
  const upcastDelta = Math.max(0, slotLevel - (spell.mechanics.upcast?.fromSlotLevel ?? spell.level))
  const upcastDice = spell.mechanics.upcast?.effects.reduce((total, effect) => effect.kind === 'damage-dice' ? total + effect.diceCountPerSlot * upcastDelta : total, 0) ?? 0
  const upcastFlat = spell.mechanics.upcast?.effects.reduce((total, effect) => effect.kind === 'flat-damage' ? total + effect.amountPerSlot * upcastDelta : total, 0) ?? 0
  const cantripMultiplier = damage?.cantripScaling
    ? actor.level >= 17 ? 4 : actor.level >= 11 ? 3 : actor.level >= 5 ? 2 : 1
    : 1
  const castingModifier = damage?.addSpellcastingModifier
    ? rules.abilityModifier(actor.abilities[classDefinition.spellcasting.ability])
    : 0
  const spellSaveDc = 8 + rules.proficiencyBonus(actor.level) +
    rules.abilityModifier(actor.abilities[classDefinition.spellcasting.ability])
  const saveAbility = spell.mechanics.savingThrow?.ability
  const saveModifier = saveAbility
    ? (targetCombatant.savingThrowBonuses[saveAbility] ?? rules.abilityModifier(targetCombatant.abilities[saveAbility])) +
      (saveAbility === 'dex' && spell.id !== 'sacred-flame' ? snapshot.state.coverBonusByCombatantPair?.[directedPairKey] ?? 0 : 0)
    : undefined
  const actorProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const targetProne = targetCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const attackAdvantage = !dnd5ePreventsAttackAdvantage(targetCombatant) && (
    dnd5eTargetGrantsAttackAdvantage(targetCombatant) || actorCombatant.classState.hiddenCheckTotal != null ||
    !!targetCombatant.classState.recklessAttackTurnKey || !!targetCombatant.classState.stunnedByActorId ||
    dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id) || (targetProne && distanceFeet <= 5)
  )
  const attackDisadvantage = actorCombatant.exhaustionLevel >= 3 || dnd5eTargetIsDodging(targetCombatant) ||
    dnd5eBlurImposesAttackDisadvantage(snapshot.state, actorToken.id, targetToken.id) ||
    dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant) ||
    dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id) || actorProne ||
    (targetProne && distanceFeet > 5)
  const attackMode: D20RollMode = resolveDnd5eRollMode({
    advantage: [{ active: attackAdvantage, reason: 'plugin-spell-attack-advantage' }],
    disadvantage: [{ active: attackDisadvantage, reason: 'plugin-spell-attack-disadvantage' }],
  }).mode
  const saveMode = saveAbility
    ? dnd5eSavingThrowMode(targetCombatant, saveAbility, {
        effectVisible: true,
        sourceCreatureType: actorCombatant.creatureType,
        sourceIsSpell: true,
      })
    : undefined
  const concentrationRounds = spell.duration.concentration ? spellDurationRounds(spell) : undefined
  const now = input.now ?? Date.now()
  return {
    ok: true,
    prepared: {
      action: input.action,
      payload,
      spell,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      castingClassId,
      castingClassLevel,
      actorToken,
      targetToken,
      slotLevel,
      castingTime,
      componentCheck,
      attackModifier: spellSaveDc - 8,
      attackMode,
      saveDc: spellSaveDc,
      saveModifier,
      saveMode,
      saveAutomaticallyFails: saveAbility ? dnd5eConditionSavingThrowAutomaticallyFails(targetCombatant, saveAbility) : false,
      targetArmorClass: dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, targetToken.id),
      damageDice: { count: Math.max(0, (damage?.dice.count ?? 0) * cantripMultiplier + upcastDice), sides: damage?.dice.sides ?? 2, bonus: (damage?.dice.bonus ?? 0) + upcastFlat + castingModifier },
      concentrationRounds,
      transaction: createCombatTransaction({ id: input.action.id, mapId: input.map.id, combatId: input.action.combatId, actorId: actor.id, actionId: input.action.id, actionKind: 'plugin-spell', now }),
    },
  }
}

export function resolvePreparedDnd5ePluginSpellCast(input: {
  prepared: PreparedDnd5ePluginSpellCast
  rolls: Dnd5ePluginSpellResolutionRolls
  now?: number
}): Dnd5ePluginSpellResolution {
  const { prepared, rolls: supplied } = input
  const mechanics = prepared.spell.mechanics!
  const now = input.now ?? Date.now()
  let transaction = prepared.transaction
  let attackHit: boolean | undefined
  let critical = false
  let saveSucceeded: boolean | undefined
  if (mechanics.resolution === 'spell-attack') {
    if (!validD20Pair(supplied.attackD20, supplied.attackD20Second, prepared.attackMode)) return invalidDice(prepared, transaction, now)
    const attackD20 = selectedD20(supplied.attackD20!, supplied.attackD20Second, prepared.attackMode)
    transaction = appendRollLedgerEntry(transaction, {
      id: `${prepared.action.id}:spell-attack`, kind: 'attack', label: `${prepared.spell.name}·法术攻击`,
      dice: { sides: 20, values: prepared.attackMode === 'normal' ? [supplied.attackD20!] : [supplied.attackD20!, supplied.attackD20Second!] }, modifier: prepared.attackModifier, visibility: 'public',
      sourceId: prepared.actor.id, targetId: prepared.targetToken.id, createdAt: now,
    })
    critical = attackD20 === 20
    attackHit = critical || (attackD20 !== 1 && attackD20 + prepared.attackModifier >= prepared.targetArmorClass)
  } else if (mechanics.resolution === 'saving-throw') {
    if (!prepared.saveMode || !validD20Pair(supplied.savingThrowD20, supplied.savingThrowD20Second, prepared.saveMode) || prepared.saveModifier == null) return invalidDice(prepared, transaction, now)
    const savingThrowD20 = selectedD20(supplied.savingThrowD20!, supplied.savingThrowD20Second, prepared.saveMode)
    transaction = appendRollLedgerEntry(transaction, {
      id: `${prepared.action.id}:saving-throw`, kind: 'saving-throw', label: `${prepared.spell.name}·豁免`,
      dice: { sides: 20, values: prepared.saveMode === 'normal' ? [supplied.savingThrowD20!] : [supplied.savingThrowD20!, supplied.savingThrowD20Second!] }, modifier: prepared.saveModifier, visibility: 'public',
      sourceId: prepared.targetToken.id, targetId: prepared.actor.id, createdAt: now,
    })
    saveSucceeded = !prepared.saveAutomaticallyFails && savingThrowD20 + prepared.saveModifier >= prepared.saveDc
  }

  let rawDamage = 0
  let finalDamage = 0
  const sourceCombatant = prepared.state.combatants[prepared.actorToken.id]
  const targetCombatant = prepared.state.combatants[prepared.targetToken.id]
  const targetWilling = sourceCombatant.controller === targetCombatant.controller
  const spellNegated = dnd5eLimitedMagicImmunityNegatesSpell({
    rule: targetCombatant.limitedMagicImmunity,
    spellLevel: prepared.slotLevel,
    target: targetWilling ? 'ally' : 'hostile',
    willing: targetWilling,
  })
  const shouldDealDamage = !!mechanics.damage && (mechanics.resolution !== 'spell-attack' || attackHit)
  if (shouldDealDamage) {
    const count = prepared.damageDice.count * (critical ? 2 : 1)
    const values = supplied.damageRolls ?? []
    if (values.length !== count || values.some((value) => !validDie(value, prepared.damageDice.sides))) {
      return invalidDice(prepared, transaction, now)
    }
    transaction = appendRollLedgerEntry(transaction, {
      id: `${prepared.action.id}:damage`, kind: 'damage', label: `${prepared.spell.name}·伤害`,
      dice: { sides: prepared.damageDice.sides, values }, modifier: prepared.damageDice.bonus, visibility: 'public',
      sourceId: prepared.actor.id, targetId: prepared.targetToken.id, createdAt: now,
    })
    rawDamage = Math.max(0, values.reduce((total, value) => total + value, prepared.damageDice.bonus))
    if (saveSucceeded) {
      const onSuccess = mechanics.savingThrow?.onSuccess ?? 'none'
      rawDamage = onSuccess === 'half' ? Math.floor(rawDamage / 2) : onSuccess === 'full' ? rawDamage : 0
    }
    finalDamage = resolveDnd5eDamageDefenses({
      damage: rawDamage,
      source: {
        damageType: mechanics.damage!.type,
        delivery: 'spell',
        magical: true,
        spellLevel: prepared.slotLevel,
        sourceMoralAlignment: sourceCombatant.moralAlignment,
      },
      defenses: {
        immunities: targetCombatant.damageImmunities,
        resistances: targetCombatant.damageResistances,
        vulnerabilities: targetCombatant.damageVulnerabilities,
        damageDefenseRules: targetCombatant.damageDefenseRules,
      },
    }).finalDamage
    if (spellNegated) finalDamage = 0
  }

  const conditions = (mechanics.conditions ?? []).filter((condition) => {
    if (condition.trigger === 'always') return true
    if (condition.trigger === 'on-hit') return attackHit === true
    return saveSucceeded === false
  })
  const effects = [
    ...(mechanics.damage && (shouldDealDamage || mechanics.resolution === 'saving-throw')
      ? [{ targetId: prepared.targetToken.id, operation: 'damage' as const, amount: finalDamage }]
      : []),
    ...conditions.map((condition) => ({
      targetId: prepared.targetToken.id,
      addCondition: condition.condition,
      ...dnd5ePluginSpellConditionLifecycle(condition.duration, prepared.saveDc),
    })),
  ]
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'adjudicated-spell',
    actorId: prepared.actorToken.id,
    castingClassId: prepared.castingClassId,
    spellId: prepared.spell.id,
    spellName: prepared.spell.name,
    spellLevel: prepared.spell.level,
    slotLevel: prepared.slotLevel,
    castingTime: prepared.castingTime,
    effects,
    concentrationRounds: prepared.concentrationRounds,
  }, { transaction, now })
  transaction = result.transaction ?? (result.ok
    ? commitCombatTransaction(transaction, now)
    : rollbackCombatTransaction(transaction, result.reason, now))
  if (!result.ok) return { result, transaction, attackHit, critical, saveSucceeded, rawDamage, finalDamage }
  return {
    result,
    application: planDnd5eMapResultApplication({ state: result.state, map: prepared.map, characters: prepared.characters, characterIdByCombatantId: prepared.characterIdByCombatantId }),
    transaction,
    attackHit,
    critical,
    saveSucceeded,
    rawDamage,
    finalDamage,
  }
}

function dnd5ePluginSpellConditionLifecycle(
  duration: Dnd5eSpellConditionDuration,
  saveDc: number,
): Pick<import('./headlessCombatEngine').Dnd5eAdjudicatedSpellEffect, 'conditionDuration' | 'conditionRepeatSave'> {
  if (duration.kind === 'source-next-turn-start') {
    return { conditionDuration: { type: 'until-turn-boundary', boundary: 'source-turn-start' } }
  }
  if (duration.kind === 'target-next-turn-start') {
    return { conditionDuration: { type: 'until-turn-boundary', boundary: 'target-turn-start' } }
  }
  if (duration.kind === 'fixed-rounds') {
    return { conditionDuration: { type: 'rounds', remainingRounds: duration.rounds, tickOn: 'target-turn-end' } }
  }
  if (duration.kind === 'save-ends') {
    return {
      conditionDuration: { type: 'rounds', remainingRounds: duration.maximumRounds, tickOn: 'target-turn-end' },
      conditionRepeatSave: {
        ability: duration.saveAbility,
        dc: saveDc,
        timing: duration.timing,
        onSuccess: 'remove',
      },
    }
  }
  return {}
}

export function dnd5ePluginSpellComponentCheck(
  actor: Character,
  spell: RegisteredDnd5ePluginSpell,
  classId?: Dnd5eClassId,
): Dnd5ePluginSpellComponentCheck {
  return dnd5eSpellComponentCheck(actor, {
    verbal: spell.components.verbal,
    somatic: spell.components.somatic,
    material: spell.components.material,
    costlyMaterial: (spell.components.materialCostGp ?? 0) > 0,
    consumedMaterial: spell.components.materialConsumed === true,
  }, classId)
}

function invalidDice(prepared: PreparedDnd5ePluginSpellCast, transaction: CombatTransaction, now: number): Dnd5ePluginSpellResolution {
  return {
    result: { ok: false, state: prepared.state, events: [], reason: 'invalid-dice' },
    transaction: rollbackCombatTransaction(transaction, 'invalid-dice', now),
  }
}

function validDie(value: number | undefined, sides: number): boolean {
  return Number.isInteger(value) && value! >= 1 && value! <= sides
}

function validD20Pair(first: number | undefined, second: number | undefined, mode: D20RollMode): boolean {
  return validDie(first, 20) && (mode === 'normal' || validDie(second, 20))
}

function selectedD20(first: number, second: number | undefined, mode: D20RollMode): number {
  if (mode === 'normal' || second == null) return first
  return mode === 'advantage' ? Math.max(first, second) : Math.min(first, second)
}

function spellDurationRounds(spell: RegisteredDnd5ePluginSpell): number {
  if (spell.duration.type !== 'timed') return 10
  const value = Math.max(1, Math.floor(spell.duration.value ?? 1))
  const multiplier = spell.duration.unit === 'round' ? 1 : spell.duration.unit === 'minute' ? 10 : spell.duration.unit === 'hour' ? 600 : 14_400
  return Math.min(14_400, value * multiplier)
}
