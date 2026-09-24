import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedRollRequestEvent } from '../../lib/sharedCombatTypes'
import {
  forgetPendingPlayerDiceRollRequest,
  isPlayerDiceRollRequestForClient,
  playerDiceRequestMatchesCombat,
  pendingPlayerDiceRollRequests,
  playerDiceRollResultValue,
  playerDiceRollResultValues,
  performPlayerDiceRoll,
  receivePlayerDicePresentation,
  retryPlayerDiceRollRequest,
  completePlayerDiceRollRequest,
  completedPlayerDiceRollValues,
  savePlayerDiceRollValues,
  savedPlayerDiceRollValues,
  rememberPendingPlayerDiceRollRequest,
  resetPendingPlayerDiceRollRequestsForTests,
  savingThrowAbilityFromRollLabel,
  shouldDelegateCombatD20ToPlayer,
} from './playerDiceRoll'

describe('DM mirrors player dice before settlement', () => {
  it('rejects requests and late results from the ended combat after restarting', () => {
    for (const delivery of ['player-roll-request', 'player-roll-result', 'broadcast-result'] as const) {
      expect(playerDiceRequestMatchesCombat(event({ combatId: 'ended', delivery }), 'new')).toBe(false)
      expect(playerDiceRequestMatchesCombat(event({ combatId: 'new', delivery }), 'new')).toBe(true)
    }
  })
  it.each([['d20', 1, 20], ['dice', 4, 10], ['dice', 2, 4]] as const)('%s %i d%i plays once and waits for DM animation', async (kind, count, sides) => {
    let finish!: () => void
    const present = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const pending = { kind, count, sides, targetCharacterId: 'wizard', resolve: vi.fn() }
    const start = event({ kind, count, sides, targetCharacterId: 'wizard', sourceMode: 'player',
      delivery: 'player-roll-start', values: Array(count).fill(3) })
    expect(receivePlayerDicePresentation(start, pending, present)).toBe(true)
    expect(present).toHaveBeenCalledWith(Array(count).fill(3))
    expect(pending.resolve).not.toHaveBeenCalled()
    receivePlayerDicePresentation(start, pending, present)
    receivePlayerDicePresentation({ ...start, delivery: 'player-roll-result' }, pending, present)
    expect(present).toHaveBeenCalledTimes(1)
    expect(pending.resolve).not.toHaveBeenCalled()
    finish()
    await Promise.resolve()
    expect(pending.resolve).toHaveBeenCalledWith(Array(count).fill(3))
  })

  it('mirrors a terminal result if its start was missed, and rejects another owner', async () => {
    const pending = { kind: 'd20' as const, count: 1, sides: 20, targetCharacterId: 'wizard', resolve: vi.fn() }
    const present = vi.fn(async () => {})
    const result = event({ delivery: 'player-roll-result', targetCharacterId: 'other', values: [18] })
    expect(receivePlayerDicePresentation(result, pending, present)).toBe(false)
    expect(present).not.toHaveBeenCalled()
    expect(receivePlayerDicePresentation({ ...result, targetCharacterId: 'wizard' }, pending, present)).toBe(true)
    await Promise.resolve()
    expect(pending.resolve).toHaveBeenCalledWith([18])
  })
})

const event = (patch: Partial<SharedRollRequestEvent> = {}): SharedRollRequestEvent => ({
  eventId: 'event-1',
  mapId: 'map-1',
  sourceMode: 'dm',
  requestId: 'request-1',
  kind: 'd20',
  count: 1,
  sides: 20,
  values: [],
  label: '火球术·敏捷豁免',
  targetName: '阿兰',
  delivery: 'player-roll-request',
  targetCharacterId: 'character-1',
  rollKind: 'saving-throw',
  updatedAt: 100,
  ...patch,
})

