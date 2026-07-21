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
  })
})
