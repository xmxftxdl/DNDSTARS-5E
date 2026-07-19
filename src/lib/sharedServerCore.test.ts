/// <reference types="node" />
// 服务端硬化核心的纯函数单测。直接 import scripts/shared-server-core.mjs。
import { mkdtemp, readFile, rm, writeFile, readdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as sharedServerCore from '../../scripts/shared-server-core.mjs'
import {
  EVENT_BACKLOG_LIMIT,
  EVENT_CHANNEL_LIMIT,
  EVENT_REPLAY_LIMIT,
  IMAGE_COUNT_LIMIT,
  LockTimeoutError,
  ROOM_HOST_TTL_MS,
  ROOM_PLAYER_TTL_MS,
  assignRoomPlayer,
  capEventChannels,
  STATE_MAX_BYTES,
  SHARED_PROTOCOL_VERSION,
  atomicDeleteJsonStateCasLocked,
  atomicWriteImageLocked,
  atomicWriteJsonStateCasLocked,
  atomicWriteJsonStateFreshLocked,
  atomicWriteLocked,
  authorizeStateWrite,
  enforceImageQuota,
  extractSecret,
  migrateLegacyApCombatLogText,
  normalizeDedicatedDnd5eSharedState,
  normalizeLobbyRoomCode,
  normalizeAccountRecoveryCode,
  normalizeRoomPluginRequirements,
  pushBacklog,
  replaySlice,
  safeName,
  roomPluginReadiness,
  roomPlayerPresence,
  withWriteLock,
  validateSharedStateShape,
} from '../../scripts/shared-server-core.mjs'

describe('room lobby allocation', () => {
  const now = 1_000_000
  const baseRoom = () => ({
    id: 'ABC234',
    name: '测试战役',
    rulesetId: 'dnd5e-2014-srd-5.1',
    createdAt: now,
    host: { memberId: 'dm-member', clientId: 'dm-client', displayName: 'DM', lastSeenAt: now },
    players: [],
  })

  it('allows enough presence grace for background-tab timer throttling', () => {
    expect(ROOM_HOST_TTL_MS).toBeGreaterThanOrEqual(120_000)
    expect(ROOM_PLAYER_TTL_MS).toBeGreaterThanOrEqual(ROOM_HOST_TTL_MS * 2)
  })

  it('normalizes shareable six-character room codes', () => {
    expect(normalizeLobbyRoomCode(' ab-i0c234 ')).toBe('ABC234')
    expect(normalizeLobbyRoomCode('abc234')).toBe('ABC234')
  })

  it('pins room plugins by unique ID, version and SHA-256', () => {
    const requirement = {
      id: 'com.example.rules',
      version: '1.0.0',
      integrity: 'sha256-YWJjZA==',
      stateSchemaVersion: 1,
    }
    expect(normalizeRoomPluginRequirements([requirement])).toEqual([requirement])
    expect(normalizeRoomPluginRequirements([{ ...requirement }, { ...requirement }])).toBeNull()
    expect(normalizeRoomPluginRequirements([{ ...requirement, integrity: 'latest' }])).toBeNull()
    expect(roomPluginReadiness([requirement], [])).toMatchObject({ ready: false, missing: [requirement] })
    expect(roomPluginReadiness([requirement], [requirement])).toEqual({ ready: true, missing: [], mismatched: [] })
    expect(roomPluginReadiness([requirement], [{ ...requirement, version: '2.0.0' }]))
      .toMatchObject({ ready: false, mismatched: [requirement] })
  })

  it('assigns the first free player slot and resumes the same browser', () => {
    const first = assignRoomPlayer(baseRoom(), {
      memberId: 'member-1',
      clientId: 'client-1',
      displayName: '玩家甲',
    }, now)
    expect(first).toMatchObject({ ok: true, member: { slot: 'player1' } })
    if (!first.ok) throw new Error('expected first allocation')
    const resumed = assignRoomPlayer(first.next, {
      memberId: 'should-not-replace',
      clientId: 'client-1',
      displayName: '玩家甲（重连）',
    }, now + 1_000)
    expect(resumed).toMatchObject({
      ok: true,
      member: { memberId: 'member-1', slot: 'player1', displayName: '玩家甲（重连）' },
    })
  })

  it('resumes the same account from a different browser without changing member ownership', () => {
    const first = assignRoomPlayer(baseRoom(), {
      memberId: 'account-member', accountId: 'ABC234DEF567',
      clientId: 'device-one', displayName: '账号玩家',
    }, now)
    if (!first.ok) throw new Error('expected account allocation')
    const resumed = assignRoomPlayer(first.next, {
      memberId: 'new-random-member', accountId: 'ABC234DEF567',
      clientId: 'device-two', displayName: '账号玩家',
    }, now + 1_000)
    expect(resumed).toMatchObject({
      ok: true,
      member: { memberId: 'account-member', accountId: 'ABC234DEF567', clientId: 'device-two' },
    })
  })

  it('distinguishes temporary disconnection, explicit leave and removal', () => {
    const player = { lastSeenAt: now }
    expect(roomPlayerPresence(player, now)).toBe('online')
    expect(roomPlayerPresence(player, now + 30_000)).toBe('temporarily-offline')
    expect(roomPlayerPresence({ ...player, leftAt: now + 1 }, now + 2)).toBe('left')
    expect(roomPlayerPresence({ ...player, removedAt: now + 1 }, now + 2)).toBe('removed')
  })

  it('normalizes readable account recovery codes without exposing ambiguity characters', () => {
    expect(normalizeAccountRecoveryCode('DS5E-ABC234DEF567-ABCDE-FGHJK-LMNPQ-RSTUV')).toMatchObject({
      accountId: 'ABC234DEF567', secret: 'ABCDEFGHJKLMNPQRSTUV',
    })
    expect(normalizeAccountRecoveryCode('not-a-code')).toBeNull()
  })

  it('rejects joining when the creator heartbeat has expired', () => {
    const room = baseRoom()
    room.host.lastSeenAt = now - ROOM_HOST_TTL_MS - 1
    expect(assignRoomPlayer(room, {
      memberId: 'member-1',
      clientId: 'client-1',
      displayName: '玩家甲',
    }, now)).toMatchObject({ ok: false, error: 'room-offline' })
  })

  it('keeps a background-throttled creator joinable during the heartbeat grace window', () => {
    const room = baseRoom()
    room.host.lastSeenAt = now - ROOM_HOST_TTL_MS + 1
    expect(assignRoomPlayer(room, {
      memberId: 'member-1',
      clientId: 'client-1',
      displayName: '玩家甲',
    }, now)).toMatchObject({ ok: true, member: { slot: 'player1' } })
  })

  it('reclaims a stale player slot before allocation', () => {
    const room = {
      ...baseRoom(),
      players: [{
        memberId: 'stale-member',
        clientId: 'stale-client',
        displayName: '离线玩家',
        slot: 'player1',
        joinedAt: now - ROOM_PLAYER_TTL_MS - 10,
        lastSeenAt: now - ROOM_PLAYER_TTL_MS - 1,
      }],
    }
    const allocated = assignRoomPlayer(room, {
      memberId: 'new-member',
      clientId: 'new-client',
      displayName: '新玩家',
    }, now)
    expect(allocated).toMatchObject({ ok: true, member: { memberId: 'new-member', slot: 'player1' } })
    if (!allocated.ok) throw new Error('expected reclaimed slot allocation')
    expect((allocated.next.players as Array<{ memberId: string }>).map((player) => player.memberId))
      .toEqual(['stale-member', 'new-member'])

    const resumed = assignRoomPlayer(allocated.next, {
      memberId: 'stale-member',
      clientId: 'stale-client',
      displayName: '离线玩家（重连）',
    }, now + 1)
    expect(resumed).toMatchObject({
      ok: true,
      member: { memberId: 'stale-member', slot: 'player2', displayName: '离线玩家（重连）' },
    })
  })

  it('lets an explicitly locked room restore a known browser without opening a new seat', () => {
    const room = {
      ...baseRoom(),
      locked: true,
      players: [{
        memberId: 'known-member', clientId: 'known-client', displayName: '原玩家',
        slot: 'player1', joinedAt: now - 1_000, lastSeenAt: now - 1_000,
      }],
    }
    expect(assignRoomPlayer(room, {
      memberId: 'known-member', clientId: 'known-client', displayName: '原玩家',
    }, now)).toMatchObject({ ok: true, member: { memberId: 'known-member', slot: 'player1' } })
    expect(assignRoomPlayer(room, {
      memberId: 'new-member', clientId: 'new-client', displayName: '陌生玩家',
    }, now)).toMatchObject({ ok: false, error: 'room-locked' })
  })
})

describe('dedicated 5e shared-state migration', () => {
  it('removes AP wording from persisted combat logs at the server boundary', () => {
    expect(migrateLegacyApCombatLogText('新冒险者 花费 1 AP：移动（10 尺）。剩余 AP 1/2'))
      .toBe('新冒险者 移动（10 尺）。')
    expect(normalizeDedicatedDnd5eSharedState('combat-log', {
      mapId: 'map',
      entries: [{ id: 1, text: '战士 移动 10 尺，AP 1/2' }],
    })).toMatchObject({ entries: [{ text: '战士 移动 10 尺' }] })
  })

  it('removes the retired enemy AP ledger from shared combat snapshots', () => {
    expect(normalizeDedicatedDnd5eSharedState('combat', {
      active: true,
      enemyApByToken: { goblin: { current: 1, max: 2 } },
      dnd5eTurnEconomyByToken: {},
    })).toEqual({ active: true, dnd5eTurnEconomyByToken: {} })
  })
})

describe('P0 shared state boundary', () => {
  it('publishes a positive protocol version', () => {
    expect(SHARED_PROTOCOL_VERSION).toBeGreaterThanOrEqual(2)
  })

  it('rejects damaged known envelopes and accepts object plugin state', () => {
    expect(validateSharedStateShape('characters', { characters: [] })).toMatchObject({ ok: true })
    expect(validateSharedStateShape('spellbook', { spells: [] })).toMatchObject({ ok: true })
    expect(validateSharedStateShape('spellbook', { spells: 'broken' })).toMatchObject({ ok: false })
    expect(validateSharedStateShape('characters', { characters: 'broken' })).toMatchObject({ ok: false })
    expect(validateSharedStateShape('maps', [])).toMatchObject({ ok: false })
    expect(validateSharedStateShape('plugin-owned-state', { payload: {} })).toMatchObject({ ok: true })
  })

  it('rejects malformed or forged ActiveEffect schema v2 payloads at the server boundary', () => {
    const effect = {
      schemaVersion: 1,
      id: 'blind',
      definitionId: 'condition:blinded',
      label: '目盲',
      kind: 'condition',
      standardCondition: 'blinded',
      source: { kind: 'dm' },
      appliedAt: 1,
      duration: { type: 'permanent' },
      stackingKey: 'condition:blinded',
      stackingPolicy: 'refresh-duration',
    }
    expect(validateSharedStateShape('characters', {
      characters: [{ id: 'hero', conditions: ['blinded'], dnd5eCombatState: { schemaVersion: 2, activeEffects: [effect] } }],
    })).toEqual({ ok: true })
    expect(validateSharedStateShape('characters', {
      characters: [{ id: 'hero', conditions: [], dnd5eCombatState: { schemaVersion: 2, activeEffects: [effect] } }],
    })).toMatchObject({ ok: false, reason: 'condition-projection-mismatch' })
    expect(validateSharedStateShape('characters', {
      characters: [{ id: 'hero', conditions: ['blinded'], dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [{ ...effect, duration: { type: 'rounds', remainingRounds: 0, tickOn: 'target-turn-end' } }],
      } }],
    })).toMatchObject({ ok: false, reason: 'invalid-active-effect' })
  })
})

