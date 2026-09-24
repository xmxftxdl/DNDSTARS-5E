import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { mapActorTurnStartResolvedKey } from './simulacrum'

describe('simulacrum turn-start ownership', () => {
  const subject = { dnd5eCombatState: { turnStartResolvedTurnKey: 'combat:1:caster:normal' } } as Character
  const token = { dnd5eSimulacrum: { sourceCharacterId: 'caster' },
    dnd5eCombatState: { turnStartResolvedTurnKey: 'combat:1:copy:source-companion' } } as Token

  it('stays settled through repeated room snapshots and refreshes without using the caster marker', () => {
    for (let i = 0; i < 100; i++) {
      expect(mapActorTurnStartResolvedKey(structuredClone(token), structuredClone(subject)))
        .toBe('combat:1:copy:source-companion')
    }
  })
  it('requires settlement for a new copy or next round', () => {
    expect(mapActorTurnStartResolvedKey({ ...token, dnd5eCombatState: undefined }, subject)).toBeUndefined()
    expect(mapActorTurnStartResolvedKey(token, subject)).not.toBe('combat:2:copy:source-companion')
  })
  it('preserves ordinary character and monster ownership', () => {
    expect(mapActorTurnStartResolvedKey(undefined, subject)).toBe('combat:1:caster:normal')
    expect(mapActorTurnStartResolvedKey({ ...token, dnd5eSimulacrum: undefined }, undefined))
      .toBe('combat:1:copy:source-companion')
  })
})
