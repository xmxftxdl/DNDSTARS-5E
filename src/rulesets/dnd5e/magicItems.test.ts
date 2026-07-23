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
import { DND5E_SRD_MAGIC_ITEM_RULES_ZH_REVIEWED } from './magicItemRulesZh.reviewed.generated'

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

  it('keeps every catalog item distributable with reviewed Chinese rules text', () => {
    expect(DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES).toHaveLength(240)
    for (const template of DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES) {
      expect(template.rulesText.length, template.id).toBeGreaterThan(10)
    }
    const completed = DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES.find(
      (item) => item.id === 'srd-5.1:magic-item:deck-of-many-things',
    )
    expect(completed?.rulesText).toContain('***虚空。***')
    expect(DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES.map((item) => item.rulesText).join('\n'))
      .not.toContain('中文规则正文尚未完成')
  })

  it('publishes a reviewed SRD translation for every catalog item', () => {
    expect(Object.keys(DND5E_SRD_MAGIC_ITEM_RULES_ZH_REVIEWED)).toHaveLength(240)
    expect(DND5E_SRD_MAGIC_ITEM_RULES_ZH_REVIEWED['boots-of-levitation']).toMatchObject({
      sourcePage: 212,
      rulesText: expect.stringContaining('浮空术'),
    })
    expect(DND5E_SRD_MAGIC_ITEM_RULES_ZH_REVIEWED['wand-of-magic-missiles']?.rulesText)
      .toContain('每天黎明时恢复 1d6 + 1 点')
  })

  it('uses established Chinese spell names in reviewed magic-item rules', () => {
    const boots = DND5E_SRD_MAGIC_ITEM_RULES_ZH_REVIEWED['boots-of-levitation']?.rulesText
    expect(boots).toContain('浮空术')
    expect(boots).not.toContain('悬浮法术')
    expect(Object.values(DND5E_SRD_MAGIC_ITEM_RULES_ZH_REVIEWED).flatMap((entry) => entry ? [entry.rulesText] : []).join('\n')).not.toMatch(/暗示咒语|悬浮法术/)
  })

  it('does not publish untranslated English prose in reviewed magic-item rules', () => {
    const allowed = new Set(['AC', 'DC', 'DM', 'NPC', 'XP', 'gp'])
    const residual = Object.entries(DND5E_SRD_MAGIC_ITEM_RULES_ZH_REVIEWED).flatMap(([id, entry]) =>
      [...(entry?.rulesText.matchAll(/[A-Za-z]{2,}/g) ?? [])]
        .map((match) => match[0])
        .filter((token) => !allowed.has(token) && !/^d\d+$/.test(token))
        .map((token) => `${id}:${token}`),
    )
    expect(residual).toEqual([])
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

  it('publishes the complete SRD adjudication rule for the Amulet of the Planes', () => {
    const amulet = DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES.find((item) => item.id === 'srd-5.1:magic-item:amulet-of-the-planes')
    expect(amulet).toMatchObject({
      name: '位面护符',
      use: {
        economy: 'action',
        consumeQuantity: 0,
        effect: { kind: 'dm-adjudication' },
      },
      magicItem: {
        kind: 'wondrous-item', rarity: 'very-rare', attunement: 'required', automation: 'dm-adjudication',
      },
    })
    expect(amulet?.description).toContain('跨位面旅行')
    expect(amulet?.rulesText).toContain('DC 15 智力检定')
    expect(amulet?.rulesText).toContain('异界传送')
    expect(amulet?.rulesText).not.toContain('异界传送术')
    expect(amulet?.rulesText).toContain('距你 15 尺内的每个生物和每件物件')
    expect(amulet?.rulesText).toContain('01–60')
    expect(amulet?.rulesText).toContain('61–100')
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
