import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import MapCombatUnitDrawer, { MapCombatUnitStatusPanel } from './MapCombatUnitDrawer'

describe('MapCombatUnitDrawer', () => {
  it('hosts one unit context with mutually exclusive tabs', () => {
    const html = renderToStaticMarkup(createElement(MapCombatUnitDrawer, {
      open: true,
      activeTab: 'actions',
      actionsAvailable: true,
      onTabChange: () => undefined,
      onClose: () => undefined,
      children: createElement('div', { 'data-testid': 'unit-content' }, '行动内容'),
    }))

    expect(html).toContain('data-testid="map-combat-unit-drawer"')
    expect(html).toContain('aria-label="单位面板页签"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('行动')
    expect(html).toContain('数据卡')
    expect(html).not.toContain('>状态</button>')
    expect(html).toContain('data-testid="unit-content"')
  })

  it('disables actions for a unit that cannot act', () => {
    const html = renderToStaticMarkup(createElement(MapCombatUnitDrawer, {
      open: true,
      activeTab: 'stats',
      actionsAvailable: false,
      onTabChange: () => undefined,
      onClose: () => undefined,
      children: null,
    }))
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*(?:<svg[\s\S]*?<\/svg>)?行动<\/button>/)
  })

  it('shows the selected unit identity, hit points, and armor class on the status page', () => {
    const token = {
      id: 'goblin-token',
      label: '地精',
      x: 0,
      y: 0,
      color: '#ef4444',
      emoji: '👺',
      size: 1,
      type: 'enemy',
      poolId: 'goblin',
      hp: 7,
      maxHp: 7,
    } satisfies Token
    const html = renderToStaticMarkup(createElement(MapCombatUnitStatusPanel, { token }))

    expect(html).toContain('地精')
    expect(html).toContain('HP 7/7 · AC 15')
    expect(html).toContain('没有状态标记')
  })
})
