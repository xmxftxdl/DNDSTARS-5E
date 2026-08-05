/// <reference types="node" />
// 端到端回归：真正起 static-server.mjs 子进程，over HTTP 验证。
// 强制要求：玩家 PUT 在 flag OFF 与 flag ON 两种状态下都成功。
// 另验：DM 权威资源 combat 的鉴权三分支、未匹配 /api/* → 404、超大 PUT → 413、并发写锁。
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash, createHmac } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repoRoot = path.resolve(__dirname, '..', '..')
const serverScript = path.join(repoRoot, 'scripts', 'static-server.mjs')
const HOST = '127.0.0.1'
const SECRET = 'test-secret-not-committed'

interface Running {
  proc: ChildProcess
  base: string
  sharedRoot: string
}

async function startServer(
  port: number,
  extraEnv: Record<string, string>,
  existingSharedRoot?: string,
): Promise<Running> {
  const sharedRoot = existingSharedRoot ?? await mkdtemp(path.join(os.tmpdir(), 'stars-http-'))
  const distRoot = path.join(sharedRoot, 'dist')
  await mkdir(distRoot, { recursive: true })
  await writeFile(path.join(distRoot, 'index.html'), '<!doctype html><title>stars</title>')
  await writeFile(path.join(distRoot, 'worker.mjs'), 'export const ready = true\n')
  const proc = spawn(
    process.execPath,
    [serverScript, '--host', HOST, '--port', String(port), '--root', distRoot],
    {
      env: { ...process.env, STARS_SHARED_ROOT: sharedRoot, ...extraEnv },
      stdio: 'ignore',
    },
  )
  const base = `http://${HOST}:${port}`
  const deadline = Date.now() + 8000
  for (;;) {
    try {
      await fetch(`${base}/api/state/__probe__`)
      break
    } catch {
      if (Date.now() > deadline) throw new Error('static-server did not start in time')
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  return { proc, base, sharedRoot }
}

async function stopServer(r: Running, removeRoot = true): Promise<void> {
  const exited = new Promise<void>((resolve) => r.proc.once('exit', () => resolve()))
  r.proc.kill('SIGTERM')
  await Promise.race([
    exited,
    new Promise<void>((resolve) => setTimeout(resolve, 3_000)),
  ])
  if (removeRoot) await rm(r.sharedRoot, { recursive: true, force: true }).catch(() => {})
}

function putState(base: string, name: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}/api/state/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

let offServer: Running
let onServer: Running

beforeAll(async () => {
  // flag OFF：不带 STARS_SHARED_SECRET（必须显式从 env 里剔除，否则继承外层）。
  const offEnv = { ...process.env }
  delete offEnv.STARS_SHARED_SECRET
  offServer = await startServer(5392, {
    STARS_SHARED_SECRET: '',
    STARS_MARKETPLACE_PAYMENT_WEBHOOK_SECRET: 'test-marketplace-payment-secret',
    STARS_PLUGIN_ADMIN_ACCOUNT_IDS: '*',
  })
  onServer = await startServer(5393, { STARS_SHARED_SECRET: SECRET })
}, 30000)

afterAll(async () => {
  if (offServer) await stopServer(offServer)
  if (onServer) await stopServer(onServer)
})

describe('AC7 — 玩家 PUT 在两种 flag 状态都成功', () => {
  it('flag OFF：玩家写 characters ⇒ 200', async () => {
    const res = await putState(offServer.base, 'characters', { characters: [], updatedAt: Date.now() })
    expect(res.status).toBe(200)
  })

  it('flag OFF：DM combat（无 secret）⇒ 200（鉴权关闭，零回归）', async () => {
    const res = await putState(offServer.base, 'combat', { active: false })
    expect(res.status).toBe(200)
  })

  it('flag ON：玩家写 characters（无 secret）⇒ 200（白名单保留）', async () => {
    const res = await putState(onServer.base, 'characters', { characters: [], updatedAt: Date.now() })
    expect(res.status).toBe(200)
  })

  it('flag ON：玩家不能直接写 DM 权威 maps', async () => {
    const res = await putState(onServer.base, 'maps', { maps: [], updatedAt: Date.now() })
    expect(res.status).toBe(401)
  })
})

describe('静态模块资源', () => {
  it('以 JavaScript MIME 返回 .mjs Worker，避免 nosniff 拒绝动态导入', async () => {
    const response = await fetch(`${offServer.base}/worker.mjs`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expect(await response.text()).toContain('export const ready')
  })
})

describe('DM 权威撤销事务', () => {
  it('可撤销怪物移动，并在重复撤销时安全拒绝', async () => {
    const createResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: '撤销事务测试',
        displayName: '撤销 DM',
        rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'dm-undo-test-client',
        activePlugins: [],
      }),
    })
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json() as {
      roomId: string
      member: { memberId: string; roomToken: string }
    }
    const query = `?room=${created.roomId}`
    const memberHeaders = {
      'X-Stars-Protocol': '5',
      'X-Stars-Member': created.member.memberId,
      'X-Stars-Room-Token': created.member.roomToken,
    }
    const mapAt = (x: number, updatedAt: number) => ({
      maps: [{
        id: 'map-undo',
        name: '撤销地图',
        image: '',
        width: 100,
        height: 100,
        gridSize: 50,
        tokens: [{
          id: 'goblin-token',
          type: 'enemy',
          label: '地精',
          x,
          y: 0,
          size: 1,
          currentHp: 7,
          maxHp: 7,
        }],
      }],
      selectedId: 'map-undo',
      updatedAt,
    })

    const initial = await fetch(`${offServer.base}/api/state/maps${query}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Expected-Revision': '0',
        'X-Stars-Undo-Group': 'setup:test-map',
        ...memberHeaders,
      },
      body: JSON.stringify(mapAt(0, 100)),
    })
    expect(initial.status).toBe(200)
    const moved = await fetch(`${offServer.base}/api/state/maps${query}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Expected-Revision': '1',
        'X-Stars-Undo-Group': 'monster-move:test',
        'X-Stars-Undo-Label': encodeURIComponent('移动地精'),
        ...memberHeaders,
      },
      body: JSON.stringify(mapAt(50, 200)),
    })
    expect(moved.status).toBe(200)
    const movedAgain = await fetch(`${offServer.base}/api/state/maps${query}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Expected-Revision': '2',
        'X-Stars-Undo-Group': 'monster-move:test-2',
        'X-Stars-Undo-Label': encodeURIComponent('再次移动地精'),
        ...memberHeaders,
      },
      body: JSON.stringify(mapAt(75, 300)),
    })
    expect(movedAgain.status).toBe(200)

    const undo = await fetch(`${offServer.base}/api/dm/undo${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...memberHeaders },
      body: JSON.stringify({ transactionId: 'monster-move:test-2' }),
    })
    expect(undo.status).toBe(200)
    await expect(undo.json()).resolves.toMatchObject({
      ok: true,
      transaction: { status: 'undone', label: '再次移动地精', resources: ['maps'] },
    })
    const restored = await (await fetch(
      `${offServer.base}/api/state/maps${query}`,
      { headers: memberHeaders },
    )).json() as { maps: Array<{ tokens: Array<{ x: number }> }> }
    expect(restored.maps[0].tokens[0].x).toBe(50)

    const undoPrevious = await fetch(`${offServer.base}/api/dm/undo${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...memberHeaders },
      body: JSON.stringify({ transactionId: 'monster-move:test' }),
    })
    expect(undoPrevious.status).toBe(200)
    const restoredPrevious = await (await fetch(
      `${offServer.base}/api/state/maps${query}`,
      { headers: memberHeaders },
    )).json() as { maps: Array<{ tokens: Array<{ x: number }> }> }
    expect(restoredPrevious.maps[0].tokens[0].x).toBe(0)

    const repeated = await fetch(`${offServer.base}/api/dm/undo${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...memberHeaders },
      body: JSON.stringify({ transactionId: 'monster-move:test-2' }),
    })
    expect(repeated.status).toBe(404)
  })
})

describe('production same-origin and room authentication boundary', () => {
  let server: Running

  beforeAll(async () => {
    server = await startServer(5394, {
      STARS_SECURITY_MODE: 'production',
      STARS_PUBLIC_ORIGIN: 'http://127.0.0.1:5394',
      STARS_ALLOWED_ORIGINS: '',
      STARS_ALLOW_LEGACY_ACCOUNT_CREATION: 'true',
    })
  }, 30000)

  afterAll(async () => {
    if (server) await stopServer(server)
  })

  it('adds browser security headers and rejects foreign origins', async () => {
    const page = await fetch(`${server.base}/`)
    expect(page.status).toBe(200)
    expect(page.headers.get('content-security-policy')).toContain("connect-src 'self'")
    expect(page.headers.get('x-content-type-options')).toBe('nosniff')

    const accepted = await fetch(`${server.base}/api/meta`, {
      headers: { Origin: server.base },
    })
    expect(accepted.status).toBe(200)
    expect(accepted.headers.get('access-control-allow-origin')).toBe(server.base)

    const rejected = await fetch(`${server.base}/api/meta`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    })
    expect(rejected.status).toBe(403)
    await expect(rejected.json()).resolves.toMatchObject({ error: 'origin-not-allowed' })
  })

  it('blocks the legacy default room and requires an account before room creation', async () => {
    const legacy = await fetch(`${server.base}/api/state/maps`)
    expect(legacy.status).toBe(403)
    await expect(legacy.json()).resolves.toMatchObject({ error: 'room-session-required' })

    const unauthenticated = await fetch(`${server.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: 'production-room',
        displayName: 'DM',
        rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'production-dm-client',
        activePlugins: [],
      }),
    })
    expect(unauthenticated.status).toBe(401)
  })

  it('authorizes room-scoped state with account and room bearer credentials', async () => {
    const accountResponse = await fetch(`${server.base}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'DM', clientId: 'production-dm-client' }),
    })
    expect(accountResponse.status).toBe(201)
    const account = await accountResponse.json() as {
      session: { sessionToken: string }
    }

    const roomResponse = await fetch(`${server.base}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Account-Token': account.session.sessionToken,
      },
      body: JSON.stringify({
        roomName: 'production-room',
        displayName: 'DM',
        rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'production-dm-client',
        activePlugins: [],
      }),
    })
    expect(roomResponse.status).toBe(201)
    const room = await roomResponse.json() as {
      roomId: string
      member: { memberId: string; roomToken: string }
    }
    const query = `?room=${room.roomId}`
    const headers = {
      'X-Stars-Member': room.member.memberId,
      'X-Stars-Room-Token': room.member.roomToken,
    }
    expect((await fetch(`${server.base}/api/state/maps${query}`, { headers })).status).toBe(404)
    expect((await fetch(`${server.base}/api/state/maps${query}`)).status).toBe(403)
  })
})

describe('production account registration fail-closed boundary', () => {
  let server: Running

  beforeAll(async () => {
    server = await startServer(5395, {
      STARS_SECURITY_MODE: 'production',
      STARS_PUBLIC_ORIGIN: 'http://127.0.0.1:5395',
      STARS_ALLOWED_ORIGINS: '',
      STARS_ALLOW_LEGACY_ACCOUNT_CREATION: 'false',
      STARS_EMAIL_VERIFICATION_WEBHOOK_URL: '',
      STARS_SMS_VERIFICATION_WEBHOOK_URL: '',
      STARS_TENCENTCLOUD_EDITION: '',
      STARS_TENCENTCLOUD_SECRET_ID: '',
      STARS_TENCENTCLOUD_SECRET_KEY: '',
    })
  }, 30000)

  afterAll(async () => {
    if (server) await stopServer(server)
  })

  it('disables unverified legacy creation and unavailable verification channels', async () => {
    expect(await (await fetch(`${server.base}/api/accounts/auth/config`)).json()).toMatchObject({
      channels: { email: false, phone: false },
      developmentDelivery: false,
    })
    const legacy = await fetch(`${server.base}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'bypass', clientId: 'legacy-bypass-client' }),
    })
    expect(legacy.status).toBe(410)
    const verification = await fetch(`${server.base}/api/accounts/auth/verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'email', destination: 'user@example.com' }),
    })
    expect(verification.status).toBe(503)
  })
})

describe('production Tencent Cloud account registration capability', () => {
  let server: Running

  beforeAll(async () => {
    server = await startServer(5396, {
      STARS_SECURITY_MODE: 'production',
      STARS_PUBLIC_ORIGIN: 'http://127.0.0.1:5396',
      STARS_ALLOWED_ORIGINS: '',
      STARS_TENCENTCLOUD_EDITION: 'international',
      STARS_TENCENTCLOUD_SECRET_ID: 'AKIDINTEGRATIONTEST',
      STARS_TENCENTCLOUD_SECRET_KEY: 'integration-test-secret-key',
      STARS_TENCENT_SES_FROM_EMAIL: 'Astral Trace <no-reply@mail.astraltracevtt.com>',
      STARS_TENCENT_SES_TEMPLATE_ID: '10001',
      STARS_TENCENT_SMS_SDK_APP_ID: '',
      STARS_TENCENT_SMS_TEMPLATE_ID: '',
    })
  }, 30000)

  afterAll(async () => {
    if (server) await stopServer(server)
  })

  it('只开放配置完整的腾讯云验证码渠道', async () => {
    const response = await fetch(`${server.base}/api/accounts/auth/config`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      channels: { email: true, phone: false },
      developmentDelivery: false,
    })
  })
})

describe('观战席位与地图桌面事件权限', () => {
  it('观战不占玩家槽位，并在服务端禁止一切共享写入', async () => {
    const createdResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: '地图桌面测试', displayName: 'DM', rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'tabletop-dm-client', activePlugins: [], maxPlayers: 1,
      }),
    })
    const created = await createdResponse.json() as { roomId: string; member: { memberId: string; roomToken: string } }
    const join = async (body: Record<string, unknown>) => {
      const response = await fetch(`${offServer.base}/api/rooms/${created.roomId}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      return { response, body: await response.json() as { member: { memberId: string; roomToken: string; role: string; slot?: string } } }
    }
    const spectator = await join({
      displayName: '观战者', clientId: 'tabletop-spectator-client', activePlugins: [], role: 'spectator',
    })
    expect(spectator.response.status).toBe(200)
    expect(spectator.body.member).toMatchObject({ role: 'spectator' })
    expect(spectator.body.member.slot).toBeUndefined()
    const player = await join({ displayName: '玩家', clientId: 'tabletop-player-client', activePlugins: [] })
    expect(player.body.member).toMatchObject({ role: 'player', slot: 'player1' })
    const preview = await fetch(`${offServer.base}/api/rooms/${created.roomId}/preview`).then((response) => response.json()) as {
      playerCount: number
      spectatorCount: number
    }
    expect(preview).toMatchObject({ playerCount: 1, spectatorCount: 1 })

    const roomQuery = `room=${created.roomId}`
    const protocol = { 'Content-Type': 'application/json', 'X-Stars-Protocol': '5' }
    const spectatorWrite = await fetch(`${offServer.base}/api/state/characters?${roomQuery}`, {
      method: 'PUT',
      headers: { ...protocol, 'X-Stars-Member': spectator.body.member.memberId, 'X-Stars-Room-Token': spectator.body.member.roomToken },
      body: JSON.stringify({ characters: [], updatedAt: Date.now() }),
    })
    expect(spectatorWrite.status).toBe(403)

    const eventUrl = `${offServer.base}/api/events/map-tabletop?${roomQuery}`
    const playerPing = await fetch(eventUrl, {
      method: 'POST', headers: { ...protocol, 'X-Stars-Member': player.body.member.memberId, 'X-Stars-Room-Token': player.body.member.roomToken },
      body: JSON.stringify({ type: 'ping', mapId: 'map-1', point: { x: 10, y: 20 } }),
    })
    expect(playerPing.status).toBe(200)
    const playerFocus = await fetch(eventUrl, {
      method: 'POST', headers: { ...protocol, 'X-Stars-Member': player.body.member.memberId, 'X-Stars-Room-Token': player.body.member.roomToken },
      body: JSON.stringify({ type: 'focus', mapId: 'map-1', point: { x: 10, y: 20 } }),
    })
    expect(playerFocus.status).toBe(403)
    const dmFocus = await fetch(eventUrl, {
      method: 'POST', headers: { ...protocol, 'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken },
      body: JSON.stringify({ type: 'focus', mapId: 'map-1', point: { x: 10, y: 20 } }),
    })
    expect(dmFocus.status).toBe(200)
  })
})

