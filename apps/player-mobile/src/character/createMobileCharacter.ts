import { SKILLS, abilityMod, proficiencyBonus, type AbilityKey } from '../../../../src/lib/dnd'
import { syncCharacterClassResources } from '../../../../src/lib/classResources'
import {
  DND5E_2014_ALIGNMENT_OPTIONS,
  DND5E_2014_BACKGROUND_OPTIONS,
  DND5E_2014_CLASS_OPTIONS,
  DND5E_2014_RACE_OPTIONS,
} from '../../../../src/rulesets/dnd5e/characterOptions'
import {
  DND5E_STANDARD_ARRAY,
  applyDnd5eRacialAbilityBonuses,
  dnd5eClassAbilityPriority,
  dnd5eRaceSpeed,
  dnd5eRacialAbilityBonuses,
  recommendedHalfElfAbilityChoices,
} from '../../../../src/rulesets/dnd5e/characterSetup'
import { availableDnd5eClassDefinitions, dnd5eClassDefinition } from '../../../../src/rulesets/dnd5e/classes'
import { dnd5eCoreRaceMechanics } from '../../../../src/rulesets/dnd5e/coreRaceMechanics'
import { declarativeClassContentBindingV1 } from '../../../../src/rulesets/dnd5e/declarativeClass'
import {
  dnd5ePluginBackgroundDefinition,
  dnd5ePluginRaceDefinition,
  registeredDnd5ePluginAbilityGenerationMethods,
  registeredDnd5ePluginBackgrounds,
  registeredDnd5ePluginRaces,
  type Dnd5ePluginAbilityGenerationDefinition,
} from '../../../../src/rulesets/dnd5e/pluginApi'
import { dnd5eArmorClass } from '../../../../src/rulesets/dnd5e/equipment'
import {
  defaultDnd5eStartingEquipmentSelection,
  dnd5eStartingEquipmentPlan,
  resolveDnd5eStartingEquipment,
  type Dnd5eStartingEquipmentSelection,
} from '../../../../src/rulesets/dnd5e/startingEquipment'
import type { Character, Dnd5eAdvancementSpellSelectionsV1 } from '../../../../src/types/character'
import type { Dnd5eDragonbornAncestryId } from '../../../../src/rulesets/dnd5e/racialAutomation'

export const MOBILE_CHARACTER_CLASS_OPTIONS = DND5E_2014_CLASS_OPTIONS
export const MOBILE_CHARACTER_RACE_OPTIONS = DND5E_2014_RACE_OPTIONS
export const MOBILE_CHARACTER_BACKGROUND_OPTIONS = DND5E_2014_BACKGROUND_OPTIONS
export const MOBILE_CHARACTER_ALIGNMENT_OPTIONS = DND5E_2014_ALIGNMENT_OPTIONS

export interface MobileCharacterCreationOption {
  id: string
  label: string
  plugin: boolean
}

export interface MobileCharacterCreationCatalog {
  classes: MobileCharacterCreationOption[]
  races: MobileCharacterCreationOption[]
  backgrounds: MobileCharacterCreationOption[]
  abilityMethods: Array<MobileCharacterCreationOption & { definition: MobileResolvedAbilityGenerationMethod }>
}

export type MobileResolvedAbilityGenerationMethod =
  | { id: string; name: string; kind: 'standard-array'; scores: readonly number[] }
  | { id: string; name: string; kind: 'point-buy'; budget: number; minimum: number; maximum: number; costs: Readonly<Record<number, number>> }
  | { id: string; name: string; kind: 'roll'; diceCount: number; dieSides: number; dropLowest: number }

const CORE_ABILITY_METHODS: readonly MobileResolvedAbilityGenerationMethod[] = [
  { id: 'standard-array', name: '标准数组', kind: 'standard-array', scores: DND5E_STANDARD_ARRAY },
  { id: 'point-buy', name: '27 点购点', kind: 'point-buy', budget: 27, minimum: 8, maximum: 15, costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 } },
  { id: 'roll-4d6', name: '4d6 去最低', kind: 'roll', diceCount: 4, dieSides: 6, dropLowest: 1 },
]

function uniqueOptions(values: MobileCharacterCreationOption[]): MobileCharacterCreationOption[] {
  const seen = new Set<string>()
  return values.filter((entry) => !seen.has(entry.id) && !!seen.add(entry.id))
}

