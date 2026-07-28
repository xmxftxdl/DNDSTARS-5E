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
        level: 0, castingTime: 'action', targeting: 'creature', castingClassId: 'wizard',
        defaultSlotLevel: 0,
        availableSlotLevels: [0], available: true,
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

  it('在法术栏位上方显示剩余法术位', () => {
    const wizard: Character = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '法师',
      level: 5,
      dnd5eClassLevels: { wizard: 5 },
      classResources: {
        'dnd5e-spell-slot-1': { current: 2, max: 4 },
        'dnd5e-spell-slot-2': { current: 0, max: 3 },
        'dnd5e-spell-slot-3': { current: 1, max: 2 },
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: wizard,
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))

    expect(html).toContain('data-testid="combat-hotbar-spell-slots"')
    expect(html.indexOf('combat-hotbar-spell-slots')).toBeLessThan(html.indexOf('>法术<'))
    expect(html).toContain('1环')
    expect(html).toContain('<strong class="text-[10px]">2</strong>/4')
    expect(html).toContain('<strong class="text-[10px]">0</strong>/3')
  })

  it('从角色实际选择生成可分页的通用施法修正图标', () => {
    const sorcerer: Character = {
      ...character(),
      charClass: '术士',
      level: 10,
      dnd5eClassLevels: { sorcerer: 10 },
      dnd5eClassChoices: {
        classes: {
          sorcerer: {
            subclass: 'draconic',
            selections: {
              metamagic: ['careful', 'quickened', 'empowered'],
              'dragon-ancestor': ['red-fire'],
            },
          },
        },
      },
      classResources: {
        'dnd5e-sorcery-points': { current: 10, max: 10 },
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: sorcerer,
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))
    expect(html).toContain('aria-label="谨慎法术"')
    expect(html).toContain('aria-label="强效法术"')
    expect(html).toContain('5 项 · 1/2')
  })
})