describe('地图几何的房间权限与安全投影', () => {
  it('只允许 DM 写地图，并在 HTTP 响应前移除玩家不可见 Token 和暗门元数据', async () => {
    const createdResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: '几何安全测试', displayName: '地图 DM', rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'geometry-dm-client', activePlugins: [],
      }),
    })
    expect(createdResponse.status).toBe(201)
    const created = await createdResponse.json() as { roomId: string; member: { memberId: string; roomToken: string } }
    const joinedResponse = await fetch(`${offServer.base}/api/rooms/${created.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '侦察者', clientId: 'geometry-player-client', activePlugins: [] }),
    })
    expect(joinedResponse.status).toBe(200)
    const joined = await joinedResponse.json() as { member: { memberId: string; roomToken: string } }
    const stateUrl = (name: string) => `${offServer.base}/api/state/${name}?room=${created.roomId}`
    const common = {
      label: '石制结构', blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }
    const geometry = {
      schemaVersion: 1, updatedAt: 1,
      maps: [{
        mapId: 'secure-map',
        walls: [{ ...common, id: 'wall', kind: 'wall', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] }],
        doors: [{
          ...common, id: 'secret-door', kind: 'door',
          points: [{ x: 10, y: 70 }, { x: 30, y: 70 }], state: 'locked', secret: true,
        }],
        obstacles: [],
        vision: { enabled: true, defaultRangeFeet: 60, sharePartyVision: true }, updatedAt: 1,
      }],
    }
    const maps = {
      selectedId: 'secure-map', updatedAt: 1,
      maps: [{
        id: 'secure-map', width: 100, height: 100, gridSize: 10, feetPerCell: 5,
        tokens: [
          { id: 'hero', type: 'player', characterId: 'hero-character', x: 10, y: 20 },
          { id: 'seen', type: 'enemy', x: 30, y: 20 },
          { id: 'hidden', type: 'enemy', x: 90, y: 20 },
        ],
      }],
    }
    const dmHeaders = {
      'Content-Type': 'application/json', 'X-Stars-Protocol': '5', 'X-Stars-Expected-Revision': '0',
      'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken,
    }
    expect((await fetch(stateUrl('map-geometry'), {
      method: 'PUT', headers: dmHeaders, body: JSON.stringify(geometry),
    })).status).toBe(200)
    expect((await fetch(stateUrl('maps'), {
      method: 'PUT', headers: dmHeaders, body: JSON.stringify(maps),
    })).status).toBe(200)
    expect((await fetch(stateUrl('maps'))).status).toBe(403)

    const playerHeaders = { 'X-Stars-Member': joined.member.memberId, 'X-Stars-Room-Token': joined.member.roomToken }
    expect((await fetch(stateUrl('maps'), {
      method: 'PUT', headers: { ...playerHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(maps),
    })).status).toBe(403)
    const playerMapsResponse = await fetch(stateUrl('maps'), { headers: playerHeaders })
    expect(playerMapsResponse.status).toBe(200)
    const playerMaps = await playerMapsResponse.json() as { maps: Array<{ tokens: Array<{ id: string }> }> }
    expect(playerMaps.maps[0].tokens.map((token) => token.id)).toEqual(['hero', 'seen'])

    const playerGeometryResponse = await fetch(stateUrl('map-geometry'), { headers: playerHeaders })
    expect(playerGeometryResponse.status).toBe(200)
    const playerGeometryText = await playerGeometryResponse.text()
    expect(playerGeometryText).not.toContain('"kind":"door"')
    expect(playerGeometryText).not.toContain('secret-door')
    expect(playerGeometryText).toContain('"kind":"wall"')

    const dmMaps = await (await fetch(stateUrl('maps'), {
      headers: { 'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken },
    })).json() as { maps: Array<{ tokens: Array<{ id: string }> }> }
    expect(dmMaps.maps[0].tokens.map((token) => token.id)).toEqual(['hero', 'seen', 'hidden'])
  })
})

describe('账号恢复与账号角色库协议', () => {
  it('可跨设备恢复账号、读取非房间绑定角色，并恢复同一房间成员', async () => {
    const createAccount = async (displayName: string, clientId: string) => {
      const response = await fetch(`${offServer.base}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, clientId }),
      })
      expect(response.status).toBe(201)
      return response.json() as Promise<{
        recoveryCode: string
        session: { accountId: string; sessionToken: string; displayName: string }
      }>
    }

    const dm = await createAccount('账号 DM', 'account-dm-client-1')
    const player = await createAccount('账号玩家', 'account-player-client-1')
    const roomResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Stars-Account-Token': dm.session.sessionToken },
      body: JSON.stringify({
        roomName: '账号恢复测试', displayName: '账号 DM', rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'account-dm-client-1', accountId: dm.session.accountId, activePlugins: [],
      }),
    })
    expect(roomResponse.status).toBe(201)
    const room = await roomResponse.json() as { roomId: string; member: { memberId: string; roomToken: string } }

    const joinResponse = await fetch(`${offServer.base}/api/rooms/${room.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Stars-Account-Token': player.session.sessionToken },
      body: JSON.stringify({
        displayName: '账号玩家', clientId: 'account-player-client-1', accountId: player.session.accountId,
        activePlugins: [],
      }),
    })
    expect(joinResponse.status).toBe(200)
    const joined = await joinResponse.json() as { member: { memberId: string; roomToken: string } }

    const character = {
      id: 'cloud-character-1', name: '云端勇士', rulesetId: 'dnd5e-2014-srd-5.1',
      roomId: room.roomId, roomMemberId: joined.member.memberId,
    }
    const saveCharacter = await fetch(`${offServer.base}/api/accounts/me/characters/${character.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Stars-Account-Token': player.session.sessionToken },
      body: JSON.stringify({
        id: character.id,
        name: character.name,
        character,
        compatibility: {
          rulesetId: 'dnd5e-2014-srd-5.1', characterSchemaVersion: 1,
          minimumGameProtocolVersion: 3, lastSavedGameProtocolVersion: 3, requiredPlugins: [],
        },
      }),
    })
    expect(saveCharacter.status).toBe(200)
    expect(await saveCharacter.json()).toMatchObject({
      character: { id: character.id, ownerAccountId: player.session.accountId },
    })

    const leave = await fetch(`${offServer.base}/api/rooms/${room.roomId}/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'X-Stars-Account-Token': player.session.sessionToken,
        'X-Stars-Member': joined.member.memberId, 'X-Stars-Room-Token': joined.member.roomToken,
      },
      body: JSON.stringify({ memberId: joined.member.memberId }),
    })
    expect(leave.status).toBe(200)

    const recoveredResponse = await fetch(`${offServer.base}/api/accounts/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryCode: player.recoveryCode, clientId: 'account-player-device-2' }),
    })
    expect(recoveredResponse.status).toBe(200)
    const recovered = await recoveredResponse.json() as { session: { accountId: string; sessionToken: string } }
    expect(recovered.session.accountId).toBe(player.session.accountId)

    const vaultResponse = await fetch(`${offServer.base}/api/accounts/me/characters`, {
      headers: { 'X-Stars-Account-Token': recovered.session.sessionToken },
    })
    expect(vaultResponse.status).toBe(200)
    const vault = await vaultResponse.json() as { characters: Array<{ id: string; character: Record<string, unknown> }> }
    expect(vault.characters[0]?.id).toBe(character.id)
    expect(vault.characters[0]?.character).not.toHaveProperty('roomId')
    expect(vault.characters[0]?.character).not.toHaveProperty('roomMemberId')

    const rejoinResponse = await fetch(`${offServer.base}/api/rooms/${room.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Stars-Account-Token': recovered.session.sessionToken },
      body: JSON.stringify({
        displayName: '账号玩家', clientId: 'account-player-device-2', accountId: recovered.session.accountId,
        activePlugins: [],
      }),
    })
    expect(rejoinResponse.status).toBe(200)
    expect(await rejoinResponse.json()).toMatchObject({ member: { memberId: joined.member.memberId, role: 'player' } })
  })
})

describe('账号级战役与临时房间协议', () => {
  it('让同一战役跨多次房间继续读取共享状态，并拒绝并行开房', async () => {
    const accountResponse = await fetch(`${offServer.base}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '长期战役 DM', clientId: 'campaign-owner-client' }),
    })
    expect(accountResponse.status).toBe(201)
    const account = await accountResponse.json() as {
      session: { accountId: string; sessionToken: string }
    }
    const accountHeaders = {
      'Content-Type': 'application/json',
      'X-Stars-Account-Token': account.session.sessionToken,
    }

    const createCampaignResponse = await fetch(`${offServer.base}/api/accounts/me/campaigns`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        name: '跨房间测试战役',
        description: '地图与角色状态应归战役长期保存。',
        rulesetId: 'dnd5e-2014-srd-5.1',
      }),
    })
    expect(createCampaignResponse.status).toBe(201)
    const campaign = await createCampaignResponse.json() as { campaignId: string; roomCount: number }
    expect(campaign.campaignId).toMatch(/^[A-HJ-NP-Z2-9]{12}$/)
    expect(campaign.roomCount).toBe(0)

    const forgedBinding = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: accountHeaders,
      body: JSON.stringify({
        campaignId: campaign.campaignId,
        roomName: '绕过战役入口',
        displayName: '长期战役 DM',
        rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'campaign-owner-client',
        activePlugins: [],
      }),
    })
    expect(forgedBinding.status).toBe(400)
    await expect(forgedBinding.json()).resolves.toMatchObject({ error: 'campaign-room-launch-required' })

    const launch = () => fetch(
      `${offServer.base}/api/accounts/me/campaigns/${campaign.campaignId}/rooms`,
      {
        method: 'POST',
        headers: accountHeaders,
        body: JSON.stringify({
          roomName: '临时游戏房间',
          displayName: '长期战役 DM',
          clientId: 'campaign-owner-client',
          accountId: account.session.accountId,
          activePlugins: [],
          maxPlayers: 4,
        }),
      },
    )
    const firstRoomResponse = await launch()
    expect(firstRoomResponse.status).toBe(201)
    const firstRoom = await firstRoomResponse.json() as {
      roomId: string
      campaignId: string
      member: { memberId: string; roomToken: string }
    }
    expect(firstRoom.campaignId).toBe(campaign.campaignId)

    const parallelRoomResponse = await launch()
    expect(parallelRoomResponse.status).toBe(409)
    await expect(parallelRoomResponse.json()).resolves.toMatchObject({ error: 'campaign-room-active' })

    const firstQuery = `?room=${firstRoom.roomId}`
    const firstRoomHeaders = {
      'Content-Type': 'application/json',
      'X-Stars-Protocol': '5',
      'X-Stars-Expected-Revision': '0',
      'X-Stars-Member': firstRoom.member.memberId,
      'X-Stars-Room-Token': firstRoom.member.roomToken,
    }
    const mapsState = {
      maps: [{ id: 'persistent-map', name: '长期地图', visibleToPlayers: true }],
      activeMapId: 'persistent-map',
      updatedAt: Date.now(),
    }
    expect((await fetch(`${offServer.base}/api/state/maps${firstQuery}`, {
      method: 'PUT',
      headers: firstRoomHeaders,
      body: JSON.stringify(mapsState),
    })).status).toBe(200)

    expect((await fetch(`${offServer.base}/api/rooms/${firstRoom.roomId}/leave`, {
      method: 'POST',
      headers: { ...firstRoomHeaders, 'X-Stars-Account-Token': account.session.sessionToken },
      body: JSON.stringify({ memberId: firstRoom.member.memberId }),
    })).status).toBe(200)

    const leftRoomPreview = await fetch(`${offServer.base}/api/rooms/${firstRoom.roomId}/preview`)
    expect(leftRoomPreview.status).toBe(200)
    await expect(leftRoomPreview.json()).resolves.toMatchObject({ hostOnline: false, hostStatus: 'offline' })

    expect((await fetch(`${offServer.base}/api/rooms/${firstRoom.roomId}/close`, {
      method: 'POST',
      headers: { ...firstRoomHeaders, 'X-Stars-Account-Token': account.session.sessionToken },
      body: JSON.stringify({ memberId: firstRoom.member.memberId }),
    })).status).toBe(200)

    const secondRoomResponse = await launch()
    expect(secondRoomResponse.status).toBe(201)
    const secondRoom = await secondRoomResponse.json() as {
      roomId: string
      campaignId: string
      member: { memberId: string; roomToken: string }
    }
    expect(secondRoom.roomId).not.toBe(firstRoom.roomId)
    expect(secondRoom.campaignId).toBe(campaign.campaignId)

    const closedRoomRead = await fetch(`${offServer.base}/api/state/maps?room=${firstRoom.roomId}`, {
      headers: firstRoomHeaders,
    })
    expect(closedRoomRead.status).toBe(409)
    await expect(closedRoomRead.json()).resolves.toMatchObject({ error: 'room-closed' })

    const persisted = await fetch(`${offServer.base}/api/state/maps?room=${secondRoom.roomId}`, {
      headers: {
        'X-Stars-Protocol': '5',
        'X-Stars-Member': secondRoom.member.memberId,
        'X-Stars-Room-Token': secondRoom.member.roomToken,
      },
    })
    expect(persisted.status).toBe(200)
    await expect(persisted.json()).resolves.toMatchObject({
      maps: [{ id: 'persistent-map', name: '长期地图' }],
      activeMapId: 'persistent-map',
    })

    const campaignListResponse = await fetch(`${offServer.base}/api/accounts/me/campaigns`, {
      headers: { 'X-Stars-Account-Token': account.session.sessionToken },
    })
    expect(campaignListResponse.status).toBe(200)
    await expect(campaignListResponse.json()).resolves.toMatchObject({
      campaigns: [{
        campaignId: campaign.campaignId,
        roomCount: 2,
        latestRoom: { roomId: secondRoom.roomId, status: 'online' },
      }],
    })
  })

  it('允许战役所有者跨设备重新签发 DM 凭证，并立即撤销旧凭证', async () => {
    const createAccount = async (displayName: string, clientId: string) => {
      const response = await fetch(`${offServer.base}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, clientId }),
      })
      expect(response.status).toBe(201)
      return response.json() as Promise<{
        session: { accountId: string; sessionToken: string; displayName: string }
      }>
    }
    const owner = await createAccount('跨设备 DM', 'campaign-resume-device-1')
    const outsider = await createAccount('其他账号', 'campaign-resume-outsider')
    const ownerHeaders = {
      'Content-Type': 'application/json',
      'X-Stars-Account-Token': owner.session.sessionToken,
    }
    const campaignResponse = await fetch(`${offServer.base}/api/accounts/me/campaigns`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: '跨设备恢复战役',
        rulesetId: 'dnd5e-2014-srd-5.1',
      }),
    })
    const campaign = await campaignResponse.json() as { campaignId: string }
    const roomResponse = await fetch(
      `${offServer.base}/api/accounts/me/campaigns/${campaign.campaignId}/rooms`,
      {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({
          roomName: '保持开启的房间',
          displayName: '跨设备 DM',
          clientId: 'campaign-resume-device-1',
          activePlugins: [],
        }),
      },
    )
    expect(roomResponse.status).toBe(201)
    const original = await roomResponse.json() as {
      roomId: string
      campaignId: string
      member: { memberId: string; roomToken: string }
    }
    const oldCredentialHeaders = {
      'X-Stars-Protocol': '5',
      'X-Stars-Member': original.member.memberId,
      'X-Stars-Room-Token': original.member.roomToken,
    }

    const outsiderResume = await fetch(
      `${offServer.base}/api/accounts/me/campaigns/${campaign.campaignId}/rooms/current`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stars-Account-Token': outsider.session.sessionToken,
        },
        body: JSON.stringify({
          displayName: '伪造 DM',
          clientId: 'campaign-resume-outsider',
          activePlugins: [],
        }),
      },
    )
    expect(outsiderResume.status).toBe(404)

    const resumedResponse = await fetch(
      `${offServer.base}/api/accounts/me/campaigns/${campaign.campaignId}/rooms/current`,
      {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({
          displayName: '跨设备 DM',
          clientId: 'campaign-resume-device-2',
          activePlugins: [],
        }),
      },
    )
    expect(resumedResponse.status).toBe(200)
    const resumed = await resumedResponse.json() as {
      roomId: string
      campaignId: string
      member: { memberId: string; roomToken: string; clientId: string }
    }
    expect(resumed).toMatchObject({
      roomId: original.roomId,
      campaignId: campaign.campaignId,
      member: {
        memberId: original.member.memberId,
        clientId: 'campaign-resume-device-2',
      },
    })
    expect(resumed.member.roomToken).not.toBe(original.member.roomToken)

    expect((await fetch(`${offServer.base}/api/state/maps?room=${original.roomId}`, {
      headers: oldCredentialHeaders,
    })).status).toBe(403)
    expect((await fetch(`${offServer.base}/api/state/maps?room=${resumed.roomId}`, {
      headers: {
        'X-Stars-Protocol': '5',
        'X-Stars-Member': resumed.member.memberId,
        'X-Stars-Room-Token': resumed.member.roomToken,
      },
    })).status).toBe(404)

    expect((await fetch(`${offServer.base}/api/rooms/${resumed.roomId}/close`, {
      method: 'POST',
      headers: {
        ...ownerHeaders,
        'X-Stars-Member': resumed.member.memberId,
        'X-Stars-Room-Token': resumed.member.roomToken,
      },
      body: JSON.stringify({ memberId: resumed.member.memberId }),
    })).status).toBe(200)
    const closedResume = await fetch(
      `${offServer.base}/api/accounts/me/campaigns/${campaign.campaignId}/rooms/current`,
      {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({
          displayName: '跨设备 DM',
          clientId: 'campaign-resume-device-3',
          activePlugins: [],
        }),
      },
    )
    expect(closedResume.status).toBe(409)
    await expect(closedResume.json()).resolves.toMatchObject({ error: 'room-closed' })
  })
})

describe('SQLite 账号存储 HTTP 集成', () => {
  it('服务重启且 JSON 回滚副本缺失时，仍从 SQLite 恢复账号和战役', async () => {
    const sharedRoot = await mkdtemp(path.join(os.tmpdir(), 'stars-http-sqlite-'))
    const storageEnv = {
      STARS_ACCOUNT_STORAGE: 'sqlite',
      STARS_DATABASE_PATH: path.join(sharedRoot, 'astraltrace.sqlite'),
      STARS_ALLOW_LEGACY_ACCOUNT_CREATION: 'true',
    }
    let server = await startServer(5397, storageEnv, sharedRoot)
    try {
      const accountResponse = await fetch(`${server.base}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'SQLite DM', clientId: 'sqlite-owner-client' }),
      })
      expect(accountResponse.status).toBe(201)
      const account = await accountResponse.json() as {
        session: { accountId: string; sessionToken: string }
      }
      const accountHeaders = {
        'Content-Type': 'application/json',
        'X-Stars-Account-Token': account.session.sessionToken,
      }
      const campaignResponse = await fetch(`${server.base}/api/accounts/me/campaigns`, {
        method: 'POST',
        headers: accountHeaders,
        body: JSON.stringify({
          name: 'SQLite 长期战役',
          rulesetId: 'dnd5e-2014-srd-5.1',
        }),
      })
      expect(campaignResponse.status).toBe(201)
      const campaign = await campaignResponse.json() as { campaignId: string }

      await stopServer(server, false)
      await rm(
        path.join(server.sharedRoot, 'lobby', 'accounts', `${account.session.accountId}.json`),
        { force: true },
      )
      server = await startServer(5397, storageEnv, server.sharedRoot)

      const listResponse = await fetch(`${server.base}/api/accounts/me/campaigns`, {
        headers: { 'X-Stars-Account-Token': account.session.sessionToken },
      })
      expect(listResponse.status).toBe(200)
      await expect(listResponse.json()).resolves.toMatchObject({
        campaigns: [{ campaignId: campaign.campaignId, name: 'SQLite 长期战役' }],
      })
    } finally {
      await stopServer(server)
    }
  })
})

