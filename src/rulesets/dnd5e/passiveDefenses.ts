import type { AbilityKey } from '../../lib/dnd'
import type { D20RollMode } from '../contracts'
import type { Dnd5eClassId } from './classes'
import type { Dnd5eDamageType } from './monsters'
import {
  dnd5eActiveConditionImmunities,
  dnd5eActiveConditionImmuneBySourceCreatureType,
  dnd5eActiveConditionImmuneBySourceMagic,
  dnd5eActiveSavingThrowAdvantageBySourceCreatureType,
  dnd5eActiveEffectsPreventReactions,
  dnd5eActiveEffectsGrantAttackAdvantageAgainstTarget,
  dnd5eActiveSavingThrowAdvantages,
  dnd5eActiveSavingThrowDisadvantages,
  dnd5eActiveStrengthRollFlags,
  dnd5eActiveSpeedBonus,
  dnd5eActiveSpeedPenalty,
  effectiveDnd5eActiveEffects,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import {
  DND5E_STANDARD_CONDITIONS,
  dnd5eActiveStandardConditions,
  dnd5eConditionGrantsAttackAdvantage,
  dnd5eConditionGrantsAttackAdvantageToAttacker,
  dnd5eConditionIncapacitated,
  dnd5eConditionSetsSpeedToZero,
  dnd5eConditionSavingThrowDisadvantage,
  dnd5eHasStandardCondition,
  dnd5eStandardConditionId,
} from './conditions'
import { resolveDnd5eRollMode, type Dnd5eRollModeResolution } from './rollMode'
import { dnd5eNextD20AdvantageApplies } from './nextD20Advantage'

export interface Dnd5eDefensiveCreature {
  level: number
  exhaustionLevel: number
  classId?: Dnd5eClassId
  subclassId?: string
  classLevels?: Partial<Record<Dnd5eClassId, number>>
  subclassIds?: Partial<Record<Dnd5eClassId, string>>
  classSelections: Record<string, string[]>
  classSelectionsByClass?: Partial<Record<Dnd5eClassId, Record<string, string[]>>>
  pluginFeatureIds?: readonly string[]
  countercharmSourceIds?: readonly string[]
  classState: {
    activeEffects?: readonly Dnd5eActiveEffectInstance[]
    hiddenCheckTotal?: number
    dodgingTurnKey?: string
    raging?: boolean
    stunnedByActorId?: string
    turnedByClericId?: string
    openHandNoReactionsAppliedTurnKeysBySource?: Readonly<Record<string, string>>
    viciousMockeryAttackDisadvantage?: boolean
    emptyBodyRoundsRemaining?: number
    holyNimbusRoundsRemaining?: number
    surprisedCombatId?: string
    surpriseResolvedCombatId?: string
    nextD20Advantage?: {
      featureId: string
      rollKinds: readonly ('attack' | 'ability-check' | 'saving-throw')[]
    }
    monsterMechanicRollModifiers?: readonly {
      roll: 'attack' | 'damage' | 'saving-throw'
      mode: 'bonus' | 'advantage' | 'disadvantage'
    }[]
    monsterLegendaryMovement?: {
      temporaryConditionImmunities?: readonly string[]
    }
  }
  conditions: readonly string[]
  /** Transient map projection for creatures with Antimagic Susceptibility. */
  incapacitatedByAntimagicSusceptibility?: boolean
  creatureType?: string
  magicResistance?: boolean
  spellSavingThrowAdvantage?: boolean
  spellSavingThrowAdvantageWithinFeet?: number
  spellSavingThrowDisadvantageDamageTypes?: readonly Dnd5eDamageType[]
  spellSavingThrowDisadvantageCastingClassIds?: readonly string[]
  racialSavingThrowAdvantages?: {
    conditions?: readonly string[]
    damageTypes?: readonly Dnd5eDamageType[]
    magicAbilities?: readonly AbilityKey[]
  }
  speed?: number
  dodging?: boolean
  wearingUnproficientArmor?: boolean
}

/** A stable, UI-safe explanation for a saving throw roll-mode source. */
export interface Dnd5eSavingThrowRuleReason {
  id: string
  label: string
  detail: string
}

const SAVING_THROW_RULE_REASONS: Record<string, Omit<Dnd5eSavingThrowRuleReason, 'id'>> = {
  'danger-sense': {
    label: '危险感知',
    detail: '可见效果的敏捷豁免具有优势；目标未失能、未目盲且未耳聋。',
  },
  'steel-will': {
    label: '钢铁意志',
    detail: '猎人游侠对抗恐慌的豁免具有优势。',
  },
  countercharm: {
    label: '反制魅惑',
    detail: '处于反制魅惑影响内，对抗魅惑或恐慌的豁免具有优势。',
  },
  'rage-strength-save': {
    label: '狂暴',
    detail: '狂暴期间的力量豁免具有优势。',
  },
  'holy-nimbus': {
    label: '圣洁灵光',
    detail: '对邪魔或亡灵施放的法术豁免具有优势。',
  },
  'magic-resistance': {
    label: '魔法抗性',
    detail: '对法术或其他魔法效应的豁免具有优势。',
  },
  'spell-saving-throw-advantage': {
    label: '法术抗性',
    detail: '对抗法术的豁免具有优势。',
  },
  'nearby-spell-saving-throw-advantage': {
    label: '近身抗法',
    detail: '施法来源位于规则限定距离内，对该法术的豁免具有优势。',
  },
  'spell-saving-throw-disadvantage-aura': {
    label: '法术压制灵光',
    detail: '处于敌方灵光范围内，对匹配伤害类型法术的豁免具有劣势。',
  },
  'racial-save-advantage': {
    label: '种族适应',
    detail: '当前种族规则对这次豁免提供优势。',
  },
  'protection-from-poison': {
    label: '防护毒素',
    detail: '对中毒状态的豁免具有优势。',
  },
  dodge: {
    label: '闪避',
    detail: '可见来源的敏捷豁免具有优势。',
  },
  'active-effect-strength-advantage': {
    label: '持续效果',
    detail: '当前持续效果使力量豁免具有优势。',
  },
  'monster-mechanic-advantage': {
    label: '怪物特性',
    detail: '当前怪物特性使该豁免具有优势。',
  },
  'exhaustion-level-3': {
    label: '力竭（3级或更高）',
    detail: '力量、敏捷与体质豁免具有劣势。',
  },
  'condition-save-disadvantage': {
    label: '状态影响',
    detail: '当前状态使该豁免具有劣势。',
  },
  'unproficient-armor': {
    label: '未熟练护甲',
    detail: '穿戴未熟练护甲时，力量与敏捷豁免具有劣势。',
  },
  'active-effect-strength-disadvantage': {
    label: '持续效果',
    detail: '当前持续效果使力量豁免具有劣势。',
  },
  'monster-mechanic-disadvantage': {
    label: '怪物特性',
    detail: '当前怪物特性使该豁免具有劣势。',
  },
  'next-d20-advantage': {
    label: '预激活优势',
    detail: '玩家此前已主动准备一次优势，本次豁免会消耗该状态。',
  },
}

export function dnd5eSavingThrowRuleReason(reasonId: string): Dnd5eSavingThrowRuleReason {
  const known = SAVING_THROW_RULE_REASONS[reasonId]
  return known
    ? { id: reasonId, ...known }
    : { id: reasonId, label: reasonId, detail: '由当前规则上下文提供的豁免骰修正。' }
}

export interface Dnd5eSavingThrowModeExplanation extends Dnd5eRollModeResolution {
  advantage: readonly Dnd5eSavingThrowRuleReason[]
  disadvantage: readonly Dnd5eSavingThrowRuleReason[]
}

function defensiveClassLevel(creature: Dnd5eDefensiveCreature, classId: Dnd5eClassId): number {
  const stored = creature.classLevels?.[classId]
  if (stored != null) return Math.max(0, Math.min(20, Math.floor(stored)))
  return creature.classId === classId ? Math.max(1, Math.min(20, Math.floor(creature.level))) : 0
}

function defensiveHasSubclass(creature: Dnd5eDefensiveCreature, classId: Dnd5eClassId, subclassId: string): boolean {
  return (creature.subclassIds?.[classId] ?? (creature.classId === classId ? creature.subclassId : undefined)) === subclassId
}

function defensiveSelections(creature: Dnd5eDefensiveCreature, classId: Dnd5eClassId): Record<string, string[]> {
  return creature.classSelectionsByClass?.[classId] ?? creature.classSelections
}

function hasCondition(creature: Pick<Dnd5eDefensiveCreature, 'conditions'>, values: ReadonlySet<string>): boolean {
  return creature.conditions.some((condition) => values.has(condition.toLowerCase()))
}

function hasMechanicalEffect(
  creature: Pick<Dnd5eDefensiveCreature, 'classState'>,
  definitionId: string,
): boolean {
  return creature.classState.activeEffects?.some((effect) => effect.definitionId === definitionId) === true
}

export function dnd5eIsIncapacitated(
  creature: Pick<Dnd5eDefensiveCreature, 'classState'> & Partial<Pick<
    Dnd5eDefensiveCreature,
    'conditions' | 'incapacitatedByAntimagicSusceptibility'
  >>,
): boolean {
  return creature.incapacitatedByAntimagicSusceptibility === true ||
    !!creature.classState.stunnedByActorId || dnd5eConditionIncapacitated(creature)
}

export function dnd5eSavingThrowModeExplanation(
  creature: Dnd5eDefensiveCreature,
  ability: AbilityKey,
  context: {
    effectVisible?: boolean
    condition?: string
    sourceCreatureType?: string
    sourceIsSpell?: boolean
    sourceSpellcastingClassId?: string
    sourceIsMagical?: boolean
    damageType?: Dnd5eDamageType
    sourceDistanceFeet?: number
  } = {},
): Dnd5eSavingThrowModeExplanation {
  const dangerSenseBlocked = dnd5eIsIncapacitated(creature) || hasCondition(creature, new Set([
    'blinded', 'deafened', '目盲', '耳聋',
  ]))
  const dangerSense = defensiveClassLevel(creature, 'barbarian') >= 2 && ability === 'dex' &&
    context.effectVisible !== false && !dangerSenseBlocked
  const feared = context.condition != null && new Set(['frightened', '惊惧', '恐慌']).has(context.condition.toLowerCase())
  const charmed = context.condition != null && new Set(['charmed', '魅惑']).has(context.condition.toLowerCase())
  const steelWill = defensiveClassLevel(creature, 'ranger') >= 7 && defensiveHasSubclass(creature, 'ranger', 'hunter') && feared &&
    defensiveSelections(creature, 'ranger')['defensive-tactics']?.includes('steel-will') === true
  const countercharm = (feared || charmed) && (creature.countercharmSourceIds?.length ?? 0) > 0
  const rageStrength = defensiveClassLevel(creature, 'barbarian') >= 1 && creature.classState.raging === true && ability === 'str'
  const poisonProtection = ['poisoned', '中毒'].includes((context.condition ?? '').trim().toLowerCase()) &&
    hasMechanicalEffect(creature, 'srd-5.1:spell:protection-from-poison')
  const sourceType = normalizedCreatureType(context.sourceCreatureType)
  const holyNimbus = defensiveClassLevel(creature, 'paladin') >= 20 && defensiveHasSubclass(creature, 'paladin', 'devotion') &&
    (creature.classState.holyNimbusRoundsRemaining ?? 0) > 0 && context.sourceIsSpell === true &&
    (sourceType === 'fiend' || sourceType.includes('邪魔') || sourceType === 'undead' || sourceType.includes('亡灵'))
  const dodgeDexterity = ability === 'dex' && dnd5eTargetIsDodging(creature)
  const magicResistance = creature.magicResistance === true &&
    (context.sourceIsSpell === true || context.sourceIsMagical === true)
  const spellSavingThrowAdvantage = creature.spellSavingThrowAdvantage === true &&
    context.sourceIsSpell === true
  const nearbySpellSavingThrowAdvantage = context.sourceIsSpell === true &&
    (creature.spellSavingThrowAdvantageWithinFeet ?? 0) > 0 &&
    Number.isFinite(context.sourceDistanceFeet) &&
    (context.sourceDistanceFeet ?? Number.POSITIVE_INFINITY) <= (creature.spellSavingThrowAdvantageWithinFeet ?? 0)
  const spellSavingThrowDisadvantageAura = context.sourceIsSpell === true && (
    (context.damageType != null && creature.spellSavingThrowDisadvantageDamageTypes?.includes(context.damageType) === true) ||
    (context.sourceSpellcastingClassId != null &&
      creature.spellSavingThrowDisadvantageCastingClassIds?.includes(context.sourceSpellcastingClassId) === true)
  )
  const racialSaveAdvantage = !!((
    context.condition != null &&
    creature.racialSavingThrowAdvantages?.conditions?.some((condition) =>
      condition.trim().toLowerCase() === context.condition?.trim().toLowerCase())
  ) || (
    context.damageType != null &&
    creature.racialSavingThrowAdvantages?.damageTypes?.includes(context.damageType)
  ) || (
    (context.sourceIsSpell === true || context.sourceIsMagical === true) &&
    creature.racialSavingThrowAdvantages?.magicAbilities?.includes(ability)
  ))
  const sourceQualifiedConditionSaveAdvantage = dnd5eActiveSavingThrowAdvantageBySourceCreatureType(
    creature.classState.activeEffects,
    context.condition,
    context.sourceCreatureType,
  )
  const strengthEffect = ability === 'str'
    ? dnd5eActiveStrengthRollFlags(creature.classState.activeEffects)
    : { advantage: false, disadvantage: false }
  const mechanicModifiers = creature.classState.monsterMechanicRollModifiers?.filter((entry) => entry.roll === 'saving-throw') ?? []
  const resolution = resolveDnd5eRollMode({
    advantage: [
      { active: dangerSense, reason: 'danger-sense' },
      { active: steelWill, reason: 'steel-will' },
      { active: countercharm, reason: 'countercharm' },
      { active: rageStrength, reason: 'rage-strength-save' },
      { active: holyNimbus, reason: 'holy-nimbus' },
      { active: magicResistance, reason: 'magic-resistance' },
      { active: spellSavingThrowAdvantage, reason: 'spell-saving-throw-advantage' },
      { active: nearbySpellSavingThrowAdvantage, reason: 'nearby-spell-saving-throw-advantage' },
      { active: racialSaveAdvantage, reason: 'racial-save-advantage' },
      { active: sourceQualifiedConditionSaveAdvantage, reason: 'source-qualified-condition-save-advantage' },
      { active: poisonProtection, reason: 'protection-from-poison' },
      { active: dodgeDexterity, reason: 'dodge' },
      { active: strengthEffect.advantage, reason: 'active-effect-strength-advantage' },
      {
        active: dnd5eActiveSavingThrowAdvantages(
          creature.classState.activeEffects,
        ).includes(ability),
        reason: 'active-effect-save-advantage',
      },
      {
        active: dnd5eNextD20AdvantageApplies(creature, 'saving-throw'),
        reason: 'next-d20-advantage',
      },
      {
        active: mechanicModifiers.some((entry) => entry.mode === 'advantage'),
        reason: 'monster-mechanic-advantage',
      },
    ],
    disadvantage: [
      { active: creature.exhaustionLevel >= 3, reason: 'exhaustion-level-3' },
      {
        active: dnd5eConditionSavingThrowDisadvantage(creature, ability),
        reason: 'condition-save-disadvantage',
      },
      {
        active: dnd5eActiveSavingThrowDisadvantages(
          creature.classState.activeEffects,
        ).includes(ability),
        reason: 'active-effect-save-disadvantage',
      },
      {
        active: creature.wearingUnproficientArmor === true && (ability === 'str' || ability === 'dex'),
        reason: 'unproficient-armor',
      },
      { active: strengthEffect.disadvantage, reason: 'active-effect-strength-disadvantage' },
      {
        active: mechanicModifiers.some((entry) => entry.mode === 'disadvantage'),
        reason: 'monster-mechanic-disadvantage',
      },
      {
        active: spellSavingThrowDisadvantageAura,
        reason: 'spell-saving-throw-disadvantage-aura',
      },
    ],
  })
  return {
    ...resolution,
    advantage: resolution.advantageReasons.map(dnd5eSavingThrowRuleReason),
    disadvantage: resolution.disadvantageReasons.map(dnd5eSavingThrowRuleReason),
  }
}

export function dnd5eSavingThrowMode(
  creature: Dnd5eDefensiveCreature,
  ability: AbilityKey,
  context: {
    effectVisible?: boolean
    condition?: string
    sourceCreatureType?: string
    sourceIsSpell?: boolean
    sourceSpellcastingClassId?: string
    sourceIsMagical?: boolean
    damageType?: Dnd5eDamageType
    sourceDistanceFeet?: number
  } = {},
): D20RollMode {
  return dnd5eSavingThrowModeExplanation(creature, ability, context).mode
}

export function dnd5eHasEvasion(creature: Dnd5eDefensiveCreature): boolean {
  if (defensiveClassLevel(creature, 'rogue') >= 7 || defensiveClassLevel(creature, 'monk') >= 7) return true
  return defensiveClassLevel(creature, 'ranger') >= 15 && defensiveHasSubclass(creature, 'ranger', 'hunter') &&
    defensiveSelections(creature, 'ranger')['superior-hunters-defense']?.includes('evasion') === true
}

export function dnd5eDamageAfterSavingThrow(input: {
  creature: Dnd5eDefensiveCreature
  ability: AbilityKey
  damage: number
  success: boolean
  successfulSave: 'none' | 'half'
  /** An authoritative external source, such as a mounted rider, grants Evasion for this save. */
  externalEvasion?: boolean
}): number {
  const damage = Math.max(0, Math.floor(input.damage))
  if (input.successfulSave === 'none') return input.success ? 0 : damage
  if (input.ability === 'dex' && (input.externalEvasion === true || dnd5eHasEvasion(input.creature))) {
    return input.success ? 0 : Math.floor(damage / 2)
  }
  return input.success ? Math.floor(damage / 2) : damage
}

export function dnd5ePreventsAttackAdvantage(creature: Dnd5eDefensiveCreature): boolean {
  return defensiveClassLevel(creature, 'rogue') >= 18 && !dnd5eIsIncapacitated(creature)
}

export function dnd5eIsBlinded(creature: { conditions?: readonly string[] }): boolean {
  return dnd5eHasStandardCondition(creature, 'blinded')
}

/** 目标目盲时，对其进行的攻击检定具有优势。 */
export function dnd5eTargetGrantsAttackAdvantage(creature: Dnd5eDefensiveCreature): boolean {
  return dnd5eTargetAttackAdvantageReasons(creature).length > 0
}

/**
 * Returns the concrete public rule sources behind attacks having advantage
 * against this target. Combat logs consume these labels instead of collapsing
 * every condition and ActiveEffect into the opaque phrase “目标状态”.
 */
export function dnd5eTargetAttackAdvantageReasons(
  creature: Dnd5eDefensiveCreature,
): readonly string[] {
  if (dnd5ePreventsAttackAdvantage(creature)) return []
  const guidingBolt = creature.classState.activeEffects?.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:guiding-bolt:attack-advantage'
  ) === true
  const faerieFire = hasMechanicalEffect(creature, 'srd-5.1:spell:faerie-fire')
  const conditionReasons = dnd5eActiveStandardConditions(creature)
    .filter((condition) =>
      DND5E_STANDARD_CONDITIONS[condition].attacksAgainstHaveAdvantage === true)
    .map((condition) => `目标处于${DND5E_STANDARD_CONDITIONS[condition].label}状态`)
  const activeEffectReasons = effectiveDnd5eActiveEffects(
    creature.classState.activeEffects,
  ).filter((effect) =>
    effect.modifiers?.attacksAgainstTargetAdvantage === true,
  ).map((effect) => `目标效果“${effect.label}”提供攻击优势`)
  const reasons = [
    ...conditionReasons,
    ...(guidingBolt ? ['目标受到曳光弹影响'] : []),
    ...(faerieFire ? ['目标受到妖火术影响'] : []),
    ...activeEffectReasons,
  ]
  // Keep the boolean rule source as a compatibility fallback for extensions
  // whose old projection has not yet exposed a named ActiveEffect.
  if (
    reasons.length === 0 &&
    (
      dnd5eConditionGrantsAttackAdvantage({ target: creature }) ||
      dnd5eActiveEffectsGrantAttackAdvantageAgainstTarget(
        creature.classState.activeEffects,
      )
    )
  ) reasons.push('目标的规则状态提供攻击优势')
  return [...new Set(reasons)]
}

