/// <reference types="node" />
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildCombatMessageQueueReset } from './sharedCombatReset'
import {
  compactCombatCommandHistory,
  publishEventBestEffort,
} from '../../scripts/shared-server-core.mjs'
import { preflightPlayerActionAuthority } from './playerActionAuthorityRouter'

const repoRoot = path.resolve(__dirname, '..', '..')
const serverScript = path.join(repoRoot, 'scripts', 'static-server.mjs')

let proc: ChildProcess
let sharedRoot = ''
const base = 'http://127.0.0.1:5492'

beforeAll(async () => {
  sharedRoot = await mkdtemp(path.join(os.tmpdir(), 'stars-combat-transaction-'))
  const dist = path.join(sharedRoot, 'dist')
  await mkdir(dist, { recursive: true })
  await writeFile(path.join(dist, 'index.html'), '<!doctype html><title>stars</title>')
  proc = spawn(process.execPath, [serverScript, '--host', '127.0.0.1', '--port', '5492', '--root', dist], {
    env: { ...process.env, STARS_SHARED_ROOT: sharedRoot, STARS_SHARED_SECRET: '' },
    stdio: 'ignore',
  })
  const deadline = Date.now() + 8_000
  for (;;) {
    try {
      await fetch(`${base}/api/healthz`)
      break
    } catch {
      if (Date.now() > deadline) throw new Error('transaction test server did not start')
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
}, 15_000)

afterAll(async () => {
  if (proc) {
    const exited = new Promise<void>((resolve) => proc.once('exit', () => resolve()))
    proc.kill('SIGTERM')
    await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 2_000))])
  }
  if (sharedRoot) await rm(sharedRoot, { recursive: true, force: true })
})

async function createRoom() {
  const response = await fetch(`${base}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomName: '权威事务测试',
      displayName: 'DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: 'transaction-dm-client',
      activePlugins: [],
    }),
  })
  expect(response.status).toBe(201)
  return await response.json() as {
    roomId: string
    member: { memberId: string; roomToken: string }
  }
}

function memberHeaders(member: { memberId: string; roomToken: string }) {
  return {
    'Content-Type': 'application/json',
    'X-Stars-Protocol': '5',
    'X-Stars-Member': member.memberId,
    'X-Stars-Room-Token': member.roomToken,
  }
}

async function joinRoom(roomId: string, displayName: string, clientId: string) {
  const response = await fetch(`${base}/api/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, clientId, activePlugins: [] }),
  })
  expect(response.status).toBe(200)
  return await response.json() as { member: { memberId: string; roomToken: string } }
}

async function setActiveCharacter(
  roomId: string,
  member: { memberId: string; roomToken: string },
  characterId: string,
) {
  const response = await fetch(`${base}/api/rooms/${roomId}/heartbeat`, {
    method: 'POST',
    headers: memberHeaders(member),
    body: JSON.stringify({
      memberId: member.memberId,
      activePlugins: [],
      activeCharacterId: characterId,
      activeCharacterName: 'Hero',
    }),
  })
  expect(response.status).toBe(200)
}

