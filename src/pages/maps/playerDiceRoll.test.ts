import { beforeEach, describe, expect, it } from 'vitest'
import type { SharedRollRequestEvent } from '../../lib/sharedCombatTypes'
import {
  forgetPendingPlayerDiceRollRequest,
  isPlayerDiceRollRequestForClient,
  pendingPlayerDiceRollRequests,
  playerDiceRollResultValue,
  rememberPendingPlayerDiceRollRequest,
  resetPendingPlayerDiceRollRequestsForTests,
  savingThrowAbilityFromRollLabel,
  shouldDelegateCombatD20ToPlayer,
} from './playerDiceRoll'

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
