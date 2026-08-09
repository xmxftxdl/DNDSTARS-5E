import { canBonusDieChangeFailure } from '../../lib/d20InterruptPolicy'
import type { BardicInspirationRollType } from '../../lib/combatInterruptProtocol'
import type { AbilityKey } from '../../lib/dnd'
import {
  dnd5eCombatantHasConcentrationEffect,
  dnd5eActiveSavingThrowBonus,
  dnd5eDarkOnesOwnLuckAvailable,
  dnd5eHeldBardicInspirationDie,
  dnd5eSavingThrowRerollFeature,
  previewDnd5eSavingThrowRoll,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
  type Dnd5eOptionalBonusDieUse,
} from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'

export interface Dnd5eD20RollInterruptContext {
  rollKind: 'attack' | 'ability-check' | 'saving-throw'
  rollerCharacterId?: string
  targetCharacterId?: string
  skipChoiceReroll?: boolean
}

export interface Dnd5eOptionalBonusDieInterruptRequest {
  target?: Character
  combatant: Dnd5eCombatant
  rollKind: 'ability-check' | 'saving-throw'
  rollType: BardicInspirationRollType
  originalD20: number
  total: number
  targetNumber: number
}

export interface Dnd5eSavingThrowInterruptResult {
  d20: number
  d20Second?: number
  halflingLuckyD20?: number
  halflingLuckyD20Second?: number
  blessRoll?: number
  baneRoll?: number
  bardicInspirationRoll?: number
  optionalBonusDieUse?: Dnd5eOptionalBonusDieUse
  darkOnesOwnLuckRoll?: number
  rerollD20?: number
  rerollD20Second?: number
  totalBeforeReroll: number
  successBeforeReroll: boolean
  success: boolean
}

export interface Dnd5eAbilityCheckInterruptResult {
  d20: number
  d20Second?: number
  halflingLuckyD20?: number
  halflingLuckyD20Second?: number
  bardicInspirationRoll?: number
  optionalBonusDieUse?: Dnd5eOptionalBonusDieUse
  additionalBonusDieRoll?: number
  darkOnesOwnLuckRoll?: number
  baseTotal: number
  total: number
}

type SavingThrowMode = 'normal' | 'advantage' | 'disadvantage'

/**
 * Ability-check companion to the saving-throw pipeline. The caller supplies a
 * Headless preview callback because skills, Reliable Talent and contextual
 * modifiers belong to the prepared check rather than this presentation layer.
 */
