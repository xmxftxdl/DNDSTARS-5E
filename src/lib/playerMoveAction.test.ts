import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import type { HeadlessCombatResult } from './headlessDmCombatEngine'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import {
  buildCommitPlayerMoveAction,
  buildDeferredPlayerMoveAction,
  buildPlayerMoveCommitAfterOpportunity,
  playerMoveRejectReason,
  planPlayerMoveAfterOpportunity,
  planPlayerMoveAfterPreview,
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
    expect(playerMoveRejectReason('not-current-turn')).toBe('not-current-turn')
  })

  it('plans the next movement step after the headless preview', () => {
    const prepared = preparePlayerMoveAction({
      action: makeAction(),
      map: makeMap(),
      characters: [makeCharacter()],
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    expect(
      planPlayerMoveAfterPreview({
        moveAction: prepared.moveAction,
        preview: { ok: false, reason: 'movement-locked' },
      }),
    ).toEqual({ status: 'rejected', reason: 'no-move' })

    expect(
      planPlayerMoveAfterPreview({
        moveAction: prepared.moveAction,
        preview: {
          ok: true,
          targetPosition: { x: 200, y: 100 },
          movedFeet: 10,
          opportunityAttackerTokenIds: [],
        },
      }),
    ).toEqual({ status: 'accepted', acceptedPosition: { x: 200, y: 100 } })

    expect(
      planPlayerMoveAfterPreview({
        moveAction: prepared.moveAction,
        preview: {
          ok: true,
          targetPosition: { x: 200, y: 100 },
          movedFeet: 10,
          opportunityAttackerTokenIds: ['goblin-token'],
        },
      }),
    ).toEqual({
      status: 'opportunity',
      targetPosition: { x: 200, y: 100 },
      movedFeet: 10,
      opportunityAttackerTokenIds: ['goblin-token'],
      deferredMoveAction: { ...prepared.moveAction, deferTokenMove: true },
    })
  })

  it('builds deferred and commit move actions without losing actor identity', () => {
    const prepared = preparePlayerMoveAction({
      action: makeAction(),
      map: makeMap(),
      characters: [makeCharacter()],
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    expect(buildDeferredPlayerMoveAction(prepared.moveAction)).toEqual({
      ...prepared.moveAction,
      deferTokenMove: true,
    })
    expect(
      buildCommitPlayerMoveAction({
        moveAction: prepared.moveAction,
        targetPosition: { x: 250, y: 150 },
        feet: 15,
      }),
    ).toEqual({
      type: 'commit-token-move',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetPosition: { x: 250, y: 150 },
      feet: 15,
    })
  })

  it('builds the post-opportunity commit only when the mover is still alive', () => {
    const prepared = preparePlayerMoveAction({
      action: makeAction(),
      map: makeMap(),
      characters: [makeCharacter()],
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    expect(
      buildPlayerMoveCommitAfterOpportunity({
        moveAction: prepared.moveAction,
        targetPosition: { x: 250, y: 150 },
        feet: 15,
        token: prepared.token,
        characters: [makeCharacter({ currentHp: 1 })],
      }),
    ).toEqual({
      ok: true,
      commitAction: {
        type: 'commit-token-move',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        targetPosition: { x: 250, y: 150 },
        feet: 15,
      },
    })

    expect(
      buildPlayerMoveCommitAfterOpportunity({
        moveAction: prepared.moveAction,
        targetPosition: { x: 250, y: 150 },
        feet: 15,
        token: prepared.token,
        characters: [makeCharacter({ currentHp: 0 })],
      }),
    ).toEqual({
      ok: false,
      reason: 'mover-defeated',
      acceptedPosition: { x: 100, y: 100 },
    })
  })

  it('plans post-opportunity movement settlement and AP logs', () => {
    const prepared = preparePlayerMoveAction({
      action: makeAction(),
      map: makeMap(),
      characters: [makeCharacter()],
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const movePlan = planPlayerMoveAfterPreview({
      moveAction: prepared.moveAction,
      preview: {
        ok: true,
        targetPosition: { x: 250, y: 150 },
        movedFeet: 15,
        opportunityAttackerTokenIds: ['goblin-token'],
      },
    })

    expect(movePlan.status).toBe('opportunity')
    if (movePlan.status !== 'opportunity') return

    expect(
      planPlayerMoveAfterOpportunity({
        moveAction: prepared.moveAction,
        movePlan,
        token: prepared.token,
        characters: [makeCharacter({ currentHp: 1 })],
      }),
    ).toEqual({
      status: 'commit',
      commitAction: {
        type: 'commit-token-move',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        targetPosition: { x: 250, y: 150 },
        feet: 15,
      },
      acceptedPosition: { x: 250, y: 150 },
      apLog: { amount: 1, action: '移动', detail: '15 尺' },
    })

    expect(
      planPlayerMoveAfterOpportunity({
        moveAction: prepared.moveAction,
        movePlan,
        token: prepared.token,
        characters: [makeCharacter({ currentHp: 0 })],
      }),
    ).toEqual({
      status: 'interrupted',
      acceptedReason: 'mover-defeated',
      acceptedPosition: { x: 100, y: 100 },
      apLog: { amount: 1, action: '移动', detail: '15 尺，移动被打断' },
    })
  })
})
