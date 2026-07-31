import { describe, expect, it } from 'vitest'
import {
  marketplaceLedgerBalance,
  marketplaceRevenueSplit,
} from '../../shared/marketplace-ledger.mjs'

describe('创作者财务流水', () => {
  it('只对实际净收入做整数分账', () => {
    expect(marketplaceRevenueSplit(823, 6_000, 4_000)).toEqual({
      netReceiptsMinor: 823,
      creatorAmountMinor: 493,
      platformAmountMinor: 330,
    })
    expect(marketplaceRevenueSplit(-1, 6_000, 4_000)).toBeNull()
  })

  it('分别统计冻结期内与已经可结算的余额', () => {
    const base = {
      schemaVersion: 1,
      orderId: 'order-1',
      productId: 'product-1',
      version: '1.0.0',
      beneficiaryAccountId: 'creator-1',
      beneficiaryRole: 'creator',
      currency: 'CNY',
      sourceEventId: 'event-1',
      createdAt: 1,
    } as const
    const entries = [
      { ...base, entryId: 'sale-1', kind: 'sale', amountMinor: 600, availableAt: 50 },
      { ...base, entryId: 'sale-2', kind: 'sale', amountMinor: 300, availableAt: 150 },
      { ...base, entryId: 'refund-1', kind: 'refund', amountMinor: -600, availableAt: 50 },
    ] as const
    expect(marketplaceLedgerBalance([...entries], 'creator-1', 'CNY', 100)).toEqual({
      currency: 'CNY',
      availableMinor: 0,
      pendingMinor: 300,
      lifetimeMinor: 300,
    })
  })
})