describe('账号插件库协议', () => {
  it('按账号保存不可变插件版本、校验哈希并隔离其他账号', async () => {
    const createAccount = async (displayName: string, clientId: string) => {
      const response = await fetch(`${offServer.base}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, clientId }),
      })
      expect(response.status).toBe(201)
      return response.json() as Promise<{ session: { sessionToken: string } }>
    }
    const owner = await createAccount('插件作者', 'plugin-owner-client')
    const stranger = await createAccount('其他玩家', 'plugin-stranger-client')
    const bytes = Buffer.from('export default { manifest: { id: "com.example.cloud" } }', 'utf8')
    const integrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
    const path = '/api/accounts/me/plugins/com.example.cloud/versions/1.0.0'
    const uploadHeaders = {
      'Content-Type': 'application/octet-stream',
      'X-Stars-Account-Token': owner.session.sessionToken,
      'X-Stars-Plugin-Version': '1.0.0',
      'X-Stars-Plugin-Integrity': integrity,
      'X-Stars-Plugin-Filename': encodeURIComponent('cloud-rules.dndstars5e'),
      'X-Stars-Plugin-Name': encodeURIComponent('云端规则'),
      'X-Stars-Plugin-Publisher': encodeURIComponent('插件作者'),
      'X-Stars-Plugin-License': encodeURIComponent('CC0-1.0'),
      'X-Stars-Plugin-State-Schema': '1',
      'X-Stars-Plugin-Api-Version': '2',
      'X-Stars-Plugin-Ruleset': 'dnd5e-2014-srd-5.1',
      'X-Stars-Plugin-Description': encodeURIComponent('账号私有规则包'),
      'X-Stars-Plugin-Metadata': encodeURIComponent(JSON.stringify({
        manifestSchemaVersion: 1,
        minimumGameProtocolVersion: 5,
        dependencies: [{ id: 'com.example.core', versionRange: '^1.0.0', optional: true }],
        conflicts: ['com.example.legacy'],
        declaredCapabilities: ['damage', 'standard-condition'],
        distributionPolicy: 'room-distributable',
        contentCategory: 'rules',
      })),
    }
    const rejectedLocalOnly = await fetch(
      `${offServer.base}/api/accounts/me/plugins/com.example.local-only/versions/1.0.0`,
      {
        method: 'PUT',
        headers: {
          ...uploadHeaders,
          'X-Stars-Plugin-Metadata': encodeURIComponent(JSON.stringify({
            manifestSchemaVersion: 1,
            minimumGameProtocolVersion: 5,
            dependencies: [],
            conflicts: [],
            declaredCapabilities: [],
            distributionPolicy: 'local-only',
            contentCategory: 'mixed',
          })),
        },
        body: bytes,
      },
    )
    expect(rejectedLocalOnly.status).toBe(409)
    await expect(rejectedLocalOnly.json()).resolves.toMatchObject({ error: 'plugin-local-only' })
    const afterRejectedLocalOnly = await fetch(`${offServer.base}/api/accounts/me/plugins`, {
      headers: { 'X-Stars-Account-Token': owner.session.sessionToken },
    }).then((response) => response.json()) as { plugins: unknown[] }
    expect(afterRejectedLocalOnly.plugins).toEqual([])

    const upload = await fetch(`${offServer.base}${path}`, {
      method: 'PUT',
      headers: uploadHeaders,
      body: bytes,
    })
    expect(upload.status).toBe(201)
    expect(await upload.json()).toMatchObject({
      id: 'com.example.cloud',
      version: '1.0.0',
      integrity,
      visibility: 'private',
      sizeBytes: bytes.length,
      minimumGameProtocolVersion: 5,
      dependencies: [{ id: 'com.example.core', versionRange: '^1.0.0', optional: true }],
      conflicts: ['com.example.legacy'],
      declaredCapabilities: ['damage', 'standard-condition'],
      distributionPolicy: 'room-distributable',
      contentCategory: 'rules',
    })

    const list = await fetch(`${offServer.base}/api/accounts/me/plugins`, {
      headers: { 'X-Stars-Account-Token': owner.session.sessionToken },
    })
    expect(list.status).toBe(200)
    expect(await list.json()).toMatchObject({
      plugins: [{ id: 'com.example.cloud', version: '1.0.0', integrity }],
      limits: { maxVersions: 100 },
    })

    const download = await fetch(`${offServer.base}${path}`, {
      headers: { 'X-Stars-Account-Token': owner.session.sessionToken },
    })
    expect(download.status).toBe(200)
    expect(download.headers.get('X-Stars-Plugin-Integrity')).toBe(integrity)
    expect(JSON.parse(decodeURIComponent(download.headers.get('X-Stars-Plugin-Metadata') ?? ''))).toMatchObject({
      minimumGameProtocolVersion: 5,
      declaredCapabilities: ['damage', 'standard-condition'],
    })
    expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes)

    const forbiddenDownload = await fetch(`${offServer.base}${path}`, {
      headers: { 'X-Stars-Account-Token': stranger.session.sessionToken },
    })
    expect(forbiddenDownload.status).toBe(404)

    const conflictingBytes = Buffer.from('different immutable package', 'utf8')
    const conflict = await fetch(`${offServer.base}${path}`, {
      method: 'PUT',
      headers: {
        ...uploadHeaders,
        'X-Stars-Plugin-Integrity': `sha256-${createHash('sha256').update(conflictingBytes).digest('base64')}`,
      },
      body: conflictingBytes,
    })
    expect(conflict.status).toBe(409)
    await expect(conflict.json()).resolves.toMatchObject({ error: 'account-plugin-version-conflict' })

    const remove = await fetch(`${offServer.base}${path}`, {
      method: 'DELETE',
      headers: { 'X-Stars-Account-Token': owner.session.sessionToken },
    })
    expect(remove.status).toBe(200)
    const after = await fetch(`${offServer.base}/api/accounts/me/plugins`, {
      headers: { 'X-Stars-Account-Token': owner.session.sessionToken },
    }).then((response) => response.json()) as { plugins: unknown[] }
    expect(after.plugins).toEqual([])
  })

  it('核验战役所有者的 DM 工坊来源，并允许 V2 内容包进入市场定价流程', async () => {
    const createAccount = async (displayName: string, clientId: string) => {
      const response = await fetch(`${offServer.base}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, clientId }),
      })
      expect(response.status).toBe(201)
      return response.json() as Promise<{
        session: { accountId: string; sessionToken: string }
      }>
    }
    const owner = await createAccount('DM 工坊作者', 'workshop-market-owner')
    const outsider = await createAccount('非战役所有者', 'workshop-market-outsider')
    const campaignResponse = await fetch(`${offServer.base}/api/accounts/me/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Account-Token': owner.session.sessionToken,
      },
      body: JSON.stringify({
        name: '市场工坊战役',
        rulesetId: 'dnd5e-2014-srd-5.1',
      }),
    })
    expect(campaignResponse.status).toBe(201)
    const campaign = await campaignResponse.json() as { campaignId: string }

    const pluginId = 'com.example.workshop-v2'
    const pluginVersion = '1.0.0'
    const packageValue = {
      format: 'dndstars5e-content',
      schemaVersion: 2,
      manifest: {
        id: pluginId,
        name: '工坊 V2 市场包',
        version: pluginVersion,
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        stateSchemaVersion: 1,
        manifestSchemaVersion: 1,
        minimumGameProtocolVersion: 5,
        dependencies: [],
        conflicts: [],
        declaredCapabilities: ['damage'],
        distributionPolicy: 'room-distributable',
        contentCategory: 'spells',
        publisher: 'DM 工坊作者',
        license: '原创内容保留版权',
      },
      provenance: { edition: '2014', contentMode: 'incremental', sourceTitle: '工坊 V2 市场包' },
      assets: [{ id: 'original-icon', mediaType: 'image/png', data: 'data:image/png;base64,YQ==' }],
      content: {
        races: [], backgrounds: [], features: [], feats: [], spells: [{ id: 'original-spell' }],
        items: [], abilityGenerationMethods: [], headlessActions: [], subclasses: [], classes: [], monsters: [],
      },
    }
    const bytes = Buffer.from(JSON.stringify(packageValue), 'utf8')
    const integrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
    const accountPath = `/api/accounts/me/plugins/${pluginId}/versions/${pluginVersion}`
    const uploadHeaders = (sessionToken: string) => ({
      'Content-Type': 'application/octet-stream',
      'X-Stars-Account-Token': sessionToken,
      'X-Stars-Plugin-Origin': 'dm-workshop',
      'X-Stars-Campaign-Id': campaign.campaignId,
      'X-Stars-Plugin-Version': pluginVersion,
      'X-Stars-Plugin-Integrity': integrity,
      'X-Stars-Plugin-Filename': encodeURIComponent(`${pluginId}.dndstars5e`),
      'X-Stars-Plugin-Name': encodeURIComponent(packageValue.manifest.name),
      'X-Stars-Plugin-Publisher': encodeURIComponent(packageValue.manifest.publisher),
      'X-Stars-Plugin-License': encodeURIComponent(packageValue.manifest.license),
      'X-Stars-Plugin-State-Schema': '1',
      'X-Stars-Plugin-Api-Version': '2',
      'X-Stars-Plugin-Ruleset': 'dnd5e-2014-srd-5.1',
      'X-Stars-Plugin-Description': encodeURIComponent('由战役 DM 工坊创建的原创 V2 内容包。'),
      'X-Stars-Plugin-Metadata': encodeURIComponent(JSON.stringify({
        manifestSchemaVersion: 1,
        minimumGameProtocolVersion: 5,
        dependencies: [],
        conflicts: [],
        declaredCapabilities: ['damage'],
        distributionPolicy: 'room-distributable',
        contentCategory: 'spells',
      })),
    })

    const rejected = await fetch(`${offServer.base}${accountPath}`, {
      method: 'PUT', headers: uploadHeaders(outsider.session.sessionToken), body: bytes,
    })
    expect(rejected.status).toBe(403)
    await expect(rejected.json()).resolves.toMatchObject({ error: 'dm-workshop-authority-required' })

    const uploaded = await fetch(`${offServer.base}${accountPath}`, {
      method: 'PUT', headers: uploadHeaders(owner.session.sessionToken), body: bytes,
    })
    expect(uploaded.status).toBe(201)
    await expect(uploaded.json()).resolves.toMatchObject({
      id: pluginId,
      workshopOrigin: { kind: 'dm-workshop', campaignId: campaign.campaignId },
    })

    const publication = await fetch(`${offServer.base}${accountPath}/publication`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Account-Token': owner.session.sessionToken,
      },
      body: JSON.stringify({
        visibility: 'public',
        storeDescription: '这是由 DM 工坊直接提交的原创 V2 法术内容包，可供公开目录审核。',
        commerce: {
          schemaVersion: 1,
          productType: 'plugin',
          pricing: { kind: 'free', currency: 'CNY', amountMinor: 0 },
        },
        rightsManifest: {
          schemaVersion: 1,
          contentOrigin: 'original',
          creatorDeclaration: true,
          acceptedCreatorAgreement: '2026-07-27',
          containsAi: false,
          assets: [
            { category: 'rules', sourceType: 'original', license: '原创内容保留版权' },
            { category: 'art', sourceType: 'original', license: '原创美术保留版权' },
          ],
        },
      }),
    })
    expect([201, 202]).toContain(publication.status)
    await expect(publication.json()).resolves.toMatchObject({
      publication: { id: pluginId },
    })
  })

  it('只将声明式规则包发布到可搜索目录，并支持公开下载、发布者页和举报', async () => {
    const createAccount = async (displayName: string, clientId: string) => {
      const response = await fetch(`${offServer.base}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, clientId }),
      })
      expect(response.status).toBe(201)
      return response.json() as Promise<{ session: { accountId: string; sessionToken: string } }>
    }
    const owner = await createAccount('公开作者', 'catalog-owner-client')
    const reporter = await createAccount('举报测试者', 'catalog-reporter-client')
    const pluginId = 'com.example.catalog'
    const pluginVersion = '1.2.0'
    const packageValue = {
      format: 'dndstars5e-declarative',
      schemaVersion: 1,
      manifest: {
        id: pluginId,
        name: '目录规则包',
        version: pluginVersion,
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        stateSchemaVersion: 1,
        manifestSchemaVersion: 1,
        minimumGameProtocolVersion: 5,
        dependencies: [],
        conflicts: [],
        declaredCapabilities: ['damage'],
        distributionPolicy: 'room-distributable',
        contentCategory: 'rules',
        publisher: '公开作者',
        license: 'CC0-1.0',
      },
      subclasses: [],
      legacy: {
        manifest: { id: pluginId },
        races: [],
        backgrounds: [],
        features: [],
        spells: [],
        items: [],
        abilityGenerationMethods: [],
      },
    }
    const bytes = Buffer.from(JSON.stringify(packageValue), 'utf8')
    const integrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
    const accountPath = `/api/accounts/me/plugins/${pluginId}/versions/${pluginVersion}`
    const upload = await fetch(`${offServer.base}${accountPath}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Stars-Account-Token': owner.session.sessionToken,
        'X-Stars-Plugin-Version': pluginVersion,
        'X-Stars-Plugin-Integrity': integrity,
        'X-Stars-Plugin-Filename': encodeURIComponent(`${pluginId}.dndstars5e`),
        'X-Stars-Plugin-Name': encodeURIComponent('目录规则包'),
        'X-Stars-Plugin-Publisher': encodeURIComponent('公开作者'),
        'X-Stars-Plugin-License': encodeURIComponent('CC0-1.0'),
        'X-Stars-Plugin-State-Schema': '1',
        'X-Stars-Plugin-Api-Version': '2',
        'X-Stars-Plugin-Ruleset': 'dnd5e-2014-srd-5.1',
        'X-Stars-Plugin-Description': encodeURIComponent('可以搜索的安全规则包'),
        'X-Stars-Plugin-Metadata': encodeURIComponent(JSON.stringify({
          manifestSchemaVersion: 1,
          minimumGameProtocolVersion: 5,
          dependencies: [],
          conflicts: [],
          declaredCapabilities: ['damage'],
          distributionPolicy: 'room-distributable',
          contentCategory: 'rules',
        })),
      },
      body: bytes,
    })
    expect(upload.status).toBe(201)

    const publication = await fetch(`${offServer.base}${accountPath}/publication`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Account-Token': owner.session.sessionToken,
      },
      body: JSON.stringify({ visibility: 'public', changelog: '初次发布', tags: ['战斗', '规则'] }),
    })
    expect(publication.status).toBe(201)
    await expect(publication.json()).resolves.toMatchObject({ status: 'published' })

    const catalog = await fetch(`${offServer.base}/api/plugins/catalog?q=目录&category=rules`)
    expect(catalog.status).toBe(200)
    await expect(catalog.json()).resolves.toMatchObject({
      plugins: [{
        id: pluginId,
        publisher: { accountId: owner.session.accountId, displayName: '公开作者' },
        versions: [{
          version: pluginVersion,
          integrity,
          status: 'published',
          productManifest: {
            schemaVersion: 1,
            productId: pluginId,
            version: pluginVersion,
            integrity,
          },
          productSignature: {
            schemaVersion: 1,
            algorithm: 'Ed25519',
            keyId: expect.any(String),
            signature: expect.any(String),
          },
        }],
      }],
    })

    const signingKey = await fetch(`${offServer.base}/api/plugins/signing-key`)
    expect(signingKey.status).toBe(200)
    await expect(signingKey.json()).resolves.toMatchObject({
      schemaVersion: 1,
      algorithm: 'Ed25519',
      keyId: expect.any(String),
      publicKeyPem: expect.stringContaining('BEGIN PUBLIC KEY'),
    })

    const publisher = await fetch(
      `${offServer.base}/api/plugins/publishers/${owner.session.accountId}`,
    )
    expect(publisher.status).toBe(200)
    await expect(publisher.json()).resolves.toMatchObject({
      publisher: { accountId: owner.session.accountId },
      plugins: [{ id: pluginId }],
    })

    const download = await fetch(
      `${offServer.base}/api/plugins/catalog/${pluginId}/versions/${pluginVersion}/download`,
    )
    expect(download.status).toBe(200)
    expect(download.headers.get('X-Stars-Plugin-Integrity')).toBe(integrity)
    expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes)

    const detail = await fetch(`${offServer.base}/api/plugins/catalog/${pluginId}`, {
      headers: { 'X-Stars-Account-Token': reporter.session.sessionToken },
    })
    expect(detail.status).toBe(200)

    const reporterInstall = await fetch(`${offServer.base}${accountPath}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Stars-Account-Token': reporter.session.sessionToken,
        'X-Stars-Plugin-Version': pluginVersion,
        'X-Stars-Plugin-Integrity': integrity,
        'X-Stars-Plugin-Filename': encodeURIComponent(`${pluginId}.dndstars5e`),
        'X-Stars-Plugin-Name': encodeURIComponent('目录规则包'),
        'X-Stars-Plugin-Publisher': encodeURIComponent('公开作者'),
        'X-Stars-Plugin-License': encodeURIComponent('CC0-1.0'),
        'X-Stars-Plugin-State-Schema': '1',
        'X-Stars-Plugin-Api-Version': '2',
        'X-Stars-Plugin-Ruleset': 'dnd5e-2014-srd-5.1',
        'X-Stars-Plugin-Description': encodeURIComponent('可以搜索的安全规则包'),
        'X-Stars-Plugin-Metadata': encodeURIComponent(JSON.stringify({
          manifestSchemaVersion: 1,
          minimumGameProtocolVersion: 5,
          dependencies: [],
          conflicts: [],
          declaredCapabilities: ['damage'],
          distributionPolicy: 'room-distributable',
          contentCategory: 'rules',
        })),
      },
      body: bytes,
    })
    expect(reporterInstall.status).toBe(201)

    const installation = await fetch(
      `${offServer.base}/api/plugins/catalog/${pluginId}/versions/${pluginVersion}/installation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stars-Account-Token': reporter.session.sessionToken,
        },
        body: JSON.stringify({ active: true }),
      },
    )
    expect(installation.status).toBe(200)
    await expect(installation.json()).resolves.toMatchObject({ transition: null })

    const analytics = await fetch(
      `${offServer.base}/api/marketplace/creators/me/analytics?days=30`,
      { headers: { 'X-Stars-Account-Token': owner.session.sessionToken } },
    )
    expect(analytics.status).toBe(200)
    await expect(analytics.json()).resolves.toMatchObject({
      totals: {
        views: 1,
        downloads: 1,
        installs: 1,
        activeInstallations: 1,
      },
      products: [{ productId: pluginId, activeInstallations: 1 }],
    })

    const publicationStatuses = await fetch(
      `${offServer.base}/api/marketplace/creators/me/publications`,
      { headers: { 'X-Stars-Account-Token': owner.session.sessionToken } },
    )
    expect(publicationStatuses.status).toBe(200)
    await expect(publicationStatuses.json()).resolves.toMatchObject({
      publications: [{
        id: pluginId,
        versions: [{ version: pluginVersion, status: 'published' }],
      }],
    })

    const report = await fetch(`${offServer.base}/api/plugins/catalog/${pluginId}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Account-Token': reporter.session.sessionToken,
      },
      body: JSON.stringify({ version: pluginVersion, category: 'other', details: '审核流程测试' }),
    })
    expect(report.status).toBe(201)

    const paidPluginId = 'com.example.catalog.paid'
    const registryPath = path.join(offServer.sharedRoot, 'lobby', 'plugin-registry.json')
    const registry = JSON.parse(await readFile(registryPath, 'utf8')) as {
      entries: Array<Record<string, unknown> & { id: string; versions: Array<Record<string, unknown>> }>
    }
    const freeEntry = registry.entries.find((entry) => entry.id === pluginId)
    expect(freeEntry).toBeTruthy()
    registry.entries.push({
      ...freeEntry!,
      id: paidPluginId,
      name: '付费目录规则包',
      versions: freeEntry!.versions.map((candidate) => ({
        ...candidate,
        marketplace: {
          schemaVersion: 1,
          productType: 'plugin',
          commerceState: 'preview',
          pricing: {
            kind: 'paid',
            currency: 'CNY',
            amountMinor: 990,
            settlementBasis: 'net-receipts',
            creatorShareBps: 6000,
            platformShareBps: 4000,
          },
          rightsStatus: 'creator-declared',
        },
      })),
    })
    await writeFile(registryPath, JSON.stringify(registry))

    const orderRequest = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Account-Token': reporter.session.sessionToken,
        'Idempotency-Key': 'paid-order-test-1',
      },
      body: JSON.stringify({
        productId: paidPluginId,
        version: pluginVersion,
        idempotencyKey: 'paid-order-test-1',
      }),
    }
    const createOrder = await fetch(`${offServer.base}/api/marketplace/orders`, orderRequest)
    expect(createOrder.status).toBe(201)
    const createdOrder = await createOrder.json() as {
      order: { orderId: string; status: string; amountMinor: number }
      sandboxAvailable: boolean
    }
    expect(createdOrder).toMatchObject({
      order: { status: 'pending', amountMinor: 990 },
      sandboxAvailable: true,
    })
    const repeatedOrder = await fetch(`${offServer.base}/api/marketplace/orders`, orderRequest)
    expect(repeatedOrder.status).toBe(200)
    await expect(repeatedOrder.json()).resolves.toMatchObject({
      order: { orderId: createdOrder.order.orderId },
    })

    const forbiddenPaidDownload = await fetch(
      `${offServer.base}/api/plugins/catalog/${paidPluginId}/versions/${pluginVersion}/download`,
      { headers: { 'X-Stars-Account-Token': reporter.session.sessionToken } },
    )
    expect(forbiddenPaidDownload.status).toBe(403)

    const payOrder = await fetch(
      `${offServer.base}/api/marketplace/orders/${createdOrder.order.orderId}/sandbox-payment`,
      {
        method: 'POST',
        headers: { 'X-Stars-Account-Token': reporter.session.sessionToken },
      },
    )
    expect(payOrder.status).toBe(200)
    await expect(payOrder.json()).resolves.toMatchObject({
      order: { orderId: createdOrder.order.orderId, status: 'fulfilled' },
    })
    const repeatPayment = await fetch(
      `${offServer.base}/api/marketplace/orders/${createdOrder.order.orderId}/sandbox-payment`,
      {
        method: 'POST',
        headers: { 'X-Stars-Account-Token': reporter.session.sessionToken },
      },
    )
    expect(repeatPayment.status).toBe(200)

    const entitlements = await fetch(`${offServer.base}/api/accounts/me/entitlements`, {
      headers: { 'X-Stars-Account-Token': reporter.session.sessionToken },
    })
    await expect(entitlements.json()).resolves.toMatchObject({
      entitlements: [{
        productId: paidPluginId,
        version: pluginVersion,
        source: 'purchase',
        status: 'active',
      }],
    })
    const paidDownload = await fetch(
      `${offServer.base}/api/plugins/catalog/${paidPluginId}/versions/${pluginVersion}/download`,
      { headers: { 'X-Stars-Account-Token': reporter.session.sessionToken } },
    )
    expect(paidDownload.status).toBe(200)
    const creatorLedgerAfterSale = await fetch(
      `${offServer.base}/api/marketplace/creators/me/ledger`,
      { headers: { 'X-Stars-Account-Token': owner.session.sessionToken } },
    )
    expect(creatorLedgerAfterSale.status).toBe(200)
    await expect(creatorLedgerAfterSale.json()).resolves.toMatchObject({
      balances: expect.arrayContaining([expect.objectContaining({
        currency: 'CNY',
        availableMinor: 594,
        pendingMinor: 0,
      })]),
      entries: expect.arrayContaining([expect.objectContaining({
        orderId: createdOrder.order.orderId,
        kind: 'sale',
        amountMinor: 594,
      })]),
    })

    const refundPayload = JSON.stringify({
      provider: 'test-provider',
      providerEventId: 'refund-event-1',
      providerOrderId: `sandbox:${createdOrder.order.orderId}`,
      orderId: createdOrder.order.orderId,
      status: 'refunded',
      currency: 'CNY',
      amountMinor: 990,
    })
    const refundSignature = createHmac('sha256', 'test-marketplace-payment-secret')
      .update(refundPayload)
      .digest('hex')
    const refund = await fetch(`${offServer.base}/api/marketplace/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Payment-Signature': refundSignature,
      },
      body: refundPayload,
    })
    expect(refund.status).toBe(200)
    const refundedDownload = await fetch(
      `${offServer.base}/api/plugins/catalog/${paidPluginId}/versions/${pluginVersion}/download`,
      { headers: { 'X-Stars-Account-Token': reporter.session.sessionToken } },
    )
    expect(refundedDownload.status).toBe(403)
    const creatorLedgerAfterRefund = await fetch(
      `${offServer.base}/api/marketplace/creators/me/ledger`,
      { headers: { 'X-Stars-Account-Token': owner.session.sessionToken } },
    )
    await expect(creatorLedgerAfterRefund.json()).resolves.toMatchObject({
      balances: expect.arrayContaining([expect.objectContaining({
        currency: 'CNY',
        availableMinor: 0,
        pendingMinor: 0,
      })]),
      entries: expect.arrayContaining([
        expect.objectContaining({ kind: 'refund', amountMinor: -594 }),
        expect.objectContaining({ kind: 'sale', amountMinor: 594 }),
      ]),
    })

    const secondOrderRequest = {
      ...orderRequest,
      headers: {
        ...orderRequest.headers,
        'Idempotency-Key': 'paid-order-test-2',
      },
      body: JSON.stringify({
        productId: paidPluginId,
        version: pluginVersion,
        idempotencyKey: 'paid-order-test-2',
      }),
    }
    const secondOrderResponse = await fetch(
      `${offServer.base}/api/marketplace/orders`,
      secondOrderRequest,
    )
    expect(secondOrderResponse.status).toBe(201)
    const secondOrder = await secondOrderResponse.json() as {
      order: { orderId: string }
    }
    const paidPayload = JSON.stringify({
      provider: 'test-provider',
      providerEventId: 'paid-event-2',
      providerOrderId: 'provider-order-2',
      orderId: secondOrder.order.orderId,
      status: 'paid',
      currency: 'CNY',
      amountMinor: 990,
      netReceiptsMinor: 800,
    })
    const paidSignature = createHmac('sha256', 'test-marketplace-payment-secret')
      .update(paidPayload)
      .digest('hex')
    const paidWebhook = await fetch(`${offServer.base}/api/marketplace/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Payment-Signature': paidSignature,
      },
      body: paidPayload,
    })
    expect(paidWebhook.status).toBe(200)
    const creatorLedgerAfterExternalPayment = await fetch(
      `${offServer.base}/api/marketplace/creators/me/ledger`,
      { headers: { 'X-Stars-Account-Token': owner.session.sessionToken } },
    )
    await expect(creatorLedgerAfterExternalPayment.json()).resolves.toMatchObject({
      balances: expect.arrayContaining([expect.objectContaining({
        currency: 'CNY',
        availableMinor: 0,
        pendingMinor: 480,
      })]),
      entries: expect.arrayContaining([
        expect.objectContaining({
          orderId: secondOrder.order.orderId,
          kind: 'sale',
          amountMinor: 480,
        }),
      ]),
      settlementHoldDays: 14,
    })

    const payoutRegistry = JSON.parse(await readFile(registryPath, 'utf8')) as {
      creators?: Array<Record<string, unknown>>
      ledgerEntries?: Array<Record<string, unknown>>
    }
    payoutRegistry.creators = [
      ...(payoutRegistry.creators ?? []).filter((candidate) =>
        candidate.accountId !== owner.session.accountId),
      {
        schemaVersion: 1,
        accountId: owner.session.accountId,
        status: 'verified',
        verificationReference: 'kyc-recipient:test-owner',
        verifiedAt: Date.now(),
      },
    ]
    await writeFile(registryPath, JSON.stringify(payoutRegistry))

    const insufficientPayout = await fetch(
      `${offServer.base}/api/marketplace/creators/me/payouts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stars-Account-Token': owner.session.sessionToken,
          'Idempotency-Key': 'payout-insufficient-1',
        },
        body: JSON.stringify({ currency: 'CNY', amountMinor: 10_000 }),
      },
    )
    expect(insufficientPayout.status).toBe(409)
    await expect(insufficientPayout.json()).resolves.toMatchObject({
      error: 'marketplace-payout-insufficient-balance',
    })

    const fundedPayoutRegistry = JSON.parse(await readFile(registryPath, 'utf8')) as {
      ledgerEntries?: Array<Record<string, unknown>>
    }
    fundedPayoutRegistry.ledgerEntries = [
      ...(fundedPayoutRegistry.ledgerEntries ?? []),
      {
        schemaVersion: 1,
        entryId: 'test-available-creator-balance',
        orderId: 'test-opening-balance',
        productId: 'test-fixture',
        version: '1',
        beneficiaryAccountId: owner.session.accountId,
        beneficiaryRole: 'creator',
        kind: 'sale',
        currency: 'CNY',
        amountMinor: 30_000,
        sourceEventId: 'test-opening-balance',
        createdAt: Date.now(),
        availableAt: Date.now(),
      },
    ]
    await writeFile(registryPath, JSON.stringify(fundedPayoutRegistry))

    const requestPayout = (idempotencyKey: string) => fetch(
      `${offServer.base}/api/marketplace/creators/me/payouts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stars-Account-Token': owner.session.sessionToken,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ currency: 'CNY', amountMinor: 10_000 }),
      },
    )
    const firstPayoutResponse = await requestPayout('payout-reject-1')
    expect(firstPayoutResponse.status).toBe(201)
    const firstPayout = await firstPayoutResponse.json() as {
      payout: { payoutId: string; status: string; payoutDestinationReference?: string }
    }
    expect(firstPayout.payout).toMatchObject({
      status: 'pending',
      amountMinor: 10_000,
      currency: 'CNY',
    })
    expect(firstPayout.payout).not.toHaveProperty('payoutDestinationReference')

    const repeatedPayoutResponse = await requestPayout('payout-reject-1')
    expect(repeatedPayoutResponse.status).toBe(200)
    await expect(repeatedPayoutResponse.json()).resolves.toMatchObject({
      payout: { payoutId: firstPayout.payout.payoutId },
    })
    const ledgerAfterPayoutReservation = await fetch(
      `${offServer.base}/api/marketplace/creators/me/ledger`,
      { headers: { 'X-Stars-Account-Token': owner.session.sessionToken } },
    )
    await expect(ledgerAfterPayoutReservation.json()).resolves.toMatchObject({
      balances: expect.arrayContaining([expect.objectContaining({
        currency: 'CNY',
        availableMinor: 20_000,
        pendingMinor: 480,
      })]),
      entries: expect.arrayContaining([expect.objectContaining({
        orderId: firstPayout.payout.payoutId,
        kind: 'payout',
        amountMinor: -10_000,
      })]),
    })

    const payoutModerationQueue = await fetch(`${offServer.base}/api/plugins/moderation`, {
      headers: { 'X-Stars-Account-Token': reporter.session.sessionToken },
    })
    expect(payoutModerationQueue.status).toBe(200)
    await expect(payoutModerationQueue.json()).resolves.toMatchObject({
      payouts: [expect.objectContaining({
        payoutId: firstPayout.payout.payoutId,
        verifiedRecipientReference: 'kyc-recipient:test-owner',
      })],
    })

    const rejectPayout = await fetch(
      `${offServer.base}/api/marketplace/payouts/${firstPayout.payout.payoutId}/moderate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stars-Account-Token': reporter.session.sessionToken,
        },
        body: JSON.stringify({ action: 'reject', note: '测试退回预占余额' }),
      },
    )
    expect(rejectPayout.status).toBe(200)
    await expect(rejectPayout.json()).resolves.toMatchObject({
      payout: { status: 'rejected' },
    })
    const ledgerAfterPayoutRejection = await fetch(
      `${offServer.base}/api/marketplace/creators/me/ledger`,
      { headers: { 'X-Stars-Account-Token': owner.session.sessionToken } },
    )
    await expect(ledgerAfterPayoutRejection.json()).resolves.toMatchObject({
      balances: expect.arrayContaining([expect.objectContaining({
        currency: 'CNY',
        availableMinor: 30_000,
        pendingMinor: 480,
      })]),
      entries: expect.arrayContaining([expect.objectContaining({
        orderId: firstPayout.payout.payoutId,
        kind: 'payout-release',
        amountMinor: 10_000,
      })]),
    })

    const paidPayoutResponse = await requestPayout('payout-paid-1')
    expect(paidPayoutResponse.status).toBe(201)
    const paidPayout = await paidPayoutResponse.json() as {
      payout: { payoutId: string }
    }
    const approvePayout = await fetch(
      `${offServer.base}/api/marketplace/payouts/${paidPayout.payout.payoutId}/moderate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stars-Account-Token': reporter.session.sessionToken,
        },
        body: JSON.stringify({ action: 'approve' }),
      },
    )
    expect(approvePayout.status).toBe(200)
    await expect(approvePayout.json()).resolves.toMatchObject({
      payout: { status: 'approved' },
    })
    const markPaidPayout = await fetch(
      `${offServer.base}/api/marketplace/payouts/${paidPayout.payout.payoutId}/moderate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stars-Account-Token': reporter.session.sessionToken,
        },
        body: JSON.stringify({
          action: 'mark-paid',
          externalTransferReference: 'bank-transfer-test-1',
        }),
      },
    )
    expect(markPaidPayout.status).toBe(200)
    await expect(markPaidPayout.json()).resolves.toMatchObject({
      payout: { status: 'paid', paidAt: expect.any(Number) },
    })
    const payoutHistory = await fetch(
      `${offServer.base}/api/marketplace/creators/me/payouts`,
      { headers: { 'X-Stars-Account-Token': owner.session.sessionToken } },
    )
    expect(payoutHistory.status).toBe(200)
    const payoutHistoryPayload = await payoutHistory.json() as {
      payouts: Array<Record<string, unknown>>
    }
    expect(payoutHistoryPayload.payouts).toEqual(expect.arrayContaining([
      expect.objectContaining({ payoutId: paidPayout.payout.payoutId, status: 'paid' }),
      expect.objectContaining({ payoutId: firstPayout.payout.payoutId, status: 'rejected' }),
    ]))
    expect(JSON.stringify(payoutHistoryPayload)).not.toContain('kyc-recipient:test-owner')

    const removePublished = await fetch(`${offServer.base}${accountPath}`, {
      method: 'DELETE',
      headers: { 'X-Stars-Account-Token': owner.session.sessionToken },
    })
    expect(removePublished.status).toBe(409)
    await expect(removePublished.json()).resolves.toMatchObject({ error: 'account-plugin-in-use' })
  })
})

describe('账号验证码注册与密码登录协议', () => {
  it('邮箱验证码注册后可按用户名或邮箱登录，并可撤销当前会话', async () => {
    const configResponse = await fetch(`${offServer.base}/api/accounts/auth/config`)
    expect(configResponse.status).toBe(200)
    expect(await configResponse.json()).toMatchObject({
      channels: { email: true, phone: true },
      developmentDelivery: true,
      passwordMinLength: 8,
    })

    const verificationResponse = await fetch(`${offServer.base}/api/accounts/auth/verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'email', destination: 'Adventurer@Example.com' }),
    })
    expect(verificationResponse.status).toBe(201)
    const verification = await verificationResponse.json() as {
      challengeId: string
      debugCode: string
      destinationLabel: string
    }
    expect(verification.debugCode).toMatch(/^\d{6}$/)
    expect(verification.destinationLabel).toBe('a***@example.com')

    const registerResponse = await fetch(`${offServer.base}/api/accounts/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: verification.challengeId,
        verificationCode: verification.debugCode,
        username: '星痕玩家',
        password: 'CorrectHorse42',
        clientId: 'registered-device-one',
      }),
    })
    expect(registerResponse.status).toBe(201)
    const registered = await registerResponse.json() as {
      session: { accountId: string; sessionToken: string; username: string; contactLabel: string }
    }
    expect(registered.session).toMatchObject({
      username: '星痕玩家',
      contactLabel: 'a***@example.com',
    })

    const duplicateContact = await fetch(`${offServer.base}/api/accounts/auth/verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'email', destination: 'adventurer@example.com' }),
    })
    expect(duplicateContact.status).toBe(409)

    const logoutResponse = await fetch(`${offServer.base}/api/accounts/auth/logout`, {
      method: 'POST',
      headers: { 'X-Stars-Account-Token': registered.session.sessionToken },
    })
    expect(logoutResponse.status).toBe(200)
    expect((await fetch(`${offServer.base}/api/accounts/me`, {
      headers: { 'X-Stars-Account-Token': registered.session.sessionToken },
    })).status).toBe(401)

    const loginTokens: string[] = []
    for (const identifier of ['星痕玩家', 'ADVENTURER@example.com']) {
      const loginResponse = await fetch(`${offServer.base}/api/accounts/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          password: 'CorrectHorse42',
          clientId: `login-device-${identifier.includes('@') ? 'email' : 'username'}`,
        }),
      })
      expect(loginResponse.status).toBe(200)
      const loggedIn = await loginResponse.json() as {
        session: { accountId: string; sessionToken: string; username: string }
      }
      loginTokens.push(loggedIn.session.sessionToken)
      expect(loggedIn).toMatchObject({
        session: { accountId: registered.session.accountId, username: '星痕玩家' },
      })
    }

    const avatar = `data:image/webp;base64,${Buffer.from('avatar').toString('base64')}`
    const updateProfile = await fetch(`${offServer.base}/api/accounts/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Account-Token': loginTokens[0],
      },
      body: JSON.stringify({ displayName: '星痕主持人', avatar }),
    })
    expect(updateProfile.status).toBe(200)
    expect(await updateProfile.json()).toMatchObject({
      displayName: '星痕主持人',
      avatar,
      username: '星痕玩家',
    })

    const wrongCurrentPassword = await fetch(`${offServer.base}/api/accounts/me/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Account-Token': loginTokens[0],
      },
      body: JSON.stringify({ currentPassword: 'WrongCurrent42', newPassword: 'ChangedPassword42' }),
    })
    expect(wrongCurrentPassword.status).toBe(401)
    expect(await wrongCurrentPassword.json()).toEqual({ error: 'invalid-account-current-password' })

    const changePassword = await fetch(`${offServer.base}/api/accounts/me/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Account-Token': loginTokens[0],
      },
      body: JSON.stringify({ currentPassword: 'CorrectHorse42', newPassword: 'ChangedPassword42' }),
    })
    expect(changePassword.status).toBe(200)
    expect((await fetch(`${offServer.base}/api/accounts/me`, {
      headers: { 'X-Stars-Account-Token': loginTokens[0] },
    })).status).toBe(200)
    expect((await fetch(`${offServer.base}/api/accounts/me`, {
      headers: { 'X-Stars-Account-Token': loginTokens[1] },
    })).status).toBe(401)

    const wrongPassword = await fetch(`${offServer.base}/api/accounts/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '星痕玩家',
        password: 'DefinitelyWrong',
        clientId: 'wrong-password-device',
      }),
    })
    expect(wrongPassword.status).toBe(401)
    expect(await wrongPassword.json()).toEqual({ error: 'invalid-account-credentials' })

    const changedPasswordLogin = await fetch(`${offServer.base}/api/accounts/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '星痕玩家',
        password: 'ChangedPassword42',
        clientId: 'changed-password-device',
      }),
    })
    expect(changedPasswordLogin.status).toBe(200)
    expect(await changedPasswordLogin.json()).toMatchObject({
      session: {
        accountId: registered.session.accountId,
        displayName: '星痕主持人',
        avatar,
      },
    })
  }, 20_000)
})

