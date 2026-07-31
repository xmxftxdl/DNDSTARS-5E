export const MARKETPLACE_PUBLICATION_SCHEMA_VERSION: 1
export const MARKETPLACE_RIGHTS_SCHEMA_VERSION: 1
export const MARKETPLACE_CREATOR_SHARE_BPS: 6000
export const MARKETPLACE_PLATFORM_SHARE_BPS: 4000
export const MARKETPLACE_CREATOR_AGREEMENT_VERSION: '2026-07-27'
export const MARKETPLACE_CREATOR_POLICY_VERSION: '2026-07-27'
export const MARKETPLACE_CREATOR_NOTICE_VERSION: '2026-07-27'

export interface MarketplacePricingV1 {
  kind: 'free' | 'paid'
  currency: 'CNY' | 'USD'
  amountMinor: number
  settlementBasis: 'net-receipts'
  creatorShareBps: 6000
  platformShareBps: 4000
}

export interface MarketplaceRightsAssetV1 {
  category: 'text' | 'rules' | 'art' | 'map' | 'audio' | 'font' | 'code' | 'other'
  sourceType: 'original' | 'commissioned' | 'licensed' | 'open-license' | 'srd-5.1' | 'ai-assisted'
  license: string
  sourceUrl?: string
  evidenceReference?: string
}

export interface MarketplaceRightsManifestV1 {
  schemaVersion: 1
  contentOrigin: 'original' | 'commissioned' | 'licensed' | 'open-license' | 'mixed'
  creatorDeclaration: true
  acceptedCreatorAgreement: '2026-07-27'
  containsAi: boolean
  aiDisclosure?: string
  assets: MarketplaceRightsAssetV1[]
}

export interface MarketplacePublicationV1 {
  schemaVersion: 1
  productType: 'plugin' | 'adventure'
  commerceState: 'preview'
  pricing: MarketplacePricingV1
  rightsStatus: 'creator-declared' | 'legacy-unverified'
  rightsManifest?: MarketplaceRightsManifestV1
}

export interface MarketplaceAutomationReportV1 {
  analyzerVersion: 1
  riskLevel: 'review' | 'blocked'
  findings: string[]
  summary: Record<string, number>
}

export function normalizeMarketplacePublication(
  value: unknown,
  options?: { allowLegacyFree?: boolean },
): { ok: true; value: MarketplacePublicationV1 } | { ok: false; error: string }

export function analyzeMarketplaceDeclarativePackage(parsed: unknown): MarketplaceAutomationReportV1
export function formatMarketplacePrice(pricing: MarketplacePricingV1, locale?: string): string
