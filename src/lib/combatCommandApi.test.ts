import { describe, expect, it, vi } from 'vitest'
import {
  COMBAT_COMMAND_SCHEMA_VERSION,
  CombatCommandCoordinator,
  CombatCommandProtocolError,
  CombatCommandTimeoutError,
  combatCommandFromPlayerAction,
  createCombatCommandHttpTransport,
  fingerprintCombatCommand,
  parseCombatCommandReceipt,
  type CombatCommandReceiptV1,
  type CombatCommandTransport,
  type CombatCommandV1,
} from './combatCommandApi'
import type { SharedPlayerActionState } from './sharedCombatTypes'

function moveCommand(patch: Partial<CombatCommandV1> = {}): CombatCommandV1 {
  return {
    schemaVersion: COMBAT_COMMAND_SCHEMA_VERSION,
    commandId: 'player:move:001',
    type: 'move-token',
    mapId: 'map-1',
    combatId: 'combat-1',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    round: 2,
    initiativeIndex: 1,
    seq: 7,
    expectedRevisions: { combat: 4, maps: 8 },
    issuedAt: 100,
    expectedPosition: { x: 20, y: 30 },
    expectedElevationFeet: 0,
    targetPosition: { x: 25, y: 30 },
    ...patch,
  } as CombatCommandV1
}

function endTurnCommand(): CombatCommandV1 {
  return {
    schemaVersion: COMBAT_COMMAND_SCHEMA_VERSION,
    commandId: 'player:end-turn:001',
    type: 'end-turn',
    mapId: 'map-1',
    combatId: 'combat-1',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    round: 2,
    initiativeIndex: 1,
    seq: 8,
    expectedRevisions: { combat: 4 },
    issuedAt: 100,
  }
}

function rawPending(command = moveCommand()) {
  return {
    schemaVersion: 1,
    receiptId: `receipt:${command.commandId}`,
    commandId: command.commandId,
    commandType: command.type,
    status: 'pending',
    updatedAt: 101,
  }
}

function pending(command = moveCommand()): CombatCommandReceiptV1 {
  return parseCombatCommandReceipt(rawPending(command))
}

function rawCommitted(command = moveCommand()) {
  return {
    ...rawPending(command),
    status: 'committed',
    updatedAt: 120,
    authoritative: {
      appliedAt: 119,
      revisions: { maps: 8, combat: 4 },
      mapId: command.mapId,
      combatId: command.combatId,
      round: command.round,
      initiativeIndex: command.initiativeIndex,
      acceptedPosition: command.type === 'move-token' ? command.targetPosition : undefined,
      acceptedElevationFeet: command.type === 'move-token' ? 40 : undefined,
    },
  }
}

function committed(command = moveCommand()): CombatCommandReceiptV1 {
  return parseCombatCommandReceipt(rawCommitted(command))
}

describe('combat command authority receipt parser', () => {
  it('parses wrapped pending and committed receipts and marks them as authority data', () => {
    const command = moveCommand()
    expect(parseCombatCommandReceipt({ receipt: rawPending(command) }, {
      commandId: command.commandId,
      commandType: command.type,
    })).toMatchObject({
      status: 'pending',
      commandId: command.commandId,
      receiptSource: 'authority',
    })

    expect(parseCombatCommandReceipt(rawCommitted(command))).toMatchObject({
      status: 'committed',
      receiptSource: 'authority',
      authoritative: {
        appliedAt: 119,
        revisions: { maps: 8, combat: 4 },
        acceptedPosition: { x: 25, y: 30 },
        acceptedElevationFeet: 40,
      },
    })
  })

  it('keeps rejected and conflict terminal states explicit', () => {
    const base = rawPending()
    expect(parseCombatCommandReceipt({ ...base, status: 'rejected', reason: 'not-your-turn' }))
      .toMatchObject({ status: 'rejected', reason: 'not-your-turn' })
    expect(parseCombatCommandReceipt({ ...base, status: 'conflict', reason: 'command-id-reused' }))
      .toMatchObject({ status: 'conflict', reason: 'command-id-reused' })
  })

  it('fails closed on a mismatched id or a committed receipt without authority revisions', () => {
    expect(() => parseCombatCommandReceipt(rawPending(), { commandId: 'different-id' }))
      .toThrowError(CombatCommandProtocolError)
    expect(() => parseCombatCommandReceipt({
      ...rawPending(),
      status: 'committed',
      authoritative: { appliedAt: 1 },
    })).toThrowError('combat-command-receipt-authority-invalid')
    expect(() => parseCombatCommandReceipt({
      ...rawCommitted(),
      authoritative: { ...rawCommitted().authoritative, acceptedElevationFeet: Number.NaN },
    })).toThrowError('combat-command-receipt-authority-invalid')
  })
})

