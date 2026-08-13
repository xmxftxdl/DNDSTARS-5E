import { describe, expect, it, vi } from 'vitest'
import type { MobileCredentials } from './mobileApi'
import {
  mobileRoomEventStreamUrl,
  parseMobileSseBuffer,
  subscribeMobileRoomEventStream,
} from './roomEventStream'

const credentials: MobileCredentials = {
  serverUrl: 'https://example.test/api',
  account: { accountId: 'account-1', displayName: '玩家', sessionToken: 'account-token', createdAt: 1 },
  room: {
    roomId: 'ROOM01', roomName: '测试房间', rulesetId: 'dnd5e-2014-srd-5.1', memberId: 'member-1',
    roomToken: 'room-token', accountId: 'account-1', clientId: 'mobile-1', role: 'player', slot: 'player1',
    displayName: '玩家', createdAt: 1,
  },
}

class FakeRequest {
  readyState = 1
  status = 200
  responseText = ''
  onprogress: (() => void) | null = null
  onreadystatechange: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  method = ''
  url = ''
  headers = new Map<string, string>()
  aborted = false
  open(method: string, url: string) { this.method = method; this.url = url }
  setRequestHeader(name: string, value: string) { this.headers.set(name, value) }
  send() { this.readyState = 3 }
  abort() { this.aborted = true }
  push(frame: string) { this.responseText += frame; this.onprogress?.() }
  finish() { this.readyState = 4; this.onreadystatechange?.() }
}

function ready(streamId: string, sequence: number) {
  return `event: ready\ndata: ${JSON.stringify({ channel: '_all', streamId, sequence })}\n\n`
}

function changed(sequence: number, name: string, streamId = 'stream-1') {
  return `event: message\ndata: ${JSON.stringify({
    channel: 'shared-state-changed', streamId, sequence,
    payload: { id: `${name}-${sequence}`, name, updatedAt: sequence },
  })}\n\n`
}

describe('mobile room event stream', () => {
  it('builds the authenticated room stream URL without mutating the server base', () => {
    const url = new URL(mobileRoomEventStreamUrl(credentials))
    expect(`${url.origin}${url.pathname}`).toBe('https://example.test/api/events/_all')
    expect(url.searchParams.get('room')).toBe('ROOM01')
    expect(url.searchParams.get('member')).toBeNull()
    expect(url.searchParams.get('roomToken')).toBeNull()
  })

  it('parses comments, multiline data and retains an incomplete frame', () => {
    const parsed = parseMobileSseBuffer(': heartbeat\nevent: message\ndata: {"a":\ndata: 1}\n\nevent: ready\ndata: {')
    expect(parsed.events).toEqual([{ event: 'message', data: '{"a":\n1}' }])
    expect(parsed.remainder).toBe('event: ready\ndata: {')
  })

  it('deduplicates replay, reports gaps and emits only validated state invalidations', () => {
    const requests: FakeRequest[] = []
    const states: string[] = []
    const recoveries: string[] = []
    const stop = subscribeMobileRoomEventStream(credentials, {
      onStateChanged: (event) => states.push(`${event.name}:${event.updatedAt}`),
      onRecoveryRequired: (reason) => recoveries.push(reason),
    }, { createRequest: () => { const request = new FakeRequest(); requests.push(request); return request } })

    const request = requests[0]
    request.push(ready('stream-1', 0))
    request.push(changed(1, 'combat'))
    request.push(changed(1, 'combat'))
    request.push(changed(3, 'maps'))
    request.push('event: message\ndata: {"channel":"shared-state-changed","sequence":4,"streamId":"stream-1","payload":{"name":"combat"}}\n\n')

    expect(states).toEqual(['combat:1', 'maps:3'])
    expect(recoveries).toEqual(['sequence-gap'])
    expect(request.headers.get('X-Stars-Account-Token')).toBe('account-token')
    expect(request.headers.get('X-Stars-Member')).toBe('member-1')
    expect(request.headers.get('X-Stars-Room-Token')).toBe('room-token')
    stop()
    expect(request.aborted).toBe(true)
  })

  it('reconnects once after a terminated transport', () => {
    vi.useFakeTimers()
    const requests: FakeRequest[] = []
    const stop = subscribeMobileRoomEventStream(credentials, {
      onStateChanged: () => undefined,
      onRecoveryRequired: () => undefined,
    }, {
      createRequest: () => { const request = new FakeRequest(); requests.push(request); return request },
      reconnectBaseMs: 100,
    })
    requests[0].finish()
    vi.advanceTimersByTime(99)
    expect(requests).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(requests).toHaveLength(2)
    stop()
    vi.useRealTimers()
  })

  it('requires the entire advertised replay range before cancelling recovery', () => {
    vi.useFakeTimers()
    const requests: FakeRequest[] = []
    const recoveries: string[] = []
    const stop = subscribeMobileRoomEventStream(credentials, {
      onStateChanged: () => undefined,
      onRecoveryRequired: (reason) => recoveries.push(reason),
    }, {
      createRequest: () => { const request = new FakeRequest(); requests.push(request); return request },
      reconnectBaseMs: 100,
      replaySettleMs: 50,
    })
    requests[0].push(ready('stream-1', 0))
    requests[0].push(changed(1, 'combat'))
    requests[0].finish()
    vi.advanceTimersByTime(100)

    requests[1].push(ready('stream-1', 3))
    requests[1].push(changed(2, 'maps'))
    vi.advanceTimersByTime(50)

    expect(recoveries).toEqual(['replay-incomplete'])
    stop()
    vi.useRealTimers()
  })
})
