import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Dnd5eActionIcon from '../components/map/Dnd5eActionIcon'
import { dnd5eShopOfferIconSpec } from '../lib/dnd5eShopOfferIcon'
import { DND5E_SRD_ITEM_TEMPLATES } from '../rulesets/dnd5e/items'
import type { Dnd5eShopOffer } from '../rulesets/dnd5e/shops'

describe('ShopsPage', () => {
  it('uses the semantic item icon as the product visual and shows expanded rules', () => {
    const longsword = DND5E_SRD_ITEM_TEMPLATES.find((item) =>
      item.id === 'srd-5.1:equipment:dnd5e-longsword',
    )!
    const offer: Dnd5eShopOffer = {
      id: 'offer:longsword', templateId: longsword.id, name: longsword.name,
      englishName: longsword.englishName, description: longsword.description,
      rulesText: longsword.rulesText, category: longsword.category, icon: longsword.icon,
      sourceLabel: 'SRD 5.1', quantity: 1, basePriceCopper: 1_500, updatedAt: 101,
    }
    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eShopOfferIconSpec(offer, longsword),
    }))

    expect(html).toContain('data-icon-detail="colored-sword"')
    expect(html).toContain('data-inventory-glyph="sword"')
    expect(longsword.rulesText).toContain('多才多艺：单手攻击使用 1d8 伤害骰；双手攻击改用 1d10')
    expect(longsword.description).toBe(longsword.rulesText)
  })

  it('keeps rarity styling when a removed plugin item only survives as a shop snapshot', () => {
    const offer: Dnd5eShopOffer = {
      id: 'offer:starlight', templateId: 'removed.plugin:starlight', name: '星辉药剂',
      description: '饮用后获得飞行速度。', rulesText: '饮用需要一个动作；持续 1 小时获得 60 尺飞行速度。',
      category: 'consumable', icon: 'magic-potion', rarity: 'very-rare', sourceLabel: '旧工坊',
      quantity: 1, basePriceCopper: 50_000, updatedAt: 101,
    }

    expect(dnd5eShopOfferIconSpec(offer, undefined)).toMatchObject({
      inventoryIconId: 'magic-potion',
      rarityBackdropId: 'very-rare',
      preferSemanticGlyph: true,
    })
  })

  it('renders concrete spell scroll offers with the colored scroll glyph and rarity frame', () => {
    const scroll = DND5E_SRD_ITEM_TEMPLATES.find((item) =>
      item.id === 'srd-5.1:spell-scroll:fireball',
    )!
    const offer: Dnd5eShopOffer = {
      id: 'offer:fireball-scroll', templateId: scroll.id, name: scroll.name,
      englishName: scroll.englishName, description: scroll.description,
      rulesText: scroll.rulesText, category: scroll.category, icon: scroll.icon,
      rarity: scroll.magicItem?.rarity, sourceLabel: 'SRD 5.1', quantity: 1,
      basePriceCopper: 20_000, updatedAt: 101,
    }
    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eShopOfferIconSpec(offer, scroll),
    }))

    expect(html).toContain('data-inventory-glyph="magic-scroll"')
    expect(dnd5eShopOfferIconSpec(offer, scroll)).toMatchObject({
      inventoryIconId: 'magic-scroll', rarityBackdropId: 'uncommon', preferSemanticGlyph: true,
    })
  })
})
