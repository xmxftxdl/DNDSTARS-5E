import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import { cellToPixel, tokenCenterForAnchorCell } from './gridCombat'
import { aoeOrientFromCell, canPlaceAoe, cellsForAoe, resolveAoeDimensions, tokensInAoe, tokensInCells } from './skillTargeting'

it('preserves an authored one-foot line without allowing a forged width', () => {
  const line = { shape: 'line' as const, origin: 'self' as const, lengthFeet: 30, widthFeet: 1 }
  expect(resolveAoeDimensions(line, { widthFeet: 1, lengthFeet: 30 })).toEqual(line)
  for (const widthFeet of [0, 0.5, 2, 5, NaN, Infinity]) {
    expect(resolveAoeDimensions(line, { widthFeet })).toBeNull()
  }
})

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
  it('only permits a self-origin circle to use the caster cell as its center', () => {
    const caster = { col: 4, row: 7 }
    const selfCircle = { shape: 'circle', origin: 'self', radiusFeet: 10 } as const

    expect(canPlaceAoe(selfCircle, caster, caster)).toBe(true)
    expect(canPlaceAoe(selfCircle, caster, { col: 5, row: 7 })).toBe(false)
  })

  it('hits a large token when any covered cell is inside the AOE cells', () => {
    const large = enemyAtAnchor('large', 4, 5, { creatureSize: '\u5927\u578b', size: 2 })
    const medium = enemyAt('medium', 9, 9)
    const m = map([large, medium])

    expect(tokensInCells(m, m.tokens, [{ col: 4, row: 5 }]).map((t) => t.id)).toEqual(['large'])
  })

  it('resolves a 500-foot circle directly against token footprints', () => {
    const near = enemyAtAnchor('near', 9, 9)
    const far = enemyAtAnchor('far', 105, 0)
    const m = map([near, far])

    expect(tokensInAoe(
      m,
      m.tokens,
      { shape: 'circle', origin: 'self', radiusFeet: 500 },
      { col: 0, row: 0 },
      { col: 0, row: 0 },
    ).map((token) => token.id)).toEqual(['near'])
  })

  it('keeps a five-foot-diameter portal inside its single anchor square', () => {
    const center = { col: 5, row: 5 }
    const adjacent = enemyAtAnchor('adjacent', 6, 5)
    const occupying = enemyAtAnchor('occupying', 5, 5)
    const m = map([adjacent, occupying])
    const portal = {
      shape: 'circle', origin: 'point', radiusFeet: 2.5, minimumRadiusFeet: 2.5,
      placeRangeFeet: 60,
    } as const

    expect(resolveAoeDimensions(portal, { radiusFeet: 2.5 })).toMatchObject({ radiusFeet: 2.5 })
    expect(cellsForAoe(portal, center, center)).toEqual([center])
    expect(tokensInAoe(m, m.tokens, portal, { col: 0, row: 0 }, center)
      .map((token) => token.id)).toEqual(['occupying'])
  })

  it('uses the requested arrow storm rotation when choosing the rect orientation cell', () => {
    const aoe = { shape: 'rect', origin: 'point', widthFeet: 10, heightFeet: 15, placeRangeFeet: 90 } as const
    const casterCell = { col: 5, row: 5 }
    const anchorCell = { col: 10, row: 10 }

    expect(aoeOrientFromCell({ ...aoe, rotatable: true }, casterCell, anchorCell, { rectRotation: 0 })).toEqual({
      col: 10,
      row: 11,
    })
    expect(aoeOrientFromCell({ ...aoe, rotatable: true }, casterCell, anchorCell, { rectRotation: 1 })).toEqual({
      col: 9,
      row: 10,
    })
    expect(aoeOrientFromCell(aoe, casterCell, anchorCell, { rectRotation: 1 })).toEqual(
      casterCell,
    )
  })

  it('maps a grid-aligned 15-foot cube to exactly nine whole cells', () => {
    const cells = cellsForAoe(
      {
        shape: 'rect', origin: 'point', widthFeet: 15, heightFeet: 15,
        placeRangeFeet: 60, gridAligned: true,
      },
      { col: 0, row: 0 },
      { col: 5, row: 5 },
    )
    expect(cells).toHaveLength(9)
    expect(new Set(cells.map((cell) => `${cell.col}:${cell.row}`))).toEqual(new Set([
      '4:4', '5:4', '6:4',
      '4:5', '5:5', '6:5',
      '4:6', '5:6', '6:6',
    ]))
  })

  it('maps a grid-aligned 20-foot cube to exactly sixteen whole cells', () => {
    const cells = cellsForAoe(
      {
        shape: 'rect', origin: 'point', widthFeet: 20, heightFeet: 20,
        placeRangeFeet: 60, gridAligned: true,
      },
      { col: 0, row: 0 },
      { col: 5, row: 5 },
    )
    expect(cells).toHaveLength(16)
    expect(Math.max(...cells.map((cell) => cell.col)) - Math.min(...cells.map((cell) => cell.col)) + 1).toBe(4)
    expect(Math.max(...cells.map((cell) => cell.row)) - Math.min(...cells.map((cell) => cell.row)) + 1).toBe(4)
  })

  it('excludes cells that only share an edge with a face-origin 15-foot cube', () => {
    const caster = { col: 5, row: 5 }
    const cells = cellsForAoe(
      { shape: 'line', origin: 'self', widthFeet: 15, lengthFeet: 15 },
      caster,
      { col: 8, row: 5 },
    )
    expect(cells).toHaveLength(9)
    expect(cells).not.toContainEqual(caster)
    expect(new Set(cells.map((cell) => `${cell.col}:${cell.row}`))).toEqual(new Set([
      '6:4', '6:5', '6:6',
      '7:4', '7:5', '7:6',
      '8:4', '8:5', '8:6',
    ]))
  })

  it('maps a cardinal 10-by-60-foot line to exactly two by twelve cells', () => {
    const caster = { col: 11, row: 9 }
    const cells = cellsForAoe(
      { shape: 'line', origin: 'self', widthFeet: 10, lengthFeet: 60 },
      caster,
      { col: 11, row: 11 },
    )

    expect(cells).toHaveLength(24)
    expect(cells).not.toContainEqual(caster)
    expect(new Set(cells.map((cell) => cell.col))).toEqual(new Set([10, 11]))
    expect(Math.min(...cells.map((cell) => cell.row))).toBe(10)
    expect(Math.max(...cells.map((cell) => cell.row))).toBe(21)
  })

  it('builds a directional 2014 cone instead of treating it as a circle', () => {
    const cells = cellsForAoe(
      { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
      { col: 5, row: 5 },
      { col: 8, row: 5 },
    )
    const keys = new Set(cells.map((cell) => `${cell.col},${cell.row}`))

    expect(keys.has('8,5')).toBe(true)
    expect(keys.has('7,4')).toBe(true)
    expect(keys.has('7,6')).toBe(true)
    expect(keys.has('5,8')).toBe(false)
  })

  it('keeps the square corners outside a circular fireball template', () => {
    const cells = cellsForAoe(
      { shape: 'circle', origin: 'point', radiusFeet: 20 },
      { col: 0, row: 0 },
      { col: 5, row: 5 },
    )
    const keys = new Set(cells.map((cell) => `${cell.col},${cell.row}`))

    expect(keys.has('1,1')).toBe(false)
    expect(keys.has('9,1')).toBe(false)
    expect(keys.has('1,9')).toBe(false)
    expect(keys.has('9,9')).toBe(false)
    expect(keys.has('5,1')).toBe(true)
    expect(keys.has('9,5')).toBe(true)
    expect(keys.has('5,9')).toBe(true)
    expect(keys.has('1,5')).toBe(true)
  })

  it('resolves adjustable dimensions only inside the declared five-foot bounds', () => {
    const template = { shape: 'rect', origin: 'point', widthFeet: 100, heightFeet: 5, minimumWidthFeet: 5, gridAligned: true } as const
    expect(resolveAoeDimensions(template, { widthFeet: 35 })).toMatchObject({ widthFeet: 35, heightFeet: 5 })
    expect(resolveAoeDimensions(template, { widthFeet: 105 })).toBeNull()
    expect(resolveAoeDimensions(template, { widthFeet: 33 })).toBeNull()
  })

  it('preserves exact non-grid rectangular dimensions and rejects out-of-range selections', () => {
    const template = { shape: 'rect', origin: 'point', widthFeet: 1, heightFeet: 20, minimumHeightFeet: 1 } as const
    expect(resolveAoeDimensions(template, { widthFeet: 1, heightFeet: 13 })).toMatchObject({ widthFeet: 1, heightFeet: 13 })
    for (const widthFeet of [0, 2, NaN, Infinity]) expect(resolveAoeDimensions(template, { widthFeet })).toBeNull()
    for (const heightFeet of [0, 21, NaN, Infinity]) expect(resolveAoeDimensions(template, { heightFeet })).toBeNull()
  })
})


