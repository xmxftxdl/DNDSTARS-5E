import type { GridCell } from '../../lib/gridCombat'
import { cellToPixel } from '../../lib/gridCombat'
import type { Token, BattleMap } from '../../store/maps'
import { mapGeometryPointInPolygon, mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import type { Dnd5eGroveVolume, Dnd5eGroveDispelTarget } from './druidGroveVolume'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { dnd5eDispelMagicEffectsOnTarget } from './headlessCombatEngine'
import { prepareDnd5eSpellCast, resolvePreparedDnd5eSpellCast } from './spellAction'
import { removePersistentAreaByDm } from './persistentAreaRemoval'

export function dnd5eGroveDispelTargets(map: BattleMap, includeProjected = false): Dnd5eGroveDispelTarget[] {
  if (includeProjected && map.dnd5eGroveDispelTargets) return map.dnd5eGroveDispelTargets
  return (map.dnd5ePluginAreas ?? []).filter((a, i, all) => a.groveVolume && a.effectGroup &&
    all.findIndex(b => b.effectGroup?.castId === a.effectGroup?.castId && b.effectGroup?.effectId === a.effectGroup?.effectId &&
      b.sourceTokenId === a.sourceTokenId && b.pluginId === a.pluginId) === i)
    .map(a => ({ areaId: a.id, label: a.label, volume: a.groveVolume! }))
}
function contains(volume: Dnd5eGroveVolume, point: { x: number; y: number }, elevation: number) {
  return Number.isFinite(elevation) && point.x >= volume.minX && point.x < volume.minX + volume.widthPixels &&
    point.y >= volume.minY && point.y < volume.minY + volume.widthPixels && elevation >= volume.baseElevationFeet &&
    elevation < volume.baseElevationFeet + volume.heightFeet && !volume.excludedStructures.some(s =>
      elevation >= s.baseElevationFeet && elevation < s.baseElevationFeet + s.heightFeet && mapGeometryPointInPolygon(point, s.points))
}
export function dnd5eGroveDispelCells(map: BattleMap, volume: Dnd5eGroveVolume, elevation?: number): GridCell[] {
  const out: GridCell[] = []
  const minCol = Math.floor((volume.minX - map.gridOffsetX) / map.gridSize)
  const minRow = Math.floor((volume.minY - map.gridOffsetY) / map.gridSize)
  const count = Math.ceil(volume.widthPixels / map.gridSize)
  if (!Number.isFinite(count) || count > 100 || count < 1) return out
  for (let row = minRow; row < minRow + count; row++) for (let col = minCol; col < minCol + count; col++) {
    const cell = { col, row }, point = cellToPixel(cell, map)
    if (contains(volume, point, elevation ?? mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(map.id), point))) out.push(cell)
  }
  return out
}

/** Host adapter for a chosen magical subeffect. The transient target is never
 * published to the map; ordinary spell casting owns range, components, action,
 * slot spending and the actual Dispel Magic ability check.
 */
