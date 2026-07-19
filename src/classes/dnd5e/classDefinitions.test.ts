import { describe, expect, it } from 'vitest'
import { registeredClassDefinitions } from '../../lib/classDefinitionRegistry'
import type { Character } from '../../types/character'
import { dnd5eClassResourceDefinitions } from './classDefinitions'

function character(charClass: string, level: number, patch: Partial<Character> = {}): Character {
  return {
    charClass,
    level,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    ...patch,
  } as Character
}

describe('SRD 5.1 generic class definitions', () => {
  it('registers all eleven non-fighter classes alongside the fighter definition', () => {
    const ids = registeredClassDefinitions().map((definition) => definition.id)
    for (const id of ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard']) {
      expect(ids).toContain(`dnd5e-${id}`)
    }
  })

  it('scales martial and spell resources with level and rest cadence', () => {
    const barbarian = dnd5eClassResourceDefinitions(character('野蛮人', 20)).find((resource) => resource.key === 'dnd5e-rage')!
    expect(barbarian.unlimited?.(character('野蛮人', 20))).toBe(true)

    const bard4 = dnd5eClassResourceDefinitions(character('吟游诗人', 4)).find((resource) => resource.key === 'dnd5e-bardic-inspiration')!
    const bard5 = dnd5eClassResourceDefinitions(character('吟游诗人', 5)).find((resource) => resource.key === 'dnd5e-bardic-inspiration')!
    expect([bard4.max(character('吟游诗人', 4)), bard4.resetOn, bard5.resetOn]).toEqual([3, 'long-rest', 'short-rest'])

    const wizard = dnd5eClassResourceDefinitions(character('法师', 5))
    expect(wizard.find((resource) => resource.key === 'dnd5e-spell-slot-1')?.max(character('法师', 5))).toBe(4)
    expect(wizard.find((resource) => resource.key === 'dnd5e-spell-slot-3')?.max(character('法师', 5))).toBe(2)

    const warlock = dnd5eClassResourceDefinitions(character('邪术师', 11))
    expect(warlock.find((resource) => resource.key === 'dnd5e-pact-slot')?.max(character('邪术师', 11))).toBe(3)
    expect(warlock.find((resource) => resource.key === 'dnd5e-pact-slot')?.resetOn).toBe('short-rest')
    expect(warlock.find((resource) => resource.key === 'dnd5e-mystic-arcanum-6')?.max(character('邪术师', 11))).toBe(1)
    expect(warlock.find((resource) => resource.key === 'dnd5e-mystic-arcanum-6')?.resetOn).toBe('long-rest')
    expect(warlock.find((resource) => resource.key === 'dnd5e-mystic-arcanum-7')?.isAvailable(character('邪术师', 11))).toBe(false)
  })
})
