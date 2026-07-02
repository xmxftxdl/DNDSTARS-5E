import { describe, expect, it } from 'vitest'
import {
  buildHeadlessEndTurnAction,
  clearCharacterScopedRecord,
  planHeadlessEndTurnSettlement,
  removeDisengagedCharacterId,
} from './playerEndTurnAction'
import type { HeadlessCombatResult } from './headlessDmCombatEngine'

function makeHeadlessResult(patch: Partial<HeadlessCombatResult> = {}): HeadlessCombatResult {
  return {
    ok: true,
    state: {
      map: {
        id: 'map-1',
        name: 'Map',
        width: 1000,
        height: 1000,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        tokens: [],
      },
      characters: [],
      active: true,
      round: 1,
      initiativeIndex: 0,
      initiativeOrder: [],
      enemyApByToken: {},
    },
    events: [],
    ...patch,
  } as HeadlessCombatResult
}

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

  it('plans rejected end-turn settlement logs', () => {
    expect(
      planHeadlessEndTurnSettlement({
        result: makeHeadlessResult({ ok: false, reason: 'invalid-actor' }),
        previousRound: 1,
      }),
    ).toEqual({
      status: 'rejected',
      log: {
        text: '回合推进失败：invalid-actor',
        kind: 'system',
      },
    })
  })

  it('plans accepted end-turn logs and new-round scroll reset', () => {
    expect(
      planHeadlessEndTurnSettlement({
        result: makeHeadlessResult({
          events: [
            { type: 'log', text: 'Hero 结束回合。' },
            { type: 'turn-advanced', round: 2, initiativeIndex: 0 },
          ],
        }),
        previousRound: 1,
      }),
    ).toEqual({
      status: 'accepted',
      logs: [
        { text: 'Hero 结束回合。', kind: 'turn' },
        { text: '进入第 2 回合', kind: 'turn', round: 2 },
      ],
      shouldResetInitiativeScroll: true,
    })
  })

  it('does not reset initiative scroll when the round does not advance', () => {
    expect(
      planHeadlessEndTurnSettlement({
        result: makeHeadlessResult({
          events: [{ type: 'turn-advanced', round: 1, initiativeIndex: 1 }],
        }),
        previousRound: 1,
      }),
    ).toEqual({
      status: 'accepted',
      logs: [],
      shouldResetInitiativeScroll: false,
    })
  })
})
