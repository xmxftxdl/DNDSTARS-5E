import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { dnd5eSpellActionIcon } from '../../lib/dnd5eActionIcons'
import { buildDnd5eCombatActionDescriptors, groupDnd5eCombatHotbarDescriptors } from '../../lib/dnd5eCombatActionDescriptors'
import PlayerCombatHotbar from './PlayerCombatHotbar'

function character(): Character {
  return {
    id: 'hero', name: '冒险者', player: '玩家', avatar: '🧙', accent: 'from-violet-600 to-indigo-700',
    race: '人类', charClass: '战士', level: 1, background: '侍僧', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    savingThrows: ['str', 'con'], skills: [], maxHp: 12, currentHp: 8, tempHp: 0,
    hitDice: '1d10', ac: 16, speed: 30, initiativeBonus: 1, saveDC: 10,
    passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

describe('PlayerCombatHotbar', () => {
  it('groups spells, items and basic actions into stable independent sections', () => {
    const icon = dnd5eSpellActionIcon({ id: 'fire-bolt', name: '火焰箭' })
    const descriptors = buildDnd5eCombatActionDescriptors({
      canAct: true,
      pending: false,
      actionRemaining: 1,
      bonusActionRemaining: 1,
      movementRemaining: 30,
      spells: [{
        id: 'fire-bolt', label: '火焰箭', description: '远程法术攻击。', icon,
        level: 0, castingTime: 'action', targeting: 'creature', castingClassId: 'wizard', available: true,
      }],
      items: [{
        instanceId: 'potion', label: '治疗药水', description: '恢复生命值。', icon,
        economy: 'action', targeting: 'self', quantity: 2, usable: true,
      }],
    })
    const grouped = groupDnd5eCombatHotbarDescriptors(descriptors)
    expect(grouped.spells.map((entry) => entry.id)).toEqual(['spell:wizard:fire-bolt'])
    expect(grouped.items.map((entry) => entry.id)).toEqual(['item:potion'])
    expect(grouped.features.map((entry) => entry.id)).toEqual(['feature:class-actions'])
    expect(grouped.basics).toHaveLength(8)
    expect(grouped.basics.every((entry) => !['spell', 'item', 'feature'].includes(entry.sourceKind))).toBe(true)
  })

  it('renders character status and all three action regions even when spell and item lists are empty', () => {
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: character(),
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))
    expect(html).toContain('data-testid="combat-hotbar-spells"')
    expect(html).toContain('data-testid="combat-hotbar-features"')
    expect(html).toContain('data-testid="combat-hotbar-items"')
    expect(html).toContain('data-testid="combat-hotbar-basics"')
    expect(html).toContain('8/12')
    expect(html).toContain('基础动作')
    expect(html).toContain('职业特性')
  })
})
