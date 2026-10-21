import { cellToPixel, type GridCell } from '../../lib/gridCombat'
import { mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import { cellsForAoe } from '../../lib/skillTargeting'
import { createDnd5eCoreSpellArea, getDnd5eCoreSpellAreaDeclaration } from './coreSpellAreas'
import { prepareDnd5eDruidGroveMapPlacement } from './druidGroveMapPlacement'
import { prepareDnd5eDruidGroveFog } from './druidGroveFog'

export type Dnd5eGroveWindWall = { center: GridCell; aim: GridCell; lengthFeet: number } | { path: GridCell[] }

export function normalizeDnd5eGroveWindWall(value: unknown): Dnd5eGroveWindWall | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const wall = value as Record<string, unknown>
  const cell = (v: unknown): v is GridCell => !!v && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).every(k => k === 'col' || k === 'row') &&
    Number.isSafeInteger((v as GridCell).col) && Number.isSafeInteger((v as GridCell).row)
  if (Object.keys(wall).every(k => k === 'path') && Array.isArray(wall.path) &&
    wall.path.length >= 1 && wall.path.length <= 10 && wall.path.every(cell)) {
    const path = wall.path as GridCell[], seen = new Set<string>()
    let length = 5
    for (let index = 0; index < path.length; index++) {
      const current = path[index], key = `${current.col},${current.row}`
      if (seen.has(key)) return
      seen.add(key)
      if (!index) continue
      const previous = path[index - 1], dx = Math.abs(current.col - previous.col), dy = Math.abs(current.row - previous.row)
      if (Math.max(dx, dy) !== 1) return
      length += Math.hypot(dx, dy) * 5
    }
    if (length > 50 + 1e-6) return
    return { path: path.map(c => ({ ...c })) }
  }
  if (Object.keys(wall).every(k => ['center', 'aim', 'lengthFeet'].includes(k)) && cell(wall.center) && cell(wall.aim) &&
    (wall.center.col !== wall.aim.col || wall.center.row !== wall.aim.row) &&
    typeof wall.lengthFeet === 'number' && Number.isFinite(wall.lengthFeet) && wall.lengthFeet > 0 && wall.lengthFeet <= 50) {
    return { center: { ...wall.center }, aim: { ...wall.aim }, lengthFeet: wall.lengthFeet }
  }
}

/** Both legacy straight templates and connected map-picked paths use the same wall settlement. */
export function prepareDnd5eDruidGroveWindWalls(input: Parameters<typeof prepareDnd5eDruidGroveFog>[0] & {
  walls: readonly Dnd5eGroveWindWall[]
}) {
  const validation = prepareDnd5eDruidGroveFog(input)
  if (!validation.ok) return validation
  const plan = prepareDnd5eDruidGroveMapPlacement(input)
  if (!plan.ok) return plan
  const key = (c: GridCell) => `${c.col},${c.row}`
  const ground = new Set(plan.protectedCells.map(key))
  const walls = input.walls.map(normalizeDnd5eGroveWindWall)
  if (walls.length !== 2 || walls.some(wall => !wall || ('path' in wall
    ? wall.path.some(cell => !ground.has(key(cell))) : !ground.has(key(wall.center))))) {
    return { ok: false as const, reason: 'invalid-wind-walls' }
  }
  const declaration = getDnd5eCoreSpellAreaDeclaration('wind-wall')!
  const { source } = input
  const areas = (walls as Dnd5eGroveWindWall[]).map((wall, index) => {
    const center = 'path' in wall ? wall.path[0] : wall.center
    const cells = 'path' in wall ? wall.path : cellsForAoe({ shape: 'rect', origin: 'point', widthFeet: wall.lengthFeet, heightFeet: 5 }, wall.aim, wall.center)
      .filter(cell => ground.has(key(cell)))
    const base = mapGeometryTerrainElevationAtPoint(input.geometry, cellToPixel(center, input.map))
    const area = createDnd5eCoreSpellArea({ declaration, actionId: `${source.castId}:grove-wind:${index}`,
      sourceCharacterId: source.characterId, sourceTokenId: source.tokenId, sourceSaveDc: source.saveDc,
      slotLevel: source.slotLevel, round: input.round, cells, anchorCell: center, baseElevationFeet: base,
      excludedTargetIds: input.exemptTokenIds })
    area.sourceKind = 'plugin-feature'
    area.coreSpellId = undefined
    area.pluginId = source.pluginId
    area.featureId = `${source.pluginId}:${source.spellId}`
    area.windBarrier = true
    area.effectGroup = { castId: source.castId, effectId: 'additional-wind-walls' }
    area.groveVolume = structuredClone(plan.volume)
    area.label = '德鲁伊林地 · 风墙'
    area.concentrationId = undefined
    area.createdWorldMinute = input.worldMinute
    area.expiresAtWorldMinute = input.worldMinute + 1_440
    area.expiresAfterRound = input.round + 14_400 - 1
    area.expiresAtSourceTurnEndAfterRound = undefined
    const columns = cells.map(cell => {
      const point = cellToPixel(cell, input.map)
      const groundElevation = mapGeometryTerrainElevationAtPoint(input.geometry, point)
      return { ...cell, baseElevationFeet: groundElevation,
        heightFeet: Math.min(15, plan.volume.baseElevationFeet + plan.volume.heightFeet - groundElevation) }
    })
    const minimumBase = Math.min(...columns.map(column => column.baseElevationFeet))
    const maximumTop = Math.max(...columns.map(column => column.baseElevationFeet + column.heightFeet))
    area.vertical = { mode: 'volume', baseElevationFeet: minimumBase, heightFeet: maximumTop - minimumBase,
      ...(columns.some(column => column.baseElevationFeet !== minimumBase || column.heightFeet !== maximumTop - minimumBase) ? { columns } : {}) }
    area.triggers = area.triggers?.map(trigger => ({ ...trigger, dmAdjustable: false,
      savingThrow: trigger.savingThrow ? { ...trigger.savingThrow, magical: true } : undefined,
      excludedTokenIds: [...new Set(input.exemptTokenIds ?? [])] }))
    return area
  })
  return { ok: true as const, areas }
}
