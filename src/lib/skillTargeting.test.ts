import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import { cellToPixel, tokenCenterForAnchorCell } from './gridCombat'
import { aoeOrientFromCell, tokensInCells } from './skillTargeting'

function map(tokens: Token[]): BattleMap {
  return {
    id: 'map',
    name: 'Map',
    width: 1000,
    height: 1000,
    gridSize: 100,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens,
  }
}

function enemyAt(id: string, col: number, row: number, patch: Partial<Token> = {}): Token {
  const m = map([])
  const pos = cellToPixel({ col, row }, m)
  return {
    id,
    label: id,
    x: pos.x,
    y: pos.y,
    color: '#fff',
    emoji: '',
    size: 1,
    type: 'enemy',
    ...patch,
  }
}

function enemyAtAnchor(id: string, col: number, row: number, patch: Partial<Token> = {}): Token {
  const m = map([])
  const base = enemyAt(id, 0, 0, patch)
  const pos = tokenCenterForAnchorCell({ col, row }, base, m)
  return { ...base, ...pos }
}

describe('AOE token coverage targeting', () => {
  it('hits a large token when any covered cell is inside the AOE cells', () => {
    const large = enemyAtAnchor('large', 4, 5, { creatureSize: '\u5927\u578b', size: 2 })
    const medium = enemyAt('medium', 9, 9)
    const m = map([large, medium])

    expect(tokensInCells(m, m.tokens, [{ col: 4, row: 5 }]).map((t) => t.id)).toEqual(['large'])
  })

  it('uses the requested arrow storm rotation when choosing the rect orientation cell', () => {
    const aoe = { shape: 'rect', origin: 'point', widthFeet: 10, heightFeet: 15, placeRangeFeet: 90 } as const
    const casterCell = { col: 5, row: 5 }
    const anchorCell = { col: 10, row: 10 }

    expect(aoeOrientFromCell(aoe, casterCell, anchorCell, { skillTreeId: 'arrowStorm', rectRotation: 0 })).toEqual({
      col: 10,
      row: 11,
    })
    expect(aoeOrientFromCell(aoe, casterCell, anchorCell, { skillTreeId: 'arrowStorm', rectRotation: 1 })).toEqual({
      col: 9,
      row: 10,
    })
    expect(aoeOrientFromCell(aoe, casterCell, anchorCell, { skillTreeId: 'multiShot', rectRotation: 1 })).toEqual(
      casterCell,
    )
  })
})
