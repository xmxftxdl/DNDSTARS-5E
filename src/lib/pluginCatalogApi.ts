import { sharedLobbyApiCandidates } from './sharedApi'
import { getAccountSession } from './accountSession'
import {
  AccountApiError,
  type AccountPluginVersion,
} from './accountApi'
import type {
  MarketplaceAutomationReportV1,
  MarketplacePublicationV1,
  MarketplaceRightsManifestV1,
} from '../../shared/marketplace-publication.mjs'
import type {
  MarketplaceEntitlementV1,
  MarketplaceProductManifestV1,
  MarketplaceProductSignatureV1,
} from '../../shared/marketplace-entitlement.mjs'
import type { MarketplaceOrderV1 } from '../../shared/marketplace-order.mjs'
import type {
  MarketplaceLedgerBalance,
  MarketplaceLedgerEntryV1,
} from '../../shared/marketplace-ledger.mjs'
import type { MarketplacePayoutV1 } from '../../shared/marketplace-payout.mjs'
import {
  verifyMarketplacePackageIntegrity,
  verifyMarketplaceProductSignature,
  type MarketplaceSigningKey,
} from './marketplaceSignature'

export type PluginPublicationVisibility = 'public' | 'unlisted' | 'private'
export type PluginPublicationStatus = 'pending' | 'published' | 'rejected' | 'suspended' | 'withdrawn'

export interface PluginCatalogPublisher {
  accountId: string
  displayName: string
  creatorVerified?: boolean
}

export type MarketplaceCreatorStatus = 'unregistered' | 'pending' | 'verified' | 'rejected' | 'suspended'

export interface MarketplaceCreatorProfile {
  schemaVersion: 1
  accountId: string
  displayName: string
  status: MarketplaceCreatorStatus
  countryOrRegion?: string
  verificationReference?: string
  policyVersion?: string
  noticeVersion?: string
  appliedAt?: number
  verifiedAt?: number
  moderationNote?: string
}

export interface PluginCatalogVersion extends Omit<AccountPluginVersion, 'schemaVersion' | 'name' | 'publisher' |
  'description' | 'apiVersion' | 'rulesetId' | 'createdAt' | 'updatedAt' | 'visibility'> {
  changelog: string
  visibility: Exclude<PluginPublicationVisibility, 'private'>
  status: PluginPublicationStatus
  submittedAt: number
  publishedAt?: number
  moderationNote?: string
  storeDescription?: string
  marketplace?: MarketplacePublicationV1
  automatedAnalysis?: MarketplaceAutomationReportV1
  productManifest?: MarketplaceProductManifestV1
  productSignature?: MarketplaceProductSignatureV1
}

export interface PluginCatalogEntry {
  schemaVersion: 1
  id: string
  name: string
  description: string
  publisher: PluginCatalogPublisher
  contentCategory: AccountPluginVersion['contentCategory']
  tags: string[]
  versions: PluginCatalogVersion[]
  createdAt: number
  updatedAt: number
}

