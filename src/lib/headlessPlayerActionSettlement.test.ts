import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import type { HeadlessCombatResult, HeadlessDmCombatState } from './headlessDmCombatEngine'
import {
  headlessResultLogs,
  planHeadlessPlayerActionSettlement,
  tokenMovedEvent,
} from './headlessPlayerActionSettlement'

const action: SharedPlayerActionState = {
  id: 'action-1',
  mapId: 'map',
  combatId: 'combat',
  sourceMode: 'player',
  status: 'pending',
  type: 'move-token',
  actorTokenId: 'hero-token',
  characterId: 'hero',
  round: 1,
  initiativeIndex: 0,
  seq: 1,
  updatedAt: 100,
}

const state = {
  active: true,
  round: 1,
  initiativeIndex: 0,
  initiativeOrder: [],
  enemyApByToken: {},
  disengagedCharacterIds: [],
  map: {
    id: 'map',
    name: 'Map',
    width: 100,
    height: 100,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens: [],
  },
  characters: [],
} satisfies HeadlessDmCombatState

describe('headless player action settlement', () => {
  it('plans rejected actions without applying events', () => {
    const result: HeadlessCombatResult = {
      ok: false,
      state,
      reason: 'movement-locked',
      events: [{ type: 'log', text: 'should not be logged' }],
    }

    expect(
      planHeadlessPlayerActionSettlement({
        action,
        result,
        rejectReason: (reason) => (reason === 'movement-locked' ? 'no-move' : reason),
      }),
    ).toEqual({
      status: 'rejected',
      shouldComplete: true,
      ackReason: 'no-move',
      logs: [],
    })
  })

  it('plans accepted ACK data and ordered result logs', () => {
    const result: HeadlessCombatResult = {
      ok: true,
      state,
      events: [
        { type: 'log', text: '新冒险者移动。' },
        { type: 'turn-advanced', tokenId: 'hero-token', round: 2, initiativeIndex: 0 },
      ],
    }

    expect(
      planHeadlessPlayerActionSettlement({
        action,
        result,
        acceptedPosition: { x: 50, y: 100 },
        acceptedReason: 'ok',
        previousRound: 1,
      }),
    ).toEqual({
      status: 'accepted',
      shouldComplete: true,
      acceptedPosition: { x: 50, y: 100 },
      acceptedReason: 'ok',
      logs: [
        { text: '新冒险者移动。', kind: 'turn' },
        { text: '进入第 2 回合', kind: 'turn', round: 2 },
      ],
    })
  })

  it('finds the token move event for accepted move ACKs', () => {
    const events: HeadlessCombatResult['events'] = [
      { type: 'log', text: '移动。' },
      {
        type: 'token-moved',
        tokenId: 'hero-token',
        from: { x: 0, y: 0 },
        to: { x: 50, y: 50 },
        feet: 5,
        triggersMoveEffects: true,
      },
    ]

    expect(tokenMovedEvent(events, 'hero-token')).toMatchObject({
      tokenId: 'hero-token',
      to: { x: 50, y: 50 },
    })
    expect(headlessResultLogs(events)).toEqual([{ text: '移动。', kind: 'turn' }])
  })
})
