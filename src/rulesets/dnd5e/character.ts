import type { AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import { createDnd5eCombatant, hydrateDnd5eWildShapeCombatant } from './headlessCombatEngine'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eArmorClass } from './equipment'
import { dnd5eEquippedEffectTotal } from './equipmentEffects'
import { FIGHTER_RESOURCE_KEYS, fighterResourceState, fighterSelectedFightingStyles } from './fighter'
import {
  dnd5eClassDefinitionForCharacter,
  dnd5eEffectiveSavingThrowProficiencies,
  dnd5eWalkingSpeed,
  type Dnd5eClassId,
} from './classes'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
import { syncDnd5ePrimalChampion } from './hitPoints'
import { dnd5eCharacterHasPluginFeature, dnd5ePluginBackgroundDefinition, registeredDnd5ePluginFeatures } from './pluginApi'
import { dnd5eCharacterClassLevel, dnd5eTotalCharacterLevel, normalizeDnd5eClassLevels, type Dnd5eClassLevels } from './multiclass'

export interface Dnd5eDeathSaves {
  successes: number
  failures: number
  stable: boolean
  dead: boolean
}

export interface Dnd5eCharacter {
  id: string
  name: string
  player: string
  level: number
  abilities: Record<AbilityKey, number>
  savingThrowProficiencies: readonly AbilityKey[]
  skillProficiencies: readonly string[]
  passivePerception: number
  armorClass: number
  currentHp: number
  maxHp: number
  temporaryHp: number
  exhaustionLevel: number
  speed: number
  movementSpeeds?: { walk: number; climb?: number; swim?: number; fly?: number }
  initiativeBonus: number
  hitPointDice: readonly { sides: number; current: number; max: number }[]
  deathSaves: Dnd5eDeathSaves
  concentrating: boolean
  inspiration: boolean
  conditions: readonly string[]
  classResources: Record<string, { current: number; max: number }>
  classId?: Dnd5eClassId
  subclassId?: string
  classLevels: Dnd5eClassLevels
  subclassIds: Partial<Record<Dnd5eClassId, string>>
  classSelections: Record<string, string[]>
  classSelectionsByClass: Partial<Record<Dnd5eClassId, Record<string, string[]>>>
  pluginFeatureIds: readonly string[]
  wearingArmor: boolean
  wearingHeavyArmor: boolean
  wearingMetalArmor: boolean
  hasShield: boolean
  classState: NonNullable<Character['dnd5eCombatState']>
  savingThrowEquipmentBonus?: number
}

const DND5E_DAMAGE_TYPE_SET = new Set<string>(DND5E_DAMAGE_TYPES)

function normalizedDamageTypes(values: readonly string[] | undefined): Dnd5eDamageType[] | undefined {
  if (!values) return undefined
  return values.filter((value): value is Dnd5eDamageType => DND5E_DAMAGE_TYPE_SET.has(value))
}

function dnd5eClassResources(character: Character): Record<string, { current: number; max: number }> {
  const resources = Object.fromEntries(Object.entries(character.classResources ?? {}).map(([key, value]) => [key, { ...value }]))
  const fighterLevel = dnd5eCharacterClassLevel(character, 'fighter')
  if (fighterLevel < 1) return resources
  for (const key of Object.values(FIGHTER_RESOURCE_KEYS)) {
    const resource = fighterResourceState({ ...character, level: fighterLevel }, key)
    if (resource.max > 0) resources[key] = resource
  }
  return resources
}

export function normalizeLegacyAbilityScore(score: number): number {
  if (score <= 20) return Math.min(30, Math.max(1, Math.floor(score)))
  const legacyModifier = Math.floor((score - 25) / 5)
  return Math.min(30, Math.max(1, 10 + legacyModifier * 2))
}

export function normalizeLegacyAbilities(abilities: Record<AbilityKey, number>): Record<AbilityKey, number> {
  return {
    str: normalizeLegacyAbilityScore(abilities.str),
    dex: normalizeLegacyAbilityScore(abilities.dex),
    con: normalizeLegacyAbilityScore(abilities.con),
    int: normalizeLegacyAbilityScore(abilities.int),
    wis: normalizeLegacyAbilityScore(abilities.wis),
    cha: normalizeLegacyAbilityScore(abilities.cha),
  }
}

function parseHitPointDie(value: string): number {
  const match = value.trim().match(/^\d*d(\d+)$/i)
  return match ? Math.max(2, Number(match[1])) : 8
}

/**
 * One-way boundary from legacy persisted characters into the SRD runtime model.
 * AP, cooldowns, custom class resources, and legacy class features are deliberately ignored.
 */
