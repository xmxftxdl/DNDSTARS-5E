import { gasExcludedAt } from './gasExclusion'
import { rectangularPrismOverlapsBox } from '../../../shared/rectangular-prism.mjs'
import {clipAbovePlane} from '../../lib/heightPlane'
import {partitionByConvexPolygon,polygonSignedArea} from '../../lib/convexPolygonPartition'
import {triangulateSimplePolygon} from '../../lib/triangulateSimplePolygon'
import {dnd5eWallSurfaceIntersectsFootprint} from './wallSurfaceSections'
import { dnd5eNormalGroundTerrainAt } from './normalGroundTerrain'
import { annularAreaOverlapsBox } from '../../../shared/annular-area-geometry.mjs'
import { persistentAreaHeightSlices } from '../../../shared/persistent-area-columns.mjs'
import { groveAreaFootprintOverlaps } from '../../../shared/grove-volume.mjs'
import {
  cellKey,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  tokenFootprintCells,
  type GridCell,
} from '../../lib/gridCombat'
import {
  mapGeometryRuntimeForMap,
  mapGeometryLineOfEffectBlocked,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { getDnd5eCoreSpellAreaDeclaration } from './coreSpellAreas'
import { dnd5eTokenHeightFeet } from './verticalCombatGeometry'
import { dnd5eTokenHasWebWalker } from './webTraits'

export function dnd5ePersistentWardProtectedFrom(map:BattleMap,token:Token):string[] {
  const footprint=tokenOccupiedCellsAt(token,map,token)
  return [...new Set((map.dnd5ePluginAreas??[]).flatMap(area=>{
    if(!area.blocking?.protectsOccupantsFromRestrictedTokens)return []
    const cells=new Set(area.cells.map(cellKey))
    return footprint.every(cell=>cells.has(cellKey(cell)))?[...(area.blocking.restrictedTokenIds??[])]:[]
  }))]
}

function inferredLegacyCoreAreaVertical(
  area: Dnd5ePluginArea,
  map: BattleMap,
): Dnd5ePluginArea['vertical'] {
  if (area.sourceKind !== 'core-spell' || !area.coreSpellId) return undefined
  const declaration = getDnd5eCoreSpellAreaDeclaration(area.coreSpellId)
  if (declaration?.vertical?.mode === 'ground') return { mode: 'ground' }
  if (declaration?.vertical?.mode !== 'volume') return undefined
  const geometry = mapGeometryRuntimeForMap(map.id)
  const anchorToken = area.anchorMode === 'source-token' || area.anchorMode === 'target-token' || area.anchorMode === 'effect-token'
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
  if(input.area.materialFallVolumes){
    const geometry=mapGeometryRuntimeForMap(input.map.id)
    const bottom=mapGeometryTokenElevation(geometry,{...input.token,...input.position,elevationFeet:input.elevationFeet??input.token.elevationFeet})
    const top=bottom+dnd5eTokenHeightFeet(input.token)
    const half=tokenFootprintCells(input.token)*input.map.gridSize/2,{x,y}=input.position
    const box=[{x:x-half,y:y-half},{x:x+half,y:y-half},{x:x+half,y:y+half},{x:x-half,y:y+half}]
    return input.area.materialFallVolumes.some(volume=>bottom<volume.topFeet-1e-4&&top>volume.bottomFeet+1e-4&&
      triangulateSimplePolygon(volume.points)?.some(triangle=>{
        const clipped=partitionByConvexPolygon(triangle,box)
        const exposed=clipped&&(volume.bottomPlane?clipAbovePlane(clipped.inside,{xSlope:0,ySlope:0,offset:top-1e-4},volume.bottomPlane):clipped.inside)
        return exposed&&Math.abs(polygonSignedArea(exposed))>1e-7
      }))
  }
  const vertical = input.area.vertical ?? inferredLegacyCoreAreaVertical(input.area, input.map)
  if (!vertical) return true
  if (vertical.mode === 'volume' && vertical.columns) {
    return persistentAreaHeightSlices(input.area).some(area =>
      dnd5eTokenIntersectsPersistentAreaAt(input.token, input.map, area, input.position, area.cells, input.elevationFeet))
  }
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const positionedToken = {
    ...input.token,
    ...input.position,
    elevationFeet: Number.isFinite(input.elevationFeet)
      ? input.elevationFeet
      : input.token.elevationFeet,
  }
  const tokenBottom = mapGeometryTokenElevation(geometry, positionedToken)
  const groveIntersects = (base: number, height: number) => groveAreaFootprintOverlaps(input.area.groveVolume,
    input.area.cells, input.map, input.position, tokenFootprintCells(input.token) * input.map.gridSize / 2, base, height)
  if (vertical.mode === 'ground') {
    const ground = mapGeometryTerrainElevationAtPoint(geometry, input.position)
    return Math.abs(tokenBottom - ground) <= 1e-4 &&
      groveIntersects(ground, 0)
  }
  const anchorToken = input.area.anchorMode === 'source-token' || input.area.anchorMode === 'target-token' || input.area.anchorMode === 'effect-token'
    ? input.map.tokens.find((candidate) =>
        candidate.id === (input.area.anchorTokenId ?? input.area.sourceTokenId))
    : undefined
  const volumeBase = anchorToken && Number.isFinite(vertical.anchorOffsetFeet)
    ? mapGeometryTokenElevation(geometry, anchorToken) + Number(vertical.anchorOffsetFeet)
    : vertical.baseElevationFeet
  const volumeTop = volumeBase + vertical.heightFeet
  const tokenTop = tokenBottom + dnd5eTokenHeightFeet(input.token)
  const overlapBase = Math.max(tokenBottom, volumeBase)
  if (!groveIntersects(overlapBase, Math.min(tokenTop, volumeTop) - overlapBase)) return false
  if ((vertical.shape === 'sphere' || input.area.symbol?.activated) && input.area.anchorCell) {
    const center = anchorToken ?? tokenCenterForAnchorCell(input.area.anchorCell, { size: 1 }, input.map)
    const radius = vertical.shape === 'sphere' ? vertical.heightFeet / 2 : 60
    const centerZ = volumeBase + radius
    const halfSizeFeet = input.token.size * (input.map.feetPerCell ?? 5) / 2
    const scale = (input.map.feetPerCell ?? 5) / input.map.gridSize
    const dx = Math.max(0, Math.abs(input.position.x - center.x) * scale - halfSizeFeet)
    const dy = Math.max(0, Math.abs(input.position.y - center.y) * scale - halfSizeFeet)
    const dz = Math.max(0, tokenBottom - centerZ, centerZ - tokenTop)
    return dx * dx + dy * dy + dz * dz <= radius * radius
  }

  const restsOnMagicalTopBoundary =
    input.area.occupantModifiers?.magicallyHeldAloft === true &&
    Math.abs(tokenBottom - volumeTop) <= 1e-4
  return restsOnMagicalTopBoundary || (
    tokenTop > volumeBase + 1e-4 && tokenBottom < volumeTop - 1e-4
  )
}

export function dnd5ePersistentAreaAllowsTarget(
  area: Dnd5ePluginArea,
  target: Token,
  map: BattleMap,
): boolean {
  if (target.type === 'obstacle') return false
  if (area.excludedTargetIds?.includes(target.id)) return false
  if (target.id === area.sourceTokenId && area.includeSelf !== true) return false
  const source = map.tokens.find((token) => token.id === area.sourceTokenId)
  if (!source || area.relation === 'any' || !area.relation) return true
  const opposed = areOpposedCombatTokens(source, target)
  return area.relation === 'enemy' ? opposed : !opposed
}

function canonicalHallowCreatureType(value: string): string {
  const type = value.trim().toLowerCase()
  if (type.includes('异怪')) return 'aberration'
  if (type.includes('野兽')) return 'beast'
  if (type.includes('天界')) return 'celestial'
  if (type.includes('构装')) return 'construct'
  if (type.includes('龙')) return 'dragon'
  if (type.includes('元素')) return 'elemental'
  if (type.includes('精类') || type.includes('妖精')) return 'fey'
  if (type.includes('邪魔')) return 'fiend'
  if (type.includes('巨人')) return 'giant'
  if (type.includes('类人生物')) return 'humanoid'
  if (type.includes('怪兽')) return 'monstrosity'
  if (type.includes('软泥')) return 'ooze'
  if (type.includes('植物')) return 'plant'
  if (type.includes('亡灵') || type.includes('不死')) return 'undead'
  return type
}

/** Resolves the creature subset chosen for Hallow's additional effect. */
export function dnd5eHallowAdditionalEffectAllowsTarget(
  area: Dnd5ePluginArea,
  target: Token,
  map: BattleMap,
): boolean {
  const hallow = area.hallow
  if (!hallow) return false
  if ((area.triggerReceipts ?? []).some((receipt) =>
    receipt.triggerId === 'hallow-additional-effect-save' &&
    receipt.targetTokenId === target.id && receipt.savingThrowSucceeded === true)) return false
  if (hallow.effectScope === 'all') return true
  const source = map.tokens.find((token) => token.id === area.sourceTokenId)
  if (!source) return false
  if (hallow.effectScope === 'allies' || hallow.effectScope === 'enemies') {
    const opposed = areOpposedCombatTokens(source, target)
    return hallow.effectScope === 'enemies' ? opposed : !opposed
  }
  const targetTypes = new Set([
    ...(target.creatureTypes ?? []).map(canonicalHallowCreatureType),
    ...(target.type === 'player' ? ['humanoid'] : []),
  ])
  return !!hallow.affectedCreatureType && targetTypes.has(hallow.affectedCreatureType)
}

export function dnd5eTokenIntersectsPersistentAreaAt(
  token: Token,
  map: BattleMap,
  area: Dnd5ePluginArea,
  position: { x: number; y: number },
  cells: readonly GridCell[] = area.cells,
  elevationFeet?: number,
): boolean {
  const gasBottom = elevationFeet ?? mapGeometryTokenElevation(mapGeometryRuntimeForMap(map.id), {...token,...position})
  if (gasExcludedAt(map, area, position, gasBottom, gasBottom + dnd5eTokenHeightFeet(token), tokenFootprintCells(token)*map.gridSize/2)) return false
  const areaCells = new Set(cells.map(cellKey))
  if (area.rectGeometry?.pitchDegrees || area.rectGeometry?.rollDegrees) {
    const half = tokenFootprintCells(token) * map.gridSize / 2
    return cells.some(cell => {
      const left = map.gridOffsetX + cell.col * map.gridSize, top = map.gridOffsetY + cell.row * map.gridSize
      const minimum = {x:Math.max(left,position.x-half),y:Math.max(top,position.y-half),elevationFeet:gasBottom}
      const maximum = {x:Math.min(left+map.gridSize,position.x+half),y:Math.min(top+map.gridSize,position.y+half),
        elevationFeet:gasBottom+dnd5eTokenHeightFeet(token)}
      return minimum.x < maximum.x && minimum.y < maximum.y && rectangularPrismOverlapsBox(map,area,minimum,maximum)
    })
  }
  if (area.circularGeometry?.innerRadiusFeet != null &&
    !annularAreaOverlapsBox(area,map,position,tokenFootprintCells(token)*map.gridSize/2)) return false
  if (area.vertical?.mode === 'volume' && area.vertical.columns) {
    return persistentAreaHeightSlices(area).some(slice => slice.cells.some(cell => areaCells.has(cellKey(cell))) &&
      dnd5eTokenIntersectsPersistentAreaAt(token, map, slice, position, slice.cells, elevationFeet))
  }
  if(area.wallSurfaceSections!=null){
    const bottom=elevationFeet??mapGeometryTokenElevation(mapGeometryRuntimeForMap(map.id),{...token,...position})
    return dnd5eWallSurfaceIntersectsFootprint({area:{...area,cells:[...cells]},map,position,
      halfSizePixels:tokenFootprintCells(token)*map.gridSize/2,bottomFeet:bottom,topFeet:bottom+dnd5eTokenHeightFeet(token)})
  }
  // Sphere movement contacts use continuous body bounds. Snapping a Large
  // creature's footprint to grid cells can discard a valid tangent contact
  // and leave an already captured creature behind when the sphere continues.
  if (area.vertical?.mode === 'volume' && area.vertical.shape === 'sphere' && area.anchorCell) {
    return dnd5ePersistentAreaAffectsTokenVerticallyAt({area,map,token,position,elevationFeet})
  }
  if (area.circularGeometry && area.movement?.carryRestrainedTargets && area.anchorCell) {
    const scale=map.gridSize/(map.feetPerCell??5),half=tokenFootprintCells(token)*map.gridSize/2
    const cx=map.gridOffsetX+(area.anchorCell.col+.5)*map.gridSize,cy=map.gridOffsetY+(area.anchorCell.row+.5)*map.gridSize
    const distance=Math.hypot(Math.max(0,Math.abs(position.x-cx)-half),Math.max(0,Math.abs(position.y-cy)-half))/scale
    return distance <= area.circularGeometry.radiusFeet+1e-7 &&
      dnd5ePersistentAreaAffectsTokenVerticallyAt({area,map,token,position,elevationFeet})
  }
  return tokenOccupiedCellsAt(token, map, position).some((cell) => areaCells.has(cellKey(cell))) &&
    dnd5ePersistentAreaAffectsTokenVerticallyAt({
      area,
      map,
      token,
      position,
      elevationFeet,
    })
}

/** True when a positioned creature overlaps the independent entity Token that
 * anchors an interposition command. The ordinary area cells are presentation
 * and targeting geometry; the entity's own Large footprint owns movement. */
export function dnd5eTokenIntersectsPersistentAreaAnchorTokenAt(
  token: Token,
  map: BattleMap,
  area: Dnd5ePluginArea,
  position: { x: number; y: number },
): boolean {
  if (!area.anchorTokenId) return false
  const anchor = map.tokens.find((candidate) => candidate.id === area.anchorTokenId)
  if (!anchor) return false
  const anchorCells = new Set(tokenOccupiedCellsAt(anchor, map, anchor).map(cellKey))
  return tokenOccupiedCellsAt(token, map, position).some((cell) => anchorCells.has(cellKey(cell)))
}

export function dnd5eTokenFullyContainedInPersistentAreaAt(
  token: Token,
  map: BattleMap,
  area: Dnd5ePluginArea,
  position: { x: number; y: number },
  elevationFeet?: number,
): boolean {
  const areaCells = new Set(area.cells.map(cellKey))
  if (!tokenOccupiedCellsAt(token, map, position).every((cell) => areaCells.has(cellKey(cell)))) return false
  const vertical = area.vertical ?? inferredLegacyCoreAreaVertical(area, map)
  if (!vertical) return true
  const geometry = mapGeometryRuntimeForMap(map.id)
  const positionedToken = { ...token, ...position, elevationFeet: elevationFeet ?? token.elevationFeet }
  const tokenBottom = mapGeometryTokenElevation(geometry, positionedToken)
  if (vertical.mode === 'ground') {
    return Math.abs(tokenBottom - mapGeometryTerrainElevationAtPoint(geometry, position)) <= 1e-4
  }
  const anchorToken = area.anchorMode === 'source-token' || area.anchorMode === 'target-token' || area.anchorMode === 'effect-token'
    ? map.tokens.find((candidate) => candidate.id === (area.anchorTokenId ?? area.sourceTokenId))
    : undefined
  const volumeBase = anchorToken && Number.isFinite(vertical.anchorOffsetFeet)
    ? mapGeometryTokenElevation(geometry, anchorToken) + Number(vertical.anchorOffsetFeet)
    : vertical.baseElevationFeet
  const tokenTop = tokenBottom + dnd5eTokenHeightFeet(token)
  if (vertical.columns) {
    return tokenOccupiedCellsAt(token, map, position).every(cell => vertical.columns!.some(column =>
      column.col === cell.col && column.row === cell.row && tokenBottom >= column.baseElevationFeet - 1e-4 &&
      tokenTop <= column.baseElevationFeet + column.heightFeet + 1e-4))
  }
  return tokenBottom >= volumeBase - 1e-4 && tokenTop <= volumeBase + vertical.heightFeet + 1e-4
}

/** Merges bounded environmental modifiers from all eligible areas at a token position. */
export function dnd5ePersistentAreaOccupantModifiersAt(input: {
  map: BattleMap
  token: Token
  position: { x: number; y: number }
  elevationFeet?: number
}): {
  abilityCheckRules: import('./abilityCheckRules').Dnd5eAbilityCheckRule[]
  skillCheckBonuses: Record<string, number>
  savingThrowAdvantages: import('../../lib/dnd').AbilityKey[]
  preventsVerbalComponents: boolean
  suppressesMagic: boolean
  spellSuppressionAreas: readonly { areaId: string; maximumSpellLevel: number }[]
  damageImmunities: readonly import('./damageTypes').Dnd5eDamageType[]
  damageResistances: readonly import('./damageTypes').Dnd5eDamageType[]
  damageVulnerabilities: readonly import('./damageTypes').Dnd5eDamageType[]
  conditionImmunities: readonly import('./conditions').Dnd5eStandardConditionId[]
  conditionSources: readonly { areaId: string; label: string; sourceTokenId: string; conditions: readonly import('./conditions').Dnd5eStandardConditionId[] }[]
  attacksAgainstOccupantDisadvantageCreatureTypes: readonly string[]
  attacksAgainstOccupantDisadvantageSources: readonly {
    areaId: string
    label: string
    creatureTypes: readonly string[]
  }[]
  conditionImmunitiesBySourceCreatureType: readonly {
    conditions: readonly string[]
    sourceCreatureTypes: readonly string[]
  }[]
  savingThrowAdvantagesBySourceCreatureType: readonly {
    conditions: readonly string[]
    sourceCreatureTypes: readonly string[]
  }[]
  spellSavingThrowAdvantage: boolean
  spellTargetingImmunitySchools: readonly import('./spellbook').Dnd5eSpellbookSchoolId[]
  successfulSpellSaveNegatesDamage: boolean
  hitPointMaximumReductionImmunity: boolean
  halvesFallingDamage: boolean
  verticalJumpBonusFeet: number
  magicallyHeldAloft: boolean
  preventsRangedWeaponAttacks: boolean
  concentrationSavingThrowDisadvantage: boolean
  languageCapabilities?: {
    understandSpoken?: 'all'
    speechUnderstoodBy?: 'any-creature-knowing-a-language'
  }
} {
  const savingThrowAdvantages = new Set<import('../../lib/dnd').AbilityKey>()
  const skillBonusGroups = new Map<string, Record<string, number>>()
  let preventsVerbalComponents = false
  let suppressesMagic = false
  const spellSuppressionAreas: { areaId: string; maximumSpellLevel: number }[] = []
  const damageImmunities = new Set<import('./damageTypes').Dnd5eDamageType>()
  const damageResistances = new Set<import('./damageTypes').Dnd5eDamageType>()
  const damageVulnerabilities = new Set<import('./damageTypes').Dnd5eDamageType>()
  const conditionImmunities = new Set<import('./conditions').Dnd5eStandardConditionId>()
  const conditionSources: { areaId: string; label: string; sourceTokenId: string; conditions: readonly import('./conditions').Dnd5eStandardConditionId[] }[] = []
  const attacksAgainstOccupantDisadvantageCreatureTypes = new Set<string>()
  const attacksAgainstOccupantDisadvantageSources: {
    areaId: string
    label: string
    creatureTypes: readonly string[]
  }[] = []
  const conditionImmunitiesBySourceCreatureType: {
    conditions: readonly string[]
    sourceCreatureTypes: readonly string[]
  }[] = []
  const savingThrowAdvantagesBySourceCreatureType: {
    conditions: readonly string[]
    sourceCreatureTypes: readonly string[]
  }[] = []
  let spellSavingThrowAdvantage = false
  const spellTargetingImmunitySchools = new Set<import('./spellbook').Dnd5eSpellbookSchoolId>()
  let successfulSpellSaveNegatesDamage = false
  let hitPointMaximumReductionImmunity = false
  let halvesFallingDamage = false
  let verticalJumpBonusFeet = 0
  let magicallyHeldAloft = false
  let preventsRangedWeaponAttacks = false
  const abilityCheckRules: import('./abilityCheckRules').Dnd5eAbilityCheckRule[] = []
  let concentrationSavingThrowDisadvantage = false
  let understandSpoken: 'all' | undefined
  let speechUnderstoodBy: 'any-creature-knowing-a-language' | undefined
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if ((!area.occupantModifiers && !area.hallow) ||
      !dnd5ePersistentAreaAllowsTarget(area, input.token, input.map)) continue
    const modifiers = area.occupantModifiers ?? {}
    if (modifiers.relation && (!input.map.tokens.some(token => token.id === area.sourceTokenId) ||
      !dnd5ePersistentAreaAllowsTarget({ ...area, relation: modifiers.relation }, input.token, input.map))) continue
    const contained = modifiers.containment === 'fully-contained'
      ? dnd5eTokenFullyContainedInPersistentAreaAt(
          input.token, input.map, area, input.position, input.elevationFeet,
        )
      : dnd5eTokenIntersectsPersistentAreaAt(
          input.token, input.map, area, input.position, area.cells, input.elevationFeet,
        )
    if (modifiers.abilityCheckRadiusFeet && area.anchorCell) {
      const geometry = mapGeometryRuntimeForMap(input.map.id)
      const center = tokenCenterForAnchorCell(area.anchorCell, { size: 1 }, input.map)
      const vertical = area.vertical
      const centerZ = vertical?.mode === 'volume'
        ? vertical.baseElevationFeet + (vertical.shape === 'sphere' ? vertical.heightFeet / 2 : 0)
        : mapGeometryTerrainElevationAtPoint(geometry, center)
      const bottom = input.elevationFeet ?? mapGeometryTokenElevation(geometry, { ...input.token, ...input.position })
      const top = bottom + dnd5eTokenHeightFeet(input.token)
      const scale = (input.map.feetPerCell ?? 5) / input.map.gridSize
      const halfSize = tokenFootprintCells(input.token) * (input.map.feetPerCell ?? 5) / 2
      const dx = Math.max(0, Math.abs(input.position.x - center.x) * scale - halfSize)
      const dy = Math.max(0, Math.abs(input.position.y - center.y) * scale - halfSize)
      const dz = Math.max(0, bottom - centerZ, centerZ - top)
      if (dx * dx + dy * dy + dz * dz <= modifiers.abilityCheckRadiusFeet ** 2 &&
        (!modifiers.requiresLineOfEffectFromAnchor || !mapGeometryLineOfEffectBlocked({ geometry, map: input.map,
          from: center, to: input.position, fromElevationFeet: centerZ, toElevationFeet: bottom }))) {
        abilityCheckRules.push(...modifiers.abilityCheckRules ?? [])
      }
    }
    if (!contained) continue
    if (modifiers.requiresLineOfEffectFromAnchor) {
      if (!area.anchorCell) continue
      const geometry = mapGeometryRuntimeForMap(input.map.id)
      const from = tokenCenterForAnchorCell(area.anchorCell, { size: 1 }, input.map)
      if (mapGeometryLineOfEffectBlocked({ geometry, map: input.map, from, to: input.position,
        fromElevationFeet: area.vertical?.mode === 'volume'
          ? area.vertical.baseElevationFeet + (area.vertical.shape === 'sphere' ? area.vertical.heightFeet / 2 : 0)
          : mapGeometryTerrainElevationAtPoint(geometry, from),
        toElevationFeet: input.elevationFeet ?? mapGeometryTokenElevation(geometry, input.token) })) continue
    }
    for (const ability of modifiers.savingThrowAdvantages ?? []) savingThrowAdvantages.add(ability)
    if (!modifiers.abilityCheckRadiusFeet) abilityCheckRules.push(...modifiers.abilityCheckRules ?? [])
    const groupId = area.coreSpellId ? `spell:${area.coreSpellId}` : JSON.stringify([area.pluginId, area.featureId])
    const bonuses = skillBonusGroups.get(groupId) ?? {}
    for (const [skill, bonus] of Object.entries(modifiers.skillCheckBonuses ?? {})) bonuses[skill] = Math.max(bonuses[skill] ?? 0, bonus)
    skillBonusGroups.set(groupId, bonuses)
    if (modifiers.conditions?.length) conditionSources.push({ areaId: area.id, label: area.label, sourceTokenId: area.sourceTokenId, conditions: modifiers.conditions })
    preventsVerbalComponents ||= modifiers.preventsVerbalComponents === true
    suppressesMagic ||= modifiers.suppressesMagic === true
    if (modifiers.suppressesSpellsThroughLevel != null) {
      spellSuppressionAreas.push({
        areaId: area.id,
        maximumSpellLevel: modifiers.suppressesSpellsThroughLevel,
      })
    }
    for (const immunity of modifiers.damageImmunities ?? []) damageImmunities.add(immunity)
    for (const resistance of modifiers.damageResistances ?? []) damageResistances.add(resistance)
    for (const vulnerability of modifiers.damageVulnerabilities ?? []) damageVulnerabilities.add(vulnerability)
    for (const immunity of modifiers.conditionImmunities ?? []) conditionImmunities.add(immunity)
    const attackDisadvantageCreatureTypes =
      modifiers.attacksAgainstOccupantDisadvantageCreatureTypes ?? []
    for (const creatureType of attackDisadvantageCreatureTypes) {
      attacksAgainstOccupantDisadvantageCreatureTypes.add(creatureType)
    }
    if (attackDisadvantageCreatureTypes.length > 0) {
      attacksAgainstOccupantDisadvantageSources.push({
        areaId: area.id,
        label: area.label || '区域防护',
        creatureTypes: [...new Set(attackDisadvantageCreatureTypes)],
      })
    }
    conditionImmunitiesBySourceCreatureType.push(...(modifiers.conditionImmunitiesBySourceCreatureType ?? []))
    savingThrowAdvantagesBySourceCreatureType.push(...(modifiers.savingThrowAdvantagesBySourceCreatureType ?? []))
    spellSavingThrowAdvantage ||= modifiers.spellSavingThrowAdvantage === true
    for (const school of modifiers.spellTargetingImmunitySchools ?? []) {
      spellTargetingImmunitySchools.add(school)
    }
    successfulSpellSaveNegatesDamage ||= modifiers.successfulSpellSaveNegatesDamage === true
    hitPointMaximumReductionImmunity ||= modifiers.hitPointMaximumReductionImmunity === true
    halvesFallingDamage ||= modifiers.halvesFallingDamage === true
    verticalJumpBonusFeet = Math.max(verticalJumpBonusFeet, modifiers.verticalJumpBonusFeet ?? 0)
    magicallyHeldAloft ||= modifiers.magicallyHeldAloft === true
    preventsRangedWeaponAttacks ||= modifiers.preventsRangedWeaponAttacks === true
    concentrationSavingThrowDisadvantage ||= modifiers.concentrationSavingThrowDisadvantage === true
    understandSpoken ||= modifiers.languageCapabilities?.understandSpoken
    speechUnderstoodBy ||= modifiers.languageCapabilities?.speechUnderstoodBy
    if (area.hallow && dnd5eHallowAdditionalEffectAllowsTarget(area, input.token, input.map)) {
      if (area.hallow.additionalEffect === 'courage') conditionImmunities.add('frightened')
      if (area.hallow.additionalEffect === 'energy-protection' && area.hallow.damageType) {
        damageResistances.add(area.hallow.damageType)
      }
      if (area.hallow.additionalEffect === 'energy-vulnerability' && area.hallow.damageType) {
        damageVulnerabilities.add(area.hallow.damageType)
      }
      if (area.hallow.additionalEffect === 'silence') preventsVerbalComponents = true
      if (area.hallow.additionalEffect === 'tongues') {
        understandSpoken = 'all'
        speechUnderstoodBy = 'any-creature-knowing-a-language'
      }
    }
  }
  const skillCheckBonuses: Record<string, number> = {}
  for (const group of skillBonusGroups.values()) for (const [skill, bonus] of Object.entries(group)) skillCheckBonuses[skill] = (skillCheckBonuses[skill] ?? 0) + bonus
  return {
    abilityCheckRules,
    skillCheckBonuses,
    savingThrowAdvantages: [...savingThrowAdvantages],
    preventsVerbalComponents,
    suppressesMagic,
    spellSuppressionAreas,
    damageImmunities: [...damageImmunities],
    damageResistances: [...damageResistances],
    damageVulnerabilities: [...damageVulnerabilities],
    conditionImmunities: [...conditionImmunities],
    conditionSources,
    attacksAgainstOccupantDisadvantageCreatureTypes: [...attacksAgainstOccupantDisadvantageCreatureTypes],
    attacksAgainstOccupantDisadvantageSources,
    conditionImmunitiesBySourceCreatureType,
    savingThrowAdvantagesBySourceCreatureType,
    spellSavingThrowAdvantage,
    spellTargetingImmunitySchools: [...spellTargetingImmunitySchools],
    successfulSpellSaveNegatesDamage,
    hitPointMaximumReductionImmunity,
    halvesFallingDamage,
    verticalJumpBonusFeet,
    magicallyHeldAloft,
    preventsRangedWeaponAttacks,
    concentrationSavingThrowDisadvantage,
    languageCapabilities: understandSpoken || speechUnderstoodBy
      ? { understandSpoken, speechUnderstoodBy }
      : undefined,
  }
}

