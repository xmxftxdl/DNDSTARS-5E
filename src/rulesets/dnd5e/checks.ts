import { SKILLS, type AbilityKey } from '../../lib/dnd'
import type { D20RollMode, D20RollResult } from '../contracts'
import type { Character } from '../../types/character'
import { dnd5eUnproficientAbilityCheckBonus } from './classes'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { resolveDnd5eRollMode } from './rollMode'

export type Dnd5eCheckProficiencyRank = 0 | 1 | 2

function level(character: Pick<Character, 'level'>): number {
  return Math.min(20, Math.max(1, Math.floor(character.level)))
}

function abilityScore(character: Pick<Character, 'abilities'>, ability: AbilityKey): number {
  return Math.min(30, Math.max(1, Math.floor(character.abilities[ability])))
}

function selectedClassChoices(character: Pick<Character, 'charClass' | 'dnd5eClassChoices'>): Record<string, string[]> {
  const classId = character.charClass === '吟游诗人' ? 'bard'
    : character.charClass === '游荡者' ? 'rogue'
      : character.charClass === '邪术师' ? 'warlock'
        : undefined
  return classId ? character.dnd5eClassChoices?.classes?.[classId]?.selections ?? {} : {}
}

export function dnd5eSkillCheckProficiencyRank(
  character: Pick<Character, 'charClass' | 'skills' | 'dnd5eClassChoices'>,
  skillKey: string,
): Dnd5eCheckProficiencyRank {
  const choices = selectedClassChoices(character)
  const beguilingInfluence = character.charClass === '邪术师' &&
    (choices['eldritch-invocations'] ?? []).includes('beguiling-influence') &&
    (skillKey === 'deception' || skillKey === 'persuasion')
  const proficient = character.skills.includes(skillKey) ||
    (character.charClass === '吟游诗人' && (choices['lore-bonus-skills'] ?? []).includes(skillKey)) ||
    beguilingInfluence
  if (!proficient) return 0
  return (choices.expertise ?? []).includes(skillKey) ? 2 : 1
}

export function dnd5eAbilityCheckModifier(
  character: Pick<Character, 'charClass' | 'level' | 'abilities' | 'dnd5eClassChoices'>,
  ability: AbilityKey,
  proficiencyRank: Dnd5eCheckProficiencyRank = 0,
): number {
  const proficiencyBonus = rules.proficiencyBonus(level(character))
  const proficiencyModifier = proficiencyRank > 0
    ? proficiencyBonus * proficiencyRank
    : dnd5eUnproficientAbilityCheckBonus(character, ability)
  return rules.abilityModifier(abilityScore(character, ability)) + proficiencyModifier
}

export function dnd5eSkillCheckModifier(
  character: Pick<Character, 'charClass' | 'level' | 'abilities' | 'skills' | 'dnd5eClassChoices'>,
  skillKey: string,
): number {
  const skill = SKILLS.find((candidate) => candidate.key === skillKey)
  if (!skill) throw new RangeError(`Unknown D&D 5e skill: ${skillKey}`)
  return dnd5eAbilityCheckModifier(character, skill.ability, dnd5eSkillCheckProficiencyRank(character, skillKey))
}

export function dnd5eAbilityCheckMode(
  character: Pick<Character, 'charClass' | 'level' | 'exhaustionLevel'>,
  context: { initiative?: boolean } = {},
): D20RollMode {
  const advantage = context.initiative === true && character.charClass === '野蛮人' && level(character) >= 7
  const disadvantage = (character.exhaustionLevel ?? 0) >= 1
  return resolveDnd5eRollMode({
    advantage: [{ active: advantage, reason: 'initiative-advantage' }],
    disadvantage: [{ active: disadvantage, reason: 'exhaustion' }],
  }).mode
}

function reliableTalentApplies(
  character: Pick<Character, 'charClass' | 'level'>,
  proficiencyRank: Dnd5eCheckProficiencyRank,
): boolean {
  return character.charClass === '游荡者' && level(character) >= 11 && proficiencyRank > 0
}

export interface Dnd5eAbilityCheckResult {
  roll: D20RollResult
  proficiencyRank: Dnd5eCheckProficiencyRank
  reliableTalentApplied: boolean
  indomitableMightApplied: boolean
}

export function previewDnd5eSavingThrowRoll(input: {
  rolls: readonly number[]
  mode: D20RollMode
  modifier: number
  dc: number
}) {
  return rules.resolveSavingThrow(input)
}

export function resolveDnd5eAbilityCheck(input: {
  character: Pick<Character, 'charClass' | 'level' | 'abilities' | 'dnd5eClassChoices' | 'exhaustionLevel'>
  ability: AbilityKey
  rolls: readonly number[]
  proficiencyRank?: Dnd5eCheckProficiencyRank
  initiative?: boolean
  additionalModifier?: number
}): Dnd5eAbilityCheckResult {
  const proficiencyRank = input.proficiencyRank ?? 0
  const mode = dnd5eAbilityCheckMode(input.character, { initiative: input.initiative })
  const reliableTalent = reliableTalentApplies(input.character, proficiencyRank)
  const rolls = reliableTalent ? input.rolls.map((roll) => Math.max(10, roll)) : input.rolls
  const resolvedRoll = rules.resolveD20({
    rolls,
    mode,
    modifier: dnd5eAbilityCheckModifier(input.character, input.ability, proficiencyRank) + (input.additionalModifier ?? 0),
  })
  const indomitableMight = input.character.charClass === '野蛮人' && level(input.character) >= 18 &&
    input.ability === 'str' && resolvedRoll.total < abilityScore(input.character, 'str')
  const roll = indomitableMight
    ? { ...resolvedRoll, total: abilityScore(input.character, 'str') }
    : resolvedRoll
  return {
    roll,
    proficiencyRank,
    reliableTalentApplied: reliableTalent && input.rolls.some((value) => value < 10),
    indomitableMightApplied: indomitableMight,
  }
}

export function dnd5eStoredCharacterInitiativeModifier(
  character: Pick<Character, 'charClass' | 'level' | 'abilities' | 'dnd5eClassChoices' | 'initiativeBonus'>,
): number {
  return dnd5eAbilityCheckModifier(character, 'dex') + Math.floor(character.initiativeBonus)
}

export function resolveDnd5eInitiative(input: {
  character: Pick<Character, 'charClass' | 'level' | 'abilities' | 'dnd5eClassChoices' | 'initiativeBonus' | 'exhaustionLevel'>
  rolls: readonly number[]
}): Dnd5eAbilityCheckResult {
  return resolveDnd5eAbilityCheck({
    character: input.character,
    ability: 'dex',
    rolls: input.rolls,
    initiative: true,
    additionalModifier: Math.floor(input.character.initiativeBonus),
  })
}