async function catalogRequest<T>(path: string, init?: RequestInit, accountRequired = false): Promise<T> {
  const session = getAccountSession()
  if (accountRequired && !session) throw new AccountApiError('invalid-account-session', 401)
  let reachedServer = false
  for (const api of sharedLobbyApiCandidates()) {
    try {
      const response = await fetch(`${api}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { 'X-Stars-Account-Token': session.sessionToken } : {}),
          ...(init?.headers ?? {}),
        },
      })
      reachedServer = true
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (response.ok) return body as T
      throw new AccountApiError(body.error ?? 'plugin-catalog-request-failed', response.status)
    } catch (error) {
      if (error instanceof AccountApiError) throw error
    }
  }
  throw new AccountApiError(reachedServer ? 'plugin-catalog-request-failed' : 'server-unavailable')
}

let marketplaceSigningKeyPromise: Promise<MarketplaceSigningKey> | null = null

export function loadMarketplaceSigningKey(): Promise<MarketplaceSigningKey> {
  marketplaceSigningKeyPromise ??= catalogRequest<MarketplaceSigningKey>('/plugins/signing-key')
    .catch((error) => {
      marketplaceSigningKeyPromise = null
      throw error
    })
  return marketplaceSigningKeyPromise
}

export async function loadPluginCatalog(input: {
  query?: string
  category?: string
  publisher?: string
} = {}): Promise<PluginCatalogEntry[]> {
  const params = new URLSearchParams()
  if (input.query?.trim()) params.set('q', input.query.trim())
  if (input.category?.trim()) params.set('category', input.category.trim())
  if (input.publisher?.trim()) params.set('publisher', input.publisher.trim())
  const response = await catalogRequest<{ plugins: PluginCatalogEntry[] }>(
    `/plugins/catalog${params.size ? `?${params.toString()}` : ''}`,
  )
  return Array.isArray(response.plugins) ? response.plugins : []
}

export async function loadPluginCatalogEntry(pluginId: string): Promise<PluginCatalogEntry> {
  const response = await catalogRequest<{ plugin: PluginCatalogEntry }>(
    `/plugins/catalog/${encodeURIComponent(pluginId)}`,
  )
  return response.plugin
}

export async function loadPluginPublisher(accountId: string): Promise<{
  publisher: PluginCatalogPublisher
  plugins: PluginCatalogEntry[]
}> {
  return catalogRequest(`/plugins/publishers/${encodeURIComponent(accountId)}`)
}

export async function publishAccountPluginVersion(
  plugin: Pick<AccountPluginVersion, 'id' | 'version'>,
  input: {
    visibility: PluginPublicationVisibility
    changelog?: string
    tags?: string[]
    storeDescription?: string
    commerce?: {
      schemaVersion: 1
      productType: 'plugin' | 'adventure'
      pricing: Pick<MarketplacePublicationV1['pricing'], 'kind' | 'currency' | 'amountMinor'>
    }
    rightsManifest?: MarketplaceRightsManifestV1
  },
): Promise<{ publication: unknown; status?: PluginPublicationStatus }> {
  return catalogRequest(
    `/accounts/me/plugins/${encodeURIComponent(plugin.id)}/versions/${encodeURIComponent(plugin.version)}/publication`,
    { method: 'POST', body: JSON.stringify(input) },
    true,
  )
}

export async function loadMarketplaceCreatorProfile(): Promise<MarketplaceCreatorProfile> {
  const response = await catalogRequest<{ creator: MarketplaceCreatorProfile }>(
    '/accounts/me/creator',
    { method: 'GET' },
    true,
  )
  return response.creator
}

export async function applyForMarketplaceCreator(input: {
  countryOrRegion: string
  verificationReference: string
  acceptedPolicyVersion: string
  acceptedNoticeVersion: string
}): Promise<MarketplaceCreatorProfile> {
  const response = await catalogRequest<{ creator: MarketplaceCreatorProfile }>(
    '/accounts/me/creator',
    { method: 'POST', body: JSON.stringify(input) },
    true,
  )
  return response.creator
}

export async function moderateMarketplaceCreator(input: {
  accountId: string
  action: 'approve' | 'reject' | 'suspend'
  note?: string
}): Promise<void> {
  await catalogRequest(
    `/plugins/creators/${encodeURIComponent(input.accountId)}/moderate`,
    { method: 'POST', body: JSON.stringify({ action: input.action, note: input.note }) },
    true,
  )
}

export async function downloadPublicPlugin(
  pluginId: string,
  version: Pick<PluginCatalogVersion,
    'version' | 'integrity' | 'fileName' | 'marketplace' | 'productManifest' | 'productSignature'>,
): Promise<{ bytes: ArrayBuffer; fileName: string }> {
  if (version.marketplace?.pricing.kind === 'paid' && (!version.productManifest || !version.productSignature)) {
    throw new AccountApiError('marketplace-signature-required', 409)
  }
  if (version.productManifest && version.productSignature) {
    if (
      version.productManifest.productId !== pluginId ||
      version.productManifest.version !== version.version ||
      version.productManifest.integrity !== version.integrity ||
      !await verifyMarketplaceProductSignature({
        manifest: version.productManifest,
        signature: version.productSignature,
        key: await loadMarketplaceSigningKey(),
      })
    ) throw new AccountApiError('marketplace-signature-invalid', 409)
  }
  let reachedServer = false
  const session = getAccountSession()
  for (const api of sharedLobbyApiCandidates()) {
    try {
      const response = await fetch(
        `${api}/plugins/catalog/${encodeURIComponent(pluginId)}/versions/${encodeURIComponent(version.version)}/download`,
        {
          headers: session ? { 'X-Stars-Account-Token': session.sessionToken } : {},
        },
      )
      reachedServer = true
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        throw new AccountApiError(body.error ?? 'plugin-catalog-request-failed', response.status)
      }
      if (response.headers.get('X-Stars-Plugin-Integrity') !== version.integrity) {
        throw new AccountApiError('public-plugin-integrity-mismatch', 409)
      }
      let fileName = version.fileName || `${pluginId}.dndstars5e`
      try {
        fileName = decodeURIComponent(response.headers.get('X-Stars-Plugin-Filename') ?? '') || fileName
      } catch {
        // File names are cosmetic; identity remains the signed manifest and integrity.
      }
      const bytes = await response.arrayBuffer()
      if (!await verifyMarketplacePackageIntegrity(bytes, version.integrity)) {
        throw new AccountApiError('public-plugin-integrity-mismatch', 409)
      }
      return { bytes, fileName }
    } catch (error) {
      if (error instanceof AccountApiError) throw error
    }
  }
  throw new AccountApiError(reachedServer ? 'plugin-catalog-request-failed' : 'server-unavailable')
}

export async function loadMarketplaceEntitlements(): Promise<MarketplaceEntitlementV1[]> {
  const response = await catalogRequest<{ entitlements: MarketplaceEntitlementV1[] }>(
    '/accounts/me/entitlements',
    { method: 'GET' },
    true,
  )
  return Array.isArray(response.entitlements) ? response.entitlements : []
}

export async function grantSandboxMarketplaceEntitlement(
  pluginId: string,
  version: string,
): Promise<MarketplaceEntitlementV1> {
  const response = await catalogRequest<{ entitlement: MarketplaceEntitlementV1 }>(
    `/plugins/catalog/${encodeURIComponent(pluginId)}/versions/${encodeURIComponent(version)}/entitlements`,
    { method: 'POST', body: JSON.stringify({ sandbox: true }) },
    true,
  )
  return response.entitlement
}

export async function moderateMarketplaceEntitlement(input: {
  entitlementId: string
  status: MarketplaceEntitlementV1['status']
  reason?: string
}): Promise<MarketplaceEntitlementV1> {
  const response = await catalogRequest<{ entitlement: MarketplaceEntitlementV1 }>(
    `/plugins/entitlements/${encodeURIComponent(input.entitlementId)}/status`,
    {
      method: 'POST',
      body: JSON.stringify({
        status: input.status,
        reason: input.reason?.trim() || undefined,
      }),
    },
    true,
  )
  return response.entitlement
}

export async function createMarketplaceOrder(input: {
  productId: string
  version: string
  idempotencyKey?: string
}): Promise<{
  order: MarketplaceOrderV1
  sandboxAvailable: boolean
  checkoutAvailable: boolean
}> {
  const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID()
  return catalogRequest(
    '/marketplace/orders',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        productId: input.productId,
        version: input.version,
        idempotencyKey,
      }),
    },
    true,
  )
}

export async function startMarketplaceCheckout(orderId: string): Promise<{
  order: MarketplaceOrderV1
  checkout: {
    provider: string
    providerOrderId: string
    checkoutUrl: string
    expiresAt: number
  }
}> {
  return catalogRequest(
    `/marketplace/orders/${encodeURIComponent(orderId)}/checkout`,
    { method: 'POST', body: '{}' },
    true,
  )
}

export async function completeSandboxMarketplaceOrder(
  orderId: string,
): Promise<MarketplaceOrderV1> {
  const response = await catalogRequest<{ order: MarketplaceOrderV1 }>(
    `/marketplace/orders/${encodeURIComponent(orderId)}/sandbox-payment`,
    { method: 'POST', body: '{}' },
    true,
  )
  return response.order
}

export async function loadMarketplaceOrders(): Promise<MarketplaceOrderV1[]> {
  const response = await catalogRequest<{ orders: MarketplaceOrderV1[] }>(
    '/marketplace/orders',
    { method: 'GET' },
    true,
  )
  return Array.isArray(response.orders) ? response.orders : []
}

export async function cancelMarketplaceOrder(orderId: string): Promise<MarketplaceOrderV1> {
  const response = await catalogRequest<{ order: MarketplaceOrderV1 }>(
    `/marketplace/orders/${encodeURIComponent(orderId)}/cancel`,
    { method: 'POST', body: '{}' },
    true,
  )
  return response.order
}

export async function loadMarketplaceCreatorLedger(): Promise<{
  balances: MarketplaceLedgerBalance[]
  entries: MarketplaceLedgerEntryV1[]
  settlementHoldDays: number
}> {
  return catalogRequest(
    '/marketplace/creators/me/ledger',
    { method: 'GET' },
    true,
  )
}

export async function loadMarketplaceCreatorPayouts(): Promise<MarketplacePayoutV1[]> {
  const response = await catalogRequest<{ payouts: MarketplacePayoutV1[] }>(
    '/marketplace/creators/me/payouts',
    { method: 'GET' },
    true,
  )
  return Array.isArray(response.payouts) ? response.payouts : []
}

export async function requestMarketplaceCreatorPayout(input: {
  currency: 'CNY' | 'USD'
  amountMinor: number
  idempotencyKey?: string
}): Promise<MarketplacePayoutV1> {
  const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID()
  const response = await catalogRequest<{ payout: MarketplacePayoutV1 }>(
    '/marketplace/creators/me/payouts',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ ...input, idempotencyKey }),
    },
    true,
  )
  return response.payout
}

export async function moderateMarketplacePayout(input: {
  payoutId: string
  action: 'approve' | 'reject' | 'mark-paid'
  note?: string
  externalTransferReference?: string
}): Promise<MarketplacePayoutV1> {
  const response = await catalogRequest<{ payout: MarketplacePayoutV1 }>(
    `/marketplace/payouts/${encodeURIComponent(input.payoutId)}/moderate`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: input.action,
        note: input.note,
        externalTransferReference: input.externalTransferReference,
      }),
    },
    true,
  )
  return response.payout
}

export async function reportPublicPlugin(input: {
  pluginId: string
  version: string
  category: 'security' | 'copyright' | 'malware' | 'misleading' | 'other'
  details: string
}): Promise<void> {
  await catalogRequest(
    `/plugins/catalog/${encodeURIComponent(input.pluginId)}/reports`,
    {
      method: 'POST',
      body: JSON.stringify({
        version: input.version,
        category: input.category,
        details: input.details,
      }),
    },
    true,
  )
}

export interface PluginModerationQueue {
  pending: Array<{
    plugin: Pick<PluginCatalogEntry, 'id' | 'name' | 'publisher'>
    version: PluginCatalogVersion
  }>
  reports: Array<{
    id: string
    pluginId: string
    version: string
    category: string
    details: string
    reporterAccountId: string
    status: string
    createdAt: number
  }>
  creatorApplications: MarketplaceCreatorProfile[]
  payouts: Array<MarketplacePayoutV1 & {
    verifiedRecipientReference?: string
  }>
}

export async function loadPluginModerationQueue(): Promise<PluginModerationQueue> {
  const response = await catalogRequest<PluginModerationQueue>('/plugins/moderation', { method: 'GET' }, true)
  return {
    pending: Array.isArray(response.pending) ? response.pending : [],
    reports: Array.isArray(response.reports) ? response.reports : [],
    creatorApplications: Array.isArray(response.creatorApplications) ? response.creatorApplications : [],
    payouts: Array.isArray(response.payouts) ? response.payouts : [],
  }
}

export async function moderatePluginVersion(input: {
  pluginId: string
  version: string
  action: 'approve' | 'reject' | 'suspend'
  note?: string
}): Promise<void> {
  await catalogRequest(
    `/plugins/catalog/${encodeURIComponent(input.pluginId)}/versions/${encodeURIComponent(input.version)}/moderate`,
    {
      method: 'POST',
      body: JSON.stringify({ action: input.action, note: input.note }),
    },
    true,
  )
}
