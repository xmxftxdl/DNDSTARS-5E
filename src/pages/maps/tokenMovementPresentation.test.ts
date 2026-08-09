import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eMapResultPlan } from '../../rulesets/dnd5e'
import { withTokenMovementPresentations } from './tokenMovementPresentation'

function token(id: string, x: number, y: number): Token {
  return { id, x, y, label: id } as Token
}

function plan(): Dnd5eMapResultPlan {
  return {
    map: { id: 'map', tokens: [token('hero', 50, 10), token('other', 5, 5)] } as BattleMap,
    characters: [],
    changedCharacterIds: [],
    changedTokenIds: ['hero'],
    tokenPatches: { hero: { x: 50, y: 10 } },
  }
}

describe('token movement presentation', () => {
  it('decorates the full Token and the authoritative entity patch', () => {
    const animation = {
      id: 'move:hero',
      points: [{ x: 10, y: 10 }, { x: 50, y: 10 }],
      durationMs: 500,
      issuedAt: 1_000,
    }
    const result = withTokenMovementPresentations({
      application: plan(),
      byTokenId: { hero: animation },
    })

    expect(result.map.tokens[0].movementAnimation).toEqual(animation)
    expect(result.tokenPatches?.hero).toEqual({
      x: 50,
      y: 10,
      movementAnimation: animation,
    })
    expect(result.map.tokens[1].movementAnimation).toBeUndefined()
  })

  it('can explicitly clear a previous animation without touching unrelated Tokens', () => {
    const source = plan()
    source.map.tokens[0] = {
      ...source.map.tokens[0],
      movementAnimation: {
        id: 'old',
        points: [{ x: 0, y: 0 }, { x: 50, y: 10 }],
        durationMs: 500,
        issuedAt: 1,
      },
    }
    const result = withTokenMovementPresentations({
      application: source,
      byTokenId: { hero: null, other: null },
    })

    expect(result.map.tokens[0].movementAnimation).toBeUndefined()
    expect(result.tokenPatches?.hero).toHaveProperty('movementAnimation', undefined)
    expect(result.tokenPatches?.other).toBeUndefined()
  })

  it('does not manufacture an animation-only patch when the plan commits full Tokens', () => {
    const source = plan()
    delete source.tokenPatches
    const animation = {
      id: 'move:hero',
      points: [{ x: 10, y: 10 }, { x: 50, y: 10 }],
      durationMs: 500,
      issuedAt: 1_000,
    }
    const result = withTokenMovementPresentations({
      application: source,
      byTokenId: { hero: animation },
    })

    expect(result.map.tokens[0].movementAnimation).toEqual(animation)
    expect(result.tokenPatches).toBeUndefined()
  })
})
