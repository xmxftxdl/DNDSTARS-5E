import { describe, expect, it } from 'vitest'
import {
  activeMarketplaceEntitlement,
  canonicalMarketplaceJson,
} from '../../shared/marketplace-entitlement.mjs'

describe('市场商品签名与授权基础协议', () => {
  it('对对象键顺序生成相同的规范化签名正文', () => {
    expect(canonicalMarketplaceJson({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(canonicalMarketplaceJson({ a: { c: 3, d: 4 }, b: 2 }))
  })

  it('只接受账号、商品、版本匹配且未过期的有效授权', () => {
    const active = {
      schemaVersion: 1,
      entitlementId: 'ent-1',
      accountId: 'account-1',
      productId: 'product-1',
      version: '1.0.0',
      licenseType: 'personal',
      source: 'purchase',
      status: 'active',
      grantedAt: 1,
    } as const
    expect(activeMarketplaceEntitlement([active], {
      accountId: 'account-1',
      productId: 'product-1',
      version: '1.0.0',
    }, 10)).toEqual(active)
    expect(activeMarketplaceEntitlement([{ ...active, expiresAt: 9 }], {
      accountId: 'account-1',
      productId: 'product-1',
      version: '1.0.0',
    }, 10)).toBeNull()
    expect(activeMarketplaceEntitlement([active], {
      accountId: 'account-2',
      productId: 'product-1',
      version: '1.0.0',
    }, 10)).toBeNull()
  })
})
