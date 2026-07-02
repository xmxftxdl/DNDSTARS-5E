import { describe, expect, it } from 'vitest'
import {
  buildAgileLeapReadyAction,
  planAgileLeapReadySettlement,
} from './agileLeapAction'
import type { HeadlessCombatResult } from './headlessDmCombatEngine'

function makeResult(patch: Partial<HeadlessCombatResult> = {}): HeadlessCombatResult {
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
    events: [{ type: 'log', text: 'Hero 发动灵巧跳跃：可移动至多 10 尺，不消耗 AP。' }],
    ...patch,
  } as HeadlessCombatResult
}

describe('agile leap action helpers', () => {
  it('builds agile leap ready headless actions', () => {
    expect(
      buildAgileLeapReadyAction({
        actorTokenId: 'hero-token',
        characterId: 'hero',
        feet: 10,
      }),
    ).toEqual({
      type: 'agile-leap-ready',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      feet: 10,
    })
  })

  it('plans accepted agile leap ready logs', () => {
    expect(planAgileLeapReadySettlement(makeResult())).toEqual({
      status: 'accepted',
      logs: [
        {
          text: 'Hero 发动灵巧跳跃：可移动至多 10 尺，不消耗 AP。',
          kind: 'turn',
        },
      ],
    })
  })

  it('plans rejected agile leap ready settlement', () => {
    expect(planAgileLeapReadySettlement(makeResult({ ok: false, reason: 'invalid-skill' }))).toEqual({
      status: 'rejected',
      reason: 'invalid-skill',
    })
  })
})
