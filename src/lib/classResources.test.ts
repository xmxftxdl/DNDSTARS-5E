import { describe, expect, it } from 'vitest'
import type { Character } from '../types/character'
import { registerClassDefinition, type ClassDefinition } from './classDefinitionRegistry'
import { getClassResource, restoreClassResources, spendClassResource, syncCharacterClassResources } from './classResources'

function character(patch: Partial<Character> = {}): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'hero', name: '英雄', player: '', avatar: '', accent: '',
    race: '人类', charClass: '战士', level: 2, background: '士兵', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: ['str', 'con'], skills: [],
    maxHp: 20, currentHp: 20, tempHp: 0, hitDice: '2d10', ac: 16, speed: 30, initiativeBonus: 0,
    saveDC: 12, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    ...patch,
  }
}

describe('D&D 5e class resources', () => {
  it('creates, spends and restores fighter short-rest resources', () => {
    const synced = syncCharacterClassResources(character())
    expect(getClassResource(synced, 'fighterSecondWind')).toEqual({ current: 1, max: 1 })
    expect(getClassResource(synced, 'fighterActionSurge')).toEqual({ current: 1, max: 1 })
    const spent = spendClassResource(synced, 'fighterActionSurge', 1)
    expect(spent?.classResources?.fighterActionSurge.current).toBe(0)
    expect(restoreClassResources(spent!, 'short-rest').classResources?.fighterActionSurge.current).toBe(1)
  })

  it('restores full-caster spell slots on a long rest', () => {
    const wizard = syncCharacterClassResources(character({ charClass: '法师', level: 5, hitDice: '5d6' }))
    const spent = spendClassResource(wizard, 'dnd5e-spell-slot-3', 1)
    expect(spent?.classResources?.['dnd5e-spell-slot-3'].current).toBe(1)
    expect(restoreClassResources(spent!, 'long-rest').classResources?.['dnd5e-spell-slot-3'].current).toBe(2)
  })

  it('supports namespaced plugin resources without legacy mirror fields', () => {
    const definition: ClassDefinition = {
      id: 'test-class', classNames: ['测试职业'], matchesClassName: (name) => name === '测试职业',
      resources: [{
        key: 'com.example:test-charge', label: '测试充能', isAvailable: () => true,
        max: (candidate) => candidate.level, resetOn: 'long-rest',
      }],
    }
    const unregister = registerClassDefinition(definition)
    try {
      const synced = syncCharacterClassResources(character({ charClass: '测试职业', level: 3 }))
      expect(synced.classResources?.['com.example:test-charge']).toEqual({ current: 3, max: 3 })
    } finally {
      unregister()
    }
  })
})
