import { describe, expect, it } from 'vitest'
import {
  analyzeMarketplaceDeclarativePackage,
  formatMarketplacePrice,
  normalizeMarketplacePublication,
} from '../../shared/marketplace-publication.mjs'

describe('扩展市场发布协议 V1', () => {
  const validPaidPublication = {
    commerce: {
      schemaVersion: 1,
      productType: 'adventure',
      pricing: { kind: 'paid', currency: 'CNY', amountMinor: 1990 },
    },
    rightsManifest: {
      schemaVersion: 1,
      contentOrigin: 'original',
      creatorDeclaration: true,
      acceptedCreatorAgreement: '2026-07-27',
      containsAi: false,
      assets: [{ category: 'text', sourceType: 'original', license: '作者保留版权' }],
    },
  }

  it('强制使用 60/40 的净收入分配并保留作者权利声明', () => {
    const result = normalizeMarketplacePublication(validPaidPublication)
    expect(result).toMatchObject({
      ok: true,
      value: {
        productType: 'adventure',
        commerceState: 'preview',
        pricing: {
          kind: 'paid',
          currency: 'CNY',
          amountMinor: 1990,
          settlementBasis: 'net-receipts',
          creatorShareBps: 6000,
          platformShareBps: 4000,
        },
        rightsStatus: 'creator-declared',
      },
    })
    if (result.ok) expect(formatMarketplacePrice(result.value.pricing)).toContain('19.90')
  })

  it('拒绝没有权利清单的付费商品', () => {
    expect(normalizeMarketplacePublication({
      commerce: validPaidPublication.commerce,
    })).toEqual({ ok: false, error: 'marketplace-rights-manifest-required' })
  })

  it('单件付费商品最高为 99 元', () => {
    expect(normalizeMarketplacePublication({
      ...validPaidPublication,
      commerce: {
        ...validPaidPublication.commerce,
        pricing: { kind: 'paid', currency: 'CNY', amountMinor: 9_901 },
      },
    })).toEqual({ ok: false, error: 'invalid-marketplace-price' })
  })

  it('AI 辅助内容必须披露', () => {
    expect(normalizeMarketplacePublication({
      ...validPaidPublication,
      rightsManifest: {
        ...validPaidPublication.rightsManifest,
        containsAi: true,
      },
    })).toEqual({ ok: false, error: 'marketplace-ai-disclosure-required' })
  })

  it('旧版免费发布保持兼容但标记为未核验', () => {
    expect(normalizeMarketplacePublication({ visibility: 'public' })).toMatchObject({
      ok: true,
      value: {
        pricing: { kind: 'free', amountMinor: 0 },
        rightsStatus: 'legacy-unverified',
      },
    })
  })

  it('自动解析声明式内容并阻止可执行标记', () => {
    expect(analyzeMarketplaceDeclarativePackage({
      manifest: { declaredCapabilities: ['damage'] },
      subclasses: [{ id: 'fighter-example' }],
      legacy: { races: [], backgrounds: [], features: [{}], spells: [{}], items: [] },
    })).toMatchObject({
      riskLevel: 'review',
      summary: { subclasses: 1, features: 1, spells: 1, declaredCapabilities: 1 },
    })
    expect(analyzeMarketplaceDeclarativePackage({
      manifest: {},
      subclasses: [],
      legacy: { features: [{ description: '<script>alert(1)</script>' }] },
    })).toMatchObject({ riskLevel: 'blocked' })
  })

  it('统计工坊 V2 与统一内容包，供市场审核展示实际资源数量', () => {
    expect(analyzeMarketplaceDeclarativePackage({
      format: 'dndstars5e-content',
      manifest: { declaredCapabilities: ['damage', 'summon'] },
      assets: [{ id: 'spell-icon' }],
      content: {
        races: [{}], backgrounds: [], features: [{}], feats: [{}], spells: [{}, {}],
        items: [], headlessActions: [{}], subclasses: [{}], classes: [{}], monsters: [{}],
      },
    })).toMatchObject({
      riskLevel: 'review',
      summary: {
        races: 1, features: 1, feats: 1, spells: 2, headlessActions: 1,
        subclasses: 1, classes: 1, monsters: 1, imageAssets: 1, declaredCapabilities: 2,
      },
    })

    expect(analyzeMarketplaceDeclarativePackage({
      format: 'dndstars5e-unified-content',
      manifest: { declaredCapabilities: [] },
      assets: [],
      definitions: [
        { kind: 'spell' }, { kind: 'spell' }, { kind: 'monster' }, { kind: 'monster-action' },
      ],
    })).toMatchObject({
      riskLevel: 'review',
      summary: { spells: 2, monsters: 1, headlessActions: 1 },
    })
  })
})
