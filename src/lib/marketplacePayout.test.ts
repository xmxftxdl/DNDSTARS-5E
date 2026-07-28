import { describe, expect, it } from 'vitest'
import {
  marketplacePayoutMinimum,
  marketplacePayoutPublicRecord,
  marketplacePayoutRecordValid,
  marketplacePayoutTransitionAllowed,
} from '../../shared/marketplace-payout.mjs'

describe('创作者提现协议', () => {
  it('设置人民币与美元最低提现额', () => {
    expect(marketplacePayoutMinimum('CNY')).toBe(10_000)
    expect(marketplacePayoutMinimum('USD')).toBe(2_000)
    expect(marketplacePayoutMinimum('BTC')).toBeNull()
  })

  it('限制审核状态转换并隐藏内部收款目标', () => {
    expect(marketplacePayoutTransitionAllowed('pending', 'approve')).toBe(true)
    expect(marketplacePayoutTransitionAllowed('approved', 'mark-paid')).toBe(true)
    expect(marketplacePayoutTransitionAllowed('paid', 'reject')).toBe(false)
    const privatePayoutRecord = {
      schemaVersion: 1,
      payoutId: 'payout-1',
      creatorAccountId: 'creator-1',
      currency: 'CNY',
      amountMinor: 10_000,
      status: 'pending',
      createdAt: 1,
      payoutDestinationReference: 'private-recipient-token',
    } as Parameters<typeof marketplacePayoutPublicRecord>[0] & {
      payoutDestinationReference: string
    }
    expect(marketplacePayoutPublicRecord(privatePayoutRecord))
      .not.toHaveProperty('payoutDestinationReference')
  })

  it('对损坏的提现记录 fail closed', () => {
    expect(marketplacePayoutRecordValid({
      schemaVersion: 1,
      payoutId: 'payout-invalid',
      creatorAccountId: 'creator-1',
      currency: 'CNY',
      amountMinor: -1,
      status: 'pending',
      createdAt: 1,
    })).toBe(false)
    expect(marketplacePayoutPublicRecord({
      schemaVersion: 1,
      payoutId: 'payout-paid-without-transfer',
      creatorAccountId: 'creator-1',
      currency: 'CNY',
      amountMinor: 10_000,
      status: 'paid',
      createdAt: 1,
    })).toBeNull()
  })
})
