import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { Dnd5eInventoryItemTemplate } from '../../types/inventory'
import {
  addDnd5eShopOffer,
  createDnd5eShop,
  dnd5eShopRandomStockWeight,
  dnd5eShopBasePriceCopper,
  dnd5eShopEligibleTemplates,
  dnd5eShopOfferDisplayRarity,
  dnd5eRestockedSpellScrollNames,
  dnd5eShopSpellScrollNames,
  dnd5eShopUnitPriceCopper,
  dnd5eWalletCopper,
  dnd5eWalletFromCopper,
  emptySharedDnd5eShops,
  formatDnd5eCopper,
  normalizeSharedDnd5eShops,
  restockDnd5eShop,
  setDnd5eShopOfferPrice,
  settleDnd5eShopPurchase,
  validateSharedDnd5eShops,
} from './shops'
import { dnd5eInventoryItemTemplate } from './items'

function hero(gp: number) {
  return normalizeCharacter({
    id: 'hero',
    name: '阿莱娅',
    player: '玩家1',
    charClass: '战士',
    maxHp: 20,
    currentHp: 20,
    equipment: {},
    dnd5eInventory: {
      schemaVersion: 3,
      revision: 4,
      entries: [],
      currency: { cp: 0, sp: 0, ep: 0, gp, pp: 0 },
    },
  })
}

function template(input: Partial<Dnd5eInventoryItemTemplate> & Pick<Dnd5eInventoryItemTemplate, 'id' | 'name'>): Dnd5eInventoryItemTemplate {
  return {
    category: 'adventuring-gear',
    icon: 'generic',
    description: '测试物品',
    rulesText: '测试规则',
    stackable: false,
    source: { book: '测试工坊', license: 'CC BY 4.0' },
    ...input,
  }
}

