import { expect, it } from 'vitest'
import { normalizeDnd5eGroveVolume } from './druidGroveVolume'
import { dnd5eGroveDispelCells, dnd5eGroveDispelTargets } from './druidGroveDispel'
import { migrateMapsState, type BattleMap } from '../../store/maps'
import { projectMapsForPlayer } from '../../../scripts/shared-server-core.mjs'

it('keeps full protected volume across projection/reload without exposing guardian controls', () => {
  const volume = { minX: 0, minY: 0, widthPixels: 300, baseElevationFeet: 0, heightFeet: 30,
    excludedStructures: [{ points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }], baseElevationFeet: 0, heightFeet: 10 }] }
  const map: BattleMap = { id: 'grove-volume', name: 'Grove', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [],
    dnd5ePluginAreas: [{ id: 'guard', pluginId: 'test', featureId: 'grove', label: '林地守卫', color: '', sourceCharacterId: 'owner', sourceTokenId: 'source',
      createdRound: 1, expiresAfterRound: 14400, cells: [{ col: 3, row: 3 }], hiddenFromPlayers: true,
      effectGroup: { castId: 'cast', effectId: 'guardians' }, groveVolume: volume, grantedActivities: [{ activityId: 'command', label: 'Command' }] }] }
  expect(dnd5eGroveDispelTargets({ ...map, dnd5eGroveDispelTargets: [] })).toEqual([{ areaId: 'guard', label: '林地守卫', volume }])
  expect(dnd5eGroveDispelTargets({ ...map, dnd5ePluginAreas: [], dnd5eGroveDispelTargets: [{ areaId: 'expired', label: 'Expired', volume }] })).toEqual([])
  const projected = projectMapsForPlayer({ maps: [map] }, { maps: [] }, null)
  const restored = migrateMapsState(JSON.parse(JSON.stringify(projected))).maps[0]
  expect(restored.dnd5ePluginAreas).toEqual([])
  expect(JSON.stringify(restored)).not.toContain('grantedActivities')
  expect(dnd5eGroveDispelTargets(restored, true)).toEqual([{ areaId: 'guard', label: '林地守卫', volume }])
  expect(dnd5eGroveDispelCells(restored, volume, 0)).toHaveLength(35)
  expect(dnd5eGroveDispelCells(restored, volume, 0)).not.toContainEqual({ col: 0, row: 0 })
  expect(dnd5eGroveDispelCells(restored, volume, 10)).toHaveLength(36)
  expect(dnd5eGroveDispelCells(restored, volume, 30)).toEqual([])
  expect(dnd5eGroveDispelCells(restored, volume, -1)).toEqual([])
  expect(projectMapsForPlayer({ maps: [{ ...map, dnd5ePluginAreas: [], dnd5eGroveDispelTargets: restored.dnd5eGroveDispelTargets }] }, { maps: [] }, null).maps[0].dnd5eGroveDispelTargets).toEqual([])
})

it('rejects malformed saved Grove volumes and strips non-volume data', () => {
  expect(normalizeDnd5eGroveVolume(null)).toBeUndefined()
  expect(normalizeDnd5eGroveVolume({ minX: 0, minY: 0, widthPixels: 300, baseElevationFeet: 0, heightFeet: 30, excludedStructures: [null] })).toBeUndefined()
  const volume = { minX: 0, minY: 0, widthPixels: 300, baseElevationFeet: 0, heightFeet: 30, excludedStructures: [] }
  expect(normalizeDnd5eGroveVolume({ ...volume, password: 'private' })).toEqual(volume)
  expect(normalizeDnd5eGroveVolume({ ...volume, widthPixels: NaN })).toBeUndefined()
})
