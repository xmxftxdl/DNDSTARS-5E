import { describe, expect, it } from 'vitest'
import { DND5E_SRD_ITEM_TEMPLATES } from './items'
import {
  DND5E_SRD_MAGIC_ARMOR_TEMPLATES,
  DND5E_SRD_MAGIC_CONSUMABLE_TEMPLATES,
  DND5E_SRD_MAGIC_ITEM_CATALOG,
  DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES,
  DND5E_SRD_MAGIC_SHIELD_TEMPLATES,
  DND5E_SRD_MAGIC_WEAPON_TEMPLATES,
} from './magicItems'

describe('SRD 5.1 magic items', () => {
  it('publishes the complete base catalog, including the shield family missing from common API mirrors', () => {
    expect(DND5E_SRD_MAGIC_ITEM_CATALOG).toHaveLength(240)
    expect(DND5E_SRD_MAGIC_ITEM_CATALOG).toContainEqual(expect.objectContaining({
      id: 'shield', englishName: 'Shield, +1, +2, or +3', kind: 'armor',
    }))
    expect(DND5E_SRD_MAGIC_ITEM_CATALOG).toContainEqual(expect.objectContaining({
      id: 'orb-of-dragonkind', rarity: 'artifact',
    }))
    expect(new Set(DND5E_SRD_MAGIC_ITEM_CATALOG.map((item) => item.id)).size).toBe(240)
  })

  it('keeps rarity, attunement and automation metadata on distributable templates', () => {
    const holyAvenger = DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES.find((item) => item.englishName === 'Holy Avenger')
    expect(holyAvenger).toMatchObject({
      name: '神圣复仇者',
      magicItem: {
        kind: 'weapon', rarity: 'legendary', attunement: 'required',
        attunementRequirement: '仅限圣武士', automation: 'dm-adjudication',
      },
      source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
    })
  })

  it('generates concrete +1 to +3 weapons with authoritative attack and damage bonuses', () => {
    const longsword = DND5E_SRD_MAGIC_WEAPON_TEMPLATES.find((item) => item.id === 'srd-5.1:magic-item:weapon-longsword-plus-3')
    expect(longsword).toMatchObject({
      name: '+3 长剑',
      category: 'equipment',
      equipment: { effects: { weaponAttackBonus: 3, weaponDamageBonus: 3 } },
      magicItem: { rarity: 'very-rare', attunement: 'none', automation: 'headless' },
    })
  })

  it('generates armor and shields with the correct distinct rarity progressions', () => {
    expect(DND5E_SRD_MAGIC_ARMOR_TEMPLATES.find((item) => item.id === 'srd-5.1:magic-item:armor-chain-mail-plus-1')).toMatchObject({
      equipment: { effects: { armorClassBonus: 1 } },
      magicItem: { rarity: 'rare', automation: 'headless' },
    })
    expect(DND5E_SRD_MAGIC_SHIELD_TEMPLATES.find((item) => item.id === 'srd-5.1:magic-item:shield-plus-1')).toMatchObject({
      equipment: { effects: { armorClassBonus: 1 } },
      magicItem: { rarity: 'uncommon', automation: 'headless' },
    })
  })

  it('uses the SRD healing dice for greater, superior and supreme potions', () => {
    expect(DND5E_SRD_MAGIC_CONSUMABLE_TEMPLATES.map((item) => item.use?.effect)).toEqual([
      { kind: 'healing', dice: { count: 4, sides: 4, bonus: 4 } },
      { kind: 'healing', dice: { count: 8, sides: 4, bonus: 8 } },
      { kind: 'healing', dice: { count: 10, sides: 4, bonus: 20 } },
    ])
  })

  it('does not publish duplicate template ids after merging the mundane and magic catalogs', () => {
    expect(new Set(DND5E_SRD_ITEM_TEMPLATES.map((item) => item.id)).size).toBe(DND5E_SRD_ITEM_TEMPLATES.length)
  })
})
