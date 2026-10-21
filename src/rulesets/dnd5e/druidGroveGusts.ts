import { cellToPixel, type GridCell } from '../../lib/gridCombat'
import { mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import { cellsForAoe } from '../../lib/skillTargeting'
import type { Dnd5ePluginArea } from '../../store/maps'
import { prepareDnd5eDruidGroveMapPlacement } from './druidGroveMapPlacement'
import { prepareDnd5eDruidGroveFog } from './druidGroveFog'

/** Host projection; casting, password and additional-effect selection are separate transactions. */
export function prepareDnd5eDruidGroveGusts(input: Parameters<typeof prepareDnd5eDruidGroveFog>[0] & {
  winds: readonly { origin: GridCell; aim: GridCell }[]
}) {
  const valid = prepareDnd5eDruidGroveFog(input)
  if (!valid.ok) return valid
  const plan = prepareDnd5eDruidGroveMapPlacement(input)
  if (!plan.ok) return plan
  const key = (c: GridCell) => `${c.col},${c.row}`
  const ground = new Set(plan.protectedCells.map(key))
  if (input.winds.length !== 2 || input.winds.some(wind =>
    ![wind.origin.col, wind.origin.row, wind.aim.col, wind.aim.row].every(Number.isSafeInteger) ||
    !ground.has(key(wind.origin)) || key(wind.origin) === key(wind.aim))) {
    return { ok: false as const, reason: 'invalid-gusts' }
  }
  const { source } = input
  const areas: Dnd5ePluginArea[] = input.winds.map((wind, index) => {
    const dc = wind.aim.col - wind.origin.col, dr = wind.aim.row - wind.origin.row, length = Math.hypot(dc, dr)
    const direction = { dc: dc / length, dr: dr / length }
    const base = mapGeometryTerrainElevationAtPoint(input.geometry, cellToPixel(wind.origin, input.map))
    return {
      id: `${source.castId}:grove-gust:${index}`, pluginId: source.pluginId, featureId: `${source.pluginId}:${source.spellId}`,
      sourceKind: 'plugin-feature', label: '德鲁伊林地 · 造风', color: '#bae6fd',
      sourceCharacterId: source.characterId, sourceTokenId: source.tokenId, sourceSpellSaveDc: source.saveDc, slotLevel: source.slotLevel,
      effectGroup: { castId: source.castId, effectId: 'additional-gusts' },
      cells: cellsForAoe({ shape: 'line', origin: 'self', lengthFeet: 60, widthFeet: 10 }, wind.origin, wind.aim).filter(c => ground.has(key(c))),
      anchorCell: { ...wind.origin }, anchorMode: 'fixed',
      createdRound: input.round, expiresAfterRound: input.round + 14_400 - 1,
      createdWorldMinute: input.worldMinute, expiresAtWorldMinute: input.worldMinute + 1_440,
      vertical: { mode: 'volume', baseElevationFeet: base, heightFeet: Math.min(10, plan.volume.baseElevationFeet + plan.volume.heightFeet - base) },
      directionalMovementCost: { direction, additionalFeetPerFoot: 1 }, strongWind: true,
      relation: 'any', includeSelf: true, excludedTargetIds: [...new Set(input.exemptTokenIds ?? [])],
      triggers: [{ id: 'grove-gust-start', label: '造风 · 回合开始', timing: 'turn-start', oncePerTurn: true,
        savingThrow: { ability: 'str', dc: source.saveDc, onSuccess: 'none', magical: true },
        forcedMovement: { mode: 'push-fixed-direction', direction, distanceFeet: 15, appliesOn: 'failed-save' },
        excludedTokenIds: [...new Set(input.exemptTokenIds ?? [])] }],
    }
  })
  return { ok: true as const, areas }
}