describe('P1 shared resource compare-and-swap', () => {
  it('allows exactly one writer for an expected revision and records generic sync metadata', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'stars-cas-'))
    const file = path.join(dir, 'maps.json')
    try {
      const initial = await atomicWriteJsonStateCasLocked(file, { maps: [], updatedAt: 1 }, {
        expectedRevision: 0,
        writerId: 'dm-a',
      })
      expect(initial).toMatchObject({ ok: true, revision: 1 })
      const writes = await Promise.all([
        atomicWriteJsonStateCasLocked(file, { maps: [{ id: 'a' }], updatedAt: 2 }, { expectedRevision: 1, writerId: 'dm-a' }),
        atomicWriteJsonStateCasLocked(file, { maps: [{ id: 'b' }], updatedAt: 3 }, { expectedRevision: 1, writerId: 'player-b' }),
      ])
      expect(writes.filter((result) => result.ok)).toHaveLength(1)
      expect(writes.filter((result) => !result.ok)).toEqual([
        expect.objectContaining({ conflict: true, currentRevision: 2 }),
      ])
      const stored = JSON.parse(await readFile(file, 'utf8'))
      expect(stored._sync).toMatchObject({ schemaVersion: 1, revision: 2 })
      const deleted = await atomicDeleteJsonStateCasLocked(file, { expectedRevision: 2, writerId: 'dm-a' })
      expect(deleted).toMatchObject({ ok: true, revision: 3, value: { _deleted: true } })
      expect(await atomicWriteJsonStateCasLocked(file, { maps: [], updatedAt: 4 }, {
        expectedRevision: 2,
        writerId: 'stale-client',
      })).toMatchObject({ ok: false, conflict: true, currentRevision: 3 })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

const securityHelpers = sharedServerCore as unknown as {
  authorizeAccessToken: (token: string | null) => { ok: boolean; role?: string; status?: number }
  consumeRateLimit: (
    buckets: Map<string, { startedAt: number; count: number }>,
    key: string,
    now?: number,
    limit?: number,
    windowMs?: number,
  ) => { ok: boolean; remaining?: number; retryAfterMs?: number }
  normalizeRoomId: (value?: string) => string
  roomScopedPath: (root: string, roomId: string) => string
}
const { authorizeAccessToken, consumeRateLimit, normalizeRoomId, roomScopedPath } = securityHelpers

describe('room isolation and access security', () => {
  const previousDmToken = process.env.STARS_DM_TOKEN
  const previousPlayerToken = process.env.STARS_PLAYER_TOKEN

  afterEach(() => {
    if (previousDmToken == null) delete process.env.STARS_DM_TOKEN
    else process.env.STARS_DM_TOKEN = previousDmToken
    if (previousPlayerToken == null) delete process.env.STARS_PLAYER_TOKEN
    else process.env.STARS_PLAYER_TOKEN = previousPlayerToken
  })

  it('keeps the default paths compatible and isolates named rooms', () => {
    expect(normalizeRoomId(undefined)).toBe('default')
    expect(roomScopedPath('C:/state', 'default')).toBe('C:/state')
    expect(roomScopedPath('C:/state', normalizeRoomId('table-a'))).toContain(path.join('rooms', 'table-a'))
    expect(normalizeRoomId('../table-a')).not.toContain('/')
  })

  it('enables role tokens only when configured', () => {
    delete process.env.STARS_DM_TOKEN
    delete process.env.STARS_PLAYER_TOKEN
    expect(authorizeAccessToken(null)).toMatchObject({ ok: true, role: 'open' })
    process.env.STARS_DM_TOKEN = 'dm-token'
    process.env.STARS_PLAYER_TOKEN = 'player-token'
    expect(authorizeAccessToken('dm-token')).toMatchObject({ ok: true, role: 'dm' })
    expect(authorizeAccessToken('player-token')).toMatchObject({ ok: true, role: 'player' })
    expect(authorizeAccessToken(null)).toMatchObject({ ok: false, status: 401 })
    expect(authorizeAccessToken('wrong')).toMatchObject({ ok: false, status: 403 })
  })

  it('limits each room and client bucket independently', () => {
    const buckets = new Map()
    expect(consumeRateLimit(buckets, 'room-a:client', 100, 2).ok).toBe(true)
    expect(consumeRateLimit(buckets, 'room-a:client', 101, 2).ok).toBe(true)
    expect(consumeRateLimit(buckets, 'room-a:client', 102, 2).ok).toBe(false)
    expect(consumeRateLimit(buckets, 'room-b:client', 102, 2).ok).toBe(true)
  })
})

const mutateCombatInterruptQueue = (
  sharedServerCore as unknown as {
    mutateCombatInterruptQueue: (queue: unknown, mutation: unknown, now?: number) => {
      ok: boolean
      status?: number
      error?: string
      changed?: boolean
      next: {
        revision: number
        interrupts: Array<{ id: string; status: string }>
      }
    }
  }
).mutateCombatInterruptQueue

describe('combat interrupt atomic mutation', () => {
  it('updates different interrupt ids without replacing the queue', () => {
    const queue = {
      mapId: 'map-1',
      revision: 2,
      updatedAt: 100,
      interrupts: [
        { id: 'a', mapId: 'map-1', kind: 'dodge', status: 'pending', payload: {}, createdAt: 1, updatedAt: 1 },
        { id: 'b', mapId: 'map-1', kind: 'stable-mind', status: 'pending', payload: {}, createdAt: 2, updatedAt: 2 },
      ],
    }
    const answered = mutateCombatInterruptQueue(queue, {
      operation: 'answer', mapId: 'map-1', id: 'a', response: { wantsDodge: true },
    }, 200)
    expect(answered.ok).toBe(true)
    expect(answered.next.revision).toBe(3)
    expect(answered.next.interrupts.find((item: { id: string }) => item.id === 'a')?.status).toBe('answered')
    expect(answered.next.interrupts.find((item: { id: string }) => item.id === 'b')?.status).toBe('pending')
  })

  it('rejects a backwards state transition and keeps repeats idempotent', () => {
    const queue = {
      mapId: 'map-1', revision: 1, updatedAt: 100,
      interrupts: [{ id: 'a', mapId: 'map-1', kind: 'dodge', status: 'answered', payload: {}, createdAt: 1, updatedAt: 2 }],
    }
    expect(mutateCombatInterruptQueue(queue, { operation: 'rolling', mapId: 'map-1', id: 'a' }, 200)).toMatchObject({
      ok: false, status: 409,
    })
    expect(mutateCombatInterruptQueue(queue, { operation: 'answer', mapId: 'map-1', id: 'a' }, 200)).toMatchObject({
      ok: true, changed: false,
    })
  })

  it('atomically rejects a second active interrupt for the same Headless transaction', () => {
    const queue = {
      mapId: 'map-1', revision: 1, updatedAt: 100,
      interrupts: [{
        id: 'shield', transactionId: 'action-1', mapId: 'map-1', kind: 'shield-spell',
        status: 'pending', phase: 'before-hit', timeoutPolicy: 'rollback', payload: {}, createdAt: 1, updatedAt: 1,
      }],
    }
    expect(mutateCombatInterruptQueue(queue, {
      operation: 'upsert', mapId: 'map-1', interrupt: {
        id: 'uncanny', transactionId: 'action-1', mapId: 'map-1', kind: 'uncanny-dodge',
        status: 'pending', phase: 'before-damage', timeoutPolicy: 'rollback', payload: {}, createdAt: 2, updatedAt: 2,
      },
    }, 200)).toMatchObject({ ok: false, status: 409, error: 'transaction-locked' })
  })
})

describe('safeName — AC5 防碰撞', () => {
  it('纯安全字符原样返回（无回归）', () => {
    expect(safeName('combat')).toBe('combat')
    expect(safeName('maps')).toBe('maps')
    expect(safeName('player-action-ack')).toBe('player-action-ack')
  })

  it('不同逻辑名不再折叠成同一文件名', () => {
    // 旧实现：'a/b' 与 'ab' 都 → 'ab'（碰撞）。新实现必不相等。
    expect(safeName('a/b')).not.toBe(safeName('ab'))
    expect(safeName('x.1')).not.toBe(safeName('x1'))
    expect(safeName('foo bar')).not.toBe(safeName('foobar'))
  })

  it('输出只含文件系统安全字符', () => {
    expect(safeName('a/b<>:c')).toMatch(/^[a-zA-Z0-9_-]+$/)
  })

  it('确定性：同输入同输出', () => {
    expect(safeName('a/b')).toBe(safeName('a/b'))
  })
})

describe('authorizeStateWrite — AC2 鉴权', () => {
  const prev = process.env.STARS_SHARED_SECRET
  afterEach(() => {
    if (prev == null) delete process.env.STARS_SHARED_SECRET
    else process.env.STARS_SHARED_SECRET = prev
  })

  it('(a) flag 未设 ⇒ 所有写放行（零回归锚点）', () => {
    delete process.env.STARS_SHARED_SECRET
    expect(authorizeStateWrite('combat', null).ok).toBe(true)
    expect(authorizeStateWrite('combat', 'whatever').ok).toBe(true)
    expect(authorizeStateWrite('characters', null).ok).toBe(true)
  })

  it('(b) flag 设 + 正确 secret + DM 资源 ⇒ 放行', () => {
    process.env.STARS_SHARED_SECRET = 's3cr3t'
    expect(authorizeStateWrite('combat', 's3cr3t').ok).toBe(true)
    expect(authorizeStateWrite('player-action-ack', 's3cr3t').ok).toBe(true)
  })

  it('(c) flag 设 + 缺/错 secret + DM 资源 ⇒ 401/403', () => {
    process.env.STARS_SHARED_SECRET = 's3cr3t'
    expect(authorizeStateWrite('combat', null)).toEqual({ ok: false, status: 401 })
    expect(authorizeStateWrite('combat', '')).toEqual({ ok: false, status: 401 })
    expect(authorizeStateWrite('combat', 'wrong')).toEqual({ ok: false, status: 403 })
  })

  it('(d) flag 设 + 玩家写白名单资源（无 secret）⇒ 仍放行', () => {
    process.env.STARS_SHARED_SECRET = 's3cr3t'
    for (const name of [
      'characters',
      'maps',
      'dodge',
      'gale-combo',
      'stable-mind',
      'player-action',
      'player-action-requests',
      'dice',
      'dice-events',
      'combat-log',
    ]) {
      expect(authorizeStateWrite(name, null).ok).toBe(true)
    }
  })

  it('extractSecret 从 x-stars-secret 头读取', () => {
    expect(extractSecret({ headers: { 'x-stars-secret': 'abc' } })).toBe('abc')
    expect(extractSecret({ headers: {} })).toBe(null)
  })
})

describe('backlog cap — AC3', () => {
  it('replaySlice 只取末尾 EVENT_REPLAY_LIMIT 条', () => {
    const backlog = Array.from({ length: 500 }, (_, i) => i)
    const slice = replaySlice(backlog)
    expect(slice.length).toBe(EVENT_REPLAY_LIMIT)
    expect(slice[slice.length - 1]).toBe(499)
    expect(EVENT_REPLAY_LIMIT).toBeLessThan(EVENT_BACKLOG_LIMIT)
  })

  it('短 backlog 全量返回', () => {
    expect(replaySlice([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('pushBacklog 维持总量 ≤ EVENT_BACKLOG_LIMIT', () => {
    let b: number[] = []
    for (let i = 0; i < EVENT_BACKLOG_LIMIT + 50; i += 1) b = pushBacklog(b, i)
    expect(b.length).toBe(EVENT_BACKLOG_LIMIT)
    expect(b[b.length - 1]).toBe(EVENT_BACKLOG_LIMIT + 49)
  })

  it('STATE_MAX_BYTES 是正数上限', () => {
    expect(STATE_MAX_BYTES).toBeGreaterThan(0)
  })
})

describe('capEventChannels — AC5 channel COUNT-CAP（T-P1-421）', () => {
  it('超过 limit 时按插入序淘汰最旧 channel（确定性）', () => {
    const m = new Map<string, number[]>()
    for (let i = 0; i < 5; i += 1) m.set(`ch${i}`, [i])
    const evicted = capEventChannels(m, 3)
    expect(evicted).toEqual(['ch0', 'ch1'])
    expect([...m.keys()]).toEqual(['ch2', 'ch3', 'ch4'])
  })

  it('未超 limit 不淘汰任何 channel', () => {
    const m = new Map<string, number[]>([['a', [1]], ['b', [2]]])
    expect(capEventChannels(m, 8)).toEqual([])
    expect(m.size).toBe(2)
  })

  it('受保护（活跃订阅）channel 永不被淘汰（会话中途不清活跃）', () => {
    const m = new Map<string, number[]>()
    for (let i = 0; i < 5; i += 1) m.set(`ch${i}`, [i])
    // ch0 是最旧但活跃 → 跳过它，淘汰次旧的 ch1/ch2。
    const evicted = capEventChannels(m, 3, new Set(['ch0']))
    expect(evicted).toEqual(['ch1', 'ch2'])
    expect(m.has('ch0')).toBe(true)
    expect(m.size).toBe(3)
  })

  it('EVENT_CHANNEL_LIMIT 是正数且 < backlog 总量上限', () => {
    expect(EVENT_CHANNEL_LIMIT).toBeGreaterThan(0)
    expect(EVENT_CHANNEL_LIMIT).toBeLessThanOrEqual(EVENT_BACKLOG_LIMIT)
  })
})

describe('withWriteLock / atomicWriteLocked — AC1 锁', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stars-lock-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('两个快速并发写都落地（不丢更新、不交错）', async () => {
    const file = path.join(dir, 'state.json')
    await Promise.all([
      atomicWriteLocked(file, Buffer.from(JSON.stringify({ v: 1 }))),
      atomicWriteLocked(file, Buffer.from(JSON.stringify({ v: 2 }))),
    ])
    const final = JSON.parse(await readFile(file, 'utf8'))
    // 最终内容是某个完整写（1 或 2），绝非半个文件交错。
    expect([1, 2]).toContain(final.v)
    // 锁文件已释放。
    await expect(stat(`${file}.lock`)).rejects.toBeTruthy()
  })

  it('串行化：N 个并发 increment 不丢更新', async () => {
    const file = path.join(dir, 'counter.json')
    await writeFile(file, JSON.stringify({ n: 0 }))
    const bump = () =>
      withWriteLock(file, async () => {
        const cur = JSON.parse(await readFile(file, 'utf8'))
        await writeFile(file, JSON.stringify({ n: cur.n + 1 }))
      })
    await Promise.all(Array.from({ length: 20 }, bump))
    const final = JSON.parse(await readFile(file, 'utf8'))
    expect(final.n).toBe(20)
  })

  it('fn 抛错也释放锁（不死锁）', async () => {
    const file = path.join(dir, 'err.json')
    await expect(
      withWriteLock(file, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    await expect(stat(`${file}.lock`)).rejects.toBeTruthy()
    // 锁已释放，后续写正常。
    await atomicWriteLocked(file, Buffer.from('{"ok":1}'))
    expect(JSON.parse(await readFile(file, 'utf8')).ok).toBe(1)
  })

  it('does not let an older updatedAt state overwrite a newer one', async () => {
    const file = path.join(dir, 'fresh-state.json')
    await atomicWriteJsonStateFreshLocked(file, Buffer.from(JSON.stringify({ updatedAt: 20, value: 'new' })))
    const accepted = await atomicWriteJsonStateFreshLocked(
      file,
      Buffer.from(JSON.stringify({ updatedAt: 10, value: 'old' })),
    )
    expect(accepted).toBe(false)
    expect(JSON.parse(await readFile(file, 'utf8')).value).toBe('new')
  })

  // 抢锁超时 ⇒ fail-closed：抛 LockTimeoutError(503)，fn 绝不无锁运行。
  it('AC1 — lock-acquire timeout fails CLOSED (throws, fn never runs)', async () => {
    const file = path.join(dir, 'busy.json')
    // 手动占住一把「非陈旧」的锁（刚创建，mtime 新鲜）。
    await writeFile(`${file}.lock`, 'held-by-other', { flag: 'wx' })
    process.env.STARS_LOCK_WAIT_MAX_MS = '120'
    let ran = false
    try {
      await expect(
        withWriteLock(file, async () => {
          ran = true
        }),
      ).rejects.toMatchObject({ name: 'LockTimeoutError', code: 'ELOCKTIMEOUT', statusCode: 503 })
      expect(ran).toBe(false)
      // 占用的锁未被错误删除（我们没持有它）。
      await expect(stat(`${file}.lock`)).resolves.toBeTruthy()
      expect(new LockTimeoutError('x').statusCode).toBe(503)
    } finally {
      delete process.env.STARS_LOCK_WAIT_MAX_MS
      await rm(`${file}.lock`, { force: true })
    }
  })

  // 持锁期间心跳刷新 lockfile mtime ⇒ 合法慢写不会因 mtime 老化被判陈旧而被抢占。
  it('AC2 — the held lock mtime is heartbeated while a slow write runs', async () => {
    process.env.STARS_LOCK_HEARTBEAT_MS = '40'
    process.env.STARS_LOCK_STALE_MS = '120'
    const file = path.join(dir, 'slow.json')
    let mtimeAtStart = 0
    let mtimeLate = 0
    try {
      await withWriteLock(file, async () => {
        mtimeAtStart = (await stat(`${file}.lock`)).mtimeMs
        // 持锁 200ms（> staleMs 120ms）；若无心跳，第二进程会判定陈旧并抢占。
        await new Promise((r) => setTimeout(r, 200))
        mtimeLate = (await stat(`${file}.lock`)).mtimeMs
      })
      // 心跳已把 mtime 推进（持锁期间始终「新鲜」）。
      expect(mtimeLate).toBeGreaterThan(mtimeAtStart)
    } finally {
      delete process.env.STARS_LOCK_HEARTBEAT_MS
      delete process.env.STARS_LOCK_STALE_MS
    }
  })

  // 图片写：blob+meta 在同一把锁内各自 temp+rename 原子落盘。
  it('AC3 — atomicWriteImageLocked writes blob + meta atomically and releases the lock', async () => {
    const imgPath = path.join(dir, 'img-xyz')
    const metaPath = `${imgPath}.json`
    await atomicWriteImageLocked(
      imgPath,
      metaPath,
      Buffer.from([1, 2, 3, 4]),
      JSON.stringify({ type: 'image/png' }),
    )
    expect([...(await readFile(imgPath))]).toEqual([1, 2, 3, 4])
    expect(JSON.parse(await readFile(metaPath, 'utf8')).type).toBe('image/png')
    await expect(stat(`${imgPath}.lock`)).rejects.toBeTruthy()
  })
})

describe('enforceImageQuota — AC4 配额', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stars-img-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('超过 IMAGE_COUNT_LIMIT 时按最旧优先 GC', async () => {
    const total = IMAGE_COUNT_LIMIT + 5
    for (let i = 0; i < total; i += 1) {
      const name = `img${String(i).padStart(3, '0')}`
      await writeFile(path.join(dir, name), Buffer.from(`data${i}`))
      await writeFile(path.join(dir, `${name}.json`), JSON.stringify({ type: 'image/png' }))
      // 强制 mtime 递增，确保 i 越小越旧。
      const t = new Date(Date.now() + i * 10)
      const { utimes } = await import('node:fs/promises')
      await utimes(path.join(dir, name), t, t)
    }
    const removed = await enforceImageQuota(dir)
    expect(removed.length).toBe(5)
    const remaining = (await readdir(dir)).filter((n) => !n.endsWith('.json'))
    expect(remaining.length).toBe(IMAGE_COUNT_LIMIT)
    // 最旧的 5 张（img000..img004）被删。
    expect(removed.sort()).toEqual(['img000', 'img001', 'img002', 'img003', 'img004'])
  })

  it('未超配额不删任何图片', async () => {
    await writeFile(path.join(dir, 'only'), Buffer.from('x'))
    await writeFile(path.join(dir, 'only.json'), '{}')
    expect(await enforceImageQuota(dir)).toEqual([])
  })
})
