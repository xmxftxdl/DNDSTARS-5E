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
  const anchorToken = input.area.anchorMode === 'source-token' || input.area.anchorMode === 'target-token' || input.area.anchorMode === 'effect-token'
    ? input.map.tokens.find((candidate) =>
        candidate.id === (input.area.anchorTokenId ?? input.area.sourceTokenId))
    : undefined
  const volumeBase = anchorToken && Number.isFinite(vertical.anchorOffsetFeet)
    ? mapGeometryTokenElevation(geometry, anchorToken) + Number(vertical.anchorOffsetFeet)
    : vertical.baseElevationFeet
  const volumeTop = volumeBase + vertical.heightFeet
  const tokenTop = tokenBottom + dnd5eTokenHeightFeet(input.token)
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
  return tokenBottom >= volumeBase - 1e-4 && tokenTop <= volumeBase + vertical.heightFeet + 1e-4
}

/** Merges bounded environmental modifiers from all eligible areas at a token position. */
export function dnd5ePersistentAreaOccupantModifiersAt(input: {
  map: BattleMap
  token: Token
  position: { x: number; y: number }
  elevationFeet?: number
}): {
  preventsVerbalComponents: boolean
  suppressesMagic: boolean
  spellSuppressionAreas: readonly { areaId: string; maximumSpellLevel: number }[]
  damageImmunities: readonly import('./damageTypes').Dnd5eDamageType[]
  damageResistances: readonly import('./damageTypes').Dnd5eDamageType[]
  damageVulnerabilities: readonly import('./damageTypes').Dnd5eDamageType[]
  conditionImmunities: readonly import('./conditions').Dnd5eStandardConditionId[]
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
  magicallyHeldAloft: boolean
  preventsRangedWeaponAttacks: boolean
  concentrationSavingThrowDisadvantage: boolean
  languageCapabilities?: {
    understandSpoken?: 'all'
    speechUnderstoodBy?: 'any-creature-knowing-a-language'
  }
} {
  let preventsVerbalComponents = false
  let suppressesMagic = false
  const spellSuppressionAreas: { areaId: string; maximumSpellLevel: number }[] = []
  const damageImmunities = new Set<import('./damageTypes').Dnd5eDamageType>()
  const damageResistances = new Set<import('./damageTypes').Dnd5eDamageType>()
  const damageVulnerabilities = new Set<import('./damageTypes').Dnd5eDamageType>()
  const conditionImmunities = new Set<import('./conditions').Dnd5eStandardConditionId>()
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
  let magicallyHeldAloft = false
  let preventsRangedWeaponAttacks = false
  let concentrationSavingThrowDisadvantage = false
  let understandSpoken: 'all' | undefined
  let speechUnderstoodBy: 'any-creature-knowing-a-language' | undefined
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if ((!area.occupantModifiers && !area.hallow) ||
      !dnd5ePersistentAreaAllowsTarget(area, input.token, input.map)) continue
    const modifiers = area.occupantModifiers ?? {}
    const contained = modifiers.containment === 'fully-contained'
      ? dnd5eTokenFullyContainedInPersistentAreaAt(
          input.token, input.map, area, input.position, input.elevationFeet,
        )
      : dnd5eTokenIntersectsPersistentAreaAt(
          input.token, input.map, area, input.position, area.cells, input.elevationFeet,
        )
    if (!contained) continue
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
  return {
    preventsVerbalComponents,
    suppressesMagic,
    spellSuppressionAreas,
    damageImmunities: [...damageImmunities],
    damageResistances: [...damageResistances],
    damageVulnerabilities: [...damageVulnerabilities],
    conditionImmunities: [...conditionImmunities],
    attacksAgainstOccupantDisadvantageCreatureTypes: [...attacksAgainstOccupantDisadvantageCreatureTypes],
    attacksAgainstOccupantDisadvantageSources,
    conditionImmunitiesBySourceCreatureType,
    savingThrowAdvantagesBySourceCreatureType,
    spellSavingThrowAdvantage,
    spellTargetingImmunitySchools: [...spellTargetingImmunitySchools],
    successfulSpellSaveNegatesDamage,
    hitPointMaximumReductionImmunity,
    magicallyHeldAloft,
    preventsRangedWeaponAttacks,
    concentrationSavingThrowDisadvantage,
    languageCapabilities: understandSpoken || speechUnderstoodBy
      ? { understandSpoken, speechUnderstoodBy }
      : undefined,
  }
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
      area.interposition?.mode === 'difficult-terrain' &&
      area.interposition.targetTokenId === input.token.id &&
      dnd5eTokenIntersectsPersistentAreaAnchorTokenAt(input.token, input.map, area, input.position)
    ) {
      multiplier = Math.max(multiplier, 2)
    }
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
