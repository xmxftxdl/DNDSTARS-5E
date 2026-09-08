import { describe, expect, it } from 'vitest'
import {
  dnd5eCreateOrDestroyWaterAreaCells,
  dnd5eCreateOrDestroyWaterCubeEdgeFeet,
  dnd5eCreateOrDestroyWaterFogAreaIds,
  dnd5eCreateOrDestroyWaterMaximumGallons,
  normalizeDnd5eCreateOrDestroyWaterDeclarationV1,
  normalizeDnd5eWaterContainerStateV1,
} from './createOrDestroyWater'

describe('Create or Destroy Water', () => {
  it('scales both gallons and cube edge from the selected slot', () => {
    expect([1, 2, 3, 9].map(dnd5eCreateOrDestroyWaterMaximumGallons)).toEqual([10, 20, 30, 90])
    expect([1, 2, 3, 9].map(dnd5eCreateOrDestroyWaterCubeEdgeFeet)).toEqual([30, 35, 40, 70])
    expect(dnd5eCreateOrDestroyWaterMaximumGallons(0)).toBe(0)
  })

  it('normalizes bounded container and area declarations', () => {
    expect(normalizeDnd5eCreateOrDestroyWaterDeclarationV1({
      schemaVersion: 1,
      mode: 'create-container',
      targetCell: { col: 3, row: 4 },
      targetObjectId: 'cistern-1',
      targetObjectName: '  敞口蓄水池  ',
      gallons: 30,
    })).toMatchObject({ targetObjectName: '敞口蓄水池', gallons: 30 })
    expect(normalizeDnd5eCreateOrDestroyWaterDeclarationV1({
      schemaVersion: 1,
      mode: 'create-rain',
      targetCell: { col: 3, row: 4 },
      areaEdgeFeet: 40,
    })).toMatchObject({ mode: 'create-rain', areaEdgeFeet: 40 })
    expect(normalizeDnd5eCreateOrDestroyWaterDeclarationV1({
      schemaVersion: 1,
      mode: 'destroy-fog',
      targetCell: { col: 3, row: 4 },
      areaEdgeFeet: 40,
      fogAreaIds: [],
    })).toBeUndefined()
  })

  it('normalizes only physically possible water-container snapshots', () => {
    expect(normalizeDnd5eWaterContainerStateV1({
      schemaVersion: 1, open: true, capacityGallons: 50, waterGallons: 20,
    })).toEqual({ schemaVersion: 1, open: true, capacityGallons: 50, waterGallons: 20 })
    expect(normalizeDnd5eWaterContainerStateV1({
      schemaVersion: 1, open: true, capacityGallons: 10, waterGallons: 11,
    })).toBeUndefined()
  })

  it('selects only overlapping core Fog Cloud areas', () => {
    const map = {
      feetPerCell: 5,
      dnd5ePluginAreas: [
        { id: 'fog-a', sourceKind: 'core-spell', coreSpellId: 'fog-cloud', cells: [{ col: 5, row: 5 }] },
        { id: 'cloudkill', sourceKind: 'core-spell', coreSpellId: 'cloudkill', cells: [{ col: 5, row: 5 }] },
        { id: 'fog-b', sourceKind: 'core-spell', coreSpellId: 'fog-cloud', cells: [{ col: 30, row: 30 }] },
      ],
    } as never
    expect(dnd5eCreateOrDestroyWaterAreaCells({ map, targetCell: { col: 4, row: 4 }, areaEdgeFeet: 30 }))
      .toHaveLength(36)
    expect(dnd5eCreateOrDestroyWaterFogAreaIds({ map, targetCell: { col: 4, row: 4 }, areaEdgeFeet: 30 }))
      .toEqual(['fog-a'])
  })
})
