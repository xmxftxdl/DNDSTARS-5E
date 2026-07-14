import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import {
  planPlayerActionAuthorityExecution,
  playerActionAuthorityRoute,
} from './playerActionAuthorityExecution'

function token(): Token {
  return {
    id: 'hero-token',
    label: 'Hero',
    x: 25,
    y: 25,
    color: '#34d399',
    emoji: 'H',
    type: 'player',
    size: 1,
    characterId: 'hero',
  }
}

function map(): BattleMap {
  return {
    id: 'map-1',
    name: 'Authority test',
    width: 500,
    height: 500,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens: [token()],
  }
}

function action(type: SharedPlayerActionState['type'] = 'move-token'): SharedPlayerActionState {
  return {
    id: 'action-1',
    seq: 1,
    mapId: 'map-1',
    combatId: 'combat-1',
    sourceMode: 'player',
    status: 'pending',
    type,
    actorTokenId: 'hero-token',
    characterId: 'hero',
    round: 1,
    initiativeIndex: 0,
    updatedAt: 100,
  }
}

function preflight() {
  return {
    isDm: true,
    activeMap: map(),
    combatId: 'combat-1',
    combatActive: true,
    round: 1,
    initiativeIndex: 0,
    currentTokenId: 'hero-token',
    processedActionIds: new Set<string>(),
    seenActionIds: new Set<string>(),
  }
}

describe('player action authority execution plan', () => {
  it('classifies every supported authority route', () => {
    expect(playerActionAuthorityRoute(action('activate-feature'))).toBe('activate-feature')
    expect(playerActionAuthorityRoute(action('end-turn'))).toBe('simple')
    expect(playerActionAuthorityRoute(action('attack-token'))).toBe('attack-token')
    expect(playerActionAuthorityRoute(action('dnd5e-weapon-attack'))).toBe('dnd5e-weapon-attack')
    expect(playerActionAuthorityRoute(action('aoe-attack'))).toBe('aoe-attack')
    expect(playerActionAuthorityRoute(action('move-token'))).toBe('move-token')
  })

  it('runs preflight before reserving execution', () => {
    const recent = new Map<string, number>()
    const result = planPlayerActionAuthorityExecution({
      action: { ...action('attack-token'), round: 2 },
      preflight: preflight(),
      recentActionKeys: recent,
      now: 1000,
    })

    expect(result).toEqual({ status: 'rejected', reason: 'stale-turn' })
    expect(recent.size).toBe(0)
  })

  it('reserves an accepted attack exactly once', () => {
    const recent = new Map<string, number>()
    const first = planPlayerActionAuthorityExecution({
      action: action('attack-token'),
      preflight: preflight(),
      recentActionKeys: recent,
      now: 1000,
    })
    const second = planPlayerActionAuthorityExecution({
      action: action('attack-token'),
      preflight: preflight(),
      recentActionKeys: recent,
      now: 1001,
    })

    expect(first).toEqual({ status: 'accepted', route: 'attack-token' })
    expect(second).toEqual({ status: 'ignored' })
  })
})