/** 攻击者不可见时，其攻击检定具有优势（特殊感官可在规则扩展层覆盖）。 */
export function dnd5eAttackerIsUnseen(
  creature: Pick<Dnd5eDefensiveCreature, 'classState'> & Partial<Pick<Dnd5eDefensiveCreature, 'conditions'>>,
): boolean {
  if (hasMechanicalEffect(creature, 'srd-5.1:spell:faerie-fire')) return false
  return dnd5eConditionGrantsAttackAdvantageToAttacker(creature) ||
    (creature.classState.emptyBodyRoundsRemaining ?? 0) > 0
}

/** A nearby hostile only penalizes a ranged attack if it can see the attacker and is not incapacitated. */
export function dnd5eCanThreatenRangedAttacker(
  attacker: Pick<Dnd5eDefensiveCreature, 'classState'> & Partial<Pick<Dnd5eDefensiveCreature, 'conditions'>>,
  hostile: Pick<Dnd5eDefensiveCreature, 'classState'> & Partial<Pick<Dnd5eDefensiveCreature, 'conditions'>>,
): boolean {
  return attacker.classState.hiddenCheckTotal == null &&
    !dnd5eAttackerIsUnseen(attacker) &&
    !dnd5eIsIncapacitated(hostile) &&
    !dnd5eHasStandardCondition(hostile, 'blinded')
}