describe('legacy player action migration adapter', () => {
  it('maps movement and end-turn without making the page duplicate protocol fields', () => {
    const action = {
      id: 'legacy-action-1',
      mapId: 'map-1',
      combatId: 'combat-1',
      sourceMode: 'player',
      status: 'pending',
      type: 'move-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetPosition: { x: 40, y: 50 },
      targetElevationFeet: 15,
      dnd5eCarefulMovement: true,
      dnd5eStandFromProne: false,
      dnd5eTraversalMode: 'fly',
      round: 3,
      initiativeIndex: 2,
      seq: 7,
      updatedAt: 456,
    } satisfies SharedPlayerActionState
    const preconditions = {
      expectedRevisions: { combat: 9, maps: 12 },
      expectedPosition: { x: 35, y: 50 },
      expectedElevationFeet: 10,
    }
    expect(combatCommandFromPlayerAction(action, preconditions)).toEqual({
      schemaVersion: 1,
      commandId: 'legacy-action-1',
      type: 'move-token',
      mapId: 'map-1',
      combatId: 'combat-1',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      expectedPosition: { x: 35, y: 50 },
      expectedElevationFeet: 10,
      targetPosition: { x: 40, y: 50 },
      targetElevationFeet: 15,
      dnd5eCarefulMovement: true,
      dnd5eStandFromProne: false,
      dnd5eTraversalMode: 'fly',
      round: 3,
      initiativeIndex: 2,
      seq: 7,
      expectedRevisions: { combat: 9, maps: 12 },
      issuedAt: 456,
    })
    expect(combatCommandFromPlayerAction({ ...action, type: 'end-turn' }, preconditions)).toEqual({
      schemaVersion: 1,
      commandId: 'legacy-action-1',
      type: 'end-turn',
      mapId: 'map-1',
      combatId: 'combat-1',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      round: 3,
      initiativeIndex: 2,
      seq: 7,
      expectedRevisions: { combat: 9, maps: 12 },
      issuedAt: 456,
    })
    expect(combatCommandFromPlayerAction(
      { ...action, type: 'dnd5e-dodge' } as unknown as SharedPlayerActionState,
      preconditions,
    ))
      .toBeNull()
    expect(combatCommandFromPlayerAction(action, {
      expectedRevisions: { combat: 9, maps: 12 },
    })).toBeNull()
    expect(combatCommandFromPlayerAction(action, {
      expectedRevisions: { combat: 9, maps: 12 },
      expectedPosition: { x: 35, y: 50 },
    })).toBeNull()
    expect(combatCommandFromPlayerAction({ ...action, combatId: undefined }, preconditions)).toBeNull()
  })

  it.each([
    'dnd5e-spell-cast',
    'dnd5e-item-use',
    'dnd5e-fighter-feature',
    'dnd5e-class-feature',
    'dnd5e-racial-action',
    'dnd5e-plugin-action',
  ] satisfies SharedPlayerActionState['type'][])(
    'does not route healing-capable %s actions through the idempotent move/end-turn channel',
    (type) => {
      const action = {
        id: `legacy-${type}`,
        mapId: 'map-1',
        combatId: 'combat-1',
        sourceMode: 'player',
        status: 'pending',
        type,
        actorTokenId: 'hero-token',
        characterId: 'hero',
        round: 3,
        initiativeIndex: 2,
        seq: 8,
        updatedAt: 500,
      } as SharedPlayerActionState

      expect(combatCommandFromPlayerAction(action, {
        expectedRevisions: { combat: 9, maps: 12 },
      })).toBeNull()
    },
  )
})

