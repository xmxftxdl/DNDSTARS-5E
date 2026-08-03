import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import InitiativeTracker, { type InitiativeEntry } from './InitiativeTracker'

const entry: InitiativeEntry = {
  tokenId: 'hero-token',
  label: '影心',
  emoji: '👤',
  portrait: 'data:image/png;base64,cG9ydHJhaXQ=',
  color: '#22d3ee',
  turnGlowColor: '#60a5fa',
  roll: 18,
}

function renderTracker(monsterThinkingTokenId?: string) {
  return renderToStaticMarkup(createElement(InitiativeTracker, {
    entries: [entry],
    activeIndex: 0,
    scrollOffset: 0,
    round: 2,
    hpByToken: { 'hero-token': { hp: 6, max: 12 } },
    monsterThinkingTokenId,
    onScroll: vi.fn(),
    onSelect: vi.fn(),
  }))
}

describe('先攻头像队列', () => {
  it('把先攻放在头像右上角，并在头像下方显示生命条', () => {
    const html = renderTracker()

    expect(html).toContain('data-testid="initiative-roll-hero-token"')
    expect(html).toMatch(/data-testid="initiative-roll-hero-token"[^>]*>18<\/span>/)
    expect(html).toContain('data-testid="initiative-health-hero-token"')
    expect(html).toContain('width:50%')
    expect(html).toContain('data-active-turn="true"')
    expect(html).toContain('width:97px;height:125px')
    expect(html).toContain('h-2')
    expect(html).toContain('style="width:97px"')
    expect(html).toContain('--initiative-turn-color:#60a5fa')
  })

  it('不再把角色名称渲染为可见文本', () => {
    const html = renderTracker()

    expect(html).not.toContain('>影心<')
    expect(html).toContain('aria-label="影心，先攻 18，生命值 6/12，当前回合"')
  })

  it('shows an accessible pending-plan badge only for the active authority token', () => {
    const html = renderTracker('hero-token')

    expect(html).toContain('data-testid="initiative-thinking-hero-token"')
    expect(html).toContain('role="status"')
    expect(html).toContain('AI 思考中…')
    expect(renderTracker('another-token')).not.toContain('initiative-thinking-hero-token')
  })

  it('lets pointer input pass through transparent tracker space while keeping controls interactive', () => {
    const html = renderTracker()

    expect(html).toContain('pointer-events-none relative flex items-center')
    expect(html).toContain('pointer-events-auto group flex')
    expect(html.match(/pointer-events-auto flex h-11 w-11/g)).toHaveLength(2)
  })
})
