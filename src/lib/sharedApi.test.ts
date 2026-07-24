import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configuredApiBases,
  defaultSharedApiCandidates,
  saveSharedResourceWithResult,
  sharedEventApiCandidates,
  sharedWriteApiCandidates,
} from './sharedApi'

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
      },
    })
    expect(defaultSharedApiCandidates(true)).toEqual(['https://table.dndstars.example/api'])
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
})
