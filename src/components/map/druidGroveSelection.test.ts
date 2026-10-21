import { expect, it } from 'vitest'
import { requestDnd5eGroveSelection } from './druidGroveSelection'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'

function fixture() {
  const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 1000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [{ id: 'caster', characterId: 'owner', type: 'player', label: 'Caster', x: 25, y: 25, size: 1, color: '', emoji: '' },
      { id: 'oak', type: 'obstacle', label: 'Oak', x: 175, y: 175, size: 1, color: '', emoji: '', dnd5eObjectState: { schemaVersion: 1, vegetation: 'living' } }] }
  const geometry = createEmptyMapGeometry(map.id, 1); geometry.environment = 'outdoors'
  const area = { anchorCell: { col: 0, row: 0 }, cells: Array.from({ length: 36 }, (_, i) => ({ col: i % 6, row: Math.floor(i / 6) })),
    targetIds: [], areaPlacementDistanceFeet: 0, areaPlacement: { x: 25, y: 25, elevationFeet: 0, widthFeet: 30, lengthFeet: 30, heightFeet: 30 } }
  return { map, geometry, area, actorId: 'caster', isCurrent: () => true }
}

it.each(['none', 'spike-growth', 'gusts', 'wind-walls'])('collects %s with map-picked fog and disjoint undergrowth', async mode => {
  const input = fixture(), calls: string[] = []
  const result = await requestDnd5eGroveSelection({ ...input,
    choose: async options => options.title?.includes('长度') ? '10' : options.title?.includes('形状') ? 'straight' : mode,
    chooseMany: async options => options.title?.includes('守卫') ? ['oak'] : ['caster'],
    chooseCells: async (label, allowed, count, minimum) => {
      calls.push(label)
      if (label.includes('重雾')) { expect(minimum).toBe(0); return [{ col: 0, row: 1 }] }
      if (label.includes('灌木')) { expect(allowed).not.toContainEqual({ col: 0, row: 1 }); return [{ col: 2, row: 0 }] }
      return allowed.slice(0, count)
    },
  })
  expect(result?.groveSelection).toMatchObject({ placement: { guardianTreeIds: ['oak'], fogCells: [{ col: 0, row: 1 }], undergrowthCells: [{ col: 2, row: 0 }] },
    exemptTokenIds: ['caster'], extra: { kind: mode } })
  expect(result?.groveQualifications).toEqual({ structureObstacleIds: [], treeTokenIds: ['oak'] })
  expect(input.map.tokens[1].type).toBe('obstacle')
  expect(calls.length).toBe(mode === 'none' ? 2 : mode === 'spike-growth' ? 3 : 4)
})

it('allows empty subareas and rejects cancellation or an authority change between prompts', async () => {
  const input = fixture()
  const callbacks = { choose: async () => 'none', chooseMany: async () => [], chooseCells: async () => [] }
  expect((await requestDnd5eGroveSelection({ ...input, ...callbacks }))?.groveSelection.placement.fogCells).toEqual([])
  expect(await requestDnd5eGroveSelection({ ...input, ...callbacks, chooseCells: async () => undefined })).toBeUndefined()
  let current = true, choices = 0
  expect(await requestDnd5eGroveSelection({ ...input, ...callbacks, isCurrent: () => current,
    chooseMany: async () => { choices++; current = false; return [] } })).toBeUndefined()
  expect(choices).toBe(1)
})

it('collects an optional password and rejects cancellation, oversize input and stale choices', async () => {
  const input = { ...fixture(), choose: async () => 'none', chooseMany: async () => [], chooseCells: async () => [] }
  expect((await requestDnd5eGroveSelection({ ...input, promptPassword: async () => 'Moon Rises' }))?.groveSelection.secretPhrase).toBe('Moon Rises')
  expect((await requestDnd5eGroveSelection({ ...input, promptPassword: async () => '' }))?.groveSelection.secretPhrase).toBeUndefined()
  expect(await requestDnd5eGroveSelection({ ...input, promptPassword: async () => null })).toBeUndefined()
  expect(await requestDnd5eGroveSelection({ ...input, promptPassword: async () => 'x'.repeat(121) })).toBeUndefined()
  let current = true
  expect(await requestDnd5eGroveSelection({ ...input, isCurrent: () => current, promptPassword: async () => { current = false; return 'Moon Rises' } })).toBeUndefined()
})

it('collects two ordered bent wall paths and rejects a disconnected selection', async () => {
 const input=fixture(), path=[{col:1,row:1},{col:2,row:1},{col:2,row:2}]
 const callbacks={choose:async(options:any)=>options.title.includes('形状')?'path':'wind-walls',
  chooseMany:async()=>[],chooseCells:async(label:string)=>label.includes('风墙')?path:[]}
 const result=await requestDnd5eGroveSelection({...input,...callbacks})
 expect(result?.groveSelection.extra).toEqual({kind:'wind-walls',walls:[{path},{path}]})
 expect(await requestDnd5eGroveSelection({...input,...callbacks,
  chooseCells:async(label)=>label.includes('风墙')?[{col:1,row:1},{col:4,row:4}]:[]})).toBeUndefined()
})
