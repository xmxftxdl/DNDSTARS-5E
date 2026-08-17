const SHOP_KINDS = new Set(['general-store', 'equipment', 'arcane', 'apothecary', 'magic-curios'])
const CATEGORIES = new Set(['equipment', 'magic-item', 'adventuring-gear', 'consumable', 'tool', 'container'])
const RARITIES = new Set(['common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact', 'varies'])

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function boundedText(value, maximum) {
  return typeof value === 'string' && !!value.trim() && value.length <= maximum
}

export function validateDnd5eShopState(value) {
  if (
    !plainObject(value) || value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.revision) || value.revision < 0 ||
    !Array.isArray(value.shops) || value.shops.length > 100 ||
    !Array.isArray(value.transactions) || value.transactions.length > 200 ||
    !Array.isArray(value.purchaseReceipts) || value.purchaseReceipts.length > 512 ||
    !Number.isFinite(value.updatedAt) || value.updatedAt < 0
  ) return 'invalid-dnd5e-shops-envelope'
  const shopIds = new Set()
  for (const shop of value.shops) {
    if (
      !plainObject(shop) || !boundedText(shop.id, 180) || shopIds.has(shop.id) ||
      !SHOP_KINDS.has(shop.kind) || !boundedText(shop.name, 120) ||
      typeof shop.description !== 'string' || shop.description.length > 500 ||
      typeof shop.open !== 'boolean' || !Number.isFinite(shop.priceMultiplier) ||
      (shop.visibleToPlayers != null && typeof shop.visibleToPlayers !== 'boolean') ||
      shop.priceMultiplier < 0.25 || shop.priceMultiplier > 5 ||
      !Number.isSafeInteger(shop.revision) || shop.revision < 0 ||
      !Number.isFinite(shop.createdAt) || shop.createdAt < 0 ||
      !Number.isFinite(shop.updatedAt) || shop.updatedAt < 0 ||
      !Array.isArray(shop.offers) || shop.offers.length > 500
    ) return 'invalid-dnd5e-shop'
    shopIds.add(shop.id)
    const offerIds = new Set()
    for (const offer of shop.offers) {
      if (
        !plainObject(offer) || !boundedText(offer.id, 300) || offerIds.has(offer.id) ||
        !boundedText(offer.templateId, 240) || !boundedText(offer.name, 160) ||
        (offer.englishName != null && !boundedText(offer.englishName, 160)) ||
        typeof offer.description !== 'string' || offer.description.length > 2_000 ||
        (offer.rulesText != null && !boundedText(offer.rulesText, 20_000)) ||
        !CATEGORIES.has(offer.category) || !boundedText(offer.icon, 80) ||
        (offer.rarity != null && !RARITIES.has(offer.rarity)) ||
        !boundedText(offer.sourceLabel, 160) ||
        !Number.isSafeInteger(offer.quantity) || offer.quantity < 0 || offer.quantity > 999 ||
        !Number.isSafeInteger(offer.basePriceCopper) || offer.basePriceCopper < 1 ||
        offer.basePriceCopper > 1_000_000_000 ||
        (offer.priceOverrideCopper != null && (
          !Number.isSafeInteger(offer.priceOverrideCopper) || offer.priceOverrideCopper < 1 ||
          offer.priceOverrideCopper > 1_000_000_000
        )) ||
        !Number.isFinite(offer.updatedAt) || offer.updatedAt < 0
      ) return 'invalid-dnd5e-shop-offer'
      offerIds.add(offer.id)
    }
  }
  const receipts = new Set()
  for (const receipt of value.purchaseReceipts) {
    if (!boundedText(receipt, 300) || receipts.has(receipt)) return 'invalid-dnd5e-shop-receipt'
    receipts.add(receipt)
  }
  const transactionIds = new Set()
  for (const transaction of value.transactions) {
    if (
      !plainObject(transaction) || !boundedText(transaction.id, 300) || transactionIds.has(transaction.id) ||
      !boundedText(transaction.shopId, 180) || !boundedText(transaction.offerId, 300) ||
      !boundedText(transaction.characterId, 180) || !boundedText(transaction.characterName, 160) ||
      !boundedText(transaction.templateId, 240) || !boundedText(transaction.itemName, 160) ||
      !Number.isSafeInteger(transaction.quantity) || transaction.quantity < 1 || transaction.quantity > 99 ||
      !Number.isSafeInteger(transaction.totalPriceCopper) || transaction.totalPriceCopper < 1 ||
      transaction.totalPriceCopper > 1_000_000_000 ||
      !Number.isFinite(transaction.createdAt) || transaction.createdAt < 0
    ) return 'invalid-dnd5e-shop-transaction'
    transactionIds.add(transaction.id)
  }
  return null
}

/** Players receive only the public storefront. Host receipts and the DM's audit log stay private. */
export function projectDnd5eShopsForPlayer(value) {
  return {
    ...value,
    shops: (Array.isArray(value?.shops) ? value.shops : []).filter((shop) =>
      shop?.open === true && shop?.visibleToPlayers === true),
    transactions: [],
    purchaseReceipts: [],
  }
}
