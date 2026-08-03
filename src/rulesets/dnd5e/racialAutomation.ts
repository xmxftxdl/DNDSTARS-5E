import type { ClassResourceDefinition } from '../../lib/classDefinitionTypes'
import type { AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import type { Dnd5eDamageType } from './damageTypes'
import { dnd5ePluginRaceDefinition } from './pluginApi'

export const DND5E_RACIAL_RESOURCE_KEYS = {
  dragonbornBreath: 'dnd5e-racial-dragonborn-breath',
  relentlessEndurance: 'dnd5e-racial-half-orc-relentless-endurance',
  innateSpell: (spellId: string) => `dnd5e-racial-spell-${spellId}`,
} as const

export type Dnd5eDragonbornAncestryId =
  | 'black'
  | 'blue'
  | 'brass'
  | 'bronze'
  | 'copper'
  | 'gold'
  | 'green'
  | 'red'
  | 'silver'
  | 'white'

export interface Dnd5eDragonbornAncestry {
  id: Dnd5eDragonbornAncestryId
  name: string
  damageType: Extract<Dnd5eDamageType, 'acid' | 'cold' | 'fire' | 'lightning' | 'poison'>
  saveAbility: Extract<AbilityKey, 'dex' | 'con'>
  area: {
    shape: 'line' | 'cone'
    lengthFeet: 15 | 30
    widthFeet?: 5
  }
}

export const DND5E_DRAGONBORN_ANCESTRIES: readonly Dnd5eDragonbornAncestry[] = [
  { id: 'black', name: '黑龙', damageType: 'acid', saveAbility: 'dex', area: { shape: 'line', lengthFeet: 30, widthFeet: 5 } },
  { id: 'blue', name: '蓝龙', damageType: 'lightning', saveAbility: 'dex', area: { shape: 'line', lengthFeet: 30, widthFeet: 5 } },
  { id: 'brass', name: '黄铜龙', damageType: 'fire', saveAbility: 'dex', area: { shape: 'line', lengthFeet: 30, widthFeet: 5 } },
  { id: 'bronze', name: '青铜龙', damageType: 'lightning', saveAbility: 'dex', area: { shape: 'line', lengthFeet: 30, widthFeet: 5 } },
  { id: 'copper', name: '赤铜龙', damageType: 'acid', saveAbility: 'dex', area: { shape: 'line', lengthFeet: 30, widthFeet: 5 } },
  { id: 'gold', name: '金龙', damageType: 'fire', saveAbility: 'dex', area: { shape: 'cone', lengthFeet: 15 } },
  { id: 'green', name: '绿龙', damageType: 'poison', saveAbility: 'con', area: { shape: 'cone', lengthFeet: 15 } },
  { id: 'red', name: '红龙', damageType: 'fire', saveAbility: 'dex', area: { shape: 'cone', lengthFeet: 15 } },
  { id: 'silver', name: '银龙', damageType: 'cold', saveAbility: 'con', area: { shape: 'cone', lengthFeet: 15 } },
  { id: 'white', name: '白龙', damageType: 'cold', saveAbility: 'con', area: { shape: 'cone', lengthFeet: 15 } },
]

export interface Dnd5eRacialInnateSpellGrant {
  spellId: string
  minimumLevel: number
  ability: AbilityKey
  castAtLevel: number
  resetOn: 'at-will' | 'long-rest'
}

export interface Dnd5eRacialRulesSnapshot {
  halflingLucky: boolean
  halfOrcRelentlessEndurance: boolean
  halfOrcSavageAttacks: boolean
  dragonbornAncestry?: Dnd5eDragonbornAncestry
  innateSpells: readonly Dnd5eRacialInnateSpellGrant[]
}

type RacialCharacterIdentity = Pick<
  Character,
  'race' | 'dnd5eRaceId' | 'level' | 'dnd5eRacialChoices'
>

function normalizedRaceIdentities(character: Pick<Character, 'race' | 'dnd5eRaceId'>): string[] {
  return [character.race, character.dnd5eRaceId]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase())
}

