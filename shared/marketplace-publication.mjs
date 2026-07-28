export const MARKETPLACE_PUBLICATION_SCHEMA_VERSION = 1
export const MARKETPLACE_RIGHTS_SCHEMA_VERSION = 1
export const MARKETPLACE_CREATOR_SHARE_BPS = 6_000
export const MARKETPLACE_PLATFORM_SHARE_BPS = 4_000
export const MARKETPLACE_CREATOR_AGREEMENT_VERSION = '2026-07-27'
export const MARKETPLACE_CREATOR_POLICY_VERSION = '2026-07-27'
export const MARKETPLACE_CREATOR_NOTICE_VERSION = '2026-07-27'

const CONTENT_ORIGINS = new Set(['original', 'commissioned', 'licensed', 'open-license', 'mixed'])
const ASSET_CATEGORIES = new Set(['text', 'rules', 'art', 'map', 'audio', 'font', 'code', 'other'])
const SOURCE_TYPES = new Set(['original', 'commissioned', 'licensed', 'open-license', 'srd-5.1', 'ai-assisted'])
const CURRENCIES = new Set(['CNY', 'USD'])

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function boundedText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function normalizeRightsAsset(value) {
  if (!plainObject(value)) return null
  const category = boundedText(value.category, 24)
  const sourceType = boundedText(value.sourceType, 32)
  const license = boundedText(value.license, 160)
  if (!ASSET_CATEGORIES.has(category) || !SOURCE_TYPES.has(sourceType) || !license) return null
  return {
    category,
    sourceType,
    license,
    ...(boundedText(value.sourceUrl, 500) ? { sourceUrl: boundedText(value.sourceUrl, 500) } : {}),
    ...(boundedText(value.evidenceReference, 500)
      ? { evidenceReference: boundedText(value.evidenceReference, 500) }
      : {}),
  }
}

export function normalizeMarketplacePublication(value, { allowLegacyFree = true } = {}) {
  const input = plainObject(value) ? value : {}
  const commerce = plainObject(input.commerce) ? input.commerce : null
  if (!commerce && allowLegacyFree) {
    return {
      ok: true,
      value: {
        schemaVersion: MARKETPLACE_PUBLICATION_SCHEMA_VERSION,
        productType: 'plugin',
        commerceState: 'preview',
        pricing: {
          kind: 'free',
          currency: 'CNY',
          amountMinor: 0,
          settlementBasis: 'net-receipts',
          creatorShareBps: MARKETPLACE_CREATOR_SHARE_BPS,
          platformShareBps: MARKETPLACE_PLATFORM_SHARE_BPS,
        },
        rightsStatus: 'legacy-unverified',
      },
    }
  }
  if (!commerce || commerce.schemaVersion !== MARKETPLACE_PUBLICATION_SCHEMA_VERSION) {
    return { ok: false, error: 'invalid-marketplace-commerce' }
  }
  const pricing = plainObject(commerce.pricing) ? commerce.pricing : {}
  const kind = pricing.kind
  const currency = boundedText(pricing.currency, 3)
  const amountMinor = Number(pricing.amountMinor)
  if (
    !['free', 'paid'].includes(kind) ||
    !CURRENCIES.has(currency) ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor < 0 ||
    (kind === 'free' && amountMinor !== 0) ||
    (kind === 'paid' && (amountMinor < 100 || amountMinor > 9_900))
  ) return { ok: false, error: 'invalid-marketplace-price' }

  const rights = plainObject(input.rightsManifest) ? input.rightsManifest : null
  if (!rights || rights.schemaVersion !== MARKETPLACE_RIGHTS_SCHEMA_VERSION) {
    return { ok: false, error: 'marketplace-rights-manifest-required' }
  }
  const contentOrigin = boundedText(rights.contentOrigin, 32)
  const assets = Array.isArray(rights.assets)
    ? rights.assets.map(normalizeRightsAsset).filter(Boolean).slice(0, 100)
    : []
  if (
    !CONTENT_ORIGINS.has(contentOrigin) ||
    rights.creatorDeclaration !== true ||
    rights.acceptedCreatorAgreement !== MARKETPLACE_CREATOR_AGREEMENT_VERSION ||
    assets.length === 0 ||
    assets.length !== rights.assets.length
  ) return { ok: false, error: 'invalid-marketplace-rights-manifest' }
  if (rights.containsAi === true && !boundedText(rights.aiDisclosure, 2_000)) {
    return { ok: false, error: 'marketplace-ai-disclosure-required' }
  }

  return {
    ok: true,
    value: {
      schemaVersion: MARKETPLACE_PUBLICATION_SCHEMA_VERSION,
      productType: commerce.productType === 'adventure' ? 'adventure' : 'plugin',
      commerceState: 'preview',
      pricing: {
        kind,
        currency,
        amountMinor,
        settlementBasis: 'net-receipts',
        creatorShareBps: MARKETPLACE_CREATOR_SHARE_BPS,
        platformShareBps: MARKETPLACE_PLATFORM_SHARE_BPS,
      },
      rightsStatus: 'creator-declared',
      rightsManifest: {
        schemaVersion: MARKETPLACE_RIGHTS_SCHEMA_VERSION,
        contentOrigin,
        creatorDeclaration: true,
        acceptedCreatorAgreement: MARKETPLACE_CREATOR_AGREEMENT_VERSION,
        containsAi: rights.containsAi === true,
        ...(rights.containsAi === true
          ? { aiDisclosure: boundedText(rights.aiDisclosure, 2_000) }
          : {}),
        assets,
      },
    },
  }
}

function countArray(root, path) {
  let current = root
  for (const key of path) current = plainObject(current) ? current[key] : undefined
  return Array.isArray(current) ? current.length : 0
}

export function analyzeMarketplaceDeclarativePackage(parsed) {
  if (!plainObject(parsed)) {
    return { analyzerVersion: 1, riskLevel: 'blocked', findings: ['内容不是结构化对象。'], summary: {} }
  }
  const serialized = JSON.stringify(parsed)
  const executableMarkers = [
    /\bjavascript\s*:/i,
    /\beval\s*\(/i,
    /\bnew\s+Function\s*\(/i,
    /<script\b/i,
  ].filter((pattern) => pattern.test(serialized)).map((pattern) => pattern.source)
  const summary = {
    subclasses: countArray(parsed, ['subclasses']),
    races: countArray(parsed, ['legacy', 'races']),
    backgrounds: countArray(parsed, ['legacy', 'backgrounds']),
    features: countArray(parsed, ['legacy', 'features']),
    spells: countArray(parsed, ['legacy', 'spells']),
    items: countArray(parsed, ['legacy', 'items']),
    declaredCapabilities: Array.isArray(parsed.manifest?.declaredCapabilities)
      ? parsed.manifest.declaredCapabilities.length
      : 0,
  }
  const findings = [
    '已确认包体为声明式 JSON；运行时仍须经过 Host 白名单与 Worker 沙箱复核。',
    ...(executableMarkers.length > 0
      ? [`发现 ${executableMarkers.length} 个疑似可执行内容标记，禁止自动发布。`]
      : []),
  ]
  return {
    analyzerVersion: 1,
    riskLevel: executableMarkers.length > 0 ? 'blocked' : 'review',
    findings,
    summary,
  }
}

export function formatMarketplacePrice(pricing, locale = 'zh-CN') {
  if (!pricing || pricing.kind === 'free') return '免费'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: pricing.currency,
  }).format(Number(pricing.amountMinor) / 100)
}
