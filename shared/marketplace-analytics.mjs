export const MARKETPLACE_ANALYTICS_SCHEMA_VERSION = 1
export const MARKETPLACE_ANALYTICS_MAX_DAILY_ROWS = 500_000
export const MARKETPLACE_ANALYTICS_MAX_INSTALLATIONS = 1_000_000

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function boundedText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export function marketplaceAnalyticsDay(timestamp = Date.now()) {
  const date = new Date(Number(timestamp))
  if (!Number.isFinite(date.getTime())) return marketplaceAnalyticsDay()
  return date.toISOString().slice(0, 10)
}

export function normalizeMarketplaceAnalyticsDaily(value) {
  if (!plainObject(value) || value.schemaVersion !== MARKETPLACE_ANALYTICS_SCHEMA_VERSION) return null
  const day = boundedText(value.day, 10)
  const productId = boundedText(value.productId, 100)
  const version = boundedText(value.version, 64)
  const publisherAccountId = boundedText(value.publisherAccountId, 80)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !productId || !version || !publisherAccountId) return null
  return {
    schemaVersion: MARKETPLACE_ANALYTICS_SCHEMA_VERSION,
    day,
    productId,
    version,
    publisherAccountId,
    views: nonNegativeInteger(value.views),
    downloads: nonNegativeInteger(value.downloads),
    installs: nonNegativeInteger(value.installs),
    uninstalls: nonNegativeInteger(value.uninstalls),
  }
}

export function normalizeMarketplaceInstallation(value) {
  if (!plainObject(value) || value.schemaVersion !== MARKETPLACE_ANALYTICS_SCHEMA_VERSION) return null
  const accountId = boundedText(value.accountId, 80)
  const productId = boundedText(value.productId, 100)
  const version = boundedText(value.version, 64)
  const publisherAccountId = boundedText(value.publisherAccountId, 80)
  if (!accountId || !productId || !version || !publisherAccountId) return null
  return {
    schemaVersion: MARKETPLACE_ANALYTICS_SCHEMA_VERSION,
    accountId,
    productId,
    version,
    publisherAccountId,
    active: value.active === true,
    installedAt: Number.isFinite(value.installedAt) ? Number(value.installedAt) : Date.now(),
    updatedAt: Number.isFinite(value.updatedAt) ? Number(value.updatedAt) : Date.now(),
    ...(Number.isFinite(value.uninstalledAt) ? { uninstalledAt: Number(value.uninstalledAt) } : {}),
  }
}

export function recordMarketplaceDailyMetric(rows, input) {
  const metric = ['views', 'downloads', 'installs', 'uninstalls'].includes(input?.metric)
    ? input.metric
    : null
  const day = marketplaceAnalyticsDay(input?.timestamp)
  const productId = boundedText(input?.productId, 100)
  const version = boundedText(input?.version, 64)
  const publisherAccountId = boundedText(input?.publisherAccountId, 80)
  if (!metric || !productId || !version || !publisherAccountId) return Array.isArray(rows) ? rows : []
  const normalized = (Array.isArray(rows) ? rows : [])
    .map(normalizeMarketplaceAnalyticsDaily)
    .filter(Boolean)
  const index = normalized.findIndex((row) =>
    row.day === day &&
    row.productId === productId &&
    row.version === version &&
    row.publisherAccountId === publisherAccountId)
  const current = index >= 0
    ? normalized[index]
    : {
        schemaVersion: MARKETPLACE_ANALYTICS_SCHEMA_VERSION,
        day,
        productId,
        version,
        publisherAccountId,
        views: 0,
        downloads: 0,
        installs: 0,
        uninstalls: 0,
      }
  const next = { ...current, [metric]: current[metric] + 1 }
  if (index >= 0) normalized[index] = next
  else normalized.push(next)
  return normalized.slice(-MARKETPLACE_ANALYTICS_MAX_DAILY_ROWS)
}

export function updateMarketplaceInstallation(rows, input) {
  const accountId = boundedText(input?.accountId, 80)
  const productId = boundedText(input?.productId, 100)
  const version = boundedText(input?.version, 64)
  const publisherAccountId = boundedText(input?.publisherAccountId, 80)
  const active = input?.active === true
  const now = Number.isFinite(input?.timestamp) ? Number(input.timestamp) : Date.now()
  if (!accountId || !productId || !version || !publisherAccountId) {
    return { installations: Array.isArray(rows) ? rows : [], transition: null }
  }
  const normalized = (Array.isArray(rows) ? rows : [])
    .map(normalizeMarketplaceInstallation)
    .filter(Boolean)
  const index = normalized.findIndex((row) => row.accountId === accountId && row.productId === productId)
  const previous = index >= 0 ? normalized[index] : null
  const transition = previous?.active === active
    ? null
    : !previous && active
      ? 'installed'
      : previous?.active && !active
        ? 'uninstalled'
        : null
  const next = {
    schemaVersion: MARKETPLACE_ANALYTICS_SCHEMA_VERSION,
    accountId,
    productId,
    version,
    publisherAccountId,
    active,
    installedAt: previous?.installedAt ?? now,
    updatedAt: now,
    ...(active ? {} : { uninstalledAt: now }),
  }
  if (index >= 0) normalized[index] = next
  else normalized.push(next)
  return {
    installations: normalized.slice(-MARKETPLACE_ANALYTICS_MAX_INSTALLATIONS),
    transition,
  }
}

