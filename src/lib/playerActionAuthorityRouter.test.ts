import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import {
  canSubmitPlayerCombatAction,
  preflightPlayerActionAuthority,
  reservePlayerActionExecution,
  type PlayerActionAuthorityAction,
} from './playerActionAuthorityRouter'

function makeToken(patch: Partial<Token> = {}): Token {
  return {
    id: 'hero-token',
    label: '新冒险者',
    x: 100,
    y: 100,
    color: '#34d399',
    emoji: '🧝',
    type: 'player',
    size: 1,
    characterId: 'hero',
    ...patch,
  }
}

function makeMap(tokens = [makeToken()]): BattleMap {
  return {
    id: 'map-1',
    name: '测试地图',
    width: 1000,
    height: 1000,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens,
  }
}

function makeAction(patch: Partial<PlayerActionAuthorityAction> = {}): PlayerActionAuthorityAction {
  return {
    id: 'action-1',
    mapId: 'map-1',
    combatId: 'combat-1',
    status: 'pending',
    type: 'move-token',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    round: 1,
    initiativeIndex: 0,
    ...patch,
  }
}

function makeCharacter(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    currentHp: 10,
    ...patch,
  } as Character
}

function makeContext(patch: Partial<Parameters<typeof preflightPlayerActionAuthority>[1]> = {}) {
  return {
    isDm: true,
    activeMap: makeMap(),
    combatId: 'combat-1',
    combatActive: true,
    round: 1,
    initiativeIndex: 0,
    currentTokenId: 'hero-token',
    processedActionIds: new Set<string>(),
    seenActionIds: new Set<string>(),
    ...patch,
  }
}

describe('player action authority router', () => {
  it('accepts a pending player action for the live combat turn', () => {
    const result = preflightPlayerActionAuthority(makeAction(), makeContext())

    expect(result.status).toBe('accepted')
    if (result.status === 'accepted') {
      expect(result.currentToken.id).toBe('hero-token')
    }
  })

  it('ignores actions that are not for this DM/map/pending snapshot', () => {
    expect(preflightPlayerActionAuthority(makeAction(), makeContext({ isDm: false })).status).toBe('ignored')
    expect(
      preflightPlayerActionAuthority(makeAction({ mapId: 'other-map' }), makeContext()).status,
    ).toBe('ignored')
    expect(preflightPlayerActionAuthority(makeAction({ status: 'done' }), makeContext()).status).toBe('ignored')
  })

  it('rejects stale combat and ended combat before execution', () => {
    expect(
      preflightPlayerActionAuthority(makeAction({ combatId: 'old-combat' }), makeContext()).status,
    ).toBe('rejected')
    expect(
      preflightPlayerActionAuthority(makeAction(), makeContext({ combatActive: false })).status,
    ).toBe('rejected')
  })

  it('rejects actions that do not match the current initiative actor', () => {
    const result = preflightPlayerActionAuthority(
      makeAction({ round: 2 }),
      makeContext({ round: 1, initiativeIndex: 0 }),
    )

    expect(result).toEqual({ status: 'rejected', reason: 'stale-turn' })
  })

  it('ignores already processed or seen actions', () => {
    expect(
      preflightPlayerActionAuthority(
        makeAction({ id: 'processed' }),
        makeContext({ processedActionIds: new Set(['processed']) }),
      ).status,
    ).toBe('ignored')
    expect(
      preflightPlayerActionAuthority(
        makeAction({ id: 'seen' }),
        makeContext({ seenActionIds: new Set(['seen']) }),
      ).status,
    ).toBe('ignored')
  })

  it('dedupes D&D authority actions but not movement envelopes', () => {
    const recent = new Map<string, number>()

    expect(reservePlayerActionExecution(makeAction({ type: 'move-token' }), recent, { now: 1000 })).toBe(true)
    expect(reservePlayerActionExecution(makeAction({ type: 'move-token' }), recent, { now: 1001 })).toBe(true)
    expect(reservePlayerActionExecution(makeAction({ id: '5e-attack', type: 'dnd5e-weapon-attack' }), recent, { now: 1004 })).toBe(true)
    expect(reservePlayerActionExecution(makeAction({ id: '5e-attack', type: 'dnd5e-weapon-attack' }), recent, { now: 1005 })).toBe(false)
    expect(reservePlayerActionExecution(makeAction({ id: 'fighter-feature', type: 'dnd5e-fighter-feature' }), recent, { now: 1006 })).toBe(true)
    expect(reservePlayerActionExecution(makeAction({ id: 'fighter-feature', type: 'dnd5e-fighter-feature' }), recent, { now: 1007 })).toBe(false)
    expect(reservePlayerActionExecution(makeAction({ id: 'class-feature', type: 'dnd5e-class-feature' }), recent, { now: 1008 })).toBe(true)
    expect(reservePlayerActionExecution(makeAction({ id: 'class-feature', type: 'dnd5e-class-feature' }), recent, { now: 1009 })).toBe(false)
    expect(reservePlayerActionExecution(makeAction({ id: 'plugin-feature', type: 'dnd5e-plugin-action' }), recent, { now: 1010 })).toBe(true)
    expect(reservePlayerActionExecution(makeAction({ id: 'plugin-feature', type: 'dnd5e-plugin-action' }), recent, { now: 1011 })).toBe(false)
    expect(reservePlayerActionExecution(makeAction({ id: 'item-use', type: 'dnd5e-item-use' }), recent, { now: 1012 })).toBe(true)
    expect(reservePlayerActionExecution(makeAction({ id: 'item-use', type: 'dnd5e-item-use' }), recent, { now: 1013 })).toBe(false)
    expect(
      reservePlayerActionExecution(makeAction({ id: '5e-attack', type: 'dnd5e-weapon-attack' }), recent, {
        now: 1004 + 8001,
      }),
    ).toBe(true)
  })

  it('allows the assigned player to submit during their live turn', () => {
    expect(
      canSubmitPlayerCombatAction({
        activeMap: makeMap(),
        mode: 'player',
        playerCombatLocked: false,
        combatActive: true,
        combatActiveSnapshot: true,
        turnCharacter: makeCharacter(),
        currentInitiativeToken: makeToken(),
        pendingAction: null,
        playerCharacter: makeCharacter(),
        characters: [makeCharacter()],
      }),
    ).toBe(true)
  })

  it('blocks player submissions while locked, stale, pending, unassigned, or defeated', () => {
    const base = {
      activeMap: makeMap(),
      mode: 'player' as const,
      playerCombatLocked: false,
      combatActive: true,
      combatActiveSnapshot: true,
      turnCharacter: makeCharacter(),
      currentInitiativeToken: makeToken(),
      pendingAction: null,
      playerCharacter: makeCharacter(),
      characters: [makeCharacter()],
    }

    expect(canSubmitPlayerCombatAction({ ...base, playerCombatLocked: true })).toBe(false)
    expect(canSubmitPlayerCombatAction({ ...base, combatActiveSnapshot: false })).toBe(false)
    expect(canSubmitPlayerCombatAction({ ...base, pendingAction: { id: 'action-1' } })).toBe(false)
    expect(canSubmitPlayerCombatAction({ ...base, playerCharacter: makeCharacter({ id: 'other' }) })).toBe(false)
    expect(canSubmitPlayerCombatAction({ ...base, characters: [makeCharacter({ currentHp: 0 })] })).toBe(false)
    expect(canSubmitPlayerCombatAction({ ...base, currentInitiativeToken: makeToken({ type: 'enemy' }) })).toBe(false)
  })
})
