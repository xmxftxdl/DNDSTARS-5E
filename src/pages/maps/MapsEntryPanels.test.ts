import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  MapsEmptyMapPanel,
  MapsModeSelectionPanel,
  MapsModeToggle,
} from './MapsEntryPanels'

describe('地图入口面板', () => {
  it('只显示 DM 与玩家两种入口并提供完整说明', () => {
    const html = renderToStaticMarkup(createElement(MapsModeSelectionPanel, { onChooseMode: vi.fn() }))
    expect(html.match(/DM 界面/g)).toHaveLength(1)
    expect(html.match(/玩家界面/g)).toHaveLength(1)
    expect(html).toContain('管理地图、怪物详情、状态、血量、网格和障碍物。')
  })

  it('模式切换器只高亮当前模式', () => {
    const html = renderToStaticMarkup(createElement(MapsModeToggle, { mode: 'player', onChooseMode: vi.fn() }))
    expect(html.match(/bg-arcane-500\/30/g)).toHaveLength(1)
    expect(html).not.toContain('bg-ember-500/30')
  })

  it('只有 DM 空地图面板显示上传入口', () => {
    const dmHtml = renderToStaticMarkup(createElement(MapsEmptyMapPanel, { isDm: true, onUpload: vi.fn() }))
    const playerHtml = renderToStaticMarkup(createElement(MapsEmptyMapPanel, { isDm: false, onUpload: vi.fn() }))
    expect(dmHtml).toContain('选择图片上传')
    expect(playerHtml).not.toContain('选择图片上传')
  })
})
