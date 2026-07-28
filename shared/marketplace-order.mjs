export const MARKETPLACE_ORDER_SCHEMA_VERSION = 1
export const MARKETPLACE_ORDER_TTL_MS = 30 * 60 * 1_000

export function marketplaceOrderAmounts(amountMinor, creatorShareBps, platformShareBps) {
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor < 0 ||
    !Number.isSafeInteger(creatorShareBps) ||
    !Number.isSafeInteger(platformShareBps) ||
    creatorShareBps < 0 ||
    platformShareBps < 0 ||
    creatorShareBps + platformShareBps !== 10_000
  ) return null
  const creatorAmountMinor = Math.floor(amountMinor * creatorShareBps / 10_000)
  return {
    amountMinor,
    creatorAmountMinor,
    platformAmountMinor: amountMinor - creatorAmountMinor,
  }
}

export function marketplaceOrderIsPayable(order, now = Date.now()) {
  return order?.schemaVersion === MARKETPLACE_ORDER_SCHEMA_VERSION &&
    order?.status === 'pending' &&
    Number.isFinite(order?.expiresAt) &&
    order.expiresAt > now
}

export function marketplaceOrderPublicRecord(order, now = Date.now()) {
  if (!order || typeof order !== 'object') return null
  const status = order.status === 'pending' && Number(order.expiresAt) <= now
    ? 'expired'
    : order.status
  return {
    schemaVersion: MARKETPLACE_ORDER_SCHEMA_VERSION,
    orderId: order.orderId,
    accountId: order.accountId,
    productId: order.productId,
    version: order.version,
    currency: order.currency,
    amountMinor: order.amountMinor,
    status,
    provider: order.provider,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    ...(Number.isFinite(order.paidAt) ? { paidAt: order.paidAt } : {}),
    ...(Number.isFinite(order.fulfilledAt) ? { fulfilledAt: order.fulfilledAt } : {}),
    ...(Number.isFinite(order.updatedAt) ? { updatedAt: order.updatedAt } : {}),
    ...(order.entitlementId ? { entitlementId: order.entitlementId } : {}),
  }
}
