import type { AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import { createDnd5eCombatant } from './headlessCombatEngine'
import { dnd5eSrd521Adapter as rules } from './srd521Adapter'

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
  armorClass: number
  currentHp: number
  maxHp: number
  temporaryHp: number
  speed: number
  initiativeBonus: number
  hitPointDice: readonly { sides: number; current: number; max: number }[]
  deathSaves: Dnd5eDeathSaves
  concentrating: boolean
  heroicInspiration: boolean
  conditions: readonly string[]
}

function parseHitPointDie(value: string): number {
  const match = value.trim().match(/^\d*d(\d+)$/i)
  return match ? Math.max(2, Number(match[1])) : 8
}

/**
 * One-way boundary from legacy persisted characters into the SRD runtime model.
 * AP, cooldowns, custom class resources, and legacy class features are deliberately ignored.
 */
export function migrateCharacterToDnd5e(character: Character): Dnd5eCharacter {
  const level = Math.min(20, Math.max(1, Math.floor(character.level)))
  const hitDieSides = parseHitPointDie(character.hitDice)
  return {
    id: character.id,
    name: character.name,
    player: character.player,
    level,
    abilities: { ...character.abilities },
    savingThrowProficiencies: [...character.savingThrows],
    skillProficiencies: [...character.skills],
    armorClass: Math.max(0, Math.floor(character.ac)),
    currentHp: Math.max(0, Math.min(character.maxHp, character.currentHp)),
    maxHp: Math.max(1, Math.floor(character.maxHp)),
    temporaryHp: Math.max(0, Math.floor(character.tempHp)),
    speed: Math.max(0, Math.floor(character.speed)),
    initiativeBonus: Math.floor(character.initiativeBonus),
    hitPointDice: [{ sides: hitDieSides, current: level, max: level }],
    deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
    concentrating: false,
    heroicInspiration: character.inspiration > 0,
    conditions: [...character.conditions],
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
  const initiative = rules.resolveD20({ rolls: [input.initiativeD20], modifier: dnd5eInitiativeModifier(character) }).total
  const combatant = createDnd5eCombatant({
    id: character.id,
    name: character.name,
    controller: input.controller,
    initiative,
    abilities: { ...character.abilities },
    proficiencyBonus: rules.proficiencyBonus(character.level),
    armorClass: character.armorClass,
    currentHp: character.currentHp,
    maxHp: character.maxHp,
    temporaryHp: character.temporaryHp,
    speed: character.speed,
    position: { ...input.position },
    concentrating: character.concentrating,
  })
  return { ...combatant, deathSaves: { ...character.deathSaves } }
}