export function migrateCharacterToDnd5e(inputCharacter: Character): Dnd5eCharacter {
  const character = syncDnd5ePrimalChampion(inputCharacter)
  const classLevels = normalizeDnd5eClassLevels(character)
  const level = dnd5eTotalCharacterLevel(character)
  const hitDieSides = parseHitPointDie(character.hitDice)
  const classDefinition = dnd5eClassDefinitionForCharacter(character)
  const subclassId = classDefinition?.id === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.subclass
    : classDefinition
      ? character.dnd5eClassChoices?.classes?.[classDefinition.id]?.subclass
      : undefined
  const armor = character.equipment?.armor?.dnd5e
  const exhaustionLevel = Math.min(6, Math.max(0, Math.floor(character.exhaustionLevel ?? 0)))
  const storedMaxHp = Math.max(1, Math.floor(character.maxHp))
  const effectiveMaxHp = exhaustionLevel >= 4 ? Math.max(1, Math.floor(storedMaxHp / 2)) : storedMaxHp
  const classSelectionsByClass = Object.fromEntries(Object.keys(classLevels).map((classId) => {
    const typedClassId = classId as Dnd5eClassId
    const selections = Object.fromEntries(Object.entries(character.dnd5eClassChoices?.classes?.[typedClassId]?.selections ?? {})
      .map(([key, values]) => [key, [...values]]))
    if (typedClassId === 'fighter') selections['fighting-style'] = [...fighterSelectedFightingStyles({
      ...character,
      level: dnd5eCharacterClassLevel(character, 'fighter'),
    })]
    return [typedClassId, selections]
  })) as Partial<Record<Dnd5eClassId, Record<string, string[]>>>
  const classSelections: Record<string, string[]> = Object.values(classSelectionsByClass).reduce<Record<string, string[]>>(
    (all, selections) => {
      for (const [key, values] of Object.entries(selections ?? {})) all[key] = [...new Set([...(all[key] ?? []), ...values])]
      return all
    },
    {},
  )
  const subclassIds = Object.fromEntries(Object.keys(classLevels).flatMap((classId) => {
    const typedClassId = classId as Dnd5eClassId
    const selected = typedClassId === 'fighter'
      ? character.dnd5eClassChoices?.fighter?.subclass
      : character.dnd5eClassChoices?.classes?.[typedClassId]?.subclass
    return selected ? [[typedClassId, selected]] : []
  })) as Partial<Record<Dnd5eClassId, string>>
  const loreBonusSkills = dnd5eCharacterClassLevel(character, 'bard') >= 3 ? classSelections['lore-bonus-skills'] ?? [] : []
  const beguilingInfluenceSkills = dnd5eCharacterClassLevel(character, 'warlock') >= 2 &&
    classSelections['eldritch-invocations']?.includes('beguiling-influence')
    ? ['deception', 'persuasion']
    : []
  const backgroundSkills = dnd5ePluginBackgroundDefinition(character.dnd5eBackgroundId ?? character.background)
    ?.skillProficiencies ?? character.dnd5eBackgroundSkillProficiencies ?? []
  return {
    id: character.id,
    name: character.name,
    player: character.player,
    level,
    abilities: character.rulesetId ? { ...character.abilities } : normalizeLegacyAbilities(character.abilities),
    savingThrowProficiencies: [...dnd5eEffectiveSavingThrowProficiencies(character)],
    skillProficiencies: [...new Set([...character.skills, ...backgroundSkills, ...loreBonusSkills, ...beguilingInfluenceSkills])],
    passivePerception: Math.max(0, Math.floor(character.passivePerception)),
    armorClass: dnd5eArmorClass(character),
    currentHp: exhaustionLevel >= 6 ? 0 : Math.max(0, Math.min(effectiveMaxHp, character.currentHp)),
    maxHp: effectiveMaxHp,
    temporaryHp: Math.max(0, Math.floor(character.tempHp)),
    exhaustionLevel,
    speed: dnd5eWalkingSpeed(character),
    movementSpeeds: {
      walk: dnd5eWalkingSpeed(character),
      climb: character.dnd5eMovementSpeeds?.climb,
      swim: character.dnd5eMovementSpeeds?.swim,
      fly: character.dnd5eMovementSpeeds?.fly,
    },
    initiativeBonus: Math.floor(character.initiativeBonus),
    hitPointDice: character.hitPointDice?.length
      ? character.hitPointDice.map((pool) => ({ ...pool }))
      : [{ sides: hitDieSides, current: level, max: level }],
    deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
    concentrating: character.concentrating ?? false,
    inspiration: character.inspiration > 0,
    conditions: [...character.conditions],
    classResources: dnd5eClassResources(character),
    classId: classDefinition?.id,
    subclassId,
    classLevels,
    subclassIds,
    classSelections,
    classSelectionsByClass,
    pluginFeatureIds: registeredDnd5ePluginFeatures()
      .filter((feature) => dnd5eCharacterHasPluginFeature(character, feature.id))
      .map((feature) => feature.id),
    wearingArmor: armor?.kind === 'armor' || !!character.equipment?.armor,
    wearingHeavyArmor: armor?.kind === 'armor' && armor.category === 'heavy',
    wearingMetalArmor: armor?.kind === 'armor' && (
      armor.material === 'metal' || (armor.material == null && armor.category === 'heavy')
    ),
    hasShield: character.equipment?.offHand?.dnd5e?.kind === 'shield',
    classState: { ...character.dnd5eCombatState },
    savingThrowEquipmentBonus: dnd5eEquippedEffectTotal(character, 'savingThrowBonus'),
  }
}

