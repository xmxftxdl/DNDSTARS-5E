import { describe, expect, it } from 'vitest'
import { createEmptyMapFog, fogCoversPoint } from '../../lib/fogOfWar'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { settleSunburstSpellDarknessDispels } from './sunburstDarknessDispel'

const darkness = (id: string, col: number, base: number): Dnd5ePluginArea => ({
  id, pluginId: 'srd', featureId: 'darkness', sourceKind: 'core-spell', coreSpellId: 'darkness',
  label: id, color: '#000', sourceTokenId: id, sourceCharacterId: id, createdRound: 1, expiresAfterRound: 101,
  cells: [{ col, row: 1 }], vertical: { mode: 'volume', baseElevationFeet: base, heightFeet: 30 },
  lighting: { kind: 'magical-darkness', radiusFeet: 15, spellLevel: 2 },
})
const map: BattleMap = {
  id: 'sunburst-obstruction', name: 'map', width: 2000, height: 1000, gridSize: 50,
  gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [],
}
describe('Sunburst darkness geometry', () => {
  it('clears unsnapped fog edges and thin remnants between cell centers', () => {
    const geometry = createEmptyMapGeometry(map.id)
    geometry.darknessFog = { ...createEmptyMapFog(map.id), shapes: [
      { id: 'painted', kind: 'rect', operation: 'cover', createdAt: 1,
        x: 131.3, y: 112.7, width: 101.2, height: 87.6 },
      { id: 'old-grid-reveal', kind: 'rect', operation: 'reveal', createdAt: 2,
        x: 150, y: 150, width: 100, height: 50 },
    ] }
    const result = settleSunburstSpellDarknessDispels({ map, geometry, characters: [],
      anchorCell: { col: 1, row: 1 }, radiusFeet: 60 })
    for (const [x, y] of [[132, 114], [231, 114], [132, 199], [231, 199], [180, 113]]) {
      expect(fogCoversPoint(result.geometry!.darknessFog!, x, y)).toBe(false)
    }
    expect(result.geometry!.darknessFog!.shapes.at(-1)?.kind).toBe('polygon')
  })

  it('clears painted magical darkness within reach while preserving walls and distant darkness', () => {
    const geometry = createEmptyMapGeometry(map.id)
    geometry.darknessFog = { ...createEmptyMapFog(map.id), filled: true }
    geometry.walls.push({ id: 'wall', kind: 'wall', label: 'wall',
      points: [{ x: 100, y: 0 }, { x: 100, y: 1000 }], baseHeightFeet: 0, heightFeet: 200,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, createdAt: 0 })
    const input = { map, characters: [], anchorCell: { col: 0, row: 1 }, radiusFeet: 60, geometry }
    const result = settleSunburstSpellDarknessDispels(input)
    const fog = result.geometry!.darknessFog!
    expect(fogCoversPoint(fog, 75, 75)).toBe(false)
    expect(fogCoversPoint(fog, 175, 75)).toBe(true)
    expect(fogCoversPoint(fog, 1075, 75)).toBe(true)
    expect(geometry.darknessFog.shapes).toHaveLength(0)
    const opened = { ...geometry, walls: [] }
    const afterOpening = settleSunburstSpellDarknessDispels({ ...input, geometry: opened })
    expect(fogCoversPoint(afterOpening.geometry!.darknessFog!, 175, 75)).toBe(false)
    const repeated = settleSunburstSpellDarknessDispels({ ...input, geometry: result.geometry })
    expect(repeated.geometry).toBeUndefined()
  })

  it('excludes darkness behind a closed door, above the burst, and outside its radius', () => {
    const geometry = createEmptyMapGeometry(map.id)
    geometry.doors.push({ id: 'door', kind: 'door', label: 'door', points: [{ x: 100, y: 0 }, { x: 100, y: 1000 }],
      state: 'closed', openState: 'closed', secret: false, baseHeightFeet: 0, heightFeet: 200,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, createdAt: 0 })
    const currentMap = { ...map, dnd5ePluginAreas: [darkness('near', 1, 0), darkness('behind', 3, 0), darkness('high', 1, 100), darkness('far', 20, 0)] }
    const input = { map: currentMap, characters: [], anchorCell: { col: 0, row: 1 }, radiusFeet: 60, geometry }
    expect(settleSunburstSpellDarknessDispels(input).removedAreaIds).toEqual(['near'])
    geometry.doors[0].state = 'open'
    geometry.doors[0].openState = 'open'
    expect(settleSunburstSpellDarknessDispels(input).removedAreaIds).toEqual(['near', 'behind'])
    expect(settleSunburstSpellDarknessDispels({ ...input, elevationFeet: 110 }).removedAreaIds).toEqual(['high'])
  })
  it('disperses an entire darkness spell when only part overlaps and preserves scene darkness', () => {
    const overlapping = { ...darkness('overlap', 20, 0), cells: [{ col: 20, row: 1 }, { col: 1, row: 1 }] }
    const scene = { ...darkness('scene', 1, 0), sourceKind: 'plugin-feature' as const }
    const result = settleSunburstSpellDarknessDispels({ map: { ...map, dnd5ePluginAreas: [overlapping, scene] }, characters: [], anchorCell: { col: 0, row: 1 }, radiusFeet: 60 })
    expect(result.removedAreaIds).toEqual(['overlap'])
    expect(result.map.dnd5ePluginAreas).toEqual([scene])
  })
})
