import { generateKeyPairSync, sign } from 'node:crypto'
import { webcrypto } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { canonicalMarketplaceJson } from '../../shared/marketplace-entitlement.mjs'
import {
  verifyMarketplacePackageIntegrity,
  verifyMarketplaceProductSignature,
} from './marketplaceSignature'

describe('浏览器商品签名验证', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto })
    Object.defineProperty(globalThis, 'atob', {
      configurable: true,
      value: (value: string) => Buffer.from(value, 'base64').toString('binary'),
    })
    Object.defineProperty(globalThis, 'btoa', {
      configurable: true,
      value: (value: string) => Buffer.from(value, 'binary').toString('base64'),
    })
  })

  it('接受平台 Ed25519 签名并拒绝篡改价格', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const keyId = 'test-key'
    const manifest = {
      schemaVersion: 1,
      productId: 'example.product',
      listingId: 'example.product',
      version: '1.0.0',
      publisherAccountId: 'publisher',
      integrity: 'sha256-example',
      rulesetId: 'dnd5e-2014-srd-5.1',
      contentCategory: 'adventure',
      pricing: { kind: 'paid', currency: 'CNY', amountMinor: 9900 },
      issuedAt: 1,
    } as const
    const signature = sign(
      null,
      Buffer.from(canonicalMarketplaceJson(manifest)),
      privateKey,
    ).toString('base64url')
    const signed = {
      signature: { schemaVersion: 1, algorithm: 'Ed25519', keyId, signature } as const,
      key: { schemaVersion: 1, algorithm: 'Ed25519', keyId, publicKeyPem } as const,
    }
    await expect(verifyMarketplaceProductSignature({ manifest, ...signed })).resolves.toBe(true)
    await expect(verifyMarketplaceProductSignature({
      manifest: { ...manifest, pricing: { ...manifest.pricing, amountMinor: 1 } },
      ...signed,
    })).resolves.toBe(false)
  })

  it('下载后按签名清单中的 SHA-256 校验真实包字节', async () => {
    const bytes = new TextEncoder().encode('signed plugin package')
    const integrity = `sha256-${Buffer.from(
      await webcrypto.subtle.digest('SHA-256', bytes),
    ).toString('base64')}`
    const ownedBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    await expect(verifyMarketplacePackageIntegrity(ownedBytes, integrity)).resolves.toBe(true)
    await expect(verifyMarketplacePackageIntegrity(
      new TextEncoder().encode('tampered package').buffer,
      integrity,
    )).resolves.toBe(false)
  })
})
