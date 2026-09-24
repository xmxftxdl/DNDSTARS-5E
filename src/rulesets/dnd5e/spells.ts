import coreSpellRules from '../../content/srd-5.1/core-spells.json'
import coreSpellChinese from '../../content/srd-5.1/localization/zh-CN.json'
import coreSpellEnglish from '../../content/srd-5.1/localization/en-US.json'
import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eMetamagicId, Dnd5eSustainedSpellControlId } from '../../lib/sharedCombatTypes'
import type { Character } from '../../types/character'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import type { D20RollMode } from '../contracts'
import { dnd5eClassDefinition, dnd5eClassDefinitionForCharacter, dnd5eClassProgression, dnd5ePactSlotLevel, dnd5ePreparedSpellCount, type Dnd5eClassId } from './classes'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import type { Dnd5eDamageType } from './monsters'
import { dnd5eBardMagicalSecretsOptions } from './spellCatalog'
import { imposeDnd5eRollAdvantage, imposeDnd5eRollDisadvantage } from './rollMode'
import { dnd5eCharacterClassLevel, normalizeDnd5eClassLevels } from './multiclass'
import {
  dnd5eEffectiveSpellcastingSource,
  dnd5eEffectiveSpellcastingSources,
  dnd5eEffectiveSpellSelections,
} from './subclassSpellcasting'
import { dnd5ePluginSubclassSpellIdsV1 } from './plugins/pluginSubclassSpellIds'
import { dnd5eCharacterBuildSpellGrantsV1 } from './buildChoices'
import { DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED } from './spellDescriptionsZh.reviewed.generated'

export type Dnd5eSpellSchool = '防护' | '咒法' | '预言' | '附魔' | '塑能' | '幻术' | '死灵' | '变化'
export type Dnd5eSpellCastingTime = 'action' | 'bonus-action' | 'reaction'
export type Dnd5eEnhanceAbilityChoice =
  | 'bear-endurance'
  | 'bull-strength'
  | 'cat-grace'
  | 'eagle-splendor'
  | 'fox-cunning'
  | 'owl-wisdom'
export type Dnd5eSpellEffectKind =
  | 'spell-attack'
  | 'saving-throw'
  | 'automatic-damage'
  | 'healing'
  | 'fixed-healing'
  | 'healing-pool'
  | 'sleep-hit-point-pool'
  | 'color-spray-hit-point-pool'
  | 'temporary-hit-points'
  | 'stabilize'
  | 'remove-condition'
  | 'active-effect'
  | 'mark'
  | 'armor-class-buff'
  | 'attack-save-buff'
  | 'attack-save-debuff'
  | 'power-word-kill'
  | 'power-word-stun'
  | 'counterspell'
  | 'dispel-magic'
  | 'teleport'
  | 'persistent-area'
  | 'narrative-effect'

export interface Dnd5eSpellDamageComponentDefinition {
  dice: { count: number; sides: number; bonus: number; perHigherSlot?: number }
  damageType: Dnd5eDamageType
  /** 焰击术等法术只把升环伤害加到施法者本次选择的伤害类型。 */
  higherSlotChoice?: boolean
}

/**
 * A follow-up control granted by an already cast spell.  The wire payload keeps
 * the historical `sustainedEffectAttack` name for backwards compatibility,
 * but movement, utility and repeated damage all derive from this declaration.
 */
export interface Dnd5eSustainedSpellAttackDefinition {
  id: Dnd5eSustainedSpellControlId
  economy: 'action' | 'bonus-action'
  origin: 'caster' | 'effect-token' | 'persistent-area'
  resolution?: 'spell-attack' | 'saving-throw' | 'automatic-damage' | 'dash'
  /** Required for sustained spell attacks; Parry and close-threat rules depend on it. */
  spellAttackMode?: 'melee' | 'ranged'
  relation?: 'hostile' | 'any'
  rangeFeet: number
  movementFeet?: number
  effectDurationRounds?: number
  immediateAttack?: boolean
  /** Only the original concentration target may be selected again. */
  lockToConcentrationTarget?: boolean
  /** Restore this fraction of the actual hit-point damage dealt. */
  healingFraction?: number
  /** The source effect is consumed after this follow-up is resolved. */
  endsAfterUse?: boolean
  /** Cantrip follow-up damage scales at character levels 5, 11 and 17. */
  cantripScaling?: boolean
  dice: {
    count: number
    sides: number
    /** 每跨过这么多环位，伤害骰增加一枚。 */
    additionalDieEverySlotLevels?: number
  }
  damageType: Dnd5eDamageType
}