export function prepareDnd5eGroveDispel(input: Parameters<typeof prepareDnd5eSpellCast>[0] & {
  areaId: string; targetCell: GridCell;
}) {
  const area = input.map.dnd5ePluginAreas?.find(a => a.id === input.areaId)
  const payload = input.action.dnd5eSpellCast
  if (!area?.effectGroup || !['solid-fog', 'undergrowth', 'guardians', 'additional-gusts', 'additional-spike-growth', 'additional-wind-walls'].includes(area.effectGroup.effectId) ||
    payload?.spellId !== 'dispel-magic' || !input.targetCell || !Number.isSafeInteger(input.targetCell.col) || !Number.isSafeInteger(input.targetCell.row) ||
    !Number.isInteger(area.slotLevel) || area.slotLevel! < 6 || area.slotLevel! > 9 ||
    (!area.permanent && (input.worldMinute == null || area.expiresAtWorldMinute == null || input.worldMinute >= area.expiresAtWorldMinute))) {
    return { ok: false as const, reason: 'invalid-grove-dispel-target' }
  }
  const point = cellToPixel(input.targetCell, input.map)
  const elevation = input.action.targetElevationFeet ?? payload.targetElevationFeet ?? mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(input.map.id), point)
  if (area.groveVolume ? !contains(area.groveVolume, point, elevation)
    : !area.cells.some(c => c.col === input.targetCell.col && c.row === input.targetCell.row)) return { ok: false as const, reason: 'invalid-grove-dispel-target' }
  const proxyId = `grove-dispel:${input.action.id}`
  if (input.map.tokens.some(t => t.id === proxyId)) return { ok: false as const, reason: 'invalid-grove-dispel-target' }
  const effect = createDnd5eMechanicalEffect({ id: proxyId, definitionId: proxyId, label: area.label, targetId: proxyId,
    source: { kind: 'spell', rulesId: area.featureId, actorId: area.sourceTokenId, spellLevel: area.slotLevel },
    duration: { type: 'permanent' }, modifiers: {} })
  const proxy: Token = { id: proxyId, label: area.label, type: 'enemy', ...point, size: 1, color: '', emoji: '', hp: 1, maxHp: 1,
    elevationFeet: elevation, dnd5eCombatState: { activeEffects: [effect] } }
  const prepared = prepareDnd5eSpellCast({ ...input,
    dispelEffectTargetId: proxyId,
    map: { ...input.map, tokens: [...input.map.tokens, proxy] },
    initiativeOrder: [...input.initiativeOrder, { tokenId: proxyId, label: proxy.label, color: '', emoji: '', roll: -100 }],
    action: { ...input.action, targetTokenId: proxyId, targetTokenIds: [proxyId],
      dnd5eSpellCast: { ...payload, targetTokenId: proxyId, targetTokenIds: [proxyId] } },
  })
  if (!prepared.ok) return prepared
  const effects = dnd5eDispelMagicEffectsOnTarget(prepared.prepared.state, proxyId)
  if (effects.length !== 1 || effects[0].spellLevel !== area.slotLevel) return { ok: false as const, reason: 'grove-dispel-definition-unavailable' }
  return { ok: true as const, prepared: prepared.prepared, areaId: area.id, proxyId, effectId: effects[0].effectId }
}

export function resolvePreparedDnd5eGroveDispel(input: {
  preparation: Extract<ReturnType<typeof prepareDnd5eGroveDispel>, { ok: true }>;
  rolls: Omit<Parameters<typeof resolvePreparedDnd5eSpellCast>[0], 'prepared'>;
}) {
  const { preparation } = input
  const resolved = resolvePreparedDnd5eSpellCast({ ...input.rolls, prepared: preparation.prepared })
  if (!resolved.result.ok || !resolved.application) return resolved
  const application = resolved.application
  application.map = { ...application.map, tokens: application.map.tokens.filter(t => t.id !== preparation.proxyId) }
  application.changedTokenIds = application.changedTokenIds.filter(id => id !== preparation.proxyId)
  const success = resolved.result.events.some(event => event.type === 'spell-dispelled' &&
    event.targetId === preparation.proxyId && event.effectId === preparation.effectId && event.success)
  if (success) {
    const removed = removePersistentAreaByDm({ map: application.map, characters: application.characters, areaId: preparation.areaId })
    if (removed) {
      application.map = removed.map
      application.characters = removed.characters ? [...removed.characters] : application.characters
      application.changedTokenIds = [...new Set([...application.changedTokenIds, ...removed.map.tokens.map(t => t.id)])]
      application.changedCharacterIds = [...new Set([...application.changedCharacterIds, ...application.characters.map(c => c.id)])]
      resolved.result.events = [...resolved.result.events, ...(removed.events ?? [])]
    }
  }
  delete resolved.result.state.combatants[preparation.proxyId]
  resolved.result.state.initiativeOrder = resolved.result.state.initiativeOrder.filter(id => id !== preparation.proxyId)
  return resolved
}
