import {expect, it} from 'vitest'
import {normalizeMagicDetectionBarrier} from './magicDetectionBarrier'
import {createEmptyMapGeometry, MAP_GEOMETRY_SCHEMA_VERSION, normalizeMapGeometryEntity, normalizeSharedMapGeometry} from './mapGeometry'

it('rejects malformed physical data instead of silently dropping a blocking layer', () => {
  for (const raw of [null, [], {}, {material: 'stone', thicknessFeet: -1, leadLined: false},
    {material: 'stone', thicknessFeet: Infinity, leadLined: false},
    {material: 'stone', thicknessFeet: 1, leadLined: 'true'}]) expect(normalizeMagicDetectionBarrier(raw)).toBeUndefined()
})

it('preserves explicitly authored layers through geometry normalization', () => {
  const wall = {id: 'wall', kind: 'wall', label: '', points: [{x: 0, y: 0}, {x: 10, y: 10}],
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    magicDetectionBarrier: {material: 'wood-earth', thicknessFeet: 0.5, leadLined: true}}
  expect(normalizeMapGeometryEntity(wall)).toMatchObject({magicDetectionBarrier: wall.magicDetectionBarrier})
  expect(normalizeMapGeometryEntity({...wall, magicDetectionBarrier: { ...wall.magicDetectionBarrier, thicknessFeet: -1}})).toBeUndefined()
  const geometry = createEmptyMapGeometry('map', 1)
  const normalized = normalizeMapGeometryEntity(wall)
  if (!normalized || normalized.kind !== 'wall') throw Error('wall normalization failed')
  geometry.walls.push(normalized)
  const serialized = JSON.parse(JSON.stringify({schemaVersion: MAP_GEOMETRY_SCHEMA_VERSION, maps: [geometry], updatedAt: 1}))
  expect(normalizeSharedMapGeometry(serialized)?.maps[0].walls[0].magicDetectionBarrier).toEqual(wall.magicDetectionBarrier)
})
