import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { DND5E_QUARTERSTAFF } from '../../rulesets/dnd5e'
import PlayerQuickCharacterSheet from './PlayerQuickCharacterSheet'

function character(): Character {
  return {
    id: 'quick-hero', name: '伊芙琳', player: '玩家一', avatar: '🧙', accent: 'from-violet-600 to-indigo-700',
    race: '高等精灵', charClass: '法师', level: 5, background: '贤者', experience: 6500, reputation: 0,
    abilities: { str: 8, dex: 16, con: 14, int: 18, wis: 12, cha: 10 }, savingThrows: ['int', 'wis'], skills: ['arcana', 'history'],
    maxHp: 32, currentHp: 25, tempHp: 4, hitDice: '5d6', ac: 14, speed: 30, initiativeBonus: 0, saveDC: 15,
    passivePerception: 11, inspiration: 0, conditions: ['blinded'], notes: '', dmNotes: '', visibleToPlayers: true,
    classResources: {
      fighterSecondWind: { current: 1, max: 1 },
      'dnd5e-arcane-recovery': { current: 1, max: 1 },
      'dnd5e-spell-slot-2': { current: 2, max: 3 },
    },
    equipment: { mainWeapon: DND5E_QUARTERSTAFF },
    dnd5eInventory: {
      schemaVersion: 3,
      entries: [{
        instanceId: 'potion-1', templateId: 'healing-potion', quantity: 2, acquiredAt: 2,
        item: {
          id: 'healing-potion', name: '治疗药水', category: 'consumable', icon: 'healing-potion', description: '恢复生命值。', rulesText: '恢复 2d4+2 生命值。', stackable: true,
          source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
        },
      }],
      currency: { cp: 3, sp: 4, ep: 0, gp: 20, pp: 0 },
    },
  }
}

describe('PlayerQuickCharacterSheet', () => {
  it('在同一总览中显示属性、状态、资源与装备道具', () => {
    const html = renderToStaticMarkup(createElement(PlayerQuickCharacterSheet, { character: character(), onClose: () => undefined }))
    expect(html).toContain('data-testid="quick-character-sheet"')
    expect(html).toContain('data-testid="quick-character-overview"')
    expect(html).not.toContain('quick-character-tab-')
    expect(html).toContain('伊芙琳')
    expect(html).toContain('护甲等级')
    expect(html).toContain('属性与豁免')
    expect(html).toContain('奥秘')
    expect(html).toContain('奥术回想')
    expect(html).toContain('2环法术位')
    expect(html).not.toContain('回气')
    expect(html).not.toContain('fighterSecondWind')
  })

  it('将固定装备槽和背包物品放在同一面板的两个清晰区域', () => {
    const html = renderToStaticMarkup(createElement(PlayerQuickCharacterSheet, { character: character(), onClose: () => undefined }))
    const source = readFileSync(new URL('./PlayerQuickCharacterSheet.tsx', import.meta.url), 'utf8')
    expect(source).toContain("import Dnd5eInventoryTile from '../character/Dnd5eInventoryTile'")
    expect(html).toContain('data-testid="quick-character-equipment-grid"')
    expect(html).toContain('data-testid="quick-character-backpack-grid"')
    expect(html).toContain('主手／法器')
    expect(html).toContain('长棍')
    expect(html).toContain('治疗药水')
    expect(html).toContain('已装备 1/9 · 背包 1 类物品')
  })
})
