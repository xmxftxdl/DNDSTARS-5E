import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { SharedPluginChoicePromptView } from '../../lib/combatInterruptPrompts'
import ClassFeatureInterruptPanels from './ClassFeatureInterruptPanels'

type Props = Parameters<typeof ClassFeatureInterruptPanels>[0]

function render(overrides: Partial<Props> = {}) {
  const props: Props = {
    now: 1_000,
    pluginChoicePrompt: null,
    bardicInspirationPrompt: null,
    cuttingWordsPrompt: null,
    darkOnesOwnLuckPrompt: null,
    strokeOfLuckPrompt: null,
    empoweredSpellPrompt: null,
    empoweredSpellSelection: [],
    standAgainstTidePrompt: null,
    onPluginChoice: vi.fn(),
    onBardicInspirationChoice: vi.fn(),
    onCuttingWordsChoice: vi.fn(),
    onDarkOnesOwnLuckChoice: vi.fn(),
    onStrokeOfLuckChoice: vi.fn(),
    setEmpoweredSpellSelection: vi.fn(),
    onEmpoweredSpellChoice: vi.fn(),
    onStandAgainstTideChoice: vi.fn(),
    ...overrides,
  }
  return renderToStaticMarkup(createElement(ClassFeatureInterruptPanels, props))
}

describe('职业与插件中断面板', () => {
  it('renders multi-select options as checkboxes and leaves cancellation usable when a required selection is empty',()=>{
    const html=render({pluginChoicePrompt:{id:'temple-access',payload:{pluginId:'plugin',featureId:'temple',featureName:'神庙术',prompt:'入口授权',audience:'actor',
      options:[{id:'apply',label:'确认'},{id:'cancel',label:'取消'}],defaultOptionId:'cancel',
      fields:[{id:'delegates',label:'获准开门的生物',kind:'multi-select',required:true,options:[{id:'hero',label:'Hero'},{id:'monster',label:'Monster'}]}]}}})
    expect(html.match(/type="checkbox"/g)).toHaveLength(2)
    expect(html).toContain('role="group" aria-label="获准开门的生物"')
    expect(html).toMatch(/data-testid="shared-plugin-choice-apply" disabled=""/)
    expect(html).not.toMatch(/data-testid="shared-plugin-choice-cancel" disabled/)
  })
  it('renders required appearance input, disables submit until valid, and leaves cancellation enabled', () => {
    const html = render({ pluginChoicePrompt: { id: 'appearance', payload: {
      pluginId: 'plugin', featureId: 'flame', featureName: '控火', prompt: '影像', audience: 'actor',
      options: [{ id: 'apply', label: '继续' }, { id: 'cancel', label: '取消' }], defaultOptionId: 'cancel',
      fields: [{ id: 'shape', label: '影像描述', kind: 'text', required: true },
        { id: 'color', label: '火焰颜色', kind: 'color', defaultValue: '#ffaa00' }],
    } } })
    expect(html).toContain('aria-label="影像描述"')
    expect(html).toContain('type="color"')
    expect(html).toMatch(/data-testid="shared-plugin-choice-apply" disabled=""/)
    expect(html).not.toMatch(/data-testid="shared-plugin-choice-cancel" disabled/)
  })
  it('没有待处理中断时不渲染对话框', () => {
    expect(render()).toBe('')
  })

  it('插件选择显示规则包特性、选项说明和超时默认项', () => {
    const pluginChoicePrompt: SharedPluginChoicePromptView = {
      id: 'choice',
      expiresAt: 6_000,
      payload: {
        pluginId: 'plugin', featureId: 'feature', featureName: '命运改写',
        prompt: '选择本次投掷的处理方式。', audience: 'actor',
        options: [
          { id: 'keep', label: '保留结果', description: '不消耗资源。' },
          { id: 'reroll', label: '重掷', description: '消耗一次特性。' },
        ],
        defaultOptionId: 'keep',
      },
    }
    const html = render({ pluginChoicePrompt })
    expect(html).toContain('命运改写')
    expect(html).toContain('选择本次投掷的处理方式。')
    expect(html).toContain('重掷')
    expect(html).toContain('超时将采用“保留结果”')
    expect(html).toContain('5s')
    expect(html).toContain('data-testid="shared-plugin-choice-options"')
    expect(html).toContain('overflow-y-auto')
    expect(html).toContain('z-[160]')
  })

  it('激励等投骰修正使用左侧非遮罩侧栏', () => {
    const html = render({
      bardicInspirationPrompt: {
        id: 'bardic', targetChar: { id: 'hero', name: '吟游诗人' } as never,
        dieSides: 8, rollType: '攻击检定', total: 13, targetNumber: 15,
      },
    })
    expect(html).toContain('data-testid="roll-adjustment-drawer"')
    expect(html).toContain('data-testid="bardic-inspiration-roll-owner-notice"')
    expect(html).toContain('不会修改怪物的攻击骰、伤害骰、传奇动作点或动作效果')
    expect(html).toContain('pointer-events-none')
    expect(html).not.toContain('bg-black/55')
  })
})
