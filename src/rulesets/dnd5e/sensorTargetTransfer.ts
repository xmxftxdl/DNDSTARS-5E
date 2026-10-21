import type { BattleMap, Token } from '../../store/maps'
import { mapCellExtent, tokenAnchorCellFromPixel } from '../../lib/gridCombat'
import { reconcileDnd5ePersistentAreaAnchors } from './coreSpellAreas'
import { dnd5eMapPlaneRelation } from './mapPlane'

/** Apply after the creature's atomic room-map transfer, before per-map cleanup.
 * Only bound sensors migrate; no source creature, concentration or clock is copied. */
export function transferDnd5eFollowingSensors(
  maps: readonly BattleMap[], fromMapId: string, toMapId: string, moved: Token,
): BattleMap[] {
  const destination = maps.find(map => map.id === toMapId)
  if (!destination) return [...maps]
  if (fromMapId === toMapId) {
    const affected = (destination.dnd5ePluginAreas ?? []).filter(area => area.sensorTarget &&
      (area.sensorTarget.characterId ? area.sensorTarget.characterId === moved.characterId : area.sensorTarget.tokenId === moved.id))
    if (!affected.length) return [...maps]
    const projected = reconcileDnd5ePersistentAreaAnchors({ ...destination, dnd5ePluginAreas: affected })
    const ids = new Set(affected.map(area => area.id))
    const next = { ...destination, tokens: projected.tokens,
      dnd5ePluginAreas: [...(destination.dnd5ePluginAreas ?? []).filter(area => !ids.has(area.id)), ...(projected.dnd5ePluginAreas ?? [])] }
    return maps.map(map => map.id === destination.id ? next : map)
  }
  let next = [...maps]
  for (const original of maps) {
    if (original.id === toMapId) continue
    for (const area of original.dnd5ePluginAreas ?? []) {
      const binding = area.sensorTarget
      if (!binding || !(binding.characterId ? binding.characterId === moved.characterId : binding.tokenId === moved.id)) continue
      const source = next.find(map => map.id === original.id)!
      const targetMap = next.find(map => map.id === toMapId)!
      const entity = source.tokens.find(token => token.id === area.anchorTokenId && token.type === 'obstacle' &&
        token.dnd5eSpellEffect?.sourceTokenId === area.sourceTokenId &&
        token.dnd5eSpellEffect.sourceCharacterId === area.sourceCharacterId)
      const targets = next.flatMap(map => map.tokens.filter(token => token.type !== 'obstacle' &&
        (binding.characterId ? token.characterId === binding.characterId : token.id === binding.tokenId)).map(token => ({ map, token })))
      // Remove only this area's owned entity, never a colliding ordinary Token.
      const stripped = { ...source, dnd5ePluginAreas: source.dnd5ePluginAreas?.filter(candidate => candidate.id !== area.id),
        tokens: source.tokens.filter(token => !entity || token.id !== entity.id) }
      next = next.map(map => map.id === source.id ? stripped : map)
      if (!entity || targets.length !== 1 || targets[0].map.id !== toMapId ||
        dnd5eMapPlaneRelation(source, targetMap) !== 'same' ||
        targetMap.tokens.some(token => token.id === entity.id) ||
        targetMap.dnd5ePluginAreas?.some(candidate => candidate.id === area.id)) continue
      const target = targets[0].token
      const anchor = tokenAnchorCellFromPixel(target.x, target.y, entity, targetMap)
      const oldAnchor = area.anchorCell ?? tokenAnchorCellFromPixel(entity.x, entity.y, entity, source)
      const ratio = (source.feetPerCell ?? 5) / (targetMap.feetPerCell ?? 5)
      if (!Number.isFinite(ratio) || ratio <= 0) continue
      const extent = mapCellExtent(targetMap)
      const cells = new Map<string, { col: number; row: number }>()
      for (const cell of area.cells) {
        for (let row = Math.max(-anchor.row, Math.floor((cell.row - oldAnchor.row) * ratio)); row < Math.min(extent.rows - anchor.row, Math.ceil((cell.row - oldAnchor.row + 1) * ratio)); row++) {
          for (let col = Math.max(-anchor.col, Math.floor((cell.col - oldAnchor.col) * ratio)); col < Math.min(extent.cols - anchor.col, Math.ceil((cell.col - oldAnchor.col + 1) * ratio)); col++) {
            const point = { col: anchor.col + col, row: anchor.row + row }
            if (point.col >= 0 && point.row >= 0 && point.col < extent.cols && point.row < extent.rows) {
              cells.set(`${point.col}:${point.row}`, point)
            }
          }
        }
      }
      if (!cells.size) continue
      const transferred = { ...area, sensorTarget: { ...binding, tokenId: target.id }, anchorCell: anchor,
        anchorTokenOffsetCells: undefined, cells: [...cells.values()] }
      const projected = reconcileDnd5ePersistentAreaAnchors({ ...targetMap,
        tokens: [...targetMap.tokens, { ...entity, x: target.x, y: target.y, movementAnimation: undefined }],
        dnd5ePluginAreas: [transferred] })
      next = next.map(map => map.id === toMapId ? { ...map, tokens: projected.tokens,
        dnd5ePluginAreas: [...(map.dnd5ePluginAreas ?? []), ...(projected.dnd5ePluginAreas ?? [])] } : map)
    }
  }
  return next
}
