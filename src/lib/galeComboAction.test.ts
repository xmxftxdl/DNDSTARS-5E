import { describe, expect, it } from 'vitest'
import {
  buildGaleComboChoiceParams,
  planGaleComboChoiceSettlement,
} from './galeComboAction'
import type { HeadlessGaleComboChoiceResult } from './headlessDmCombatEngine'

function makeResult(patch: Partial<HeadlessGaleComboChoiceResult> = {}): HeadlessGaleComboChoiceResult {
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
  }
}

describe('gale combo action helpers', () => {
  it('builds accepted gale combo choice params for the headless engine', () => {
    expect(
      buildGaleComboChoiceParams({
        characterId: 'hero',
        triggerLabel: '旋风飞腿命中',
      }),
    ).toEqual({
      characterId: 'hero',
      accepted: true,
      triggerLabel: '旋风飞腿命中',
    })
  })

  it('plans accepted gale combo choice logs', () => {
    expect(
      planGaleComboChoiceSettlement({
        result: makeResult(),
        casterName: '新冒险者',
      }),
    ).toEqual({
      status: 'accepted',
      logs: [
        {
          text: '新冒险者 发动疾风连击：下一次技能或基础射击不消耗 AP。',
          kind: 'turn',
        },
      ],
    })
  })

  it('plans rejected gale combo choice logs', () => {
    expect(
      planGaleComboChoiceSettlement({
        result: makeResult({ ok: false, reason: 'unavailable' }),
        casterName: '新冒险者',
      }),
    ).toEqual({
      status: 'rejected',
      log: {
        text: '新冒险者 疾风连击发动失败：unavailable。',
        kind: 'system',
      },
    })
  })
})
