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
  it('describes a surface selection without implying movement',()=>{
    const html=renderSession({kind:'surface',receiptId:'temple',label:'解离术 · 神庙',actorTokenId:'actor',originTokenId:'actor',
      template:{shape:'circle',origin:'self',radiusFeet:5},requiredCells:1,selectedCells:[]})
    expect(html).toContain('点击高亮的结构表面')
    expect(html).not.toContain('移动终点')
  })
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

it('offers explicit completion for optional map cell selection', () => {
  const html = renderSession({ kind: 'movement', receiptId: 'grove', label: '林地 · 重雾', actorTokenId: 'actor', originTokenId: 'actor',
    template: { shape: 'circle', origin: 'self', radiusFeet: 5 }, requiredCells: 36, minimumCells: 0, selectedCells: [] })
  expect(html).toContain('完成选择')
  expect(html).toContain('再次点击取消')
  expect(html).not.toContain('disabled=')
})
