import type { AbilityKey } from '../../lib/dnd'
import type { D20RollMode } from '../contracts'
import type { Dnd5eClassId } from './classes'
import type { Dnd5eDamageType } from './monsters'
import { dnd5eActiveEffectsPreventReactions, type Dnd5eActiveEffectInstance } from './activeEffects'
import {
  dnd5eConditionGrantsAttackAdvantage,
  dnd5eConditionGrantsAttackAdvantageToAttacker,
  dnd5eConditionImposesAttackDisadvantage,
  dnd5eConditionIncapacitated,
  dnd5eConditionSavingThrowDisadvantage,
  dnd5eHasStandardCondition,
  dnd5eStandardConditionId,
} from './conditions'

export interface Dnd5eDefensiveCreature {
  level: number
  exhaustionLevel: number
  classId?: Dnd5eClassId
  subclassId?: string
  classSelections: Record<string, string[]>
  countercharmSourceIds?: readonly string[]
  classState: {
    activeEffects?: readonly Dnd5eActiveEffectInstance[]
    hiddenCheckTotal?: number
    raging?: boolean
    stunnedByActorId?: string
    turnedByClericId?: string
    openHandNoReactionsAppliedTurnKeysBySource?: Readonly<Record<string, string>>
    viciousMockeryAttackDisadvantage?: boolean
    emptyBodyRoundsRemaining?: number
    holyNimbusRoundsRemaining?: number
  }
  conditions: readonly string[]
  creatureType?: string
}

function hasCondition(creature: Pick<Dnd5eDefensiveCreature, 'conditions'>, values: ReadonlySet<string>): boolean {
  return creature.conditions.some((condition) => values.has(condition.toLowerCase()))
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
  const dangerSense = creature.classId === 'barbarian' && creature.level >= 2 && ability === 'dex' &&
    context.effectVisible !== false && !dangerSenseBlocked
  const feared = context.condition != null && new Set(['frightened', '惊惧', '恐慌']).has(context.condition.toLowerCase())
  const charmed = context.condition != null && new Set(['charmed', '魅惑']).has(context.condition.toLowerCase())
  const steelWill = creature.classId === 'ranger' && creature.subclassId === 'hunter' && creature.level >= 7 && feared &&
    creature.classSelections['defensive-tactics']?.includes('steel-will') === true
  const countercharm = (feared || charmed) && (creature.countercharmSourceIds?.length ?? 0) > 0
  const rageStrength = creature.classId === 'barbarian' && creature.level >= 1 && creature.classState.raging === true && ability === 'str'
  const sourceType = normalizedCreatureType(context.sourceCreatureType)
  const holyNimbus = creature.classId === 'paladin' && creature.subclassId === 'devotion' && creature.level >= 20 &&
    (creature.classState.holyNimbusRoundsRemaining ?? 0) > 0 && context.sourceIsSpell === true &&
    (sourceType === 'fiend' || sourceType.includes('邪魔') || sourceType === 'undead' || sourceType.includes('亡灵'))
  const advantage = dangerSense || steelWill || countercharm || rageStrength || holyNimbus
  const disadvantage = creature.exhaustionLevel >= 3 || dnd5eConditionSavingThrowDisadvantage(creature, ability)
  if (advantage === disadvantage) return 'normal'
  return advantage ? 'advantage' : 'disadvantage'
}

export function dnd5eHasEvasion(creature: Dnd5eDefensiveCreature): boolean {
  if ((creature.classId === 'rogue' || creature.classId === 'monk') && creature.level >= 7) return true
  return creature.classId === 'ranger' && creature.subclassId === 'hunter' && creature.level >= 15 &&
    creature.classSelections['superior-hunters-defense']?.includes('evasion') === true
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
  return creature.classId === 'rogue' && creature.level >= 18 && !dnd5eIsIncapacitated(creature)
}

export function dnd5eIsBlinded(creature: { conditions?: readonly string[] }): boolean {
  return dnd5eHasStandardCondition(creature, 'blinded')
}

/** 目标目盲时，对其进行的攻击检定具有优势。 */
export function dnd5eTargetGrantsAttackAdvantage(creature: Dnd5eDefensiveCreature): boolean {
  return dnd5eConditionGrantsAttackAdvantage({ target: creature }) && !dnd5ePreventsAttackAdvantage(creature)
}