describe('D&D 5e shop domain', () => {
  it('shows every shop offer with a rarity, including mundane goods', () => {
    expect(dnd5eShopOfferDisplayRarity({})).toBe('common')
    expect(dnd5eShopOfferDisplayRarity({ rarity: 'very-rare' })).toBe('very-rare')
  })

  it('formats and returns shop money using only gold, silver, and copper', () => {
    expect(dnd5eWalletFromCopper(123_456)).toEqual({
      gp: 1_234,
      sp: 5,
      cp: 6,
      ep: 0,
      pp: 0,
    })
    expect(formatDnd5eCopper(123_456)).toBe('1234 金币 5 银币 6 铜币')
    expect(formatDnd5eCopper(0)).toBe('0 铜币')
  })

  it('classifies core and workshop-compatible templates by shop type', () => {
    const catalog = [
      template({ id: 'custom:sword', name: '自定义长剑', category: 'equipment', icon: 'weapon' }),
      template({
        id: 'custom:wand', name: '自定义魔杖', category: 'magic-item', icon: 'magic-wand',
        magicItem: { kind: 'wand', rarity: 'uncommon', attunement: 'none', automation: 'headless' },
      }),
      template({ id: 'custom:acid', name: '自定义强酸', category: 'consumable', icon: 'acid', stackable: true }),
      template({ id: 'custom:rope', name: '自定义绳索', icon: 'rope' }),
    ]

    expect(dnd5eShopEligibleTemplates('equipment', catalog).map((item) => item.id))
      .toEqual(['custom:sword'])
    expect(dnd5eShopEligibleTemplates('arcane', catalog).map((item) => item.id))
      .toEqual(['custom:wand'])
    expect(dnd5eShopEligibleTemplates('apothecary', catalog).map((item) => item.id))
      .toEqual(['custom:acid'])
    expect(dnd5eShopEligibleTemplates('general-store', catalog).map((item) => item.id).sort())
      .toEqual(['custom:acid', 'custom:rope'])
  })

  it('applies the same rarity decay to every random storefront', () => {
    const common = template({
      id: 'custom:common', name: 'A 普通奇物', category: 'magic-item',
      magicItem: { kind: 'wondrous-item', rarity: 'common', attunement: 'none', automation: 'headless' },
    })
    const legendary = template({
      id: 'custom:legendary', name: 'Z 传奇奇物', category: 'magic-item',
      magicItem: { kind: 'wondrous-item', rarity: 'legendary', attunement: 'none', automation: 'headless' },
    })

    expect(dnd5eShopRandomStockWeight(common)).toBe(18)
    expect(dnd5eShopRandomStockWeight(legendary)).toBe(0.15)
    const legendaryCatalog = Array.from({ length: 100 }, (_, index) => ({
      ...legendary,
      id: `${legendary.id}-${index}`,
      name: `${legendary.name}-${index}`,
    }))
    expect(restockDnd5eShop(createDnd5eShop('magic-curios', 100), 1, {
      catalog: [common, ...legendaryCatalog],
      random: () => 0.99,
      now: 101,
    }).offers[0].templateId).toBe(common.id)
  })

  it('lets the DM manually add any canonical item and merges its stock snapshot', () => {
    const artifact = template({
      id: 'custom:artifact', name: 'DM 神器', category: 'magic-item',
      magicItem: { kind: 'wondrous-item', rarity: 'artifact', attunement: 'required', automation: 'headless' },
    })
    const initial = addDnd5eShopOffer(createDnd5eShop('general-store', 100), artifact, 2, 101)
    const priced = setDnd5eShopOfferPrice(initial, initial.offers[0].id, 123_400, 102)!
    const restocked = addDnd5eShopOffer(priced, artifact, 3, 103)

    expect(restocked.offers).toHaveLength(1)
    expect(restocked.offers[0]).toMatchObject({
      templateId: artifact.id,
      rarity: 'artifact',
      quantity: 5,
      priceOverrideCopper: 123_400,
    })
  })

  it('randomly restocks from the selected catalog and merges repeated stock', () => {
    const catalog = [template({
      id: 'custom:rations', name: '工坊口粮', category: 'consumable', icon: 'rations',
      stackable: true, cost: { amount: 5, currency: 'sp' },
    })]
    const initial = createDnd5eShop('general-store', 100)
    const first = restockDnd5eShop(initial, 1, { catalog, random: () => 0, now: 101 })
    const second = restockDnd5eShop(first, 1, { catalog, random: () => 0, now: 102 })

    expect(first.offers).toHaveLength(1)
    expect(first.offers[0]).toMatchObject({
      templateId: 'custom:rations',
      quantity: 3,
      basePriceCopper: 50,
      rulesText: '测试规则',
    })
    expect(second.offers[0].quantity).toBe(6)
    expect(second.revision).toBe(2)
  })

  it('reserves mage-shop stock for random concrete scrolls without letting them dominate', () => {
    const scrolls = Array.from({ length: 8 }, (_, index) => template({
      id: `srd-5.1:spell-scroll:test-${index}`,
      name: `测试卷轴${index}`,
      category: 'consumable',
      icon: 'magic-scroll',
      stackable: true,
      magicItem: {
        kind: 'scroll', rarity: index < 4 ? 'common' : 'rare',
        attunement: 'none', automation: 'headless',
      },
    }))
    const otherGoods = Array.from({ length: 12 }, (_, index) => template({
      id: `custom:wand-${index}`,
      name: `测试魔杖${index}`,
      category: 'magic-item',
      icon: 'magic-wand',
      magicItem: { kind: 'wand', rarity: 'uncommon', attunement: 'none', automation: 'headless' },
    }))
    const stocked = restockDnd5eShop(createDnd5eShop('arcane', 100), 10, {
      catalog: [...scrolls, ...otherGoods], random: () => 0, now: 101,
    })

    expect(stocked.offers).toHaveLength(10)
    expect(stocked.offers.filter((offer) => offer.icon === 'magic-scroll')).toHaveLength(3)
    expect(stocked.offers.filter((offer) => offer.icon === 'magic-wand')).toHaveLength(7)
    expect(dnd5eShopSpellScrollNames(stocked)).toEqual(['测试卷轴0', '测试卷轴1', '测试卷轴2'])
    expect(dnd5eRestockedSpellScrollNames(createDnd5eShop('arcane', 100), stocked))
      .toEqual(['测试卷轴0', '测试卷轴1', '测试卷轴2'])
  })

  it('drops the legacy abstract scroll placeholder instead of showing an unspecified scroll', () => {
    const shop = createDnd5eShop('arcane', 100)
    const shared = normalizeSharedDnd5eShops({
      ...emptySharedDnd5eShops(),
      shops: [{
        ...shop,
        offers: [{
          id: 'offer:legacy-scroll',
          templateId: 'srd-5.1:magic-item:spell-scroll',
          name: '法术卷轴',
          description: '没有写明法术的旧占位卷轴。',
          category: 'consumable',
          icon: 'magic-scroll',
          sourceLabel: 'SRD 5.1',
          quantity: 1,
          basePriceCopper: 100,
          updatedAt: 100,
        }],
      }],
    })

    expect(shared.shops[0].offers).toEqual([])
  })

  it('preserves the shared semantic icon registry through shop validation and normalization', () => {
    const catalog = [template({
      id: 'custom:flying-potion', name: '飞行药水', category: 'consumable',
      icon: 'magic-potion', stackable: true, cost: { amount: 500, currency: 'gp' },
    })]
    const shop = restockDnd5eShop(createDnd5eShop('apothecary', 100), 1, {
      catalog, random: () => 0, now: 101,
    })
    const shared = { ...emptySharedDnd5eShops(), shops: [shop], updatedAt: 101 }

    expect(validateSharedDnd5eShops(shared)).toBe(true)
    expect(normalizeSharedDnd5eShops(shared).shops[0].offers[0].icon).toBe('magic-potion')
  })

  it('creates shops as DM-only drafts and rejects purchases until explicitly published', () => {
    const shop = createDnd5eShop('apothecary', 100)
    expect(shop.open).toBe(false)
    expect(shop.visibleToPlayers).toBe(false)

    const result = settleDnd5eShopPurchase(
      { ...emptySharedDnd5eShops(), shops: [shop], updatedAt: 100 },
      [hero(100)],
      {
        id: 'purchase-hidden-shop',
        shopId: shop.id,
        offerId: 'offer:any',
        characterId: 'hero',
        quantity: 1,
      },
      101,
    )
    expect(result).toMatchObject({ ok: false, reason: 'shop-closed' })
  })

  it('lets the DM override one offer price without applying the shop multiplier twice', () => {
    const catalog = [template({
      id: 'custom:priced', name: '议价物品', cost: { amount: 10, currency: 'gp' },
    })]
    const stocked = restockDnd5eShop(
      { ...createDnd5eShop('general-store', 100), priceMultiplier: 2 },
      1,
      { catalog, random: () => 0, now: 101 },
    )
    const priced = setDnd5eShopOfferPrice(stocked, stocked.offers[0].id, 1_250, 102)!

    expect(priced.offers[0].priceOverrideCopper).toBe(1_250)
    expect(dnd5eShopUnitPriceCopper(priced.offers[0], priced)).toBe(1_250)

    const restocked = restockDnd5eShop(priced, 1, { catalog, random: () => 0, now: 103 })
    expect(restocked.offers[0].priceOverrideCopper).toBe(1_250)

    const reset = setDnd5eShopOfferPrice(restocked, restocked.offers[0].id, undefined, 104)!
    expect(reset.offers[0].priceOverrideCopper).toBeUndefined()
    expect(dnd5eShopUnitPriceCopper(reset.offers[0], reset)).toBe(2_000)
  })

  it('settles a purchase against the authoritative per-offer price', () => {
    const potion = dnd5eInventoryItemTemplate('srd-5.1:item:potion-of-healing')!
    const stocked = restockDnd5eShop(createDnd5eShop('apothecary', 100), 1, {
      catalog: [potion], random: () => 0, now: 101,
    })
    const shop = {
      ...setDnd5eShopOfferPrice(stocked, stocked.offers[0].id, 1_200, 102)!,
      open: true,
      visibleToPlayers: true,
    }
    const shared = { ...emptySharedDnd5eShops(), shops: [shop], updatedAt: 102 }
    const result = settleDnd5eShopPurchase(shared, [hero(100)], {
      id: 'purchase-custom-price',
      shopId: shop.id,
      offerId: shop.offers[0].id,
      characterId: 'hero',
      quantity: 1,
      expectedShopRevision: shop.revision,
      expectedInventoryRevision: 4,
      expectedUnitPriceCopper: 1_200,
    }, 200)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.totalPriceCopper).toBe(1_200)
    expect(dnd5eWalletCopper(result.characters[0].dnd5eInventory?.currency)).toBe(8_800)
  })

  it('atomically debits money, grants the item, decrements stock, and records a durable receipt', () => {
    const potion = dnd5eInventoryItemTemplate('srd-5.1:item:potion-of-healing')!
    const shop = restockDnd5eShop({
      ...createDnd5eShop('apothecary', 100), open: true, visibleToPlayers: true,
    }, 1, {
      catalog: [potion], random: () => 0, now: 101,
    })
    const shared = { ...emptySharedDnd5eShops(), shops: [shop], updatedAt: 101 }
    const character = hero(100)
    const request = {
      id: 'purchase-1',
      shopId: shop.id,
      offerId: shop.offers[0].id,
      characterId: character.id,
      quantity: 1,
      expectedShopRevision: shop.revision,
      expectedInventoryRevision: 4,
    }
    const result = settleDnd5eShopPurchase(shared, [character], request, 200)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.totalPriceCopper).toBe(dnd5eShopBasePriceCopper(potion))
    expect(dnd5eWalletCopper(result.characters[0].dnd5eInventory?.currency)).toBe(5_000)
    expect(result.characters[0].dnd5eInventory?.entries).toEqual([
      expect.objectContaining({ templateId: potion.id, quantity: 1 }),
    ])
    expect(result.state.shops[0].offers[0].quantity).toBe(shop.offers[0].quantity - 1)
    expect(result.state.purchaseReceipts).toContain(request.id)
    expect(result.state.transactions).toEqual([
      expect.objectContaining({ id: request.id, totalPriceCopper: 5_000 }),
    ])

    const replay = settleDnd5eShopPurchase(result.state, result.characters, request, 300)
    expect(replay.ok).toBe(true)
    if (!replay.ok) return
    expect(replay.deduplicated).toBe(true)
    expect(replay.totalPriceCopper).toBe(0)
    expect(replay.state).toEqual(result.state)
    expect(replay.characters).toEqual(result.characters)
  })

  it('leaves both resources untouched when the buyer cannot afford the item', () => {
    const potion = dnd5eInventoryItemTemplate('srd-5.1:item:potion-of-healing')!
    const shop = restockDnd5eShop({
      ...createDnd5eShop('apothecary', 100), open: true, visibleToPlayers: true,
    }, 1, {
      catalog: [potion], random: () => 0, now: 101,
    })
    const shared = { ...emptySharedDnd5eShops(), shops: [shop], updatedAt: 101 }
    const character = hero(0)
    const result = settleDnd5eShopPurchase(shared, [character], {
      id: 'purchase-poor',
      shopId: shop.id,
      offerId: shop.offers[0].id,
      characterId: character.id,
      quantity: 1,
      expectedShopRevision: shop.revision,
      expectedInventoryRevision: 4,
    }, 200)

    expect(result).toMatchObject({ ok: false, reason: 'insufficient-funds' })
    expect(result.state).toEqual(shared)
    expect(result.characters).toEqual([character])
  })
})