export function dnd5eHasViciousMockeryAttackDisadvantage(
  creature: Pick<Dnd5eDefensiveCreature, 'classState'>,
): boolean {
  return creature.classState.viciousMockeryAttackDisadvantage === true
}

/**
 * Returns public, rule-specific labels for disadvantage caused by the
 * attacker's own standard conditions. Keeping this separate from visibility
 * prevents conditions such as Restrained from being reported as an unseen
 * target.
 */
export function dnd5eAttackerAttackDisadvantageReasons(
  creature: Partial<Pick<Dnd5eDefensiveCreature, 'conditions'>>,
): readonly string[] {
  return dnd5eActiveStandardConditions(creature)
    .filter((condition) =>
      DND5E_STANDARD_CONDITIONS[condition].attackRollsDisadvantage === true)
    .map((condition) => `攻击者处于${DND5E_STANDARD_CONDITIONS[condition].label}状态`)
}

/** Returns non-visibility rules on the target that impose attack disadvantage. */
export function dnd5eTargetAttackDisadvantageReasons(
  attacker: Pick<Dnd5eDefensiveCreature, 'creatureType'>,
  target: Pick<Dnd5eDefensiveCreature, 'classId' | 'subclassId' | 'level' | 'classLevels' | 'subclassIds' | 'classState'>,
): readonly string[] {
  const activeEffectReasons = effectiveDnd5eActiveEffects(
    target.classState.activeEffects,
  ).filter((effect) =>
    effect.modifiers?.attacksAgainstTargetDisadvantage === true,
  ).map((effect) => `目标效果“${effect.label}”令对其攻击具有劣势`)
  const purityOfSpirit = defensiveClassLevel(target as Dnd5eDefensiveCreature, 'paladin') >= 15 &&
    defensiveHasSubclass(target as Dnd5eDefensiveCreature, 'paladin', 'devotion') &&
    dnd5eProtectionCreatureType(attacker.creatureType)
  return [...new Set([
    ...activeEffectReasons,
    ...(purityOfSpirit ? ['目标的纯净之魂令该生物类型的攻击具有劣势'] : []),
  ])]
}

