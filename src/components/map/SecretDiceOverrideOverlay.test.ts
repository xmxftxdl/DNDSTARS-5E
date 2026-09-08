import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SecretDiceOverrideOverlay from './SecretDiceOverrideOverlay'

describe('SecretDiceOverrideOverlay', () => {
  it('让 DM 在不公开骰面的情况下逐枚修正非 d20 暗骰', () => {
    const html = renderToStaticMarkup(createElement(SecretDiceOverrideOverlay, {
      label: '火焰吐息·伤害',
      targetName: '冒险者',
      sides: 10,
      values: [2, 10, 6],
      onConfirm: () => undefined,
    }))

    expect(html).toContain('data-testid="secret-dice-override"')
    expect(html).toContain('data-layout="left-drawer"')
    expect(html).toContain('pointer-events-none fixed inset-y-0 left-0')
    expect(html).not.toContain('aria-modal="true"')
    expect(html).toContain('暗骰待 DM 确认')
    expect(html).toContain('3d10')
    expect(html).toContain('目标：')
    expect(html.match(/type="text"/g)).toHaveLength(3)
    expect(html.match(/inputMode="numeric"/g)).toHaveLength(3)
    expect(html).toContain('aria-label="第 2 枚 d10 骰面"')
    expect(html).toContain('value="10"')
    expect(html).not.toContain('type="number"')
    expect(html).toContain('采用暗骰并继续结算')
  })
})
