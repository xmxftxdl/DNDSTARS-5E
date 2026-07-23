import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import MapDiceRoller from './MapDiceRoller'

const character: Character = {
  id: 'hero', name: '冒险者', player: '玩家', avatar: '🧙', accent: 'from-violet-600 to-indigo-700',
  race: '人类', charClass: '战士', level: 1, background: '侍僧', experience: 0, reputation: 0,
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }, savingThrows: ['str', 'con'], skills: [],
  maxHp: 12, currentHp: 12, tempHp: 0, hitDice: '1d10', ac: 16, speed: 30, initiativeBonus: 1,
  saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
}

describe('MapDiceRoller', () => {
  it('在地图右侧提供统一的自由掷骰入口', () => {
    const html = renderToStaticMarkup(createElement(MapDiceRoller, {
      isDm: false,
      character,
      canCheck: true,
      pending: false,
      turnEconomy: {
        turnKey: 'combat:1:hero', attacksUsed: 0,
        action: { current: 1, max: 1 }, bonusAction: { current: 1, max: 1 }, reaction: { current: 1, max: 1 },
        movement: { current: 30, max: 30 },
      },
      onRoll: async () => undefined,
      onCheck: () => undefined,
    }))

    expect(html).toContain('data-testid="map-dice-roller-toggle"')
    expect(html).toContain('aria-label="自由掷骰"')
    expect(html).not.toContain('data-testid="map-dice-roller-panel"')
  })
})