describe('independent vertical area dimensions', () => {
  const area = { shape: 'rect', origin: 'point', widthFeet: 10, heightFeet: 30, volumeHeightFeet: 20, minimumVolumeHeightFeet: 5 } as const
  it('changes vertical extent without changing footprint', () => {
    const small = resolveAoeDimensions(area, { volumeHeightFeet: 5 })!
    expect(small).toMatchObject({ widthFeet: 10, heightFeet: 30, volumeHeightFeet: 5 })
    expect(cellsForAoe(small, { col: 0, row: 0 }, { col: 3, row: 3 })).toEqual(cellsForAoe(area, { col: 0, row: 0 }, { col: 3, row: 3 }))
  })
  it.each([0, 3, 25, NaN, Infinity])('rejects invalid height %s', (volumeHeightFeet) => {
    expect(resolveAoeDimensions(area, { volumeHeightFeet })).toBeNull()
  })
  it('rejects height selection for shapes with no vertical contract', () => {
    expect(resolveAoeDimensions({ shape: 'circle', origin: 'point', radiusFeet: 10 }, { volumeHeightFeet: 5 })).toBeNull()
  })
})

it('places a point-origin cone independently of the caster with bounded range and four directions', () => {
  const template = { shape: 'cone', origin: 'point', rotatable: true, lengthFeet: 60, placeRangeFeet: 60 } as const
  const anchor = { col: 12, row: 12 }
  for (const [rotation, point] of [[0, {col:12,row:8}], [1, {col:16,row:12}], [2, {col:12,row:16}], [3, {col:8,row:12}]] as const) {
    const cells = cellsForAoe(template, aoeOrientFromCell(template, { col: 0, row: 0 }, anchor, { rectRotation: rotation }), anchor)
    expect(cells).toContainEqual(point)
    expect(cells).not.toContainEqual({ col: 24 - point.col, row: 24 - point.row })
    expect(cells).toEqual(cellsForAoe(template, aoeOrientFromCell(template, { col: 30, row: 30 }, anchor, { rectRotation: rotation }), anchor))
  }
  expect(canPlaceAoe(template, { col:0,row:12 }, anchor)).toBe(true)
  expect(canPlaceAoe(template, { col:-1,row:12 }, anchor)).toBe(false)
})

it('accepts exact non-grid box heights while preserving grid constraints and bounds',()=>{
 const box:any={shape:'rect',origin:'point',widthFeet:5,heightFeet:5,volumeHeightFeet:5,gridAligned:false,minimumWidthFeet:0.001,minimumHeightFeet:0.001,minimumVolumeHeightFeet:0.001}
 expect(resolveAoeDimensions(box,{widthFeet:0.5,heightFeet:0.75,volumeHeightFeet:0.25})).toMatchObject({widthFeet:0.5,heightFeet:0.75,volumeHeightFeet:0.25})
 for(const volumeHeightFeet of [0,6,NaN,Infinity])expect(resolveAoeDimensions(box,{volumeHeightFeet})).toBeNull()
 expect(resolveAoeDimensions({...box,gridAligned:true},{volumeHeightFeet:0.25})).toBeNull()
})
