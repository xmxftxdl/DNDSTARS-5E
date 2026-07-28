export const MARKETPLACE_ORDER_SCHEMA_VERSION: 1
export const MARKETPLACE_ORDER_TTL_MS: number

export type MarketplaceOrderStatus =
  | 'pending'
  | 'fulfilled'
  | 'canceled'
  | 'expired'
  | 'refunded'
  | 'disputed'

export interface MarketplaceOrderV1 {
  schemaVersion: 1
  orderId: string
  accountId: string
  productId: string
  version: string
  currency: 'CNY' | 'USD'
  amountMinor: number
  status: MarketplaceOrderStatus
  provider: 'sandbox' | 'external'
  createdAt: number
  expiresAt: number
  paidAt?: number
  fulfilledAt?: number
  updatedAt?: number
  entitlementId?: string
}

export function marketplaceOrderAmounts(
  amountMinor: number,
  creatorShareBps: number,
  platformShareBps: number,
): {
  amountMinor: number
  creatorAmountMinor: number
  platformAmountMinor: number
} | null

export function marketplaceOrderIsPayable(order: MarketplaceOrderV1, now?: number): boolean
export function marketplaceOrderPublicRecord(order: MarketplaceOrderV1, now?: number): MarketplaceOrderV1 | null