export interface Dnd5eSrdSpellDefinition {
  id: string
  name: string
  englishName: string
  level: number
  school: Dnd5eSpellSchool
  classes: readonly Dnd5eClassId[]
  castingTime: Dnd5eSpellCastingTime
  rangeFeet: number
  target: 'hostile' | 'ally' | 'creature' | 'area'
  effect: Dnd5eSpellEffectKind
  /** Concrete attack delivery for `spell-attack` effects. */
  spellAttackMode?: 'melee' | 'ranged'
  /** This spell attack may target a guessed cell; the Host resolves occupancy. */
  allowsGuessedTargetCell?: boolean
  /** The SRD text explicitly requires the caster to see each selected target. */
  requiresVisibleTarget?: boolean | 'primary' | 'placement'
  /** Every selected target must be able to hear the caster. */
  requiresTargetCanHearSource?: boolean
  saveAbility?: AbilityKey
  /** 仅敌对（即不自愿）目标进行该豁免；友方目标视为自愿。 */
  unwillingSaveAbility?: AbilityKey
  damageOnSuccessfulSave?: 'none' | 'half'
  dice: { count: number; sides: number; bonus: number; perHigherSlot?: number }
  damageType?: Dnd5eDamageType
  /** The spell's damage cannot leave the target below this current HP value. */
  minimumHitPointsAfterDamage?: number
  /**
   * Closed, data-only consequence shared by spells that reduce maximum HP by
   * the damage actually taken on a failed save.
   */
  hitPointMaximumReductionOnFailedSave?: {
    durationRounds: number
    minimumMaximumHitPoints: number
    recovery: 'greater-restoration-or-other-magic'
  }
  /** 与主伤害骰池同时结算的其他伤害类型；一次伤害事件内分别应用抗性/易伤。 */
  additionalDamageComponents?: readonly Dnd5eSpellDamageComponentDefinition[]
  /** 主伤害骰池是否可承接“每升一环”的伤害类型选择。 */
  primaryHigherSlotChoice?: boolean
  /** 少数法术攻击即使未命中也会造成部分初始伤害。 */
  spellAttackMissDamage?: 'half'
  /** 命中后在目标下一回合结束时自动触发的后续伤害骰池。 */
  delayedDamage?: {
    dice: { count: number; sides: number; bonus: number; perHigherSlot?: number }
    damageType: Dnd5eDamageType
    timing: 'target-next-turn-end'
  }
  cantripScaling?: boolean
  addSpellcastingModifier?: boolean
  bonusPerDie?: boolean
  concentration?: boolean
  concentrationDurationRounds?: number
  maximumTargets?: number
  additionalTargetsPerHigherSlot?: number
  maximumTargetSeparationFeet?: number
  /** 连锁类法术：后续目标只需位于第一个目标指定距离内。 */
  secondaryTargetsWithinFeetOfFirst?: number
  /** 地图选区模板；尺寸属于法术效果，placeRangeFeet 仅限制模板原点。 */
  area?: SkillAoeTargeting
  /** Circle radius gained for each slot level above the spell's base level. */
  areaRadiusFeetPerHigherSlot?: number
  /** Number of distinct area origins that must be selected for one cast. */
  areaTargetCount?: number
  /** Minimum distinct origins for spells whose declared count is a maximum. */
  minimumAreaTargetCount?: number
  /** 少数“选择区域内生物”的法术允许施法者选择自己。 */
  areaIncludesSelf?: boolean
  /** 每道射线单独攻击时的基础射线数。 */
  baseProjectiles?: number
  additionalProjectilesPerHigherSlot?: number
  onHitEffect?: 'ray-of-frost' | 'shocking-grasp' | 'guiding-bolt' | 'chill-touch'
  onFailedSaveEffect?:
    | 'vicious-mockery'
    | 'thunderwave-push'
    | 'sunburst-blindness'
    | 'sunbeam-blindness'
    | 'blindness-deafness'
    | 'hideous-laughter'
    | 'charm-person'
    | 'hold-person'
    | 'hold-monster'
    | 'banishment'
    | 'faerie-fire'
    | 'hypnotic-pattern'
    | 'slow'
    | 'phantasmal-killer'
  appliedEffect?:
    | 'invisibility'
    | 'greater-invisibility'
    | 'blur'
    | 'barkskin'
    | 'protection-from-poison'
    | 'death-ward'
    | 'protection-from-energy'
    | 'longstrider'
    | 'mage-armor'
    | 'divine-favor'
    | 'jump'
    | 'darkvision'
    | 'see-invisibility'
    | 'warding-bond'
    | 'fly'
    | 'heroism'
    | 'enlarge-reduce'
    | 'enhance-ability'
    | 'flame-blade'
    | 'expeditious-retreat'
    | 'produce-flame'
    | 'shillelagh'
    | 'magic-weapon'
    | 'sanctuary'
    | 'guidance'
    | 'resistance'
    | 'calm-emotions'
  /** 法术持续期间授予的重复攻击。Host 会从 ActiveEffect 中恢复原始施法环位。 */
  sustainedAttack?: Dnd5eSustainedSpellAttackDefinition
  enlargeReduceOptions?: readonly ('enlarge' | 'reduce')[]
  enhanceAbilityOptions?: readonly Dnd5eEnhanceAbilityChoice[]
  effectDamageTypeOptions?: readonly Dnd5eDamageType[]
  effectDurationRounds?: number
  conditionOptions?: readonly ('blinded' | 'deafened' | 'paralyzed' | 'poisoned' | 'disease')[]
  fixedHealing?: number
  fixedHealingPerHigherSlot?: number
  healingPool?: number
  hitPointThreshold?: number
  description: string
}

