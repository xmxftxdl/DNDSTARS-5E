import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import Dnd5eBasicActionsPanel from './Dnd5eBasicActionsPanel'

describe('Dnd5eBasicActionsPanel', () => {
  it('surfaces a direct fixed-DC escape control for the authoritative grappler', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eBasicActionsPanel, {
      canAct: true,
      pending: false,
      targets: [
        { tokenId: 'ankheg', label: '掘穴虫', opposed: true, currentHp: 39, distanceFeet: 10 },
        { tokenId: 'goblin', label: '地精', opposed: true, currentHp: 7, distanceFeet: 5 },
      ],
      grappleEscapes: [{ grapplerTokenId: 'ankheg', dc: 13 }],
      onAction: vi.fn(),
    }))

    expect(html).toContain('data-testid="grapple-escape-controls"')
    expect(html).toContain('挣脱 掘穴虫 的擒抱（DC 13）')
    expect(html).not.toContain('挣脱 地精 的擒抱')
  })

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