describe('P2 — 房间规则包原子升级', () => {
  it('暂存不会改变当前规则，版本冲突会保留旧包，迁移状态与新包一起激活', async () => {
    const createResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: 'P2 原子升级',
        displayName: '迁移 DM',
        rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'p2-atomic-upgrade-dm',
        activePlugins: [],
      }),
    })
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json() as {
      roomId: string
      member: { memberId: string; roomToken: string }
    }
    const pluginId = 'com.example.atomic-upgrade'

    const stage = async (version: string, stateSchemaVersion: number, bytes: Buffer) => {
      const integrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      const response = await fetch(
        `${offServer.base}/api/rooms/${created.roomId}/plugins/${pluginId}/stage`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'text/javascript',
            'X-Stars-Member': created.member.memberId,
            'X-Stars-Room-Token': created.member.roomToken,
            'X-Stars-Plugin-Version': version,
            'X-Stars-Plugin-State-Schema': String(stateSchemaVersion),
            'X-Stars-Plugin-Integrity': integrity,
            'X-Stars-Plugin-Filename': encodeURIComponent(`${pluginId}-${version}.dndstars5e`),
            'X-Stars-Plugin-Name': encodeURIComponent('原子升级测试包'),
            'X-Stars-Plugin-Publisher': encodeURIComponent('测试发布者'),
            'X-Stars-Plugin-License': encodeURIComponent('CC0-1.0'),
            'X-Stars-Plugin-Distribution-Policy': 'room-distributable',
          },
          body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        },
      )
      expect(response.status).toBe(200)
      return { integrity, rules: await response.json() as { revision: number; requiredPlugins: unknown[] } }
    }

    const v1Bytes = Buffer.from('export default atomicV1')
    const v1 = await stage('1.0.0', 1, v1Bytes)
    expect(v1.rules).toMatchObject({ revision: 1, requiredPlugins: [] })

    const initialStateResponse = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${pluginId}/migration-state`,
      { headers: { 'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken } },
    )
    expect(initialStateResponse.status).toBe(200)
    const initialState = await initialStateResponse.json() as { rulesRevision: number; installed: boolean; hasState: boolean }
    expect(initialState).toMatchObject({ rulesRevision: 1, installed: false, hasState: false })

    const activateV1 = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${pluginId}/activate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stars-Member': created.member.memberId,
          'X-Stars-Room-Token': created.member.roomToken,
        },
        body: JSON.stringify({
          memberId: created.member.memberId,
          expectedRulesRevision: 1,
          expectedActive: null,
          stagedVersion: '1.0.0',
          stagedIntegrity: v1.integrity,
          stateSchemaVersion: 1,
          data: { counter: 1 },
        }),
      },
    )
    expect(activateV1.status).toBe(200)
    const activeV1 = await activateV1.json() as { revision: number; requiredPlugins: Array<Record<string, unknown>> }
    expect(activeV1).toMatchObject({
      revision: 2,
      requiredPlugins: [{ id: pluginId, version: '1.0.0', integrity: v1.integrity, stateSchemaVersion: 1 }],
    })

    const v2Bytes = Buffer.from('export default atomicV2')
    const v2 = await stage('2.0.0', 2, v2Bytes)
    expect(v2.rules).toMatchObject({ revision: 2 })
    const staleActivation = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${pluginId}/activate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stars-Member': created.member.memberId,
          'X-Stars-Room-Token': created.member.roomToken,
        },
        body: JSON.stringify({
          memberId: created.member.memberId,
          expectedRulesRevision: 1,
          expectedActive: activeV1.requiredPlugins[0],
          stagedVersion: '2.0.0',
          stagedIntegrity: v2.integrity,
          stateSchemaVersion: 2,
          data: { counter: 1, migrated: true },
        }),
      },
    )
    expect(staleActivation.status).toBe(409)
    expect(await staleActivation.json()).toMatchObject({ error: 'rules-revision-conflict' })

    const afterConflict = await fetch(`${offServer.base}/api/rooms/${created.roomId}/rules`, {
      headers: { 'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken },
    })
    expect(await afterConflict.json()).toMatchObject({
      revision: 2,
      requiredPlugins: [{ version: '1.0.0', integrity: v1.integrity, stateSchemaVersion: 1 }],
    })

    const migrationResponse = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${pluginId}/migration-state`,
      { headers: { 'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken } },
    )
    const migration = await migrationResponse.json() as {
      rulesRevision: number
      active: Record<string, unknown>
      stateSchemaVersion: number
      data: unknown
    }
    expect(migration).toMatchObject({ rulesRevision: 2, stateSchemaVersion: 1, data: { counter: 1 } })
    const activateV2 = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${pluginId}/activate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stars-Member': created.member.memberId,
          'X-Stars-Room-Token': created.member.roomToken,
        },
        body: JSON.stringify({
          memberId: created.member.memberId,
          expectedRulesRevision: migration.rulesRevision,
          expectedActive: migration.active,
          stagedVersion: '2.0.0',
          stagedIntegrity: v2.integrity,
          stateSchemaVersion: 2,
          data: { counter: 1, migrated: true },
        }),
      },
    )
    expect(activateV2.status).toBe(200)
    expect(await activateV2.json()).toMatchObject({
      revision: 3,
      requiredPlugins: [{ version: '2.0.0', integrity: v2.integrity, stateSchemaVersion: 2 }],
    })

    const download = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${pluginId}`,
      { headers: { 'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken } },
    )
    expect(download.status).toBe(200)
    expect(download.headers.get('x-stars-plugin-state-schema')).toBe('2')
    expect(Buffer.from(await download.arrayBuffer())).toEqual(v2Bytes)
  })
})

describe('房间临时内容合集', () => {
  it('只接受正文裁剪后的 V2 包，并在 DM 关闭房间时删除托管文件', async () => {
    const createResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: '临时合集测试',
        displayName: '临时合集 DM',
        rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: `ephemeral-dm-${Date.now()}`,
        activePlugins: [],
      }),
    })
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json() as {
      roomId: string
      member: { memberId: string; roomToken: string }
    }
    const pluginId = 'local.example.room-runtime'
    const placeholder = '房间临时机械数据；原始规则正文未传输。'
    const runtimePackage = {
      format: 'dndstars5e-content',
      schemaVersion: 2,
      manifest: {
        id: pluginId,
        name: 'Room Runtime',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Local DM',
        license: 'Private local use',
        description: placeholder,
        distributionPolicy: 'room-ephemeral',
        contentCategory: 'mixed',
      },
      provenance: {
        edition: '2014',
        contentMode: 'incremental',
        sourceTitle: placeholder,
        projection: 'room-runtime-mechanics',
      },
      assets: [],
      content: {
        races: [], backgrounds: [], features: [], feats: [], spells: [], items: [],
        abilityGenerationMethods: [], headlessActions: [], subclasses: [], monsters: [],
      },
    }
    const bytes = Buffer.from(JSON.stringify(runtimePackage))
    const integrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
    const memberHeaders = {
      'X-Stars-Member': created.member.memberId,
      'X-Stars-Room-Token': created.member.roomToken,
    }
    const upload = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${pluginId}`,
      {
        method: 'PUT',
        headers: {
          ...memberHeaders,
          'Content-Type': 'application/json',
          'X-Stars-Plugin-Version': '1.0.0',
          'X-Stars-Plugin-Integrity': integrity,
          'X-Stars-Plugin-Filename': encodeURIComponent('room-runtime.dndstars5e'),
          'X-Stars-Plugin-Name': encodeURIComponent('Room Runtime'),
          'X-Stars-Plugin-Publisher': encodeURIComponent('Local DM'),
          'X-Stars-Plugin-License': encodeURIComponent('Private local use'),
          'X-Stars-Plugin-Distribution-Policy': 'room-ephemeral',
        },
        body: bytes,
      },
    )
    expect(upload.status).toBe(200)
    expect(await upload.json()).toMatchObject({
      plugins: [{ id: pluginId, distributionPolicy: 'room-ephemeral' }],
    })
    const pluginDirectory = path.join(offServer.sharedRoot, 'lobby', 'plugins', created.roomId)
    expect(await readdir(pluginDirectory)).toHaveLength(1)

    const close = await fetch(`${offServer.base}/api/rooms/${created.roomId}/close`, {
      method: 'POST',
      headers: { ...memberHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: created.member.memberId }),
    })
    expect(close.status).toBe(200)
    expect(await readdir(pluginDirectory)).toEqual([])
  })
})

