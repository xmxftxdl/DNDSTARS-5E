import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { captureActivityPlacementAuthority } from './activityPlacementAuthority'
import { attackTeleportGeometryAuthority } from './attackTeleportAuthority'

it('accepts a redundant geometry save while still rejecting rule-relevant changes', () => {
  const geometry = createEmptyMapGeometry('map', 1)
  const scene = (value: typeof geometry | undefined) => ({
    map: { id: 'map' }, characters: [], worldMinute: 100,
    geometry: { geometry: attackTeleportGeometryAuthority(value), round: 1 },
  })
  const unchanged = captureActivityPlacementAuthority(scene(geometry))
  expect(unchanged(scene({ ...geometry, updatedAt: 2 }))).toBe(true)
  expect(unchanged(scene({ ...geometry, vision: { ...geometry.vision, ambientLight: 'darkness' } }))).toBe(false)
  expect(unchanged(scene({ ...geometry, structureLifetimes: [{
    id: 'ward', casterId: 'source', entityIds: ['wall'], createdWorldMinute: 0, expiresWorldMinute: 101,
  }] }))).toBe(false)
  expect(unchanged(scene(undefined))).toBe(false)
  expect(unchanged({ ...scene(geometry), worldMinute: 101 })).toBe(false)
  expect(geometry.updatedAt).toBe(1)
})