function movementSourceConditionSatisfied(area: Dnd5ePluginArea, map: BattleMap, token: Token): boolean {
  if (area.movementExcludesSource && token.id === area.sourceTokenId) return false
  if (!area.movementRequiresGroundedSource) return true
  const source = map.tokens.find(token => token.id === area.sourceTokenId)
  if (!source) return false
  const geometry = mapGeometryRuntimeForMap(map.id)
  return Math.abs(mapGeometryTokenElevation(geometry, source) -
    mapGeometryTerrainElevationAtPoint(geometry, source)) <= 1e-4
}

/** Ground cover restricts movement cost only, leaving the area's other triggers unchanged. */
function movementGroundCoverSatisfied(area: Dnd5ePluginArea, map: BattleMap, token: Token, position: {x:number;y:number}): boolean {
  const cover = area.movementGroundCover
  if (!cover) return true
  if (!dnd5ePersistentAreaAllowsTarget({...area, relation:cover.relation}, token, map)) return false
  const geometry=mapGeometryRuntimeForMap(map.id)
  const elevation=mapGeometryTokenElevation(geometry,{...token,...position})
  if(Math.abs(elevation-mapGeometryTerrainElevationAtPoint(geometry,position))>1e-4) return false
  if(dnd5eNormalGroundTerrainAt(map,position,elevation,token)) return false
  const occupied=new Set(tokenOccupiedCellsAt(token,map,position).map(cellKey))
  return map.tokens.some(object=>{
    if(object.type!=='obstacle'||object.dnd5eObjectState?.naturalFeature!==cover.feature) return false
    if(Math.abs(mapGeometryTokenElevation(geometry,object)-mapGeometryTerrainElevationAtPoint(geometry,object))>1e-4) return false
    const objectCells=new Set(tokenOccupiedCellsAt(object,map,object).map(cellKey))
    return persistentAreaHeightSlices(area).some(slice=>slice.cells.some(cell=>{
      if(!occupied.has(cellKey(cell))||!objectCells.has(cellKey(cell)))return false
      const center=tokenCenterForAnchorCell(cell,{size:1},map)
      const ground=mapGeometryTerrainElevationAtPoint(geometry,center)
      const vertical=slice.vertical
      if(vertical?.mode==='volume'){
        const anchor=slice.anchorMode&&slice.anchorMode!=='fixed'?map.tokens.find(t=>t.id===(slice.anchorTokenId??slice.sourceTokenId)):undefined
        const bottom=anchor&&Number.isFinite(vertical.anchorOffsetFeet)?mapGeometryTokenElevation(geometry,anchor)+Number(vertical.anchorOffsetFeet):vertical.baseElevationFeet
        if(ground<bottom-1e-4||ground>=bottom+vertical.heightFeet-1e-4)return false
      }
      return dnd5eTokenIntersectsPersistentAreaAt({...token,size:1},map,slice,center,[cell],ground)
    }))
  })
}