export async function resolveDnd5eAbilityCheckInterrupts(input: {
  combatant: Dnd5eCombatant
  target?: Character
  targetName: string
  dc: number
  mode: SavingThrowMode
  label: string
  previewTotal: (d20: number, d20Second?: number) => number | undefined
  rollD20: (
    label: string,
    targetName: string,
    context?: Dnd5eD20RollInterruptContext,
  ) => Promise<number>
  requestBardicInspiration?: (request: {
    target?: Character
    targetName: string
    dieSides: number
    rollType: BardicInspirationRollType
    total: number
    targetNumber: number
  }) => Promise<number | undefined>
  requestOptionalBonusDie?: (
    request: Dnd5eOptionalBonusDieInterruptRequest,
  ) => Promise<Dnd5eOptionalBonusDieUse | undefined>
  additionalBonusDieSides?: number
  requestAdditionalBonusDie?: (request: {
    total: number
    targetNumber: number
    dieSides: number
  }) => Promise<number | undefined>
  requestDarkOnesOwnLuck?: (request: {
    target?: Character
    targetName: string
    rollType: '豁免' | '属性检定'
    total: number
    targetNumber?: number
  }) => Promise<number | undefined>
}): Promise<Dnd5eAbilityCheckInterruptResult | undefined> {
  const rollerCharacterId = input.target?.id
  const sharedContext: Dnd5eD20RollInterruptContext = {
    rollKind: 'ability-check',
    rollerCharacterId,
    targetCharacterId: rollerCharacterId,
  }
  const d20 = await input.rollD20(input.label, input.targetName, sharedContext)
  const d20Second = input.mode === 'normal'
    ? undefined
    : await input.rollD20(
        `${input.label}（${input.mode === 'advantage' ? '优势' : '劣势'}）`,
        input.targetName,
        { ...sharedContext, skipChoiceReroll: true },
      )
  const halflingLuckyD20 = input.combatant.racialRules?.halflingLucky && d20 === 1
    ? await input.rollD20(
        '半身人幸运·属性检定重投',
        input.targetName,
        { ...sharedContext, skipChoiceReroll: true },
      )
    : undefined
  const halflingLuckyD20Second = input.combatant.racialRules?.halflingLucky && d20Second === 1
    ? await input.rollD20(
        '半身人幸运·属性检定重投',
        input.targetName,
        { ...sharedContext, skipChoiceReroll: true },
      )
    : undefined
  const baseTotal = input.previewTotal(
    halflingLuckyD20 ?? d20,
    halflingLuckyD20Second ?? d20Second,
  )
  if (baseTotal == null) return undefined

  let runningTotal = baseTotal
  const inspirationDie = dnd5eHeldBardicInspirationDie(input.combatant)
  const bardicInspirationRoll = input.requestBardicInspiration && canBonusDieChangeFailure({
    success: runningTotal >= input.dc,
    currentTotal: runningTotal,
    targetNumber: input.dc,
    dieSides: inspirationDie,
  })
    ? await input.requestBardicInspiration({
        target: input.target,
        targetName: input.targetName,
        dieSides: inspirationDie!,
        rollType: '属性检定',
        total: runningTotal,
        targetNumber: input.dc,
      })
    : undefined
  runningTotal += bardicInspirationRoll ?? 0

  const optionalBonusDieUse = runningTotal < input.dc && input.requestOptionalBonusDie
    ? await input.requestOptionalBonusDie({
        target: input.target,
        combatant: input.combatant,
        rollKind: 'ability-check',
        rollType: '属性检定',
        originalD20: halflingLuckyD20 ?? d20,
        total: runningTotal,
        targetNumber: input.dc,
      })
    : undefined
  runningTotal += optionalBonusDieUse?.roll ?? 0

  const additionalBonusDieRoll = input.requestAdditionalBonusDie && canBonusDieChangeFailure({
    success: runningTotal >= input.dc,
    currentTotal: runningTotal,
    targetNumber: input.dc,
    dieSides: input.additionalBonusDieSides,
  })
    ? await input.requestAdditionalBonusDie({
        total: runningTotal,
        targetNumber: input.dc,
        dieSides: input.additionalBonusDieSides!,
      })
    : undefined
  runningTotal += additionalBonusDieRoll ?? 0

  const darkOnesOwnLuckRoll = input.requestDarkOnesOwnLuck &&
    dnd5eDarkOnesOwnLuckAvailable(input.combatant) && canBonusDieChangeFailure({
      success: runningTotal >= input.dc,
      currentTotal: runningTotal,
      targetNumber: input.dc,
      dieSides: 10,
    })
    ? await input.requestDarkOnesOwnLuck({
        target: input.target,
        targetName: input.targetName,
        rollType: '属性检定',
        total: runningTotal,
        targetNumber: input.dc,
      })
    : undefined
  runningTotal += darkOnesOwnLuckRoll ?? 0

  return {
    d20,
    d20Second,
    halflingLuckyD20,
    halflingLuckyD20Second,
    bardicInspirationRoll,
    optionalBonusDieUse,
    additionalBonusDieRoll,
    darkOnesOwnLuckRoll,
    baseTotal,
    total: runningTotal,
  }
}

/**
 * Runs every player-facing saving-throw interruption in one deterministic order.
 *
 * The initial d20 uses the shared roll-confirmation channel, so declarative
 * choice rerolls such as Lucky remain the single source of truth. Additive
 * bonuses are then offered only while they can still change a failure. The
 * returned dice are not trusted state: the caller must attach them to the same
 * Headless action, where eligibility, resource consumption and logging are
 * validated atomically.
 */