export function mobileCharacterCreationCatalog(): MobileCharacterCreationCatalog {
  const pluginAbilityMethods = registeredDnd5ePluginAbilityGenerationMethods()
  return {
    classes: uniqueOptions(availableDnd5eClassDefinitions().map((entry) => ({
      id: entry.id,
      label: entry.name,
      plugin: entry.id.includes(':'),
    }))),
    races: uniqueOptions([
      ...DND5E_2014_RACE_OPTIONS.map((label) => ({ id: label, label, plugin: false })),
      ...registeredDnd5ePluginRaces().map((entry) => ({ id: entry.id, label: entry.name, plugin: true })),
    ]),
    backgrounds: uniqueOptions([
      ...DND5E_2014_BACKGROUND_OPTIONS.map((label) => ({ id: label, label, plugin: false })),
      ...registeredDnd5ePluginBackgrounds().map((entry) => ({ id: entry.id, label: entry.name, plugin: true })),
    ]),
    abilityMethods: [
      ...CORE_ABILITY_METHODS.map((definition) => ({ id: definition.id, label: definition.name, plugin: false, definition })),
      ...pluginAbilityMethods.map((definition) => ({
        id: definition.id,
        label: definition.name,
        plugin: true,
        definition: definition as MobileResolvedAbilityGenerationMethod,
      })),
    ],
  }
}

export function resolveMobileAbilityGenerationMethod(id: string): MobileResolvedAbilityGenerationMethod | undefined {
  return CORE_ABILITY_METHODS.find((entry) => entry.id === id) ??
    registeredDnd5ePluginAbilityGenerationMethods().find((entry) => entry.id === id) as Dnd5ePluginAbilityGenerationDefinition | undefined
}

export const MOBILE_ABILITY_KEYS: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
export type MobileAbilityGenerationMethod = string
export type MobileBaseAbilities = Record<AbilityKey, number>
export interface MobileAbilityRollInput {
  dice: number[]
  discardedIndices: number[]
  total: number
}

export interface MobileCharacterCreationInput {
  name: string
  charClass: string
  race: string
  background: string
  alignment: string
  abilityMethod: MobileAbilityGenerationMethod
  baseAbilities: MobileBaseAbilities
  abilityRolls?: MobileAbilityRollInput[]
  /** Host-issued receipt consumed by the authoritative create command. */
  hostAbilityRollCommandId?: string
  rollAssignments?: Partial<Record<AbilityKey, number>>
  targetLevel?: number
  racialBonusChoices?: AbilityKey[]
  racialSkillProficiencies?: string[]
  racialFeatIds?: string[]
  dragonbornAncestry?: Dnd5eDragonbornAncestryId
  classSkillProficiencies?: string[]
  startingEquipment?: Dnd5eStartingEquipmentSelection
  initialClassChoices?: Character['dnd5eClassChoices']
  initialSpellSelections?: Dnd5eAdvancementSpellSelectionsV1
}

export interface MobileCharacterOwnership {
  roomId: string
  roomMemberId: string
  ownerAccountId: string
  player: string
}

