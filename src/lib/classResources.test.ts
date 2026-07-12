import { describe, expect, it } from 'vitest'
import type { Character } from '../types/character'
import { DEFAULT_COMBAT_STAT_PROFILE, registerClassDefinition, type ClassDefinition } from './classDefinitionRegistry'
import {
  getClassResource,
  restoreClassResources,
  spendClassResource,
  syncCharacterClassResources,
} from './classResources'
import { executeCombatMutationsAuthority } from './combatAuthority'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: 'Hero',
    charClass: '影舞者',
    level: 30,
    traits: [],
    combatSkills: [],
    conditions: [],
    actionPoints: 2,
    currentAP: 2,
    currentHp: 10,
    maxHp: 10,
    ...patch,
  } as Character
}

function manaDefinition(): ClassDefinition {
  return {
    id: 'test-mage-resource',
    classNames: ['测试法师'],
    matchesClassName: (name) => name === '测试法师',
    progression: {
      id: 'test-mage-resource',
      matches: (candidate) => candidate.charClass === '测试法师',
      ownsSkill: () => false,
      syncSkills: (candidate) => candidate,
      canLearnSkill: () => false,
      canUpgradeSkillRank: () => false,
      getSkillRank: () => 0,
    },
    combatStats: DEFAULT_COMBAT_STAT_PROFILE,
    resources: [
      {
        key: 'mana',
        label: '法力',
        isAvailable: () => true,
        max: (candidate) => candidate.level * 3,
        resetOn: 'long-rest',
      },
    ],
  }
}

describe('class resources', () => {
  it('migrates and mirrors the legacy shadow dancer qi field', () => {
    const synced = syncCharacterClassResources(character({ qi: 7 }))
    expect(synced.classResources?.qi).toEqual({ current: 7, max: 99 })
    expect(synced.qi).toBe(7)

    const spent = spendClassResource(synced, 'qi', 2)
    expect(spent?.classResources?.qi.current).toBe(5)
    expect(spent?.qi).toBe(5)
  })

  it('clamps invalid values, restores on long rest, and removes unavailable qi', () => {
    const clamped = syncCharacterClassResources(character({ qi: 120 }))
    expect(getClassResource(clamped, 'qi')).toEqual({ current: 99, max: 99 })
    expect(
      restoreClassResources({ ...clamped, qi: 3, classResources: { qi: { current: 3, max: 99 } } }, 'long-rest').qi,
    ).toBe(99)

    const archer = syncCharacterClassResources({ ...clamped, charClass: '弓手' })
    expect(archer.qi).toBeUndefined()
    expect(archer.classResources).toBeUndefined()
  })

  it('registers and spends a new class resource without changing authority code', () => {
    const dispose = registerClassDefinition(manaDefinition())
    try {
      const mage = syncCharacterClassResources(character({ charClass: '测试法师', level: 4, qi: undefined }))
      expect(getClassResource(mage, 'mana')).toEqual({ current: 12, max: 12 })

      const result = executeCombatMutationsAuthority(
        {
          characters: [mage],
          enemyApByToken: {},
          map: { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 50, tokens: [] } as never,
        },
        {
          role: 'dm',
          mutations: [
            {
              type: 'spend-class-resource',
              characterId: mage.id,
              resourceKey: 'mana',
              amount: 5,
              reason: 'test-spell',
            },
          ],
        },
      )

      expect(result.failures).toEqual([])
      expect(getClassResource(result.state.characters[0], 'mana')?.current).toBe(7)
      expect(restoreClassResources(result.state.characters[0], 'long-rest').classResources?.mana.current).toBe(12)
    } finally {
      dispose()
    }
  })
})
