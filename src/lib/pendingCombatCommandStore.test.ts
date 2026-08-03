import { describe, expect, it } from 'vitest'
import type { CombatCommandV1 } from './combatCommandApi'
import {
  clearPendingCombatCommand,
  findPendingCombatCommandForActorTurn,
  loadPendingCombatCommands,
  persistPendingCombatCommand,
  PENDING_COMBAT_COMMANDS_STORAGE_KEY,
  type CombatCommandSessionStorage,
  type PendingCombatCommandScope,
} from './pendingCombatCommandStore'

class MemoryStorage implements CombatCommandSessionStorage {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

function command(commandId = 'map:player-action:1'): Extract<CombatCommandV1, { type: 'move-token' }> {
  return {
    schemaVersion: 1,
    commandId,
    type: 'move-token',
    mapId: 'map',
    combatId: 'combat',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    issuedAt: 10,
    expectedRevisions: { combat: 2, maps: 3 },
    expectedPosition: { x: 25, y: 25 },
    expectedElevationFeet: 0,
    targetPosition: { x: 75, y: 25 },
  }
}

describe('pending combat command session store', () => {
  it('survives a page-style reload and removes only after terminal settlement', () => {
    const storage = new MemoryStorage()
    expect(persistPendingCombatCommand(command(), storage)).toBe(true)
    expect(loadPendingCombatCommands(storage)).toEqual([command()])

    clearPendingCombatCommand(command().commandId, storage)
    expect(loadPendingCombatCommands(storage)).toEqual([])
    expect(storage.values.size).toBe(0)
  })

  it('never replaces a stable command id with a different payload', () => {
    const storage = new MemoryStorage()
    const original = command()
    expect(persistPendingCombatCommand(original, storage)).toBe(true)
    expect(persistPendingCombatCommand({
      ...original,
      targetPosition: { x: 125, y: 25 },
    }, storage)).toBe(false)
    expect(loadPendingCombatCommands(storage)).toEqual([original])
  })

  it('keeps the original actor-turn command across a reload instead of minting a second id', () => {
    const storage = new MemoryStorage()
    const original = command('map:player-action:original')
    const replacement = {
      ...command('map:player-action:new-after-reload'),
      issuedAt: 20,
      targetPosition: { x: 175, y: 25 },
    }
    expect(persistPendingCombatCommand(original, storage)).toBe(true)
    expect(persistPendingCombatCommand(replacement, storage)).toBe(false)
    expect(findPendingCombatCommandForActorTurn(replacement, storage)).toEqual(original)
    expect(loadPendingCombatCommands(storage)).toEqual([original])
  })

  it('fails closed on corrupt or schema-invalid stored JSON', () => {
    const storage = new MemoryStorage()
    storage.values.set(PENDING_COMBAT_COMMANDS_STORAGE_KEY, JSON.stringify({
      schemaVersion: 2,
      entries: [{
        scope: { roomId: 'local', memberId: 'local' },
        command: { ...command(), expectedRevisions: { combat: -1, maps: 3 } },
      }],
    }))
    expect(loadPendingCombatCommands(storage)).toEqual([])
    storage.values.set(PENDING_COMBAT_COMMANDS_STORAGE_KEY, '{')
    expect(loadPendingCombatCommands(storage)).toEqual([])
  })

  it('binds recovery and clearing to the original room member scope', () => {
    const storage = new MemoryStorage()
    const roomA = { roomId: 'ROOM-A', memberId: 'member-a' } satisfies PendingCombatCommandScope
    const roomB = { roomId: 'ROOM-B', memberId: 'member-b' } satisfies PendingCombatCommandScope
    const pending = command()

    expect(persistPendingCombatCommand(pending, storage, roomA)).toBe(true)
    expect(loadPendingCombatCommands(storage, roomA)).toEqual([pending])
    expect(loadPendingCombatCommands(storage, roomB)).toEqual([])
    expect(findPendingCombatCommandForActorTurn(pending, storage, roomB)).toBeUndefined()

    clearPendingCombatCommand(pending.commandId, storage, roomB)
    expect(loadPendingCombatCommands(storage, roomA)).toEqual([pending])
    clearPendingCombatCommand(pending.commandId, storage, roomA)
    expect(loadPendingCombatCommands(storage, roomA)).toEqual([])
  })

  it('fails closed when session storage cannot durably save the stable command id', () => {
    const storage: CombatCommandSessionStorage = {
      getItem: () => null,
      setItem: () => { throw new DOMException('quota exceeded', 'QuotaExceededError') },
      removeItem: () => undefined,
    }
    expect(persistPendingCombatCommand(command(), storage)).toBe(false)
    expect(loadPendingCombatCommands(storage)).toEqual([])
  })
})
