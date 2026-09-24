import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMapFog } from '../../lib/fogOfWar'
import MapFogToolbar from './MapFogToolbar'

type Props = Parameters<typeof MapFogToolbar>[0]

function render(overrides: Partial<Props> = {}) {
  const props: Props = {
    mapId: 'map-1',
    fog: createEmptyMapFog('map-1', 1),
    redoCount: 0,
    editMode: false,
    tool: 'reveal-rect',
    previewAsPlayer: false,
    onEditModeChange: vi.fn(),
    onToolChange: vi.fn(),
    onMagicalDarkness: vi.fn(),
    onFill: vi.fn(),
    onClear: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onPreviewChange: vi.fn(),
    onStyleChange: vi.fn(),
    ...overrides,
  }
  return renderToStaticMarkup(createElement(MapFogToolbar, props))
}

describe('地图战争迷雾工具栏', () => {
  it('切换魔法黑暗后仍显示勾选项、绘制和已有区域删除入口', () => {
    const html = render({
      editMode: true,
      magicalDarkness: true,
      darknessRegions: [{ id: 'darkness-1', label: '魔法黑暗' }],
    })
    expect(html).toContain('type="checkbox" checked=""')
    expect(html).not.toContain('绘制矩形')
    expect(html.match(/<option/g)).toHaveLength(9)
    expect(html).toContain('删除魔法黑暗 1')
    expect(html).toContain('全遮')
    expect(html).toContain('清空全图迷雾')
  })

  it('非编辑状态只显示入口，不暴露绘制和破坏性操作', () => {
    const html = render()
    expect(html).toContain('迷雾')
    expect(html).not.toContain('矩形揭示')
    expect(html).not.toContain('全遮')
    expect(html).not.toContain('全显')
  })

  it('编辑状态提供八种绘制工具以及撤销、重做和玩家预览', () => {
    const html = render({ editMode: true, previewAsPlayer: true })
    expect(html.match(/<option/g)).toHaveLength(9)
    expect(html).toContain('移动地图')
    expect(html).toContain('多边形遮盖')
    expect(html).toContain('撤销最后一笔')
    expect(html).toContain('重做')
    expect(html).toContain('aria-pressed="true"')
  })

  it('没有笔画和重做历史时禁用对应按钮', () => {
    const html = render({ editMode: true })
    expect(html.match(/disabled=""/g)).toHaveLength(2)
  })
})
