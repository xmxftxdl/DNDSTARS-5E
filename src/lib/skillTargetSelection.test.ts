import { describe, expect, it } from 'vitest'
import type { Token } from '../store/maps'
import type { CombatSkill } from '../types/character'
import { buildSkillTargetTokenIds, registerSkillTargetSelection, usesArrowSequencePackets } from './skillTargetSelection'

const token = (id: string) => ({ id } as Token)
const skill = (skillTreeId: string, arrowShots?: number) => ({ skillTreeId, arrowShots } as CombatSkill)

describe('skill target selection', () => {
  it('repeats the primary target for same-target arrow skills', () => {
    expect(buildSkillTargetTokenIds({
      skill: skill('multiShot', 3),
      primaryTarget: token('enemy-1'),
      candidates: [],
    })).toEqual(['enemy-1', 'enemy-1', 'enemy-1'])
    expect(usesArrowSequencePackets(skill('multiShot'), true)).toBe(true)
  })

  it('lets each later rage-shot arrow select a target and falls back to primary', () => {
    const primary = token('enemy-1')
    const second = token('enemy-2')
    expect(buildSkillTargetTokenIds({
      skill: skill('rageShot', 3),
      primaryTarget: primary,
      candidates: [primary, second],
      chooseTarget: ({ shotIndex }) => shotIndex === 1 ? second : undefined,
    })).toEqual(['enemy-1', 'enemy-2', 'enemy-1'])
  })

  it('keeps ordinary attacks on the single-target protocol', () => {
    expect(buildSkillTargetTokenIds({
      skill: skill('basicShot', 1),
      primaryTarget: token('enemy-1'),
      candidates: [],
    })).toBeUndefined()
  })

  it('allows a new skill module to register its target sequence', () => {
    const profile = { sequence: 'repeat-primary' as const, shotCount: () => 2 }
    const dispose = registerSkillTargetSelection('test-volley', profile)
    try {
      expect(buildSkillTargetTokenIds({
        skill: skill('test-volley'),
        primaryTarget: token('enemy-1'),
        candidates: [],
      })).toEqual(['enemy-1', 'enemy-1'])
    } finally {
      dispose()
    }
  })
})
