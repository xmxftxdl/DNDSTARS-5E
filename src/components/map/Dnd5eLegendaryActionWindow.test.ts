import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import Dnd5eLegendaryActionWindow from './Dnd5eLegendaryActionWindow'

describe('传奇动作选择窗口', () => {
  it('显示可用点数并允许 DM 最小化而不结算窗口', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eLegendaryActionWindow, {
      endingTokenName: 'Test01',
      candidates: [{
        token: {
          id: 'sphinx', label: '斯芬克斯', x: 0, y: 0,
          color: '#f59e0b', emoji: 'S', size: 2, type: 'enemy',
        },
        currentPoints: 3,
        maximumPoints: 3,
        actions: [{
          id: 'claw', name: '爪击', description: '进行一次爪击。', cost: 1,
          affordable: true, actionIndex: 0, automation: 'headless',
          windowExecution: 'targeted-attack',
        }],
      }],
      targets: [{
        id: 'hero', label: 'Test01', x: 70, y: 70,
        color: '#38bdf8', emoji: 'H', size: 1, type: 'player', characterId: 'hero',
      }],
      onUse: vi.fn(),
      onSkip: vi.fn(),
    }))

    expect(html).toContain('传奇动作时机')
    expect(html).toContain('3 / 3')
    expect(html).toContain('aria-label="最小化传奇动作选择"')
    expect(html).toContain('data-testid="legendary-action-window-minimize"')
  })

  it('巫妖戏法窗口只列出 0 环法术', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eLegendaryActionWindow, {
      endingTokenName: 'Hero',
      candidates: [{
        token: {
          id: 'lich', label: '巫妖', x: 0, y: 0,
          color: '#a855f7', emoji: 'L', size: 1, type: 'enemy',
          poolId: 'srd-5.1:lich',
          dnd5eCombatState: { monsterLegendaryActionPoints: 3 },
        },
        currentPoints: 3,
        maximumPoints: 3,
        actions: [{
          id: 'cantrip', name: '戏法', description: '巫妖施展一道戏法。', cost: 1,
          affordable: true, actionIndex: 0, automation: 'headless',
          windowExecution: 'spell-selection',
        }],
      }],
      targets: [{
        id: 'hero', label: 'Hero', x: 70, y: 70,
        color: '#38bdf8', emoji: 'H', size: 1, type: 'player', characterId: 'hero',
      }],
      onUse: vi.fn(),
      onSkip: vi.fn(),
    }))

    expect(html).toContain('value="mage-hand"')
    expect(html).toContain('value="prestidigitation"')
    expect(html).toContain('value="ray-of-frost"')
    expect(html).not.toContain('value="magic-missile"')
    expect(html).not.toContain('value="fireball"')
  })
})
