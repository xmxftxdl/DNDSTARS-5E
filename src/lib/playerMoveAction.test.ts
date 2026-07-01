import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import type { HeadlessCombatResult } from './headlessDmCombatEngine'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import {
  playerMoveRejectReason,
  preparePlayerMoveAction,
  summarizeHeadlessPlayerMovePreview,
} from './playerMoveAction'

function makeCharacter(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    currentHp: 10,
    ...patch,
  } as Character
}

function makeToken(patch: Partial<Token> = {}): Token {
  return {
    id: 'hero-token',
    label: 'Hero',
    x: 100,
    y: 100,
    color: '#34d399',
    emoji: '🙂',
    type: 'player',
    size: 1,
    characterId: 'hero',
    ...patch,
  }
}

function makeMap(tokens = [makeToken()]): BattleMap {
  return {
    id: 'map-1',
    name: 'Test Map',
    width: 1000,
    height: 1000,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens,
  }
}

function makeAction(patch: Partial<SharedPlayerActionState> = {}): SharedPlayerActionState {
  return {
    id: 'action-1',
    mapId: 'map-1',
    combatId: 'combat-1',
    sourceMode: 'player',
    status: 'pending',
    type: 'move-token',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: 1000,
    targetPosition: { x: 200, y: 100 },
    ...patch,
  }
}

describe('player move action helpers', () => {
  it('prepares a valid player move action for the headless engine', () => {
    const result = preparePlayerMoveAction({
      action: makeAction(),
      map: makeMap(),
      characters: [makeCharacter()],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.actor.id).toBe('hero')
      expect(result.token.id).toBe('hero-token')
      expect(result.moveAction).toEqual({
        type: 'move-token',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        targetPosition: { x: 200, y: 100 },
      })
    }
  })

  it('rejects invalid player move context before consuming movement', () => {
    expect(
      preparePlayerMoveAction({
        action: makeAction({ targetPosition: undefined }),
        map: makeMap(),
        characters: [makeCharacter()],
      }),
    ).toEqual({ ok: false, reason: 'invalid-move' })

    expect(
      preparePlayerMoveAction({
        action: makeAction(),
        map: makeMap([makeToken({ type: 'enemy' })]),
        characters: [makeCharacter()],
      }),
    ).toEqual({ ok: false, reason: 'invalid-move' })
  })

  it('summarizes a headless move preview including opportunity attackers', () => {
    const token = makeToken()
    const map = makeMap([token])
    const result: HeadlessCombatResult = {
      ok: true,
      state: {
        map: makeMap([makeToken({ x: 200, y: 100 })]),
        characters: [makeCharacter()],
        active: true,
        round: 1,
        initiativeIndex: 0,
        initiativeOrder: [],
        enemyApByToken: {},
      },
      events: [
        {
          type: 'token-moved',
          tokenId: 'hero-token',
          from: { x: 100, y: 100 },
          to: { x: 200, y: 100 },
          feet: 10,
          triggersMoveEffects: true,
        },
        { type: 'opportunity-triggered', attackerTokenId: 'goblin-token', movingTokenId: 'hero-token' },
      ],
    }

    expect(
      summarizeHeadlessPlayerMovePreview({
        result,
        token,
        map,
        requestedPosition: { x: 200, y: 100 },
      }),
    ).toEqual({
      ok: true,
      targetPosition: { x: 200, y: 100 },
      movedFeet: 10,
      opportunityAttackerTokenIds: ['goblin-token'],
    })
  })

  it('maps movement lock failures to the player-facing no-move reason', () => {
    expect(playerMoveRejectReason('movement-locked')).toBe('no-move')
    expect(playerMoveRejectReason('out-of-range')).toBe('out-of-range')
  })
})