function characterId() {
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function startingSkills(background: string, allowed: readonly string[] | 'any', count: number, requested?: readonly string[]): string[] {
  const backgroundSkills = background === '侍僧'
    ? ['insight', 'religion']
    : [...(dnd5ePluginBackgroundDefinition(background)?.skillProficiencies ?? [])]
  const candidates = (allowed === 'any' ? SKILLS.map((skill) => skill.key) : [...allowed])
    .filter((skill) => !backgroundSkills.includes(skill))
  const selected = requested?.length
    ? [...new Set(requested)].filter((skill) => candidates.includes(skill)).slice(0, Math.max(0, count))
    : candidates.slice(0, Math.max(0, count))
  if (selected.length !== Math.max(0, count)) throw new Error('starting-class-skills-incomplete')
  return [...new Set([...backgroundSkills, ...selected])]
}

function spellcastingAbility(charClass: string, primaryAbilities: readonly AbilityKey[]): AbilityKey {
  if (['法师'].includes(charClass)) return 'int'
  if (['牧师', '德鲁伊', '游侠'].includes(charClass)) return 'wis'
  if (['吟游诗人', '圣武士', '术士', '邪术师'].includes(charClass)) return 'cha'
  return primaryAbilities[0] ?? 'wis'
}

function sortedAbilityValues(abilities: MobileBaseAbilities) {
  return MOBILE_ABILITY_KEYS.map((ability) => abilities[ability]).sort((left, right) => right - left)
}

function pointBuyRemaining(abilities: MobileBaseAbilities, method: Extract<MobileResolvedAbilityGenerationMethod, { kind: 'point-buy' }>): number {
  return method.budget - MOBILE_ABILITY_KEYS.reduce((spent, ability) =>
    spent + (method.costs[abilities[ability]] ?? Number.POSITIVE_INFINITY), 0)
}

function validateAbilityGeneration(input: MobileCharacterCreationInput) {
  const method = resolveMobileAbilityGenerationMethod(input.abilityMethod)
  if (!method) throw new Error('unsupported-ability-generation-method')
  for (const ability of MOBILE_ABILITY_KEYS) {
    if (!Number.isInteger(input.baseAbilities[ability])) throw new Error('invalid-ability-allocation')
  }
  if (method.kind === 'standard-array') {
    if (sortedAbilityValues(input.baseAbilities).join(',') !== [...method.scores].sort((a, b) => b - a).join(',')) {
      throw new Error('standard-array-not-fully-assigned')
    }
    return
  }
  if (method.kind === 'point-buy') {
    if (MOBILE_ABILITY_KEYS.some((ability) => input.baseAbilities[ability] < method.minimum || input.baseAbilities[ability] > method.maximum)) {
      throw new Error('point-buy-score-out-of-range')
    }
    if (pointBuyRemaining(input.baseAbilities, method) !== 0) throw new Error('point-buy-budget-not-fully-spent')
    return
  }
  const rolls = input.abilityRolls ?? []
  const assignments = input.rollAssignments ?? {}
  if (rolls.length !== 6 || MOBILE_ABILITY_KEYS.some((ability) => !Number.isInteger(assignments[ability]))) {
    throw new Error('rolled-abilities-not-fully-assigned')
  }
  const used = MOBILE_ABILITY_KEYS.map((ability) => assignments[ability] as number)
  if (new Set(used).size !== 6 || used.some((index) => index < 0 || index >= rolls.length)) {
    throw new Error('rolled-ability-used-more-than-once')
  }
  for (const ability of MOBILE_ABILITY_KEYS) {
    const roll = rolls[assignments[ability] as number]
    if (
      roll.total !== input.baseAbilities[ability] ||
      roll.dice.length !== method.diceCount ||
      roll.discardedIndices.length !== method.dropLowest
    ) {
      throw new Error('rolled-ability-mismatch')
    }
  }
}

/**
 * Build a complete, Host-valid level-one SRD character for the mobile quick
 * creator. Advanced level-up choices intentionally remain in the versioned
 * advancement workflow instead of being guessed on the phone.
 */
export function createMobileDnd5eCharacter(
  input: MobileCharacterCreationInput,
  ownership: MobileCharacterOwnership,
): Character {
  const definition = dnd5eClassDefinition(input.charClass)
  if (!definition) throw new Error('invalid-character-class')
  validateAbilityGeneration(input)
  const id = characterId()
  const pluginRace = dnd5ePluginRaceDefinition(input.race)
  const raceName = pluginRace?.name ?? input.race
  const backgroundDefinition = dnd5ePluginBackgroundDefinition(input.background)
  const backgroundName = backgroundDefinition?.name ?? input.background
  const flexible = pluginRace?.flexibleAbilityBonus
  const requestedRacialChoices = [...new Set(input.racialBonusChoices ?? [])]
  const halfElfChoices = raceName === '半精灵'
    ? (requestedRacialChoices.length ? requestedRacialChoices : [...recommendedHalfElfAbilityChoices(definition.name)])
    : flexible
      ? (requestedRacialChoices.length ? requestedRacialChoices : dnd5eClassAbilityPriority(definition.name)
        .filter((ability) => !new Set(flexible.exclude ?? []).has(ability))
        .slice(0, flexible.count))
      : []
  if ((raceName === '半精灵' || flexible) && halfElfChoices.length !== (flexible?.count ?? 2)) {
    throw new Error('racial-ability-choices-incomplete')
  }
  const baseScores = { ...input.baseAbilities }
  const racialBonuses = dnd5eRacialAbilityBonuses(pluginRace?.id ?? raceName, halfElfChoices)
  const abilities = applyDnd5eRacialAbilityBonuses(baseScores, racialBonuses)
  const constitutionModifier = abilityMod(abilities.con)
  const maxHp = Math.max(1, definition.hitDie + constitutionModifier)
  const equipmentPlan = dnd5eStartingEquipmentPlan(definition.name, backgroundName)
  const startingEquipment = resolveDnd5eStartingEquipment(
    id,
    equipmentPlan,
    input.startingEquipment ?? defaultDnd5eStartingEquipmentSelection(equipmentPlan),
  )
  const coreRace = dnd5eCoreRaceMechanics(raceName, pluginRace?.id)
  const racialSkillChoiceCount = pluginRace?.skillProficiencyChoiceCount ?? coreRace?.skillProficiencyChoiceCount ?? 0
  const selectedRacialSkills = [...new Set(input.racialSkillProficiencies ?? SKILLS.map((skill) => skill.key).slice(0, racialSkillChoiceCount))]
  if (selectedRacialSkills.length !== racialSkillChoiceCount) throw new Error('racial-skill-choices-incomplete')
  const skills = [...new Set([
    ...startingSkills(backgroundDefinition?.id ?? backgroundName, definition.skillProficiencies, definition.skillChoiceCount, input.classSkillProficiencies),
    ...(coreRace?.skillProficiencies ?? []),
    ...(pluginRace?.skillProficiencies ?? []),
    ...selectedRacialSkills,
  ])]
  const castingAbility = definition.spellcasting?.ability ?? spellcastingAbility(definition.name, definition.primaryAbilities)
  const choices: NonNullable<Character['dnd5eClassChoices']> = input.initialClassChoices
    ? structuredClone(input.initialClassChoices)
    : {
        classes: { [definition.id]: { selections: {} } },
        ...(definition.id === 'fighter' ? { fighter: { fightingStyles: [] } } : {}),
      }
  const classContentBinding = declarativeClassContentBindingV1(definition.id)
  const targetLevel = Math.max(1, Math.min(20, Math.floor(input.targetLevel ?? 1)))
  let character: Character = {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id,
    roomId: ownership.roomId,
    roomMemberId: ownership.roomMemberId,
    ownerAccountId: ownership.ownerAccountId,
    name: input.name.trim() || '新冒险者',
    player: ownership.player,
    avatar: '🧝',
    accent: 'from-arcane-500 to-arcane-600',
    race: raceName,
    ...(pluginRace ? { dnd5eRaceId: pluginRace.id } : {}),
    charClass: definition.name,
    dnd5eClassLevels: { [definition.id]: 1 },
    ...(classContentBinding ? { dnd5eClassContentBindings: { [classContentBinding.classId]: classContentBinding } } : {}),
    level: 1,
    ...(targetLevel > 1 ? { dnd5eCreationTargetLevel: targetLevel } : {}),
    background: backgroundName,
    ...(backgroundDefinition ? { dnd5eBackgroundId: backgroundDefinition.id } : {}),
    dnd5eBackgroundSkillProficiencies: backgroundName === '侍僧'
      ? ['insight', 'religion']
      : [...(backgroundDefinition?.skillProficiencies ?? [])],
    alignment: input.alignment,
    experience: 0,
    reputation: 0,
    abilities,
    dnd5eAbilityGeneration: {
      method: input.abilityMethod as NonNullable<Character['dnd5eAbilityGeneration']>['method'],
      baseScores,
      racialBonuses,
      ...(resolveMobileAbilityGenerationMethod(input.abilityMethod)?.kind === 'roll' ? {
        rolls: MOBILE_ABILITY_KEYS.map((ability) => {
          const roll = input.abilityRolls![input.rollAssignments![ability]!]
          return { ...roll, discardedIndex: roll.discardedIndices[0], ability }
        }),
      } : {}),
      ...(halfElfChoices.length ? { halfElfChoices, racialBonusChoices: halfElfChoices } : {}),
    },
    savingThrows: [...definition.savingThrows],
    skills,
    maxHp,
    currentHp: maxHp,
    tempHp: 0,
    hitDice: `1d${definition.hitDie}`,
    hitPointMaximumMode: 'fixed',
    hitPointDice: [{ sides: definition.hitDie, current: 1, max: 1 }],
    ac: 10,
    speed: dnd5eRaceSpeed(pluginRace?.id ?? raceName),
    initiativeBonus: abilityMod(abilities.dex),
    saveDC: 8 + proficiencyBonus(1) + abilityMod(abilities[castingAbility]),
    passivePerception: 10 + abilityMod(abilities.wis) + (skills.includes('perception') ? proficiencyBonus(1) : 0),
    inspiration: 0,
    dnd5eClassChoices: choices,
    ...(input.racialFeatIds?.length ? { dnd5eFeatIds: [...new Set(input.racialFeatIds)] } : {}),
    ...(input.dragonbornAncestry ? { dnd5eRacialChoices: { dragonbornAncestry: input.dragonbornAncestry } } : {}),
    equipment: startingEquipment.equipment,
    dnd5eInventory: startingEquipment.inventory,
    conditions: [],
    backstory: '',
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
  }
  character = syncCharacterClassResources(character)
  character.ac = dnd5eArmorClass(character)
  return character
}
