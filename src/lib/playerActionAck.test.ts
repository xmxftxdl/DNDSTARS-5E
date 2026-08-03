import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import {
  buildPlayerActionAck,
  buildPlayerActionProcessedState,
  persistPlayerActionProcessedState,
} from './playerActionAck'
import type { PlayerActionResultBaseline } from './playerActionResult'

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
    ...patch,
  }
}

function makeToken(patch: Partial<Token> = {}): Token {
  return {
    id: 'hero-token',
    label: '新冒险者',
    x: 100,
    y: 100,
    color: '#34d399',
    emoji: '🧝',
    size: 1,
    type: 'player',
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

function makeCharacter(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: '新冒险者',
    player: '玩家',
    avatar: '🧝',
    accent: 'emerald',
    race: '人类',
    level: 1,
    charClass: '弓手',
    background: '',
    experience: 0,
    reputation: 0,
    maxHp: 10,
    currentHp: 10,
    tempHp: 0,
    hitDice: '1d10',
    ac: 10,
    initiativeBonus: 0,
    speed: 30,
    passivePerception: 10,
    inspiration: 0,
    saveDC: 12,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    conditions: [],
    equipment: {},
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function makeBaseline(
  character = makeCharacter(),
  map = makeMap(),
): PlayerActionResultBaseline {
  return {
    characters: [character],
    map,
  }
}

describe('player action ack helpers', () => {
  it('builds an accepted ack with appliedAt and action result summary', () => {
    const before = makeBaseline()
    const after = makeBaseline(
      makeCharacter({ currentHp: 9 }),
      makeMap([makeToken({ x: 150, y: 100 })]),
    )

    const ack = buildPlayerActionAck({
      action: makeAction(),
      status: 'accepted',
      mapId: 'map-1',
      combatId: 'combat-1',
      round: 1,
      initiativeIndex: 0,
      appliedAt: 2000,
      acceptedPosition: { x: 150, y: 100 },
      acceptedElevationFeet: 40,
      dnd5eDeclarativeAttackIntents: {
        triggeredFeatureIds: ['plugin:subclass.strike'],
        consumedFeatureIds: ['plugin:subclass.strike'],
      },
      before,
      after,
    })

    expect(ack.id).toBe('action-1:ack:2000')
    expect(ack.appliedAt).toBe(2000)
    expect(ack.acceptedPosition).toEqual({ x: 150, y: 100 })
    expect(ack.acceptedElevationFeet).toBe(40)
    expect(ack.dnd5eDeclarativeAttackIntents).toEqual({
      triggeredFeatureIds: ['plugin:subclass.strike'],
      consumedFeatureIds: ['plugin:subclass.strike'],
    })
    expect(ack.result?.changedCharacters[0]?.hp).toEqual({ before: 10, after: 9 })
    expect(ack.result?.changedTokens[0]?.position).toEqual({
      before: { x: 100, y: 100 },
      after: { x: 150, y: 100 },
    })
  })

  it('builds a rejected ack without appliedAt or result summary', () => {
    const ack = buildPlayerActionAck({
      action: makeAction(),
      status: 'rejected',
      reason: 'stale-turn',
      mapId: 'map-1',
      combatId: 'combat-1',
      round: 1,
      initiativeIndex: 0,
      appliedAt: 2000,
      before: makeBaseline(),
      after: makeBaseline(makeCharacter({ currentHp: 9 })),
    })

    expect(ack.status).toBe('rejected')
    expect(ack.reason).toBe('stale-turn')
    expect(ack.appliedAt).toBeUndefined()
    expect(ack.result).toBeUndefined()
  })

  it('appends processed ids for the same combat and ignores old combat ids', () => {
    const current = {
      mapId: 'map-1',
      combatId: 'combat-1',
      actionIds: ['old-1', 'old-2'],
      updatedAt: 1000,
    }

    expect(
      buildPlayerActionProcessedState({
        action: makeAction({ id: 'action-3' }),
        current,
        updatedAt: 2000,
        queueLimit: 1,
      }),
    ).toMatchObject({
      actionIds: ['old-1', 'old-2', 'action-3'],
      updatedAt: 2000,
    })

    expect(
      buildPlayerActionProcessedState({
        action: makeAction({ id: 'new-combat-action', combatId: 'combat-2' }),
        current,
        updatedAt: 3000,
      }).actionIds,
    ).toEqual(['new-combat-action'])
  })

  it('persists processed action state through load and save callbacks', async () => {
    const calls: string[] = []
    let saved: ReturnType<typeof buildPlayerActionProcessedState> | undefined

    await persistPlayerActionProcessedState({
      action: makeAction({ id: 'action-3' }),
      now: () => 3000,
      loadCurrent: async () => {
        calls.push('load')
        return {
          mapId: 'map-1',
          combatId: 'combat-1',
          actionIds: ['action-1', 'action-2'],
          updatedAt: 2000,
        }
      },
      saveProcessed: async (processed) => {
        calls.push('save')
        saved = processed
      },
    })

    expect(calls).toEqual(['load', 'save'])
    expect(saved).toMatchObject({
      mapId: 'map-1',
      combatId: 'combat-1',
      actionIds: ['action-1', 'action-2', 'action-3'],
      updatedAt: 3000,
    })
  })
})
