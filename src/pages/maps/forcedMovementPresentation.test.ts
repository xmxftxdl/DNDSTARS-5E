import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eMapResultPlan } from '../../rulesets/dnd5e'
import { withForcedMovementPresentation } from './forcedMovementPresentation'

function token(id: string, x: number, y: number): Token {
  return { id, x, y, label: id } as Token
}

function plan(tokens: Token[], changedTokenIds: string[]): Dnd5eMapResultPlan {
  return {
    map: { id: 'map', tokens } as BattleMap,
    characters: [],
    changedCharacterIds: [],
    changedTokenIds,
  }
}

describe('forced movement presentation', () => {
  it('publishes an authoritative interpolation path for a pushed monster', () => {
    const result = withForcedMovementPresentation({
      beforeMap: { id: 'map', tokens: [token('goblin', 10, 20)] } as BattleMap,
      application: plan([token('goblin', 60, 20)], ['goblin']),
      events: [{
        type: 'moved',
        actorId: 'goblin',
        from: { x: 10, y: 20 },
        to: { x: 60, y: 20 },
      }],
      transactionId: 'tx',
      issuedAt: 1_000,
    })

    expect(result.map.tokens[0]).toMatchObject({
      x: 60,
      y: 20,
      movementAnimation: {
        id: 'forced-move:tx:goblin',
        issuedAt: 1_000,
        points: [{ x: 10, y: 20 }, { x: 60, y: 20 }],
      },
    })
  })

  it('does not animate unrelated HP-only token updates', () => {
    const result = withForcedMovementPresentation({
      beforeMap: { id: 'map', tokens: [token('goblin', 10, 20)] } as BattleMap,
      application: plan([{ ...token('goblin', 10, 20), hp: 3 }], ['goblin']),
      events: [],
      transactionId: 'tx',
    })
    expect(result.map.tokens[0].movementAnimation).toBeUndefined()
  })
})
