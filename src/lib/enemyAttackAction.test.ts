import { describe, expect, it } from 'vitest'
import type { EnemyAttackRoll } from './enemyAi'
import {
  planEnemyAttackApLog,
  planEnemyAttackSettlement,
} from './enemyAttackAction'
import type { HeadlessCombatResult } from './headlessDmCombatEngine'

const attack: EnemyAttackRoll = {
  values: [4],
  sides: 6,
  bonus: 4,
  total: 8,
  label: '近战 1d6+4',
  targetName: 'Hero',
}

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
      enemyApByToken: { goblin: { current: 1, max: 2 } },
    },
    events: [
      { type: 'ap-spent', tokenId: 'goblin', amount: 1, before: 2, after: 1 },
      {
        type: 'enemy-attack-resolved',
        actorTokenId: 'goblin',
        targetTokenId: 'hero-token',
        actionName: '短弓',
        damageValues: [4],
        diceTotal: 4,
        damageBonus: 4,
        rawDamage: 8,
        damageBeforeDefense: 8,
        modifier: 2,
        diff: 10,
        total: 6,
        targetDodged: false,
      },
    ],
    ...patch,
  } as HeadlessCombatResult
}

describe('enemy attack action helpers', () => {
  it('plans accepted enemy attack display from headless events', () => {
    const plan = planEnemyAttackSettlement({
      result: makeResult(),
      attack,
      combatLabel: '受击（未尝试闪避）',
    })

    expect(plan).toMatchObject({
      status: 'accepted',
      damageValues: [4],
      damageTotal: 6,
      damageBonus: 2,
      roll: {
        values: [4],
        sides: 6,
        bonus: 2,
        total: 6,
        label: '近战 1d6+4 · 受击（未尝试闪避）',
        formula: '4 + 2 = 6',
      },
      combatLog: {
        text: '近战 1d6+4 -> Hero：伤害骰 4，加值 2，最终 6 点；受击（未尝试闪避）',
        kind: 'damage',
      },
    })
  })

  it('plans zero-damage enemy attack display for successful dodges', () => {
    const plan = planEnemyAttackSettlement({
      result: makeResult({
        events: [
          {
            type: 'enemy-attack-resolved',
            actorTokenId: 'goblin',
            targetTokenId: 'hero-token',
            actionName: '短弓',
            damageValues: [],
            diceTotal: 0,
            damageBonus: 4,
            rawDamage: 0,
            damageBeforeDefense: 0,
            modifier: 0,
            diff: 0,
            total: 0,
            targetDodged: true,
            dodgeD20: 19,
            dodgeAttackBonus: 4,
            dodgeTotal: 23,
            targetAc: 14,
          },
        ],
      }),
      attack,
      combatLabel: '闪避判定 19+4=23 vs AC 14 成功',
    })

    expect(plan).toMatchObject({
      status: 'accepted',
      roll: {
        values: [],
        bonus: 0,
        total: 0,
        formula: undefined,
      },
      combatLog: {
        kind: 'attack',
      },
    })
  })

  it('plans enemy attack AP logs', () => {
    expect(
      planEnemyAttackApLog({
        result: makeResult(),
        actorTokenId: 'goblin',
        attackerName: 'Goblin',
        targetName: 'Hero',
        fallbackApMax: 2,
      }),
    ).toEqual({
      text: 'Goblin 花费 1 AP：攻击 Hero。剩余 AP 1/2',
      kind: 'turn',
    })
  })

  it('plans rejected and ignored enemy attack settlement', () => {
    expect(
      planEnemyAttackSettlement({
        result: makeResult({ ok: false, reason: 'insufficient-ap' }),
        attack,
        combatLabel: '',
      }),
    ).toEqual({
      status: 'rejected',
      log: {
        text: '敌人攻击未执行：insufficient-ap',
        kind: 'system',
      },
    })

    expect(
      planEnemyAttackSettlement({
        result: makeResult({ events: [] }),
        attack,
        combatLabel: '',
      }),
    ).toEqual({ status: 'ignored' })
  })
})
