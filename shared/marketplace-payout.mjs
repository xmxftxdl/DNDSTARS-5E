export const MARKETPLACE_PAYOUT_SCHEMA_VERSION = 1
export const MARKETPLACE_PAYOUT_MINIMUMS = Object.freeze({
  CNY: 10_000,
  USD: 2_000,
})

export function marketplacePayoutMinimum(currency) {
  return MARKETPLACE_PAYOUT_MINIMUMS[currency] ?? null
}

export function marketplacePayoutTransitionAllowed(status, action) {
  if (status === 'pending') return ['approve', 'reject'].includes(action)
  if (status === 'approved') return ['mark-paid', 'reject'].includes(action)
  return false
}

export function marketplacePayoutRecordValid(payout) {
  if (!payout || typeof payout !== 'object') return false
  if (
    payout.schemaVersion !== MARKETPLACE_PAYOUT_SCHEMA_VERSION ||
    typeof payout.payoutId !== 'string' ||
    !payout.payoutId ||
    typeof payout.creatorAccountId !== 'string' ||
    !payout.creatorAccountId ||
    !Object.hasOwn(MARKETPLACE_PAYOUT_MINIMUMS, payout.currency) ||
    !Number.isSafeInteger(payout.amountMinor) ||
    payout.amountMinor <= 0 ||
    !['pending', 'approved', 'paid', 'rejected'].includes(payout.status) ||
    !Number.isFinite(payout.createdAt)
  ) return false
  if (
    payout.status === 'paid' &&
    (!Number.isFinite(payout.paidAt) || typeof payout.externalTransferReference !== 'string')
  ) return false
  return true
}

export function marketplacePayoutPublicRecord(payout) {
  if (!marketplacePayoutRecordValid(payout)) return null
  return {
    schemaVersion: MARKETPLACE_PAYOUT_SCHEMA_VERSION,
    payoutId: payout.payoutId,
    creatorAccountId: payout.creatorAccountId,
    currency: payout.currency,
    amountMinor: payout.amountMinor,
    status: payout.status,
    createdAt: payout.createdAt,
    ...(Number.isFinite(payout.updatedAt) ? { updatedAt: payout.updatedAt } : {}),
    ...(Number.isFinite(payout.paidAt) ? { paidAt: payout.paidAt } : {}),
    ...(payout.moderationNote ? { moderationNote: payout.moderationNote } : {}),
    ...(payout.externalTransferReference
      ? { externalTransferReference: payout.externalTransferReference }
      : {}),
  }
}
