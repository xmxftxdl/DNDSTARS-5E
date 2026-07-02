import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import {
  buildEnemyMoveAction,
  planEnemyMoveSettlement,
} from './enemyMoveAction'
import type { HeadlessCombatResult } from './headlessDmCombatEngine'

function makeEnemy(patch: Partial<Token> = {}): Token {
  return {
    id: 'goblin',
    label: 'Goblin',
    x: 100,
    y: 100,
    color: '#ef4444',
    emoji: '',
    type: 'enemy',
    size: 1,
    hp: 10,
    maxHp: 10,
    ...patch,
  }
}

function makeMap(enemy = makeEnemy()): BattleMap {
  return {
    id: 'map-1',
    name: 'Map',
    width: 1000,
    height: 1000,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens: [enemy],
  }
}

function makeResult(patch: Partial<HeadlessCombatResult> = {}): HeadlessCombatResult {
  return {
    ok: true,
    state: {
      map: makeMap(),
      characters: [],
      active: true,
      round: 1,
      initiativeIndex: 0,
      initiativeOrder: [],
      enemyApByToken: { goblin: { current: 1, max: 2 } },
    },
    events: [
      {
        type: 'ap-spent',
        tokenId: 'goblin',
        amount: 1,
        before: 2,
        after: 1,
      },
      {
        type: 'token-moved',
        tokenId: 'goblin',
        from: { x: 100, y: 100 },
        to: { x: 150, y: 100 },
        feet: 5,
      },
    ],
    ...patch,
  } as HeadlessCombatResult
}

describe('enemy move action helpers', () => {
  it('builds headless enemy movement actions', () => {
    expect(
      buildEnemyMoveAction({
        enemy: makeEnemy(),
        targetPosition: { x: 150, y: 100 },
        apCost: 1,
      }),
    ).toEqual({
      type: 'enemy-move-token',
      actorTokenId: 'goblin',
      targetPosition: { x: 150, y: 100 },
      apCost: 1,
    })
  })

  it('plans enemy movement AP logs from headless events', () => {
    expect(
      planEnemyMoveSettlement({
        result: makeResult(),
        enemy: makeEnemy(),
        actionLabel: '移动',
        fallbackApMax: 2,
      }),
    ).toEqual({
      status: 'accepted',
      log: {
        text: 'Goblin 花费 1 AP：移动 5 尺。剩余 AP 1/2',
        kind: 'turn',
      },
    })
  })

  it('accepts movement without AP logs when no AP event exists', () => {
    expect(
      planEnemyMoveSettlement({
        result: makeResult({ events: [] }),
        enemy: makeEnemy(),
        actionLabel: '移动',
        fallbackApMax: 2,
      }),
    ).toEqual({ status: 'accepted' })
  })

  it('plans rejection logs for failed headless movement', () => {
    expect(
      planEnemyMoveSettlement({
        result: makeResult({ ok: false, reason: 'insufficient-ap' }),
        enemy: makeEnemy(),
        actionLabel: '继续移动',
        fallbackApMax: 2,
      }),
    ).toEqual({
      status: 'rejected',
      reason: 'insufficient-ap',
      log: {
        text: 'Goblin 继续移动失败：insufficient-ap',
        kind: 'system',
      },
    })
  })
})