export async function resolveDnd5eSavingThrowInterrupts(input: {
  state: Dnd5eHeadlessCombatState
  combatant: Dnd5eCombatant
  target?: Character
  targetName: string
  ability: AbilityKey
  dc: number
  mode: SavingThrowMode
  label: string
  rollD20: (
    label: string,
    targetName: string,
    context?: Dnd5eD20RollInterruptContext,
  ) => Promise<number>
  rollD4: (label: string, targetName: string) => Promise<number>
  requestBardicInspiration?: (request: {
    target?: Character
    targetName: string
    dieSides: number
    rollType: BardicInspirationRollType
    total: number
    targetNumber: number
  }) => Promise<number | undefined>
  requestOptionalBonusDie?: (
    request: Dnd5eOptionalBonusDieInterruptRequest,
  ) => Promise<Dnd5eOptionalBonusDieUse | undefined>
  requestDarkOnesOwnLuck?: (request: {
    target?: Character
    targetName: string
    rollType: '豁免' | '属性检定'
    total: number
    targetNumber?: number
  }) => Promise<number | undefined>
  requestSavingThrowReroll?: (request: {
    target: Character
    targetName: string
    featureName: string
    total: number
    dc: number
    mode: SavingThrowMode
  }) => Promise<{ d20: number; d20Second?: number } | undefined>
  secondRollLabel?: string
  halflingLuckyLabel?: string
  blessLabel?: string
  baneLabel?: string
}): Promise<Dnd5eSavingThrowInterruptResult> {
  const rollerCharacterId = input.target?.id
  const sharedContext: Dnd5eD20RollInterruptContext = {
    rollKind: 'saving-throw',
    rollerCharacterId,
    targetCharacterId: rollerCharacterId,
  }
  const d20 = await input.rollD20(input.label, input.targetName, sharedContext)
  const d20Second = input.mode === 'normal'
    ? undefined
    : await input.rollD20(
        input.secondRollLabel ?? `${input.label}（第二枚 d20）`,
        input.targetName,
        { ...sharedContext, skipChoiceReroll: true },
      )
  const halflingLuckyD20 = input.combatant.racialRules?.halflingLucky && d20 === 1
    ? await input.rollD20(
        input.halflingLuckyLabel ?? `半身人幸运·${input.label}重投`,
        input.targetName,
        { ...sharedContext, skipChoiceReroll: true },
      )
    : undefined
  const halflingLuckyD20Second = input.combatant.racialRules?.halflingLucky && d20Second === 1
    ? await input.rollD20(
        input.halflingLuckyLabel ?? `半身人幸运·${input.label}重投`,
        input.targetName,
        { ...sharedContext, skipChoiceReroll: true },
      )
    : undefined
  const blessRoll = dnd5eCombatantHasConcentrationEffect(input.state, input.combatant.id, 'bless')
    ? await input.rollD4(input.blessLabel ?? `祝福术·${input.label}加值`, input.targetName)
    : undefined
  const baneRoll = dnd5eCombatantHasConcentrationEffect(input.state, input.combatant.id, 'bane')
    ? await input.rollD4(input.baneLabel ?? `灾祸术·${input.label}减值`, input.targetName)
    : undefined
  const modifier = (input.combatant.savingThrowBonuses[input.ability] ??
    Math.floor((input.combatant.abilities[input.ability] - 10) / 2)) +
    dnd5eActiveSavingThrowBonus(input.combatant.classState.activeEffects, input.ability) +
    (blessRoll ?? 0) - (baneRoll ?? 0)
  const initial = previewDnd5eSavingThrowRoll({
    rolls: input.mode === 'normal'
      ? [halflingLuckyD20 ?? d20]
      : [halflingLuckyD20 ?? d20, halflingLuckyD20Second ?? d20Second ?? 0],
    mode: input.mode,
    modifier,
    dc: input.dc,
  })

  let runningTotal = initial.roll.total
  const inspirationDie = dnd5eHeldBardicInspirationDie(input.combatant)
  const bardicInspirationRoll = input.requestBardicInspiration && canBonusDieChangeFailure({
    success: initial.success,
    currentTotal: runningTotal,
    targetNumber: input.dc,
    dieSides: inspirationDie,
  })
    ? await input.requestBardicInspiration({
        target: input.target,
        targetName: input.targetName,
        dieSides: inspirationDie!,
        rollType: '豁免',
        total: runningTotal,
        targetNumber: input.dc,
      })
    : undefined
  runningTotal += bardicInspirationRoll ?? 0

  const optionalBonusDieUse = runningTotal < input.dc && input.requestOptionalBonusDie
    ? await input.requestOptionalBonusDie({
        target: input.target,
        combatant: input.combatant,
        rollKind: 'saving-throw',
        rollType: '豁免',
        originalD20: halflingLuckyD20 ?? d20,
        total: runningTotal,
        targetNumber: input.dc,
      })
    : undefined
  runningTotal += optionalBonusDieUse?.roll ?? 0

  const darkOnesOwnLuckRoll = input.requestDarkOnesOwnLuck &&
    dnd5eDarkOnesOwnLuckAvailable(input.combatant) && canBonusDieChangeFailure({
      success: runningTotal >= input.dc,
      currentTotal: runningTotal,
      targetNumber: input.dc,
      dieSides: 10,
    })
    ? await input.requestDarkOnesOwnLuck({
        target: input.target,
        targetName: input.targetName,
        rollType: '豁免',
        total: runningTotal,
        targetNumber: input.dc,
      })
    : undefined
  runningTotal += darkOnesOwnLuckRoll ?? 0

  const successBeforeReroll = runningTotal >= input.dc
  const rerollFeature = dnd5eSavingThrowRerollFeature(input.combatant)
  const reroll = !successBeforeReroll && rerollFeature && input.target && input.requestSavingThrowReroll
    ? await input.requestSavingThrowReroll({
        target: input.target,
        targetName: input.targetName,
        featureName: rerollFeature.name,
        total: runningTotal,
        dc: input.dc,
        mode: input.mode,
      })
    : undefined
  const rerollPreview = reroll?.d20 == null
    ? undefined
    : previewDnd5eSavingThrowRoll({
        rolls: input.mode === 'normal'
          ? [reroll.d20]
          : [reroll.d20, reroll.d20Second ?? 0],
        mode: input.mode,
        modifier,
        dc: input.dc,
      })

  return {
    d20,
    d20Second,
    halflingLuckyD20,
    halflingLuckyD20Second,
    blessRoll,
    baneRoll,
    bardicInspirationRoll,
    optionalBonusDieUse,
    darkOnesOwnLuckRoll,
    rerollD20: reroll?.d20,
    rerollD20Second: reroll?.d20Second,
    totalBeforeReroll: runningTotal,
    successBeforeReroll,
    success: rerollPreview?.success ?? successBeforeReroll,
  }
}
