export const MARKETPLACE_PRODUCT_MANIFEST_SCHEMA_VERSION: 1
export const MARKETPLACE_ENTITLEMENT_SCHEMA_VERSION: 1

export interface MarketplaceProductManifestV1 {
  schemaVersion: 1
  productId: string
  listingId: string
  version: string
  publisherAccountId: string
  integrity: string
  rulesetId: string
  contentCategory: string
  pricing: {
    kind: 'free' | 'paid'
    currency: 'CNY' | 'USD'
    amountMinor: number
  }
  issuedAt: number
}

export interface MarketplaceProductSignatureV1 {
  schemaVersion: 1
  algorithm: 'Ed25519'
  keyId: string
  signature: string
}

export interface MarketplaceEntitlementV1 {
  schemaVersion: 1
  entitlementId: string
  accountId: string
  productId: string
  version?: string
  licenseType: 'personal' | 'complimentary'
  source: 'purchase' | 'admin' | 'sandbox' | 'creator'
  status: 'active' | 'refunded' | 'revoked' | 'disputed'
  grantedAt: number
  expiresAt?: number
  updatedAt?: number
  statusReason?: string
  grantedBy?: string
  updatedBy?: string
}

export function canonicalMarketplaceJson(value: unknown): string
export function marketplaceProductKey(productId: string, version: string): string
export function activeMarketplaceEntitlement(
  entitlements: MarketplaceEntitlementV1[],
  input: { accountId: string; productId: string; version: string },
  now?: number,
): MarketplaceEntitlementV1 | null
