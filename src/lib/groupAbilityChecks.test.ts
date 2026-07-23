import { describe, expect, it } from 'vitest'
import {
  groupAbilityCheckAggregate,
  groupAbilityCheckName,
  normalizeSharedGroupAbilityChecks,
  validateSharedGroupAbilityChecks,
} from './groupAbilityChecks'

const participant = (memberId: string) => ({
  memberId, memberName: memberId, characterId: `hero-${memberId}`, characterName: `角色${memberId}`, avatar: '🎲',
})

const check = {
  id: 'group-check-1', status: 'open' as const, label: '全队察觉检定', ability: 'wis' as const,
  skill: 'perception', rollKind: 'ability-check' as const, dc: 15, requestedMode: 'normal' as const, allowPassiveFallback: true,
  participants: [participant('a'), participant('b'), participant('c')], results: [],
  createdByMemberId: 'dm', createdByName: 'DM', createdAt: 1, expiresAt: 601, updatedAt: 1,
}

describe('group ability check shared model', () => {
  it('uses the 2014 group-check threshold of at least half succeeding', () => {
    const result = (memberId: string, success: boolean) => ({ memberId, success })
    expect(groupAbilityCheckAggregate({ participants: check.participants, results: [result('a', true), result('b', false), result('c', true)] as never })).toMatchObject({
      participantCount: 3, requiredSuccesses: 2, successCount: 2, groupSuccess: true,
    })
    expect(groupAbilityCheckAggregate({ participants: check.participants.slice(0, 2), results: [result('a', true), result('b', false)] as never }).groupSuccess).toBe(true)
  })

  it('formats the linked ability and skill in Chinese', () => {
    expect(groupAbilityCheckName(check)).toBe('感知（察觉）检定')
  })

  it('fails closed for malformed or duplicate shared transactions', () => {
    const valid = { schemaVersion: 1, checks: [check], updatedAt: 1 }
    expect(validateSharedGroupAbilityChecks(valid)).toBe(true)
    expect(validateSharedGroupAbilityChecks({ ...valid, checks: [check, check] })).toBe(false)
    expect(validateSharedGroupAbilityChecks({ ...valid, checks: [{ ...check, dc: '15' }] })).toBe(false)
    const malformedResult = {
      ...valid,
      checks: [{ ...check, results: [{ memberId: 'a', characterId: 'hero-a', source: 'passive-only', mode: 'normal' }] }],
    }
    expect(() => validateSharedGroupAbilityChecks(malformedResult)).not.toThrow()
    expect(validateSharedGroupAbilityChecks(malformedResult)).toBe(false)
    expect(normalizeSharedGroupAbilityChecks({ ...valid, checks: [{ ...check, ability: 'luck' }] }).checks).toEqual([])
  })
})
