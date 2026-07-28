export const MARKETPLACE_ANALYTICS_SCHEMA_VERSION: 1
export const MARKETPLACE_ANALYTICS_MAX_DAILY_ROWS: number
export const MARKETPLACE_ANALYTICS_MAX_INSTALLATIONS: number

export interface MarketplaceAnalyticsDailyV1 {
  schemaVersion: 1
  day: string
  productId: string
  version: string
  publisherAccountId: string
  views: number
  downloads: number
  installs: number
  uninstalls: number
}

export interface MarketplaceInstallationV1 {
  schemaVersion: 1
  accountId: string
  productId: string
  version: string
  publisherAccountId: string
  active: boolean
  installedAt: number
  updatedAt: number
  uninstalledAt?: number
}

export function marketplaceAnalyticsDay(timestamp?: number): string
export function normalizeMarketplaceAnalyticsDaily(value: unknown): MarketplaceAnalyticsDailyV1 | null
export function normalizeMarketplaceInstallation(value: unknown): MarketplaceInstallationV1 | null
export function recordMarketplaceDailyMetric(
  rows: MarketplaceAnalyticsDailyV1[],
  input: {
    metric: 'views' | 'downloads' | 'installs' | 'uninstalls'
    productId: string
    version: string
    publisherAccountId: string
    timestamp?: number
  },
): MarketplaceAnalyticsDailyV1[]
export function updateMarketplaceInstallation(
  rows: MarketplaceInstallationV1[],
  input: {
    accountId: string
    productId: string
    version: string
    publisherAccountId: string
    active: boolean
    timestamp?: number
  },
): {
  installations: MarketplaceInstallationV1[]
  transition: 'installed' | 'uninstalled' | null
}

export function buildMarketplaceCreatorAnalytics(input: {
  publisherAccountId: string
  now?: number
  periodDays?: number
  entries?: unknown[]
  daily?: MarketplaceAnalyticsDailyV1[]
  installations?: MarketplaceInstallationV1[]
  orders?: unknown[]
  ledgerEntries?: unknown[]
}): {
  schemaVersion: 1
  generatedAt: number
  periodDays: number
  totals: {
    views: number
    downloads: number
    installs: number
    activeInstallations: number
    sales: number
    installConversionRate: number
    revenueMinor: Record<string, number>
  }
  series: Array<{
    day: string
    views: number
    downloads: number
    installs: number
    sales: number
    revenueMinor: Record<string, number>
  }>
  products: Array<{
    productId: string
    name: string
    views: number
    downloads: number
    installs: number
    activeInstallations: number
    sales: number
    installConversionRate: number
    revenueMinor: Record<string, number>
  }>
}
