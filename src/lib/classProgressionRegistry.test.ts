import { describe, expect, it } from 'vitest'
import type { Character } from '../types/character'
import {
  canLearnClassSkill,
  getClassSkillRank,
  registeredClassProgressions,
  registerClassProgression,
  syncCharacterClassProgression,
} from './classProgressionRegistry'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: 'Hero',
    charClass: '弓手',
    level: 1,
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

describe('class progression registry', () => {
  it('registers the current archer line behind a generic adapter', () => {
    expect(registeredClassProgressions().map((adapter) => adapter.id)).toContain('archer-line')
    const synced = syncCharacterClassProgression(character())
    expect(synced.combatSkills.some((skill) => skill.skillTreeId === 'basicShot')).toBe(true)
  })

  it('routes skill learning and rank reads through the matching class adapter', () => {
    const archer = character({ skillRanks: { multiShot: 1 } })
    expect(getClassSkillRank(archer, 'multiShot')).toBe(1)
    expect(canLearnClassSkill(archer, 'unknown-skill')).toBe(false)
    expect(getClassSkillRank(character({ charClass: '法师' }), 'multiShot')).toBe(0)
  })

  it('accepts a new class adapter without changing the character store', () => {
    const dispose = registerClassProgression({
      id: 'test-mage',
      matches: (candidate) => candidate.charClass === '测试法师',
      ownsSkill: (skillId) => skillId === 'spark',
      syncSkills: (candidate) => candidate.charClass === '测试法师'
        ? { ...candidate, combatSkills: [...candidate.combatSkills, { id: 'spark', skillTreeId: 'spark' } as never] }
        : candidate,
      canLearnSkill: () => true,
      canUpgradeSkillRank: () => true,
      getSkillRank: () => 2,
    })
    try {
      const mage = character({ charClass: '测试法师' })
      expect(syncCharacterClassProgression(mage).combatSkills.some((item) => item.skillTreeId === 'spark')).toBe(true)
      expect(getClassSkillRank(mage, 'spark')).toBe(2)
    } finally {
      dispose()
    }
  })
})
