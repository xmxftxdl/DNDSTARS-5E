import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileApiError, mobileFetch, mobileJsonRequest } from './mobileHttp'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('mobile HTTP transport', () => {
  it('does not retry a mutation without a Host idempotency key', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(mobileFetch('https://example.test/api/mutate', { method: 'POST' }, { retries: 3 }))
      .rejects.toMatchObject({ code: 'network-unavailable', retriable: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('attaches a stable idempotency key to retry-safe Host mutations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await mobileFetch('https://example.test/api/command', { method: 'POST' }, {
      idempotencyKey: 'character-command:fixed-id', retries: 0,
    })
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers)
    expect(headers.get('X-Stars-Idempotency-Key')).toBe('character-command:fixed-id')
  })

  it('preserves the Host error code and rejects invalid success bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(
      JSON.stringify({ error: 'character-ownership-required' }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    )))
    await expect(mobileJsonRequest('https://example.test/api/command'))
      .rejects.toMatchObject({ code: 'http-error', status: 403, message: 'character-ownership-required' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('not-json', { status: 200 })))
    await expect(mobileJsonRequest('https://example.test/api/broken'))
      .rejects.toEqual(expect.objectContaining<Partial<MobileApiError>>({ code: 'invalid-response' }))
  })
})