export const DND5E_SRD_COMBAT_SPELLS: readonly Dnd5eSrdSpellDefinition[] = coreSpellRules.map(rule => ({
  ...rule,
  name: coreSpellChinese[`spell.${rule.id}.name` as keyof typeof coreSpellChinese],
  description: coreSpellChinese[`spell.${rule.id}.description` as keyof typeof coreSpellChinese],
  englishName: coreSpellEnglish[`spell.${rule.id}.name` as keyof typeof coreSpellEnglish],
})) as readonly Dnd5eSrdSpellDefinition[]

const spellsById = new Map(DND5E_SRD_COMBAT_SPELLS.map((spell) => [spell.id, spell]))

export function getDnd5eSrdCombatSpell(id: string): Dnd5eSrdSpellDefinition | undefined {
  return spellsById.get(id)
}

/** Audited SRD ritual metadata shared by the Host bridge and Headless engine. */
export function dnd5eSrdSpellIsRitual(id: string): boolean {
  return DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED[id]?.ritual === true
}

export function dnd5eSpellAreaAtSlot(
  spell: Pick<Dnd5eSrdSpellDefinition, 'level' | 'area' | 'areaRadiusFeetPerHigherSlot'>,
  slotLevel: number,
): SkillAoeTargeting | undefined {
  if (!spell.area) return undefined
  if (spell.area.shape !== 'circle' || !spell.areaRadiusFeetPerHigherSlot) return { ...spell.area }
  return {
    ...spell.area,
    radiusFeet: spell.area.radiusFeet +
      Math.max(0, Math.floor(slotLevel) - spell.level) * spell.areaRadiusFeetPerHigherSlot,
  }
}

export function dnd5eSpellAttackDelivery(
  spell: Dnd5eSrdSpellDefinition,
  sustainedAttack?: Dnd5eSustainedSpellAttackDefinition,
): 'melee' | 'ranged' | undefined {
  if (sustainedAttack) {
    if (
      sustainedAttack.resolution === 'saving-throw' ||
      sustainedAttack.resolution === 'automatic-damage' ||
      sustainedAttack.resolution === 'dash' ||
      sustainedAttack.id === 'call-lightning'
    ) return undefined
    return sustainedAttack.spellAttackMode
  }
  return spell.effect === 'spell-attack' ? spell.spellAttackMode : undefined
}

export function dnd5eCantripDiceMultiplier(level: number): number {
  if (level >= 17) return 4
  if (level >= 11) return 3
  if (level >= 5) return 2
  return 1
}

export function dnd5eSpellDiceCount(spell: Dnd5eSrdSpellDefinition, casterLevel: number, slotLevel: number): number {
  if (spell.level === 0) return spell.dice.count * dnd5eCantripDiceMultiplier(casterLevel)
  return spell.dice.count + Math.max(0, slotLevel - spell.level) * (spell.dice.perHigherSlot ?? 0)
}

export function dnd5eSustainedSpellAttackDiceCount(
  spell: Dnd5eSrdSpellDefinition,
  slotLevel: number,
  casterLevel = 1,
): number {
  const attack = spell.sustainedAttack
  if (!attack) return 0
  if (attack.cantripScaling && spell.level === 0) {
    return attack.dice.count * dnd5eCantripDiceMultiplier(casterLevel)
  }
  if (attack.dice.additionalDieEverySlotLevels == null) return attack.dice.count
  const interval = Math.max(1, Math.floor(attack.dice.additionalDieEverySlotLevels))
  return attack.dice.count + Math.floor(Math.max(0, slotLevel - spell.level) / interval)
}

export function dnd5eSpellDamageDiceCounts(
  spell: Dnd5eSrdSpellDefinition,
  casterLevel: number,
  slotLevel: number,
  higherSlotDamageType?: Dnd5eDamageType,
): readonly number[] {
  const higherSlots = Math.max(0, slotLevel - spell.level)
  const selectedChoice = higherSlots > 0 ? higherSlotDamageType : undefined
  const primaryHigherDice = spell.primaryHigherSlotChoice
    ? selectedChoice === spell.damageType ? higherSlots * (spell.dice.perHigherSlot ?? 0) : 0
    : higherSlots * (spell.dice.perHigherSlot ?? 0)
  const primary = spell.level === 0
    ? spell.dice.count * dnd5eCantripDiceMultiplier(casterLevel)
    : spell.dice.count + primaryHigherDice
  return [
    primary,
    ...(spell.additionalDamageComponents ?? []).map((component) => component.dice.count + (
      component.higherSlotChoice
        ? selectedChoice === component.damageType ? higherSlots * (component.dice.perHigherSlot ?? 0) : 0
        : higherSlots * (component.dice.perHigherSlot ?? 0)
    )),
  ]
}