describe('房间大厅协议', () => {
  it('玩家离开后可用浏览器恢复身份重新加入，DM 名册只显示当前成员', async () => {
    const createResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: '重连身份测试', displayName: '重连 DM',
        rulesetId: 'dnd5e-2014-srd-5.1', clientId: `resume-dm-${Date.now()}`,
      }),
    })
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json() as { roomId: string; member: { memberId: string; roomToken: string } }
    const roomPath = `${offServer.base}/api/rooms/${created.roomId}`
    const clientId = `resume-player-${Date.now()}`
    const joinedResponse = await fetch(`${roomPath}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '重连玩家', clientId }),
    })
    expect(joinedResponse.status).toBe(200)
    const joined = await joinedResponse.json() as { member: { memberId: string; roomToken: string; slot: string } }

    const roster = () => fetch(`${roomPath}/roster`, {
      headers: { 'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken },
    }).then((response) => response.json()) as Promise<{ players: Array<{ memberId: string }> }>
    expect((await roster()).players.map((player) => player.memberId)).toEqual([joined.member.memberId])

    expect((await fetch(`${roomPath}/leave`, {
      method: 'POST', headers: {
        'Content-Type': 'application/json',
        'X-Stars-Member': joined.member.memberId,
        'X-Stars-Room-Token': joined.member.roomToken,
      },
      body: JSON.stringify({ memberId: joined.member.memberId }),
    })).status).toBe(200)
    expect((await roster()).players).toEqual([
      expect.objectContaining({ memberId: joined.member.memberId, status: 'left', online: false }),
    ])

    const resumedResponse = await fetch(`${roomPath}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: '重连玩家', clientId, resumeMemberId: joined.member.memberId,
      }),
    })
    expect(resumedResponse.status).toBe(200)
    expect(await resumedResponse.json()).toMatchObject({
      member: { memberId: joined.member.memberId, slot: joined.member.slot },
    })
    expect((await roster()).players.map((player) => player.memberId)).toEqual([joined.member.memberId])
  })

  it('创建者成为 DM，并发加入原子分配三个玩家席位，关闭后拒绝加入', async () => {
    const pluginBytes = Buffer.from('export default { manifest: { id: "com.example.room-rules" } }')
    const roomPlugin = {
      id: 'com.example.room-rules',
      version: '1.0.0',
      integrity: `sha256-${createHash('sha256').update(pluginBytes).digest('base64')}`,
    }
    const createResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: 'HTTP 联调战役',
        displayName: '测试 DM',
        rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'http-test-dm-client',
        activePlugins: [roomPlugin],
      }),
    })
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json() as {
      roomId: string
      member: { memberId: string; roomToken: string; role: string }
      rules: { requiredPlugins: unknown[]; member: { ready: boolean } }
    }
    expect(created.member.role).toBe('dm')
    expect(created.roomId).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    expect(created.rules).toMatchObject({ requiredPlugins: [], member: { ready: true } })

    const forbiddenUpload = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${roomPlugin.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/javascript',
          'X-Stars-Member': 'not-the-dm-member',
          'X-Stars-Plugin-Version': roomPlugin.version,
          'X-Stars-Plugin-Integrity': roomPlugin.integrity,
          'X-Stars-Plugin-Name': encodeURIComponent('HTTP 测试规则包'),
          'X-Stars-Plugin-Publisher': encodeURIComponent('测试发布者'),
          'X-Stars-Plugin-License': encodeURIComponent('CC0-1.0'),
          'X-Stars-Plugin-Distribution-Policy': 'room-distributable',
        },
        body: pluginBytes,
      },
    )
    expect(forbiddenUpload.status).toBe(403)

    const uploadResponse = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${roomPlugin.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/javascript',
          'X-Stars-Member': created.member.memberId,
          'X-Stars-Room-Token': created.member.roomToken,
          'X-Stars-Plugin-Version': roomPlugin.version,
          'X-Stars-Plugin-Integrity': roomPlugin.integrity,
          'X-Stars-Plugin-Filename': encodeURIComponent('room-rules.dndstars5e'),
          'X-Stars-Plugin-Name': encodeURIComponent('HTTP 测试规则包'),
          'X-Stars-Plugin-Publisher': encodeURIComponent('测试发布者'),
          'X-Stars-Plugin-License': encodeURIComponent('CC0-1.0'),
          'X-Stars-Plugin-Distribution-Policy': 'room-distributable',
        },
        body: pluginBytes,
      },
    )
    expect(uploadResponse.status).toBe(200)
    expect(await uploadResponse.json()).toMatchObject({ requiredPlugins: [roomPlugin] })

    const previewResponse = await fetch(`${offServer.base}/api/rooms/${created.roomId}/preview`)
    expect(previewResponse.status).toBe(200)
    expect(await previewResponse.json()).toMatchObject({
      dmDisplayName: '测试 DM',
      hostOnline: true,
      plugins: [{
        ...roomPlugin,
        name: 'HTTP 测试规则包',
        publisher: '测试发布者',
        license: 'CC0-1.0',
      }],
    })

    const joins = await Promise.all(Array.from({ length: 4 }, (_, index) =>
      fetch(`${offServer.base}/api/rooms/${created.roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: `玩家${index + 1}`,
          clientId: `http-test-player-${index + 1}`,
          activePlugins: index === 0 ? [roomPlugin] : [],
        }),
      }),
    ))
    expect(joins.map((response) => response.status).sort()).toEqual([200, 200, 200, 409])
    const successful = await Promise.all(joins
      .map((response, requestIndex) => ({ response, requestIndex }))
      .filter(({ response }) => response.ok)
      .map(async ({ response, requestIndex }) => ({
        requestIndex,
        ...await response.json() as {
          member: { memberId: string; roomToken: string; role: string; slot: string }
          rules: { member: { ready: boolean } }
        },
      })))
    expect(successful.map((result) => result.member.slot).sort()).toEqual(['player1', 'player2', 'player3'])
    expect(successful.every((result) => result.member.role === 'player')).toBe(true)
    expect(successful.every((result) =>
      result.rules.member.ready === (result.requestIndex === 0))).toBe(true)

    const downloadResponse = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${roomPlugin.id}`,
      { headers: { 'X-Stars-Member': successful[0].member.memberId, 'X-Stars-Room-Token': successful[0].member.roomToken } },
    )
    expect(downloadResponse.status).toBe(200)
    expect(Buffer.from(await downloadResponse.arrayBuffer())).toEqual(pluginBytes)
    expect(downloadResponse.headers.get('x-stars-plugin-integrity')).toBe(roomPlugin.integrity)

    const rulesResponse = await fetch(`${offServer.base}/api/rooms/${created.roomId}/rules`, {
      headers: { 'X-Stars-Member': successful[0].member.memberId, 'X-Stars-Room-Token': successful[0].member.roomToken },
    })
    expect(rulesResponse.status).toBe(200)
    const playerRules = await rulesResponse.json() as {
      schemaVersion: number
      revision: number
      hash: string
      houseRules: { declarativeAbilityDamageMultiplier: number }
      requiredPlugins: unknown[]
    }
    expect(playerRules).toMatchObject({
      schemaVersion: 1,
      houseRules: { declarativeAbilityDamageMultiplier: 1 },
      requiredPlugins: [roomPlugin],
    })
    expect(playerRules.hash).toMatch(/^sha256-/)

    const forbiddenRulesUpdate = await fetch(`${offServer.base}/api/rooms/${created.roomId}/rules`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Member': successful[0].member.memberId,
        'X-Stars-Room-Token': successful[0].member.roomToken,
      },
      body: JSON.stringify({ memberId: successful[0].member.memberId, requiredPlugins: [] }),
    })
    expect(forbiddenRulesUpdate.status).toBe(403)

    const dmRulesUpdate = await fetch(`${offServer.base}/api/rooms/${created.roomId}/rules`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Member': created.member.memberId,
        'X-Stars-Room-Token': created.member.roomToken,
      },
      body: JSON.stringify({
        memberId: created.member.memberId,
        requiredPlugins: [roomPlugin],
        houseRules: {
          declarativeAbilityDamageMultiplier: 2,
          combatBannersEnabled: false,
          spellAnimationsEnabled: false,
          spellcastingPrerequisitesEnabled: false,
          encumbranceEnabled: false,
        },
      }),
    })
    expect(dmRulesUpdate.status).toBe(200)
    const updatedRules = await dmRulesUpdate.json() as typeof playerRules
    expect(updatedRules).toMatchObject({
      schemaVersion: 1,
      revision: playerRules.revision + 1,
      houseRules: {
        declarativeAbilityDamageMultiplier: 2,
        combatBannersEnabled: false,
        spellAnimationsEnabled: false,
        spellcastingPrerequisitesEnabled: false,
        encumbranceEnabled: false,
      },
      requiredPlugins: [roomPlugin],
    })
    expect(updatedRules.hash).not.toBe(playerRules.hash)

    const rosterResponse = await fetch(`${offServer.base}/api/rooms/${created.roomId}/roster`, {
      headers: { 'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken },
    })
    expect(rosterResponse.status).toBe(200)
    const roster = await rosterResponse.json() as {
      players: Array<{ displayName: string; slot: string; online: boolean; ready: boolean }>
    }
    expect(roster.players).toHaveLength(3)
    expect(roster.players.map((player) => player.slot).sort()).toEqual(['player1', 'player2', 'player3'])
    expect(roster.players.every((player) => player.online)).toBe(true)
    expect((await fetch(`${offServer.base}/api/rooms/${created.roomId}/roster`, {
      headers: { 'X-Stars-Member': 'not-the-dm-member' },
    })).status).toBe(403)

    const deletePluginResponse = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${roomPlugin.id}`,
      { method: 'DELETE', headers: { 'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken } },
    )
    expect(deletePluginResponse.status).toBe(200)
    expect(await deletePluginResponse.json()).toMatchObject({ requiredPlugins: [] })
    const pluginSafetySnapshots = await fetch(
      `${offServer.base}/api/campaign/snapshots?room=${created.roomId}`,
      { headers: { 'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken } },
    )
    expect(pluginSafetySnapshots.status).toBe(200)
    expect((await pluginSafetySnapshots.json() as { snapshots: Array<{ kind: string }> }).snapshots
      .filter((snapshot) => snapshot.kind === 'pre-plugin-change')).toHaveLength(2)
    expect((await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${roomPlugin.id}`,
      { headers: { 'X-Stars-Member': successful[0].member.memberId, 'X-Stars-Room-Token': successful[0].member.roomToken } },
    )).status).toBe(404)

    const closeResponse = await fetch(`${offServer.base}/api/rooms/${created.roomId}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Member': created.member.memberId,
        'X-Stars-Room-Token': created.member.roomToken,
      },
      body: JSON.stringify({ memberId: created.member.memberId }),
    })
    expect(closeResponse.status).toBe(200)
    const lateJoin = await fetch(`${offServer.base}/api/rooms/${created.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '迟到玩家', clientId: 'http-test-player-late' }),
    })
    expect(lateJoin.status).toBe(409)
    expect(await lateJoin.json()).toMatchObject({ error: 'room-closed' })
  })
})

