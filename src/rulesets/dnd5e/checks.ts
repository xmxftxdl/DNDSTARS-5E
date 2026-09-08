import { SKILLS, type AbilityKey } from '../../lib/dnd'
import type { D20RollMode, D20RollResult } from '../contracts'
import type { Character } from '../../types/character'
import { dnd5eUnproficientAbilityCheckBonus } from './classes'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { resolveDnd5eRollMode } from './rollMode'
import { dnd5eCharacterClassLevel } from './multiclass'
import {
  dnd5eActiveAbilityCheckAdvantages,
  dnd5eActiveAbilityCheckDisadvantages,
  dnd5eActivePerceptionDisadvantageApplies,
  dnd5eActiveSkillCheckAdvantages,
  dnd5eActiveSkillCheckDisadvantages,
  dnd5eActiveStrengthRollFlags,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import { dnd5eCharacterBuildTagsV1 } from './buildChoices'
import { dnd5eConditionAbilityCheckDisadvantage } from './conditions'

export type Dnd5eCheckProficiencyRank = 0 | 1 | 2

function level(character: Pick<Character, 'level'>): number {
  return Math.min(20, Math.max(1, Math.floor(character.level)))
}

function abilityScore(character: Pick<Character, 'abilities'>, ability: AbilityKey): number {
  return Math.min(30, Math.max(1, Math.floor(character.abilities[ability])))
}

export function dnd5eSkillCheckProficiencyRank(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'skills' | 'dnd5eClassChoices' | 'dnd5eContentChoices'>,
  skillKey: string,
): Dnd5eCheckProficiencyRank {
  const bardChoices = character.dnd5eClassChoices?.classes?.bard?.selections ?? {}
  const rogueChoices = character.dnd5eClassChoices?.classes?.rogue?.selections ?? {}
  const warlockChoices = character.dnd5eClassChoices?.classes?.warlock?.selections ?? {}
  const beguilingInfluence = dnd5eCharacterClassLevel(character, 'warlock') >= 2 &&
    (warlockChoices['eldritch-invocations'] ?? []).includes('beguiling-influence') &&
    (skillKey === 'deception' || skillKey === 'persuasion')
  const proficient = character.skills.includes(skillKey) ||
    (dnd5eCharacterClassLevel(character, 'bard') >= 3 && (bardChoices['lore-bonus-skills'] ?? []).includes(skillKey)) ||
    beguilingInfluence
  if (!proficient) return 0
  return [
    ...(bardChoices.expertise ?? []),
    ...(rogueChoices.expertise ?? []),
    ...dnd5eCharacterBuildTagsV1(character, 'skill-expertise'),
  ].includes(skillKey) ? 2 : 1
}

export function dnd5eAbilityCheckModifier(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'abilities' | 'dnd5eClassChoices' | 'dnd5eCombatState'>,
  ability: AbilityKey,
  proficiencyRank: Dnd5eCheckProficiencyRank = 0,
): number {
  const proficiencyBonus = rules.proficiencyBonus(level(character))
  const proficiencyModifier = proficiencyRank > 0
    ? proficiencyBonus * proficiencyRank
    : dnd5eUnproficientAbilityCheckBonus(character, ability)
  return rules.abilityModifier(abilityScore(character, ability)) + proficiencyModifier +
    Math.min(0, Math.floor(character.dnd5eCombatState?.resurrectionPenalty?.value ?? 0))
}

export function dnd5eSkillCheckModifier(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'abilities' | 'skills' | 'dnd5eClassChoices' | 'dnd5eContentChoices' | 'dnd5eCombatState'>,
  skillKey: string,
): number {
  const skill = SKILLS.find((candidate) => candidate.key === skillKey)
  if (!skill) throw new RangeError(`Unknown D&D 5e skill: ${skillKey}`)
  return dnd5eAbilityCheckModifier(character, skill.ability, dnd5eSkillCheckProficiencyRank(character, skillKey))
}

export function dnd5eAbilityCheckMode(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'exhaustionLevel'> & {
    conditions?: readonly string[]
    dnd5eCombatState?: { activeEffects?: readonly Dnd5eActiveEffectInstance[] }
  },
  context: {
    initiative?: boolean
    ability?: AbilityKey
    skill?: string
    perceivedTargetId?: string
    requestedMode?: D20RollMode
  } = {},
): D20RollMode {
  const effects = character.dnd5eCombatState?.activeEffects
  const strengthEffect = context.ability === 'str'
    ? dnd5eActiveStrengthRollFlags(effects)
    : { advantage: false, disadvantage: false }
  const advantage = (context.initiative === true && dnd5eCharacterClassLevel(character, 'barbarian') >= 7) ||
    (context.ability != null && dnd5eActiveAbilityCheckAdvantages(effects).includes(context.ability)) ||
    (context.skill != null && dnd5eActiveSkillCheckAdvantages(effects).includes(context.skill)) ||
    strengthEffect.advantage
  const disadvantage = (character.exhaustionLevel ?? 0) >= 1 ||
    dnd5eConditionAbilityCheckDisadvantage(character) ||
    (context.ability != null && dnd5eActiveAbilityCheckDisadvantages(effects).includes(context.ability)) ||
    (context.skill != null && dnd5eActiveSkillCheckDisadvantages(effects).includes(context.skill)) ||
    (context.skill === 'perception' && dnd5eActivePerceptionDisadvantageApplies(
      effects,
      context.perceivedTargetId,
    )) ||
    strengthEffect.disadvantage
  return resolveDnd5eRollMode({
    requestedMode: context.requestedMode,
    advantage: [{ active: advantage, reason: 'initiative-advantage' }],
    disadvantage: [{ active: disadvantage, reason: 'exhaustion' }],
  }).mode
}

function reliableTalentApplies(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels'>,
  proficiencyRank: Dnd5eCheckProficiencyRank,
): boolean {
  return dnd5eCharacterClassLevel(character, 'rogue') >= 11 && proficiencyRank > 0
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
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'abilities' | 'dnd5eClassChoices' | 'exhaustionLevel' | 'dnd5eCombatState'>
  ability: AbilityKey
  rolls: readonly number[]
  proficiencyRank?: Dnd5eCheckProficiencyRank
  initiative?: boolean
  additionalModifier?: number
}): Dnd5eAbilityCheckResult {
  const proficiencyRank = input.proficiencyRank ?? 0
  const mode = dnd5eAbilityCheckMode(input.character, { initiative: input.initiative, ability: input.ability })
  const reliableTalent = reliableTalentApplies(input.character, proficiencyRank)
  const rolls = reliableTalent ? input.rolls.map((roll) => Math.max(10, roll)) : input.rolls
  const resolvedRoll = rules.resolveD20({
    rolls,
    mode,
    modifier: dnd5eAbilityCheckModifier(input.character, input.ability, proficiencyRank) + (input.additionalModifier ?? 0),
  })
  const indomitableMight = dnd5eCharacterClassLevel(input.character, 'barbarian') >= 18 &&
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
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'abilities' | 'dnd5eClassChoices' | 'initiativeBonus' | 'dnd5eCombatState'>,
): number {
  return dnd5eAbilityCheckModifier(character, 'dex') + Math.floor(character.initiativeBonus)
}

export function resolveDnd5eInitiative(input: {
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'abilities' | 'dnd5eClassChoices' | 'initiativeBonus' | 'exhaustionLevel' | 'dnd5eCombatState'>
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
