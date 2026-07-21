import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { SharedSavingThrowRerollPromptView } from '../../lib/combatInterruptPrompts'
import type { Character } from '../../types/character'
import ReactionInterruptPanels from './ReactionInterruptPanels'

type Props = Parameters<typeof ReactionInterruptPanels>[0]

function render(overrides: Partial<Props> = {}) {
  const props: Props = {
    now: 1_000,
    savingThrowRerollPrompt: null,
    protectionPrompt: null,
    shieldSpellPrompt: null,
    counterspellPrompt: null,
    uncannyDodgePrompt: null,
    deflectMissilesPrompt: null,
    opportunityAttackPrompt: null,
    onSavingThrowRerollChoice: vi.fn(),
    onProtectionChoice: vi.fn(),
    onShieldSpellChoice: vi.fn(),
    onCounterspellChoice: vi.fn(),
    onUncannyDodgeChoice: vi.fn(),
    onDeflectMissilesChoice: vi.fn(),
    onOpportunityAttackChoice: vi.fn(),
    ...overrides,
  }
  return renderToStaticMarkup(createElement(ReactionInterruptPanels, props))
}

describe('战斗反应中断面板', () => {
  it('没有待处理中断时不渲染对话框', () => {
    expect(render()).toBe('')
  })

  it('豁免重掷显示来源特性、当前总值与 DC', () => {
    const savingThrowRerollPrompt: SharedSavingThrowRerollPromptView = {
      id: 'reroll',
      expiresAt: 5_000,
      targetChar: { name: '战士' } as Character,
      featureName: '不屈',
      total: 8,
      dc: 12,
    }
    const html = render({ savingThrowRerollPrompt })
    expect(html).toContain('不屈')
    expect(html).toContain('豁免结果 8 未达到 DC 12')
    expect(html).toContain('使用不屈')
    expect(html).toContain('4s')
  })
})
