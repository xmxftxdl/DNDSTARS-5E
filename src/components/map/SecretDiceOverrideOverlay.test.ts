import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SecretDiceOverrideOverlay from './SecretDiceOverrideOverlay'

describe('SecretDiceOverrideOverlay', () => {
  it('让 DM 在不公开骰面的情况下逐枚修正非 d20 暗骰', () => {
    const html = renderToStaticMarkup(createElement(SecretDiceOverrideOverlay, {
      label: '火焰吐息·伤害',
      targetName: '冒险者',
      sides: 6,
      values: [2, 5, 6],
      onConfirm: () => undefined,
    }))

    expect(html).toContain('data-testid="secret-dice-override"')
    expect(html).toContain('暗骰待 DM 确认')
    expect(html).toContain('3d6')
    expect(html).toContain('目标：')
    expect(html.match(/type="number"/g)).toHaveLength(3)
    expect(html).toContain('采用暗骰并继续结算')
  })
})
