import {
  cellKey,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import {
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { getDnd5eCoreSpellAreaDeclaration } from './coreSpellAreas'
import { dnd5eTokenHeightFeet } from './verticalCombatGeometry'

function inferredLegacyCoreAreaVertical(
  area: Dnd5ePluginArea,
  map: BattleMap,
): Dnd5ePluginArea['vertical'] {
  if (area.sourceKind !== 'core-spell' || !area.coreSpellId) return undefined
  const declaration = getDnd5eCoreSpellAreaDeclaration(area.coreSpellId)
  if (declaration?.vertical?.mode === 'ground') return { mode: 'ground' }
  if (declaration?.vertical?.mode !== 'volume') return undefined
  const geometry = mapGeometryRuntimeForMap(map.id)
  const anchorToken = area.anchorMode === 'source-token' || area.anchorMode === 'effect-token'
    ? map.tokens.find((candidate) =>
        candidate.id === (area.anchorTokenId ?? area.sourceTokenId))
    : undefined
  const anchorCell = area.anchorCell ?? area.cells[0]
  const surface = anchorToken
    ? mapGeometryTokenElevation(geometry, anchorToken)
    : anchorCell
      ? mapGeometryTerrainElevationAtPoint(
          geometry,
          tokenCenterForAnchorCell(anchorCell, { size: 1 }, map),
        )
      : 0
  const anchorOffsetFeet = declaration.vertical.anchorOffsetFeet ?? 0
  return {
    mode: 'volume',
    baseElevationFeet: surface + anchorOffsetFeet,
    heightFeet: declaration.vertical.heightFeet,
    ...(anchorToken && anchorOffsetFeet !== 0 ? { anchorOffsetFeet } : {}),
  }
}

/**
 * Old saves did not persist vertical semantics. Known surface spells are
 * inferred as ground effects; all other legacy areas retain their previous
 * unbounded-column behavior until recreated with an explicit declaration.
 */
export function dnd5ePersistentAreaAffectsTokenVerticallyAt(input: {
  area: Dnd5ePluginArea
  map: BattleMap
  token: Token
  position: { x: number; y: number }
  elevationFeet?: number
}): boolean {
  const vertical = input.area.vertical ?? inferredLegacyCoreAreaVertical(input.area, input.map)
  if (!vertical) return true
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const positionedToken = {
    ...input.token,
    ...input.position,
    elevationFeet: Number.isFinite(input.elevationFeet)
      ? input.elevationFeet
      : input.token.elevationFeet,
  }
  const tokenBottom = mapGeometryTokenElevation(geometry, positionedToken)
  if (vertical.mode === 'ground') {
    const ground = mapGeometryTerrainElevationAtPoint(geometry, input.position)
    return Math.abs(tokenBottom - ground) <= 1e-4
  }
  const anchorToken = input.area.anchorMode === 'source-token' || input.area.anchorMode === 'effect-token'
    ? input.map.tokens.find((candidate) =>
        candidate.id === (input.area.anchorTokenId ?? input.area.sourceTokenId))
    : undefined
  const volumeBase = anchorToken && Number.isFinite(vertical.anchorOffsetFeet)
    ? mapGeometryTokenElevation(geometry, anchorToken) + Number(vertical.anchorOffsetFeet)
    : vertical.baseElevationFeet
  const volumeTop = volumeBase + vertical.heightFeet
  const tokenTop = tokenBottom + dnd5eTokenHeightFeet(input.token)
  return tokenTop > volumeBase + 1e-4 && tokenBottom < volumeTop - 1e-4
}

export function dnd5ePersistentAreaAllowsTarget(
  area: Dnd5ePluginArea,
  target: Token,
  map: BattleMap,
): boolean {
  if (target.type === 'obstacle') return false
  if (target.id === area.sourceTokenId && area.includeSelf !== true) return false
  const source = map.tokens.find((token) => token.id === area.sourceTokenId)
  if (!source || area.relation === 'any' || !area.relation) return true
  const opposed = areOpposedCombatTokens(source, target)
  return area.relation === 'enemy' ? opposed : !opposed
}

export function dnd5eTokenIntersectsPersistentAreaAt(
  token: Token,
  map: BattleMap,
  area: Dnd5ePluginArea,
  position: { x: number; y: number },
  cells: readonly GridCell[] = area.cells,
  elevationFeet?: number,
): boolean {
  const areaCells = new Set(cells.map(cellKey))
  return tokenOccupiedCellsAt(token, map, position).some((cell) => areaCells.has(cellKey(cell))) &&
    dnd5ePersistentAreaAffectsTokenVerticallyAt({
      area,
      map,
      token,
      position,
      elevationFeet,
    })
}

export function dnd5ePersistentAreaMovementCostMultiplierAt(input: {
  map: BattleMap
  token: Token
  position: { x: number; y: number }
}): number {
  let multiplier = 1
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if (
      (area.movementCostMultiplier ?? 1) <= 1 ||
      !dnd5ePersistentAreaAllowsTarget(area, input.token, input.map) ||
      !dnd5eTokenIntersectsPersistentAreaAt(input.token, input.map, area, input.position)
    ) continue
    multiplier = Math.max(multiplier, area.movementCostMultiplier ?? 1)
  }
  return multiplier
}

export function dnd5ePersistentAreaDifficultTerrainMultiplierAt(input: {
  map: BattleMap
  token: Token
  position: { x: number; y: number }
}): number {
  let multiplier = 1
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if (
      area.coreSpellId === 'spirit-guardians' ||
      (area.movementCostMultiplier ?? 1) <= 1 ||
      !dnd5ePersistentAreaAllowsTarget(area, input.token, input.map) ||
      !dnd5eTokenIntersectsPersistentAreaAt(input.token, input.map, area, input.position)
    ) continue
    multiplier = Math.max(multiplier, area.movementCostMultiplier ?? 1)
  }
  return multiplier
}

export function dnd5ePersistentAreaSpeedCostMultiplierAt(input: {
  map: BattleMap
  token: Token
  position: { x: number; y: number }
}): number {
  let multiplier = 1
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if (
      area.coreSpellId !== 'spirit-guardians' ||
      (area.movementCostMultiplier ?? 1) <= 1 ||
      !dnd5ePersistentAreaAllowsTarget(area, input.token, input.map) ||
      !dnd5eTokenIntersectsPersistentAreaAt(input.token, input.map, area, input.position)
    ) continue
    multiplier = Math.max(multiplier, area.movementCostMultiplier ?? 1)
  }
  return multiplier
}
