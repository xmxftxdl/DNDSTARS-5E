import { expect, it, vi } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { settleStrongWindFlamesAlongMovement } from './strongWindFlameMovement'
import { collectStrongWindProtectedFlames, settleStrongWindProtectedFlame } from './strongWindFlames'

function fixture(): BattleMap {
  return { id: 'move-wind', name: 'map', width: 500, height: 500, gridSize: 50, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: 'lamp', label: 'Lamp', x: 25, y: 75, size: 1, type: 'player', color: '#ffffff', emoji: '',
      lightSource: { enabled: true, color: '#ffffff', sourceKind: 'hooded-lantern', brightRadiusFeet: 30, dimRadiusFeet: 30,
        startedAtWorldMinute: 1, durationMinutes: 360, expiresAtWorldMinute: 361 } }],
    dnd5ePluginAreas: [{ id: 'gust', pluginId: 'test.grove', featureId: 'test.grove:grove', label: 'Gust',
      color: '#ffffff', sourceTokenId: 'caster', sourceCharacterId: 'caster', strongWind: true,
      cells: [{ col: 1, row: 1 }, { col: 2, row: 1 }], createdRound: 1, expiresAfterRound: 14400 }],
  }
}
async function move(beforeMap: BattleMap, path: { x: number; y: number }[], values: number[] = [51], heights?: number[]) {
  const map = { ...beforeMap, tokens: beforeMap.tokens.map(t => ({ ...t, ...path[path.length - 1] })) }
  const roll = vi.fn(async () => values.shift()!)
  const result = await settleStrongWindFlamesAlongMovement({ beforeMap, map, tokenId: 'lamp', round: 1,
    transactionId: 'movement', path, pathElevationsFeet: heights, roll })
  return { ...result, roll }
}
it.each([50, 51])('checks a sparse path crossing wind and ending outside: d100=%i', async d100 => {
  const map = fixture(), result = await move(map, [{ x: 25, y: 75 }, { x: 225, y: 75 }], [d100])
  expect(result.roll).toHaveBeenCalledTimes(1)
  expect(!!result.map.tokens[0].lightSource).toBe(d100 > 50)
  expect(result.map.tokens[0]).toMatchObject({ x: 225, y: 75 })
  expect(map.tokens[0].lightSource).toBeDefined()
  expect(map.tokens[0].x).toBe(25)
})
it('does not reroll every wind cell; leaving and reentering is a new exposure', async () => {
  const result = await move(fixture(), [{ x: 25, y: 75 }, { x: 225, y: 75 }, { x: 25, y: 75 }], [51, 50])
  expect(result.roll).toHaveBeenCalledTimes(2)
  expect(result.map.tokens[0].lightSource).toBeUndefined()
})
it('retains the prior exposure when final-position reconciliation had cleared it', async () => {
  let map = fixture(); map.tokens[0].x = 75
  map = settleStrongWindProtectedFlame(map, { ...collectStrongWindProtectedFlames(map)[0],
    d100: 51, round: 1, transactionId: 'prior' })!
  const result = await move(map, [{ x: 75, y: 75 }, { x: 225, y: 75 }])
  expect(result.roll).not.toHaveBeenCalled()
  expect(result.map.tokens[0].lightSource).toBeDefined()
})
it('extinguishes exposed torches without a chance roll and respects immunity', async () => {
  const map = fixture(); map.tokens[0].lightSource!.sourceKind = 'torch'
  const path = [{ x: 25, y: 75 }, { x: 225, y: 75 }]
  const result = await move(map, path)
  expect(result.roll).not.toHaveBeenCalled()
  expect(result.map.tokens[0].lightSource).toBeUndefined()
  map.dnd5ePluginAreas![0].excludedTargetIds = ['lamp']
  expect((await move(map, path)).map.tokens[0].lightSource).toBeDefined()
})
it('does not invent exposure when the accepted movement stopped before wind', async () => {
  const result = await move(fixture(), [{ x: 25, y: 75 }, { x: 25, y: 75 }])
  expect(result.roll).not.toHaveBeenCalled()
})
it('rejects invalid chance values without mutating the movement input', async () => {
  const map = fixture(), before = JSON.stringify(map)
  await expect(move(map, [{ x: 25, y: 75 }, { x: 225, y: 75 }], [101])).rejects.toThrow('roll-invalid')
  expect(JSON.stringify(map)).toBe(before)
})

it('checks a vertical crossing inside one grid cell and ignores overflight', async () => {
  const map = fixture(); map.tokens[0].x = 75
  map.dnd5ePluginAreas![0].vertical = { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 }
  const crossing = await move(map, [{ x: 75, y: 75 }, { x: 75, y: 75 }], [50], [20, -20])
  expect(crossing.roll).toHaveBeenCalledTimes(1)
  expect(crossing.map.tokens[0].lightSource).toBeUndefined()
  const over = await move(map, [{ x: 25, y: 75 }, { x: 225, y: 75 }], [], [20, 20])
  expect(over.roll).not.toHaveBeenCalled()
})
