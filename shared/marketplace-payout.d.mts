export const MARKETPLACE_PAYOUT_SCHEMA_VERSION: 1
export const MARKETPLACE_PAYOUT_MINIMUMS: Readonly<{ CNY: number; USD: number }>

export type MarketplacePayoutStatus = 'pending' | 'approved' | 'paid' | 'rejected'

export interface MarketplacePayoutV1 {
  schemaVersion: 1
  payoutId: string
  creatorAccountId: string
  currency: 'CNY' | 'USD'
  amountMinor: number
  status: MarketplacePayoutStatus
  createdAt: number
  updatedAt?: number
  paidAt?: number
  moderationNote?: string
  externalTransferReference?: string
}

export function marketplacePayoutMinimum(currency: string): number | null
export function marketplacePayoutTransitionAllowed(
  status: MarketplacePayoutStatus,
  action: 'approve' | 'reject' | 'mark-paid',
): boolean
export function marketplacePayoutRecordValid(payout: unknown): payout is MarketplacePayoutV1
export function marketplacePayoutPublicRecord(payout: unknown): MarketplacePayoutV1 | null
