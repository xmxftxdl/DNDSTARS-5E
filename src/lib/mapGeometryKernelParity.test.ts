import { describe, expect, it } from 'vitest'
import {
  compileGeometryCached,
  effectiveGeometrySegments,
  raycastGeometry,
  validateGeometryRelationships,
  validateGeometryStructure,
} from '../../shared/map-geometry-kernel.mjs'
import {
  createEmptyMapGeometry,
  mapGeometryLineOfSightBlocked,
  mapGeometrySegments,
  migrateMapGeometryV3,
  type MapGeometryState,
} from './mapGeometry'

function fixture(): MapGeometryState {
  const geometry = createEmptyMapGeometry('parity', 1)
  geometry.walls = [{
    id: 'wall',
    kind: 'wall',
    label: '墙',
    points: [{ x: 100, y: 0 }, { x: 100, y: 200 }],
    edgeIds: ['wall-edge'],
    material: 'stone',
    blocksVision: true,
    blocksMovement: true,
    blocksLineOfEffect: true,
    baseHeightFeet: 0,
    heightFeet: 10,
    createdAt: 1,
  }]
  geometry.doors = [{
    id: 'door',
    kind: 'door',
    label: '门',
    points: [{ x: 100, y: 80 }, { x: 100, y: 120 }],
    wallEdgeId: 'wall-edge',
    startT: 0.4,
    endT: 0.6,
    state: 'closed',
    openState: 'closed',
    lockState: 'unlocked',
    physicalState: 'intact',
    secret: false,
    blocksVision: true,
    blocksMovement: true,
    blocksLineOfEffect: true,
    baseHeightFeet: 0,
    heightFeet: 10,
    createdAt: 1,
  }]
  return geometry
}

describe('shared map geometry kernel parity', () => {
  it('feeds the client and server-facing kernel the same effective segments', () => {
    const geometry = fixture()
    expect(mapGeometrySegments(geometry)).toEqual(effectiveGeometrySegments(geometry))
  })

  it('returns the same line-of-sight result through the shared compiled index', () => {
    const geometry = fixture()
    const from = { x: 50, y: 100 }
    const to = { x: 150, y: 100 }
    const sharedBlocked = !!raycastGeometry({
      compiled: compileGeometryCached(geometry, { bucketSize: 64 }),
      from,
      to,
      purpose: 'vision',
      fromElevationFeet: 0,
      toElevationFeet: 0,
      fromEyeHeightFeet: 2.5,
      toEyeHeightFeet: 2.5,
      ignoreStart: true,
    })
    expect(sharedBlocked).toBe(mapGeometryLineOfSightBlocked({ geometry, from, to }))
    expect(sharedBlocked).toBe(true)

    geometry.doors[0].state = 'open'
    geometry.doors[0].openState = 'open'
    expect(!!raycastGeometry({
      compiled: compileGeometryCached(geometry, { bucketSize: 64 }),
      from,
      to,
      purpose: 'vision',
      fromElevationFeet: 0,
      toElevationFeet: 0,
      fromEyeHeightFeet: 2.5,
      toEyeHeightFeet: 2.5,
      ignoreStart: true,
    })).toBe(false)
  })

  it('rejects dangling and overlapping stable openings', () => {
    const geometry = fixture()
    geometry.doors.push({
      ...geometry.doors[0],
      id: 'overlap',
      points: [{ x: 100, y: 90 }, { x: 100, y: 130 }],
      startT: 0.45,
      endT: 0.65,
    })
    expect(validateGeometryRelationships(geometry)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'opening-overlap', entityId: 'overlap' }),
    ]))

    const migrated = migrateMapGeometryV3({
      ...fixture(),
      doors: [{ ...fixture().doors[0], wallEdgeId: undefined, startT: undefined, endT: undefined }],
    })
    expect(validateGeometryRelationships(migrated)).toEqual([])
    expect(migrated.doors[0]).toMatchObject({ wallEdgeId: 'wall-edge', startT: 0.4, endT: 0.6 })
  })

  it('invalidates compiled geometry when standalone opening coordinates or edge ids mutate', () => {
    const geometry = fixture()
    geometry.doors[0] = {
      ...geometry.doors[0],
      wallEdgeId: undefined,
      startT: undefined,
      endT: undefined,
      parentWallId: undefined,
      parentWallSegmentIndex: undefined,
      points: [{ x: 20, y: 80 }, { x: 20, y: 120 }],
    }
    expect(compileGeometryCached(geometry).segments.find((segment) => segment.entityId === 'door')?.a.x).toBe(20)
    geometry.doors[0].points = [{ x: 40, y: 80 }, { x: 40, y: 120 }]
    expect(compileGeometryCached(geometry).segments.find((segment) => segment.entityId === 'door')?.a.x).toBe(40)
  })

  it('rejects conflicting legacy/stable attachments and mismatched stored points', () => {
    const geometry = fixture()
    geometry.doors[0].parentWallId = 'other-wall'
    geometry.doors[0].parentWallSegmentIndex = 0
    geometry.doors[0].points = [{ x: 0, y: 0 }, { x: 0, y: 20 }]
    expect(validateGeometryRelationships(geometry)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'opening-attachment-conflict' }),
      expect.objectContaining({ code: 'opening-points-mismatch' }),
    ]))
  })

  it('rejects contradictory legacy and split door states in the shared structure validator', () => {
    const geometry = fixture()
    geometry.doors[0].state = 'open'
    geometry.doors[0].openState = 'closed'
    expect(validateGeometryStructure(geometry)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'door-state-conflict', entityId: 'door' }),
    ]))
  })
})