describe('AC2 — DM 权威资源鉴权（flag ON）', () => {
  it('combat 无 secret ⇒ 401', async () => {
    expect((await putState(onServer.base, 'combat', { active: false })).status).toBe(401)
  })
  it('combat 错 secret ⇒ 403', async () => {
    expect(
      (await putState(onServer.base, 'combat', { active: false }, { 'X-Stars-Secret': 'wrong' })).status,
    ).toBe(403)
  })
  it('combat 正确 secret ⇒ 200', async () => {
    expect(
      (await putState(onServer.base, 'combat', { active: false }, { 'X-Stars-Secret': SECRET })).status,
    ).toBe(200)
  })
})

describe('AC5/AC3/AC1 — 404 / 413 / 锁', () => {
  it('公开服务协议版本、构建标识和启动时间', async () => {
    const response = await fetch(`${offServer.base}/api/meta`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      service: 'dndstars-5e-shared',
      rulesetId: 'dnd5e-2014-srd-5.1',
      protocolVersion: 5,
      minimumClientProtocol: 5,
    })
  })

  it('未匹配 /api/* ⇒ 404（非 index.html）', async () => {
    const res = await fetch(`${offServer.base}/api/does-not-exist`)
    expect(res.status).toBe(404)
    expect(await res.text()).not.toContain('<!doctype')
  })

  it('超大 PUT ⇒ 413', async () => {
    const huge = 'x'.repeat(9 * 1024 * 1024)
    const res = await fetch(`${offServer.base}/api/state/characters`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blob: huge }),
    })
    expect(res.status).toBe(413)
  })

  it('两个并发 PUT：updatedAt=2 胜出，无丢更新、无半写（AC1 锁 + AC6 winner）', async () => {
    await Promise.all([
      putState(offServer.base, 'maps', { maps: [{ id: 'a' }], updatedAt: 1 }),
      putState(offServer.base, 'maps', { maps: [{ id: 'b' }], updatedAt: 2 }),
    ])
    const data = await (await fetch(`${offServer.base}/api/state/maps`)).json()
    // 完整 JSON（非半写交错）+ 较新的 updatedAt=2 胜出（freshness guard 不让 1 冲掉 2）。
    expect(Array.isArray(data.maps)).toBe(true)
    expect(data.updatedAt).toBe(2)
    expect(data.maps[0].id).toBe('b')
  })

  it('freshness-reject：较旧 updatedAt 在较新之后写入被拒，磁盘保留较新（AC6）', async () => {
    await putState(offServer.base, 'fresh-maps', { maps: [{ id: 'new' }], updatedAt: 5 })
    // HTTP 仍 200（freshness 拒绝是静默的），但磁盘内容不被回退。
    const res = await putState(offServer.base, 'fresh-maps', { maps: [{ id: 'old' }], updatedAt: 3 })
    expect(res.status).toBe(200)
    const data = await (await fetch(`${offServer.base}/api/state/fresh-maps`)).json()
    expect(data.updatedAt).toBe(5)
    expect(data.maps[0].id).toBe('new')
  })

  it('atomically appends concurrent Headless logs and invalidates both DM/player subscribers', async () => {
    const createdResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: 'Combat log sync',
        displayName: 'DM',
        rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'combat-log-dm',
        activePlugins: [],
      }),
    })
    expect(createdResponse.status).toBe(201)
    const created = await createdResponse.json() as {
      roomId: string
      member: { memberId: string; roomToken: string }
    }
    const joinedResponse = await fetch(`${offServer.base}/api/rooms/${created.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Player', clientId: 'combat-log-player' }),
    })
    expect(joinedResponse.status).toBe(200)
    const joined = await joinedResponse.json() as {
      member: { memberId: string; roomToken: string }
    }
    const query = `?room=${created.roomId}`
    const headersFor = (member: { memberId: string; roomToken: string }) => ({
      'Content-Type': 'application/json',
      'X-Stars-Protocol': '5',
      'X-Stars-Member': member.memberId,
      'X-Stars-Room-Token': member.roomToken,
    })
    const dmHeaders = headersFor(created.member)
    const playerHeaders = headersFor(joined.member)
    const eventStream = await fetch(`${offServer.base}/api/events/_all${query}`, {
      headers: playerHeaders,
    })
    const eventReader = eventStream.body?.getReader()
    expect(eventReader).toBeDefined()
    expect(new TextDecoder().decode((await eventReader!.read()).value)).toContain('event: ready')

    const append = (
      headers: Record<string, string>,
      entry: Record<string, unknown>,
    ) => fetch(`${offServer.base}/api/state/combat-log/entry${query}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ operation: 'append', mapId: 'combat-log-map', entry }),
    })
    const [dmAppend, playerAppend] = await Promise.all([
      append(dmHeaders, {
        id: 9001,
        round: 2,
        text: 'DM Headless settlement',
        kind: 'attack',
        time: '10:01',
        actorTokenId: 'monster-token',
        details: ['attack hits'],
      }),
      append(playerHeaders, {
        id: 9002,
        round: 2,
        text: 'Player Headless settlement',
        kind: 'damage',
        time: '10:01',
        actorTokenId: 'player-token',
        details: ['damage applied'],
      }),
    ])
    expect([dmAppend.status, playerAppend.status]).toEqual([200, 200])
    const invalidation = await Promise.race([
      eventReader!.read(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('combat-log-invalidation-timeout')), 2_000).unref()
      }),
    ])
    expect(new TextDecoder().decode(invalidation.value)).toContain('"name":"combat-log"')
    await eventReader!.cancel()

    const [dmState, playerState] = await Promise.all([
      fetch(`${offServer.base}/api/state/combat-log${query}`, { headers: dmHeaders }).then((response) => response.json()),
      fetch(`${offServer.base}/api/state/combat-log${query}`, { headers: playerHeaders }).then((response) => response.json()),
    ]) as Array<{ entries: Array<{ id: number; actorTokenId?: string; details?: string[] }> }>
    for (const state of [dmState, playerState]) {
      expect(state.entries.map((entry) => entry.id).sort()).toEqual([9001, 9002])
      expect(state.entries.find((entry) => entry.id === 9001)).toMatchObject({
        actorTokenId: 'monster-token',
        details: ['attack hits'],
      })
      expect(state.entries.find((entry) => entry.id === 9002)).toMatchObject({
        actorTokenId: 'player-token',
        details: ['damage applied'],
      })
    }

    const truncateBody = JSON.stringify({
      operation: 'truncate-after',
      mapId: 'combat-log-map',
      targetEntryId: 9001,
    })
    const playerTruncate = await fetch(`${offServer.base}/api/state/combat-log/entry${query}`, {
      method: 'PATCH',
      headers: playerHeaders,
      body: truncateBody,
    })
    expect(playerTruncate.status).toBe(403)
    const dmTruncate = await fetch(`${offServer.base}/api/state/combat-log/entry${query}`, {
      method: 'PATCH',
      headers: dmHeaders,
      body: truncateBody,
    })
    expect(dmTruncate.status).toBe(200)
    const truncated = await fetch(`${offServer.base}/api/state/combat-log${query}`, {
      headers: dmHeaders,
    }).then((response) => response.json()) as {
      entries: Array<{ id: number }>
      rollbackCutoffEntryId?: number
    }
    expect(truncated.entries.map((entry) => entry.id)).toEqual([9001])
    expect(truncated.rollbackCutoffEntryId).toBe(9001)
  })

  it('shared boundary rejects retired AP state and log wording from stale clients', async () => {
    await putState(offServer.base, 'combat', {
      active: true,
      enemyApByToken: { goblin: { current: 1, max: 2 } },
      dnd5eTurnEconomyByToken: {},
      updatedAt: 20,
    })
    const combat = await (await fetch(`${offServer.base}/api/state/combat`)).json()
    expect(combat.enemyApByToken).toBeUndefined()

    await putState(offServer.base, 'combat-log', {
      mapId: 'map',
      entries: [{ id: 1, text: '新冒险者 花费 1 AP：移动（10 尺）。剩余 AP 1/2' }],
      updatedAt: 21,
    })
    const log = await (await fetch(`${offServer.base}/api/state/combat-log`)).json()
    expect(log.entries[0].text).toBe('新冒险者 移动（10 尺）。')
  })
})