export function dnd5eUnseenTargetImposesDisadvantage(
  attacker: Pick<Dnd5eDefensiveCreature, 'classId' | 'level' | 'classLevels' | 'creatureType'> & { conditions?: readonly string[] },
  target: Pick<Dnd5eDefensiveCreature, 'classId' | 'subclassId' | 'level' | 'classLevels' | 'subclassIds' | 'classState'> &
    Partial<Pick<Dnd5eDefensiveCreature, 'conditions'>>,
  options?: { targetVisible?: boolean },
): boolean {
  if (dnd5eAttackerAttackDisadvantageReasons(attacker).length > 0) return true
  if (dnd5eTargetAttackDisadvantageReasons(attacker, target).length > 0) return true
  const targetIsOutlined = hasMechanicalEffect(target, 'srd-5.1:spell:faerie-fire')
  const targetIsUnseen = options?.targetVisible === true
    ? false
    : (!targetIsOutlined && dnd5eHasStandardCondition(target, 'invisible')) ||
      (target.classState.emptyBodyRoundsRemaining ?? 0) > 0
  const unseenDisadvantage = targetIsUnseen && !(defensiveClassLevel(attacker as Dnd5eDefensiveCreature, 'ranger') >= 18)
  return unseenDisadvantage
}

export function dnd5eReactionsPrevented(
  creature: Pick<Dnd5eDefensiveCreature, 'classState'> & Partial<Pick<Dnd5eDefensiveCreature, 'conditions'>>,
): boolean {
  const surpriseUnresolved = creature.classState.surprisedCombatId != null &&
    creature.classState.surpriseResolvedCombatId !== creature.classState.surprisedCombatId
  return surpriseUnresolved || dnd5eIsIncapacitated(creature) || !!creature.classState.turnedByClericId ||
    dnd5eActiveEffectsPreventReactions(creature.classState.activeEffects) ||
    Object.keys(creature.classState.openHandNoReactionsAppliedTurnKeysBySource ?? {}).length > 0
}

