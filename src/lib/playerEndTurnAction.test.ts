import { describe, expect, it } from 'vitest'
import {
  buildHeadlessEndTurnAction,
  clearCharacterScopedRecord,
  removeDisengagedCharacterId,
} from './playerEndTurnAction'

describe('player end turn action helpers', () => {
  it('clears only entries scoped to the ending character', () => {
    const record = {
      'hero:goblin': 2,
      'hero:dragon': 1,
      'other:goblin': 3,
      misc: 4,
    }

    expect(clearCharacterScopedRecord(record, 'hero')).toEqual({
      'other:goblin': 3,
      misc: 4,
    })
  })

  it('returns the same record when no scoped entries are present', () => {
    const record = { 'other:goblin': 3 }

    expect(clearCharacterScopedRecord(record, 'hero')).toBe(record)
  })

  it('removes a character from disengaged ids without mutating the previous set', () => {
    const prev = new Set(['hero', 'other'])
    const next = removeDisengagedCharacterId(prev, 'hero')

    expect([...prev].sort()).toEqual(['hero', 'other'])
    expect([...next].sort()).toEqual(['other'])
    expect(removeDisengagedCharacterId(next, 'missing')).toBe(next)
  })

  it('builds a headless end turn action', () => {
    expect(buildHeadlessEndTurnAction({ actorTokenId: 'hero-token', characterId: 'hero' })).toEqual({
      type: 'end-turn',
      actorTokenId: 'hero-token',
      characterId: 'hero',
    })
  })
})
