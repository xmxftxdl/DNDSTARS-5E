import { describe, expect, it } from 'vitest'
import type { CombatSkill } from '../types/character'
import { registerSkillRange, singleTargetRangeFeet } from './skillRangeRegistry'

const skill = (skillTreeId: string, tags: CombatSkill['tags'] = ['ranged']) => ({
  skillTreeId,
  tags,
  name: skillTreeId,
} as CombatSkill)

describe('skill range registry', () => {
  it('uses one range source for melee and ranged skills', () => {
    expect(singleTargetRangeFeet(skill('windKickCombo', ['melee']))).toBe(5)
    expect(singleTargetRangeFeet(skill('bindShot'))).toBe(20)
    expect(singleTargetRangeFeet(skill('antiMagicArrow'))).toBe(90)
  })

  it('allows a new class skill to register its authoritative range', () => {
    const dispose = registerSkillRange('test-bolt', 45)
    try {
      expect(singleTargetRangeFeet(skill('test-bolt'))).toBe(45)
    } finally {
      dispose()
    }
  })
})