/** Dodge only grants its defensive benefit while the creature can act and still has non-zero speed. */
export function dnd5eTargetIsDodging(
  creature: Pick<Dnd5eDefensiveCreature, 'classState' | 'conditions' | 'speed' | 'dodging'>,
): boolean {
  if (dnd5eConditionIncapacitated(creature) || dnd5eConditionSetsSpeedToZero(creature)) return false
  if (creature.speed != null && creature.speed + dnd5eActiveSpeedBonus(creature.classState.activeEffects) - dnd5eActiveSpeedPenalty(creature.classState.activeEffects) <= 0) return false
  return creature.dodging === true || creature.classState.dodgingTurnKey != null
}

export function dnd5eCanUseUncannyDodge(creature: Dnd5eDefensiveCreature & { currentHp: number; turn: { reactionAvailable: boolean } }): boolean {
  if (
    creature.currentHp <= 0 || !creature.turn.reactionAvailable ||
    dnd5eIsIncapacitated(creature) || dnd5eReactionsPrevented(creature)
  ) return false
  if (defensiveClassLevel(creature, 'rogue') >= 5) return true
  return defensiveClassLevel(creature, 'ranger') >= 15 && defensiveHasSubclass(creature, 'ranger', 'hunter') &&
    defensiveSelections(creature, 'ranger')['superior-hunters-defense']?.includes('uncanny-dodge') === true
}

