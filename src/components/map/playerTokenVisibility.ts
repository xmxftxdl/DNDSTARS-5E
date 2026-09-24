import { fogCoversPoint, type MapFogState } from '../../lib/fogOfWar'
import { mapGeometryCanSeeToken, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'

/** A visual mask cannot remove Konva hit targets; filter every token layer first. */
export function playerVisibleCanvasTokens(input: {
  map: BattleMap
  geometry?: MapGeometryState
  fog?: MapFogState
  visionSourceTokenIds: readonly string[]
  viewerCharacterId?: string
  worldMinute: number
}): Token[] {
  const viewers = input.map.tokens.filter(token => input.visionSourceTokenIds.includes(token.id))
  const hasSpellObstruction = input.map.dnd5ePluginAreas?.some(area =>
    area.obscuration?.kind === 'heavy' || area.blocking?.vision || area.lighting?.kind === 'magical-darkness')
  return input.map.tokens.filter(target => {
    if (target.visibilityMode === 'dm-only') return false
    if (target.characterId && target.characterId === input.viewerCharacterId) return true
    if (target.visibilityMode === 'always') return true
    const forceEnabled = !!hasSpellObstruction || !!(input.fog && fogCoversPoint(input.fog, target.x, target.y)) ||
      !!(input.geometry?.darknessFog && fogCoversPoint(input.geometry.darknessFog, target.x, target.y))
    if (!forceEnabled && !input.geometry?.vision.enabled) return true
    return viewers.some(viewer => viewer.id === target.id || mapGeometryCanSeeToken({
      map: input.map, geometry: input.geometry, viewer, target, forceEnabled, worldMinute: input.worldMinute,
    }))
  })
}