describe('player dice-roll ownership', () => {
  beforeEach(() => resetPendingPlayerDiceRollRequestsForTests())

  it('retries a lost request until the Host receives the result', async () => {
    vi.useFakeTimers()
    try {
      let pending = true
      const publish = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
      retryPlayerDiceRollRequest(publish, () => pending)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(publish).toHaveBeenCalledTimes(2)
      pending = false
      await vi.advanceTimersByTimeAsync(6_000)
      expect(publish).toHaveBeenCalledTimes(2)
    } finally { vi.useRealTimers() }
  })

  it('retains completed faces for redelivery without reopening the roll prompt', () => {
    const request = event({ updatedAt: 1_000 })
    savePlayerDiceRollValues(request, [17])
    completePlayerDiceRollRequest(request.requestId)
    rememberPendingPlayerDiceRollRequest({ ...request, updatedAt: 2_000 })
    expect(pendingPlayerDiceRollRequests(2_001)).toEqual([])
    expect(completedPlayerDiceRollValues(request.requestId)).toEqual([17])
  })

  it('delegates player saving throws and ability checks initiated by the Host', () => {
    expect(shouldDelegateCombatD20ToPlayer({
      sourceMode: 'dm', rollKind: 'saving-throw', rollerSide: 'player', targetCharacterId: 'character-1',
    })).toBe(true)
    expect(shouldDelegateCombatD20ToPlayer({
      sourceMode: 'dm', rollKind: 'ability-check', rollerSide: 'player', targetCharacterId: 'character-1',
    })).toBe(true)
    expect(shouldDelegateCombatD20ToPlayer({
      sourceMode: 'dm', rollKind: 'attack', rollerSide: 'player', targetCharacterId: 'character-1',
    })).toBe(true)
    expect(shouldDelegateCombatD20ToPlayer({
      sourceMode: 'dm', rollKind: 'saving-throw', rollerSide: 'enemy', targetCharacterId: 'character-1',
    })).toBe(false)
  })

  it('shows a request only to a player controlling the targeted character', () => {
    expect(isPlayerDiceRollRequestForClient({
      event: event(), mode: 'player', spectator: false,
      controlledCharacterIds: new Set(['character-1']),
    })).toBe(true)
    expect(isPlayerDiceRollRequestForClient({
      event: event(), mode: 'player', spectator: false,
      controlledCharacterIds: new Set(['character-2']),
    })).toBe(false)
    expect(isPlayerDiceRollRequestForClient({
      event: event(), mode: 'player', spectator: true,
      controlledCharacterIds: new Set(['character-1']),
    })).toBe(false)
  })

  it('accepts only a matching, valid d20 response', () => {
    expect(playerDiceRollResultValue(event({
      sourceMode: 'player', delivery: 'player-roll-result', values: [17],
    }), 'character-1')).toBe(17)
    expect(playerDiceRollResultValue(event({
      sourceMode: 'player', delivery: 'player-roll-result', values: [21],
    }), 'character-1')).toBeNull()
    expect(playerDiceRollResultValue(event({
      sourceMode: 'player', delivery: 'player-roll-result', values: [17],
    }), 'character-2')).toBeNull()
  })

  it('derives the map marker ability from Chinese and SRD save labels', () => {
    expect(savingThrowAbilityFromRollLabel('火球术·敏捷豁免')).toBe('dex')
    expect(savingThrowAbilityFromRollLabel('震慑凝视·WIS 豁免')).toBe('wis')
    expect(savingThrowAbilityFromRollLabel('普通攻击检定')).toBeUndefined()
  })

  it('hands an actionable request from the campaign shell to the map workspace', () => {
    const request = event({ requestId: 'request-handoff', updatedAt: 1_000 })
    rememberPendingPlayerDiceRollRequest(request)
    expect(pendingPlayerDiceRollRequests(1_001)).toEqual([request])

    forgetPendingPlayerDiceRollRequest(request.requestId)
    expect(pendingPlayerDiceRollRequests(1_002)).toEqual([])
  })

  it('drops an expired campaign-shell handoff', () => {
    rememberPendingPlayerDiceRollRequest(event({
      requestId: 'request-expired',
      updatedAt: 1_000,
    }))
    expect(pendingPlayerDiceRollRequests(301_001)).toEqual([])
  })
})

describe('player-owned spell damage pools', () => {
  beforeEach(() => resetPendingPlayerDiceRollRequestsForTests())
  for (const count of [4, 8, 26]) it(`keeps all ${count} damage dice on the controlling player, including retries`, async () => {
    const request = event({ kind: 'dice', count, sides: 10, rollKind: undefined, label: '火焰箭·伤害', targetName: '牛头人' })
    const owner = { event: request, mode: 'player' as const, spectator: false, controlledCharacterIds: new Set(['character-1']) }
    expect(isPlayerDiceRollRequestForClient(owner)).toBe(true)
    expect(isPlayerDiceRollRequestForClient({ ...owner, controlledCharacterIds: new Set(['other-player']) })).toBe(false)
    expect(isPlayerDiceRollRequestForClient({ ...owner, mode: 'dm' })).toBe(false)
    const random = vi.fn(() => 7)
    const present = vi.fn(async (values: number[]) => {
      expect(savedPlayerDiceRollValues(request.requestId)).toEqual(values)
      return [1] // A capped or changed visual result must not replace the authoritative pool.
    })
    const values = await performPlayerDiceRoll(request, random, present)
    expect(values).toEqual(Array(count).fill(7))
    expect(await performPlayerDiceRoll(request, random, present)).toEqual(values)
    expect(random).toHaveBeenCalledTimes(count)
    expect(present).toHaveBeenCalledTimes(1)
    const response = { ...request, delivery: 'player-roll-result' as const, sourceMode: 'player' as const, values }
    expect(playerDiceRollResultValues(response, request)).toEqual(values)
    for (const invalid of [{ sides: 6 }, { count: 1 }, { values: [7] }, { values: Array(count).fill(11) }, { targetCharacterId: 'other-player' }]) {
      expect(playerDiceRollResultValues({ ...response, ...invalid }, request)).toBeNull()
    }
  })
})
