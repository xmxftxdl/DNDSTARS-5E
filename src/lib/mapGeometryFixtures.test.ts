import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mapGeometryDoorLockState, mapGeometryDoorPhysicalState, normalizeSharedMapGeometry } from './mapGeometry'
import { importUvttGeometry } from './uvttImport'

const fixture = (name: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/map-geometry', name), 'utf8')) as unknown

describe('real map geometry fixture corpus', () => {
  it('imports cropped DD2VTT coordinates, object walls, portals, lights and image metadata', () => {
    const imported = importUvttGeometry(fixture('cropped.dd2vtt.json'), { mapId: 'cropped' })
    expect(imported.sourceWidth).toBe(512)
    expect(imported.sourceHeight).toBe(384)
    expect(imported.geometry.walls).toHaveLength(3)
    expect(imported.geometry.doors).toHaveLength(1)
    expect(imported.geometry.lights).toHaveLength(1)
    expect(imported.geometry.walls[0].points[0]).toEqual({ x: 0, y: 0 })
    expect(imported.embeddedImageDataUrl).toMatch(/^data:image\/png/)
  })

  it('normalizes jammed and destroyed Schema V3 door combinations', () => {
    const normalized = normalizeSharedMapGeometry(fixture('door-states-v3.json'))
    expect(normalized).toBeTruthy()
    expect(mapGeometryDoorLockState(normalized!.maps[0].doors[0])).toBe('jammed')
    expect(mapGeometryDoorPhysicalState(normalized!.maps[0].doors[1])).toBe('destroyed')
  })
})
