/// <reference types="node" />
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildCombatMessageQueueReset } from './sharedCombatReset'

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

describe('combat authority state transaction', () => {
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
})