/** Grid-step environmental surcharge; distinct from difficult terrain and speed reduction. */
export function dnd5ePersistentAreaDirectionalMovementCostAt(input: {
  map: BattleMap; token: Token; from: { x: number; y: number }; to: { x: number; y: number }
}): number {
  const dc = input.to.x - input.from.x, dr = input.to.y - input.from.y
  if (Math.hypot(dc, dr) <= 1e-9) return 0
  let additionalFeetPerFoot = 0
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    const rule = area.directionalMovementCost
    if (!rule || dc * rule.direction.dc + dr * rule.direction.dr >= -1e-9 ||
      !movementSourceConditionSatisfied(area, input.map, input.token) ||
      !movementGroundCoverSatisfied(area, input.map, input.token, input.to) ||
      !dnd5ePersistentAreaAllowsTarget(area, input.token, input.map) ||
      !dnd5eTokenIntersectsPersistentAreaAt(input.token, input.map, area, input.to)) continue
    additionalFeetPerFoot = Math.max(additionalFeetPerFoot, rule.additionalFeetPerFoot)
  }
  return additionalFeetPerFoot
}

export function dnd5ePersistentAreaMovementCostMultiplierAt(input: {
  map: BattleMap
  token: Token
  position: { x: number; y: number }
}): number {
  let multiplier = 1
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if (
      (area.coreSpellId === 'web' && dnd5eTokenHasWebWalker(input.token)) ||
      !movementSourceConditionSatisfied(area, input.map, input.token) ||
      !movementGroundCoverSatisfied(area, input.map, input.token, input.position) ||
      (area.movementCostMultiplier ?? 1) <= 1 ||
      (area.vertical?.mode === 'ground' && area.coreSpellId !== 'spirit-guardians' && dnd5eNormalGroundTerrainAt(input.map, input.position, input.token.elevationFeet ?? mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(input.map.id), input.position), input.token)) ||
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
      area.interposition?.mode === 'difficult-terrain' &&
      area.interposition.targetTokenId === input.token.id &&
      dnd5eTokenIntersectsPersistentAreaAnchorTokenAt(input.token, input.map, area, input.position)
    ) {
      multiplier = Math.max(multiplier, 2)
    }
    if (
        area.coreSpellId === 'spirit-guardians' ||
        (area.coreSpellId === 'web' && dnd5eTokenHasWebWalker(input.token)) ||
      !movementSourceConditionSatisfied(area, input.map, input.token) ||
      !movementGroundCoverSatisfied(area, input.map, input.token, input.position) ||
      (area.movementCostMultiplier ?? 1) <= 1 ||
      (area.vertical?.mode === 'ground' && area.coreSpellId !== 'spirit-guardians' && dnd5eNormalGroundTerrainAt(input.map, input.position, input.token.elevationFeet ?? mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(input.map.id), input.position), input.token)) ||
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
      !movementSourceConditionSatisfied(area, input.map, input.token) ||
      !movementGroundCoverSatisfied(area, input.map, input.token, input.position) ||
      (area.movementCostMultiplier ?? 1) <= 1 ||
      (area.vertical?.mode === 'ground' && area.coreSpellId !== 'spirit-guardians' && dnd5eNormalGroundTerrainAt(input.map, input.position, input.token.elevationFeet ?? mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(input.map.id), input.position), input.token)) ||
      !dnd5ePersistentAreaAllowsTarget(area, input.token, input.map) ||
      !dnd5eTokenIntersectsPersistentAreaAt(input.token, input.map, area, input.position)
    ) continue
    multiplier = Math.max(multiplier, area.movementCostMultiplier ?? 1)
  }
  return multiplier
}
