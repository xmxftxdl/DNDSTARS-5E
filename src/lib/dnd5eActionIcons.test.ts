import { describe, expect, it } from 'vitest'
import { DND5E_SRD_ITEM_TEMPLATES } from '../rulesets/dnd5e/items'
import { DND5E_SRD_SPELL_CATALOG } from '../rulesets/dnd5e/spellCatalog'
import { dnd5eItemActionIcon, dnd5eSpellActionIcon } from './dnd5eActionIcons'

describe('D&D 5e combat action icon registry', () => {
  it('为全部 SRD 5.1 法术生成稳定图标', () => {
    expect(DND5E_SRD_SPELL_CATALOG).toHaveLength(319)
    const specs = DND5E_SRD_SPELL_CATALOG.map((spell) => dnd5eSpellActionIcon(spell))
    expect(specs.every((spec) => spec.key.startsWith('spell:') && spec.runeIndex >= 0 && spec.runeIndex < 8)).toBe(true)
    expect(new Set(specs.map((spec) => spec.key)).size).toBe(319)
    expect(dnd5eSpellActionIcon(DND5E_SRD_SPELL_CATALOG[0])).toEqual(specs[0])
  })

  it('为全部核心物品模板生成稳定图标', () => {
    const specs = DND5E_SRD_ITEM_TEMPLATES.map((item) => dnd5eItemActionIcon(item))
    expect(specs).toHaveLength(DND5E_SRD_ITEM_TEMPLATES.length)
    expect(specs.every((spec) => spec.key.startsWith('item:') && spec.accent.startsWith('#'))).toBe(true)
    expect(new Set(specs.map((spec) => spec.key)).size).toBe(DND5E_SRD_ITEM_TEMPLATES.length)
  })

  it('优先按伤害与用途选择视觉母题', () => {
    expect(dnd5eSpellActionIcon({ id: 'fireball', name: '火球术', damageType: 'fire' }).motif).toBe('fire')
    expect(dnd5eSpellActionIcon({ id: 'cure-wounds', name: '疗伤术' }).motif).toBe('healing')
    expect(dnd5eItemActionIcon({
      id: 'test-healing-potion', name: '测试治疗药水', category: 'consumable', icon: 'healing-potion',
      use: { economy: 'action', consumeQuantity: 1, effect: { kind: 'healing', dice: { count: 2, sides: 4, bonus: 2 } } },
    }).motif).toBe('healing')
  })
})