describe('combat command HTTP contract', () => {
  it('uses idempotent PUT followed by GET with room authority headers', async () => {
    const command = moveCommand()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ receipt: rawPending(command) }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ receipt: rawCommitted(command) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    const transport = createCombatCommandHttpTransport({
      fetch: fetchMock,
      apiBase: 'http://authority.test/api',
      getSession: () => ({
        roomId: 'ABC234',
        memberId: 'member-player-1',
        roomToken: 'room-token-abcdefghijklmnopqrstuvwxyz',
        role: 'player',
        clientId: 'browser-1',
      }),
    })

    await expect(transport.put(command, new AbortController().signal))
      .resolves.toMatchObject({ status: 'pending' })
    await expect(transport.get(command.commandId, command.type, new AbortController().signal))
      .resolves.toMatchObject({ status: 'committed' })

    const [putUrl, putInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(putUrl).toBe('http://authority.test/api/combat/commands/player:move:001?room=ABC234')
    expect(putInit.method).toBe('PUT')
    const headers = new Headers(putInit.headers)
    expect(headers.get('Idempotency-Key')).toBe(command.commandId)
    expect(headers.get('X-Stars-Command-Id')).toBe(command.commandId)
    expect(headers.get('X-Stars-Member')).toBe('member-player-1')
    expect(headers.get('X-Stars-Room-Token')).toBe('room-token-abcdefghijklmnopqrstuvwxyz')
    expect(headers.get('X-Stars-Writer')).toBe('player:member-player-1:browser-1')
    expect(JSON.parse(String(putInit.body))).toEqual({ schemaVersion: 1, command })

    const [getUrl, getInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(getUrl).toBe(putUrl)
    expect(getInit.method).toBe('GET')
    expect(getInit.body).toBeUndefined()
  })

  it('freezes the original room authority for retries and polling', async () => {
    const command = moveCommand({ commandId: 'player:move:frozen-room' })
    let session = {
      roomId: 'ROOM-A',
      memberId: 'member-a',
      roomToken: 'room-token-a-abcdefghijklmnopqrstuvwxyz',
      role: 'player' as const,
      clientId: 'browser-a',
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ receipt: rawPending(command) }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ receipt: rawCommitted(command) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    const transport = createCombatCommandHttpTransport({
      fetch: fetchMock,
      apiBase: 'http://authority.test/api',
      getSession: () => session,
    })

    await transport.put(command, new AbortController().signal)
    session = {
      roomId: 'ROOM-B',
      memberId: 'member-b',
      roomToken: 'room-token-b-abcdefghijklmnopqrstuvwxyz',
      role: 'player',
      clientId: 'browser-b',
    }
    await transport.get(command.commandId, command.type, new AbortController().signal)

    const [getUrl, getInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(getUrl).toContain('room=ROOM-A')
    const headers = new Headers(getInit.headers)
    expect(headers.get('X-Stars-Member')).toBe('member-a')
    expect(headers.get('X-Stars-Room-Token')).toBe('room-token-a-abcdefghijklmnopqrstuvwxyz')
    expect(headers.get('X-Stars-Writer')).toBe('player:member-a:browser-a')
  })

  it('declares the local player source without a room session', async () => {
    vi.stubGlobal('window', { location: { port: '6174' } })
    try {
      const command = moveCommand({ commandId: 'local-player:move.1' })
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        receipt: rawPending(command),
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }))
      const transport = createCombatCommandHttpTransport({
        fetch: fetchMock,
        apiBase: 'http://127.0.0.1:6173/api',
        getSession: () => null,
      })

      await expect(transport.put(command, new AbortController().signal))
        .resolves.toMatchObject({ status: 'pending' })
      const headers = new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers)
      expect(headers.get('X-Stars-Command-Source')).toBe('player')
      expect(headers.get('X-Stars-Member')).toBeNull()
      expect(headers.get('X-Stars-Room-Token')).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('CombatCommandCoordinator', () => {
  it('polls HTTP receipts until committed and never needs an SSE acknowledgement', async () => {
    const command = moveCommand()
    const put = vi.fn().mockResolvedValue(pending(command))
    const get = vi.fn()
      .mockResolvedValueOnce(pending(command))
      .mockResolvedValueOnce(committed(command))
    const coordinator = new CombatCommandCoordinator({ put, get })

    await expect(coordinator.execute(command, { pollIntervalMs: 0 }))
      .resolves.toMatchObject({ status: 'committed', receiptSource: 'authority' })
    expect(put).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('coalesces concurrent identical commands and caches the immutable terminal receipt', async () => {
    const command = moveCommand()
    let release!: (receipt: CombatCommandReceiptV1) => void
    const deferred = new Promise<CombatCommandReceiptV1>((resolve) => { release = resolve })
    const put = vi.fn().mockReturnValue(deferred)
    const get = vi.fn()
    const coordinator = new CombatCommandCoordinator({ put, get })

    const first = coordinator.execute(command)
    const second = coordinator.execute({ ...command })
    release(committed(command))
    const [firstReceipt, secondReceipt] = await Promise.all([first, second])

    expect(firstReceipt).toBe(secondReceipt)
    expect(put).toHaveBeenCalledTimes(1)
    await expect(coordinator.execute(command)).resolves.toBe(firstReceipt)
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('blocks a local commandId reuse with different payload before it can mutate authority state', async () => {
    const command = moveCommand()
    const put = vi.fn().mockResolvedValue(committed(command))
    const coordinator = new CombatCommandCoordinator({ put, get: vi.fn() })
    await coordinator.execute(command)

    await expect(coordinator.execute({
      ...(command as Extract<CombatCommandV1, { type: 'move-token' }>),
      targetPosition: { x: 999, y: 999 },
    })).resolves.toMatchObject({
      status: 'conflict',
      receiptSource: 'client',
      reason: 'command-id-reused-with-different-payload',
    })
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('times out as pending, then safely retries the exact same commandId', async () => {
    const command = moveCommand()
    let commitOnPut = false
    const put = vi.fn().mockImplementation(async () => commitOnPut
      ? committed(command)
      : pending(command))
    const get = vi.fn().mockResolvedValue(pending(command))
    const coordinator = new CombatCommandCoordinator({ put, get })

    const first = coordinator.execute(command, {
      timeoutMs: 20,
      requestTimeoutMs: 5,
      pollIntervalMs: 1,
      maxPutAttempts: 1,
    })
    await expect(first).rejects.toMatchObject({
      name: 'CombatCommandTimeoutError',
      commandId: command.commandId,
      lastReceipt: expect.objectContaining({ status: 'pending' }),
    })
    await expect(first).rejects.toBeInstanceOf(CombatCommandTimeoutError)

    commitOnPut = true
    await expect(coordinator.execute(command, { timeoutMs: 50 }))
      .resolves.toMatchObject({ status: 'committed' })
    expect(put).toHaveBeenCalledTimes(2)
    expect(put.mock.calls.every(([sent]) => fingerprintCombatCommand(sent) === fingerprintCombatCommand(command)))
      .toBe(true)
  })

  it('polls the receipt after every PUT response is lost instead of reporting a false failure', async () => {
    const command = moveCommand({ commandId: 'player:move:lost-put-response' })
    const put = vi.fn().mockRejectedValue(new TypeError('connection closed after request body'))
    const get = vi.fn()
      .mockResolvedValueOnce(pending(command))
      .mockResolvedValueOnce(committed(command))
    const coordinator = new CombatCommandCoordinator({ put, get })

    await expect(coordinator.execute(command, {
      maxPutAttempts: 2,
      pollIntervalMs: 0,
      timeoutMs: 100,
    })).resolves.toMatchObject({ status: 'committed' })
    expect(put).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('surfaces a server conflict receipt instead of converting it into success', async () => {
    const command = endTurnCommand()
    const conflict = parseCombatCommandReceipt({
      ...rawPending(command),
      status: 'conflict',
      reason: 'command-id-reused',
    })
    const transport: CombatCommandTransport = {
      put: vi.fn().mockResolvedValue(conflict),
      get: vi.fn(),
    }
    const coordinator = new CombatCommandCoordinator(transport)
    await expect(coordinator.execute(command)).resolves.toMatchObject({
      status: 'conflict',
      receiptSource: 'authority',
    })
  })
})