export function dnd5eInitiativeModifier(character: Dnd5eCharacter): number {
  return rules.abilityModifier(character.abilities.dex) + character.initiativeBonus
}

export function createCombatantFromDnd5eCharacter(input: {
  character: Dnd5eCharacter
  controller: 'dm' | 'player'
  initiativeD20: number
  position: { x: number; y: number }
}): Dnd5eCombatant {
  const { character } = input
  const abilityKeys: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  const initiative = rules.resolveD20({ rolls: [input.initiativeD20], modifier: dnd5eInitiativeModifier(character) }).total
  const savingThrowBonuses = Object.fromEntries(abilityKeys.map((ability) => [
    ability,
    rules.abilityModifier(character.abilities[ability]) +
      (character.savingThrowProficiencies.includes(ability) ? rules.proficiencyBonus(character.level) : 0) +
      (character.savingThrowEquipmentBonus ?? 0),
  ]))
  const combatant = createDnd5eCombatant({
    id: character.id,
    name: character.name,
    level: character.level,
    controller: input.controller,
    initiative,
    abilities: { ...character.abilities },
    baseSavingThrowBonuses: savingThrowBonuses,
    savingThrowBonuses,
    savingThrowProficiencies: [...character.savingThrowProficiencies],
    skillProficiencies: [...character.skillProficiencies],
    passivePerception: character.passivePerception,
    proficiencyBonus: rules.proficiencyBonus(character.level),
    armorClass: character.armorClass,
    currentHp: character.currentHp,
    maxHp: character.maxHp,
    temporaryHp: character.temporaryHp,
    exhaustionLevel: character.exhaustionLevel,
    speed: character.speed,
    movementSpeeds: character.movementSpeeds ? { ...character.movementSpeeds } : undefined,
    position: { ...input.position },
    concentrating: character.concentrating,
    creatureType: '类人生物',
    classResources: character.classResources,
    classId: character.classId,
    subclassId: character.subclassId,
    classLevels: character.classLevels,
    subclassIds: character.subclassIds,
    classSelections: character.classSelections,
    classSelectionsByClass: character.classSelectionsByClass,
    pluginFeatureIds: character.pluginFeatureIds,
    wearingArmor: character.wearingArmor,
    wearingHeavyArmor: character.wearingHeavyArmor,
    wearingMetalArmor: character.wearingMetalArmor,
    hasShield: character.hasShield,
    classState: {
      ...character.classState,
      wildShapeOriginalDamageVulnerabilities: normalizedDamageTypes(character.classState.wildShapeOriginalDamageVulnerabilities),
      wildShapeOriginalDamageResistances: normalizedDamageTypes(character.classState.wildShapeOriginalDamageResistances),
      wildShapeOriginalDamageImmunities: normalizedDamageTypes(character.classState.wildShapeOriginalDamageImmunities),
    },
    conditions: character.conditions,
  })
  if (
    combatant.concentrating && combatant.classState.huntersMarkTargetId &&
    !combatant.classState.concentrationSpellId
  ) {
    combatant.classState.concentrationSpellId = 'hunters-mark'
    combatant.classState.concentrationTargetIds = [combatant.classState.huntersMarkTargetId]
    combatant.classState.concentrationRoundsRemaining = 600
  }
  hydrateDnd5eWildShapeCombatant(combatant)
  return { ...combatant, deathSaves: { ...character.deathSaves } }
}
