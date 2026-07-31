import { describe, expect, it } from 'vitest'
import {
  marketplaceOrderAmounts,
  marketplaceOrderIsPayable,
  marketplaceOrderPublicRecord,
} from '../../shared/marketplace-order.mjs'

describe('市场订单基础协议', () => {
  it('按整数分计算创作者与平台金额且总额守恒', () => {
    expect(marketplaceOrderAmounts(9_900, 6_000, 4_000)).toEqual({
      amountMinor: 9_900,
      creatorAmountMinor: 5_940,
      platformAmountMinor: 3_960,
    })
    expect(marketplaceOrderAmounts(101, 6_000, 4_000)).toEqual({
      amountMinor: 101,
      creatorAmountMinor: 60,
      platformAmountMinor: 41,
    })
    expect(marketplaceOrderAmounts(100, 7_000, 4_000)).toBeNull()
  })

  it('只有未过期的待支付订单可以付款', () => {
    const order = {
      schemaVersion: 1,
      orderId: 'order-1',
      accountId: 'account-1',
      productId: 'product-1',
      version: '1.0.0',
      currency: 'CNY',
      amountMinor: 100,
      status: 'pending',
      provider: 'sandbox',
      createdAt: 1,
      expiresAt: 100,
    } as const
    expect(marketplaceOrderIsPayable(order, 99)).toBe(true)
    expect(marketplaceOrderIsPayable(order, 100)).toBe(false)
    expect(marketplaceOrderPublicRecord({ ...order, providerEventId: 'secret' } as typeof order, 99))
      .not.toHaveProperty('providerEventId')
    expect(marketplaceOrderPublicRecord(order, 100)).toMatchObject({ status: 'expired' })
  })
})
