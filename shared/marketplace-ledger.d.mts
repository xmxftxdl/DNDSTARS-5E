export const MARKETPLACE_LEDGER_SCHEMA_VERSION: 1
export const MARKETPLACE_SETTLEMENT_HOLD_MS: number

export interface MarketplaceLedgerEntryV1 {
  schemaVersion: 1
  entryId: string
  orderId: string
  productId: string
  version: string
  beneficiaryAccountId: string
  beneficiaryRole: 'creator' | 'platform'
  kind: 'sale' | 'refund' | 'dispute' | 'payout' | 'payout-release'
  currency: 'CNY' | 'USD'
  amountMinor: number
  sourceEventId: string
  createdAt: number
  availableAt: number
}

export interface MarketplaceLedgerBalance {
  currency: 'CNY' | 'USD'
  availableMinor: number
  pendingMinor: number
  lifetimeMinor: number
}

export function marketplaceRevenueSplit(
  netReceiptsMinor: number,
  creatorShareBps: number,
  platformShareBps: number,
): {
  netReceiptsMinor: number
  creatorAmountMinor: number
  platformAmountMinor: number
} | null

export function marketplaceLedgerBalance(
  entries: MarketplaceLedgerEntryV1[],
  accountId: string,
  currency: 'CNY' | 'USD',
  now?: number,
): MarketplaceLedgerBalance
