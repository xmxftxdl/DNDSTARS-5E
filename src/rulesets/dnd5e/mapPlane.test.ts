import { expect, it } from 'vitest'
import { migrateMapsState } from '../../store/maps'
import { dnd5eMapPlaneRelation, normalizeDnd5eMapPlane, dnd5eMapEtherealAccess } from './mapPlane'

it('preserves explicit plane identity through scene save/reload without guessing for legacy maps', () => {
  const maps = migrateMapsState(JSON.parse(JSON.stringify({ maps: [
    { id: 'a', dnd5ePlane: ' 主物质位面 ' }, { id: 'b', dnd5ePlane: '主物质位面' },
    { id: 'c', dnd5ePlane: '幽影位面' }, { id: 'legacy' },
  ] }))).maps
  expect(maps[0].dnd5ePlane).toBe('主物质位面')
  expect(dnd5eMapPlaneRelation(maps[0], maps[1])).toBe('same')
  expect(dnd5eMapPlaneRelation(maps[0], maps[2])).toBe('different')
  expect(dnd5eMapPlaneRelation(maps[0], maps[3])).toBe('unknown')
  expect(dnd5eMapPlaneRelation(maps[3], maps[3])).toBe('same')
})

it('rejects malformed identities and preserves explicit custom demiplane distinctions', () => {
  for (const value of [null, {}, '', '   ', 'x'.repeat(121), 'plane\nother']) expect(normalizeDnd5eMapPlane(value)).toBeUndefined()
  expect(dnd5eMapPlaneRelation({ id: 'a', dnd5ePlane: '半位面·甲' }, { id: 'b', dnd5ePlane: '半位面·乙' })).toBe('different')
})

it('retains the DM scene plane in the player projection and subsequent reload', async () => {
  const { projectMapsForPlayer } = await import('../../../scripts/shared-server-core.mjs')
  const maps = migrateMapsState({ maps: [{ id: 'scene', dnd5ePlane: '主物质位面', tokens: [] }] }).maps
  const projected = projectMapsForPlayer({ maps, selectedId: 'scene' }, { maps: [] })
  expect(migrateMapsState(JSON.parse(JSON.stringify(projected))).maps[0].dnd5ePlane).toBe('主物质位面')
})

it('preserves explicit ethereal adjacency, does not guess custom planes, and cannot re-enter an ethereal scene', async () => {
  const { projectMapsForPlayer } = await import('../../../scripts/shared-server-core.mjs')
  const maps = migrateMapsState({ maps: [
    { id: 'material', dnd5ePlane: ' Material Plane ' },
    { id: 'custom', dnd5ePlane: 'Custom', dnd5eEtherealAdjacent: true },
    { id: 'separate', dnd5ePlane: 'material', dnd5eEtherealAdjacent: false },
    { id: 'ethereal', dnd5ePlane: '以太位面', dnd5eEtherealAdjacent: true },
    { id: 'unknown', dnd5ePlane: 'Custom' },
    { id: 'malformed', dnd5eEtherealAdjacent: 'true' },
  ] }).maps
  const restored = migrateMapsState(JSON.parse(JSON.stringify(projectMapsForPlayer({ maps }, { maps: [] })))).maps
  expect(restored.map(dnd5eMapEtherealAccess)).toEqual(['adjacent','adjacent','unavailable','unavailable','unknown','unknown'])
  expect(restored[1].dnd5eEtherealAdjacent).toBe(true)
  expect(restored[2].dnd5eEtherealAdjacent).toBe(false)
  expect(restored[5].dnd5eEtherealAdjacent).toBeUndefined()
})
