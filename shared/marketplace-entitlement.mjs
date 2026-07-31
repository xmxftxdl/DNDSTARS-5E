export const MARKETPLACE_PRODUCT_MANIFEST_SCHEMA_VERSION = 1
export const MARKETPLACE_ENTITLEMENT_SCHEMA_VERSION = 1

export function canonicalMarketplaceJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalMarketplaceJson).join(',')}]`
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalMarketplaceJson(value[key])}`).join(',')}}`
}

export function marketplaceProductKey(productId, version) {
  return `${String(productId)}@${String(version)}`
}

export function activeMarketplaceEntitlement(entitlements, input, now = Date.now()) {
  if (!Array.isArray(entitlements)) return null
  return entitlements.find((entitlement) =>
    entitlement?.schemaVersion === MARKETPLACE_ENTITLEMENT_SCHEMA_VERSION &&
    entitlement?.accountId === input.accountId &&
    entitlement?.productId === input.productId &&
    entitlement?.status === 'active' &&
    (!entitlement.version || entitlement.version === input.version) &&
    (!Number.isFinite(entitlement.expiresAt) || entitlement.expiresAt > now)) ?? null
}
