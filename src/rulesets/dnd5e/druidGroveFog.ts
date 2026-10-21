import { cellToPixel } from '../../lib/gridCombat'
import { mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import type { Dnd5ePluginArea } from '../../store/maps'
import { prepareDnd5eDruidGroveMapPlacement } from './druidGroveMapPlacement'

/** Projects only the solid-fog subeffect; it does not authorize or spend a cast. */
export function prepareDnd5eDruidGroveFog(input: Parameters<typeof prepareDnd5eDruidGroveMapPlacement>[0] & {
  source: { castId: string; pluginId: string; spellId: string; characterId: string; tokenId: string; slotLevel: number; saveDc: number }
  round: number
  worldMinute: number
  /** Cast-time friends or creatures whose spoken password the Host verified. */
  exemptTokenIds?: readonly string[]
}) {
  const plan = prepareDnd5eDruidGroveMapPlacement(input)
  if (!plan.ok) return plan
  const { source, round, worldMinute } = input
  const exemptTokenIds = [...new Set(input.exemptTokenIds ?? [])]
  if (exemptTokenIds.length > 512 || exemptTokenIds.some(id => !input.map.tokens.some(token =>
    token.id === id && token.type !== 'obstacle'))) return { ok: false as const, reason: 'invalid-exemptions' }
  if ([source.castId, source.pluginId, source.spellId, source.characterId, source.tokenId].some(id => !id.trim() || id.length > 160) ||
    !Number.isSafeInteger(round) || round < 1 || !Number.isSafeInteger(worldMinute) || worldMinute < 0 ||
    !Number.isInteger(source.slotLevel) || source.slotLevel < 6 || source.slotLevel > 9 ||
    !Number.isInteger(source.saveDc) || source.saveDc < 1 || source.saveDc > 40 ||
    !input.map.tokens.some(token => token.id === source.tokenId && token.characterId === source.characterId)) {
    return { ok: false as const, reason: 'invalid-source' }
  }
  const areas: Dnd5ePluginArea[] = plan.fogCells.map(cell => {
    const point = cellToPixel(cell, input.map), base = mapGeometryTerrainElevationAtPoint(input.geometry, point)
    const height = Math.min(10, plan.volume.baseElevationFeet + plan.volume.heightFeet - base)
    return {
      id: `${source.castId}:grove-fog:${cell.col}:${cell.row}`, pluginId: source.pluginId, featureId: `${source.pluginId}:${source.spellId}`,
      effectGroup: { castId: source.castId, effectId: 'solid-fog' },
      groveVolume: structuredClone(plan.volume),
      label: '德鲁伊林地 · 重雾', color: '#97b5a5', utilityProjectionId: 'druid-grove-solid-fog',
      sourceCharacterId: source.characterId, sourceTokenId: source.tokenId, sourceSpellSaveDc: source.saveDc, slotLevel: source.slotLevel,
      cells: [{ ...cell }], anchorCell: { ...cell }, anchorMode: 'fixed',
      createdRound: round, expiresAfterRound: round + 14_400 - 1,
      createdWorldMinute: worldMinute, expiresAtWorldMinute: worldMinute + 1_440,
      vertical: { mode: 'volume', baseElevationFeet: base, heightFeet: height },
      movementCostMultiplier: 3, obscuration: { kind: 'heavy' }, relation: 'any', includeSelf: true,
      excludedTargetIds: [...exemptTokenIds], obscurationExcludedTokenIds: [...exemptTokenIds],
    }
  })
  return { ok: true as const, areas }
}