describe('P0 战役快照、完整导出与还原', () => {
  it('仅允许 DM 建立快照，并在覆盖前还原完整共享状态', async () => {
    const createResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: '备份测试战役',
        displayName: '备份 DM',
        rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'campaign-backup-test-client',
        activePlugins: [],
      }),
    })
    const created = await createResponse.json() as { roomId: string; member: { memberId: string; roomToken: string } }
    const query = `?room=${created.roomId}`
    const memberHeaders = {
      'X-Stars-Protocol': '5',
      'X-Stars-Member': created.member.memberId,
      'X-Stars-Room-Token': created.member.roomToken,
    }

    expect((await fetch(`${offServer.base}/api/state/characters${query}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Stars-Expected-Revision': '0', ...memberHeaders },
      body: JSON.stringify({ characters: [{ id: 'hero', name: '原始角色' }], updatedAt: 100 }),
    })).status).toBe(200)
    expect((await fetch(`${offServer.base}/api/campaign/snapshots${query}`, { method: 'POST' })).status).toBe(403)

    const snapshotResponse = await fetch(`${offServer.base}/api/campaign/snapshots${query}`, {
      method: 'POST', headers: memberHeaders,
    })
    expect(snapshotResponse.status).toBe(201)
    const snapshot = await snapshotResponse.json() as { id: string }

    const exported = await fetch(`${offServer.base}/api/campaign/export${query}`, { headers: memberHeaders })
    expect(exported.status).toBe(200)
    expect(await exported.json()).toMatchObject({
      format: 'dndstars5e-campaign',
      schemaVersion: 1,
      room: { id: created.roomId, rulesetId: 'dnd5e-2014-srd-5.1' },
      states: { characters: { characters: [{ id: 'hero', name: '原始角色' }] } },
    })

    await fetch(`${offServer.base}/api/state/characters${query}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Stars-Expected-Revision': '1', ...memberHeaders },
      body: JSON.stringify({ characters: [{ id: 'hero', name: '被覆盖角色' }], updatedAt: 200 }),
    })
    const restored = await fetch(
      `${offServer.base}/api/campaign/snapshots/${encodeURIComponent(snapshot.id)}/restore${query}`,
      { method: 'POST', headers: memberHeaders },
    )
    expect(restored.status).toBe(200)
    const state = await (await fetch(`${offServer.base}/api/state/characters${query}`, { headers: memberHeaders })).json()
    expect(state.characters[0].name).toBe('原始角色')
  })

  it('隔离结构损坏的上传且不覆盖最后一份好状态', async () => {
    const goodUpdatedAt = Date.now() + 1_000
    await putState(offServer.base, 'characters', { characters: [], updatedAt: goodUpdatedAt })
    const invalid = await putState(offServer.base, 'characters', { characters: 'broken', updatedAt: goodUpdatedAt + 1 })
    expect(invalid.status).toBe(422)
    expect(await invalid.json()).toMatchObject({ error: 'invalid-state', name: 'characters' })
    expect(await (await fetch(`${offServer.base}/api/state/characters`)).json()).toMatchObject({
      characters: [], updatedAt: goodUpdatedAt,
    })
  })
})

describe('P1 房间管理与共享状态 CAS', () => {
  it('用版本号阻止并发旧写入，并拒绝旧浏览器协议', async () => {
    const first = await fetch(`${offServer.base}/api/state/p1-cas`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:6173',
        'X-Stars-Protocol': '5',
        'X-Stars-Writer': 'test-dm',
        'X-Stars-Expected-Revision': '0',
      },
      body: JSON.stringify({ value: 'initial', updatedAt: 1 }),
    })
    expect(first.status).toBe(200)
    expect(first.headers.get('x-stars-state-revision')).toBe('1')

    const concurrentHeaders = {
      'Content-Type': 'application/json',
      Origin: 'http://127.0.0.1:6173',
      'X-Stars-Protocol': '5',
      'X-Stars-Writer': 'test-client',
      'X-Stars-Expected-Revision': '1',
    }
    const concurrent = await Promise.all([
      fetch(`${offServer.base}/api/state/p1-cas`, { method: 'PUT', headers: concurrentHeaders, body: JSON.stringify({ value: 'a', updatedAt: 2 }) }),
      fetch(`${offServer.base}/api/state/p1-cas`, { method: 'PUT', headers: concurrentHeaders, body: JSON.stringify({ value: 'b', updatedAt: 3 }) }),
    ])
    expect(concurrent.map((response) => response.status).sort()).toEqual([200, 409])
    const stored = await (await fetch(`${offServer.base}/api/state/p1-cas`)).json()
    expect(stored._sync).toMatchObject({ schemaVersion: 1, revision: 2 })

    const oldBrowser = await fetch(`${offServer.base}/api/state/p1-cas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:6173' },
      body: JSON.stringify({ value: 'old-browser', updatedAt: Date.now() }),
    })
    expect(oldBrowser.status).toBe(426)
    expect(await oldBrowser.json()).toMatchObject({ error: 'client-protocol-outdated' })

    const deleted = await fetch(`${offServer.base}/api/state/p1-cas`, {
      method: 'DELETE',
      headers: {
        Origin: 'http://127.0.0.1:6173',
        'X-Stars-Protocol': '5',
        'X-Stars-Writer': 'test-dm',
        'X-Stars-Expected-Revision': '2',
      },
    })
    expect(deleted.status).toBe(200)
    expect(deleted.headers.get('x-stars-state-revision')).toBe('3')
    const tombstone = await fetch(`${offServer.base}/api/state/p1-cas`)
    expect(tombstone.status).toBe(404)
    expect(tombstone.headers.get('x-stars-state-revision')).toBe('3')
    const staleRecreate = await fetch(`${offServer.base}/api/state/p1-cas`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:6173',
        'X-Stars-Protocol': '5',
        'X-Stars-Writer': 'stale-client',
        'X-Stars-Expected-Revision': '2',
      },
      body: JSON.stringify({ value: 'stale-recreate', updatedAt: Date.now() }),
    })
    expect(staleRecreate.status).toBe(409)
  })

  it('支持密码、1～8人容量、锁房、踢人和安全转让 DM', async () => {
    const createdResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: 'P1 管理房间',
        displayName: '原 DM',
        rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'p1-admin-dm-client',
        activePlugins: [],
        password: 'swordfish',
        maxPlayers: 4,
      }),
    })
    expect(createdResponse.status).toBe(201)
    const created = await createdResponse.json() as { roomId: string; member: { memberId: string; roomToken: string } }
    const roomPath = `${offServer.base}/api/rooms/${created.roomId}`
    const preview = await (await fetch(`${roomPath}/preview`)).json()
    expect(preview).toMatchObject({ passwordRequired: true, locked: false, maxPlayers: 4, playerCount: 0 })

    const join = (clientId: string, displayName: string, password = 'swordfish') => fetch(`${roomPath}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, displayName, password, activePlugins: [] }),
    })
    expect((await join('p1-wrong-password-client', '错误密码', 'wrong')).status).toBe(403)
    const playerAResponse = await join('p1-player-a-client', '玩家甲')
    const playerBResponse = await join('p1-player-b-client', '玩家乙')
    const playerA = await playerAResponse.json() as { member: { memberId: string; roomToken: string; slot: string } }
    const playerB = await playerBResponse.json() as { member: { memberId: string; roomToken: string; slot: string } }
    expect([playerA.member.slot, playerB.member.slot]).toEqual(['player1', 'player2'])

    const admin = (body: Record<string, unknown>) => fetch(`${roomPath}/admin`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Member': created.member.memberId,
        'X-Stars-Room-Token': created.member.roomToken,
      },
      body: JSON.stringify({ memberId: created.member.memberId, ...body }),
    })
    expect((await admin({ operation: 'set-lock', locked: true })).status).toBe(200)
    expect((await join('p1-locked-client', '被锁玩家')).status).toBe(409)
    expect((await admin({ operation: 'set-lock', locked: false })).status).toBe(200)
    expect((await admin({ operation: 'set-capacity', maxPlayers: 6 })).status).toBe(200)

    expect((await admin({ operation: 'kick', targetMemberId: playerA.member.memberId })).status).toBe(200)
    const kickedHeartbeat = await fetch(`${roomPath}/heartbeat`, {
      method: 'POST', headers: {
        'Content-Type': 'application/json',
        'X-Stars-Member': playerA.member.memberId,
        'X-Stars-Room-Token': playerA.member.roomToken,
      },
      body: JSON.stringify({ memberId: playerA.member.memberId, activePlugins: [] }),
    })
    expect(kickedHeartbeat.status).toBe(403)
    expect(await kickedHeartbeat.json()).toEqual({ error: 'member-removed' })
    const kickedDataHeaders = {
      'Content-Type': 'application/json', 'X-Stars-Protocol': '5',
      'X-Stars-Member': playerA.member.memberId, 'X-Stars-Room-Token': playerA.member.roomToken,
    }
    const kickedStateRead = await fetch(`${offServer.base}/api/state/characters?room=${created.roomId}`, {
      headers: kickedDataHeaders,
    })
    expect(kickedStateRead.status).toBe(403)
    expect(await kickedStateRead.json()).toEqual({ error: 'member-removed' })
    const kickedEvent = await fetch(`${offServer.base}/api/events/map-tabletop?room=${created.roomId}`, {
      method: 'POST', headers: kickedDataHeaders,
      body: JSON.stringify({ type: 'ping', mapId: 'map', point: { x: 1, y: 1 } }),
    })
    expect(kickedEvent.status).toBe(403)
    expect(await kickedEvent.json()).toEqual({ error: 'member-removed' })

    const transfer = await admin({ operation: 'transfer-dm', targetMemberId: playerB.member.memberId })
    expect(transfer.status).toBe(200)
    expect(await transfer.json()).toMatchObject({ member: { role: 'player', slot: 'player2' } })
    const newDmHeartbeat = await fetch(`${roomPath}/heartbeat`, {
      method: 'POST', headers: {
        'Content-Type': 'application/json',
        'X-Stars-Member': playerB.member.memberId,
        'X-Stars-Room-Token': playerB.member.roomToken,
      },
      body: JSON.stringify({ memberId: playerB.member.memberId, activePlugins: [] }),
    })
    expect(newDmHeartbeat.status).toBe(200)
    expect(await newDmHeartbeat.json()).toMatchObject({ member: { role: 'dm' } })
  })
})

describe('AC3/AC4 — 并发图片 PUT 不撕裂、blob/meta 同源', () => {
  it('两个字节不同、类型不同的并发 PUT：胜者 blob 完整且其 meta 类型与字节同源', async () => {
    const SIZE = 64 * 1024
    const payloadA = Buffer.alloc(SIZE, 0xaa)
    const payloadB = Buffer.alloc(SIZE, 0xbb)
    const putImage = (bytes: Buffer, type: string) =>
      fetch(`${offServer.base}/api/images/concurrent-id`, {
        method: 'PUT',
        headers: { 'Content-Type': type },
        body: new Uint8Array(bytes),
      })
    await Promise.all([putImage(payloadA, 'image/png'), putImage(payloadB, 'image/webp')])

    const res = await fetch(`${offServer.base}/api/images/concurrent-id`)
    expect(res.status).toBe(200)
    const type = res.headers.get('content-type')
    const bytes = Buffer.from(await res.arrayBuffer())
    // blob 必须是两个完整 payload 之一（绝非撕裂/混合）。
    const isA = bytes.length === SIZE && bytes.every((b) => b === 0xaa)
    const isB = bytes.length === SIZE && bytes.every((b) => b === 0xbb)
    expect(isA || isB).toBe(true)
    // meta 类型必须与字节同源（同一次 PUT，不交叉配对）。
    if (isA) expect(type).toBe('image/png')
    if (isB) expect(type).toBe('image/webp')
  })
})

describe('room session capability tokens', () => {
  it('rejects a copied member id and rotates the token when a player resumes', async () => {
    const createdResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: 'Token security',
        displayName: 'DM',
        rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'token-security-dm',
        activePlugins: [],
      }),
    })
    const created = await createdResponse.json() as {
      roomId: string
      member: { memberId: string; roomToken: string }
    }
    const joinedResponse = await fetch(`${offServer.base}/api/rooms/${created.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Player',
        clientId: 'token-security-player',
        activePlugins: [],
      }),
    })
    const joined = await joinedResponse.json() as {
      member: { memberId: string; roomToken: string }
    }
    const stateUrl = `${offServer.base}/api/state/characters?room=${created.roomId}`
    const protocolHeaders = { 'Content-Type': 'application/json', 'X-Stars-Protocol': '5' }
    const stateBody = JSON.stringify({ characters: [], updatedAt: Date.now() })

    const copiedMemberOnly = await fetch(stateUrl, {
      method: 'PUT',
      headers: { ...protocolHeaders, 'X-Stars-Member': joined.member.memberId },
      body: stateBody,
    })
    expect(copiedMemberOnly.status).toBe(403)
    const wrongToken = await fetch(stateUrl, {
      method: 'PUT',
      headers: {
        ...protocolHeaders,
        'X-Stars-Member': joined.member.memberId,
        'X-Stars-Room-Token': created.member.roomToken,
      },
      body: stateBody,
    })
    expect(wrongToken.status).toBe(403)
    const missingProtocol = await fetch(stateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Stars-Member': joined.member.memberId,
        'X-Stars-Room-Token': joined.member.roomToken,
        'X-Stars-Expected-Revision': '0',
      },
      body: stateBody,
    })
    expect(missingProtocol.status).toBe(426)
    const missingRevision = await fetch(stateUrl, {
      method: 'PUT',
      headers: {
        ...protocolHeaders,
        'X-Stars-Member': joined.member.memberId,
        'X-Stars-Room-Token': joined.member.roomToken,
      },
      body: stateBody,
    })
    expect(missingRevision.status).toBe(428)
    expect(await missingRevision.json()).toMatchObject({ error: 'expected-revision-required' })
    const validToken = await fetch(stateUrl, {
      method: 'PUT',
      headers: {
        ...protocolHeaders,
        'X-Stars-Member': joined.member.memberId,
        'X-Stars-Room-Token': joined.member.roomToken,
        'X-Stars-Expected-Revision': '0',
      },
      body: stateBody,
    })
    expect(validToken.status).toBe(200)

    const resumedResponse = await fetch(`${offServer.base}/api/rooms/${created.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Player',
        clientId: 'token-security-player',
        resumeMemberId: joined.member.memberId,
        activePlugins: [],
      }),
    })
    expect(resumedResponse.status).toBe(200)
    const resumed = await resumedResponse.json() as {
      member: { memberId: string; roomToken: string }
    }
    expect(resumed.member.memberId).toBe(joined.member.memberId)
    expect(resumed.member.roomToken).not.toBe(joined.member.roomToken)

    const staleToken = await fetch(stateUrl, {
      headers: {
        'X-Stars-Member': joined.member.memberId,
        'X-Stars-Room-Token': joined.member.roomToken,
      },
    })
    expect(staleToken.status).toBe(403)
    const rotatedToken = await fetch(stateUrl, {
      headers: {
        'X-Stars-Member': resumed.member.memberId,
        'X-Stars-Room-Token': resumed.member.roomToken,
      },
    })
    expect(rotatedToken.status).toBe(200)
  })
})

