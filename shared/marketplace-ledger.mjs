export const MARKETPLACE_LEDGER_SCHEMA_VERSION = 1
export const MARKETPLACE_SETTLEMENT_HOLD_MS = 14 * 24 * 60 * 60 * 1_000

export function marketplaceRevenueSplit(netReceiptsMinor, creatorShareBps, platformShareBps) {
  if (
    !Number.isSafeInteger(netReceiptsMinor) ||
    netReceiptsMinor < 0 ||
    !Number.isSafeInteger(creatorShareBps) ||
    !Number.isSafeInteger(platformShareBps) ||
    creatorShareBps < 0 ||
    platformShareBps < 0 ||
    creatorShareBps + platformShareBps !== 10_000
  ) return null
  const creatorAmountMinor = Math.floor(netReceiptsMinor * creatorShareBps / 10_000)
  return {
    netReceiptsMinor,
    creatorAmountMinor,
    platformAmountMinor: netReceiptsMinor - creatorAmountMinor,
  }
}

export function marketplaceLedgerBalance(entries, accountId, currency, now = Date.now()) {
  const relevant = Array.isArray(entries)
    ? entries.filter((entry) =>
        entry?.schemaVersion === MARKETPLACE_LEDGER_SCHEMA_VERSION &&
        entry?.beneficiaryAccountId === accountId &&
        entry?.currency === currency &&
        Number.isSafeInteger(entry?.amountMinor))
    : []
  return relevant.reduce((balance, entry) => {
    if (Number(entry.availableAt) <= now) balance.availableMinor += entry.amountMinor
    else balance.pendingMinor += entry.amountMinor
    balance.lifetimeMinor += entry.amountMinor
    return balance
  }, {
    currency,
    availableMinor: 0,
    pendingMinor: 0,
    lifetimeMinor: 0,
  })
}
