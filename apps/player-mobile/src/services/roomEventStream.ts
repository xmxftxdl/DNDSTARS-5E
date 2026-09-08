import type { MobileCredentials } from './mobileApi'

export const MOBILE_ROOM_EVENT_STREAM_SCHEMA_VERSION = 1 as const
export const MOBILE_SHARED_STATE_CHANGED_CHANNEL = 'shared-state-changed'

export interface MobileRoomStateChangedEventV1 {
  schemaVersion: typeof MOBILE_ROOM_EVENT_STREAM_SCHEMA_VERSION
  id: string
  name: string
  updatedAt: number
  deleted?: boolean
}

export interface MobileRoomEventStreamStatusV1 {
  schemaVersion: typeof MOBILE_ROOM_EVENT_STREAM_SCHEMA_VERSION
  state: 'connecting' | 'open' | 'reconnecting' | 'closed'
  attempt: number
  streamId?: string
  sequence: number
}

interface RoomEventEnvelope {
  channel?: unknown
  payload?: unknown
  sequence?: unknown
  streamId?: unknown
  emittedAt?: unknown
}

interface RoomEventReadyPayload {
  channel?: unknown
  streamId?: unknown
  sequence?: unknown
}

interface XhrLike {
  readyState: number
  status: number
  responseText: string
  onprogress: (() => void) | null
  onreadystatechange: (() => void) | null
  onerror: (() => void) | null
  ontimeout: (() => void) | null
  open(method: string, url: string, async?: boolean): void
  setRequestHeader(name: string, value: string): void
  send(): void
  abort(): void
}

interface ParsedSseEvent {
  event: string
  data: string
  id?: string
}

export interface MobileRoomEventStreamHandlers {
  onStateChanged(event: MobileRoomStateChangedEventV1): void
  onRecoveryRequired(reason: 'sequence-gap' | 'stream-restarted' | 'replay-incomplete'): void
  /**
   * Authenticated, server-projected room event. Callers may use this for
   * private ACKs, but gameplay state must still be re-read from Host resources.
   */
  onEvent?(channel: string, payload: unknown): void
  onStatus?(status: MobileRoomEventStreamStatusV1): void
}

export interface MobileRoomEventStreamOptions {
  createRequest?: () => XhrLike
  reconnectBaseMs?: number
  reconnectMaximumMs?: number
  replaySettleMs?: number
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
}

function baseApiUrl(serverUrl: string) {
  return `${serverUrl.replace(/\/+$/, '').replace(/\/api$/, '')}/api`
}

/** XHR streaming can authenticate with headers, so credentials never enter URLs or proxy logs. */
export function mobileRoomEventStreamUrl(credentials: MobileCredentials): string {
  const url = new URL(`${baseApiUrl(credentials.serverUrl)}/events/_all`)
  url.searchParams.set('room', credentials.room.roomId)
  return url.toString()
}

export function parseMobileSseBuffer(buffer: string): { events: ParsedSseEvent[]; remainder: string } {
  const normalized = buffer.replaceAll('\r\n', '\n')
  const frames = normalized.split('\n\n')
  const remainder = frames.pop() ?? ''
  const events: ParsedSseEvent[] = []
  for (const frame of frames) {
    let event = 'message'
    let id: string | undefined
    const data: string[] = []
    for (const line of frame.split('\n')) {
      if (!line || line.startsWith(':')) continue
      const separator = line.indexOf(':')
      const field = separator < 0 ? line : line.slice(0, separator)
      const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '')
      if (field === 'event') event = value || 'message'
      else if (field === 'data') data.push(value)
      else if (field === 'id') id = value
    }
    if (data.length) events.push({ event, data: data.join('\n'), ...(id ? { id } : {}) })
  }
  return { events, remainder }
}

function finiteSequence(value: unknown) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

function stateChangedPayload(value: unknown): MobileRoomStateChangedEventV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (typeof input.id !== 'string' || !input.id || typeof input.name !== 'string' || !input.name) return null
  const updatedAt = Number(input.updatedAt)
  if (!Number.isFinite(updatedAt) || updatedAt < 0) return null
  return {
    schemaVersion: MOBILE_ROOM_EVENT_STREAM_SCHEMA_VERSION,
    id: input.id,
    name: input.name,
    updatedAt,
    ...(input.deleted === true ? { deleted: true } : {}),
  }
}

function defaultRequest(): XhrLike {
  const Constructor = globalThis.XMLHttpRequest
  if (!Constructor) throw new Error('mobile-room-event-stream-unavailable')
  return new Constructor() as unknown as XhrLike
}

/**
 * One authenticated, replay-aware room stream. Events only invalidate cached
 * resources: the caller must fetch the projected Host snapshot before using
 * any value in gameplay.
 */
