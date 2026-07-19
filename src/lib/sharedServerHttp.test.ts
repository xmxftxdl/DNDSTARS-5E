/// <reference types="node" />
// 端到端回归：真正起 static-server.mjs 子进程，over HTTP 验证。
// 强制要求：玩家 PUT 在 flag OFF 与 flag ON 两种状态下都成功。
// 另验：DM 权威资源 combat 的鉴权三分支、未匹配 /api/* → 404、超大 PUT → 413、并发写锁。
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
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

async function startServer(port: number, extraEnv: Record<string, string>): Promise<Running> {
  const sharedRoot = await mkdtemp(path.join(os.tmpdir(), 'stars-http-'))
  const distRoot = path.join(sharedRoot, 'dist')
  await mkdir(distRoot, { recursive: true })
  await writeFile(path.join(distRoot, 'index.html'), '<!doctype html><title>stars</title>')
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

async function stopServer(r: Running): Promise<void> {
  r.proc.kill('SIGTERM')
  await rm(r.sharedRoot, { recursive: true, force: true }).catch(() => {})
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
  offServer = await startServer(5392, { STARS_SHARED_SECRET: '' })
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

  it('flag ON：玩家写 maps（无 secret）⇒ 200', async () => {
    const res = await putState(onServer.base, 'maps', { maps: [], updatedAt: Date.now() })
    expect(res.status).toBe(200)
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
    const room = await roomResponse.json() as { roomId: string; member: { memberId: string } }

    const joinResponse = await fetch(`${offServer.base}/api/rooms/${room.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Stars-Account-Token': player.session.sessionToken },
      body: JSON.stringify({
        displayName: '账号玩家', clientId: 'account-player-client-1', accountId: player.session.accountId,
        activePlugins: [],
      }),
    })
    expect(joinResponse.status).toBe(200)
    const joined = await joinResponse.json() as { member: { memberId: string } }

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
      headers: { 'Content-Type': 'application/json', 'X-Stars-Account-Token': player.session.sessionToken },
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
      member: { memberId: string }
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
            'X-Stars-Plugin-Version': version,
            'X-Stars-Plugin-State-Schema': String(stateSchemaVersion),
            'X-Stars-Plugin-Integrity': integrity,
            'X-Stars-Plugin-Filename': encodeURIComponent(`${pluginId}-${version}.dndstars5e`),
            'X-Stars-Plugin-Name': encodeURIComponent('原子升级测试包'),
            'X-Stars-Plugin-Publisher': encodeURIComponent('测试发布者'),
            'X-Stars-Plugin-License': encodeURIComponent('CC0-1.0'),
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
      { headers: { 'X-Stars-Member': created.member.memberId } },
    )
    expect(initialStateResponse.status).toBe(200)
    const initialState = await initialStateResponse.json() as { rulesRevision: number; installed: boolean; hasState: boolean }
    expect(initialState).toMatchObject({ rulesRevision: 1, installed: false, hasState: false })

    const activateV1 = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${pluginId}/activate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
      headers: { 'X-Stars-Member': created.member.memberId },
    })
    expect(await afterConflict.json()).toMatchObject({
      revision: 2,
      requiredPlugins: [{ version: '1.0.0', integrity: v1.integrity, stateSchemaVersion: 1 }],
    })

    const migrationResponse = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${pluginId}/migration-state`,
      { headers: { 'X-Stars-Member': created.member.memberId } },
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
        headers: { 'Content-Type': 'application/json' },
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
      { headers: { 'X-Stars-Member': created.member.memberId } },
    )
    expect(download.status).toBe(200)
    expect(download.headers.get('x-stars-plugin-state-schema')).toBe('2')
    expect(Buffer.from(await download.arrayBuffer())).toEqual(v2Bytes)
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
    const created = await createResponse.json() as { roomId: string; member: { memberId: string } }
    const roomPath = `${offServer.base}/api/rooms/${created.roomId}`
    const clientId = `resume-player-${Date.now()}`
    const joinedResponse = await fetch(`${roomPath}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '重连玩家', clientId }),
    })
    expect(joinedResponse.status).toBe(200)
    const joined = await joinedResponse.json() as { member: { memberId: string; slot: string } }

    const roster = () => fetch(`${roomPath}/roster`, {
      headers: { 'X-Stars-Member': created.member.memberId },
    }).then((response) => response.json()) as Promise<{ players: Array<{ memberId: string }> }>
    expect((await roster()).players.map((player) => player.memberId)).toEqual([joined.member.memberId])

    expect((await fetch(`${roomPath}/leave`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      member: { memberId: string; role: string }
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
          'X-Stars-Plugin-Version': roomPlugin.version,
          'X-Stars-Plugin-Integrity': roomPlugin.integrity,
          'X-Stars-Plugin-Filename': encodeURIComponent('room-rules.dndstars5e'),
          'X-Stars-Plugin-Name': encodeURIComponent('HTTP 测试规则包'),
          'X-Stars-Plugin-Publisher': encodeURIComponent('测试发布者'),
          'X-Stars-Plugin-License': encodeURIComponent('CC0-1.0'),
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
    const successful = await Promise.all(joins.filter((response) => response.ok).map((response) => response.json())) as Array<{
      member: { memberId: string; role: string; slot: string }
      rules: { member: { ready: boolean } }
    }>
    expect(successful.map((result) => result.member.slot).sort()).toEqual(['player1', 'player2', 'player3'])
    expect(successful.every((result) => result.member.role === 'player')).toBe(true)
    expect(successful.filter((result) => result.rules.member.ready)).toHaveLength(1)

    const downloadResponse = await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${roomPlugin.id}`,
      { headers: { 'X-Stars-Member': successful[0].member.memberId } },
    )
    expect(downloadResponse.status).toBe(200)
    expect(Buffer.from(await downloadResponse.arrayBuffer())).toEqual(pluginBytes)
    expect(downloadResponse.headers.get('x-stars-plugin-integrity')).toBe(roomPlugin.integrity)

    const rulesResponse = await fetch(`${offServer.base}/api/rooms/${created.roomId}/rules`, {
      headers: { 'X-Stars-Member': successful[0].member.memberId },
    })
    expect(rulesResponse.status).toBe(200)
    expect(await rulesResponse.json()).toMatchObject({ requiredPlugins: [roomPlugin] })

    const forbiddenRulesUpdate = await fetch(`${offServer.base}/api/rooms/${created.roomId}/rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: successful[0].member.memberId, requiredPlugins: [] }),
    })
    expect(forbiddenRulesUpdate.status).toBe(403)

    const rosterResponse = await fetch(`${offServer.base}/api/rooms/${created.roomId}/roster`, {
      headers: { 'X-Stars-Member': created.member.memberId },
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
      { method: 'DELETE', headers: { 'X-Stars-Member': created.member.memberId } },
    )
    expect(deletePluginResponse.status).toBe(200)
    expect(await deletePluginResponse.json()).toMatchObject({ requiredPlugins: [] })
    const pluginSafetySnapshots = await fetch(
      `${offServer.base}/api/campaign/snapshots?room=${created.roomId}`,
      { headers: { 'X-Stars-Member': created.member.memberId } },
    )
    expect(pluginSafetySnapshots.status).toBe(200)
    expect((await pluginSafetySnapshots.json() as { snapshots: Array<{ kind: string }> }).snapshots
      .filter((snapshot) => snapshot.kind === 'pre-plugin-change')).toHaveLength(2)
    expect((await fetch(
      `${offServer.base}/api/rooms/${created.roomId}/plugins/${roomPlugin.id}`,
      { headers: { 'X-Stars-Member': successful[0].member.memberId } },
    )).status).toBe(404)

    const closeResponse = await fetch(`${offServer.base}/api/rooms/${created.roomId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      protocolVersion: 3,
      minimumClientProtocol: 3,
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
    const created = await createResponse.json() as { roomId: string; member: { memberId: string } }
    const query = `?room=${created.roomId}`
    const memberHeaders = { 'X-Stars-Member': created.member.memberId }

    expect((await fetch(`${offServer.base}/api/state/characters${query}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characters: [{ id: 'hero', name: '被覆盖角色' }], updatedAt: 200 }),
    })
    const restored = await fetch(
      `${offServer.base}/api/campaign/snapshots/${encodeURIComponent(snapshot.id)}/restore${query}`,
      { method: 'POST', headers: memberHeaders },
    )
    expect(restored.status).toBe(200)
    const state = await (await fetch(`${offServer.base}/api/state/characters${query}`)).json()
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
        'X-Stars-Protocol': '3',
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
      'X-Stars-Protocol': '3',
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
        'X-Stars-Protocol': '3',
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
        'X-Stars-Protocol': '3',
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
    const created = await createdResponse.json() as { roomId: string; member: { memberId: string } }
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
    const playerA = await playerAResponse.json() as { member: { memberId: string; slot: string } }
    const playerB = await playerBResponse.json() as { member: { memberId: string; slot: string } }
    expect([playerA.member.slot, playerB.member.slot]).toEqual(['player1', 'player2'])

    const admin = (body: Record<string, unknown>) => fetch(`${roomPath}/admin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: created.member.memberId, ...body }),
    })
    expect((await admin({ operation: 'set-lock', locked: true })).status).toBe(200)
    expect((await join('p1-locked-client', '被锁玩家')).status).toBe(409)
    expect((await admin({ operation: 'set-lock', locked: false })).status).toBe(200)
    expect((await admin({ operation: 'set-capacity', maxPlayers: 6 })).status).toBe(200)

    expect((await admin({ operation: 'kick', targetMemberId: playerA.member.memberId })).status).toBe(200)
    const kickedHeartbeat = await fetch(`${roomPath}/heartbeat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: playerA.member.memberId, activePlugins: [] }),
    })
    expect(kickedHeartbeat.status).toBe(403)
    expect(await kickedHeartbeat.json()).toEqual({ error: 'member-removed' })

    const transfer = await admin({ operation: 'transfer-dm', targetMemberId: playerB.member.memberId })
    expect(transfer.status).toBe(200)
    expect(await transfer.json()).toMatchObject({ member: { role: 'player', slot: 'player2' } })
    const newDmHeartbeat = await fetch(`${roomPath}/heartbeat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
