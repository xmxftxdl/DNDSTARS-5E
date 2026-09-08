export type MobileApiErrorCode =
  | 'network-unavailable'
  | 'request-timeout'
  | 'request-aborted'
  | 'http-error'
  | 'invalid-response'

export class MobileApiError extends Error {
  readonly code: MobileApiErrorCode
  readonly status?: number
  readonly retriable: boolean
  readonly details?: unknown

  constructor(input: {
    code: MobileApiErrorCode
    message: string
    status?: number
    retriable?: boolean
    details?: unknown
  }) {
    super(input.message)
    this.name = 'MobileApiError'
    this.code = input.code
    this.status = input.status
    this.retriable = input.retriable === true
    this.details = input.details
  }
}

export interface MobileRequestPolicy {
  timeoutMs?: number
  retries?: number
  idempotencyKey?: string
}

function requestMethod(init?: RequestInit) {
  return String(init?.method ?? 'GET').toUpperCase()
}

function retryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function requestHeaders(init: RequestInit | undefined, idempotencyKey: string | undefined) {
  const headers = new Headers(init?.headers)
  if (idempotencyKey && !headers.has('X-Stars-Idempotency-Key')) {
    headers.set('X-Stars-Idempotency-Key', idempotencyKey)
  }
  return headers
}

/**
 * The only low-level HTTP transport used by the native player app.
 * GET/HEAD requests use bounded retries. Mutations are retried only when the
 * caller supplies a stable idempotency key that the Host can de-duplicate.
 */
export async function mobileFetch(
  url: string,
  init?: RequestInit,
  policy: MobileRequestPolicy = {},
): Promise<Response> {
  const method = requestMethod(init)
  const retrySafe = method === 'GET' || method === 'HEAD' || !!policy.idempotencyKey
  const retries = retrySafe ? Math.max(0, Math.min(3, policy.retries ?? 2)) : 0
  const timeoutMs = Math.max(1_000, Math.min(60_000, policy.timeoutMs ?? 15_000))
  let latestError: MobileApiError | null = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const onAbort = () => controller.abort(init?.signal?.reason)
    if (init?.signal) {
      if (init.signal.aborted) onAbort()
      else init.signal.addEventListener('abort', onAbort, { once: true })
    }
    const timeout = setTimeout(() => controller.abort('request-timeout'), timeoutMs)
    try {
      const response = await fetch(url, {
        ...init,
        headers: requestHeaders(init, policy.idempotencyKey),
        signal: controller.signal,
      })
      if (!retryableStatus(response.status) || attempt === retries) return response
      latestError = new MobileApiError({
        code: 'http-error',
        status: response.status,
        message: `http-${response.status}`,
        retriable: true,
      })
    } catch (cause) {
      const externallyAborted = init?.signal?.aborted === true
      const timedOut = controller.signal.aborted && !externallyAborted
      latestError = new MobileApiError({
        code: externallyAborted ? 'request-aborted' : timedOut ? 'request-timeout' : 'network-unavailable',
        message: externallyAborted ? 'request-aborted' : timedOut ? 'request-timeout' : 'network-unavailable',
        retriable: !externallyAborted,
        details: cause,
      })
      if (externallyAborted || attempt === retries) throw latestError
    } finally {
      clearTimeout(timeout)
      init?.signal?.removeEventListener('abort', onAbort)
    }
    await wait(Math.min(1_500, 200 * 2 ** attempt))
  }
  throw latestError ?? new MobileApiError({ code: 'network-unavailable', message: 'network-unavailable', retriable: true })
}

export async function mobileJsonRequest<T>(
  url: string,
  init?: RequestInit,
  policy?: MobileRequestPolicy,
): Promise<T> {
  const response = await mobileFetch(url, init, policy)
  const body = await response.json().catch(() => null) as ({ error?: string } & Record<string, unknown>) | null
  if (!response.ok) {
    throw new MobileApiError({
      code: 'http-error',
      status: response.status,
      message: body?.error || `http-${response.status}`,
      retriable: retryableStatus(response.status),
      details: body,
    })
  }
  if (body == null) {
    throw new MobileApiError({ code: 'invalid-response', message: 'invalid-json-response', retriable: false })
  }
  return body as T
}

export function mobileIdempotencyKey(prefix = 'mobile') {
  return `${prefix}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`
}