export function dnd5eSpellHigherSlotDamageChoices(
  spell: Dnd5eSrdSpellDefinition,
  slotLevel: number,
): readonly Dnd5eDamageType[] {
  if (slotLevel <= spell.level) return []
  return [
    ...(spell.primaryHigherSlotChoice && spell.damageType ? [spell.damageType] : []),
    ...(spell.additionalDamageComponents ?? []).flatMap((component) =>
      component.higherSlotChoice ? [component.damageType] : [],
    ),
  ]
}

export function dnd5eSpellDelayedDamageDiceCount(
  spell: Dnd5eSrdSpellDefinition,
  slotLevel: number,
): number {
  const delayed = spell.delayedDamage
  if (!delayed) return 0
  return delayed.dice.count + Math.max(0, slotLevel - spell.level) * (delayed.dice.perHigherSlot ?? 0)
}

export function dnd5eSpellProjectileCount(
  spell: Dnd5eSrdSpellDefinition,
  casterLevel: number,
  slotLevel: number,
): number | undefined {
  if (spell.id === 'eldritch-blast') return dnd5eCantripDiceMultiplier(casterLevel)
  if (spell.id === 'magic-missile') return dnd5eSpellDiceCount(spell, casterLevel, slotLevel)
  if (spell.baseProjectiles == null) return undefined
  return Math.max(1, spell.baseProjectiles +
    Math.max(0, slotLevel - spell.level) * (spell.additionalProjectilesPerHigherSlot ?? 0))
}

export function dnd5eSpellConcentrationDurationRounds(spell: Dnd5eSrdSpellDefinition, slotLevel: number): number {
  if (spell.id === 'hunters-mark') {
    if (slotLevel >= 5) return 14_400
    if (slotLevel >= 3) return 4_800
  }
  return Math.max(1, spell.concentrationDurationRounds ?? 1)
}

export function dnd5eSpellMaximumTargets(
  spell: Dnd5eSrdSpellDefinition,
  slotLevel: number,
  casterLevel?: number,
): number {
  const projectiles = dnd5eSpellProjectileCount(spell, casterLevel ?? 1, slotLevel)
  if (projectiles != null) return projectiles
  return Math.max(1, (spell.maximumTargets ?? 1) +
    Math.max(0, slotLevel - spell.level) * (spell.additionalTargetsPerHigherSlot ?? 0))
}

export function dnd5eSpellAllowsRepeatedTargets(spell: Dnd5eSrdSpellDefinition): boolean {
  return spell.id === 'magic-missile' || spell.id === 'eldritch-blast' || spell.baseProjectiles != null
}

export function dnd5eSpellUsesSequencedAttacks(spell: Dnd5eSrdSpellDefinition): boolean {
  return spell.effect === 'spell-attack' && (spell.id === 'eldritch-blast' || spell.baseProjectiles != null)
}

export function dnd5eSpellAreaLabel(
  spell: Pick<Dnd5eSrdSpellDefinition, 'area'> & Partial<Pick<Dnd5eSrdSpellDefinition, 'id'>>,
): string | undefined {
  const area = spell.area
  if (!area) return undefined
  if (area.shape === 'circle') {
    const placement = area.origin === 'point' && area.placeRangeFeet != null ? `${area.placeRangeFeet}尺内一点，` : '以自身为中心，'
    return `${placement}${area.radiusFeet}尺半径球形（直径${area.radiusFeet * 2}尺）`
  }
  if (area.shape === 'cone') return `自身起点，${area.lengthFeet}尺锥形`
  if (area.shape === 'line') {
    if (spell.id === 'thunderwave') return '自身起点，15×15尺立方区域'
    return `自身起点，${area.lengthFeet}尺长、${area.widthFeet}尺宽直线`
  }
  return `${area.placeRangeFeet != null ? `${area.placeRangeFeet}尺内，` : ''}${area.widthFeet}×${area.heightFeet}尺区域`
}

export function dnd5eSpellSelectionKey(character: Pick<Character, 'charClass'>): 'spell-known' | 'spell-prepared' | undefined {
  const kind = dnd5eClassDefinitionForCharacter(character)?.spellcasting?.kind
  if (!kind) return undefined
  return kind === 'full-known' || kind === 'half-known' || kind === 'one-third-known' || kind === 'pact'
    ? 'spell-known'
    : 'spell-prepared'
}

export const DND5E_BARD_MAGICAL_SECRETS_KEY = 'magical-secrets'
export const DND5E_LORE_ADDITIONAL_MAGICAL_SECRETS_KEY = 'lore-additional-magical-secrets'

export function dnd5eBardMagicalSecretsLimit(character: Pick<Character, 'charClass' | 'level'>): number {
  const definition = dnd5eClassDefinitionForCharacter(character)
  if (definition?.id !== 'bard') return 0
  if (character.level >= 18) return 6
  if (character.level >= 14) return 4
  return character.level >= 10 ? 2 : 0
}

