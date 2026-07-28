import { createHmac } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createMarketplaceCheckout,
  marketplaceCapabilities,
  marketplaceCheckoutAdapter,
  marketplacePaidPublishingEnabled,
} from '../../scripts/shared-server-core.mjs'

describe('市场支付适配器', () => {
  let closeServer: (() => Promise<void>) | null = null
  let endpoint = ''

  beforeAll(async () => {
    const secret = 'checkout-test-secret'
    const server = createServer((request, response) => {
      const chunks: Buffer[] = []
      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      request.on('end', () => {
        const bytes = Buffer.concat(chunks)
        const signature = createHmac('sha256', secret).update(bytes).digest('hex')
        if (request.headers['x-stars-checkout-signature'] !== signature) {
          response.writeHead(401).end()
          return
        }
        const order = JSON.parse(bytes.toString('utf8')) as { orderId: string }
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({
          providerOrderId: `provider:${order.orderId}`,
          checkoutUrl: `${endpoint}/pay/${order.orderId}`,
        }))
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('mock checkout server failed')
    endpoint = `http://127.0.0.1:${address.port}`
    closeServer = () => new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()))
  })

  afterAll(async () => {
    await closeServer?.()
  })

  it('使用固定密钥签署下单请求并验证支付地址', async () => {
    const now = Date.now()
    const checkout = await createMarketplaceCheckout({
      orderId: 'order-1',
      accountId: 'account-1',
      productId: 'product-1',
      version: '1.0.0',
      amountMinor: 990,
      currency: 'CNY',
      expiresAt: now + 60_000,
    }, {
      STARS_SECURITY_MODE: 'development',
      STARS_PUBLIC_ORIGIN: 'http://localhost:8080',
      STARS_MARKETPLACE_CHECKOUT_ADAPTER_URL: endpoint,
      STARS_MARKETPLACE_CHECKOUT_ADAPTER_SECRET: 'checkout-test-secret',
      STARS_MARKETPLACE_CHECKOUT_PROVIDER: 'mock-pay',
    })
    expect(checkout).toMatchObject({
      provider: 'mock-pay',
      providerOrderId: 'provider:order-1',
      checkoutUrl: `${endpoint}/pay/order-1`,
    })
  })

  it('生产环境拒绝明文 HTTP 支付适配器', () => {
    expect(marketplaceCheckoutAdapter({
      STARS_SECURITY_MODE: 'production',
      STARS_MARKETPLACE_CHECKOUT_ADAPTER_URL: endpoint,
      STARS_MARKETPLACE_CHECKOUT_ADAPTER_SECRET: 'checkout-test-secret',
    })).toBeNull()
  })

  it('生产环境在支付、回调与实名服务未全部就绪时保持免费 Beta', () => {
    expect(marketplacePaidPublishingEnabled({
      STARS_SECURITY_MODE: 'production',
      STARS_MARKETPLACE_PAID_PUBLISHING_ENABLED: 'true',
      STARS_MARKETPLACE_CHECKOUT_ADAPTER_URL: 'https://pay.example.com/checkout',
      STARS_MARKETPLACE_CHECKOUT_ADAPTER_SECRET: 'checkout-test-secret',
    })).toBe(false)
    expect(marketplaceCapabilities({
      STARS_SECURITY_MODE: 'production',
      STARS_PLUGIN_ADMIN_ACCOUNT_IDS: 'admin-1',
    })).toMatchObject({
      marketMode: 'free-beta',
      paidPublishingEnabled: false,
      checkoutAvailable: false,
      moderationConfigured: true,
    })
  })

  it('只有显式启用完整生产依赖后才开放付费发布', () => {
    const env = {
      STARS_SECURITY_MODE: 'production',
      STARS_MARKETPLACE_PAID_PUBLISHING_ENABLED: 'true',
      STARS_MARKETPLACE_KYC_PROVIDER_READY: 'true',
      STARS_MARKETPLACE_PAYMENT_WEBHOOK_SECRET: 'webhook-secret',
      STARS_MARKETPLACE_CHECKOUT_ADAPTER_URL: 'https://pay.example.com/checkout',
      STARS_MARKETPLACE_CHECKOUT_ADAPTER_SECRET: 'checkout-test-secret',
      STARS_MARKETPLACE_CHECKOUT_PROVIDER: 'mock-pay',
    }
    expect(marketplacePaidPublishingEnabled(env)).toBe(true)
    expect(marketplaceCapabilities(env)).toMatchObject({
      marketMode: 'live',
      paidPublishingEnabled: true,
      checkoutAvailable: true,
      creatorVerificationMode: 'provider',
    })
  })
})
