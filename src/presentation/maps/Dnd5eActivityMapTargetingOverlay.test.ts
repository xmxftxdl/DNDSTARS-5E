import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import Dnd5eActivityMapTargetingOverlay from './Dnd5eActivityMapTargetingOverlay'
import type { Dnd5eActivityMapTargetingSession } from './useDnd5eActivityMapTargeting'

function renderSession(session: Dnd5eActivityMapTargetingSession) {
  return renderToStaticMarkup(createElement(Dnd5eActivityMapTargetingOverlay, {
    session,
    onCancel: vi.fn(),
  }))
}

describe('D&D 5E Activity 地图交互浮层', () => {
  it('显示可旋转的范围模板说明', () => {
    const html = renderSession({
      kind: 'area',
      receiptId: 'receipt:area',
      label: '火墙',
      actorTokenId: 'actor',
      originTokenId: 'actor',
      template: {
        shape: 'rect',
        origin: 'point',
        widthFeet: 5,
        heightFeet: 60,
        rotatable: true,
      },
      requiredCells: 1,
      selectedCells: [],
    })

    expect(html).toContain('选择范围落点')
    expect(html).toContain('Q/E 旋转模板')
    expect(html).toContain('取消本次 Activity')
  })

  it('显示多单位召唤放置进度', () => {
    const html = renderSession({
      kind: 'summon',
      receiptId: 'receipt:summon',
      label: '召唤援军',
      actorTokenId: 'actor',
      originTokenId: 'actor',
      template: { shape: 'circle', origin: 'self', radiusFeet: 30 },
      requiredCells: 3,
      selectedCells: [{ col: 2, row: 4 }],
    })

    expect(html).toContain('选择召唤位置')
    expect(html).toContain('1/3')
  })
})