export function dnd5eLoreAdditionalMagicalSecretsLimit(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassChoices'>,
): number {
  const definition = dnd5eClassDefinitionForCharacter(character)
  const subclass = definition && character.dnd5eClassChoices?.classes?.[definition.id]?.subclass
  return definition?.id === 'bard' && subclass === 'lore' && character.level >= 6 ? 2 : 0
}

export function dnd5eBardMagicalSecretsMaxSpellLevel(character: Pick<Character, 'charClass' | 'level'>): number {
  const definition = dnd5eClassDefinitionForCharacter(character)
  if (definition?.id !== 'bard') return 0
  const progression = dnd5eClassProgression(definition)[Math.max(0, Math.min(19, character.level - 1))]
  return progression.spellSlots.length
}

export function dnd5eBardMagicalSecretSpellIds(character: Character): readonly string[] {
  const definition = dnd5eClassDefinitionForCharacter(character)
  if (definition?.id !== 'bard') return []
  const selections = character.dnd5eClassChoices?.classes?.bard?.selections
  const allowed = new Set(dnd5eBardMagicalSecretsOptions(dnd5eBardMagicalSecretsMaxSpellLevel(character)).map((spell) => spell.id))
  const core = (selections?.[DND5E_BARD_MAGICAL_SECRETS_KEY] ?? [])
    .slice(0, dnd5eBardMagicalSecretsLimit(character))
  const lore = (selections?.[DND5E_LORE_ADDITIONAL_MAGICAL_SECRETS_KEY] ?? [])
    .slice(0, dnd5eLoreAdditionalMagicalSecretsLimit(character))
  return [...new Set([...core, ...lore])].filter((id) => allowed.has(id))
}

/** All spells selected on the character sheet, including reference-only entries. */
export function dnd5eSelectedSpellIdsForClass(character: Character, classId: Dnd5eClassId): readonly string[] {
  const source = dnd5eEffectiveSpellcastingSource(character, classId)
  if (!source) return []
  const selections = dnd5eEffectiveSpellSelections(character, source)
  const classCharacter = classId === 'bard'
    ? {
        ...character,
        charClass: dnd5eClassDefinition('bard')!.name,
        level: dnd5eCharacterClassLevel(character, 'bard'),
      }
    : character
  const subclassId = classId === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.subclass
    : character.dnd5eClassChoices?.classes?.[classId]?.subclass
  const subclassSpells = dnd5ePluginSubclassSpellIdsV1(
    subclassId,
    dnd5eCharacterClassLevel(character, classId),
    'always-prepared',
  )
  return [...new Set([
    ...(selections[source.cantripSelectionKey] ?? []),
    ...(selections[source.spellSelectionKey] ?? []),
    ...(selections?.['spell-mastery-1'] ?? []),
    ...(selections?.['spell-mastery-2'] ?? []),
    ...(selections?.['signature-spells'] ?? []),
    ...(selections?.['mystic-arcanum-6'] ?? []),
    ...(selections?.['mystic-arcanum-7'] ?? []),
    ...(selections?.['mystic-arcanum-8'] ?? []),
    ...(selections?.['mystic-arcanum-9'] ?? []),
    ...(classId === 'bard' ? dnd5eBardMagicalSecretSpellIds(classCharacter) : []),
    ...subclassSpells,
  ])]
}

export function dnd5eSubclassSpellIdsForClass(
  character: Character,
  classId: Dnd5eClassId,
  mode?: 'always-prepared' | 'expanded-list',
): readonly string[] {
  const subclassId = classId === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.subclass
    : character.dnd5eClassChoices?.classes?.[classId]?.subclass
  return dnd5ePluginSubclassSpellIdsV1(
    subclassId,
    dnd5eCharacterClassLevel(character, classId),
    mode,
  )
}

/** All spells selected on every owned spellcasting class. */
export function dnd5eSelectedSpellIds(character: Character): readonly string[] {
  return [...new Set([
    ...(Object.keys(normalizeDnd5eClassLevels(character)) as Dnd5eClassId[])
      .flatMap((classId) => dnd5eSelectedSpellIdsForClass(character, classId)),
    ...dnd5eCharacterBuildSpellGrantsV1(character).map((grant) => grant.spellId),
  ])]
}

/**
 * Returns every owned class that can authoritatively cast this selected spell.
 * Bard Magical Secrets remain bard spells for this purpose even when the spell
 * does not normally appear on the bard list.
 */
export function dnd5eSpellcastingClassIdsForSpell(
  character: Character,
  spellId: string,
  allowedClasses?: readonly Dnd5eClassId[],
): readonly Dnd5eClassId[] {
  const buildGrant = dnd5eCharacterBuildSpellGrantsV1(character)
    .find((grant) => grant.spellId === spellId)
  return dnd5eEffectiveSpellcastingSources(character).map((source) => source.classId).filter((classId) => {
    const source = dnd5eEffectiveSpellcastingSource(character, classId)
    if (!source || (!buildGrant && !dnd5eSelectedSpellIdsForClass(character, classId).includes(spellId))) return false
    if (buildGrant) return true
    if (
      !allowedClasses || allowedClasses.includes(source.spellListClassId) ||
      dnd5eSubclassSpellIdsForClass(character, classId).includes(spellId)
    ) return true
    return classId === 'bard' && dnd5eBardMagicalSecretSpellIds({
      ...character,
      charClass: dnd5eClassDefinition('bard')!.name,
      level: dnd5eCharacterClassLevel(character, 'bard'),
    }).includes(spellId)
  })
}

