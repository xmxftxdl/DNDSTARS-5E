import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ServerObservability } from '../../scripts/server-observability.mjs'

class FakeResponse extends EventEmitter {
  statusCode = 200
  headers = new Map<string, string>()

  setHeader(name: string, value: string) {
    this.headers.set(name, value)
  }
}

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  STARS_LOG_CLIENT_IP: process.env.STARS_LOG_CLIENT_IP,
  STARS_METRICS_TOKEN: process.env.STARS_METRICS_TOKEN,
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value == null) delete process.env[key]
    else process.env[key] = value
  }
})

describe('服务端可观测性', () => {
  it('输出低基数指标并默认不记录客户端 IP', () => {
    delete process.env.STARS_LOG_CLIENT_IP
    const observability = new ServerObservability({ buildId: 'test' })
    const log = vi.spyOn(observability, 'log').mockImplementation(() => {})
    const response = new FakeResponse()

    observability.observeRequest({
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '203.0.113.10' },
    }, response, new URL('https://example.test/api/rooms/ABCDEFGH2JKL/plugins/catalog-item-123456789'))
    response.emit('finish')

    const metrics = observability.metrics()
    expect(metrics).toContain('route="/api/rooms/:id/plugins/:id"')
    expect(metrics).toContain('astraltrace_metrics_series_dropped_total 0')
    expect(log).toHaveBeenCalledWith('info', 'http_request', expect.not.objectContaining({
      remoteAddress: expect.anything(),
    }))
  })

  it('生产环境指标端点要求常量时间令牌', () => {
    process.env.NODE_ENV = 'production'
    process.env.STARS_METRICS_TOKEN = 'metrics-test-token'
    const observability = new ServerObservability()
    expect(observability.metricsAuthorized({
      headers: { authorization: 'Bearer metrics-test-token' },
    })).toBe(true)
    expect(observability.metricsAuthorized({
      headers: { authorization: 'Bearer wrong-token' },
    })).toBe(false)
  })

  it('依赖异常时 readiness fail closed', async () => {
    const observability = new ServerObservability()
    vi.spyOn(observability, 'log').mockImplementation(() => {})
    const result = await observability.checkReadiness(() => {
      throw new Error('postgres-unavailable')
    })
    expect(result).toEqual({
      ready: false,
      error: 'postgres-unavailable',
    })
    expect(observability.metrics()).toContain('astraltrace_ready 0')
  })
})
