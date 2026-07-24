import type { AbilityKey } from '../../lib/dnd'
import type { D20RollMode } from '../contracts'
import type { Dnd5eClassId } from './classes'
import type { Dnd5eDamageType } from './monsters'
import {
  dnd5eActiveConditionImmunities,
  dnd5eActiveEffectsPreventReactions,
  dnd5eActiveStrengthRollFlags,
  dnd5eActiveSpeedBonus,
  dnd5eActiveSpeedPenalty,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import {
  dnd5eConditionGrantsAttackAdvantage,
  dnd5eConditionGrantsAttackAdvantageToAttacker,
  dnd5eConditionImposesAttackDisadvantage,
  dnd5eConditionIncapacitated,
  dnd5eConditionSetsSpeedToZero,
  dnd5eConditionSavingThrowDisadvantage,
  dnd5eHasStandardCondition,
  dnd5eStandardConditionId,
} from './conditions'
import { resolveDnd5eRollMode } from './rollMode'

export interface Dnd5eDefensiveCreature {
  level: number
  exhaustionLevel: number
  classId?: Dnd5eClassId
  subclassId?: string
  classLevels?: Partial<Record<Dnd5eClassId, number>>
  subclassIds?: Partial<Record<Dnd5eClassId, string>>
  classSelections: Record<string, string[]>
  classSelectionsByClass?: Partial<Record<Dnd5eClassId, Record<string, string[]>>>
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
  }
  conditions: readonly string[]
  creatureType?: string
  speed?: number
  dodging?: boolean
  wearingUnproficientArmor?: boolean
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
  creature: Pick<Dnd5eDefensiveCreature, 'classState'> & Partial<Pick<Dnd5eDefensiveCreature, 'conditions'>>,
): boolean {
  return !!creature.classState.stunnedByActorId || dnd5eConditionIncapacitated(creature)
}

export function dnd5eSavingThrowMode(
  creature: Dnd5eDefensiveCreature,
  ability: AbilityKey,
  context: { effectVisible?: boolean; condition?: string; sourceCreatureType?: string; sourceIsSpell?: boolean } = {},
): D20RollMode {
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
  const strengthEffect = ability === 'str'
    ? dnd5eActiveStrengthRollFlags(creature.classState.activeEffects)
    : { advantage: false, disadvantage: false }
  const advantage = dangerSense || steelWill || countercharm || rageStrength || holyNimbus ||
    poisonProtection || dodgeDexterity || strengthEffect.advantage
  const disadvantage = creature.exhaustionLevel >= 3 ||
    dnd5eConditionSavingThrowDisadvantage(creature, ability) ||
    (creature.wearingUnproficientArmor === true && (ability === 'str' || ability === 'dex')) ||
    strengthEffect.disadvantage
  return resolveDnd5eRollMode({
    advantage: [{ active: advantage, reason: 'saving-throw-advantage' }],
    disadvantage: [{ active: disadvantage, reason: 'saving-throw-disadvantage' }],
  }).mode
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
}): number {
  const damage = Math.max(0, Math.floor(input.damage))
  if (input.successfulSave === 'none') return input.success ? 0 : damage
  if (input.ability === 'dex' && dnd5eHasEvasion(input.creature)) {
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
  const guidingBolt = creature.classState.activeEffects?.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:guiding-bolt:attack-advantage'
  ) === true
  const faerieFire = hasMechanicalEffect(creature, 'srd-5.1:spell:faerie-fire')
  return (dnd5eConditionGrantsAttackAdvantage({ target: creature }) || guidingBolt || faerieFire) &&
    !dnd5ePreventsAttackAdvantage(creature)
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

export function dnd5eUnseenTargetImposesDisadvantage(
  attacker: Pick<Dnd5eDefensiveCreature, 'classId' | 'level' | 'classLevels' | 'creatureType'> & { conditions?: readonly string[] },
  target: Pick<Dnd5eDefensiveCreature, 'classId' | 'subclassId' | 'level' | 'classLevels' | 'subclassIds' | 'classState'> &
    Partial<Pick<Dnd5eDefensiveCreature, 'conditions'>>,
): boolean {
  if (dnd5eConditionImposesAttackDisadvantage({ attacker })) return true
  const targetIsOutlined = hasMechanicalEffect(target, 'srd-5.1:spell:faerie-fire')
  const targetIsUnseen = (!targetIsOutlined && dnd5eHasStandardCondition(target, 'invisible')) ||
    (target.classState.emptyBodyRoundsRemaining ?? 0) > 0
  const unseenDisadvantage = targetIsUnseen && !(defensiveClassLevel(attacker as Dnd5eDefensiveCreature, 'ranger') >= 18)
  const purityOfSpirit = defensiveClassLevel(target as Dnd5eDefensiveCreature, 'paladin') >= 15 &&
    defensiveHasSubclass(target as Dnd5eDefensiveCreature, 'paladin', 'devotion') &&
    dnd5eProtectionCreatureType(attacker.creatureType)
  return unseenDisadvantage || purityOfSpirit
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
  const charmFearOrPossession = ['charmed', '魅惑', 'frightened', '惊惧', '恐慌', 'possessed', '附身'].includes(normalized)
  if (
    charmFearOrPossession && defensiveClassLevel(target, 'paladin') >= 15 &&
    defensiveHasSubclass(target, 'paladin', 'devotion') &&
    dnd5eProtectionCreatureType(source?.creatureType)
  ) return true
  const charmOrFear = ['charmed', '魅惑', 'frightened', '惊惧', '恐慌'].includes(normalized)
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
  if (defensiveClassLevel(creature, 'barbarian') >= 6 && defensiveHasSubclass(creature, 'barbarian', 'berserker') && creature.classState.raging) {
    conditionImmunities.push('charmed', '魅惑', 'frightened', '惊惧', '恐慌')
  }
  return { damageImmunities, conditionImmunities }
}