export function dnd5eSpellcastingClassIdForSpell(
  character: Character,
  spellId: string,
  requestedClassId?: Dnd5eClassId,
  allowedClasses?: readonly Dnd5eClassId[],
): Dnd5eClassId | undefined {
  const available = dnd5eSpellcastingClassIdsForSpell(character, spellId, allowedClasses)
  if (requestedClassId) return available.includes(requestedClassId) ? requestedClassId : undefined
  const primary = dnd5eClassDefinitionForCharacter(character)?.id
  return primary && available.includes(primary) ? primary : available[0]
}

export function dnd5eSelectedCombatSpellIds(character: Character): readonly string[] {
  return dnd5eSelectedSpellIds(character).filter((id) => spellsById.has(id))
}

export interface Dnd5eFreeSpellCastSource {
  kind: 'spell-mastery' | 'signature-spell' | 'mystic-arcanum'
  resourceKey?: string
}

export function dnd5eCanOverchannelSpell(
  caster: { classId?: Dnd5eClassId; subclassId?: string; level: number },
  spell: Pick<Dnd5eSrdSpellDefinition, 'classes' | 'damageType' | 'level' | 'school'>,
  slotLevel: number,
): boolean {
  return caster.classId === 'wizard' && caster.subclassId === 'evocation' && caster.level >= 14 &&
    spell.classes.includes('wizard') && spell.school === '塑能' && spell.damageType != null &&
    spell.level >= 1 && Number.isInteger(slotLevel) && slotLevel >= spell.level && slotLevel <= 5
}

/** 塑能学派“法术塑形”只适用于会迫使区域内生物进行豁免的塑能法术。 */
export function dnd5eCanSculptSpell(
  caster: { classId?: Dnd5eClassId; subclassId?: string; level: number },
  spell: Pick<Dnd5eSrdSpellDefinition, 'effect' | 'level' | 'school' | 'target'>,
): boolean {
  return caster.classId === 'wizard' && caster.subclassId === 'evocation' && caster.level >= 2 &&
    spell.school === '塑能' && spell.target === 'area' && spell.effect === 'saving-throw'
}

export function dnd5eSculptSpellMaximumTargets(
  spell: Pick<Dnd5eSrdSpellDefinition, 'level'>,
): number {
  return 1 + Math.max(0, Math.floor(spell.level))
}

export const DND5E_IMPLEMENTED_METAMAGIC_IDS = [
  'careful', 'distant', 'extended', 'heightened', 'quickened', 'subtle', 'twinned',
] as const satisfies readonly Dnd5eMetamagicId[]

export type Dnd5eImplementedMetamagicId = typeof DND5E_IMPLEMENTED_METAMAGIC_IDS[number]

const METAMAGIC_LABELS: Record<Dnd5eMetamagicId, string> = {
  careful: '谨慎法术',
  distant: '远距法术',
  empowered: '强效法术',
  extended: '延效法术',
  heightened: '升阶法术',
  quickened: '瞬发法术',
  subtle: '精妙法术',
  twinned: '孪生法术',
}

export function dnd5eMetamagicLabel(kind: Dnd5eMetamagicId): string {
  return METAMAGIC_LABELS[kind]
}

export function dnd5eMetamagicCost(kind: Dnd5eMetamagicId, spellLevel?: number): number {
  if (kind === 'heightened') return 3
  if (kind === 'quickened') return 2
  if (kind === 'twinned') {
    return spellLevel == null || !Number.isInteger(spellLevel) || spellLevel < 0
      ? Number.POSITIVE_INFINITY
      : Math.max(1, spellLevel)
  }
  return (DND5E_IMPLEMENTED_METAMAGIC_IDS as readonly Dnd5eMetamagicId[]).includes(kind)
    ? 1
    : Number.POSITIVE_INFINITY
}

export function dnd5eMetamagicAvailableForSpell(
  kind: Dnd5eMetamagicId,
  spell: Dnd5eSrdSpellDefinition,
  slotLevel = spell.level,
): kind is Dnd5eImplementedMetamagicId {
  if (!(DND5E_IMPLEMENTED_METAMAGIC_IDS as readonly Dnd5eMetamagicId[]).includes(kind)) return false
  if (kind === 'careful') return spell.effect === 'saving-throw'
  if (kind === 'distant') return spell.rangeFeet > 0
  if (kind === 'extended') {
    const durationRounds = spell.concentration
      ? dnd5eSpellConcentrationDurationRounds(spell, spell.level)
      : spell.effectDurationRounds ?? 0
    return durationRounds >= 10
  }
  if (kind === 'heightened') {
    return spell.effect === 'saving-throw' || spell.effect === 'attack-save-debuff' ||
      spell.unwillingSaveAbility != null
  }
  if (kind === 'quickened') return spell.castingTime === 'action'
  if (kind === 'twinned') {
    return spell.target !== 'area' && spell.rangeFeet > 0 &&
      dnd5eSpellMaximumTargets(spell, slotLevel) === 1
  }
  return kind === 'subtle'
}