/** 攻击者不可见时，其攻击检定具有优势（特殊感官可在规则扩展层覆盖）。 */
export function dnd5eAttackerIsUnseen(
  creature: Pick<Dnd5eDefensiveCreature, 'classState'> & Partial<Pick<Dnd5eDefensiveCreature, 'conditions'>>,
): boolean {
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
  attacker: Pick<Dnd5eDefensiveCreature, 'classId' | 'level' | 'creatureType'> & { conditions?: readonly string[] },
  target: Pick<Dnd5eDefensiveCreature, 'classId' | 'subclassId' | 'level' | 'classState'> &
    Partial<Pick<Dnd5eDefensiveCreature, 'conditions'>>,
): boolean {
  if (dnd5eConditionImposesAttackDisadvantage({ attacker })) return true
  const targetIsUnseen = dnd5eHasStandardCondition(target, 'invisible') ||
    (target.classState.emptyBodyRoundsRemaining ?? 0) > 0
  const unseenDisadvantage = targetIsUnseen && !(attacker.classId === 'ranger' && attacker.level >= 18)
  const purityOfSpirit = target.classId === 'paladin' && target.subclassId === 'devotion' && target.level >= 15 &&
    dnd5eProtectionCreatureType(attacker.creatureType)
  return unseenDisadvantage || purityOfSpirit
}

export function dnd5eReactionsPrevented(
  creature: Pick<Dnd5eDefensiveCreature, 'classState'> & Partial<Pick<Dnd5eDefensiveCreature, 'conditions'>>,
): boolean {
  return dnd5eIsIncapacitated(creature) || !!creature.classState.turnedByClericId ||
    dnd5eActiveEffectsPreventReactions(creature.classState.activeEffects) ||
    Object.keys(creature.classState.openHandNoReactionsAppliedTurnKeysBySource ?? {}).length > 0
}

export function dnd5eCanUseUncannyDodge(creature: Dnd5eDefensiveCreature & { currentHp: number; turn: { reactionAvailable: boolean } }): boolean {
  if (
    creature.currentHp <= 0 || !creature.turn.reactionAvailable ||
    dnd5eIsIncapacitated(creature) || dnd5eReactionsPrevented(creature)
  ) return false
  if (creature.classId === 'rogue' && creature.level >= 5) return true
  return creature.classId === 'ranger' && creature.subclassId === 'hunter' && creature.level >= 15 &&
    creature.classSelections['superior-hunters-defense']?.includes('uncanny-dodge') === true
}

export function dnd5eCanUseDeflectMissiles(creature: Dnd5eDefensiveCreature & { currentHp: number; turn: { reactionAvailable: boolean } }): boolean {
  return creature.classId === 'monk' && creature.level >= 3 && creature.currentHp > 0 &&
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
  const charmFearOrPossession = ['charmed', '魅惑', 'frightened', '惊惧', '恐慌', 'possessed', '附身'].includes(normalized)
  if (
    charmFearOrPossession && target.classId === 'paladin' && target.subclassId === 'devotion' && target.level >= 15 &&
    dnd5eProtectionCreatureType(source?.creatureType)
  ) return true
  const charmOrFear = ['charmed', '魅惑', 'frightened', '惊惧', '恐慌'].includes(normalized)
  if (
    !charmOrFear || target.classId !== 'druid' || target.subclassId !== 'land' || target.level < 10
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
  if (creature.classId === 'paladin' && creature.level >= 3) {
    conditionImmunities.push('disease', '疾病')
  }
  if (creature.classId === 'monk' && creature.level >= 10) {
    damageImmunities.push('poison')
    conditionImmunities.push('poisoned', '中毒', 'disease', '疾病')
  }
  if (creature.classId === 'druid' && creature.subclassId === 'land' && creature.level >= 10) {
    damageImmunities.push('poison')
    conditionImmunities.push('poisoned', '中毒', 'disease', '疾病')
  }
  if (creature.classId === 'barbarian' && creature.subclassId === 'berserker' && creature.level >= 6 && creature.classState.raging) {
    conditionImmunities.push('charmed', '魅惑', 'frightened', '惊惧', '恐慌')
  }
  return { damageImmunities, conditionImmunities }
}
