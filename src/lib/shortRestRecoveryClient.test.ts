import { expect, it, vi } from 'vitest'
import { requestShortRestRecovery, type ShortRestClientPorts } from './shortRestRecoveryClient'
import type { Dnd5eShortRestRecoveryReceipt } from '../rulesets/dnd5e/shortRestRecoveryAuthority'
const request = { advanceId: 'rest', characterId: 'hero', mapId: 'map', tokenId: 'token', poolIndex: 0, expectedPoolCurrent: 2 }
function fixture() {
  const storage = new Map<string, string>()
  let now = 0
  let journal: unknown = { schemaVersion: 1, receipts: [] }
  let ack: unknown = null
  let identity: { roomId: string; memberId: string } | undefined = { roomId: 'room', memberId: 'player' }
  const ports: ShortRestClientPorts = {
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value) }, removeItem: key => { storage.delete(key) } },
    identity: () => identity, read: vi.fn(async name => name === 'player-action-ack' ? ack : journal),
    append: vi.fn(async () => {}), id: vi.fn(() => 'command'), now: () => now,
    wait: async () => { now += 1000 }, timeoutMs: 1000,
  }
  const receipt: Dnd5eShortRestRecoveryReceipt = { command: { ...request, id: 'command' }, hitDiceHealing: 12, songOfRestHealing: 0, healingApplied: 12 }
  return { ports, storage, receipt, setJournal: (value: unknown) => { journal = value }, setAck: (value: unknown) => { ack = value },
    changeRoom: () => { identity = { roomId: 'another', memberId: 'player' } } }
}
it('sends only choices and waits for a durable receipt instead of accepting an ACK as HP authority', async () => {
  const f = fixture()
  f.ports.append = vi.fn(async action => {
    expect(action).toMatchObject({ type: 'dnd5e-short-rest-recovery', roomMemberId: 'player', dnd5eShortRestRecovery: { advanceId: 'rest', poolIndex: 0 } })
    expect(action.combatId).toBeUndefined()
    expect(JSON.stringify(action)).not.toMatch(/healingRoll|currentHp|hitDieRoll/)
    f.setJournal({ schemaVersion: 1, receipts: [f.receipt] })
  })
  expect(await requestShortRestRecovery(request, f.ports)).toEqual(f.receipt)
  expect(f.storage.size).toBe(0)
})
it('keeps the request ID after timeout and resumes it after reload without another command or roll', async () => {
  const f = fixture()
  f.setAck({ actionId: 'command', mapId: 'map', status: 'accepted' })
  await expect(requestShortRestRecovery(request, f.ports)).rejects.toThrow('仍在等待')
  expect(f.storage.size).toBe(1)
  f.setJournal({ schemaVersion: 1, receipts: [f.receipt] })
  const next = { ...f.ports, id: vi.fn(() => 'new-command'), append: vi.fn(async () => {}) }
  expect(await requestShortRestRecovery(request, next)).toEqual(f.receipt)
  expect(next.append).not.toHaveBeenCalled()
  expect(next.id).not.toHaveBeenCalled()
  expect(f.storage.size).toBe(0)
})
it('preserves the pending ID after an ambiguous append failure and refuses changed options', async () => {
  const f = fixture()
  f.ports.append = vi.fn(async () => { throw Error('Failed to fetch') })
  await expect(requestShortRestRecovery(request, f.ports)).rejects.toThrow('Failed to fetch')
  expect(f.storage.size).toBe(1)
  await expect(requestShortRestRecovery({ ...request, poolIndex: 1 }, f.ports)).rejects.toThrow('上一笔')
  expect(f.ports.append).toHaveBeenCalledTimes(1)
})
it('clears a terminal rejection so a corrected request can receive a new ID', async () => {
  const f = fixture()
  f.setAck({ actionId: 'command', mapId: 'map', recipientMemberId: 'player', status: 'rejected', reason: 'hit-dice-conflict' })
  await expect(requestShortRestRecovery(request, f.ports)).rejects.toThrow('hit-dice-conflict')
  expect(f.storage.size).toBe(0)
})
it('ignores another member acknowledgement and keeps the request pending', async () => {
  const f = fixture()
  f.setAck({ actionId: 'command', mapId: 'map', recipientMemberId: 'another', status: 'rejected' })
  await expect(requestShortRestRecovery(request, f.ports)).rejects.toThrow('仍在等待')
  expect(f.storage.size).toBe(1)
})
it('stops if the player changes rooms during the request', async () => {
  const f = fixture()
  f.ports.append = vi.fn(async () => { f.changeRoom() })
  await expect(requestShortRestRecovery(request, f.ports)).rejects.toThrow('房间已切换')
  expect(f.storage.size).toBe(1)
})