function raceMatches(character: Pick<Character, 'race' | 'dnd5eRaceId'>, ...values: readonly string[]): boolean {
  const identities = normalizedRaceIdentities(character)
  return identities.some((identity) => values.some((value) =>
    identity === value || identity.endsWith(`:${value}`),
  ))
}

export function dnd5eDragonbornAncestry(
  ancestryId: string | undefined,
): Dnd5eDragonbornAncestry | undefined {
  return DND5E_DRAGONBORN_ANCESTRIES.find((ancestry) => ancestry.id === ancestryId)
}

export function dnd5eDragonbornBreathDiceCount(level: number): number {
  if (level >= 16) return 5
  if (level >= 11) return 4
  if (level >= 6) return 3
  return 2
}

export function dnd5eRacialRulesForCharacter(
  character: RacialCharacterIdentity,
): Dnd5eRacialRulesSnapshot {
  const pluginRace = dnd5ePluginRaceDefinition(character.dnd5eRaceId ?? character.race)
  const halfling = raceMatches(
    character,
    'halfling', 'lightfoot-halfling', '半身人', '轻足半身人',
  )
  const halfOrc = raceMatches(character, 'half-orc', 'half orc', '半兽人')
  const dragonborn = raceMatches(character, 'dragonborn', '龙裔')
  const tiefling = raceMatches(character, 'tiefling', '提夫林')
  const innateSpells: Dnd5eRacialInnateSpellGrant[] = []
  if (tiefling) {
    innateSpells.push(
      { spellId: 'thaumaturgy', minimumLevel: 1, ability: 'cha', castAtLevel: 0, resetOn: 'at-will' },
      { spellId: 'hellish-rebuke', minimumLevel: 3, ability: 'cha', castAtLevel: 2, resetOn: 'long-rest' },
      { spellId: 'darkness', minimumLevel: 5, ability: 'cha', castAtLevel: 2, resetOn: 'long-rest' },
    )
  }
  innateSpells.push(...(pluginRace?.innateSpells ?? []))
  return {
    halflingLucky: halfling || pluginRace?.naturalOneReroll === true,
    halfOrcRelentlessEndurance: halfOrc,
    halfOrcSavageAttacks: halfOrc,
    dragonbornAncestry: dragonborn
      ? dnd5eDragonbornAncestry(character.dnd5eRacialChoices?.dragonbornAncestry)
      : undefined,
    innateSpells: innateSpells.filter((grant) => character.level >= grant.minimumLevel),
  }
}

export function dnd5eRacialInnateSpellGrant(
  rules: Pick<Dnd5eRacialRulesSnapshot, 'innateSpells'> | undefined,
  spellId: string,
): Dnd5eRacialInnateSpellGrant | undefined {
  return rules?.innateSpells.find((grant) => grant.spellId === spellId)
}

export function dnd5eRacialResourceDefinitions(
  character: Character,
): readonly ClassResourceDefinition[] {
  if (character.rulesetId !== 'dnd5e-2014-srd-5.1') return []
  const rules = dnd5eRacialRulesForCharacter(character)
  const definitions: ClassResourceDefinition[] = []
  if (rules.dragonbornAncestry) {
    definitions.push({
      key: DND5E_RACIAL_RESOURCE_KEYS.dragonbornBreath,
      label: '龙裔吐息',
      shortLabel: '吐息',
      isAvailable: () => true,
      max: () => 1,
      resetOn: 'short-rest',
    })
  }
  if (rules.halfOrcRelentlessEndurance) {
    definitions.push({
      key: DND5E_RACIAL_RESOURCE_KEYS.relentlessEndurance,
      label: '顽强',
      shortLabel: '顽强',
      isAvailable: () => true,
      max: () => 1,
      resetOn: 'long-rest',
    })
  }
  for (const spell of rules.innateSpells) {
    if (spell.resetOn === 'at-will') continue
    definitions.push({
      key: DND5E_RACIAL_RESOURCE_KEYS.innateSpell(spell.spellId),
      label: `种族先天法术：${spell.spellId}`,
      shortLabel: spell.spellId,
      isAvailable: () => true,
      max: () => 1,
      resetOn: 'long-rest',
    })
  }
  return definitions
}
