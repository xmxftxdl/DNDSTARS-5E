import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import DmAdjudicationPanel, { type SharedDmAdjudicationPromptView } from './DmAdjudicationPanel'

type Props = Parameters<typeof DmAdjudicationPanel>[0]

function render(overrides: Partial<Props> = {}) {
  const props: Props = {
    isDm: true,
    prompt: null,
    tokens: [],
    dc: '',
    setDc: vi.fn(),
    mapOverride: 'roll',
    setMapOverride: vi.fn(),
    saveOverride: 'unchanged',
    setSaveOverride: vi.fn(),
    effects: [],
    setEffects: vi.fn(),
    concentrationRounds: '',
    setConcentrationRounds: vi.fn(),
    note: '',
    setNote: vi.fn(),
    onDecision: vi.fn(),
    ...overrides,
  }
  return renderToStaticMarkup(createElement(DmAdjudicationPanel, props))
}

describe('DM 裁定面板', () => {
  it('玩家端或没有待裁定事务时不显示', () => {
    expect(render()).toBe('')
    expect(render({ isDm: false })).toBe('')
  })

  it('地图交互显示权威事务说明、DC 与结果覆盖', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'adjudication',
      payload: {
        contextKind: 'map-interaction', actionId: 'action', casterName: '战士',
        spellId: 'map-door', spellName: '力量破门', spellLevel: 0, slotLevel: 0,
        castingTime: 'action', description: '尝试撞开上锁的门。', concentration: false,
        proposedDc: 15,
      },
    }
    const html = render({ prompt, dc: '15' })
    expect(html).toContain('地图交互中断 · 力量破门')
    expect(html).toContain('DM 权威地图事务')
    expect(html).toContain('裁定 DC')
    expect(html).toContain('按 Headless 骰值结算')
    expect(html).toContain('拒绝交互')
  })

  it('其他行动明确显示资源已经消耗且裁定不会返还', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'basic-action-adjudication',
      payload: {
        contextKind: 'basic-action', actionId: 'action', casterName: '游荡者',
        spellId: 'basic-action:other-bonus-action', spellName: '其他（附赠动作）',
        spellLevel: 0, slotLevel: 0, castingTime: 'bonus-action',
        description: '快速割断吊灯绳索。', concentration: false,
      },
    }
    const html = render({ prompt })
    expect(html).toContain('其他行动裁定 · 其他（附赠动作）')
    expect(html).toContain('已经消耗附赠动作')
    expect(html).toContain('驳回裁定（不返还）')
    expect(html).toContain('确认裁定')
    expect(html).not.toContain('添加目标效果')
  })

  it('未自动化的随机表结果显示暂停状态和恢复操作', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'random-table-adjudication',
      payload: {
        contextKind: 'post-spell-random-table',
        actionId: 'random-table-action',
        casterName: '术士',
        spellId: 'fixture.table-check',
        spellName: '施法后随机表结果 50',
        spellLevel: 0,
        slotLevel: 0,
        castingTime: 'action',
        description: '当前结果需要 DM 裁定。',
        concentration: false,
        randomTableRoll: 50,
        sourceSpellId: 'magic-missile',
      },
    }

    const html = render({ prompt })
    expect(html).toContain('随机表结果裁定 · 施法后随机表结果 50')
    expect(html).toContain('d100 结果 50 · 原始法术 magic-missile')
    expect(html).toContain('战斗结算已暂停')
    expect(html).toContain('跳过该随机表结果')
    expect(html).toContain('提交裁定并继续')
    expect(html).not.toContain('取消施法（不消费）')
  })
})