export function dnd5eCanEmpowerSpell(
  spell: Pick<Dnd5eSrdSpellDefinition, 'damageType' | 'dice' | 'effect' | 'additionalDamageComponents' | 'delayedDamage'>,
): boolean {
  return spell.damageType != null && spell.dice.count > 0 &&
    (spell.additionalDamageComponents?.length ?? 0) === 0 && spell.delayedDamage == null &&
    (spell.effect === 'spell-attack' || spell.effect === 'saving-throw' || spell.effect === 'automatic-damage')
}

export function dnd5eMetamagicRangeFeet(
  spell: Pick<Dnd5eSrdSpellDefinition, 'rangeFeet'>,
  distant: boolean,
): number {
  if (!distant) return spell.rangeFeet
  return spell.rangeFeet <= 5 ? 30 : spell.rangeFeet * 2
}

export function dnd5eCarefulSpellMaximumTargets(charismaScore: number): number {
  return Math.max(1, rules.abilityModifier(charismaScore))
}

export function dnd5eHeightenedSavingThrowMode(
  mode: 'normal' | 'advantage' | 'disadvantage',
  heightened: boolean,
): 'normal' | 'advantage' | 'disadvantage' {
  return heightened ? imposeDnd5eRollDisadvantage(mode, 'heightened-spell').mode : mode
}

export function dnd5eSpellSpecificSavingThrowMode(input: {
  spellId: string
  mode: D20RollMode
  casterAndTargetAreFighting: boolean
  targetStatBlockId?: string
  targetName?: string
  targetCreatureType?: string
}): D20RollMode {
  if (input.spellId === 'charm-person' && input.casterAndTargetAreFighting) {
    return imposeDnd5eRollAdvantage(input.mode, 'charm-person-combat').mode
  }
  if (input.spellId === 'shatter' && dnd5eShatterTargetMadeOfInorganicMaterial(input)) {
    return imposeDnd5eRollDisadvantage(input.mode, 'shatter-inorganic-material').mode
  }
  const creatureType = (input.targetCreatureType ?? '').trim().toLowerCase()
  if (
    (input.spellId === 'sunbeam' || input.spellId === 'sunburst') &&
    (
      creatureType === 'undead' || creatureType.includes('亡灵') ||
      creatureType === 'ooze' || creatureType.includes('泥怪')
    )
  ) {
    return imposeDnd5eRollDisadvantage(input.mode, `${input.spellId}-undead-ooze`).mode
  }
  return input.mode
}

const DND5E_SHATTER_INORGANIC_SRD_SLUGS = new Set([
  'animated-armor',
  'clay-golem',
  'earth-elemental',
  'flying-sword',
  'gargoyle',
  'iron-golem',
  'shield-guardian',
  'stone-golem',
])

/**
 * Closed SRD classification for Shatter's stone/crystal/metal save clause.
 * Names are only used for un-namespaced SRD fixtures; arbitrary custom names
 * never silently acquire a mechanical disadvantage.
 */
export function dnd5eShatterTargetMadeOfInorganicMaterial(input: {
  targetStatBlockId?: string
  targetName?: string
}): boolean {
  const statBlockSlug = input.targetStatBlockId?.trim().toLowerCase().split(':').at(-1)
  if (statBlockSlug && DND5E_SHATTER_INORGANIC_SRD_SLUGS.has(statBlockSlug)) return true
  const targetName = input.targetName?.trim().toLowerCase()
  return targetName != null && DND5E_SHATTER_INORGANIC_SRD_SLUGS.has(targetName)
}

export function dnd5eCharmPersonEligibleCreatureType(creatureType: string | undefined): boolean {
  const normalized = (creatureType ?? '').trim().toLowerCase()
  return normalized === 'humanoid' || normalized.includes('类人')
}

export function dnd5eDraconicAncestorDamageType(
  ancestorId: string | undefined,
): Extract<Dnd5eDamageType, 'acid' | 'cold' | 'fire' | 'lightning' | 'poison'> | undefined {
  const damageType = ancestorId?.split('-').at(-1)
  return damageType === 'acid' || damageType === 'cold' || damageType === 'fire' ||
    damageType === 'lightning' || damageType === 'poison'
    ? damageType
    : undefined
}

/**
 * Returns the resistance type granted by Draconic Bloodline's Elemental Affinity,
 * or undefined when this cast is not eligible. Resource availability is validated
 * by the caller because Metamagic and this option share the same point pool.
 */
