import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MobileAccountSession } from '../../../../packages/mobile-protocol/src'
import { fetchMobileAccount, fetchMobileCampaigns, joinMobileRoom, updateMobileAccountProfile } from './mobileApi'

const account: MobileAccountSession = {
  accountId: 'account-1', displayName: '玩家', sessionToken: 'account-token', createdAt: 1,
}

afterEach(() => vi.unstubAllGlobals())

describe('mobile room join readiness', () => {
  it('preserves the credential when /accounts/me returns only a public profile', async () => {
    const requests: RequestInit[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(init)
      return new Response(JSON.stringify(requests.length === 1
        ? { accountId: account.accountId, displayName: '改名后', createdAt: 1 }
        : { campaigns: [] }), { status: 200 })
    }))
    const restored = await fetchMobileAccount('https://example.test', account)
    expect(restored).toEqual({ ...account, displayName: '改名后' })
    await fetchMobileCampaigns('https://example.test', restored)
    expect(new Headers(requests[1].headers).get('X-Stars-Account-Token')).toBe(account.sessionToken)
  })

  it('does not invent a session credential in a profile update response', async () => {
    const profile = { accountId: account.accountId, displayName: '改名后', createdAt: 1 }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(profile))))
    expect(await updateMobileAccountProfile('https://example.test', account, { displayName: '改名后' })).toEqual(profile)
  })

  it('does not claim previewed packages are active before downloading them', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init })
      if (requests.length === 1) return new Response(JSON.stringify({
        roomId: 'ROOM01', roomName: '测试房间', dmDisplayName: 'DM', hostOnline: true,
        hostStatus: 'online', locked: false, passwordRequired: false, playerCount: 0, maxPlayers: 8,
        plugins: [{
          id: 'custom.rules', version: '1.0.0', integrity: 'sha256-package', stateSchemaVersion: 1,
          name: '自定义规则', publisher: 'DM', license: 'room-ephemeral',
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify({
        roomId: 'ROOM01', roomName: '测试房间', createdAt: 1,
        member: {
          memberId: 'member-1', roomToken: 'room-token', clientId: 'mobile-1', role: 'player',
          slot: 'player1', displayName: '玩家', accountId: 'account-1',
        },
        rules: {
          schemaVersion: 1, revision: 3, hash: 'rules-hash', requiredPlugins: [{
            id: 'custom.rules', version: '1.0.0', integrity: 'sha256-package', stateSchemaVersion: 1,
          }],
          member: { ready: false, missing: ['custom.rules'] },
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    await joinMobileRoom({
      serverUrl: 'https://example.test', account, roomId: 'room01', displayName: '玩家', clientId: 'mobile-1',
    })

    expect(requests).toHaveLength(2)
    expect(JSON.parse(String(requests[1].init?.body))).toMatchObject({ activePlugins: [] })
  })
})
