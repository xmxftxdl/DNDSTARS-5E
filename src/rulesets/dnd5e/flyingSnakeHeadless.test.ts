import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { findDnd5eOpportunityAttackersForMove } from './opportunityAttackAction'
import { getDnd5eSrdMonster } from './monsters'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 0,
    y: 0,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 10,
    maxHp: 10,
    ...patch,
  }
}

function opportunityMap(movingPoolId: string): BattleMap {
  return {
    id: 'map',
    name: 'Map',
    width: 100,
    height: 100,
    gridSize: 10,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens: [
      token({
        id: 'mover',
        label: 'Mover',
        poolId: movingPoolId,
        x: 5,
        y: 5,
      }),
      token({
        id: 'attacker',
        label: 'Goblin',
        poolId: 'srd-5.1:goblin',
        type: 'player',
        x: 15,
        y: 5,
      }),
    ],
  }
}

describe('Flying Snake Flyby Headless integration', () => {
  it('publishes Flyby as a structured Headless trait on every SRD creature that has it', () => {
    for (const slug of ['flying-snake', 'giant-owl', 'owl'] as const) {
      expect(getDnd5eSrdMonster(`srd-5.1:${slug}`)?.traits).toContainEqual(expect.objectContaining({
        automation: 'headless',
        rule: {
          kind: 'flyby',
          movementMode: 'fly',
          provokesOpportunityAttacks: false,
        },
      }))
    }

    expect(getDnd5eSrdMonster('srd-5.1:flying-snake')?.actions
      .find((action) => action.id === 'bite')?.automation).toBe('headless')
  })

  it('prevents opportunity attacks only while the Flying Snake is actually flying', () => {
    const map = opportunityMap('srd-5.1:flying-snake')
    const common = {
      map,
      characters: [],
      movingToken: map.tokens[0],
      to: { x: 35, y: 5 },
      turnEconomyByToken: {},
    }

    expect(findDnd5eOpportunityAttackersForMove({
      ...common,
      movementMode: 'walk',
    }).map((candidate) => candidate.id)).toEqual(['attacker'])

    expect(findDnd5eOpportunityAttackersForMove({
      ...common,
      movementMode: 'fly',
    })).toEqual([])
  })

  it('does not suppress flying opportunity attacks for creatures without Flyby', () => {
    const map = opportunityMap('srd-5.1:gargoyle')
    expect(findDnd5eOpportunityAttackersForMove({
      map,
      characters: [],
      movingToken: map.tokens[0],
      to: { x: 35, y: 5 },
      turnEconomyByToken: {},
      movementMode: 'fly',
    }).map((candidate) => candidate.id)).toEqual(['attacker'])
  })
})