export function dnd5eCanUseDeflectMissiles(creature: Dnd5eDefensiveCreature & { currentHp: number; turn: { reactionAvailable: boolean } }): boolean {
  return defensiveClassLevel(creature, 'monk') >= 3 && creature.currentHp > 0 &&
    creature.turn.reactionAvailable && !dnd5eIsIncapacitated(creature) && !dnd5eReactionsPrevented(creature)
}

function normalizedCreatureType(creatureType?: string): string {
  return (creatureType ?? '').trim().toLowerCase()
}

function dnd5eProtectionCreatureType(creatureType?: string): boolean {
  const type = normalizedCreatureType(creatureType)
  return type === 'aberration' || type.includes('异怪') ||
    type === 'celestial' || type.includes('天界') ||
    type === 'elemental' || type.includes('元素') ||
    type === 'fey' || type.includes('精类') || type.includes('妖精') ||
    type === 'fiend' || type.includes('邪魔') ||
    type === 'undead' || type.includes('亡灵')
}

/**
 * Condition immunity that depends on the creature applying the effect.  This
 * keeps the Land druid's Nature's Ward narrower than a blanket charm/fear
 * immunity: only elementals and fey are prevented by that clause.
 */
export function dnd5eConditionImmuneFromSource(
  target: Dnd5eDefensiveCreature & { conditionImmunities?: readonly string[] },
  condition: string,
  source?: Pick<Dnd5eDefensiveCreature, 'creatureType'>,
  context?: { sourceMagical?: boolean },
): boolean {
  const normalized = condition.trim().toLowerCase()
  const standard = dnd5eStandardConditionId(condition)
  if (
    dnd5eHasStandardCondition(target, 'petrified') &&
    ['poisoned', '中毒', 'disease', '疾病'].includes(normalized)
  ) return true
  if ((target.conditionImmunities ?? []).some((entry) =>
    entry.trim().toLowerCase() === normalized ||
    (standard != null && dnd5eStandardConditionId(entry) === standard),
  )) return true
  if (standard != null && dnd5eActiveConditionImmunities(target.classState.activeEffects).includes(standard)) {
    return true
  }
  if (dnd5eActiveConditionImmuneBySourceCreatureType(
    target.classState.activeEffects,
    standard ?? normalized,
    source?.creatureType,
  )) return true
  if (
    standard != null &&
    target.classState.monsterLegendaryMovement?.temporaryConditionImmunities?.includes(standard)
  ) return true
  if (dnd5eActiveConditionImmuneBySourceMagic(
    target.classState.activeEffects,
    standard ?? normalized,
    context?.sourceMagical,
  )) return true
  const charmOrFear = standard === 'charmed' || standard === 'frightened'
  if (
    charmOrFear &&
    defensiveClassLevel(target, 'barbarian') >= 6 &&
    defensiveHasSubclass(target, 'barbarian', 'berserker') &&
    target.classState.raging === true
  ) return true
  const charmFearOrPossession = ['charmed', '魅惑', 'frightened', '惊惧', '恐慌', 'possessed', '附身'].includes(normalized)
  if (
    charmFearOrPossession && defensiveClassLevel(target, 'paladin') >= 15 &&
    defensiveHasSubclass(target, 'paladin', 'devotion') &&
    dnd5eProtectionCreatureType(source?.creatureType)
  ) return true
  if (
    !charmOrFear || defensiveClassLevel(target, 'druid') < 10 || !defensiveHasSubclass(target, 'druid', 'land')
  ) return false
  const sourceType = normalizedCreatureType(source?.creatureType)
  return sourceType === 'elemental' || sourceType.includes('元素') || sourceType === 'fey' || sourceType.includes('精类') || sourceType.includes('妖精')
}

export function dnd5eClassPassiveDefenses(creature: Dnd5eDefensiveCreature): {
  damageImmunities: readonly Dnd5eDamageType[]
  conditionImmunities: readonly string[]
} {
  const damageImmunities: Dnd5eDamageType[] = []
  const conditionImmunities: string[] = []
  if (defensiveClassLevel(creature, 'paladin') >= 3) {
    conditionImmunities.push('disease', '疾病')
  }
  if (defensiveClassLevel(creature, 'monk') >= 10) {
    damageImmunities.push('poison')
    conditionImmunities.push('poisoned', '中毒', 'disease', '疾病')
  }
  if (defensiveClassLevel(creature, 'druid') >= 10 && defensiveHasSubclass(creature, 'druid', 'land')) {
    damageImmunities.push('poison')
    conditionImmunities.push('poisoned', '中毒', 'disease', '疾病')
  }
  return { damageImmunities, conditionImmunities }
}