function addCurrency(target, currency, amountMinor) {
  const key = boundedText(currency, 3)
  if (!key || !Number.isSafeInteger(amountMinor)) return
  target[key] = (target[key] ?? 0) + amountMinor
}

export function buildMarketplaceCreatorAnalytics(input) {
  const publisherAccountId = boundedText(input?.publisherAccountId, 80)
  const now = Number.isFinite(input?.now) ? Number(input.now) : Date.now()
  const periodDays = Math.max(7, Math.min(365, Number(input?.periodDays) || 30))
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - periodDays + 1)
  const startAt = start.getTime()
  const startDay = marketplaceAnalyticsDay(startAt)
  const entries = (Array.isArray(input?.entries) ? input.entries : [])
    .filter((entry) => entry?.publisher?.accountId === publisherAccountId)
  const names = new Map(entries.map((entry) => [entry.id, entry.name || entry.id]))
  const dailyRows = (Array.isArray(input?.daily) ? input.daily : [])
    .map(normalizeMarketplaceAnalyticsDaily)
    .filter((row) => row && row.publisherAccountId === publisherAccountId && row.day >= startDay)
  const installations = (Array.isArray(input?.installations) ? input.installations : [])
    .map(normalizeMarketplaceInstallation)
    .filter((row) => row && row.publisherAccountId === publisherAccountId)
  const orders = (Array.isArray(input?.orders) ? input.orders : [])
    .filter((order) =>
      order?.publisherAccountId === publisherAccountId &&
      Number.isFinite(order?.fulfilledAt) &&
      Number(order.fulfilledAt) >= startAt)
  const ledger = (Array.isArray(input?.ledgerEntries) ? input.ledgerEntries : [])
    .filter((entry) =>
      entry?.beneficiaryAccountId === publisherAccountId &&
      entry?.beneficiaryRole === 'creator' &&
      Number.isSafeInteger(entry?.amountMinor) &&
      Number(entry.createdAt) >= startAt)

  const series = []
  const seriesByDay = new Map()
  for (let offset = 0; offset < periodDays; offset += 1) {
    const timestamp = startAt + offset * 86_400_000
    const day = marketplaceAnalyticsDay(timestamp)
    const point = { day, views: 0, downloads: 0, installs: 0, sales: 0, revenueMinor: {} }
    series.push(point)
    seriesByDay.set(day, point)
  }
  const products = new Map(entries.map((entry) => [entry.id, {
    productId: entry.id,
    name: entry.name || entry.id,
    views: 0,
    downloads: 0,
    installs: 0,
    activeInstallations: 0,
    sales: 0,
    revenueMinor: {},
  }]))
  const ensureProduct = (productId) => {
    if (!products.has(productId)) {
      products.set(productId, {
        productId,
        name: names.get(productId) ?? productId,
        views: 0,
        downloads: 0,
        installs: 0,
        activeInstallations: 0,
        sales: 0,
        revenueMinor: {},
      })
    }
    return products.get(productId)
  }

  for (const row of dailyRows) {
    const product = ensureProduct(row.productId)
    product.views += row.views
    product.downloads += row.downloads
    product.installs += row.installs
    const point = seriesByDay.get(row.day)
    if (point) {
      point.views += row.views
      point.downloads += row.downloads
      point.installs += row.installs
    }
  }
  for (const installation of installations) {
    if (installation.active) ensureProduct(installation.productId).activeInstallations += 1
  }
  for (const order of orders) {
    const product = ensureProduct(order.productId)
    product.sales += 1
    const point = seriesByDay.get(marketplaceAnalyticsDay(order.fulfilledAt))
    if (point) point.sales += 1
  }
  for (const entry of ledger) {
    const product = ensureProduct(entry.productId)
    addCurrency(product.revenueMinor, entry.currency, entry.amountMinor)
    const point = seriesByDay.get(marketplaceAnalyticsDay(entry.createdAt))
    if (point) addCurrency(point.revenueMinor, entry.currency, entry.amountMinor)
  }

  const productRows = [...products.values()]
    .map((product) => ({
      ...product,
      installConversionRate: product.views > 0 ? product.installs / product.views : 0,
    }))
    .sort((left, right) => right.views - left.views || left.productId.localeCompare(right.productId))
  const totals = productRows.reduce((result, product) => {
    result.views += product.views
    result.downloads += product.downloads
    result.installs += product.installs
    result.activeInstallations += product.activeInstallations
    result.sales += product.sales
    for (const [currency, amount] of Object.entries(product.revenueMinor)) {
      addCurrency(result.revenueMinor, currency, amount)
    }
    return result
  }, {
    views: 0,
    downloads: 0,
    installs: 0,
    activeInstallations: 0,
    sales: 0,
    revenueMinor: {},
  })

  return {
    schemaVersion: MARKETPLACE_ANALYTICS_SCHEMA_VERSION,
    generatedAt: now,
    periodDays,
    totals: {
      ...totals,
      installConversionRate: totals.views > 0 ? totals.installs / totals.views : 0,
    },
    series,
    products: productRows,
  }
}
