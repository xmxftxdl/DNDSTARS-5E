import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character, CombatSkill } from '../types/character'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import {
  buildSimpleHeadlessPlayerAction,
  isSimpleHeadlessPlayerActionType,
} from './simpleHeadlessPlayerAction'

function makeSkill(patch: Partial<CombatSkill> = {}): CombatSkill {
  return {
    id: 'skill-1',
    name: 'Skill',
    emoji: '',
    description: '',
    apCost: 1,
    cooldown: 1,
    cdReduction: 0,
    remaining: 0,
    usedThisTurn: false,
    damageCount: 0,
    damageSides: 0,
    damageBonus: 0,
    ...patch,
  }
}

function makeCharacter(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    combatSkills: [makeSkill()],
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
    emoji: '',
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
    type: 'use-skill',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: 1000,
    skillId: 'skill-1',
    ...patch,
  }
}

const baseInput = (action: SharedPlayerActionState) => ({
  action,
  map: makeMap(),
  characters: [makeCharacter()],
})

describe('simple headless player action builder', () => {
  it('recognizes action types that can be routed without page-specific dice prompts', () => {
    expect(isSimpleHeadlessPlayerActionType('use-skill')).toBe(true)
    expect(isSimpleHeadlessPlayerActionType('qi-reduce-cooldown')).toBe(true)
    expect(isSimpleHeadlessPlayerActionType('class-resource-action')).toBe(true)
    expect(isSimpleHeadlessPlayerActionType('end-turn')).toBe(true)
    expect(isSimpleHeadlessPlayerActionType('bullet-match-swap')).toBe(true)
    expect(isSimpleHeadlessPlayerActionType('attack-token')).toBe(false)
    expect(isSimpleHeadlessPlayerActionType('move-token')).toBe(false)
  })

  it('builds a seeded bullet-match swap for DM validation', () => {
    expect(
      buildSimpleHeadlessPlayerAction(
        baseInput(makeAction({
          type: 'bullet-match-swap',
          bulletSwap: { from: 1, to: 9, seed: 42 },
        })),
      ),
    ).toMatchObject({
      ok: true,
      settlement: 'standard',
      headlessAction: {
        type: 'bullet-match-swap',
        from: 1,
        to: 9,
        seed: 42,
      },
    })
  })

  it('builds use-skill and calm-spirit actions', () => {
    expect(buildSimpleHeadlessPlayerAction(baseInput(makeAction()))).toMatchObject({
      ok: true,
      settlement: 'standard',
      headlessAction: {
        type: 'use-skill',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        skillId: 'skill-1',
      },
    })

    expect(
      buildSimpleHeadlessPlayerAction(
        baseInput(makeAction({ type: 'calm-spirit', calmSpiritEffect: 'cooldown' })),
      ),
    ).toMatchObject({
      ok: true,
      headlessAction: {
        type: 'calm-spirit',
        effect: 'cooldown',
        skillId: 'skill-1',
      },
    })
  })

  it('builds move-mode actions with their token for movement ACKs', () => {
    const result = buildSimpleHeadlessPlayerAction(
      baseInput(
        makeAction({
          type: 'agile-leap-move',
          targetPosition: { x: 150, y: 100 },
        }),
      ),
    )

    expect(result).toMatchObject({
      ok: true,
      settlement: 'move',
      token: { id: 'hero-token' },
      headlessAction: {
        type: 'move-token',
        targetPosition: { x: 150, y: 100 },
        mode: 'agile-leap',
      },
    })
  })

  it('builds end-turn actions with a dedicated settlement mode', () => {
    expect(buildSimpleHeadlessPlayerAction(baseInput(makeAction({ type: 'end-turn' })))).toMatchObject({
      ok: true,
      settlement: 'end-turn',
      headlessAction: {
        type: 'end-turn',
        actorTokenId: 'hero-token',
        characterId: 'hero',
      },
    })
  })

  it('keeps existing rejection reasons for incomplete simple actions', () => {
    expect(buildSimpleHeadlessPlayerAction(baseInput(makeAction({ skillId: undefined })))).toEqual({
      ok: false,
      reason: 'invalid-skill',
    })
    expect(
      buildSimpleHeadlessPlayerAction(baseInput(makeAction({ type: 'calm-spirit', calmSpiritEffect: undefined }))),
    ).toEqual({ ok: false, reason: 'unsupported-action' })
    expect(
      buildSimpleHeadlessPlayerAction(
        baseInput(makeAction({ type: 'agile-leap-move', targetPosition: undefined })),
      ),
    ).toEqual({ ok: false, reason: 'invalid-agile-leap' })
  })

  it('validates qi cooldown requests against the actor skill list', () => {
    expect(buildSimpleHeadlessPlayerAction(baseInput(makeAction({ type: 'qi-reduce-cooldown' })))).toMatchObject({
      ok: true,
      headlessAction: { type: 'qi-reduce-cooldown', skillId: 'skill-1' },
    })
    expect(
      buildSimpleHeadlessPlayerAction({
        ...baseInput(makeAction({ type: 'qi-reduce-cooldown', skillId: 'missing' })),
        characters: [makeCharacter()],
      }),
    ).toEqual({ ok: false, reason: 'invalid-qi-reduce' })
  })

  it('builds generic class-resource cooldown actions', () => {
    const result = buildSimpleHeadlessPlayerAction(baseInput(makeAction({
      type: 'class-resource-action',
      classResource: { key: 'mana', amount: 2, operation: 'reduce-skill-cooldown' },
    })))
    expect(result).toMatchObject({
      ok: true,
      headlessAction: {
        type: 'class-resource-action',
        resourceKey: 'mana',
        amount: 2,
        operation: 'reduce-skill-cooldown',
      },
    })
    expect(buildSimpleHeadlessPlayerAction(baseInput(makeAction({
      type: 'class-resource-action',
      classResource: { key: 'mana', amount: 0, operation: 'reduce-skill-cooldown' },
    })))).toEqual({ ok: false, reason: 'invalid-class-resource-action' })
  })
})
