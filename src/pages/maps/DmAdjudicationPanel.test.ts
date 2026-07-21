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
})
