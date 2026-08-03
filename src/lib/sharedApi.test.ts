import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configuredApiBases,
  defaultSharedApiCandidates,
  loadSharedResource,
  saveSharedResourcesAtomically,
  saveSharedResourceWithResult,
  sharedEventApiCandidates,
  sharedWriteApiCandidates,
} from './sharedApi'
import { ROOM_SESSION_STORAGE_KEY, type RoomSession } from './roomSession'

function localStorageDouble() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
  }
}

// Pin the previously-untested client sync-layer routing core (src/lib/sharedApi.ts
// had ZERO .test.ts references). The base-list parse de-DUPLICATES + trims + drops empties, and the
// two write/event topologies diverge on purpose: state/image WRITES double-send to all configured
// bases (file-backed, idempotent), while EVENTS go to a single canonical base (one SSE backlog).
describe('T-P1-422/AC4 — sharedApi base-list routing (dedup / order / topology)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('configuredApiBases dedups, trims, and drops empty entries (order preserved)', () => {
    vi.stubEnv('VITE_SHARED_API_BASES', ' a/api , b/api ,a/api,, b/api ')
    expect(configuredApiBases()).toEqual(['a/api', 'b/api'])
  })

  it('configuredApiBases returns null when unset (falls back to defaults downstream)', () => {
    vi.stubEnv('VITE_SHARED_API_BASES', '')
    expect(configuredApiBases()).toBeNull()
  })

  it('writes DOUBLE-SEND to every configured base (file-backed, idempotent)', () => {
    vi.stubEnv('VITE_SHARED_API_BASES', 'http://h:6173/api,http://h:6174/api,http://h:6175/api')
    expect(sharedWriteApiCandidates()).toEqual([
      'http://h:6173/api',
      'http://h:6174/api',
      'http://h:6175/api',
    ])
  })

  it('events SINGLE-CANONICAL even when writes double-send (no second backlog to diverge)', () => {
    vi.stubEnv('VITE_SHARED_API_BASES', 'http://h:6173/api,http://h:6174/api,http://h:6175/api')
    // writes fan out to 3, events collapse to 1 — the C2 divergence fix.
    expect(sharedWriteApiCandidates()).toHaveLength(3)
    expect(sharedEventApiCandidates()).toEqual(['http://h:6173/api'])
  })

  it('uses only the same-origin API when built for production', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://table.dndstars.example',
        protocol: 'https:',
        hostname: 'table.dndstars.example',
        port: '',
      },
    })
    expect(defaultSharedApiCandidates(true)).toEqual(['https://table.dndstars.example/api'])
  })

  it('keeps packaged local DM/player builds on the DM real-time authority', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://127.0.0.1:5274',
        protocol: 'http:',
        hostname: '127.0.0.1',
        port: '5274',
      },
    })
    vi.stubEnv('VITE_SHARED_API_BASES', '')

    expect(defaultSharedApiCandidates(true)).toEqual([
      'http://127.0.0.1:5273/api',
      'http://127.0.0.1:5274/api',
    ])
    expect(sharedWriteApiCandidates(true)).toEqual(['http://127.0.0.1:5273/api'])
    expect(sharedEventApiCandidates(true)).toEqual(['http://127.0.0.1:5273/api'])
  })

  it('returns a saved ACK only after the authoritative PUT succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', {
        status: 404,
        headers: { 'X-Stars-State-Revision': '0' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Stars-State-Revision': '1' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(saveSharedResourceWithResult('test-save-ack', { updatedAt: 1 })).resolves.toEqual({
      status: 'saved', revision: 1,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reports a CAS conflict instead of treating the rejected snapshot as saved', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', {
        status: 404,
        headers: { 'X-Stars-State-Revision': '0' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ currentRevision: 4 }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', 'X-Stars-State-Revision': '4' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(saveSharedResourceWithResult('test-save-conflict', { updatedAt: 2 })).resolves.toEqual({
      status: 'conflict', expectedRevision: 0, currentRevision: 4,
    })
  })

  it('does not authorize a queued stale save with a conflict revision before reloading', async () => {
    const resource = `conflict-reload-barrier-${Date.now()}`
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', {
        status: 404,
        headers: { 'X-Stars-State-Revision': '0' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ currentRevision: 4 }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', 'X-Stars-State-Revision': '4' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ currentRevision: 4 }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', 'X-Stars-State-Revision': '4' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ updatedAt: 4 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Stars-State-Revision': '4' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 5 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Stars-State-Revision': '5' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(saveSharedResourceWithResult(resource, { updatedAt: 1 })).resolves.toMatchObject({
      status: 'conflict', expectedRevision: 0, currentRevision: 4,
    })
    await expect(saveSharedResourceWithResult(resource, { updatedAt: 2 })).resolves.toMatchObject({
      status: 'conflict', expectedRevision: 0, currentRevision: 4,
    })

    const secondPut = fetchMock.mock.calls[2]?.[1] as RequestInit | undefined
    expect(new Headers(secondPut?.headers).get('X-Stars-Expected-Revision')).toBe('0')

    await loadSharedResource(resource)
    await expect(saveSharedResourceWithResult(resource, { updatedAt: 5 })).resolves.toEqual({
      status: 'saved', revision: 5,
    })
    const rebasedPut = fetchMock.mock.calls[4]?.[1] as RequestInit | undefined
    expect(new Headers(rebasedPut?.headers).get('X-Stars-Expected-Revision')).toBe('4')
  })

  it('keeps atomic transaction conflicts behind the same read-before-retry barrier', async () => {
    const resource = `transaction-conflict-reload-barrier-${Date.now()}`
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', {
        status: 404,
        headers: { 'X-Stars-State-Revision': '0' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'shared-state-transaction-conflict',
        conflicts: [{ name: resource, currentRevision: 7 }],
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ currentRevision: 7 }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', 'X-Stars-State-Revision': '7' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(saveSharedResourcesAtomically([{
      name: resource,
      data: { updatedAt: 1 },
    }], { transactionId: 'transaction-conflict-test' })).rejects.toThrow('shared-state-transaction-conflict')
    await expect(saveSharedResourceWithResult(resource, { updatedAt: 2 })).resolves.toMatchObject({
      status: 'conflict', expectedRevision: 0, currentRevision: 7,
    })

    const staleRetry = fetchMock.mock.calls[2]?.[1] as RequestInit | undefined
    expect(new Headers(staleRetry?.headers).get('X-Stars-Expected-Revision')).toBe('0')
  })

  it('does not let a late older GET lower the CAS revision watermark', async () => {
    const resource = `revision-watermark-${Date.now()}`
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ updatedAt: 5 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Stars-State-Revision': '5' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ updatedAt: 3 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Stars-State-Revision': '3' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 6 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Stars-State-Revision': '6' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await loadSharedResource(resource)
    await loadSharedResource(resource)
    await saveSharedResourceWithResult(resource, { updatedAt: 6 })

    const putInit = fetchMock.mock.calls[2]?.[1] as RequestInit | undefined
    expect(new Headers(putInit?.headers).get('X-Stars-Expected-Revision')).toBe('5')
  })

  it('persists a player wizard preparation during active combat instead of keeping it only in memory', async () => {
    const localStorage = localStorageDouble()
    const session: RoomSession = {
      roomId: 'ABC234',
      roomName: 'Test room',
      rulesetId: 'dnd5e-2014-srd-5.1',
      memberId: 'member-player-123',
      roomToken: 'room-token-abcdefghijklmnopqrstuvwxyz-1234567890',
      clientId: 'player-browser',
      role: 'player',
      slot: 'player1',
      displayName: 'Wizard',
      createdAt: 1,
    }
    localStorage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify(session))
    vi.stubGlobal('window', {
      localStorage,
      dispatchEvent: vi.fn(),
      location: {
        origin: 'http://127.0.0.1:5274',
        protocol: 'http:',
        hostname: '127.0.0.1',
        port: '5274',
      },
    })
    vi.stubEnv('VITE_SHARED_API_BASES', 'http://127.0.0.1:5273/api')

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', {
        status: 404,
        headers: { 'X-Stars-State-Revision': '0' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Stars-State-Revision': '1' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await saveSharedResourceWithResult('characters', {
      selectedId: 'wizard-1',
      characters: [{
        id: 'wizard-1',
        name: 'Wizard',
        dnd5eClassChoices: {
          classes: {
            wizard: {
              selections: {
                'wizard-spellbook': ['magic-missile'],
                'spell-prepared': ['magic-missile'],
              },
            },
          },
        },
      }],
    })

    expect(result).toEqual({ status: 'saved', revision: 1 })
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/state/combat'))).toBe(false)
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true)
  })
})
