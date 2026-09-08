import { createEmptyMapFog, type MapFogState } from '../../lib/fogOfWar'
import {
  createEmptyMapGeometry,
  type MapGeometryPoint,
  type MapGeometryState,
} from '../../lib/mapGeometry'
import {
  mapExplorationPolygonsForTokenPath,
  type MapExplorationMapState,
} from '../../lib/mapExploration'
import { resolvePlayerVisionSourceTokenIds } from '../../lib/playerVision'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { normalizeDnd5eActiveEffects } from '../../rulesets/dnd5e/activeEffects'

export interface MapsFogGeometryProjection {
  fog: MapFogState
  geometry: MapGeometryState
  visionSourceTokenIds: string[]
  exploredVisionPolygons: MapGeometryPoint[][]
  manualFogExplorationEnabled: boolean
}

export function resolveMapsFogGeometryState(input: {
  map: BattleMap
  fogMaps: readonly MapFogState[]
  geometryMaps: readonly MapGeometryState[]
}): Pick<MapsFogGeometryProjection, 'fog' | 'geometry' | 'manualFogExplorationEnabled'> {
  const fog = input.fogMaps.find((entry) => entry.mapId === input.map.id) ?? createEmptyMapFog(input.map.id, 0)
  const geometry = input.geometryMaps.find((entry) => entry.mapId === input.map.id) ?? createEmptyMapGeometry(input.map.id, 0)
  return { fog, geometry, manualFogExplorationEnabled: fog.filled === true }
}

export function buildMapsFogGeometryProjection(input: {
  map: BattleMap
  fogMaps: readonly MapFogState[]
  geometryMaps: readonly MapGeometryState[]
  explorationMaps: readonly MapExplorationMapState[]
  isDm: boolean
  roomMemberId?: string
  controlledCharacterIds?: readonly (string | null | undefined)[]
  characters?: readonly Character[]
}): MapsFogGeometryProjection {
  const { fog, geometry, manualFogExplorationEnabled } = resolveMapsFogGeometryState(input)
  const exploration = input.explorationMaps.find((entry) => entry.mapId === input.map.id)
  const exploredVisionPolygons = input.isDm
    ? Object.values(exploration?.byMemberId ?? {}).flatMap((entry) => entry.polygons)
    : input.roomMemberId
      ? exploration?.byMemberId[input.roomMemberId]?.polygons ?? []
      : []
  const controlledIds = new Set((input.controlledCharacterIds ?? []).filter((id): id is string => !!id))
  const sharedSenses = (input.characters ?? []).flatMap((character) => {
    if (!controlledIds.has(character.id)) return []
    const tokenIds = normalizeDnd5eActiveEffects(character.dnd5eCombatState?.activeEffects)
      .flatMap((effect) => effect.legacyCondition?.startsWith('shared-senses-token:')
        ? [effect.legacyCondition.slice('shared-senses-token:'.length)]
        : [])
    const sourceToken = input.map.tokens.find((token) => token.characterId === character.id)
    if (!sourceToken) return []
    const maximumPixels = 100 / Math.max(1, input.map.feetPerCell ?? 5) * Math.max(1, input.map.gridSize)
    const validTokenIds = tokenIds.filter((tokenId) => {
      const token = input.map.tokens.find((candidate) => candidate.id === tokenId)
      return !!token && token.dnd5eSummon?.persistent === true &&
        token.dnd5eSummon.sourceCharacterId === character.id &&
        Math.hypot(token.x - sourceToken.x, token.y - sourceToken.y) <= maximumPixels + 1e-4
    })
    return validTokenIds.length ? [{ characterId: character.id, tokenIds: validTokenIds }] : []
  })

  return {
    fog,
    geometry,
    visionSourceTokenIds: resolvePlayerVisionSourceTokenIds({
      tokens: input.map.tokens,
      sharePartyVision: geometry.vision.sharePartyVision !== false,
      controlledCharacterIds: input.controlledCharacterIds,
      sharedVisionTokenIds: sharedSenses.flatMap((entry) => entry.tokenIds),
      suppressedVisionCharacterIds: sharedSenses.map((entry) => entry.characterId),
    }),
    // Exploration is historical evidence. A later blindness or reduced light
    // source must not erase terrain that was already explored.
    exploredVisionPolygons,
    manualFogExplorationEnabled,
  }
}

export interface MapExplorationUpdate {
  memberId: string
  polygons: MapGeometryPoint[][]
}

export function buildMapExplorationUpdates(input: {
  map: BattleMap
  geometry: MapGeometryState
  characters: readonly Character[]
  forceEnabled: boolean
}): MapExplorationUpdate[] {
  if (!input.geometry.vision.enabled && !input.forceEnabled) return []
  const views = input.map.tokens.flatMap((token) => {
    if (token.type !== 'player' || !token.characterId) return []
    const character = input.characters.find((candidate) => candidate.id === token.characterId)
    if (!character?.roomMemberId) return []
    const polygons = mapExplorationPolygonsForTokenPath({
      geometry: input.geometry,
      map: input.map,
      token,
      path: [{ x: token.x, y: token.y }],
      forceEnabled: input.forceEnabled,
    })
    return polygons.length > 0 ? [{ memberId: character.roomMemberId, polygons }] : []
  })

  if (!input.geometry.vision.sharePartyVision) return views
  const polygons = views.flatMap((entry) => entry.polygons)
  return [...new Set(views.map((entry) => entry.memberId))].map((memberId) => ({ memberId, polygons }))
}
