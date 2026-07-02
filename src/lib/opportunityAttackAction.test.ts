import { describe, expect, it } from 'vitest'
import {
  buildOpportunityAttackAction,
  planOpportunityAttackSettlement,
  shouldRollOpportunityDamage,
} from './opportunityAttackAction'
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
    events: [
      {
        type: 'opportunity-resolved',
        attackerTokenId: 'goblin',
        targetTokenId: 'hero-token',
        d20Value: 14,
        attackBonus: 4,
        targetAc: 12,
        hit: true,
        isCrit: false,
        damageValues: [5],
        rawDamage: 5,
        damageBeforeDefense: 5,
        modifier: 2,
        diff: 12,
        total: 7,
      },
    ],
    ...patch,
  } as HeadlessCombatResult
}

describe('opportunity attack action helpers', () => {
  it('builds opportunity attack headless actions', () => {
    expect(
      buildOpportunityAttackAction({
        attackerTokenId: 'goblin',
        targetTokenId: 'hero-token',
        d20Value: 14,
        damageValues: [5],
      }),
    ).toEqual({
      type: 'opportunity-attack-token',
      actorTokenId: 'goblin',
      targetTokenId: 'hero-token',
      d20Value: 14,
      damageValues: [5],
    })
  })

  it('determines whether damage dice are needed from attack math', () => {
    expect(shouldRollOpportunityDamage({ d20Value: 7, attackBonus: 4, targetAc: 12 })).toBe(false)
    expect(shouldRollOpportunityDamage({ d20Value: 8, attackBonus: 4, targetAc: 12 })).toBe(true)
    expect(shouldRollOpportunityDamage({ d20Value: 20, attackBonus: 0, targetAc: 99 })).toBe(true)
  })

  it('plans accepted opportunity attack roll and combat log', () => {
    const plan = planOpportunityAttackSettlement({
      result: makeResult(),
      attackerName: 'Goblin',
      targetName: 'Hero',
      critDamageLabel: '125%',
    })

    expect(plan).toMatchObject({
      status: 'accepted',
      roll: {
        values: [5],
        sides: 6,
        bonus: 2,
        total: 7,
        d20Roll: { value: 14, modifier: 4, ac: 12, hit: true },
      },
      combatLog: { kind: 'damage' },
    })
    expect(plan.status === 'accepted' && plan.combatLog.text).toContain('Goblin 借机攻击 Hero')
    expect(plan.status === 'accepted' && plan.roll.formula).toBe('5 + 2攻防修正(差值12) = 7')
  })

  it('plans missed opportunity attacks without damage formula', () => {
    const plan = planOpportunityAttackSettlement({
      result: makeResult({
        events: [
          {
            type: 'opportunity-resolved',
            attackerTokenId: 'goblin',
            targetTokenId: 'hero-token',
            d20Value: 3,
            attackBonus: 4,
            targetAc: 12,
            hit: false,
            isCrit: false,
            damageValues: [],
            rawDamage: 0,
            damageBeforeDefense: 0,
            modifier: 0,
            diff: 0,
            total: 0,
          },
        ],
      }),
      attackerName: 'Goblin',
      targetName: 'Hero',
      critDamageLabel: '125%',
    })

    expect(plan).toMatchObject({
      status: 'accepted',
      roll: {
        values: [],
        total: 0,
        label: '借机攻击 · 3+4 vs AC12 未中',
      },
      combatLog: { kind: 'attack' },
    })
  })

  it('plans rejection and ignored results', () => {
    expect(
      planOpportunityAttackSettlement({
        result: makeResult({ ok: false, reason: 'insufficient-ap' }),
        attackerName: 'Goblin',
        targetName: 'Hero',
        critDamageLabel: '125%',
      }),
    ).toEqual({
      status: 'rejected',
      log: {
        text: 'Goblin 借机攻击未执行：insufficient-ap',
        kind: 'system',
      },
    })

    expect(
      planOpportunityAttackSettlement({
        result: makeResult({ events: [] }),
        attackerName: 'Goblin',
        targetName: 'Hero',
        critDamageLabel: '125%',
      }),
    ).toEqual({ status: 'ignored' })
  })
})