export function subscribeMobileRoomEventStream(
  credentials: MobileCredentials,
  handlers: MobileRoomEventStreamHandlers,
  options: MobileRoomEventStreamOptions = {},
): () => void {
  const createRequest = options.createRequest ?? defaultRequest
  const setTimer = options.setTimer ?? ((callback, delay) => setTimeout(callback, delay))
  const clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer))
  const reconnectBaseMs = Math.max(100, options.reconnectBaseMs ?? 400)
  const reconnectMaximumMs = Math.max(reconnectBaseMs, options.reconnectMaximumMs ?? 12_000)
  const replaySettleMs = Math.max(20, options.replaySettleMs ?? 180)
  let disposed = false
  let request: XhrLike | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let replayTimer: ReturnType<typeof setTimeout> | null = null
  let replayTargetSequence = 0
  let attempt = 0
  let streamId = ''
  let lastSequence = 0
  let responseOffset = 0
  let buffer = ''

  const detachRequest = (target: XhrLike) => {
    target.onprogress = null
    target.onreadystatechange = null
    target.onerror = null
    target.ontimeout = null
    if (request === target) request = null
  }

  const status = (state: MobileRoomEventStreamStatusV1['state']) => handlers.onStatus?.({
    schemaVersion: MOBILE_ROOM_EVENT_STREAM_SCHEMA_VERSION,
    state,
    attempt,
    ...(streamId ? { streamId } : {}),
    sequence: lastSequence,
  })

  const clearReplayTimer = () => {
    if (replayTimer == null) return
    clearTimer(replayTimer)
    replayTimer = null
  }

  const processReady = (payload: RoomEventReadyPayload) => {
    const nextStreamId = typeof payload.streamId === 'string' ? payload.streamId : ''
    const serverSequence = finiteSequence(payload.sequence) ?? 0
    const restarted = !!streamId && !!nextStreamId && streamId !== nextStreamId
    if (restarted) {
      clearReplayTimer()
      replayTargetSequence = 0
      lastSequence = 0
      handlers.onRecoveryRequired('stream-restarted')
    }
    if (nextStreamId) streamId = nextStreamId
    if (!restarted) clearReplayTimer()
    if (!restarted && lastSequence > 0 && serverSequence > lastSequence) {
      replayTargetSequence = serverSequence
      replayTimer = setTimer(() => {
        replayTimer = null
        const incomplete = lastSequence < replayTargetSequence
        replayTargetSequence = 0
        if (!disposed && incomplete) handlers.onRecoveryRequired('replay-incomplete')
      }, replaySettleMs)
    } else replayTargetSequence = 0
    attempt = 0
    status('open')
  }

  const processMessage = (payload: RoomEventEnvelope) => {
    if (typeof payload.channel !== 'string') return
    const sequence = finiteSequence(payload.sequence)
    const nextStreamId = typeof payload.streamId === 'string' ? payload.streamId : ''
    if (nextStreamId && streamId && nextStreamId !== streamId) {
      streamId = nextStreamId
      lastSequence = 0
      handlers.onRecoveryRequired('stream-restarted')
    } else if (nextStreamId) streamId = nextStreamId
    if (sequence != null) {
      if (sequence <= lastSequence) return
      if (lastSequence > 0 && sequence > lastSequence + 1) handlers.onRecoveryRequired('sequence-gap')
      lastSequence = sequence
      if (replayTargetSequence > 0 && lastSequence >= replayTargetSequence) {
        replayTargetSequence = 0
        clearReplayTimer()
      }
    }
    if (payload.channel === MOBILE_SHARED_STATE_CHANGED_CHANNEL) {
      const event = stateChangedPayload(payload.payload)
      if (event) handlers.onStateChanged(event)
      return
    }
    if (payload.channel !== '_private') handlers.onEvent?.(payload.channel, payload.payload)
  }

  const consume = () => {
    if (!request) return
    const response = request.responseText ?? ''
    if (response.length < responseOffset) {
      responseOffset = 0
      buffer = ''
    }
    buffer += response.slice(responseOffset)
    responseOffset = response.length
    const parsed = parseMobileSseBuffer(buffer)
    buffer = parsed.remainder
    for (const event of parsed.events) {
      try {
        const data = JSON.parse(event.data) as RoomEventEnvelope | RoomEventReadyPayload
        if (event.event === 'ready') processReady(data)
        else if (event.event === 'message') processMessage(data)
      } catch {
        // Malformed SSE data never enters the mobile workspace.
      }
    }
  }

  const reconnect = () => {
    if (disposed || reconnectTimer != null) return
    attempt += 1
    status('reconnecting')
    const delay = Math.min(reconnectMaximumMs, reconnectBaseMs * 2 ** Math.min(6, attempt - 1))
    reconnectTimer = setTimer(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  const connect = () => {
    if (disposed) return
    status(attempt ? 'reconnecting' : 'connecting')
    responseOffset = 0
    buffer = ''
    const next = createRequest()
    request = next
    next.open('GET', mobileRoomEventStreamUrl(credentials), true)
    next.setRequestHeader('Accept', 'text/event-stream')
    next.setRequestHeader('X-Stars-Account-Token', credentials.account.sessionToken)
    next.setRequestHeader('X-Stars-Member', credentials.room.memberId)
    next.setRequestHeader('X-Stars-Room-Token', credentials.room.roomToken)
    next.setRequestHeader('X-Stars-Protocol', '5')
    next.onprogress = consume
    next.onreadystatechange = () => {
      if (next.readyState === 3) consume()
      if (next.readyState !== 4 || disposed || request !== next) return
      consume()
      detachRequest(next)
      reconnect()
    }
    next.onerror = () => {
      if (disposed || request !== next) return
      detachRequest(next)
      reconnect()
    }
    next.ontimeout = () => {
      if (disposed || request !== next) return
      detachRequest(next)
      reconnect()
    }
    next.send()
  }

  connect()
  return () => {
    disposed = true
    clearReplayTimer()
    if (reconnectTimer != null) clearTimer(reconnectTimer)
    reconnectTimer = null
    const activeRequest = request
    if (activeRequest) detachRequest(activeRequest)
    activeRequest?.abort()
    status('closed')
  }
}