export function dnd5eDraconicElementalResistanceType(
  caster: {
    classId?: Dnd5eClassId
    subclassId?: string
    level: number
    classSelections: Readonly<Record<string, readonly string[] | undefined>>
  },
  spell: Pick<Dnd5eSrdSpellDefinition, 'damageType'>,
): Extract<Dnd5eDamageType, 'acid' | 'cold' | 'fire' | 'lightning' | 'poison'> | undefined {
  if (caster.classId !== 'sorcerer' || caster.subclassId !== 'draconic' || caster.level < 6) return undefined
  const damageType = dnd5eDraconicAncestorDamageType(caster.classSelections['dragon-ancestor']?.[0])
  return damageType && spell.damageType === damageType ? damageType : undefined
}

function mysticArcanumClassLevel(spellLevel: number): number | undefined {
  if (spellLevel === 6) return 11
  if (spellLevel === 7) return 13
  if (spellLevel === 8) return 15
  if (spellLevel === 9) return 17
  return undefined
}

export function dnd5eFreeSpellCastSource(
  caster: {
    classId?: Dnd5eClassId
    level: number
    classSelections: Readonly<Record<string, readonly string[] | undefined>>
    classResources: Readonly<Record<string, { current: number; max: number } | undefined>>
  },
  spell: Pick<Dnd5eSrdSpellDefinition, 'id' | 'level'>,
  slotLevel: number,
): Dnd5eFreeSpellCastSource | undefined {
  if (slotLevel !== spell.level) return undefined
  if (caster.classId === 'warlock') {
    const requiredLevel = mysticArcanumClassLevel(spell.level)
    const resourceKey = `dnd5e-mystic-arcanum-${spell.level}`
    if (
      requiredLevel != null && caster.level >= requiredLevel &&
      caster.classSelections[`mystic-arcanum-${spell.level}`]?.includes(spell.id) &&
      (caster.classResources[resourceKey]?.current ?? 0) > 0
    ) return { kind: 'mystic-arcanum', resourceKey }
    return undefined
  }
  if (caster.classId !== 'wizard') return undefined
  if (
    caster.level >= 18 &&
    ((spell.level === 1 && caster.classSelections['spell-mastery-1']?.includes(spell.id)) ||
      (spell.level === 2 && caster.classSelections['spell-mastery-2']?.includes(spell.id)))
  ) return { kind: 'spell-mastery' }
  if (caster.level < 20 || spell.level !== 3) return undefined
  const index = caster.classSelections['signature-spells']?.indexOf(spell.id) ?? -1
  if (index < 0 || index > 1) return undefined
  const resourceKey = `dnd5e-signature-spell-${index + 1}`
  return (caster.classResources[resourceKey]?.current ?? 0) > 0
    ? { kind: 'signature-spell', resourceKey }
    : undefined
}

export function dnd5eAvailableCombatSpells(character: Character): readonly Dnd5eSrdSpellDefinition[] {
  const primaryClassId = dnd5eClassDefinitionForCharacter(character)?.id
  if (!primaryClassId) return []
  const source = dnd5eEffectiveSpellcastingSource(character, primaryClassId)
  if (!source) return []
  const progression = dnd5eClassProgression(source.definition)[Math.max(0, Math.min(19, source.classLevel - 1))]
  const highestLevel = source.definition.spellcasting?.kind === 'pact'
    ? dnd5ePactSlotLevel(source.classLevel)
    : progression.spellSlots.length
  const subclassOptions = new Set(dnd5eSubclassSpellIdsForClass(character, primaryClassId))
  return DND5E_SRD_COMBAT_SPELLS.filter((spell) =>
    (spell.classes.includes(source.spellListClassId) || subclassOptions.has(spell.id)) &&
    (spell.level === 0 ? (progression.cantripsKnown ?? 0) > 0 : spell.level <= highestLevel),
  )
}

export function dnd5eCombatSpellSelectionLimits(character: Character): { cantrips: number; spells: number } {
  const primaryClassId = dnd5eClassDefinitionForCharacter(character)?.id
  const source = primaryClassId ? dnd5eEffectiveSpellcastingSource(character, primaryClassId) : undefined
  if (!source) return { cantrips: 0, spells: 0 }
  const definition = source.definition
  const spellcasting = definition.spellcasting
  if (!spellcasting) return { cantrips: 0, spells: 0 }
  const progression = dnd5eClassProgression(definition)[Math.max(0, Math.min(19, source.classLevel - 1))]
  let spells = spellcasting.kind === 'full-known' ||
    spellcasting.kind === 'half-known' ||
    spellcasting.kind === 'one-third-known' ||
    spellcasting.kind === 'pact'
    ? progression.spellsKnown ?? 0
    : dnd5ePreparedSpellCount(character) ?? 0
  // 吟游诗人表中的 Spells Known 已包含 10、14、18 级各两项魔法奥秘，
  // 因此普通吟游诗人法表选择必须扣除这些独立名额。逸闻学院的额外魔法奥秘不计入该表。
  if (definition.id === 'bard') spells = Math.max(0, spells - dnd5eBardMagicalSecretsLimit(character))
  return { cantrips: progression.cantripsKnown ?? 0, spells }
}
