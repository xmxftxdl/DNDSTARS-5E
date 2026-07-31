import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import Dnd5eBasicActionsPanel from './Dnd5eBasicActionsPanel'

describe('Dnd5eBasicActionsPanel', () => {
  it('removes duplicated hotbar actions and exposes both DM-adjudicated economy options', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eBasicActionsPanel, {
      canAct: true,
      pending: false,
      targets: [],
      onAction: vi.fn(),
    }))

    expect(html).not.toContain('<option value="dash">')
    expect(html).not.toContain('<option value="hide">')
    expect(html).toContain('<option value="other-action">其他（动作）</option>')
    expect(html).toContain('<option value="other-bonus-action">其他（附赠动作）</option>')
    expect(html).toContain('疾走与躲藏使用底部快捷栏')
  })
})