describe('room privacy projections and event channel ACLs', () => {
  it('projects private state at the server boundary and rejects reversed event channels', async () => {
    const createdResponse = await fetch(`${offServer.base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: 'Privacy boundary', displayName: 'DM', rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'privacy-dm-client', activePlugins: [],
      }),
    })
    const created = await createdResponse.json() as {
      roomId: string
      member: { memberId: string; roomToken: string }
    }
    const joinedResponse = await fetch(`${offServer.base}/api/rooms/${created.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Player', clientId: 'privacy-player-client', activePlugins: [] }),
    })
    const joined = await joinedResponse.json() as {
      member: { memberId: string; roomToken: string }
    }
    const query = `?room=${created.roomId}`
    const dmHeaders = {
      'Content-Type': 'application/json', 'X-Stars-Protocol': '5',
      'X-Stars-Expected-Revision': '0',
      'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken,
    }
    const playerHeaders = {
      'Content-Type': 'application/json', 'X-Stars-Protocol': '5',
      'X-Stars-Member': joined.member.memberId, 'X-Stars-Room-Token': joined.member.roomToken,
    }

    const privateImageId = `private-handout-${Date.now()}`
    const privateImageUrl = `${offServer.base}/api/images/${privateImageId}${query}`
    expect((await fetch(privateImageUrl, {
      method: 'PUT',
      headers: { ...dmHeaders, 'Content-Type': 'image/png', 'X-Stars-Image-Purpose': 'handout' },
      body: new Uint8Array([1, 2, 3]),
    })).status).toBe(200)
    expect((await fetch(privateImageUrl, { headers: playerHeaders })).status).toBe(403)
    const addPrivateHandout = await fetch(`${offServer.base}/api/state/room-journal/mutation${query}`, {
      method: 'PATCH', headers: dmHeaders,
      body: JSON.stringify({
        operation: 'add-handout', title: 'Private clue', imageId: privateImageId,
        audience: [joined.member.memberId],
      }),
    })
    expect(addPrivateHandout.status).toBe(200)
    expect((await fetch(privateImageUrl, { headers: playerHeaders })).status).toBe(200)

    const generalImageId = `general-image-${Date.now()}`
    expect((await fetch(`${offServer.base}/api/images/${generalImageId}${query}`, {
      method: 'PUT', headers: { ...dmHeaders, 'Content-Type': 'image/png' },
      body: new Uint8Array([4, 5, 6]),
    })).status).toBe(200)
    const invalidHandout = await fetch(`${offServer.base}/api/state/room-journal/mutation${query}`, {
      method: 'PATCH', headers: dmHeaders,
      body: JSON.stringify({
        operation: 'add-handout', title: 'Forged clue', imageId: generalImageId, audience: 'all',
      }),
    })
    expect(invalidHandout.status).toBe(400)
    expect(await invalidHandout.json()).toEqual({ error: 'invalid-handout-image' })

    const audioId = `scene-audio-${Date.now()}`
    const audioUrl = `${offServer.base}/api/images/${audioId}${query}`
    expect((await fetch(audioUrl, {
      method: 'PUT',
      headers: { ...dmHeaders, 'Content-Type': 'audio/ogg', 'X-Stars-Image-Purpose': 'scene-audio' },
      body: new Uint8Array([7, 8, 9]),
    })).status).toBe(200)
    expect((await fetch(audioUrl, { headers: playerHeaders })).status).toBe(403)
    const audioCatalogWrite = await fetch(`${offServer.base}/api/state/scene-audio-library${query}`, {
      method: 'PUT', headers: dmHeaders,
      body: JSON.stringify({
        schemaVersion: 1,
        assets: [{
          id: audioId, name: 'Rain', fileName: 'rain.ogg', mimeType: 'audio/ogg',
          sizeBytes: 3, durationSeconds: 60, kind: 'ambience', createdAt: Date.now(),
        }],
        updatedAt: Date.now(),
      }),
    })
    expect(audioCatalogWrite.status).toBe(200)
    expect((await fetch(audioUrl, { headers: playerHeaders })).status).toBe(200)
    expect((await fetch(`${offServer.base}/api/state/scene-audio/playback${query}`, {
      method: 'PATCH', headers: playerHeaders,
      body: JSON.stringify({ operation: 'play', assetId: audioId, loop: true, volume: 0.7 }),
    })).status).toBe(403)
    const audioPlay = await fetch(`${offServer.base}/api/state/scene-audio/playback${query}`, {
      method: 'PATCH', headers: dmHeaders,
      body: JSON.stringify({ operation: 'play', assetId: audioId, loop: true, volume: 0.7 }),
    })
    expect(audioPlay.status).toBe(200)
    const audioPlayback = await audioPlay.json() as { status: string; assetId: string; anchorServerMs: number; updatedAt: number }
    expect(audioPlayback).toMatchObject({ status: 'playing', assetId: audioId })
    expect(audioPlayback.anchorServerMs).toBeGreaterThan(audioPlayback.updatedAt)
    expect((await (await fetch(`${offServer.base}/api/time${query}`, { headers: playerHeaders })).json() as { serverNow: number }).serverNow).toBeGreaterThan(0)

    const characterWrite = await fetch(`${offServer.base}/api/state/characters${query}`, {
      method: 'PUT',
      headers: dmHeaders,
      body: JSON.stringify({
        characters: [
          {
            id: 'owned', roomMemberId: joined.member.memberId, name: 'Owned', visibleToPlayers: true,
            notes: 'own note', backstory: 'own story', dmNotes: 'dm secret', equipment: { armor: 'secret' },
          },
          {
            id: 'party', roomMemberId: 'another-member', name: 'Party', visibleToPlayers: true,
            notes: 'party private', backstory: 'party story', dmNotes: 'party dm secret',
            equipment: { weapon: 'private blade' }, classResources: { spellSlot: { current: 1, max: 1 } },
          },
          { id: 'hidden', name: 'Hidden', visibleToPlayers: false, dmNotes: 'hidden secret' },
        ],
        updatedAt: Date.now(),
      }),
    })
    expect(characterWrite.status).toBe(200)
    const projectedCharacters = await (await fetch(
      `${offServer.base}/api/state/characters${query}`,
      { headers: playerHeaders },
    )).json() as { characters: Array<Record<string, unknown>> }
    expect(projectedCharacters.characters.map((character) => character.id)).toEqual(['owned', 'party'])
    expect(projectedCharacters.characters[0]).toMatchObject({ notes: 'own note', backstory: 'own story' })
    expect(projectedCharacters.characters[0]).not.toHaveProperty('dmNotes')
    expect(projectedCharacters.characters[1]).not.toHaveProperty('notes')
    expect(projectedCharacters.characters[1]).not.toHaveProperty('backstory')
    expect(projectedCharacters.characters[1]).not.toHaveProperty('equipment')
    expect(projectedCharacters.characters[1]).not.toHaveProperty('classResources')

    expect((await fetch(`${offServer.base}/api/state/dice${query}`, {
      method: 'PUT', headers: dmHeaders,
      body: JSON.stringify({ id: 'dark-roll', mapId: 'map', sourceMode: 'dm', visibility: 'dm', values: [20], updatedAt: Date.now() }),
    })).status).toBe(200)
    const darkRoll = await fetch(`${offServer.base}/api/state/dice${query}`, { headers: playerHeaders })
    expect(darkRoll.status).toBe(200)
    expect(await darkRoll.json()).toBeNull()

    const eventUrl = (channel: string) => `${offServer.base}/api/events/${channel}${query}`
    const post = (channel: string, headers: Record<string, string>, body: object) => fetch(eventUrl(channel), {
      method: 'POST', headers, body: JSON.stringify(body),
    })
    const eventStream = await fetch(eventUrl('_all'), { headers: playerHeaders })
    expect(eventStream.status).toBe(200)
    expect(eventStream.headers.get('content-type')).toContain('text/event-stream')
    expect(eventStream.headers.get('cache-control')).toContain('no-transform')
    expect(eventStream.headers.get('x-accel-buffering')).toBe('no')
    const eventReader = eventStream.body?.getReader()
    expect(eventReader).toBeDefined()
    const readyChunk = await eventReader!.read()
    expect(new TextDecoder().decode(readyChunk.value)).toContain('event: ready')
    const dmInvalidation = await fetch(`${offServer.base}/api/state/maps${query}`, {
      method: 'PUT',
      headers: dmHeaders,
      body: JSON.stringify({ maps: [], selectedId: null, updatedAt: Date.now() }),
    })
    expect(dmInvalidation.status).toBe(200)
    const messageChunk = await Promise.race([
      eventReader!.read(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('event-stream-message-timeout')), 2_000).unref()
      }),
    ])
    expect(new TextDecoder().decode(messageChunk.value)).toContain('"name":"maps"')
    await eventReader!.cancel()

    expect((await post('player-action-dm-to-player', playerHeaders, { id: 'forged-ack' })).status).toBe(403)
    expect((await post('player-action-player-to-dm', dmHeaders, { id: 'forged-request' })).status).toBe(403)
    expect((await post('shared-state-changed', playerHeaders, { name: 'maps' })).status).toBe(403)
    expect((await post('combat-presentation', playerHeaders, { id: 'forged-animation' })).status).toBe(403)
    expect((await post('combat-presentation', dmHeaders, {
      schemaVersion: 1,
      id: 'fire-bolt-animation-1',
      type: 'spell-projectile',
      mapId: 'map',
      transactionId: 'transaction-1',
      spellId: 'fire-bolt',
      sourceTokenId: 'wizard',
      targetTokenId: 'goblin',
      outcome: 'hit',
    })).status).toBe(200)
    expect((await post('combat-presentation', dmHeaders, {
      schemaVersion: 1,
      id: 'shatter-animation-1:spell-banner',
      type: 'spell-banner',
      mapId: 'map',
      transactionId: 'shatter-transaction-1',
      spellId: 'shatter',
      sourceTokenId: 'bard',
      casterName: '吟游诗人',
      spellName: '粉碎音波',
      castingClassId: 'bard',
    })).status).toBe(200)
    expect((await post('combat-presentation', dmHeaders, {
      schemaVersion: 1,
      id: 'fighter-longbow-1:attack-banner',
      type: 'attack-banner',
      mapId: 'map',
      transactionId: 'fighter-longbow-1',
      sourceTokenId: 'fighter',
      targetTokenId: 'goblin',
      actorName: '战士',
      attackName: '长弓',
      attackKind: 'ranged',
      classId: 'fighter',
    })).status).toBe(200)
    expect((await post('combat-presentation', dmHeaders, {
      schemaVersion: 1,
      id: 'thunderwave-animation-1:spell-banner',
      type: 'spell-banner',
      mapId: 'map',
      transactionId: 'thunderwave-transaction-1',
      spellId: 'thunderwave',
      sourceTokenId: 'bard',
      casterName: '吟游诗人',
      spellName: '雷鸣波',
      castingClassId: 'bard',
    })).status).toBe(200)
    expect((await post('combat-presentation', dmHeaders, {
      schemaVersion: 1,
      id: 'thunderwave-1:con-save:goblin',
      type: 'saving-throw-status',
      mapId: 'map',
      transactionId: 'thunderwave-1',
      sourceTokenId: 'goblin',
      targetTokenId: 'goblin',
      targetName: '地精',
      ability: 'con',
      phase: 'rolling',
      dc: 15,
    })).status).toBe(200)
    expect((await post('unregistered-private-channel', dmHeaders, { secret: true })).status).toBe(404)
    expect((await post('player-action-player-to-dm', playerHeaders, { id: 'valid-request', sourceMode: 'dm' })).status).toBe(200)
  })
})

describe('账号战役 AI Job V2', () => {
  it('通过本地 Runner 租约原子提交 PDF 草稿，并在刷新后恢复', async () => {
    const accountResponse = await fetch(`${offServer.base}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'AI 备团 DM', clientId: 'ai-job-browser-client' }),
    })
    expect(accountResponse.status).toBe(201)
    const account = await accountResponse.json() as {
      session: { accountId: string; sessionToken: string }
    }
    const headers = {
      'Content-Type': 'application/json',
      'X-Stars-Account-Token': account.session.sessionToken,
    }
    const campaignResponse = await fetch(`${offServer.base}/api/accounts/me/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'AI 持久化战役', rulesetId: 'dnd5e-2014-srd-5.1' }),
    })
    expect(campaignResponse.status).toBe(201)
    const campaign = await campaignResponse.json() as { campaignId: string }
    const jobsUrl = `${offServer.base}/api/accounts/me/campaigns/${campaign.campaignId}/ai-jobs`
    const createResponse = await fetch(jobsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        schemaVersion: 2,
        taskKind: 'campaign-analysis',
        executionMode: 'local-runner',
        providerId: 'local-bridge',
        modelId: 'qwen3.5:35b',
        promptVersion: 'pdf-campaign-analysis-v2',
        idempotencyKey: 'http-ai-job-request-0001',
        sourceAssets: [{ assetId: 'pdf-1', name: '模组.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }],
        input: { depth: 'deep' },
      }),
    })
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json() as { job: { jobId: string; revision: number; status: string } }
    expect(created.job.status).toBe('awaiting-local-runner')

    const leaseResponse = await fetch(`${jobsUrl}/${created.job.jobId}/lease`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ expectedRevision: created.job.revision, runnerId: 'browser-http-runner' }),
    })
    expect(leaseResponse.status).toBe(200)
    const leased = await leaseResponse.json() as {
      leaseToken: string
      job: { revision: number; status: string; lease: Record<string, unknown> }
    }
    expect(leased.job.status).toBe('running')
    expect(leased.job.lease).not.toHaveProperty('tokenHash')
    const duplicateLease = await fetch(`${jobsUrl}/${created.job.jobId}/lease`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ expectedRevision: created.job.revision, runnerId: 'second-browser-runner' }),
    })
    expect(duplicateLease.status).toBe(409)
    await expect(duplicateLease.json()).resolves.toMatchObject({ error: 'ai-job-revision-conflict' })

    const takeoverResponse = await fetch(`${jobsUrl}/${created.job.jobId}/lease`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        expectedRevision: leased.job.revision,
        runnerId: 'browser-http-runner',
        takeoverOwnedLease: true,
      }),
    })
    expect(takeoverResponse.status).toBe(200)
    const takeover = await takeoverResponse.json() as {
      leaseToken: string
      job: { revision: number; status: string }
    }
    expect(takeover.job.status).toBe('running')
    expect(takeover.leaseToken).not.toBe(leased.leaseToken)
    const foreignTakeover = await fetch(`${jobsUrl}/${created.job.jobId}/lease`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        expectedRevision: takeover.job.revision,
        runnerId: 'different-browser-runner',
        takeoverOwnedLease: true,
      }),
    })
    expect(foreignTakeover.status).toBe(409)
    await expect(foreignTakeover.json()).resolves.toMatchObject({ error: 'ai-job-not-leasable' })
    const activeDelete = await fetch(`${jobsUrl}/${created.job.jobId}`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ expectedRevision: takeover.job.revision }),
    })
    expect(activeDelete.status).toBe(409)
    await expect(activeDelete.json()).resolves.toMatchObject({ error: 'ai-job-active' })
    const staleRunnerProgress = await fetch(`${jobsUrl}/${created.job.jobId}/progress`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        expectedRevision: takeover.job.revision,
        leaseToken: leased.leaseToken,
        progress: { stage: 'analyzing', current: 1, total: 3, message: '旧页面不应继续写入' },
      }),
    })
    expect(staleRunnerProgress.status).toBe(409)
    await expect(staleRunnerProgress.json()).resolves.toMatchObject({ error: 'invalid-ai-job-lease' })

    const artifact = {
      schemaVersion: 1,
      kind: 'pdf-campaign-analysis',
      payload: {
        schemaVersion: 1,
        overview: 'DM 可编辑的分析草稿',
        documents: [{ name: '模组.pdf', pageCount: 3, extractedCharacters: 500, scannedPages: [] }],
        analyzedChunks: 1,
        people: [], relationships: [], locations: [], factions: [], clues: [], scenes: [],
        encounters: [], importCandidates: [], prepTips: [], warnings: [],
      },
    }
    const resultResponse = await fetch(`${jobsUrl}/${created.job.jobId}/result`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        expectedRevision: takeover.job.revision,
        leaseToken: takeover.leaseToken,
        artifact,
      }),
    })
    expect(resultResponse.status).toBe(200)
    const result = await resultResponse.json() as {
      job: { revision: number; status: string; artifact: { payload: { overview: string } } }
    }
    expect(result.job).toMatchObject({ status: 'review-required' })
    expect(result.job.artifact.payload.overview).toBe('DM 可编辑的分析草稿')

    const invalidEdit = {
      ...artifact,
      payload: {
        ...artifact.payload,
        people: [{
          name: '越界人物', description: '', role: '', personality: '', motivation: '', secret: '', voice: '',
          citations: [{ documentName: '模组.pdf', page: 4 }],
        }],
      },
    }
    const rejected = await fetch(`${jobsUrl}/${created.job.jobId}/artifact`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ expectedRevision: result.job.revision, artifact: invalidEdit }),
    })
    expect(rejected.status).toBe(400)
    await expect(rejected.json()).resolves.toMatchObject({ error: 'invalid-ai-job-artifact' })

    const listResponse = await fetch(`${jobsUrl}?includeArtifact=1`, { headers })
    expect(listResponse.status).toBe(200)
    await expect(listResponse.json()).resolves.toMatchObject({
      schemaVersion: 2,
      jobs: [{ jobId: created.job.jobId, status: 'review-required', artifact }],
    })

    const failedCreateResponse = await fetch(jobsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        schemaVersion: 2,
        taskKind: 'campaign-analysis',
        executionMode: 'local-runner',
        providerId: 'external-account',
        modelId: 'external:test-model',
        promptVersion: 'pdf-campaign-analysis-v2',
        idempotencyKey: 'http-ai-job-request-failure-0001',
        sourceAssets: [{ assetId: 'pdf-failure', name: '失败模组.pdf', mimeType: 'application/pdf', sizeBytes: 2048 }],
        input: { depth: 'quick' },
      }),
    })
    expect(failedCreateResponse.status).toBe(201)
    const failedCreated = await failedCreateResponse.json() as { job: { jobId: string; revision: number } }
    const failedLeaseResponse = await fetch(`${jobsUrl}/${failedCreated.job.jobId}/lease`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ expectedRevision: failedCreated.job.revision, runnerId: 'browser-failure-runner' }),
    })
    expect(failedLeaseResponse.status).toBe(200)
    const failedLease = await failedLeaseResponse.json() as { leaseToken: string; job: { revision: number } }
    const forgedFailureResponse = await fetch(`${jobsUrl}/${failedCreated.job.jobId}/failure`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        expectedRevision: failedLease.job.revision,
        leaseToken: 'forged-local-runner-lease-token-that-is-invalid',
        failure: { code: 'forged-failure', message: '不应写入' },
      }),
    })
    expect(forgedFailureResponse.status).toBe(409)
    await expect(forgedFailureResponse.json()).resolves.toMatchObject({ error: 'invalid-ai-job-lease' })
    const failureResponse = await fetch(`${jobsUrl}/${failedCreated.job.jobId}/failure`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        expectedRevision: failedLease.job.revision,
        leaseToken: failedLease.leaseToken,
        failure: { code: 'invalid-structured-output', message: '模型返回内容未通过 Host Schema 校验' },
      }),
    })
    expect(failureResponse.status).toBe(200)
    const failedJob = await failureResponse.json() as { job: { revision: number } }
    expect(failedJob).toMatchObject({
      job: {
        status: 'failed',
        lease: null,
        failure: { code: 'invalid-structured-output', message: '模型返回内容未通过 Host Schema 校验' },
      },
    })

    const unauthenticatedDelete = await fetch(`${jobsUrl}/${failedCreated.job.jobId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: failedJob.job.revision }),
    })
    expect(unauthenticatedDelete.status).toBe(401)

    const failedDelete = await fetch(`${jobsUrl}/${failedCreated.job.jobId}`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ expectedRevision: failedJob.job.revision }),
    })
    expect(failedDelete.status).toBe(200)
    await expect(failedDelete.json()).resolves.toEqual({ deleted: true, jobId: failedCreated.job.jobId })

    const accountFileContents = JSON.parse(await readFile(
      path.join(offServer.sharedRoot, 'lobby', 'accounts', `${account.session.accountId}.json`),
      'utf8',
    )) as { campaigns: Array<{ aiWorkspace?: { jobs?: Array<{ jobId: string }> } }> }
    expect(accountFileContents.campaigns[0]?.aiWorkspace?.jobs?.[0]?.jobId).toBe(created.job.jobId)

    const reviewDelete = await fetch(`${jobsUrl}/${created.job.jobId}`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ expectedRevision: result.job.revision }),
    })
    expect(reviewDelete.status).toBe(200)
    const emptyListResponse = await fetch(`${jobsUrl}?includeArtifact=1`, { headers })
    await expect(emptyListResponse.json()).resolves.toMatchObject({ schemaVersion: 2, jobs: [] })
  })
})
