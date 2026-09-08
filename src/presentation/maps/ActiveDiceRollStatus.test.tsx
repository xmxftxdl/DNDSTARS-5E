import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ActiveDiceRollStatus from './ActiveDiceRollStatus'
import { resolveActiveDiceRollStatus } from './diceRollStatusModel'

describe('active dice roll status', () => {
  it('describes a local d20 roll with its purpose and target', () => {
    const status = resolveActiveDiceRollStatus({
      diceBoxD20: {
        id: 7,
        label: '骷髅·短弓命中检定',
        targetName: '新冒险者',
        value: 14,
        resolve: () => {},
      },
      diceBoxRoll: null,
      rollRequestPreview: null,
    })

    expect(status).toMatchObject({
      formula: '1d20', label: '骷髅·短弓命中检定', targetName: '新冒险者',
    })
    const html = renderToStaticMarkup(<ActiveDiceRollStatus status={status!} />)
    expect(html).toContain('正在投掷')
    expect(html).toContain('1d20')
    expect(html).toContain('骷髅·短弓命中检定')
    expect(html).toContain('新冒险者')
  })

  it('shows the authoritative pool size even when the animation is capped', () => {
    expect(resolveActiveDiceRollStatus({
      diceBoxD20: null,
      diceBoxRoll: {
        id: 8,
        count: 12,
        totalCount: 26,
        sides: 6,
        label: '龙息伤害',
        targetName: '范围内目标',
        values: [],
        resolve: () => {},
      },
      rollRequestPreview: null,
    })?.formula).toBe('26d6')
  })

  it('falls back to the synchronized public roll on another client', () => {
    expect(resolveActiveDiceRollStatus({
      diceBoxD20: null,
      diceBoxRoll: null,
      rollRequestPreview: {
        id: 'shared-1', kind: 'dice', count: 4, sides: 6, values: [1, 2, 3, 4],
        label: '坠落伤害', targetName: 'Test02',
      },
    })).toMatchObject({ formula: '4d6', label: '坠落伤害', targetName: 'Test02' })
  })
})
