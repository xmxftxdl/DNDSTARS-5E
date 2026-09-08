import { describe, expect, it } from 'vitest'
import { DND5E_SRD_ITEM_TEMPLATES } from './items'
import {
  DND5E_SRD_MAGIC_ARMOR_TEMPLATES,
  DND5E_SRD_MAGIC_CONSUMABLE_TEMPLATES,
  DND5E_SRD_DRAGON_SLAYER_TEMPLATES,
  DND5E_SRD_MAGIC_ITEM_CATALOG,
  DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES,
  DND5E_SRD_MAGIC_SHIELD_TEMPLATES,
  DND5E_SRD_SPELL_SCROLL_TEMPLATES,
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

  it('expands the abstract spell scroll into concrete, priced, usable spell scrolls', () => {
    expect(DND5E_SRD_SPELL_SCROLL_TEMPLATES.length).toBeGreaterThan(100)
    const fireball = DND5E_SRD_SPELL_SCROLL_TEMPLATES.find(
      (item) => item.id === 'srd-5.1:spell-scroll:fireball',
    )
    expect(fireball).toMatchObject({
      name: '火球术卷轴',
      category: 'consumable',
      icon: 'magic-scroll',
      cost: { amount: 200, currency: 'gp' },
      use: {
        economy: 'action',
        consumeQuantity: 1,
        effect: {
          kind: 'spell-cast', spellId: 'fireball', castAtLevel: 3,
          spellSaveDc: 15, spellAttackBonus: 7, requiresComponents: false,
          spellcastingClassIds: ['sorcerer', 'wizard'],
        },
      },
      magicItem: { kind: 'scroll', rarity: 'uncommon', automation: 'headless' },
    })
    expect(fireball?.rulesText).toContain('具体效果')
    expect(fireball?.rulesText).toContain('半径 20 尺球状区域')
    expect(DND5E_SRD_SPELL_SCROLL_TEMPLATES).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'srd-5.1:spell-scroll:shield', icon: 'magic-scroll',
        use: expect.objectContaining({ economy: 'none', effect: expect.objectContaining({ spellId: 'shield' }) }),
      }),
      expect.objectContaining({
        id: 'srd-5.1:spell-scroll:counterspell', icon: 'magic-scroll',
        use: expect.objectContaining({ economy: 'none', effect: expect.objectContaining({ spellId: 'counterspell' }) }),
      }),
      expect.objectContaining({
        id: 'srd-5.1:spell-scroll:hellish-rebuke', icon: 'magic-scroll',
        use: expect.objectContaining({ economy: 'none', effect: expect.objectContaining({ spellId: 'hellish-rebuke' }) }),
      }),
    ]))
    expect(DND5E_SRD_ITEM_TEMPLATES.some(
      (item) => item.id === 'srd-5.1:magic-item:spell-scroll',
    )).toBe(false)
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

  it('expands Dragon Slayer into concrete swords with Host-validated Dragon damage', () => {
    expect(DND5E_SRD_DRAGON_SLAYER_TEMPLATES).toHaveLength(5)
    const longsword = DND5E_SRD_DRAGON_SLAYER_TEMPLATES.find(
      (item) => item.id === 'srd-5.1:magic-item:dragon-slayer-longsword',
    )
    expect(longsword).toMatchObject({
      name: '屠龙长剑',
      equipment: {
        dnd5e: { kind: 'weapon', magical: true },
        effects: { weaponAttackBonus: 1, weaponDamageBonus: 1 },
      },
      headlessEffects: [{
        kind: 'on-hit-bonus-damage',
        damage: { count: 3, sides: 6, bonus: 0 },
        damageType: 'inherit',
        targetCreatureTypes: ['龙类', '龙', 'dragon'],
      }],
      magicItem: { kind: 'weapon', rarity: 'rare', automation: 'headless' },
    })
    expect(DND5E_SRD_ITEM_TEMPLATES.some(
      (item) => item.id === 'srd-5.1:magic-item:dragon-slayer',
    )).toBe(true)
  })

  it('publishes Pearl of Power as an attuned daily Headless spell-slot recovery item', () => {
    expect(DND5E_SRD_ITEM_TEMPLATES.find(
      (item) => item.id === 'srd-5.1:magic-item:pearl-of-power',
    )).toMatchObject({
      resources: [{ id: 'daily-use', maximum: 1, initial: 1, resetOn: 'dawn' }],
      use: {
        economy: 'action',
        consumeQuantity: 0,
        resourceCost: { resourceId: 'daily-use', amount: 1 },
        effect: { kind: 'spell-slot-recovery', maximumSlotLevel: 3, amount: 1 },
      },
      magicItem: { attunement: 'required', automation: 'headless' },
    })
  })

  it('publishes Host-validated spell transactions for Circlet of Blasting and Ring of Jumping', () => {
    expect(DND5E_SRD_ITEM_TEMPLATES.find(
      (item) => item.id === 'srd-5.1:magic-item:circlet-of-blasting',
    )).toMatchObject({
      equipment: { slot: 'helmet' },
      resources: [{ id: 'daily-use', maximum: 1, initial: 1, resetOn: 'dawn' }],
      use: {
        economy: 'action',
        consumeQuantity: 0,
        resourceCost: { resourceId: 'daily-use', amount: 1 },
        effect: {
          kind: 'spell-cast',
          schemaVersion: 1,
          spellId: 'scorching-ray',
          castAtLevel: 2,
          spellAttackBonus: 5,
        },
      },
      magicItem: { attunement: 'none', automation: 'headless' },
    })
    expect(DND5E_SRD_ITEM_TEMPLATES.find(
      (item) => item.id === 'srd-5.1:magic-item:ring-of-jumping',
    )).toMatchObject({
      use: {
        economy: 'bonusAction',
        consumeQuantity: 0,
        effect: {
          kind: 'spell-cast',
          schemaVersion: 1,
          spellId: 'jump',
          castAtLevel: 1,
          targeting: 'self-only',
        },
      },
      magicItem: { attunement: 'required', automation: 'headless' },
    })
  })

  it('publishes shared-charge spell menus for the SRD wands and Staff of Healing', () => {
    const missiles = DND5E_SRD_ITEM_TEMPLATES.find(
      (item) => item.id === 'srd-5.1:magic-item:wand-of-magic-missiles',
    )
    expect(missiles).toMatchObject({
      equipment: { slot: 'mainWeapon' },
      resources: [{
        id: 'charges', maximum: 7, initial: 7, resetOn: 'dawn',
        recovery: { kind: 'dice', dice: { count: 1, sides: 6, bonus: 1 } },
        lastChargeDestruction: { dieSides: 20, destroyOn: 1 },
      }],
      magicItem: { attunement: 'none', automation: 'headless' },
    })
    expect(missiles?.useActions).toHaveLength(7)
    expect(missiles?.useActions?.[6]).toMatchObject({
      id: 'magic-missile-level-7',
      resourceCost: { resourceId: 'charges', amount: 7 },
      effect: { kind: 'spell-cast', spellId: 'magic-missile', castAtLevel: 7 },
    })

    const web = DND5E_SRD_ITEM_TEMPLATES.find(
      (item) => item.id === 'srd-5.1:magic-item:wand-of-web',
    )
    expect(web?.useActions).toContainEqual(expect.objectContaining({
      id: 'cast-web',
      resourceCost: { resourceId: 'charges', amount: 1 },
      effect: expect.objectContaining({ kind: 'spell-cast', spellId: 'web', castAtLevel: 2, spellSaveDc: 15 }),
    }))

    const healing = DND5E_SRD_ITEM_TEMPLATES.find(
      (item) => item.id === 'srd-5.1:magic-item:staff-of-healing',
    )
    expect(healing).toMatchObject({
      equipment: { slot: 'mainWeapon', baseEquipmentId: 'dnd5e-quarterstaff' },
      resources: [{ maximum: 10, recovery: { dice: { bonus: 4 } } }],
      magicItem: { attunement: 'required', automation: 'headless' },
    })
    expect(healing?.useActions?.map((action) => action.effect.kind === 'spell-cast'
      ? [action.effect.spellId, action.effect.castAtLevel, action.resourceCost?.amount]
      : [])).toEqual([
      ['cure-wounds', 1, 1],
      ['cure-wounds', 2, 2],
      ['cure-wounds', 3, 3],
      ['cure-wounds', 4, 4],
      ['lesser-restoration', 2, 2],
      ['mass-cure-wounds', 5, 5],
    ])
  })

  it('publishes Ring of Protection as an attuned authoritative AC and save modifier', () => {
    expect(DND5E_SRD_ITEM_TEMPLATES.find(
      (item) => item.id === 'srd-5.1:magic-item:ring-of-protection',
    )).toMatchObject({
      equipment: {
        slot: 'ring',
        effects: { armorClassBonus: 1, savingThrowBonus: 1 },
      },
      magicItem: { attunement: 'required', automation: 'headless' },
    })
  })

  it('marks rings and belts as wearable inventory equipment', () => {
    expect(DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES.find((item) => item.id === 'srd-5.1:magic-item:ring-of-warmth')).toMatchObject({
      equipment: { slot: 'ring' },
    })
    expect(DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES.find((item) => item.id === 'srd-5.1:magic-item:belt-of-dwarvenkind')).toMatchObject({
      equipment: { slot: 'belt' },
    })
  })

  it('projects every magic staff as a magical quarterstaff that can be held in either hand', () => {
    const staffs = DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES.filter((item) => item.magicItem?.kind === 'staff')
    expect(staffs.length).toBeGreaterThan(0)
    for (const staff of staffs) {
      expect(staff.equipment, staff.id).toMatchObject({
        slot: 'mainWeapon',
        allowedSlots: ['mainWeapon', 'offHand'],
        baseEquipmentId: 'dnd5e-quarterstaff',
        dnd5e: { kind: 'weapon', magical: true },
      })
    }
    expect(staffs.find((item) => item.id === 'srd-5.1:magic-item:staff-of-striking')).toMatchObject({
      name: '打击法杖',
      equipment: { name: '打击法杖' },
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

  it('keeps abstract equipment families out of the distributable item list', () => {
    const ids = new Set(DND5E_SRD_ITEM_TEMPLATES.map((item) => item.id))
    expect(ids.has('srd-5.1:magic-item:armor')).toBe(false)
    expect(ids.has('srd-5.1:magic-item:shield')).toBe(false)
    expect(ids.has('srd-5.1:magic-item:weapon')).toBe(false)
    expect(ids.has('srd-5.1:magic-item:potion-of-healing')).toBe(false)
    expect(ids.has('srd-5.1:magic-item:armor-chain-mail-plus-1')).toBe(true)
    expect(ids.has('srd-5.1:magic-item:armor-chain-mail-plus-2')).toBe(true)
    expect(ids.has('srd-5.1:magic-item:armor-chain-mail-plus-3')).toBe(true)
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
