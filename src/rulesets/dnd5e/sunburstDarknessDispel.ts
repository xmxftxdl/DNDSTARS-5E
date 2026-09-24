import { type FogShape } from '../../lib/fogOfWar'
import { endDnd5eConcentration, type Dnd5eHeadlessCombatState, type Dnd5eCombatEvent } from './headlessCombatEngine'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { cellDistance, tokenCenterForAnchorCell, type GridCell } from '../../lib/gridCombat'
import { mapGeometryLightPolygon, mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint, mapGeometryTokenElevation, mapGeometryLineOfEffectBlocked, type MapGeometryState } from '../../lib/mapGeometry'
import { removePersistentAreaByDm } from './persistentAreaRemoval'
import { getDnd5eCoreSpellAreaDeclaration } from './coreSpellAreas'

export interface SunburstDarknessDispelSettlement {
  map: BattleMap
  geometry?: MapGeometryState
  characters: Character[]
  removedAreaIds: string[]
  changedCharacterIds: string[]
  changedTokenIds: string[]
  events: Dnd5eCombatEvent[]
}

/**
 * Sunburst ends every spell-created darkness volume touched by its 60-foot
 * sphere. Removing the map area and its exact concentration controller in one
 * shared settlement prevents the UI from leaving an invisible, still-active
 * Darkness concentration behind after the visual volume disappears.
 */
export function settleSunburstSpellDarknessDispels(input: {
  map: BattleMap
  characters: readonly Character[]
  anchorCell: GridCell
  radiusFeet: number
  elevationFeet?: number
  geometry?: MapGeometryState
  state?: Dnd5eHeadlessCombatState
}): SunburstDarknessDispelSettlement {
  const events: Dnd5eCombatEvent[] = []
  let map = input.map
  let characters = [...input.characters]
  const geometry = input.geometry ?? mapGeometryRuntimeForMap(input.map.id)
  const origin = tokenCenterForAnchorCell(input.anchorCell, { size: 1 }, input.map)
  const elevation = input.elevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, origin)
  const maximumCells = Math.floor(input.radiusFeet / Math.max(1, input.map.feetPerCell ?? 5))
  // Reveal the continuous spell footprint. Cell-center sampling leaves strips
  // whenever a manually drawn fog edge falls between grid centers.
  let dispelledGeometry: MapGeometryState | undefined
  if (geometry?.darknessFog && (geometry.darknessFog.filled || geometry.darknessFog.shapes.length)) {
    const fog = geometry.darknessFog
    const points = mapGeometryLightPolygon({ geometry, map, source: origin,
      radiusFeet: input.radiusFeet, elevationFeet: elevation, targetElevationFeet: elevation,
      purpose: 'line-of-effect',
    }).flatMap(point => [point.x, point.y])
    const previous = fog.shapes.at(-1)
    const alreadyRevealed = previous?.kind === 'polygon' && previous.operation === 'reveal' &&
      JSON.stringify(previous.points) === JSON.stringify(points)
    if (points.length >= 6 && !alreadyRevealed) {
      const createdAt = Date.now()
      const reveal: FogShape = { id: `sunburst:${createdAt}`, kind: 'polygon', operation: 'reveal', createdAt, points }
      dispelledGeometry = { ...geometry,
        darknessFog: { ...fog, shapes: [...fog.shapes, reveal], updatedAt: createdAt } }
    }
  }
  const candidateIds = (input.map.dnd5ePluginAreas ?? []).flatMap((area) => {
    if (area.sourceKind !== 'core-spell' || area.lighting?.kind !== 'magical-darkness') return []
    const declaration = getDnd5eCoreSpellAreaDeclaration(area.coreSpellId ?? '')
    const anchor = map.tokens.find(token => token.id === (area.anchorTokenId ?? area.sourceTokenId))
    const followsToken = ['source-token', 'target-token', 'effect-token'].includes(area.anchorMode ?? '')
    const anchorSurface = followsToken && anchor
      ? mapGeometryTokenElevation(geometry, anchor)
      : mapGeometryTerrainElevationAtPoint(geometry, tokenCenterForAnchorCell(area.anchorCell ?? area.cells[0] ?? input.anchorCell, { size: 1 }, map))
    const vertical = area.vertical ?? (declaration?.vertical?.mode === 'volume'
      ? { mode: 'volume' as const, baseElevationFeet: anchorSurface + (declaration.vertical.anchorOffsetFeet ?? 0), heightFeet: declaration.vertical.heightFeet }
      : undefined)
    const base = vertical?.mode === 'volume'
      ? followsToken && anchor && Number.isFinite(vertical.anchorOffsetFeet)
        ? anchorSurface + Number(vertical.anchorOffsetFeet) : vertical.baseElevationFeet
      : -Infinity
    const top = vertical?.mode === 'volume' ? base + vertical.heightFeet : Infinity
    if (base > elevation + input.radiusFeet || top < elevation - input.radiusFeet) return []
    const hitElevation = Math.max(base, Math.min(top, elevation))
    return area.cells.some(cell => cellDistance(input.anchorCell, cell) <= maximumCells &&
      !mapGeometryLineOfEffectBlocked({
        geometry, map, from: origin, to: tokenCenterForAnchorCell(cell, { size: 1 }, map),
        fromElevationFeet: elevation, toElevationFeet: hitElevation,
      })) ? [area.id] : []
  })
  const removedAreaIds: string[] = []
  const changedCharacterIds = new Set<string>()
  const changedTokenIds = new Set<string>()
  for (const areaId of candidateIds) {
    const removedArea = map.dnd5ePluginAreas?.find(area => area.id === areaId)
    const caster = removedArea && input.state?.combatants[removedArea.sourceTokenId]
    if (caster && input.state && caster.classState.concentrationSpellId &&
      caster.classState.concentrationSpellId === (removedArea?.concentrationId ?? removedArea?.coreSpellId)) {
      endDnd5eConcentration(input.state, caster, events)
    }
    const beforeTokens = new Map(map.tokens.map((token) => [token.id, token]))
    const removal = removePersistentAreaByDm({ map, characters, areaId })
    if (!removal) continue
    map = removal.map
    removedAreaIds.push(areaId)
    if (removal.character) {
      characters = characters.map((character) =>
        character.id === removal.character!.id ? removal.character! : character,
      )
      changedCharacterIds.add(removal.character.id)
    }
    for (const token of map.tokens) {
      if (JSON.stringify(beforeTokens.get(token.id)) !== JSON.stringify(token)) changedTokenIds.add(token.id)
    }
    for (const tokenId of beforeTokens.keys()) {
      if (!map.tokens.some((token) => token.id === tokenId)) changedTokenIds.add(tokenId)
    }
  }
  return {
    map,
    geometry: dispelledGeometry,
    characters,
    events,
    removedAreaIds,
    changedCharacterIds: [...changedCharacterIds],
    changedTokenIds: [...changedTokenIds],
  }
}