async function seedCommandCombat(
  room: Awaited<ReturnType<typeof createRoom>>,
  player: Awaited<ReturnType<typeof joinRoom>>,
) {
  const query = `?room=${room.roomId}`
  const token = { id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero', x: 10, y: 20 }
  const writes = [
    {
      name: 'characters', expectedRevision: 0,
      data: { characters: [{ id: 'hero', name: 'Hero', roomMemberId: player.member.memberId }], selectedId: 'hero', updatedAt: 1 },
    },
    {
      name: 'maps', expectedRevision: 0,
      data: { maps: [{ id: 'map-command', name: 'Map', tokens: [token] }], selectedId: 'map-command', updatedAt: 1 },
    },
    {
      name: 'combat', expectedRevision: 0,
      data: {
        mapId: 'map-command', combatId: 'combat-command', active: true, round: 1, initiativeIndex: 0,
        initiativeOrder: [{ tokenId: token.id, slotId: 'slot-hero', label: 'Hero', emoji: '', color: '', roll: 20 }],
        updatedAt: 1,
      },
    },
  ]
  const response = await fetch(`${base}/api/state/transaction${query}`, {
    method: 'POST', headers: memberHeaders(room.member),
    body: JSON.stringify({ transactionId: `seed:${room.roomId}`, writes }),
  })
  expect(response.status).toBe(200)
}

function moveCommand(targetPosition = { x: 30, y: 20 }) {
  return {
    schemaVersion: 1,
    command: {
      schemaVersion: 1,
      commandId: 'move-command-1',
      issuedAt: 1_000,
      type: 'move-token',
      mapId: 'map-command',
      combatId: 'combat-command',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      expectedPosition: { x: 10, y: 20 },
      targetPosition,
      expectedElevationFeet: 0,
      targetElevationFeet: 5,
      dnd5eCarefulMovement: true,
      dnd5eStandFromProne: false,
      dnd5eTraversalMode: 'climb',
      expectedRevisions: { combat: 1, maps: 1 },
    },
  }
}

describe('combat authority state transaction', () => {
  it('keeps the main pending command paired while GC removes only old terminal conflicts', () => {
    const pendingCommand = { commandId: 'main-pending-command', payload: 'main' }
    const pendingReceipt = { commandId: pendingCommand.commandId, status: 'pending' }
    const terminalPairs = Array.from({ length: 1_100 }, (_, index) => ({
      command: { commandId: `overlap-conflict-${index}`, payload: `conflict-${index}` },
      receipt: { commandId: `overlap-conflict-${index}`, status: 'conflict' },
    }))
    const compacted = compactCombatCommandHistory(
      [pendingCommand, ...terminalPairs.map((entry) => entry.command)],
      [pendingReceipt, ...terminalPairs.map((entry) => entry.receipt)],
    )

    expect(compacted.commands).toHaveLength(1_025)
    expect(compacted.receipts).toHaveLength(1_025)
    expect(compacted.commands[0]).toEqual(pendingCommand)
    expect(compacted.receipts[0]).toEqual(pendingReceipt)
    expect(compacted.commands.some((entry) => entry.commandId === 'overlap-conflict-0')).toBe(false)
    expect(compacted.commands.some((entry) => entry.commandId === 'overlap-conflict-1099')).toBe(true)
    expect(compacted.commands.map((entry) => entry.commandId))
      .toEqual(compacted.receipts.map((entry) => entry.commandId))
  })

  it('contains event delivery failures after an authority commit', () => {
    expect(publishEventBestEffort({} as never, 'shared-state-changed', { name: 'combat' })).toBe(false)
  })

  it('allows cross-port combat command preflight and preserves open-default player origin semantics', async () => {
    const origin = 'http://127.0.0.1:6174'
    const commandId = 'open-player:move.1'
    const commandPath = `/api/combat/commands/${encodeURIComponent(commandId)}`
    const preflight = await fetch(`${base}${commandPath}`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type,idempotency-key,x-stars-command-id,x-stars-command-source,x-stars-writer',
      },
    })
    expect(preflight.status).toBe(204)
    const allowedHeaders = (preflight.headers.get('Access-Control-Allow-Headers') ?? '').toLowerCase()
    expect(allowedHeaders).toContain('idempotency-key')
    expect(allowedHeaders).toContain('x-stars-command-id')
    expect(allowedHeaders).toContain('x-stars-command-source')

    const seed = await fetch(`${base}/api/state/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Stars-Protocol': '5' },
      body: JSON.stringify({
        transactionId: 'open-default.command-seed',
        writes: [
          {
            name: 'characters', expectedRevision: 0,
            data: { characters: [{ id: 'open-hero', name: 'Open Hero' }], selectedId: 'open-hero', updatedAt: 1 },
          },
          {
            name: 'maps', expectedRevision: 0,
            data: {
              maps: [{
                id: 'open-map', name: 'Open Map',
                tokens: [{ id: 'open-token', type: 'player', characterId: 'open-hero', x: 5, y: 5 }],
              }],
              selectedId: 'open-map', updatedAt: 1,
            },
          },
          {
            name: 'combat', expectedRevision: 0,
            data: {
              mapId: 'open-map', combatId: 'open-combat', active: true, round: 1, initiativeIndex: 0,
              initiativeOrder: [{ tokenId: 'open-token', slotId: 'open-slot', label: 'Open Hero', emoji: '', color: '', roll: 10 }],
              updatedAt: 1,
            },
          },
        ],
      }),
    })
    expect(seed.status).toBe(200)

    const command = {
      schemaVersion: 1,
      command: {
        schemaVersion: 1,
        commandId,
        issuedAt: 1_000,
        type: 'move-token',
        mapId: 'open-map',
        combatId: 'open-combat',
        actorTokenId: 'open-token',
        characterId: 'open-hero',
        round: 1,
        initiativeIndex: 0,
        seq: 1,
        expectedPosition: { x: 5, y: 5 },
        expectedElevationFeet: 0,
        targetPosition: { x: 10, y: 5 },
        expectedRevisions: { combat: 1, maps: 1 },
      },
    }
    const put = await fetch(`${base}${commandPath}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'Idempotency-Key': commandId,
        'X-Stars-Command-Id': commandId,
        'X-Stars-Command-Source': 'player',
        'X-Stars-Protocol': '5',
        'X-Stars-Writer': 'client:open-player-browser',
      },
      body: JSON.stringify(command),
    })
    expect(put.status).toBe(202)
    const queueResponse = await fetch(`${base}/api/state/player-action-requests`)
    expect(queueResponse.status).toBe(200)
    const openQueue = await queueResponse.json() as { requests: Array<Record<string, unknown>> }
    expect(openQueue).toMatchObject({
      requests: [{ id: commandId, sourceMode: 'player' }],
    })
    expect(openQueue.requests[0]).not.toHaveProperty('roomMemberId')
    expect(preflightPlayerActionAuthority(openQueue.requests[0] as never, {
      isDm: true,
      activeMap: {
        id: 'open-map', name: 'Open Map', imageUrl: '', gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
        tokens: [{ id: 'open-token', type: 'player', characterId: 'open-hero', x: 5, y: 5 }],
      } as never,
      combatId: 'open-combat',
      combatActive: true,
      round: 1,
      initiativeIndex: 0,
      currentTokenId: 'open-token',
      characters: [{ id: 'open-hero' }],
      allowUnownedLegacySession: true,
      processedActionIds: new Set(),
      seenActionIds: new Set(),
    })).toMatchObject({ status: 'accepted' })
  })

  it('resets every durable combat queue in one authority transaction', async () => {
    const room = await createRoom()
    const query = `?room=${room.roomId}`
    const headers = memberHeaders(room.member)
    const reset = buildCombatMessageQueueReset({
      mapId: 'map-reset',
      combatId: 'combat-reset',
      updatedAt: 100,
      clearCombatLog: true,
    })
    const writes = [
      { name: 'combat-interrupts', expectedRevision: 0, data: reset.interruptQueue },
      { name: 'dice-events', expectedRevision: 0, data: reset.diceEvents },
      { name: 'player-action', expectedRevision: 0, data: reset.playerAction },
      { name: 'player-action-requests', expectedRevision: 0, data: reset.playerActionRequests },
      { name: 'player-action-processed', expectedRevision: 0, data: reset.playerActionProcessed },
      { name: 'player-action-ack', expectedRevision: 0, data: reset.playerActionAck },
      { name: 'combat-log', expectedRevision: 0, data: reset.combatLog },
    ]
    const response = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ transactionId: 'combat:test:queue-reset', writes }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      revisions: Object.fromEntries(writes.map((write) => [write.name, 1])),
    })

    for (const write of writes) {
      const stored = await fetch(`${base}/api/state/${write.name}${query}`, { headers })
      expect(stored.status).toBe(200)
      expect(stored.headers.get('X-Stars-State-Revision')).toBe('1')
      expect(await stored.json()).toMatchObject(write.data ?? {})
    }
  })

  it('commits coupled resources together and writes none when any revision conflicts', async () => {
    const room = await createRoom()
    const query = `?room=${room.roomId}`
    const headers = memberHeaders(room.member)
    const transaction = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transactionId: 'combat:test:first',
        writes: [
          { name: 'characters', expectedRevision: 0, data: { characters: [], selectedId: null, updatedAt: 10 } },
          { name: 'maps', expectedRevision: 0, data: { maps: [{ id: 'map-1', name: '原始地图', tokens: [] }], selectedId: 'map-1', updatedAt: 10 } },
          { name: 'combat', expectedRevision: 0, data: { mapId: 'map-1', active: true, round: 1, initiativeIndex: 0, initiativeOrder: [], updatedAt: 10 } },
          { name: 'player-action-ack', expectedRevision: 0, data: { id: 'ack-1', mapId: 'map-1', actionId: 'action-1', status: 'accepted', round: 1, initiativeIndex: 0, updatedAt: 10 } },
        ],
      }),
    })
    expect(transaction.status).toBe(200)
    expect(await transaction.json()).toMatchObject({
      revisions: { characters: 1, maps: 1, combat: 1, 'player-action-ack': 1 },
    })

    const conflict = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transactionId: 'combat:test:conflict',
        writes: [
          { name: 'characters', expectedRevision: 0, data: { characters: [], selectedId: null, updatedAt: 20 } },
          { name: 'maps', expectedRevision: 1, data: { maps: [{ id: 'map-1', name: '不应写入', tokens: [] }], selectedId: 'map-1', updatedAt: 20 } },
        ],
      }),
    })
    expect(conflict.status).toBe(409)
    const mapsResponse = await fetch(`${base}/api/state/maps${query}`, { headers })
    expect(mapsResponse.headers.get('X-Stars-State-Revision')).toBe('1')
    expect(await mapsResponse.json()).toMatchObject({ maps: [{ name: '原始地图' }] })
  })

  it('atomically appends concurrent requests from different players', async () => {
    const room = await createRoom()
    const join = async (displayName: string, clientId: string) => {
      const response = await fetch(`${base}/api/rooms/${room.roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, clientId, activePlugins: [] }),
      })
      expect(response.status).toBe(200)
      return await response.json() as { member: { memberId: string; roomToken: string } }
    }
    const [first, second] = await Promise.all([
      join('玩家一', 'transaction-player-1'),
      join('玩家二', 'transaction-player-2'),
    ])
    const action = (id: string) => ({
      id,
      mapId: 'map-1',
      combatId: 'combat-1',
      sourceMode: 'dm',
      status: 'pending',
      type: 'end-turn',
      actorTokenId: `${id}-token`,
      characterId: `${id}-character`,
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      updatedAt: Date.now(),
    })
    const append = (member: typeof first.member, id: string) => fetch(
      `${base}/api/state/player-action-requests/append?room=${room.roomId}`,
      { method: 'POST', headers: memberHeaders(member), body: JSON.stringify({ action: action(id) }) },
    )
    const responses = await Promise.all([append(first.member, 'action-1'), append(second.member, 'action-2')])
    expect(responses.map((response) => response.status)).toEqual([200, 200])

    const queueResponse = await fetch(`${base}/api/state/player-action-requests?room=${room.roomId}`, {
      headers: memberHeaders(room.member),
    })
    expect(queueResponse.status).toBe(200)
    const queue = await queueResponse.json() as { requests: Array<{ id: string; sourceMode: string; roomMemberId: string }> }
    expect(queue.requests.map((request) => request.id).sort()).toEqual(['action-1', 'action-2'])
    expect(queue.requests.every((request) => request.sourceMode === 'player' && request.roomMemberId)).toBe(true)
  })

  it('serializes a legacy healing append with combat-command intake and retains both requests', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-healing-race-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const roomStateRoot = path.join(sharedRoot, 'state', 'rooms', room.roomId)
    const transactionLockPath = path.join(roomStateRoot, '.state-transaction.lock')
    await writeFile(transactionLockPath, 'test-held-room-transaction-lock', { flag: 'wx' })

    const healingAction = {
      id: 'healing-action-concurrent-with-move',
      mapId: 'map-command',
      combatId: 'combat-command',
      sourceMode: 'player',
      status: 'pending',
      type: 'dnd5e-spell-cast',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      round: 1,
      initiativeIndex: 0,
      seq: 2,
      updatedAt: Date.now(),
    }
    let healingSettled = false
    let commandSettled = false
    const healingRequest = fetch(`${base}/api/state/player-action-requests/append${query}`, {
      method: 'POST',
      headers: memberHeaders(player.member),
      body: JSON.stringify({ action: healingAction }),
    }).then((response) => {
      healingSettled = true
      return response
    })
    const commandRequest = fetch(`${base}/api/combat/commands/move-command-1${query}`, {
      method: 'PUT',
      headers: memberHeaders(player.member),
      body: JSON.stringify(moveCommand()),
    }).then((response) => {
      commandSettled = true
      return response
    })

    await new Promise((resolve) => setTimeout(resolve, 250))
    const healingWaitedForRoomTransaction = !healingSettled
    const commandWaitedForRoomTransaction = !commandSettled
    await rm(transactionLockPath, { force: true })

    const [healingResponse, commandResponse] = await Promise.all([healingRequest, commandRequest])
    expect(healingWaitedForRoomTransaction).toBe(true)
    expect(commandWaitedForRoomTransaction).toBe(true)
    expect(healingResponse.status).toBe(200)
    expect(commandResponse.status).toBe(202)

    const queueResponse = await fetch(`${base}/api/state/player-action-requests${query}`, {
      headers: memberHeaders(room.member),
    })
    expect(queueResponse.status).toBe(200)
    const queue = await queueResponse.json() as { requests: Array<{ id: string; type: string }> }
    expect(queue.requests.map((request) => request.id).sort()).toEqual([
      'healing-action-concurrent-with-move',
      'move-command-1',
    ])
  })

  it('recovers a prepared crash journal before accepting the next authority transaction', async () => {
    const room = await createRoom()
    const query = `?room=${room.roomId}`
    const headers = memberHeaders(room.member)
    const initial = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transactionId: 'combat:test:journal-initial',
        writes: [
          { name: 'characters', expectedRevision: 0, data: { characters: [], selectedId: null, updatedAt: 10 } },
        ],
      }),
    })
    expect(initial.status).toBe(200)

    const roomStateRoot = path.join(sharedRoot, 'state', 'rooms', room.roomId)
    const charactersPath = path.join(roomStateRoot, 'characters.json')
    const currentBody = await readFile(charactersPath, 'utf8')
    await writeFile(charactersPath, JSON.stringify({
      characters: [{ id: 'partial-write-must-disappear' }],
      selectedId: null,
      updatedAt: 99,
      _sync: { schemaVersion: 1, revision: 2, writerId: 'crashed', writtenAt: 99 },
    }))
    await writeFile(path.join(roomStateRoot, '.state-transaction-journal.json'), JSON.stringify({
      schemaVersion: 1,
      state: 'prepared',
      transactionId: 'combat:test:crashed',
      entries: [{ name: 'characters', currentBody }],
    }))

    const recovered = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transactionId: 'combat:test:after-recovery',
        writes: [
          { name: 'characters', expectedRevision: 1, data: { characters: [], selectedId: null, updatedAt: 20 } },
        ],
      }),
    })
    expect(recovered.status).toBe(200)
    expect(await recovered.json()).toMatchObject({ revisions: { characters: 2 } })
    const stored = await fetch(`${base}/api/state/characters${query}`, { headers })
    expect(await stored.json()).toMatchObject({ characters: [], updatedAt: 20 })
  })

  it('appends simultaneous public and hidden dice events without losing either event', async () => {
    const room = await createRoom()
    const joinResponse = await fetch(`${base}/api/rooms/${room.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Player', clientId: 'dice-event-player', activePlugins: [] }),
    })
    expect(joinResponse.status).toBe(200)
    const player = await joinResponse.json() as { member: { memberId: string; roomToken: string } }
    const query = `?room=${room.roomId}`
    const event = (id: string, visibility: 'public' | 'dm') => ({
      operation: 'append',
      mapId: 'map-1',
      event: {
        id,
        mapId: 'map-1',
        sourceMode: 'dm',
        visibility,
        status: 'result',
        kind: 'd20',
        values: [12],
        updatedAt: Date.now(),
      },
    })
    const append = (member: { memberId: string; roomToken: string }, body: unknown) => fetch(
      `${base}/api/state/dice-events/append${query}`,
      { method: 'PATCH', headers: memberHeaders(member), body: JSON.stringify(body) },
    )
    const responses = await Promise.all([
      append(room.member, event('dm-hidden', 'dm')),
      append(player.member, event('player-public', 'dm')),
    ])
    expect(responses.map((response) => response.status)).toEqual([200, 200])

    const dmView = await fetch(`${base}/api/state/dice-events${query}`, { headers: memberHeaders(room.member) })
    const dmState = await dmView.json() as { events: Array<{ id: string; visibility: string; sourceMode: string }> }
    expect(dmState.events.map((candidate) => candidate.id).sort()).toEqual(['dm-hidden', 'player-public'])
    expect(dmState.events.find((candidate) => candidate.id === 'player-public')).toMatchObject({
      visibility: 'public',
      sourceMode: 'player',
    })

    const playerView = await fetch(`${base}/api/state/dice-events${query}`, { headers: memberHeaders(player.member) })
    const playerState = await playerView.json() as { events: Array<{ id: string }> }
    expect(playerState.events.map((candidate) => candidate.id)).toEqual(['player-public'])
  })

  it('commits interaction journal effects with authoritative combat snapshots or writes neither', async () => {
    const room = await createRoom()
    const query = `?room=${room.roomId}`
    const headers = memberHeaders(room.member)
    const writeCharacters = (expectedRevision: number, updatedAt: number, receipt: string) => fetch(
      `${base}/api/state/transaction${query}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transactionId: `interaction:${receipt}`,
          writes: [{
            name: 'characters',
            expectedRevision,
            data: { characters: [], selectedId: null, updatedAt },
          }],
          roomJournalMutations: [{
            operation: 'add-shared-note',
            kind: 'task',
            title: '打开密门',
            body: '',
            authorityReceiptId: receipt,
          }],
        }),
      },
    )

    const initial = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transactionId: 'interaction:initial',
        writes: [{
          name: 'characters',
          expectedRevision: 0,
          data: { characters: [], selectedId: null, updatedAt: 1 },
        }],
      }),
    })
    expect(initial.status).toBe(200)

    const conflict = await writeCharacters(0, 2, 'interaction-receipt-conflict')
    expect(conflict.status).toBe(409)
    const absentJournal = await fetch(`${base}/api/state/room-journal${query}`, { headers })
    expect(absentJournal.status).toBe(404)

    const committed = await writeCharacters(1, 3, 'interaction-receipt-success')
    expect(committed.status).toBe(200)
    expect(await committed.json()).toMatchObject({
      revisions: { characters: 2, 'room-journal': 1 },
    })
    const journal = await fetch(`${base}/api/state/room-journal${query}`, { headers })
    expect(journal.status).toBe(200)
    expect(await journal.json()).toMatchObject({
      sharedNotes: [expect.objectContaining({
        title: '打开密门',
        authorityReceiptId: 'interaction-receipt-success',
      })],
      authorityMutationReceipts: ['interaction-receipt-success'],
    })
  })

  it('persists one pending receipt and one queued action for duplicate command submissions', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-player-${room.roomId}`)
    await seedCommandCombat(room, player)
    const url = `${base}/api/combat/commands/move-command-1?room=${room.roomId}`
    const submit = () => fetch(url, {
      method: 'PUT',
      headers: memberHeaders(player.member),
      body: JSON.stringify(moveCommand()),
    })
    const first = await submit()
    expect(first.status).toBe(202)
    expect(await first.json()).toMatchObject({
      replayed: false,
      receipt: { receiptId: 'move-command-1', commandId: 'move-command-1', commandType: 'move-token', status: 'pending' },
    })
    const retry = await submit()
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ replayed: true, receipt: { status: 'pending' } })

    const dmOverlapBody = moveCommand({ x: 35, y: 20 })
    dmOverlapBody.command.commandId = 'dm-cross-member-overlap'
    dmOverlapBody.command.seq = 2
    dmOverlapBody.command.issuedAt = 1_001
    const dmOverlap = await fetch(
      `${base}/api/combat/commands/dm-cross-member-overlap?room=${room.roomId}`,
      { method: 'PUT', headers: memberHeaders(room.member), body: JSON.stringify(dmOverlapBody) },
    )
    expect(dmOverlap.status).toBe(409)
    expect(await dmOverlap.json()).toMatchObject({
      error: 'combat-command-pending-conflict',
      receipt: { commandId: 'dm-cross-member-overlap', status: 'conflict' },
    })

    const stranger = await joinRoom(room.roomId, 'Stranger', `pending-stranger-${room.roomId}`)
    const strangerBody = moveCommand({ x: 36, y: 20 })
    strangerBody.command.commandId = 'unauthorized-pending-overlap'
    const unauthorizedOverlap = await fetch(
      `${base}/api/combat/commands/unauthorized-pending-overlap?room=${room.roomId}`,
      { method: 'PUT', headers: memberHeaders(stranger.member), body: JSON.stringify(strangerBody) },
    )
    expect(unauthorizedOverlap.status).toBe(403)
    expect(await unauthorizedOverlap.json()).toEqual({ error: 'combat-command-character-forbidden' })

    const overlappingBody = moveCommand({ x: 40, y: 20 })
    overlappingBody.command.commandId = 'move-command-2'
    overlappingBody.command.seq = 2
    overlappingBody.command.issuedAt = 1_001
    const overlappingUrl = `${base}/api/combat/commands/move-command-2?room=${room.roomId}`
    const overlapping = await fetch(overlappingUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(overlappingBody),
    })
    expect(overlapping.status).toBe(409)
    expect(await overlapping.json()).toMatchObject({
      error: 'combat-command-pending-conflict',
      receipt: { commandId: 'move-command-2', status: 'conflict' },
    })
    const overlappingRetry = await fetch(overlappingUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(overlappingBody),
    })
    expect(overlappingRetry.status).toBe(200)
    expect(await overlappingRetry.json()).toMatchObject({ replayed: true, receipt: { status: 'conflict' } })

    const queueResponse = await fetch(`${base}/api/state/player-action-requests?room=${room.roomId}`, {
      headers: memberHeaders(room.member),
    })
    const queue = await queueResponse.json() as {
      requests: Array<{
        id: string
        targetElevationFeet?: number
        dnd5eCarefulMovement?: boolean
        dnd5eStandFromProne?: boolean
        dnd5eTraversalMode?: string
      }>
    }
    expect(queue.requests.map((action) => action.id)).toEqual(['move-command-1'])
    expect(queue.requests[0]).toMatchObject({
      targetElevationFeet: 5,
      dnd5eCarefulMovement: true,
      dnd5eStandFromProne: false,
      dnd5eTraversalMode: 'climb',
    })

    const receiptResponse = await fetch(url, { headers: memberHeaders(player.member) })
    expect(receiptResponse.status).toBe(200)
    expect(await receiptResponse.json()).toMatchObject({ receipt: { commandId: 'move-command-1', status: 'pending' } })
  })

  it('rejects a move command that omits its starting elevation CAS value', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `missing-elevation-${room.roomId}`)
    await seedCommandCombat(room, player)
    const body = moveCommand()
    delete (body.command as { expectedElevationFeet?: number }).expectedElevationFeet

    const response = await fetch(`${base}/api/combat/commands/move-command-1?room=${room.roomId}`, {
      method: 'PUT',
      headers: memberHeaders(player.member),
      body: JSON.stringify(body),
    })
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'invalid-combat-command' })
  })

  it.each([
    ['the actor token', 'hero-token'],
    ['an unrelated token', 'other-token'],
  ])('keeps a move pending after an HP-only edit to %s', async (_label, editedTokenId) => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `hp-before-move-${editedTokenId}-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const hero = {
      id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
      x: 10, y: 20, hp: 10, maxHp: 10,
    }
    const other = {
      id: 'other-token', type: 'enemy', label: 'Other',
      x: 90, y: 90, hp: 10, maxHp: 10,
    }
    const baseline = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: `hp-before-move-baseline:${editedTokenId}`,
        writes: [
          {
            name: 'characters', expectedRevision: 1,
            data: {
              characters: [{
                id: 'hero', name: 'Hero', roomMemberId: player.member.memberId,
                currentHp: 10, maxHp: 10,
              }],
              selectedId: 'hero', updatedAt: 2,
            },
          },
          {
            name: 'maps', expectedRevision: 1,
            data: {
              maps: [{ id: 'map-command', name: 'Map', tokens: [hero, other] }],
              selectedId: 'map-command', updatedAt: 2,
            },
          },
        ],
      }),
    })
    expect(baseline.status).toBe(200)

    const editedHero = editedTokenId === 'hero-token' ? { ...hero, hp: 5 } : hero
    const editedOther = editedTokenId === 'other-token' ? { ...other, hp: 5 } : other
    const hpWrites = [
      {
        name: 'maps', expectedRevision: 2,
        data: {
          maps: [{ id: 'map-command', name: 'Map', tokens: [editedHero, editedOther] }],
          selectedId: 'map-command', updatedAt: 3,
        },
      },
      ...(editedTokenId === 'hero-token'
        ? [{
            name: 'characters', expectedRevision: 2,
            data: {
              characters: [{
                id: 'hero', name: 'Hero', roomMemberId: player.member.memberId,
                currentHp: 5, maxHp: 10,
              }],
              selectedId: 'hero', updatedAt: 3,
            },
          }]
        : []),
    ]
    const hpEdit = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: `hp-before-move-edit:${editedTokenId}`,
        writes: hpWrites,
      }),
    })
    expect(hpEdit.status).toBe(200)

    const body = moveCommand()
    body.command.expectedRevisions.maps = 2
    const response = await fetch(`${base}/api/combat/commands/move-command-1${query}`, {
      method: 'PUT',
      headers: memberHeaders(player.member),
      body: JSON.stringify(body),
    })
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({
      receipt: { commandId: 'move-command-1', status: 'pending' },
    })

    const mapsResponse = await fetch(`${base}/api/state/maps${query}`, {
      headers: memberHeaders(room.member),
    })
    const mapsState = await mapsResponse.json() as {
      maps: Array<{ tokens: Array<{ id: string; hp?: number }> }>
    }
    expect(mapsState.maps[0].tokens.find((token) => token.id === editedTokenId)?.hp).toBe(5)
  })

  it.each([
    ['position', { x: 11, y: 20, elevationFeet: 0 }],
    ['elevation', { x: 10, y: 20, elevationFeet: 10 }],
  ])('rejects move intake when the actor %s changed despite an unrelated maps watermark', async (_label, actorState) => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `actor-cas-${_label}-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const actorChanged = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: `actor-cas:${_label}`,
        writes: [{
          name: 'maps', expectedRevision: 1,
          data: {
            maps: [{
              id: 'map-command', name: 'Map',
              tokens: [{
                id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                ...actorState,
              }],
            }],
            selectedId: 'map-command', updatedAt: 2,
          },
        }],
      }),
    })
    expect(actorChanged.status).toBe(200)

    const response = await fetch(`${base}/api/combat/commands/move-command-1${query}`, {
      method: 'PUT',
      headers: memberHeaders(player.member),
      body: JSON.stringify(moveCommand()),
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: 'combat-command-position-conflict',
      receipt: { status: 'conflict', reason: 'combat-command-position-conflict' },
    })
  })

  it('rejects a combat-command ACK when its durable receipt is missing', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `missing-receipt-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const commandUrl = `${base}/api/combat/commands/move-command-1${query}`
    const submitted = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(moveCommand()),
    })
    expect(submitted.status).toBe(202)

    const receiptPath = path.join(
      sharedRoot,
      'state',
      'rooms',
      room.roomId,
      'combat-command-receipts.json',
    )
    const stored = JSON.parse(await readFile(receiptPath, 'utf8')) as Record<string, unknown> & {
      receipts: unknown[]
    }
    await writeFile(receiptPath, JSON.stringify({ ...stored, receipts: [] }))

    const settlement = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'missing-command-receipt-must-not-apply',
        writes: [
          {
            name: 'maps', expectedRevision: 1,
            data: {
              maps: [{
                id: 'map-command', name: 'Map',
                tokens: [{
                  id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                  x: 30, y: 20, elevationFeet: 5,
                }],
              }],
              selectedId: 'map-command', updatedAt: 2,
            },
          },
          {
            name: 'player-action-ack', expectedRevision: 0,
            data: {
              id: 'ack-without-command-receipt', mapId: 'map-command', combatId: 'combat-command',
              actionId: 'move-command-1', recipientMemberId: player.member.memberId,
              status: 'accepted', round: 1, initiativeIndex: 0, updatedAt: 2,
            },
          },
        ],
      }),
    })
    expect(settlement.status).toBe(409)
    expect(await settlement.json()).toMatchObject({
      error: 'combat-command-settlement-conflict',
      receipt: {
        commandId: 'move-command-1', status: 'conflict', reason: 'combat-command-receipt-missing',
      },
    })
    const maps = await fetch(`${base}/api/state/maps${query}`, { headers: memberHeaders(room.member) })
    expect(await maps.json()).toMatchObject({ maps: [{ tokens: [{ x: 10, y: 20 }] }] })
    const ack = await fetch(`${base}/api/state/player-action-ack${query}`, { headers: memberHeaders(room.member) })
    expect(ack.status).toBe(404)
  })

  it('rejects a combat-command ACK when its immutable command record is missing', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `missing-record-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const commandUrl = `${base}/api/combat/commands/move-command-1${query}`
    const submitted = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(moveCommand()),
    })
    expect(submitted.status).toBe(202)

    const receiptPath = path.join(
      sharedRoot,
      'state',
      'rooms',
      room.roomId,
      'combat-command-receipts.json',
    )
    const stored = JSON.parse(await readFile(receiptPath, 'utf8')) as Record<string, unknown> & {
      commands: unknown[]
    }
    await writeFile(receiptPath, JSON.stringify({ ...stored, commands: [] }))

    const settlement = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'missing-command-record-must-not-apply',
        writes: [
          {
            name: 'maps', expectedRevision: 1,
            data: {
              maps: [{
                id: 'map-command', name: 'Map',
                tokens: [{
                  id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                  x: 30, y: 20, elevationFeet: 5,
                }],
              }],
              selectedId: 'map-command', updatedAt: 2,
            },
          },
          {
            name: 'player-action-ack', expectedRevision: 0,
            data: {
              id: 'ack-without-command-record', mapId: 'map-command', combatId: 'combat-command',
              actionId: 'move-command-1', recipientMemberId: player.member.memberId,
              status: 'accepted', round: 1, initiativeIndex: 0, updatedAt: 2,
            },
          },
        ],
      }),
    })
    expect(settlement.status).toBe(409)
    expect(await settlement.json()).toMatchObject({
      error: 'combat-command-settlement-precondition-conflict',
      receipt: {
        commandId: 'move-command-1', status: 'conflict', reason: 'combat-command-record-missing',
      },
    })
    const maps = await fetch(`${base}/api/state/maps${query}`, { headers: memberHeaders(room.member) })
    expect(await maps.json()).toMatchObject({ maps: [{ tokens: [{ x: 10, y: 20 }] }] })
  })

  it('rejects command-id payload conflicts, stale combat identity, and another player acting for the current character', async () => {
    const room = await createRoom()
    const owner = await joinRoom(room.roomId, 'Owner', `command-owner-${room.roomId}`)
    const stranger = await joinRoom(room.roomId, 'Stranger', `command-stranger-${room.roomId}`)
    await seedCommandCombat(room, owner)
    await setActiveCharacter(room.roomId, stranger.member, 'hero')
    const forbiddenBody = moveCommand()
    forbiddenBody.command.commandId = 'forbidden-command'
    const forbiddenUrl = `${base}/api/combat/commands/forbidden-command?room=${room.roomId}`

    const forgedDmCommand = moveCommand()
    forgedDmCommand.command.commandId = 'dm-forged.actor'
    forgedDmCommand.command.characterId = 'forged-character'
    const forgedDm = await fetch(`${base}/api/combat/commands/dm-forged.actor?room=${room.roomId}`, {
      method: 'PUT', headers: memberHeaders(room.member), body: JSON.stringify(forgedDmCommand),
    })
    expect(forgedDm.status).toBe(409)
    expect(await forgedDm.json()).toMatchObject({
      error: 'combat-command-character-mismatch',
      receipt: { commandId: 'dm-forged.actor', status: 'conflict' },
    })

    const forbidden = await fetch(forbiddenUrl, {
      method: 'PUT', headers: memberHeaders(stranger.member), body: JSON.stringify(forbiddenBody),
    })
    expect(forbidden.status).toBe(403)
    expect(await forbidden.json()).toEqual({ error: 'combat-command-character-forbidden' })

    const staleBody = moveCommand()
    staleBody.command.commandId = 'stale-command'
    // A coarse revision mismatch is tolerated, but a different round is an
    // authoritative semantic conflict. The first terminal receipt must still
    // win even after unrelated combat state advances.
    staleBody.command.expectedRevisions.combat = 2
    staleBody.command.round = 2
    const staleUrl = `${base}/api/combat/commands/stale-command?room=${room.roomId}`
    const stale = await fetch(staleUrl, {
      method: 'PUT', headers: memberHeaders(owner.member), body: JSON.stringify(staleBody),
    })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({
      error: 'combat-command-entity-conflict',
      receipt: { commandId: 'stale-command', commandType: 'move-token', status: 'conflict' },
    })
    const advanceCombat = await fetch(`${base}/api/state/transaction?room=${room.roomId}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'advance.combat-for-tombstone',
        writes: [{
          name: 'combat', expectedRevision: 1,
          data: {
            mapId: 'map-command', combatId: 'combat-command', active: true,
            round: 1, initiativeIndex: 0,
            initiativeOrder: [{ tokenId: 'hero-token', slotId: 'slot-hero', label: 'Hero', emoji: '', color: '', roll: 20 }],
            updatedAt: 2,
          },
        }],
      }),
    })
    expect(advanceCombat.status).toBe(200)
    const staleRetry = await fetch(staleUrl, {
      method: 'PUT', headers: memberHeaders(owner.member), body: JSON.stringify(staleBody),
    })
    expect(staleRetry.status).toBe(200)
    expect(await staleRetry.json()).toMatchObject({ replayed: true, receipt: { status: 'conflict' } })
    const repairedSameId = moveCommand({ x: 35, y: 20 })
    repairedSameId.command.commandId = 'stale-command'
    repairedSameId.command.expectedRevisions.combat = 2
    const repaired = await fetch(staleUrl, {
      method: 'PUT', headers: memberHeaders(owner.member), body: JSON.stringify(repairedSameId),
    })
    expect(repaired.status).toBe(409)
    expect(await repaired.json()).toMatchObject({ error: 'combat-command-idempotency-conflict' })

    const validBody = moveCommand()
    validBody.command.commandId = 'valid-command'
    validBody.command.expectedRevisions.combat = 999
    const validUrl = `${base}/api/combat/commands/valid-command?room=${room.roomId}`
    const accepted = await fetch(validUrl, {
      method: 'PUT', headers: memberHeaders(owner.member), body: JSON.stringify(validBody),
    })
    expect(accepted.status).toBe(202)
    const changedBody = moveCommand({ x: 40, y: 20 })
    changedBody.command.commandId = 'valid-command'
    changedBody.command.expectedRevisions.combat = 2
    const changed = await fetch(validUrl, {
      method: 'PUT', headers: memberHeaders(owner.member), body: JSON.stringify(changedBody),
    })
    expect(changed.status).toBe(409)
    expect(await changed.json()).toMatchObject({
      error: 'combat-command-idempotency-conflict',
      receipt: { commandId: 'valid-command', status: 'conflict' },
    })
  })

  it('does not let an unauthorized player reserve a command id before its legitimate owner', async () => {
    const room = await createRoom()
    const owner = await joinRoom(room.roomId, 'Owner', `command-auth-owner-${room.roomId}`)
    const stranger = await joinRoom(room.roomId, 'Stranger', `command-auth-stranger-${room.roomId}`)
    await seedCommandCombat(room, owner)
    const commandId = 'owner-command-after-forbidden'
    const body = moveCommand()
    body.command.commandId = commandId
    const url = `${base}/api/combat/commands/${commandId}?room=${room.roomId}`

    const forbidden = await fetch(url, {
      method: 'PUT', headers: memberHeaders(stranger.member), body: JSON.stringify(body),
    })
    expect(forbidden.status).toBe(403)
    expect(await forbidden.json()).toEqual({ error: 'combat-command-character-forbidden' })

    const accepted = await fetch(url, {
      method: 'PUT', headers: memberHeaders(owner.member), body: JSON.stringify(body),
    })
    expect(accepted.status).toBe(202)
    expect(await accepted.json()).toMatchObject({
      replayed: false,
      receipt: { commandId, status: 'pending' },
    })
  })

  it('queues end-turn through the same idempotent receipt channel', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-end-turn-${room.roomId}`)
    await seedCommandCombat(room, player)
    const commandId = 'end-turn:command.1'
    const url = `${base}/api/combat/commands/${encodeURIComponent(commandId)}?room=${room.roomId}`
    const body = {
      schemaVersion: 1,
      command: {
        schemaVersion: 1,
        commandId,
        issuedAt: 2_000,
        type: 'end-turn',
        mapId: 'map-command',
        combatId: 'combat-command',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        round: 1,
        initiativeIndex: 0,
        seq: 2,
        expectedRevisions: { combat: 1 },
      },
    }
    const first = await fetch(url, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(body),
    })
    expect(first.status).toBe(202)
    expect(await first.json()).toMatchObject({
      receipt: { receiptId: commandId, commandId, commandType: 'end-turn', status: 'pending' },
    })
    const retry = await fetch(url, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(body),
    })
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ replayed: true, receipt: { status: 'pending' } })
  })

  it('atomically settles a command receipt and replays the same DM transaction after a lost response', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-settle-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const commandUrl = `${base}/api/combat/commands/move-command-1${query}`
    const submitted = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(moveCommand()),
    })
    expect(submitted.status).toBe(202)

    const settlement = {
      transactionId: 'settle:move-command-1',
      writes: [
        {
          name: 'maps', expectedRevision: 1,
          data: {
            maps: [{
              id: 'map-command', name: 'Map',
              tokens: [{
                id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                x: 30, y: 20, elevationFeet: 5,
              }],
            }],
            selectedId: 'map-command', updatedAt: 2,
          },
        },
        {
          name: 'player-action-ack', expectedRevision: 0,
          data: {
            id: 'ack-move-command-1', mapId: 'map-command', combatId: 'combat-command',
            actionId: 'move-command-1', recipientMemberId: player.member.memberId,
            status: 'accepted', acceptedPosition: { x: 30, y: 20 }, acceptedElevationFeet: 5,
            round: 1, initiativeIndex: 0, updatedAt: 2,
          },
        },
      ],
    }
    const settle = () => fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(room.member), body: JSON.stringify(settlement),
    })
    const first = await settle()
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({
      receipt: {
        commandId: 'move-command-1', commandType: 'move-token', status: 'committed',
        authoritative: {
          mapId: 'map-command', combatId: 'combat-command', acceptedPosition: { x: 30, y: 20 },
          acceptedElevationFeet: 5,
          revisions: { maps: 2, 'player-action-ack': 1 },
        },
      },
    })

    const retry = await settle()
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ replayed: true, revisions: { maps: 2, 'player-action-ack': 1 } })
    const commandRetry = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(moveCommand()),
    })
    expect(commandRetry.status).toBe(200)
    expect(await commandRetry.json()).toMatchObject({
      replayed: true,
      receipt: { status: 'committed', authoritative: { revisions: { maps: 2, 'player-action-ack': 1 } } },
    })
    const terminalGet = await fetch(commandUrl, { headers: memberHeaders(player.member) })
    expect(terminalGet.status).toBe(200)
    expect(await terminalGet.json()).toMatchObject({ receipt: { status: 'committed' } })
    const continuationBody = moveCommand({ x: 40, y: 20 })
    continuationBody.command.commandId = 'move-command-continuation'
    continuationBody.command.issuedAt = 2_000
    continuationBody.command.seq = 2
    continuationBody.command.expectedPosition = { x: 30, y: 20 }
    continuationBody.command.expectedElevationFeet = 5
    continuationBody.command.expectedRevisions.maps = 2
    const continuation = await fetch(
      `${base}/api/combat/commands/move-command-continuation${query}`,
      { method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(continuationBody) },
    )
    expect(continuation.status).toBe(202)
    expect(await continuation.json()).toMatchObject({ receipt: { status: 'pending' } })
    const maps = await fetch(`${base}/api/state/maps${query}`, { headers: memberHeaders(room.member) })
    expect(maps.headers.get('X-Stars-State-Revision')).toBe('2')
    expect(await maps.json()).toMatchObject({ maps: [{ tokens: [{ x: 30, y: 20, elevationFeet: 5 }] }] })
  })

  it('terminalizes a settlement when only the authoritative elevation changed', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-stale-settle-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const commandUrl = `${base}/api/combat/commands/move-command-1${query}`
    const submitted = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(moveCommand()),
    })
    expect(submitted.status).toBe(202)

    const movedByAnotherAuthority = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'move-before-command-settlement',
        writes: [{
          name: 'maps', expectedRevision: 1,
          data: {
            maps: [{
              id: 'map-command', name: 'Map',
              tokens: [{
                id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                x: 10, y: 20, elevationFeet: 10,
              }],
            }],
            selectedId: 'map-command', updatedAt: 2,
          },
        }],
      }),
    })
    expect(movedByAnotherAuthority.status).toBe(200)

    const staleSettlement = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'stale-settlement-must-not-apply',
        writes: [
          {
            name: 'maps', expectedRevision: 2,
            data: {
              maps: [{
                id: 'map-command', name: 'Map',
                tokens: [{
                  id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                  x: 30, y: 20, elevationFeet: 5,
                }],
              }],
              selectedId: 'map-command', updatedAt: 3,
            },
          },
          {
            name: 'player-action-ack', expectedRevision: 0,
            data: {
              id: 'stale-ack', mapId: 'map-command', combatId: 'combat-command',
              actionId: 'move-command-1', recipientMemberId: player.member.memberId,
              status: 'accepted', acceptedPosition: { x: 30, y: 20 }, acceptedElevationFeet: 5,
              round: 1, initiativeIndex: 0, updatedAt: 3,
            },
          },
        ],
      }),
    })
    expect(staleSettlement.status).toBe(409)
    expect(await staleSettlement.json()).toMatchObject({
      error: 'combat-command-settlement-precondition-conflict',
      receipt: {
        commandId: 'move-command-1', status: 'conflict', reason: 'combat-command-position-conflict',
      },
    })

    const maps = await fetch(`${base}/api/state/maps${query}`, { headers: memberHeaders(room.member) })
    expect(maps.headers.get('X-Stars-State-Revision')).toBe('2')
    expect(await maps.json()).toMatchObject({
      maps: [{ tokens: [{ x: 10, y: 20, elevationFeet: 10 }] }],
    })
    const ack = await fetch(`${base}/api/state/player-action-ack${query}`, { headers: memberHeaders(room.member) })
    expect(ack.status).toBe(404)
    const queue = await fetch(`${base}/api/state/player-action-requests${query}`, {
      headers: memberHeaders(room.member),
    })
    expect(await queue.json()).toMatchObject({ requests: [] })
    const receipt = await fetch(commandUrl, { headers: memberHeaders(player.member) })
    expect(await receipt.json()).toMatchObject({
      receipt: { status: 'conflict', reason: 'combat-command-position-conflict' },
    })
  })

  it('does not reject settlement only because an unrelated map edit advanced the command revision', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-unrelated-edit-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const commandUrl = `${base}/api/combat/commands/move-command-1${query}`
    const submitted = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(moveCommand()),
    })
    expect(submitted.status).toBe(202)

    const unrelatedEdit = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'unrelated-map-edit-before-settlement',
        writes: [{
          name: 'maps', expectedRevision: 1,
          data: {
            maps: [{
              id: 'map-command', name: 'Map',
              tokens: [
                { id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero', x: 10, y: 20 },
                { id: 'scenery-token', type: 'enemy', label: 'Scenery', x: 90, y: 90 },
              ],
            }],
            selectedId: 'map-command', updatedAt: 2,
          },
        }],
      }),
    })
    expect(unrelatedEdit.status).toBe(200)

    const settled = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'settle-after-unrelated-map-edit',
        writes: [
          {
            name: 'maps', expectedRevision: 2,
            data: {
              maps: [{
                id: 'map-command', name: 'Map',
                tokens: [
                  {
                    id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                    x: 30, y: 20, elevationFeet: 5,
                  },
                  { id: 'scenery-token', type: 'enemy', label: 'Scenery', x: 90, y: 90 },
                ],
              }],
              selectedId: 'map-command', updatedAt: 3,
            },
          },
          {
            name: 'player-action-ack', expectedRevision: 0,
            data: {
              id: 'ack-after-unrelated-edit', mapId: 'map-command', combatId: 'combat-command',
              actionId: 'move-command-1', recipientMemberId: player.member.memberId,
              status: 'accepted', round: 1, initiativeIndex: 0, updatedAt: 3,
            },
          },
        ],
      }),
    })
    expect(settled.status).toBe(200)
    expect(await settled.json()).toMatchObject({
      receipt: {
        status: 'committed',
        authoritative: {
          acceptedPosition: { x: 30, y: 20 },
          acceptedElevationFeet: 5,
        },
      },
    })
  })

  it('revalidates the active turn before settling an end-turn command', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-stale-end-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const commandId = 'stale-end-turn-command'
    const commandUrl = `${base}/api/combat/commands/${commandId}${query}`
    const submitted = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member),
      body: JSON.stringify({
        schemaVersion: 1,
        command: {
          schemaVersion: 1, commandId, issuedAt: 1_000, type: 'end-turn',
          mapId: 'map-command', combatId: 'combat-command', actorTokenId: 'hero-token',
          characterId: 'hero', round: 1, initiativeIndex: 0, seq: 1,
          expectedRevisions: { combat: 1 },
        },
      }),
    })
    expect(submitted.status).toBe(202)

    const advanced = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'advance-before-end-turn-settlement',
        writes: [{
          name: 'combat', expectedRevision: 1,
          data: {
            mapId: 'map-command', combatId: 'combat-command', active: true,
            round: 2, initiativeIndex: 0,
            initiativeOrder: [{
              tokenId: 'hero-token', slotId: 'slot-hero', label: 'Hero', emoji: '', color: '', roll: 20,
            }],
            updatedAt: 2,
          },
        }],
      }),
    })
    expect(advanced.status).toBe(200)

    const staleSettlement = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'stale-end-turn-settlement',
        writes: [
          {
            name: 'combat', expectedRevision: 2,
            data: {
              mapId: 'map-command', combatId: 'combat-command', active: true,
              round: 3, initiativeIndex: 0,
              initiativeOrder: [{
                tokenId: 'hero-token', slotId: 'slot-hero', label: 'Hero', emoji: '', color: '', roll: 20,
              }],
              updatedAt: 3,
            },
          },
          {
            name: 'player-action-ack', expectedRevision: 0,
            data: {
              id: 'stale-end-ack', mapId: 'map-command', combatId: 'combat-command',
              actionId: commandId, recipientMemberId: player.member.memberId,
              status: 'accepted', round: 3, initiativeIndex: 0, updatedAt: 3,
            },
          },
        ],
      }),
    })
    expect(staleSettlement.status).toBe(409)
    expect(await staleSettlement.json()).toMatchObject({
      error: 'combat-command-settlement-precondition-conflict',
      receipt: { status: 'conflict', reason: 'combat-command-entity-conflict' },
    })
    const combat = await fetch(`${base}/api/state/combat${query}`, { headers: memberHeaders(room.member) })
    expect(await combat.json()).toMatchObject({ round: 2, initiativeIndex: 0 })
    const queue = await fetch(`${base}/api/state/player-action-requests${query}`, {
      headers: memberHeaders(room.member),
    })
    expect(await queue.json()).toMatchObject({ requests: [] })
  })
})
