import { describe, expect, it } from 'vitest'
import {
  buildMarketplaceCreatorAnalytics,
  recordMarketplaceDailyMetric,
  updateMarketplaceInstallation,
} from '../../shared/marketplace-analytics.mjs'

describe('插件市场创作者统计', () => {
  it('聚合浏览、安装、销量、活跃安装与净收入趋势', () => {
    let daily = recordMarketplaceDailyMetric([], {
      metric: 'views',
      productId: 'demo.plugin',
      version: '1.0.0',
      publisherAccountId: 'creator-1',
      timestamp: Date.UTC(2026, 6, 28),
    })
    daily = recordMarketplaceDailyMetric(daily, {
      metric: 'installs',
      productId: 'demo.plugin',
      version: '1.0.0',
      publisherAccountId: 'creator-1',
      timestamp: Date.UTC(2026, 6, 28),
    })
    const installation = updateMarketplaceInstallation([], {
      accountId: 'buyer-1',
      productId: 'demo.plugin',
      version: '1.0.0',
      publisherAccountId: 'creator-1',
      active: true,
      timestamp: Date.UTC(2026, 6, 28),
    })
    const result = buildMarketplaceCreatorAnalytics({
      publisherAccountId: 'creator-1',
      now: Date.UTC(2026, 6, 28, 12),
      periodDays: 7,
      entries: [{
        id: 'demo.plugin',
        name: '示例插件',
        publisher: { accountId: 'creator-1' },
      }],
      daily,
      installations: installation.installations,
      orders: [{
        publisherAccountId: 'creator-1',
        productId: 'demo.plugin',
        fulfilledAt: Date.UTC(2026, 6, 28),
      }],
      ledgerEntries: [{
        beneficiaryAccountId: 'creator-1',
        beneficiaryRole: 'creator',
        productId: 'demo.plugin',
        currency: 'CNY',
        amountMinor: 600,
        createdAt: Date.UTC(2026, 6, 28),
      }],
    })

    expect(result.totals).toMatchObject({
      views: 1,
      installs: 1,
      activeInstallations: 1,
      sales: 1,
      installConversionRate: 1,
      revenueMinor: { CNY: 600 },
    })
    expect(result.products[0]).toMatchObject({
      productId: 'demo.plugin',
      name: '示例插件',
      activeInstallations: 1,
    })
    expect(result.series.at(-1)).toMatchObject({
      views: 1,
      installs: 1,
      sales: 1,
      revenueMinor: { CNY: 600 },
    })
  })

  it('重复上报同一安装状态不会重复计算安装转换', () => {
    const first = updateMarketplaceInstallation([], {
      accountId: 'buyer-1',
      productId: 'demo.plugin',
      version: '1.0.0',
      publisherAccountId: 'creator-1',
      active: true,
    })
    const second = updateMarketplaceInstallation(first.installations, {
      accountId: 'buyer-1',
      productId: 'demo.plugin',
      version: '1.0.0',
      publisherAccountId: 'creator-1',
      active: true,
    })
    expect(first.transition).toBe('installed')
    expect(second.transition).toBeNull()
    expect(second.installations).toHaveLength(1)

    const removed = updateMarketplaceInstallation(second.installations, {
      accountId: 'buyer-1',
      productId: 'demo.plugin',
      version: '1.0.0',
      publisherAccountId: 'creator-1',
      active: false,
    })
    const restored = updateMarketplaceInstallation(removed.installations, {
      accountId: 'buyer-1',
      productId: 'demo.plugin',
      version: '1.0.0',
      publisherAccountId: 'creator-1',
      active: true,
    })
    expect(removed.transition).toBe('uninstalled')
    expect(restored.transition).toBeNull()
  })
})
