import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import {
  DND_FEET_PER_CELL,
  cellKey,
  occupiedCells,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenFootprintDistanceCells,
  tokenOccupiedCellsAt,
} from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { Dnd5eSpellMetamagicPayload, Dnd5eSustainedSpellControlId, Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { AbilityKey } from '../../lib/dnd'
import { aoeOrientFromCell, canPlaceAoe, cellsForAoe, resolveAoeDimensions, tokensInCells } from '../../lib/skillTargeting'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5ePactSlotLevel, type Dnd5eClassId } from './classes'
import {
  dnd5eSpellOriginProjectionForCharacter,
  dnd5eUtilityProjectionAttackAdvantageApplies,
} from './utilityProjection'
import { dnd5eNextD20AdvantageApplies } from './nextD20Advantage'
import {
  dnd5eAttackerIsUnseenForAttack,
  dnd5eBlurImposesAttackDisadvantage,
  dnd5eCombatantPairKey,
  dnd5eCombatantCanSee,
  dnd5eCombatantCanRemainAirborne,
  dnd5eTargetArmorClassForAttack,
  dnd5eTargetIsUnseenForAttack,
  dnd5eCombatantHasConcentrationEffect,
  endDnd5eConcentration,
  dnd5ePendingAllyAttackAdvantage,
  dnd5eSourceMarkedAttackDisadvantage,
  dnd5eFrightenedAttackDisadvantage,
  dnd5eHelpAttackApplies,
  dnd5eRageAllyProtectionDisadvantage,
  dnd5eRageAllyMeleeAdvantage,
  dnd5eTranquilityWardCheck,
  previewDnd5ePostD20AdjustedAttack,
  previewDnd5ePostD20AdjustedSavingThrow,
  previewDnd5eUnsupportedAirborneFalls,
  resolveDnd5eHeadlessAction,
  type Dnd5eAction,
  type Dnd5eActionResult,
  type Dnd5eCuttingWordsUse,
  type Dnd5eCounterspellReaction,
  type Dnd5eSpellInterceptionReaction,
  type Dnd5eDispelMagicCheck,
  type Dnd5eEmpoweredSpellReroll,
  type Dnd5eSpellDamageMaxDieBonusUse,
  type Dnd5eSpellForcedMovement,
  type Dnd5eSpellTeleportDestination,
  type Dnd5eHeadlessCombatState,
  type Dnd5eCombatant,
  type Dnd5eOptionalBonusDieUse,
  type Dnd5ePostD20AdjustmentUse,
  type Dnd5eSpellTargetAttackRoll,
  type Dnd5eSpellTargetSavingThrowRoll,
  type Dnd5eTargetTranquilitySaveRoll,
  type Dnd5eTranquilitySaveRoll,
  type Dnd5eStandAgainstTideUse,
  type Dnd5eOpeningAttackSavingThrowRoll,
  type Dnd5eUnsupportedAirborneFallPreview,
  type Dnd5eDamageMitigationInterruptUse,
  type Dnd5eMountedAttackRedirectUse,
} from './headlessCombatEngine'
import { applyDnd5eAttackCoverOverride, createDnd5eMapCombatSnapshot, dnd5eMapTokenCanThreatenRangedAttacker, dnd5eRequestedInitiativeActorIndex, planDnd5eMapResultApplication, prepareDnd5eExplorationActor, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eCanEmpowerSpell, dnd5eCanOverchannelSpell, dnd5eCanSculptSpell, dnd5eCarefulSpellMaximumTargets, dnd5eCharmPersonEligibleCreatureType, dnd5eDraconicElementalResistanceType, dnd5eFreeSpellCastSource, dnd5eHeightenedSavingThrowMode, dnd5eMetamagicAvailableForSpell, dnd5eMetamagicCost, dnd5eSculptSpellMaximumTargets, dnd5eSpellAreaAtSlot, dnd5eSpellcastingClassIdForSpell, dnd5eSpellAllowsRepeatedTargets, dnd5eSpellAttackDelivery, dnd5eSpellConcentrationDurationRounds, dnd5eSpellDamageDiceCounts, dnd5eSpellDelayedDamageDiceCount, dnd5eSpellDiceCount, dnd5eSpellHigherSlotDamageChoices, dnd5eSpellMaximumTargets, dnd5eSpellProjectileCount, dnd5eSpellSpecificSavingThrowMode, dnd5eSpellUsesSequencedAttacks, dnd5eSrdSpellIsRitual, dnd5eSustainedSpellAttackDiceCount, type Dnd5eSrdSpellDefinition } from './spells'
import {
  dnd5eActiveAttackRollFlags,
  dnd5eActiveSavingThrowBonus,
  dnd5eActiveTargetLinkedAttackRollFlags,
  normalizeDnd5eActiveEffects,
} from './activeEffects'
import { dnd5eWearingUnproficientArmor } from './equipment'
import { imposeDnd5eRollDisadvantage, resolveDnd5eRollMode, type Dnd5eRollModeResolution } from './rollMode'
import {
  dnd5eInstantAoeAffectsTokenVertically,
  dnd5eMapTokenDistanceFeet,
  dnd5eTokenToPointDistanceFeet,
} from './verticalCombatGeometry'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5eIsIncapacitated, dnd5ePreventsAttackAdvantage, dnd5eSavingThrowMode, dnd5eTargetAttackAdvantageReasons, dnd5eTargetIsDodging } from './passiveDefenses'
import { dnd5eConditionSavingThrowAutomaticallyFails } from './conditions'
import {
  mapGeometryCanSeeToken,
  mapGeometryCoverFromPoint,
  mapGeometryLineOfEffectBlocked,
  mapGeometryMovementBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
  type MapGeometryState,
} from '../../lib/mapGeometry'
import { createDnd5eCoreSpellArea, dnd5eWallOfFireDamagingSideCells, getDnd5eCoreSpellAreaDeclaration, moveDnd5eCoreSpellArea, resolveDnd5eCoreSpellLightingConflicts } from './coreSpellAreas'
import { getDnd5eCoreSpellRuntimeDefinitionV1 } from './activities/dnd5eCoreSpellActivities'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { dnd5eCharacterIsBlinded, dnd5eSpellTargetRequiresSight } from './spellVisibility'
import { dnd5eSpellUsesThinWallCells, dnd5eThinWallCells, dnd5eWallOfFireCells, dnd5eWallOfFireDamageCells, normalizeWallOfFireAngle, type Dnd5eWallOfFireGeometry } from './wallOfFireGeometry'
import { dnd5eCharacterClassLevel } from './multiclass'
import { dnd5eEffectiveSpellcastingSource, dnd5eEffectiveSpellcastingSources, dnd5eSpellSchoolIdFromLabel } from './subclassSpellcasting'
import { dnd5eAlternateResourceSpellForCharacter, dnd5ePluginDamageRollMaximizationForCharacter, dnd5ePluginSpellTargetExpansionForCharacter, dnd5eSpellAttackRangeMultiplierForCharacter, type Dnd5eAlternateResourceSpellGrantForCharacter } from './pluginApi'
import { dnd5eSpellSavePressureApplies } from './martialSpellSynergy'
import {
  dnd5eCoreSpellComponentRequirements,
  dnd5eHeldSpellcastingFocusMatches,
  dnd5eSpellComponentCheck,
  dnd5eSpellComponentsAvailable,
} from './spellComponents'
import {
  DND5E_RACIAL_RESOURCE_KEYS,
  dnd5eRacialInnateSpellGrant,
  dnd5eIndependentSpellRulesForCharacter,
  type Dnd5eRacialInnateSpellGrant,
} from './racialAutomation'
import {
  dnd5eOpeningAttackHasAdvantage,
  dnd5eOpeningAttackSavingThrowRequirement,
} from './openingAttack'
import { dnd5eHiddenSpellSaveDisadvantageApplies } from './spellSavePressure'
import { dnd5ePersistentAreaOccupantModifiersAt } from './persistentAreaGeometry'
import type { Dnd5eEffectiveRulesContextV1 } from './effectiveRulesContext'
import {
  applyDnd5eInventoryActivityCosts,
  dnd5eInventoryEntryIsActive,
  dnd5eInventoryEntryUseAction,
  normalizeDnd5eInventory,
  type Dnd5eInventoryActivityCost,
} from './items'
import {
  settleDnd5eSpellMaterialConsumption,
  type Dnd5eSpellMaterialConsumptionPlan,
} from './spellMaterials'
import { dnd5eCombatantCanHearSource } from './audibility'

export type Dnd5eSpellCastRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'invalid-target'
  | 'target-out-of-range'
  | 'effect-line-blocked'
  | 'spell-unavailable'
  | 'spell-definition-unavailable'
  | 'spell-not-known-or-prepared'
  | 'spellcasting-class-unavailable'
  | 'innate-spell-unavailable'
  | 'alternate-spell-unavailable'
  | 'sustained-spell-unavailable'
  | 'item-spell-unavailable'
  | 'item-resource-unavailable'
  | 'wild-shape-spellcasting-unavailable'
  | 'armor-proficiency-required'
  | 'component-unavailable'
  | 'verbal-component-unavailable'
  | 'somatic-component-unavailable'
  | 'material-component-unavailable'
  | 'costly-material-unavailable'
  | 'spell-reaction-only'
  | 'ritual-unavailable'
  | 'spell-option-required'
  | 'spell-environment-unavailable'
  | 'spell-target-count-invalid'
  | 'spell-area-target-required'
  | 'spell-area-target-out-of-bounds'
  | 'spell-area-target-out-of-range'
  | 'spell-area-orientation-invalid'
  | 'spell-target-not-visible'
  | 'slot-unavailable'
  | 'combatant-missing'

export interface PreparedDnd5eSpellCast {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  focusItemInstanceId?: string
  spellMaterialPlan?: Dnd5eSpellMaterialConsumptionPlan
  itemSpellSource?: {
    instanceId: string
    useActionId?: string
    itemName: string
    expectedInventoryRevision: number
    costs: readonly Dnd5eInventoryActivityCost[]
    economy: 'action' | 'bonusAction' | 'none'
  }
  castingClassId?: Dnd5eClassId
  racialInnate: boolean
  racialGrant?: Dnd5eRacialInnateSpellGrant
  alternateResourceSpell?: Dnd5eAlternateResourceSpellGrantForCharacter
  /** Host-validated ritual cast: base spell effect, no action or slot cost. */
  ritual?: true
  spellcastingAbility: keyof Character['abilities']
  spellAttackModifier: number
  spellSaveDc: number
  castingClassLevel: number
  actorToken: Token
  targetToken: Token
  targetTokens: readonly Token[]
  guessedTargetCell?: { col: number; row: number }
  blindTargetMiss: boolean
  /** Host-bound mapped Arcane Lock selected by Dispel Magic's guessed cell. */
  projectileTargetIds?: readonly string[]
  spell: Dnd5eSrdSpellDefinition
  /** Unified Content definition selected by the Host for this transaction. */
  activity: Dnd5eActivityDefinitionV1
  slotLevel: number
  diceCount: number
  damageDiceCounts: readonly number[]
  delayedDamageDiceCount: number
  higherSlotDamageType?: NonNullable<SharedPlayerActionState['dnd5eSpellCast']>['higherSlotDamageType']
  effectBonus: number
  attackMode?: 'normal' | 'advantage' | 'disadvantage'
  attackModeResolution?: Dnd5eRollModeResolution
  targetSpellAttacks?: readonly {
    targetToken: Token
    mode: 'normal' | 'advantage' | 'disadvantage'
    modeResolution?: Dnd5eRollModeResolution
    armorClass: number
    openingAttackSavingThrow?: PreparedDnd5eOpeningAttackSavingThrow
  }[]
  openingAttackSavingThrow?: PreparedDnd5eOpeningAttackSavingThrow
  attackBlessed: boolean
  attackBaned: boolean
  savingThrow?: { modifier: number; dc: number; mode: 'normal' | 'advantage' | 'disadvantage' }
  savingThrowBlessed: boolean
  savingThrowBaned: boolean
  targetSavingThrows?: readonly {
    targetToken: Token
    modifier: number
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
  }[]
  tranquilityWard?: ReturnType<typeof dnd5eTranquilityWardCheck>
  targetTranquilityWards?: readonly {
    targetToken: Token
    ward: NonNullable<ReturnType<typeof dnd5eTranquilityWardCheck>>
  }[]
  overchannel: boolean
  damageMaximizationFeatureId?: string
  maximizedDamage: boolean
  overchannelSelfDamageDiceCount: number
  sculptedTargetIds: readonly string[]
  metamagic?: Dnd5eSpellMetamagicPayload
  empowered: boolean
  carefulTargetIds: readonly string[]
  draconicResistance: boolean
  repellingBlast: boolean
  conditionChoice?: 'blinded' | 'deafened' | 'paralyzed' | 'poisoned' | 'disease'
  effectDamageType?: NonNullable<SharedPlayerActionState['dnd5eSpellCast']>['effectDamageType']
  enlargeReduceChoice?: NonNullable<SharedPlayerActionState['dnd5eSpellCast']>['enlargeReduceChoice']
  enhanceAbilityChoice?: NonNullable<SharedPlayerActionState['dnd5eSpellCast']>['enhanceAbilityChoice']
  calmEmotionsMode?: NonNullable<SharedPlayerActionState['dnd5eSpellCast']>['calmEmotionsMode']
  calmEmotionsIndifferenceScope?: NonNullable<SharedPlayerActionState['dnd5eSpellCast']>['calmEmotionsIndifferenceScope']
  healingAllocations?: readonly { targetId: string; amount: number }[]
  areaCells?: readonly { col: number; row: number }[]
  areaAnchorCell?: { col: number; row: number }
  areaAnchorCells?: readonly { col: number; row: number }[]
  dancingLightsForm?: 'lights' | 'humanoid'
  areaTargetOrientation?: 0 | 1 | 2 | 3
  wallOfFireGeometry?: Dnd5eWallOfFireGeometry
  excludedAreaTargetIds: readonly string[]
  areaDurationRounds?: number
  teleportDestination?: Dnd5eSpellTeleportDestination
  /** 当前事务是在使用既有持续法术效果，而不是再次施法。 */
  sustainedEffectAttack?: Dnd5eSustainedSpellControlId
  sustainedEffectAreaId?: string
}

export interface PreparedDnd5eOpeningAttackSavingThrow {
  featureId: string
  ability: keyof Character['abilities']
  dc: number
  modifier: number
  mode: 'normal' | 'advantage' | 'disadvantage'
  blessed: boolean
  baned: boolean
  failureDamageMultiplier: number
}

/**
 * Finds the furthest legal grid destination for movement directly away from
 * a source. Map bounds, movement geometry and occupied cells truncate the
 * requested distance at the first illegal step.
 */
export function dnd5eForcedPushDestination(
  map: BattleMap,
  actor: Token,
  target: Token,
  maximumDistanceFeet: number,
): { to: { x: number; y: number }; distanceFeet: number } {
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  const maximumSteps = Number.isFinite(maximumDistanceFeet)
    ? Math.max(0, Math.floor(maximumDistanceFeet / feetPerCell))
    : 0
  const actorAnchor = tokenAnchorCellFromPixel(actor.x, actor.y, actor, map)
  const targetAnchor = tokenAnchorCellFromPixel(target.x, target.y, target, map)
  const dc = Math.sign(targetAnchor.col - actorAnchor.col)
  const dr = Math.sign(targetAnchor.row - actorAnchor.row)
  if (maximumSteps < 1 || (dc === 0 && dr === 0)) return { to: { x: target.x, y: target.y }, distanceFeet: 0 }
  const blocked = occupiedCells(map.tokens, map, target.id)
  const columns = Math.max(1, Math.floor((map.width - map.gridOffsetX) / Math.max(1, map.gridSize)))
  const rows = Math.max(1, Math.floor((map.height - map.gridOffsetY) / Math.max(1, map.gridSize)))
  let destination = { x: target.x, y: target.y }
  let steps = 0
  const geometry = mapGeometryRuntimeForMap(map.id)
  for (let step = 1; step <= maximumSteps; step += 1) {
    const anchor = { col: targetAnchor.col + dc * step, row: targetAnchor.row + dr * step }
    const position = tokenCenterForAnchorCell(anchor, target, map)
    const footprint = tokenOccupiedCellsAt(target, map, position)
    if (footprint.some((cell) =>
      cell.col < 0 || cell.row < 0 || cell.col >= columns || cell.row >= rows || blocked.has(cellKey(cell)),
    )) break
    if (mapGeometryMovementBlocked({
      geometry, map, token: { ...target, ...destination }, to: position,
    }).blocked) break
    destination = position
    steps = step
  }
  return { to: destination, distanceFeet: steps * feetPerCell }
}

/**
 * Finds the furthest legal grid destination for movement directly toward a
 * source. The source itself remains occupied, so a pulled creature stops in
 * the nearest legal space instead of overlapping it.
 */
export function dnd5eForcedPullDestination(
  map: BattleMap,
  actor: Token,
  target: Token,
  maximumDistanceFeet: number,
): { to: { x: number; y: number }; distanceFeet: number } {
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  const maximumSteps = Number.isFinite(maximumDistanceFeet)
    ? Math.max(0, Math.floor(maximumDistanceFeet / feetPerCell))
    : 0
  const actorAnchor = tokenAnchorCellFromPixel(actor.x, actor.y, actor, map)
  const targetAnchor = tokenAnchorCellFromPixel(target.x, target.y, target, map)
  const dc = Math.sign(actorAnchor.col - targetAnchor.col)
  const dr = Math.sign(actorAnchor.row - targetAnchor.row)
  if (maximumSteps < 1 || (dc === 0 && dr === 0)) {
    return { to: { x: target.x, y: target.y }, distanceFeet: 0 }
  }
  const blocked = occupiedCells(map.tokens, map, target.id)
  const columns = Math.max(
    1,
    Math.floor((map.width - map.gridOffsetX) / Math.max(1, map.gridSize)),
  )
  const rows = Math.max(
    1,
    Math.floor((map.height - map.gridOffsetY) / Math.max(1, map.gridSize)),
  )
  let destination = { x: target.x, y: target.y }
  let steps = 0
  const geometry = mapGeometryRuntimeForMap(map.id)
  for (let step = 1; step <= maximumSteps; step += 1) {
    const anchor = {
      col: targetAnchor.col + dc * step,
      row: targetAnchor.row + dr * step,
    }
    const position = tokenCenterForAnchorCell(anchor, target, map)
    const footprint = tokenOccupiedCellsAt(target, map, position)
    if (footprint.some((cell) =>
      cell.col < 0 ||
      cell.row < 0 ||
      cell.col >= columns ||
      cell.row >= rows ||
      blocked.has(cellKey(cell)),
    )) break
    if (mapGeometryMovementBlocked({
      geometry,
      map,
      token: { ...target, ...destination },
      to: position,
    }).blocked) break
    destination = position
    steps = step
  }
  return { to: destination, distanceFeet: steps * feetPerCell }
}

export function dnd5eRepellingBlastPushDestination(
  map: BattleMap,
  actor: Token,
  target: Token,
): { to: { x: number; y: number }; distanceFeet: number } {
  return dnd5eForcedPushDestination(map, actor, target, 10)
}

/**
 * Resolves whether a forced horizontal move actually carries a creature off
 * the ground it was standing on. A lower terrain value alone is insufficient:
 * airborne or otherwise unsupported tokens require DM adjudication instead.
 */
export function dnd5eForcedMovementFall(input: {
  geometry?: MapGeometryState
  target: Pick<Token, 'x' | 'y' | 'elevationFeet'>
  targetCombatant?: Dnd5eCombatant
  to: { x: number; y: number }
}): {
  sourceElevationFeet: number
  sourceGroundElevationFeet: number
  landingGroundElevationFeet: number
  groundedAtSource: boolean
  canRemainAirborne: boolean
  fallDistanceFeet: number
  toElevationFeet?: number
} {
  const sourceGroundElevationFeet = mapGeometryTerrainElevationAtPoint(input.geometry, input.target, 0)
  const sourceElevationFeet = mapGeometryTokenElevation(input.geometry, input.target)
  const landingGroundElevationFeet = mapGeometryTerrainElevationAtPoint(input.geometry, input.to, 0)
  const groundedAtSource = Math.abs(sourceElevationFeet - sourceGroundElevationFeet) <= 1e-4
  const canRemainAirborne = input.targetCombatant != null &&
    dnd5eCombatantCanRemainAirborne(input.targetCombatant)
  const fallDistanceFeet = groundedAtSource && !canRemainAirborne
    ? Math.max(0, sourceElevationFeet - landingGroundElevationFeet)
    : 0
  return {
    sourceElevationFeet,
    sourceGroundElevationFeet,
    landingGroundElevationFeet,
    groundedAtSource,
    canRemainAirborne,
    fallDistanceFeet,
    toElevationFeet: fallDistanceFeet > 0 ? landingGroundElevationFeet : undefined,
  }
}

export function prepareDnd5eSpellCast(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
  effectiveRules?: Dnd5eEffectiveRulesContextV1 | null
}): { ok: true; prepared: PreparedDnd5eSpellCast } | { ok: false; reason: Dnd5eSpellCastRejectReason } {
  const payload = input.action.dnd5eSpellCast
  if (input.action.type !== 'dnd5e-spell-cast' || !payload) return { ok: false, reason: 'invalid-action' }
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === input.action.actorTokenId && token.characterId === input.action.characterId)
  const runtimeDefinition = getDnd5eCoreSpellRuntimeDefinitionV1(payload.spellId)
  const spell = runtimeDefinition?.spell
  const enforceSpellcastingPrerequisites =
    input.effectiveRules?.houseRules.spellcastingPrerequisitesEnabled !== false
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  if (!spell) return { ok: false, reason: 'spell-definition-unavailable' }
  if (dnd5eCharacterIsBlinded(actor) && dnd5eSpellTargetRequiresSight({
    requiresVisibleTarget: spell.requiresVisibleTarget,
    activityTarget: runtimeDefinition.activity.target,
  })) return { ok: false, reason: 'spell-target-not-visible' }
  const dancingLightsForm = spell.id === 'dancing-lights'
    ? payload.dancingLightsForm ?? 'lights'
    : undefined
  if (
    (payload.dancingLightsForm != null && spell.id !== 'dancing-lights') ||
    (dancingLightsForm != null && dancingLightsForm !== 'lights' && dancingLightsForm !== 'humanoid')
  ) return { ok: false, reason: 'invalid-action' }
  const defeatedCharacterIds = new Set(input.characters.flatMap((character) =>
    character.currentHp <= 0 && character.dnd5eCombatState?.deathRound != null
      ? [character.id]
      : [],
  ))
  const isDefeatedAreaToken = (candidate: Token) =>
    (candidate.hp ?? candidate.maxHp ?? 1) <= 0 && (
      candidate.type === 'enemy' ||
      (candidate.characterId != null && defeatedCharacterIds.has(candidate.characterId))
    )
  const isCalmEmotionsHumanoidToken = (candidate: Token) => {
    if (candidate.creatureTypes?.length) {
      return candidate.creatureTypes.some((type) => dnd5eCharmPersonEligibleCreatureType(type))
    }
    // SRD player characters are humanoids unless the authoritative token
    // projection explicitly carries a different creature taxonomy.
    return candidate.characterId != null && input.characters.some((character) => character.id === candidate.characterId)
  }
  if (Object.values(actor.dnd5eCombatState?.declarativeSpellInterceptionLocks ?? {})
    .some((lock) => lock.roundsRemaining > 0 && lock.spellId === spell.id)) {
    return { ok: false, reason: 'spell-unavailable' }
  }
  if (enforceSpellcastingPrerequisites && !payload.sustainedEffectAttack && dnd5eWearingUnproficientArmor(actor)) {
    return { ok: false, reason: 'armor-proficiency-required' }
  }
  const sustainedEffectAttack = payload.sustainedEffectAttack
  const sustainedAttack = sustainedEffectAttack && spell.sustainedAttack?.id === sustainedEffectAttack
    ? spell.sustainedAttack
    : undefined
  if ((sustainedEffectAttack != null) !== (sustainedAttack != null)) {
    return { ok: false, reason: 'invalid-action' }
  }
  const sustainedUsesArea = sustainedAttack?.origin === 'effect-token' ||
    sustainedAttack?.origin === 'persistent-area'
  const sustainedEffectAreaId = sustainedUsesArea
    ? payload.sustainedEffectAreaId
    : undefined
  if (
    (sustainedUsesArea && !sustainedEffectAreaId) ||
    (!sustainedUsesArea && payload.sustainedEffectAreaId != null)
  ) return { ok: false, reason: 'invalid-action' }
  const sustainedArea = sustainedEffectAreaId
    ? input.map.dnd5ePluginAreas?.find((area) =>
        area.id === sustainedEffectAreaId &&
        area.sourceKind === 'core-spell' &&
        area.coreSpellId === spell.id &&
        area.sourceCharacterId === actor.id &&
        area.sourceTokenId === actorToken.id &&
        area.anchorMode === (sustainedAttack?.origin === 'effect-token' ? 'effect-token' : 'fixed') &&
        (sustainedAttack?.origin !== 'effect-token' || !!area.anchorTokenId) &&
        !!area.anchorCell &&
        Number.isInteger(area.slotLevel) &&
        input.action.round <= area.expiresAfterRound,
      )
    : undefined
  const sustainedEffect = sustainedAttack
    ? normalizeDnd5eActiveEffects(actor.dnd5eCombatState?.activeEffects).find((effect) =>
        effect.source.kind === 'spell' &&
        effect.source.actorId === actorToken.id &&
        effect.source.rulesId === spell.id &&
        effect.definitionId === `srd-5.1:spell:${spell.id}` &&
        (sustainedAttack.origin === 'caster' || sustainedAttack.origin === 'persistent-area'
          ? spell.concentration
            ? effect.duration.type === 'concentration' && effect.duration.sourceActorId === actorToken.id
            : effect.duration.type !== 'concentration'
          : effect.duration.type === 'rounds' && effect.stackingKey === sustainedEffectAreaId),
      )
    : undefined
  if (
    sustainedAttack && (
      !sustainedEffect || !Number.isInteger(sustainedEffect.potency) ||
      sustainedEffect.potency! < spell.level || sustainedEffect.potency! > 9 ||
      (sustainedAttack.origin === 'effect-token' && (
        !sustainedArea || sustainedArea.slotLevel !== sustainedEffect.potency ||
        !input.map.tokens.some((token) =>
          token.id === sustainedArea.anchorTokenId &&
          token.dnd5eSpellEffect?.spellId === spell.id &&
          token.dnd5eSpellEffect?.sourceCharacterId === actor.id &&
          token.dnd5eSpellEffect?.sourceTokenId === actorToken.id
        )
      )) ||
      (sustainedAttack.origin === 'persistent-area' && (
        !sustainedArea || sustainedArea.slotLevel !== sustainedEffect.potency ||
        sustainedArea.concentrationId !== spell.id ||
        actor.dnd5eCombatState?.concentrationSpellId !== spell.id
      ))
    )
  ) return { ok: false, reason: 'sustained-spell-unavailable' }
  const authorizedSustainedEffectAreaId = spell.sustainedAttack?.origin === 'effect-token'
    ? sustainedEffectAreaId ?? `core-spell-area:${input.action.id}`
    : sustainedAttack?.origin === 'persistent-area'
      ? sustainedEffectAreaId
    : undefined
  const sustainedAreaMovement = sustainedAttack?.origin === 'effect-token' && sustainedArea && payload.areaTargetCell
    ? moveDnd5eCoreSpellArea({
        map: input.map,
        geometry: mapGeometryRuntimeForMap(input.map.id),
        areaId: sustainedArea.id,
        sourceTokenId: actorToken.id,
        targetCell: payload.areaTargetCell,
      })
    : undefined
  if (sustainedArea && !payload.areaTargetCell) return { ok: false, reason: 'invalid-target' }
  if (sustainedAreaMovement && !sustainedAreaMovement.ok) {
    return {
      ok: false,
      reason: sustainedAreaMovement.reason === 'target-out-of-range'
        ? 'target-out-of-range'
        : 'invalid-target',
    }
  }
  const inventory = normalizeDnd5eInventory(actor)
  // Spell-driven inventory-object targeting is intentionally unsupported.
  // Object semantics are described over the room voice channel.
  if (payload.targetInventoryInstanceId != null) return { ok: false, reason: 'invalid-target' }
  const itemEntry = payload.itemInstanceId
    ? inventory.entries.find((entry) => entry.instanceId === payload.itemInstanceId)
    : undefined
  const itemUse = itemEntry ? dnd5eInventoryEntryUseAction(itemEntry, payload.itemUseActionId) : undefined
  const itemSpellEffect = itemUse?.effect.kind === 'spell-cast'
    ? itemUse.effect
    : undefined
  const itemSpellcastingSources = itemSpellEffect?.spellcastingClassIds?.length
    ? dnd5eEffectiveSpellcastingSources(actor).filter((source) =>
        itemSpellEffect.spellcastingClassIds!.includes(source.spellListClassId),
      )
    : dnd5eEffectiveSpellcastingSources(actor)
  if (payload.itemInstanceId && (
    !itemEntry || !itemSpellEffect || itemEntry.quantity < 1 ||
    itemEntry.identified === false || !dnd5eInventoryEntryIsActive(itemEntry) ||
    (itemEntry.item.equipment != null && itemEntry.equippedSlot == null) ||
    itemSpellEffect.spellId !== spell.id || itemSpellEffect.castAtLevel !== payload.slotLevel ||
    (spell.effect === 'spell-attack' && itemSpellEffect.spellAttackBonus == null && itemSpellEffect.useCharacterSpellcasting !== true) ||
    ((spell.saveAbility != null || spell.unwillingSaveAbility != null) && itemSpellEffect.spellSaveDc == null && itemSpellEffect.useCharacterSpellcasting !== true) ||
    (itemSpellEffect.spellcastingClassIds?.length && itemSpellcastingSources.length < 1) ||
    payload.castingClassId != null || payload.racialInnate === true || sustainedAttack != null
    || payload.alternateResourceSpell != null
  )) return { ok: false, reason: 'item-spell-unavailable' }
  if (payload.itemInstanceId != null && payload.focusItemInstanceId != null) {
    return { ok: false, reason: 'invalid-action' }
  }
  const itemSpellCosts: Dnd5eInventoryActivityCost[] = itemUse
    ? [
        ...(itemUse.consumeQuantity > 0
          ? [{ kind: 'quantity' as const, amount: itemUse.consumeQuantity }]
          : []),
        ...(itemUse.resourceCost
          ? [{ kind: 'resource' as const, ...itemUse.resourceCost }]
          : []),
      ]
    : []
  if (itemEntry && itemSpellEffect) {
    const quantityCost = itemSpellCosts
      .filter((cost) => cost.kind === 'quantity')
      .reduce((sum, cost) => sum + cost.amount, 0)
    const insufficientResource = itemSpellCosts.some((cost) =>
      cost.kind === 'resource' && (itemEntry.resources?.[cost.resourceId]?.current ?? 0) < cost.amount,
    )
    if (quantityCost > itemEntry.quantity || insufficientResource) {
      return { ok: false, reason: 'item-resource-unavailable' }
    }
  }
  const itemSpellSource = itemEntry && itemSpellEffect ? {
    instanceId: itemEntry.instanceId,
    ...(payload.itemUseActionId ? { useActionId: payload.itemUseActionId } : {}),
    itemName: itemEntry.item.name,
    expectedInventoryRevision: inventory.revision ?? 0,
    costs: itemSpellCosts,
    economy: itemUse!.economy,
  } : undefined
  const racialGrant = !itemSpellSource && payload.racialInnate
    ? dnd5eRacialInnateSpellGrant(dnd5eIndependentSpellRulesForCharacter(actor), spell.id)
    : undefined
  if (payload.racialInnate === true && (
    !racialGrant ||
    payload.castingClassId != null ||
    payload.slotLevel !== racialGrant.castAtLevel || payload.alternateResourceSpell != null
  )) {
    return { ok: false, reason: 'innate-spell-unavailable' }
  }
  const alternateResourceSpell = !itemSpellSource && !racialGrant && payload.alternateResourceSpell
    ? dnd5eAlternateResourceSpellForCharacter({
        character: actor,
        featureId: payload.alternateResourceSpell.featureId,
        grantId: payload.alternateResourceSpell.grantId,
        spellId: spell.id,
        slotLevel: payload.slotLevel,
      })
    : undefined
  if (payload.alternateResourceSpell != null && (
    !alternateResourceSpell || payload.castingClassId != null || payload.racialInnate === true ||
    sustainedAttack != null
  )) return { ok: false, reason: 'alternate-spell-unavailable' }
  const temporarySpellAccess = !itemSpellSource && !racialGrant && !alternateResourceSpell
    ? Object.values(actor.dnd5eCombatState?.declarativeSpellInterceptionGrants ?? {})
        .find((grant) => grant.roundsRemaining > 0 && grant.spellId === spell.id &&
          (payload.castingClassId == null || payload.castingClassId === grant.castingClassId))
    : undefined
  const castingClassId = !itemSpellSource && !racialGrant && !alternateResourceSpell
    ? temporarySpellAccess?.castingClassId ??
      dnd5eSpellcastingClassIdForSpell(actor, spell.id, payload.castingClassId, spell.classes)
    : undefined
  if (!itemSpellSource && !racialGrant && !alternateResourceSpell && !castingClassId) {
    return { ok: false, reason: 'spell-not-known-or-prepared' }
  }
  const focusItemInstanceId = payload.focusItemInstanceId
  if (focusItemInstanceId != null && (
    itemSpellSource != null || racialGrant != null || alternateResourceSpell != null || sustainedAttack != null ||
    !dnd5eHeldSpellcastingFocusMatches(actor, focusItemInstanceId, castingClassId)
  )) {
    return { ok: false, reason: 'component-unavailable' }
  }
  const castingSource = castingClassId
    ? dnd5eEffectiveSpellcastingSource(actor, castingClassId)
    : undefined
  const definition = castingSource?.definition
  const castingClassLevel = itemSpellSource
    ? actor.level
    : racialGrant
    ? actor.level
    : alternateResourceSpell
    ? dnd5eCharacterClassLevel(actor, alternateResourceSpell.classId)
    : castingClassId ? dnd5eCharacterClassLevel(actor, castingClassId) : 0
  const itemSpellcastingAbility = itemSpellSource && itemSpellEffect?.useCharacterSpellcasting === true
    ? itemSpellcastingSources
        .flatMap((source) => source.definition.spellcasting?.ability ? [source.definition.spellcasting.ability] : [])
        .sort((left, right) =>
          rules.abilityModifier(actor.abilities[right]) - rules.abilityModifier(actor.abilities[left]))[0]
    : undefined
  const spellcastingAbility = itemSpellSource
    ? itemSpellEffect?.useCharacterSpellcasting === true ? itemSpellcastingAbility : 'int' as const
    : racialGrant?.ability ?? alternateResourceSpell?.ability ?? definition?.spellcasting?.ability
  if (
    !spellcastingAbility ||
    (!itemSpellSource && !racialGrant && !alternateResourceSpell && (!definition?.spellcasting || castingClassLevel < 1))
  ) {
    return { ok: false, reason: 'spellcasting-class-unavailable' }
  }
  const druidLevel = dnd5eCharacterClassLevel(actor, 'druid')
  if (
    enforceSpellcastingPrerequisites && actor.dnd5eCombatState?.wildShapeFormId &&
    (alternateResourceSpell != null || druidLevel < 18)
  ) {
    return { ok: false, reason: 'wild-shape-spellcasting-unavailable' }
  }
  if (spell.castingTime === 'reaction') return { ok: false, reason: 'spell-reaction-only' }
  let spellMaterialPlan: Dnd5eSpellMaterialConsumptionPlan | undefined
  if (
    enforceSpellcastingPrerequisites && (!racialGrant || racialGrant.requiresComponents === true) && !sustainedAttack &&
    (!itemSpellSource || itemSpellEffect?.requiresComponents === true)
  ) {
    const areaModifiers = dnd5ePersistentAreaOccupantModifiersAt({
      map: input.map,
      token: actorToken,
      position: actorToken,
    })
    const componentCheck = dnd5eSpellComponentCheck(
      areaModifiers.preventsVerbalComponents
        ? { ...actor, conditions: [...actor.conditions, 'silenced'] }
        : actor,
      dnd5eCoreSpellComponentRequirements(spell.id),
      castingClassId,
    )
    const componentsAvailable = dnd5eSpellComponentsAvailable(componentCheck) || (
      alternateResourceSpell?.ignoreMaterialComponents === true &&
      componentCheck.verbal !== 'unavailable-silenced' &&
      componentCheck.somatic !== 'unavailable-hands-occupied'
    )
    if (!componentsAvailable) {
      if (componentCheck.verbal === 'unavailable-silenced') {
        return { ok: false, reason: 'verbal-component-unavailable' }
      }
      if (componentCheck.somatic === 'unavailable-hands-occupied') {
        return { ok: false, reason: 'somatic-component-unavailable' }
      }
      if (componentCheck.material === 'missing-focus-or-pouch') {
        return { ok: false, reason: 'material-component-unavailable' }
      }
      if (
        componentCheck.material === 'missing-specific-material' ||
        componentCheck.material === 'unsupported-costly-material'
      ) {
        return { ok: false, reason: 'costly-material-unavailable' }
      }
      if (componentCheck.material === 'specific-material-hands-occupied') {
        return { ok: false, reason: 'material-component-unavailable' }
      }
      return { ok: false, reason: 'component-unavailable' }
    }
    if (alternateResourceSpell?.ignoreMaterialComponents !== true) {
      spellMaterialPlan = componentCheck.materialPlan
    }
  }
  if (
    enforceSpellcastingPrerequisites && spell.id === 'instant-summons' &&
    !inventory.entries.some((entry) =>
      entry.quantity > 0 && entry.linkedSpellFocusAuthorityRecordId == null &&
      entry.item.spellcastingMaterial?.tags.includes('sapphire') === true &&
      (entry.item.spellcastingMaterial.unitValueGp ?? 0) >= 1_000)
  ) {
    return { ok: false, reason: 'costly-material-unavailable' }
  }

  const slotLevel = sustainedAttack
    ? sustainedEffect!.potency!
    : itemSpellSource
      ? itemSpellEffect!.castAtLevel
    : racialGrant
      ? racialGrant.castAtLevel
    : alternateResourceSpell
      ? payload.slotLevel
    : spell.level === 0
    ? 0
    : definition!.spellcasting!.kind === 'pact' && spell.level <= 5
      ? dnd5ePactSlotLevel(castingClassLevel)
      : payload.slotLevel
  const ritual = payload.ritual === true
  if (ritual && (
    !dnd5eSrdSpellIsRitual(spell.id) ||
    spell.level < 1 || payload.slotLevel !== spell.level || slotLevel !== spell.level ||
    definition?.spellcasting?.ritualCasting !== true ||
    itemSpellSource != null || racialGrant != null || alternateResourceSpell != null || sustainedAttack != null ||
    payload.metamagic != null || payload.overchannel === true || payload.empowered === true ||
    payload.damageMaximizationFeatureId != null || payload.draconicResistance === true ||
    payload.repellingBlast === true
  )) return { ok: false, reason: 'ritual-unavailable' }
  const higherSlotDamageChoices = dnd5eSpellHigherSlotDamageChoices(spell, slotLevel)
  if (
    (higherSlotDamageChoices.length > 0 && !payload.higherSlotDamageType) ||
    (payload.higherSlotDamageType != null && !higherSlotDamageChoices.includes(payload.higherSlotDamageType))
  ) return { ok: false, reason: 'spell-option-required' }
  if (!sustainedAttack && !itemSpellSource && alternateResourceSpell) {
    const option = alternateResourceSpell.castLevelOptions.find((candidate) =>
      candidate.slotLevel === slotLevel)
    const resource = actor.classResources?.[alternateResourceSpell.resourceId]
    if (!option || !resource || resource.current < option.resourceCost) {
      return { ok: false, reason: 'slot-unavailable' }
    }
  } else if (spell.level > 0 && !sustainedAttack && !itemSpellSource && !ritual) {
    const resourceKey = racialGrant
      ? DND5E_RACIAL_RESOURCE_KEYS.innateSpell(spell.id)
      : definition!.spellcasting!.kind === 'pact' && spell.level <= 5
        ? 'dnd5e-pact-slot'
        : `dnd5e-spell-slot-${slotLevel}`
    const slot = actor.classResources?.[resourceKey]
    const freeCastSource = racialGrant ? undefined : dnd5eFreeSpellCastSource({
      classId: definition!.id,
      level: castingClassLevel,
      classSelections: actor.dnd5eClassChoices?.classes?.[definition!.id]?.selections ?? {},
      classResources: actor.classResources ?? {},
    }, spell, slotLevel)
    if (
      !Number.isInteger(slotLevel) || slotLevel < spell.level ||
      (!freeCastSource && (!slot || slot.current < 1)) ||
      (racialGrant && racialGrant.resetOn !== 'long-rest')
    ) return { ok: false, reason: 'slot-unavailable' }
  }
  if (
    (racialGrant || itemSpellSource || alternateResourceSpell) && (
      payload.overchannel === true ||
      payload.damageMaximizationFeatureId != null ||
      payload.empowered === true ||
      payload.draconicResistance === true ||
      payload.repellingBlast === true ||
      payload.metamagic != null ||
      sustainedAttack != null
    )
  ) return { ok: false, reason: 'invalid-action' }
  const overchannel = payload.overchannel === true
  if (sustainedAttack && (
    overchannel || payload.damageMaximizationFeatureId != null || payload.empowered || payload.draconicResistance || payload.repellingBlast ||
    payload.metamagic || payload.higherSlotDamageType || payload.conditionChoice ||
    payload.effectDamageType || payload.enlargeReduceChoice || payload.enhanceAbilityChoice ||
    payload.calmEmotionsMode || payload.calmEmotionsIndifferenceScope ||
    payload.healingAllocations?.length ||
    (sustainedAttack.origin === 'caster' && !spell.area && payload.areaTargetCell) ||
    payload.areaTargetOrientation != null || payload.wallOfFireShape != null ||
    payload.areaTargetRadiusFeet != null || payload.areaTargetWidthFeet != null ||
    payload.areaTargetHeightFeet != null || payload.areaTargetLengthFeet != null ||
    payload.wallOfFireAngleDegrees != null || payload.wallOfFireDamagingSide != null ||
    payload.wallOfFireLengthFeet != null || payload.wallOfFireDiameterFeet != null ||
    payload.bladeBarrierShape != null || payload.bladeBarrierAngleDegrees != null ||
    payload.bladeBarrierLengthFeet != null || payload.bladeBarrierDiameterFeet != null ||
    payload.projectileTargetIds?.length || payload.sculptedTargetIds?.length ||
    (sustainedAttack.resolution !== 'saving-throw' && (payload.targetTokenIds?.length ?? 0) > 1)
  )) return { ok: false, reason: 'invalid-action' }
  if (overchannel && !dnd5eCanOverchannelSpell({
    classId: definition?.id,
    subclassId: definition ? actor.dnd5eClassChoices?.classes?.[definition.id]?.subclass : undefined,
    level: castingClassLevel,
  }, spell, slotLevel)) return { ok: false, reason: 'invalid-action' }
  const selectedDamageType = payload.higherSlotDamageType ?? payload.effectDamageType ?? spell.damageType
  const damageMaximizationFeature = !itemSpellSource && !racialGrant && !sustainedAttack
    ? dnd5ePluginDamageRollMaximizationForCharacter({
        character: actor,
        featureId: payload.damageMaximizationFeatureId,
        delivery: 'spell',
        damageType: selectedDamageType,
      })
    : undefined
  if ((payload.damageMaximizationFeatureId != null) !== (damageMaximizationFeature != null) ||
    (damageMaximizationFeature != null && (
      overchannel || spell.delayedDamage != null ||
      (spell.additionalDamageComponents?.length ?? 0) > 0 ||
      ['healing', 'fixed-healing', 'healing-pool'].includes(spell.effect)
    ))) return { ok: false, reason: 'invalid-action' }
  const maximizedDamage = overchannel || damageMaximizationFeature != null
  const overchannelUses = Math.max(0, Math.floor(actor.dnd5eCombatState?.overchannelUsesSinceLongRest ?? 0))
  const overchannelSelfDamageDiceCount = overchannel && overchannelUses > 0
    ? (overchannelUses + 1) * slotLevel
    : 0
  const metamagic = payload.metamagic
  const classSelections = definition
    ? actor.dnd5eClassChoices?.classes?.[definition.id]?.selections ?? {}
    : {}
  const sorceryPoints = actor.classResources?.['dnd5e-sorcery-points']
  const metamagicCost = metamagic ? dnd5eMetamagicCost(metamagic.kind, slotLevel) : 0
  if (metamagic) {
    const selectedMetamagic = classSelections.metamagic ?? []
    if (
      definition?.id !== 'sorcerer' || castingClassLevel < 3 || !selectedMetamagic.includes(metamagic.kind) ||
      !dnd5eMetamagicAvailableForSpell(metamagic.kind, spell, slotLevel)
    ) return { ok: false, reason: 'invalid-action' }
  }
  const empowered = payload.empowered === true
  if (
    empowered && (
      definition?.id !== 'sorcerer' || castingClassLevel < 3 ||
      !(classSelections.metamagic ?? []).includes('empowered') ||
      !dnd5eCanEmpowerSpell(spell) || maximizedDamage
    )
  ) return { ok: false, reason: 'invalid-action' }
  const draconicResistance = payload.draconicResistance === true
  const invocations = classSelections['eldritch-invocations'] ?? []
  const repellingBlast = payload.repellingBlast === true
  if (
    repellingBlast &&
    (definition?.id !== 'warlock' || spell.id !== 'eldritch-blast' || !invocations.includes('repelling-blast'))
  ) return { ok: false, reason: 'invalid-action' }
  const draconicResistanceType = dnd5eDraconicElementalResistanceType({
    classId: definition?.id,
    subclassId: definition ? actor.dnd5eClassChoices?.classes?.[definition.id]?.subclass : undefined,
    level: castingClassLevel,
    classSelections,
  }, spell)
  const totalSorceryPointCost = metamagicCost + (empowered ? 1 : 0) + (draconicResistance ? 1 : 0)
  if (
    (draconicResistance && !draconicResistanceType) ||
    (totalSorceryPointCost > 0 && (!sorceryPoints || sorceryPoints.current < totalSorceryPointCost))
  ) return { ok: false, reason: 'invalid-action' }
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  if (spell.id === 'call-lightning' && !sustainedAttack && geometry?.overheadSpace === 'confined') {
    return { ok: false, reason: 'spell-environment-unavailable' }
  }
  const callLightningStormBonusDice = spell.id === 'call-lightning' && geometry?.weather === 'storm' ? 1 : 0
  const diceCount = (sustainedAttack || spell.sustainedAttack?.immediateAttack
    ? dnd5eSustainedSpellAttackDiceCount(spell, slotLevel, actor.level)
    : dnd5eSpellDiceCount(spell, actor.level, slotLevel)) + callLightningStormBonusDice
  const projectileCount = dnd5eSpellProjectileCount(spell, actor.level, slotLevel)
  const repeatedTargets = dnd5eSpellAllowsRepeatedTargets(spell)
  const guessedTargetCell = payload.guessedTargetCell
  let projectileTargetIds = repeatedTargets ? payload.projectileTargetIds : undefined
  if (
    (guessedTargetCell == null && repeatedTargets && projectileTargetIds?.length !== projectileCount) ||
    (guessedTargetCell != null && (payload.projectileTargetIds?.length ?? 0) > 0) ||
    (!repeatedTargets && (payload.projectileTargetIds?.length ?? 0) > 0)
  ) return { ok: false, reason: 'invalid-target' }
  const persistentArea = spell.effect === 'persistent-area'
  const spellOriginProjection = dnd5eSpellOriginProjectionForCharacter({
    character: actor,
    map: input.map,
    areaId: payload.spellOriginAreaId,
  })
  if (
    (payload.spellOriginAreaId != null && !spellOriginProjection) ||
    (payload.spellOriginAreaId != null && sustainedAttack != null)
  ) return { ok: false, reason: 'invalid-action' }
  const spellOriginToken: Token = spellOriginProjection
    ? {
        ...actorToken,
        ...spellOriginProjection.position,
        size: 1,
        elevationFeet: mapGeometryTerrainElevationAtPoint(
          geometry,
          spellOriginProjection.position,
        ),
      }
    : actorToken
  const suppliedExcludedAreaTargetIds = payload.excludedAreaTargetIds ?? []
  const excludedAreaTargetIds = [...new Set(suppliedExcludedAreaTargetIds)]
  if (
    excludedAreaTargetIds.length !== suppliedExcludedAreaTargetIds.length ||
    (spell.id !== 'spirit-guardians' && excludedAreaTargetIds.length > 0) ||
    excludedAreaTargetIds.some((id) => {
      const target = input.map.tokens.find((token) => token.id === id)
      return !target || target.type === 'obstacle' || target.id === actorToken.id || !mapGeometryCanSeeToken({
        geometry,
        map: input.map,
        viewer: actorToken,
        target,
        forceEnabled: true,
        fallbackRangeFeet: 10_000,
      })
    })
  ) return { ok: false, reason: 'invalid-target' }
  let blindTargetMiss = false
  let guessedTargetId: string | undefined
  if (guessedTargetCell != null) {
    const guessedSpiritualWeapon = spell.id === 'spiritual-weapon' && sustainedAttack == null
    const guessedDispelMagic = spell.effect === 'dispel-magic'
    const guessedSanctuary = spell.id === 'sanctuary'
    const guessedAnyCreature = guessedDispelMagic || guessedSanctuary
    const columns = Math.max(1, Math.floor((input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize)))
    const rows = Math.max(1, Math.floor((input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize)))
    if (
      spell.allowsGuessedTargetCell !== true ||
      (spell.effect !== 'spell-attack' && spell.effect !== 'saving-throw' &&
        !guessedDispelMagic && !guessedSanctuary) ||
      (spell.target !== 'hostile' && !guessedAnyCreature) ||
      (spell.area != null && !guessedSpiritualWeapon) ||
      sustainedAttack != null ||
      metamagic?.kind === 'twinned' ||
      payload.targetTokenId !== '' ||
      (payload.targetTokenIds?.length ?? 0) !== 0 ||
      (input.action.targetTokenId != null && input.action.targetTokenId !== '') ||
      (input.action.targetTokenIds?.length ?? 0) !== 0 ||
      input.action.targetCell?.col !== guessedTargetCell.col ||
      input.action.targetCell?.row !== guessedTargetCell.row ||
      !Number.isInteger(guessedTargetCell.col) ||
      !Number.isInteger(guessedTargetCell.row) ||
      guessedTargetCell.col < 0 ||
      guessedTargetCell.row < 0 ||
      guessedTargetCell.col >= columns ||
      guessedTargetCell.row >= rows
    ) return { ok: false, reason: 'invalid-target' }
    const guessedPoint = tokenCenterForAnchorCell(guessedTargetCell, { size: 1 }, input.map)
    const guessedElevation = mapGeometryTerrainElevationAtPoint(geometry, guessedPoint)
    const guessedToken = {
      ...actorToken,
      id: `${actorToken.id}:guessed-target`,
      characterId: undefined,
      type: 'enemy' as const,
      size: 1,
      ...guessedPoint,
      elevationFeet: guessedElevation,
    }
    const spiritualWeaponOrigin = guessedSpiritualWeapon && payload.areaTargetCell
      ? tokenCenterForAnchorCell(payload.areaTargetCell, { size: 1 }, input.map)
      : undefined
    if (guessedSpiritualWeapon && !spiritualWeaponOrigin) return { ok: false, reason: 'invalid-target' }
    const invocationRange = spell.id === 'eldritch-blast' && invocations.includes('eldritch-spear')
      ? 300
      : guessedSpiritualWeapon
        ? spell.sustainedAttack?.rangeFeet ?? 5
        : spell.rangeFeet
    const spellAttackRangeMultiplier = !sustainedAttack && spell.effect === 'spell-attack'
      ? dnd5eSpellAttackRangeMultiplierForCharacter(actor)
      : 1
    const basePlacementRange = invocationRange * spellAttackRangeMultiplier
    const placementRange = metamagic?.kind === 'distant' ? basePlacementRange * 2 : basePlacementRange
    const guessedOriginToken = spiritualWeaponOrigin
      ? { ...actorToken, ...spiritualWeaponOrigin, size: 1 }
      : actorToken
    const distanceFeet = dnd5eMapTokenDistanceFeet({
      map: input.map,
      geometry,
      left: guessedOriginToken,
      right: guessedToken,
    })
    if (distanceFeet > placementRange) return { ok: false, reason: 'target-out-of-range' }
    if (mapGeometryLineOfEffectBlocked({
      geometry,
      map: input.map,
      from: spiritualWeaponOrigin ?? actorToken,
      to: guessedPoint,
      fromElevationFeet: spiritualWeaponOrigin
        ? mapGeometryTerrainElevationAtPoint(geometry, spiritualWeaponOrigin)
        : mapGeometryTokenElevation(geometry, actorToken),
      toElevationFeet: guessedElevation,
    })) return { ok: false, reason: 'effect-line-blocked' }
    const guessedKey = cellKey(guessedTargetCell)
    guessedTargetId = input.map.tokens
      .filter((candidate) =>
        candidate.type !== 'obstacle' &&
        candidate.id !== actorToken.id &&
        (guessedAnyCreature || areOpposedCombatTokens(actorToken, candidate)) &&
        tokenOccupiedCellsAt(candidate, input.map, candidate).some((cell) => cellKey(cell) === guessedKey),
      )
      .sort((left, right) => left.id.localeCompare(right.id))[0]?.id
    blindTargetMiss = guessedTargetId == null
    if (guessedTargetId && repeatedTargets && projectileCount != null) {
      const authoritativeTargetId = guessedTargetId
      projectileTargetIds = Array.from({ length: projectileCount }, () => authoritativeTargetId)
    }
  }
  let requestedTargetIds = guessedTargetCell != null
    ? guessedTargetId ? [guessedTargetId] : []
    : persistentArea || (spell.area && spell.target === 'area')
    ? []
    : [...new Set(
        projectileTargetIds?.length
          ? projectileTargetIds
          : payload.targetTokenIds !== undefined
            ? payload.targetTokenIds
            : [payload.targetTokenId],
      )]
  const conditionChoice = payload.conditionChoice
  if (
    (spell.conditionOptions?.length && (!conditionChoice || !spell.conditionOptions.includes(conditionChoice))) ||
    (!spell.conditionOptions?.length && conditionChoice != null)
  ) return { ok: false, reason: 'invalid-action' }
  const effectDamageType = payload.effectDamageType
  if (
    (spell.effectDamageTypeOptions?.length && (!effectDamageType || !spell.effectDamageTypeOptions.includes(effectDamageType))) ||
    (!spell.effectDamageTypeOptions?.length && effectDamageType != null)
  ) return { ok: false, reason: 'invalid-action' }
  const enlargeReduceChoice = payload.enlargeReduceChoice
  if (
    (spell.enlargeReduceOptions?.length &&
      (!enlargeReduceChoice || !spell.enlargeReduceOptions.includes(enlargeReduceChoice))) ||
    (!spell.enlargeReduceOptions?.length && enlargeReduceChoice != null)
  ) return { ok: false, reason: 'invalid-action' }
  const enhanceAbilityChoice = payload.enhanceAbilityChoice
  if (
    (spell.enhanceAbilityOptions?.length &&
      (!enhanceAbilityChoice || !spell.enhanceAbilityOptions.includes(enhanceAbilityChoice))) ||
    (!spell.enhanceAbilityOptions?.length && enhanceAbilityChoice != null)
  ) return { ok: false, reason: 'invalid-action' }
  const calmEmotionsMode = payload.calmEmotionsMode
  const calmEmotionsIndifferenceScope = payload.calmEmotionsIndifferenceScope
  if (
    spell.id === 'calm-emotions'
      ? (
          calmEmotionsMode !== 'suppress' && calmEmotionsMode !== 'indifferent' ||
          (calmEmotionsMode === 'suppress' && calmEmotionsIndifferenceScope != null) ||
          (calmEmotionsMode === 'indifferent' &&
            calmEmotionsIndifferenceScope !== 'caster-allies' &&
            calmEmotionsIndifferenceScope !== 'caster-enemies' &&
            calmEmotionsIndifferenceScope !== 'everyone')
        )
      : calmEmotionsMode != null || calmEmotionsIndifferenceScope != null
  ) return { ok: false, reason: 'invalid-action' }
  const baseMaximumTargets = dnd5eSpellMaximumTargets(spell, slotLevel, actor.level)
  const declarativeAdditionalTargets = !sustainedAttack && !itemSpellSource && !racialGrant &&
      metamagic == null
    ? dnd5ePluginSpellTargetExpansionForCharacter({
        character: actor,
        spellcastingClassId: castingClassId,
        spellSchool: dnd5eSpellSchoolIdFromLabel(spell.school),
        baseMaximumTargets,
      })
    : 0
  const maximumTargets = sustainedAttack
    ? sustainedAttack.resolution === 'saving-throw'
      ? baseMaximumTargets
      : 1
    : metamagic?.kind === 'twinned' ? 2 : baseMaximumTargets + declarativeAdditionalTargets
  if (
    (!persistentArea && spell.target !== 'area' && requestedTargetIds.length < 1 && !blindTargetMiss) ||
    requestedTargetIds.length > maximumTargets ||
    (metamagic?.kind === 'twinned' && requestedTargetIds.length !== 2)
  ) {
    return { ok: false, reason: 'spell-target-count-invalid' }
  }
  const targetTokens = requestedTargetIds.map((id) => input.map.tokens.find((token) => token.id === id))
  if (targetTokens.some((token) =>
    !token || token.type === 'obstacle' || isDefeatedAreaToken(token) ||
    (token.id === actorToken.id && (
      spell.target === 'hostile' ||
      (sustainedAttack != null && sustainedAttack.relation !== 'any')
    )),
  )) {
    return { ok: false, reason: 'invalid-target' }
  }
  let validTargetTokens = targetTokens as Token[]
  let areaCells: readonly { col: number; row: number }[] | undefined
  let areaAnchorCell: { col: number; row: number } | undefined
  let areaAnchorCells: readonly { col: number; row: number }[] | undefined
  let wallOfFireGeometry: Dnd5eWallOfFireGeometry | undefined
  let teleportDestination: Dnd5eSpellTeleportDestination | undefined
  const spellArea = dnd5eSpellAreaAtSlot(spell, slotLevel)
  const areaTemplate = spellArea && sustainedUsesArea
    ? {
        ...spellArea,
        placeRangeFeet: sustainedAttack?.origin === 'effect-token'
          ? sustainedAttack.movementFeet
          : sustainedAttack?.rangeFeet,
      }
    : spellArea
  const areaTargeting = areaTemplate
    ? resolveAoeDimensions(areaTemplate, {
        radiusFeet: payload.areaTargetRadiusFeet,
        widthFeet: payload.areaTargetWidthFeet,
        heightFeet: payload.areaTargetHeightFeet,
        lengthFeet: payload.areaTargetLengthFeet,
      })
    : undefined
  if (areaTemplate && !areaTargeting) return { ok: false, reason: 'spell-area-orientation-invalid' }
  if (!areaTemplate && (
    payload.areaTargetRadiusFeet != null || payload.areaTargetWidthFeet != null ||
    payload.areaTargetHeightFeet != null || payload.areaTargetLengthFeet != null
  )) return { ok: false, reason: 'invalid-action' }
  const hasWallOfFireOptions = payload.wallOfFireShape != null || payload.wallOfFireAngleDegrees != null ||
    payload.wallOfFireDamagingSide != null || payload.wallOfFireLengthFeet != null ||
    payload.wallOfFireDiameterFeet != null
  if (hasWallOfFireOptions && spell.id !== 'wall-of-fire') return { ok: false, reason: 'invalid-action' }
  const hasBladeBarrierOptions = payload.bladeBarrierShape != null || payload.bladeBarrierAngleDegrees != null ||
    payload.bladeBarrierLengthFeet != null || payload.bladeBarrierDiameterFeet != null
  if (hasBladeBarrierOptions && spell.id !== 'blade-barrier') return { ok: false, reason: 'invalid-action' }
  if (spell.id === 'wall-of-fire') {
    const shape = payload.wallOfFireShape ?? 'line'
    const angle = payload.wallOfFireAngleDegrees ?? ((payload.areaTargetOrientation ?? 0) * 90)
    const side = payload.wallOfFireDamagingSide ?? (shape === 'ring' ? 'outside' : 'right')
    const lengthFeet = payload.wallOfFireLengthFeet ?? 60
    const diameterFeet = payload.wallOfFireDiameterFeet ?? 20
    if ((shape !== 'line' && shape !== 'ring') ||
      !Number.isFinite(angle) || angle < -3_600 || angle > 3_600 ||
      !Number.isInteger(lengthFeet) || lengthFeet < 5 || lengthFeet > 60 || lengthFeet % 5 !== 0 ||
      !Number.isInteger(diameterFeet) || diameterFeet < 5 || diameterFeet > 20 || diameterFeet % 5 !== 0 ||
      (shape === 'line' && side !== 'left' && side !== 'right') ||
      (shape === 'ring' && side !== 'inside' && side !== 'outside')) {
      return { ok: false, reason: 'spell-area-orientation-invalid' }
    }
    wallOfFireGeometry = {
      shape,
      angleDegrees: normalizeWallOfFireAngle(angle),
      damagingSide: side,
      lengthFeet,
      diameterFeet,
    }
  }
  if (spell.id === 'blade-barrier') {
    const shape = payload.bladeBarrierShape ?? 'line'
    const angle = payload.bladeBarrierAngleDegrees ?? payload.areaTargetAngleDegrees ?? 0
    const lengthFeet = payload.bladeBarrierLengthFeet ?? payload.areaTargetWidthFeet ?? 100
    const diameterFeet = payload.bladeBarrierDiameterFeet ?? 60
    if ((shape !== 'line' && shape !== 'ring') ||
      !Number.isFinite(angle) || angle < -3_600 || angle > 3_600 ||
      !Number.isInteger(lengthFeet) || lengthFeet < 5 || lengthFeet > 100 || lengthFeet % 5 !== 0 ||
      !Number.isInteger(diameterFeet) || diameterFeet < 5 || diameterFeet > 60 || diameterFeet % 5 !== 0) {
      return { ok: false, reason: 'spell-area-orientation-invalid' }
    }
    wallOfFireGeometry = {
      shape,
      angleDegrees: normalizeWallOfFireAngle(angle),
      damagingSide: shape === 'ring' ? 'outside' : 'right',
      lengthFeet,
      diameterFeet,
    }
  }
  if (areaTargeting && (spell.areaTargetCount ?? 1) > 1 && dancingLightsForm !== 'humanoid') {
    const requiredAreaTargetCount = spell.areaTargetCount ?? 1
    const minimumAreaTargetCount = Math.max(1, Math.min(requiredAreaTargetCount, spell.minimumAreaTargetCount ?? requiredAreaTargetCount))
    const submittedAreaCells = payload.areaTargetCells
    if (
      areaTargeting.shape !== 'circle' ||
      areaTargeting.origin !== 'point' ||
      !Array.isArray(submittedAreaCells) ||
      submittedAreaCells.length < minimumAreaTargetCount ||
      submittedAreaCells.length > requiredAreaTargetCount
    ) return { ok: false, reason: 'spell-area-target-required' }
    const uniqueAreaKeys = new Set(submittedAreaCells.map(cellKey))
    if (uniqueAreaKeys.size !== submittedAreaCells.length) {
      return { ok: false, reason: 'spell-area-target-required' }
    }
    if (spell.id === 'dancing-lights' && submittedAreaCells.length > 1) {
      const feetPerCell = Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
      const everyLightHasNeighbor = submittedAreaCells.every((cell, index) =>
        submittedAreaCells.some((other, otherIndex) =>
          index !== otherIndex &&
          Math.max(Math.abs(cell.col - other.col), Math.abs(cell.row - other.row)) * feetPerCell <= 20
        ),
      )
      if (!everyLightHasNeighbor) return { ok: false, reason: 'invalid-target' }
    }
    if (payload.areaTargetOrientation != null) {
      return { ok: false, reason: 'spell-area-orientation-invalid' }
    }

    const casterCell = tokenAnchorCellFromPixel(
      spellOriginToken.x,
      spellOriginToken.y,
      spellOriginToken,
      input.map,
    )
    const columns = Math.max(1, Math.floor((input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize)))
    const rows = Math.max(1, Math.floor((input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize)))
    const zoneTargets = new Map<string, Token>()
    const unionCells = new Map<string, { col: number; row: number }>()

    for (const areaCell of submittedAreaCells) {
      if (!Number.isInteger(areaCell.col) || !Number.isInteger(areaCell.row)) {
        return { ok: false, reason: 'spell-area-target-required' }
      }
      if (areaCell.col < 0 || areaCell.row < 0 || areaCell.col >= columns || areaCell.row >= rows) {
        return { ok: false, reason: 'spell-area-target-out-of-bounds' }
      }
      if (!canPlaceAoe(areaTargeting, casterCell, areaCell)) {
        return { ok: false, reason: 'spell-area-target-out-of-range' }
      }
      const areaPoint = {
        x: input.map.gridOffsetX + (areaCell.col + 0.5) * input.map.gridSize,
        y: input.map.gridOffsetY + (areaCell.row + 0.5) * input.map.gridSize,
      }
      const areaPointElevation = mapGeometryTerrainElevationAtPoint(geometry, areaPoint)
      const areaPointToken = {
        ...actorToken,
        id: `${actorToken.id}:spell-area-placement:${areaCell.col}:${areaCell.row}`,
        characterId: undefined,
        type: 'obstacle' as const,
        size: 1,
        ...areaPoint,
        elevationFeet: areaPointElevation,
      }
      const horizontalPlacementDistanceFeet = tokenFootprintDistanceCells(
        spellOriginToken,
        areaPointToken,
        input.map,
      ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
      const placementRangeFeet = areaTargeting.placeRangeFeet ?? spell.rangeFeet
      if (dnd5eTokenToPointDistanceFeet({
        geometry,
        token: spellOriginToken,
        pointElevationFeet: areaPointElevation,
        horizontalDistanceFeet: horizontalPlacementDistanceFeet,
      }) > placementRangeFeet + 1e-4) {
        return { ok: false, reason: 'spell-area-target-out-of-range' }
      }
      if (
        spell.requiresVisibleTarget === 'placement' &&
        !mapGeometryCanSeeToken({
          geometry,
          map: input.map,
          viewer: actorToken,
          target: areaPointToken,
          forceEnabled: true,
          fallbackRangeFeet: spellOriginProjection ? 10_000 : placementRangeFeet,
        })
      ) return { ok: false, reason: 'spell-target-not-visible' }
      if (mapGeometryLineOfEffectBlocked({
        geometry,
        map: input.map,
        from: spellOriginToken,
        to: areaPoint,
        fromElevationFeet: mapGeometryTokenElevation(geometry, spellOriginToken),
        toElevationFeet: areaPointElevation,
      })) return { ok: false, reason: 'effect-line-blocked' }

      const cells = cellsForAoe(areaTargeting, casterCell, areaCell)
      for (const cell of cells) unionCells.set(cellKey(cell), cell)
      for (const candidate of tokensInCells(input.map, input.map.tokens, cells)) {
        if (
          candidate.type === 'obstacle' ||
          isDefeatedAreaToken(candidate) ||
          (candidate.id === actorToken.id && !spell.areaIncludesSelf) ||
          (spell.id === 'calm-emotions' && !isCalmEmotionsHumanoidToken(candidate))
        ) continue
        const opposed = areOpposedCombatTokens(actorToken, candidate)
        if (spell.target === 'hostile' && !opposed) continue
        if (spell.target === 'ally' && opposed) continue
        if (!dnd5eInstantAoeAffectsTokenVertically({
          spellId: spell.id,
          area: areaTargeting,
          map: input.map,
          geometry,
          sourceToken: spellOriginToken,
          targetToken: candidate,
          effectOrigin: areaPoint,
          effectOriginElevationFeet: areaPointElevation,
          effectAim: areaPoint,
          effectAimElevationFeet: areaPointElevation,
        })) continue
        if (mapGeometryLineOfEffectBlocked({
          geometry,
          map: input.map,
          from: areaPoint,
          to: candidate,
          fromElevationFeet: areaPointElevation,
          toElevationFeet: mapGeometryTokenElevation(geometry, candidate),
        })) continue
        zoneTargets.set(candidate.id, candidate)
      }
    }

    areaCells = [...unionCells.values()]
    areaAnchorCells = submittedAreaCells.map((cell) => ({ ...cell }))
    areaAnchorCell = areaAnchorCells[0]
    const authoritativeTargets = [...zoneTargets.values()]
    if (!persistentArea && spell.target === 'area') {
      requestedTargetIds = authoritativeTargets.map((candidate) => candidate.id)
      if (requestedTargetIds.length > maximumTargets) {
        return { ok: false, reason: 'spell-target-count-invalid' }
      }
      validTargetTokens = authoritativeTargets
    }
  } else if (areaTargeting) {
    if ((payload.areaTargetCells?.length ?? 0) > 0) return { ok: false, reason: 'invalid-target' }
    const casterCell = sustainedArea?.anchorCell ?? tokenAnchorCellFromPixel(
      spellOriginToken.x,
      spellOriginToken.y,
      spellOriginToken,
      input.map,
    )
    const areaCell = areaTargeting.shape === 'circle' && areaTargeting.origin === 'self'
      ? casterCell
      : payload.areaTargetCell
    const orientation = payload.areaTargetOrientation
    const columns = Math.max(1, Math.floor((input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize)))
    const rows = Math.max(1, Math.floor((input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize)))
    if (!areaCell || !Number.isInteger(areaCell.col) || !Number.isInteger(areaCell.row)) {
      return { ok: false, reason: 'spell-area-target-required' }
    }
    if (areaCell.col < 0 || areaCell.row < 0 || areaCell.col >= columns || areaCell.row >= rows) {
      return { ok: false, reason: 'spell-area-target-out-of-bounds' }
    }
    if (!canPlaceAoe(areaTargeting, casterCell, areaCell)) {
      return { ok: false, reason: 'spell-area-target-out-of-range' }
    }
    if (orientation != null && spell.id !== 'wall-of-fire' && (
      areaTargeting.shape !== 'rect' || !areaTargeting.rotatable ||
      !Number.isInteger(orientation) || orientation < 0 || orientation > 3
    )) return { ok: false, reason: 'spell-area-orientation-invalid' }
    if (areaTargeting.origin === 'point') {
      const areaPoint = {
        x: input.map.gridOffsetX + (areaCell.col + 0.5) * input.map.gridSize,
        y: input.map.gridOffsetY + (areaCell.row + 0.5) * input.map.gridSize,
      }
      const requestedAreaPointElevation = input.action.targetElevationFeet
      if (
        requestedAreaPointElevation != null &&
        (!Number.isFinite(requestedAreaPointElevation) ||
          requestedAreaPointElevation < -1_000 ||
          requestedAreaPointElevation > 10_000)
      ) return { ok: false, reason: 'invalid-target' }
      const areaPointElevation = requestedAreaPointElevation ??
        mapGeometryTerrainElevationAtPoint(geometry, areaPoint)
      const areaPointToken = {
        ...actorToken,
        id: `${actorToken.id}:spell-area-placement`,
        characterId: undefined,
        type: 'obstacle' as const,
        size: 1,
        ...areaPoint,
        elevationFeet: areaPointElevation,
      }
      const horizontalPlacementDistanceFeet = tokenFootprintDistanceCells(
        spellOriginToken,
        areaPointToken,
        input.map,
      ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
      const placementRangeFeet = areaTargeting.placeRangeFeet ?? spell.rangeFeet
      if (dnd5eTokenToPointDistanceFeet({
        geometry,
        token: spellOriginToken,
        pointElevationFeet: areaPointElevation,
        horizontalDistanceFeet: horizontalPlacementDistanceFeet,
      }) > placementRangeFeet + 1e-4) {
        return { ok: false, reason: 'spell-area-target-out-of-range' }
      }
      if (
        spell.requiresVisibleTarget === 'placement' &&
        !mapGeometryCanSeeToken({
          geometry,
          map: input.map,
          viewer: actorToken,
          target: {
            ...actorToken,
            id: `${actorToken.id}:spell-placement`,
            characterId: undefined,
            ...areaPoint,
            elevationFeet: areaPointElevation,
          },
          forceEnabled: true,
          fallbackRangeFeet: spellOriginProjection ? 10_000 : areaTargeting.placeRangeFeet ?? spell.rangeFeet,
        })
      ) return { ok: false, reason: 'spell-target-not-visible' }
      if (spell.effect === 'teleport') {
        const destination = tokenCenterForAnchorCell(areaCell, actorToken, input.map)
        const destinationFootprint = tokenOccupiedCellsAt(actorToken, input.map, destination)
        const occupied = occupiedCells(input.map.tokens, input.map, actorToken.id)
        if (
          destinationFootprint.some((cell) =>
            cell.col < 0 || cell.row < 0 || cell.col >= columns || cell.row >= rows ||
            occupied.has(cellKey(cell))) ||
          mapGeometryPlacementBlocked({
            geometry,
            map: input.map,
            token: actorToken,
            at: destination,
            elevationFeet: areaPointElevation,
          }).blocked ||
          !mapGeometryCanSeeToken({
            geometry,
            map: input.map,
            viewer: actorToken,
            target: { ...actorToken, ...destination, elevationFeet: areaPointElevation },
            forceEnabled: true,
            fallbackRangeFeet: spellOriginProjection ? 10_000 : 30,
          })
        ) return { ok: false, reason: 'invalid-target' }
        teleportDestination = {
          to: destination,
          distanceFeet: Math.max(
            Math.abs(areaCell.col - casterCell.col),
            Math.abs(areaCell.row - casterCell.row),
          ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL),
          toElevationFeet: areaPointElevation,
        }
      } else if (sustainedAttack?.origin !== 'effect-token' && mapGeometryLineOfEffectBlocked({
        geometry,
        map: input.map,
        from: spellOriginToken,
        to: areaPoint,
        fromElevationFeet: mapGeometryTokenElevation(geometry, spellOriginToken),
        toElevationFeet: areaPointElevation,
      })) return { ok: false, reason: 'effect-line-blocked' }
      if (spell.id === 'flaming-sphere' && input.map.tokens.some((candidate) =>
        candidate.type !== 'obstacle' && tokenOccupiedCellsAt(candidate, input.map, candidate)
          .some((cell) => cellKey(cell) === cellKey(areaCell)),
      )) return { ok: false, reason: 'invalid-target' }
    }
    const orientFrom = aoeOrientFromCell(areaTargeting, casterCell, areaCell, { rectRotation: orientation })
    const cells = wallOfFireGeometry
      ? dnd5eWallOfFireCells({ anchor: areaCell, ...wallOfFireGeometry, map: input.map })
      : dnd5eSpellUsesThinWallCells(spell.id) && areaTargeting.shape === 'rect'
        ? dnd5eThinWallCells({
            anchor: areaCell,
            angleDegrees: payload.areaTargetAngleDegrees ?? ((orientation ?? 0) * 90),
            lengthFeet: areaTargeting.widthFeet,
            maximumLengthFeet: spellArea?.shape === 'rect' ? spellArea.widthFeet : areaTargeting.widthFeet,
            map: input.map,
          })
      : cellsForAoe(areaTargeting, orientFrom, areaCell)
    areaCells = cells
    areaAnchorCell = areaCell
    const effectAim = {
      x: input.map.gridOffsetX + (areaCell.col + 0.5) * input.map.gridSize,
      y: input.map.gridOffsetY + (areaCell.row + 0.5) * input.map.gridSize,
    }
    const effectAimElevation = input.action.targetElevationFeet ??
      mapGeometryTerrainElevationAtPoint(geometry, effectAim)
    const effectOrigin = areaTargeting.origin === 'point' ? effectAim : spellOriginToken
    const effectOriginElevation = areaTargeting.origin === 'point'
      ? effectAimElevation
      : mapGeometryTokenElevation(geometry, spellOriginToken)
    const authoritativeTargets = tokensInCells(input.map, input.map.tokens, cells).filter((candidate) => {
      if (
        candidate.type === 'obstacle' ||
        // Map NPC markers do not have a Headless combatant or a D&D 5e stat
        // block.  Do not let a cone or other area spell include one and then
        // fail the entire otherwise valid exploration cast as
        // `combatant-missing`.
        candidate.type === 'npc' ||
        isDefeatedAreaToken(candidate) ||
        (candidate.id === actorToken.id && !spell.areaIncludesSelf) ||
        (spell.id === 'calm-emotions' && !isCalmEmotionsHumanoidToken(candidate))
      ) return false
      const opposed = areOpposedCombatTokens(actorToken, candidate)
      if (spell.target === 'hostile' && !opposed) return false
      if (spell.target === 'ally' && opposed) return false
      if (!dnd5eInstantAoeAffectsTokenVertically({
        spellId: spell.id,
        area: areaTargeting,
        map: input.map,
        geometry,
        sourceToken: spellOriginToken,
        targetToken: candidate,
        effectOrigin,
        effectOriginElevationFeet: effectOriginElevation,
        effectAim,
        effectAimElevationFeet: effectAimElevation,
      })) return false
      return !mapGeometryLineOfEffectBlocked({
        geometry,
        map: input.map,
        from: effectOrigin,
        to: candidate,
        fromElevationFeet: effectOriginElevation,
        toElevationFeet: mapGeometryTokenElevation(geometry, candidate),
      })
    })
    const authoritativeIds = new Set(authoritativeTargets.map((candidate) => candidate.id))
    if (spell.target !== 'area' && requestedTargetIds.some((targetId) => !authoritativeIds.has(targetId))) {
      return { ok: false, reason: 'invalid-target' }
    }
    if (!persistentArea) {
      if (spell.target === 'area') {
        // The player submits only the point/template. The DM Host owns target
        // discovery, including hidden creatures and line-of-effect changes that
        // may not exist in the player's projected or slightly stale map.
        requestedTargetIds = spell.effect === 'teleport'
          ? []
          : authoritativeTargets.map((candidate) => candidate.id)
        if (requestedTargetIds.length > maximumTargets) return { ok: false, reason: 'spell-target-count-invalid' }
        validTargetTokens = [...authoritativeTargets]
      }
    }
  } else if (payload.areaTargetCell != null || (payload.areaTargetCells?.length ?? 0) > 0 || payload.areaTargetOrientation != null ||
    payload.wallOfFireShape != null || payload.wallOfFireAngleDegrees != null ||
    payload.wallOfFireDamagingSide != null || payload.wallOfFireLengthFeet != null ||
    payload.wallOfFireDiameterFeet != null || payload.bladeBarrierShape != null ||
    payload.bladeBarrierAngleDegrees != null || payload.bladeBarrierLengthFeet != null ||
    payload.bladeBarrierDiameterFeet != null) {
    return { ok: false, reason: 'invalid-target' }
  }
  for (let targetIndex = 0; targetIndex < validTargetTokens.length; targetIndex += 1) {
    const target = validTargetTokens[targetIndex]
    if (
      sustainedAttack?.lockToConcentrationTarget &&
      !actor.dnd5eCombatState?.concentrationTargetIds?.includes(target.id)
    ) return { ok: false, reason: 'invalid-target' }
    const opposed = areOpposedCombatTokens(actorToken, target)
    if (
      (sustainedAttack && sustainedAttack.relation !== 'any' && !opposed) ||
      (!sustainedAttack && ((spell.target === 'hostile' && !opposed) || (spell.target === 'ally' && opposed)))
    ) return { ok: false, reason: 'invalid-target' }
    if (spell.secondaryTargetsWithinFeetOfFirst != null && targetIndex > 0) continue
    if (sustainedUsesArea) continue
    const distanceFeet = dnd5eMapTokenDistanceFeet({
      map: input.map,
      geometry,
      left: spellOriginToken,
      right: target,
    })
    const invocationRange = sustainedAttack
      ? sustainedAttack.rangeFeet
      : spell.id === 'eldritch-blast' && invocations.includes('eldritch-spear')
      ? 300
      : spell.rangeFeet
    const spellAttackRangeMultiplier = !sustainedAttack && spell.effect === 'spell-attack'
      ? dnd5eSpellAttackRangeMultiplierForCharacter(actor)
      : 1
    const basePlacementRange = invocationRange * spellAttackRangeMultiplier
    const placementRange = metamagic?.kind === 'distant' ? basePlacementRange * 2 : basePlacementRange
    const areaReach = areaTargeting?.shape === 'circle'
      ? areaTargeting.radiusFeet
      : areaTargeting?.shape === 'line' || areaTargeting?.shape === 'cone'
        ? areaTargeting.lengthFeet
        : areaTargeting?.heightFeet ?? 0
    const effectiveRange = areaTargeting?.origin === 'self' ? areaReach : placementRange + areaReach
    if (distanceFeet > effectiveRange) {
      return { ok: false, reason: 'target-out-of-range' }
    }
  }
  // A directly selected NPC is a real creature target even though ordinary
  // NPC markers are not normally projected into the Headless combat state.
  // Project only the selected NPCs into this private snapshot so targeted
  // core spells cannot offer the creature in the UI and then fail later as
  // `combatant-missing`.
  const snapshotNpcTargetIds = new Set(
    validTargetTokens.filter((target) => target.type === 'npc').map((target) => target.id),
  )
  const snapshotMap: BattleMap = snapshotNpcTargetIds.size > 0
    ? {
        ...input.map,
        tokens: input.map.tokens.map((token) => snapshotNpcTargetIds.has(token.id)
          ? { ...token, type: 'player' as const }
          : token),
      }
    : input.map
  const snapshotInitiativeTokenIds = new Set(input.initiativeOrder.map((entry) => entry.tokenId))
  const snapshotInitiativeOrder: readonly InitiativeEntry[] = snapshotNpcTargetIds.size > 0
    ? [
        ...input.initiativeOrder,
        ...validTargetTokens.flatMap((target) =>
          snapshotNpcTargetIds.has(target.id) && !snapshotInitiativeTokenIds.has(target.id)
            ? [{
                tokenId: target.id,
                label: target.label,
                emoji: target.emoji ?? '',
                color: target.color ?? '',
                roll: 0,
              }]
            : []),
      ]
    : input.initiativeOrder
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.action.combatId ?? `map-${input.map.id}`,
    round: input.action.round,
    turnSlotId: snapshotInitiativeOrder[input.action.initiativeIndex]?.slotId,
    map: snapshotMap,
    characters: input.characters,
    initiativeOrder: snapshotInitiativeOrder,
  })
  if (spell.requiresTargetCanHearSource) {
    const sourceCombatant = snapshot.state.combatants[actorToken.id]
    if (
      !sourceCombatant ||
      validTargetTokens.some((target) => {
        const listenerCombatant = snapshot.state.combatants[target.id]
        return !listenerCombatant || !dnd5eCombatantCanHearSource(listenerCombatant, sourceCombatant)
      })
    ) return { ok: false, reason: 'invalid-target' }
  }
  // Exploration spell transactions intentionally reuse the Headless combat
  // resolver for one authoritative rules path. A map with only the caster has
  // one combatant, so startDnd5eHeadlessCombat marks that synthetic snapshot as
  // inactive. Keep only combat-less spell snapshots resolvable; live-combat
  // requests still require their real combat id and remain turn-gated.
  if (!input.action.combatId?.trim()) {
    // Exploration casts are independent transactions, not successive actions
    // inside one combat turn. Persisted turn keys from an earlier exploration
    // spell must not permanently lock bonus-action or action spells.
    const explorationActor = prepareDnd5eExplorationActor(snapshot.state, actorToken.id)
    if (explorationActor) {
      explorationActor.classState.bonusActionSpellTurnKey = undefined
      explorationActor.classState.leveledSpellTurnKey = undefined
    }
  }
  if (
    guessedTargetCell == null &&
    spell.requiresVisibleTarget !== 'placement' &&
    (spell.allowsGuessedTargetCell === true || spell.requiresVisibleTarget != null) &&
    validTargetTokens.some((target, targetIndex) => {
      if (spell.requiresVisibleTarget === 'primary' && targetIndex !== 0) return false
      const geometryVisible = mapGeometryCanSeeToken({
        geometry,
        map: input.map,
        viewer: actorToken,
        target,
        forceEnabled: true,
        fallbackRangeFeet: spellOriginProjection
          ? 10_000
          : (metamagic?.kind === 'distant' ? 2 : 1) * spell.rangeFeet *
            (!sustainedAttack && spell.effect === 'spell-attack'
              ? dnd5eSpellAttackRangeMultiplierForCharacter(actor)
              : 1),
      })
      const hasHeadlessSightPair = snapshot.state.combatants[actorToken.id] != null &&
        snapshot.state.combatants[target.id] != null
      return !geometryVisible || (
        hasHeadlessSightPair &&
        !dnd5eCombatantCanSee(snapshot.state, actorToken.id, target.id)
      )
    })
  ) return { ok: false, reason: 'spell-target-not-visible' }
  if (spell.maximumTargetSeparationFeet != null && validTargetTokens.length > 1) {
    for (let leftIndex = 0; leftIndex < validTargetTokens.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < validTargetTokens.length; rightIndex += 1) {
        const separationFeet = dnd5eMapTokenDistanceFeet({
          map: input.map,
          geometry,
          left: validTargetTokens[leftIndex],
          right: validTargetTokens[rightIndex],
        })
        if (separationFeet > spell.maximumTargetSeparationFeet) return { ok: false, reason: 'invalid-target' }
      }
    }
  }
  if (spell.secondaryTargetsWithinFeetOfFirst != null && validTargetTokens.length > 1) {
    const firstTarget = validTargetTokens[0]
    for (const secondaryTarget of validTargetTokens.slice(1)) {
      const separationFeet = dnd5eMapTokenDistanceFeet({
        map: input.map,
        geometry,
        left: firstTarget,
        right: secondaryTarget,
      })
      if (separationFeet > spell.secondaryTargetsWithinFeetOfFirst) return { ok: false, reason: 'invalid-target' }
    }
  }
  const targetToken = validTargetTokens[0] ?? actorToken
  if (enforceSpellcastingPrerequisites && spell.id === 'warding-bond') {
    const targetCharacter = targetToken.characterId
      ? input.characters.find((character) => character.id === targetToken.characterId)
      : undefined
    const targetWearsPlatinumRing = targetCharacter != null &&
      normalizeDnd5eInventory(targetCharacter).entries.some((entry) =>
        entry.quantity > 0 && entry.identified !== false && entry.equippedSlot != null &&
        entry.item.spellcastingMaterial?.tags.includes('platinum-ring') === true &&
        (entry.item.spellcastingMaterial.unitValueGp ?? 0) >= 50,
      )
    if (!targetWearsPlatinumRing) return { ok: false, reason: 'costly-material-unavailable' }
  }
  const entityAttackOriginToken = spell.sustainedAttack?.origin === 'effect-token' && payload.areaTargetCell
    ? {
        ...actorToken,
        id: authorizedSustainedEffectAreaId ?? `${actorToken.id}:spell-effect-origin`,
        characterId: undefined,
        type: 'obstacle' as const,
        size: 1,
        ...tokenCenterForAnchorCell(payload.areaTargetCell, { size: 1 }, input.map),
      }
    : undefined
  const suppliedSculptedTargetIds = payload.sculptedTargetIds ?? []
  const sculptedTargetIds = [...new Set(suppliedSculptedTargetIds)]
  const canSculpt = dnd5eCanSculptSpell({
    classId: definition?.id,
    subclassId: definition ? actor.dnd5eClassChoices?.classes?.[definition.id]?.subclass : undefined,
    level: castingClassLevel,
  }, spell)
  if (
    sculptedTargetIds.length !== suppliedSculptedTargetIds.length ||
    (!canSculpt && sculptedTargetIds.length > 0) ||
    sculptedTargetIds.length > dnd5eSculptSpellMaximumTargets(spell) ||
    sculptedTargetIds.some((targetId) => targetId === actorToken.id || !requestedTargetIds.includes(targetId))
  ) return { ok: false, reason: 'invalid-target' }
  const sculptedTargetIdSet = new Set(sculptedTargetIds)
  const suppliedCarefulTargetIds = metamagic?.carefulTargetIds ?? []
  const carefulTargetIds = [...new Set(suppliedCarefulTargetIds)]
  if (
    carefulTargetIds.length !== suppliedCarefulTargetIds.length ||
    (metamagic?.kind === 'careful' && carefulTargetIds.length < 1) ||
    (metamagic?.kind !== 'careful' && carefulTargetIds.length > 0) ||
    carefulTargetIds.length > dnd5eCarefulSpellMaximumTargets(actor.abilities.cha) ||
    carefulTargetIds.some((targetId) => targetId === actorToken.id || !requestedTargetIds.includes(targetId))
  ) return { ok: false, reason: 'invalid-target' }
  const carefulTargetIdSet = new Set(carefulTargetIds)
  const heightenedTargetId = metamagic?.heightenedTargetId
  if (
    (metamagic?.kind === 'heightened' && (!heightenedTargetId || !requestedTargetIds.includes(heightenedTargetId))) ||
    (metamagic?.kind !== 'heightened' && heightenedTargetId != null)
  ) return { ok: false, reason: 'invalid-target' }
  const distanceFeet = dnd5eMapTokenDistanceFeet({
    map: input.map,
    geometry,
    left: entityAttackOriginToken ?? spellOriginToken,
    right: targetToken,
  })

  const actorIndex = dnd5eRequestedInitiativeActorIndex(
    snapshot.state,
    actorToken.id,
    input.action.initiativeIndex,
  )
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  const targetCombatant = snapshot.state.combatants[targetToken.id]
  if (
    actorIndex < 0 || !actorCombatant || !targetCombatant ||
    validTargetTokens.some((target) => !snapshot.state.combatants[target.id])
  ) return { ok: false, reason: 'combatant-missing' }
  const targetCombatants = validTargetTokens.map((token) => snapshot.state.combatants[token.id])
  if (
    itemSpellEffect?.targeting === 'self-only' &&
    validTargetTokens.some((token) => token.id !== actorToken.id)
  ) return { ok: false, reason: 'invalid-target' }
  const isUndeadOrConstruct = (creatureType: string | undefined) =>
    ['构装体', 'construct', '亡灵', 'undead'].includes((creatureType ?? '').toLowerCase())
  if (
    ((spell.id === 'false-life' || spell.id === 'blur' || spell.id === 'divine-favor' || spell.id === 'shillelagh') && targetToken.id !== actorToken.id) ||
    (spell.id === 'spare-the-dying' && (
      targetCombatant.currentHp !== 0 || targetCombatant.deathSaves.dead || isUndeadOrConstruct(targetCombatant.creatureType)
    )) ||
    (spell.id === 'hold-person' && targetCombatants.some((combatant) => {
      const type = (combatant.creatureType ?? '').toLowerCase()
      return type !== 'humanoid' && !type.includes('类人')
    })) ||
    (spell.id === 'hold-monster' && targetCombatants.some((combatant) => ['亡灵', 'undead'].includes((combatant.creatureType ?? '').toLowerCase())))
  ) return { ok: false, reason: 'invalid-target' }
  if (
    spell.id === 'shillelagh' &&
    actor.equipment?.mainWeapon?.id !== 'dnd5e-club' &&
    actor.equipment?.mainWeapon?.id !== 'dnd5e-quarterstaff'
  ) return { ok: false, reason: 'invalid-target' }
  if (
    spell.id === 'magic-weapon' &&
    (!targetCombatant.mainWeaponId || targetCombatant.mainWeaponMagical)
  ) return { ok: false, reason: 'invalid-target' }
  const healingAllocations = payload.healingAllocations?.map((allocation) => ({
    targetId: allocation.targetTokenId,
    amount: allocation.amount,
  }))
  if (spell.effect === 'healing-pool') {
    if (
      !healingAllocations || healingAllocations.length !== requestedTargetIds.length ||
      new Set(healingAllocations.map((allocation) => allocation.targetId)).size !== healingAllocations.length ||
      healingAllocations.some((allocation) =>
        !requestedTargetIds.includes(allocation.targetId) || !Number.isInteger(allocation.amount) || allocation.amount <= 0
      ) ||
      healingAllocations.reduce((sum, allocation) => sum + allocation.amount, 0) > (spell.healingPool ?? 0)
    ) return { ok: false, reason: 'invalid-action' }
  } else if (healingAllocations?.length) return { ok: false, reason: 'invalid-action' }
  const areaCell = payload.areaTargetCell
  const effectOrigin = spell.area?.origin === 'point' && areaCell
    ? {
        x: input.map.gridOffsetX + (areaCell.col + 0.5) * input.map.gridSize,
        y: input.map.gridOffsetY + (areaCell.row + 0.5) * input.map.gridSize,
      }
    : spellOriginToken
  const effectOriginElevation = spell.area?.origin === 'point' && areaCell
    ? input.action.targetElevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, effectOrigin)
    : mapGeometryTokenElevation(geometry, spellOriginToken)
  if (validTargetTokens.some((currentTarget) => mapGeometryLineOfEffectBlocked({
    geometry,
    map: input.map,
    from: effectOrigin,
    to: currentTarget,
    fromElevationFeet: effectOriginElevation,
    toElevationFeet: mapGeometryTokenElevation(geometry, currentTarget),
  }))) return { ok: false, reason: 'effect-line-blocked' }
  if (entityAttackOriginToken) {
    const pairKey = dnd5eCombatantPairKey(actorToken.id, targetToken.id)
    snapshot.state.distanceFeetByCombatantPair ??= {}
    snapshot.state.distanceFeetByCombatantPair[pairKey] = distanceFeet
    const cover = mapGeometryCoverFromPoint({
      geometry,
      from: effectOrigin,
      to: targetToken,
      fromElevationFeet: effectOriginElevation,
      toElevationFeet: mapGeometryTokenElevation(geometry, targetToken),
    })
    applyDnd5eAttackCoverOverride(
      snapshot.state,
      actorToken.id,
      targetToken.id,
      cover.blocksLineOfEffect
        ? 'total'
        : cover.armorClassBonus === 5
          ? 'three-quarters'
          : cover.armorClassBonus === 2
            ? 'half'
            : 'none',
    )
  }
  if (spell.saveAbility === 'dex' && spell.id !== 'sacred-flame') {
    for (const currentTarget of validTargetTokens) {
      const combatant = snapshot.state.combatants[currentTarget.id]
      const cover = mapGeometryCoverFromPoint({
        geometry,
        from: effectOrigin,
        to: currentTarget,
        fromElevationFeet: effectOriginElevation,
        toElevationFeet: mapGeometryTokenElevation(geometry, currentTarget),
      })
      if (cover.armorClassBonus > 0) {
        combatant.savingThrowBonuses.dex =
          (combatant.savingThrowBonuses.dex ?? rules.abilityModifier(combatant.abilities.dex)) + cover.armorClassBonus
      }
    }
  }
  for (const [tokenId, economy] of Object.entries(input.turnEconomyByToken ?? {})) {
    const combatant = snapshot.state.combatants[tokenId]
    if (!combatant) continue
    combatant.turn = {
      ...combatant.turn,
      actionAvailable: economy.action.current > 0,
      bonusActionAvailable: economy.bonusAction.current > 0,
      reactionAvailable: economy.reaction.current > 0,
      movementRemaining: economy.movement.current,
    }
  }
  if (input.turnEconomy) {
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }
  const abilityModifier = rules.abilityModifier(actor.abilities[spellcastingAbility])
  const spellAttackModifier = itemSpellEffect?.spellAttackBonus ??
    rules.proficiencyBonus(actor.level) + abilityModifier
  const spellSaveDc = itemSpellEffect?.spellSaveDc ??
    8 + rules.proficiencyBonus(actor.level) + abilityModifier
  const baseDamageDiceCounts = sustainedAttack || spell.sustainedAttack?.immediateAttack
    ? [dnd5eSustainedSpellAttackDiceCount(spell, slotLevel, actor.level)]
    : dnd5eSpellDamageDiceCounts(
        spell,
        actor.level,
        slotLevel,
        payload.higherSlotDamageType,
      )
  const damageDiceCounts = spell.id === 'enhance-ability'
    ? [enhanceAbilityChoice === 'bear-endurance' ? 2 : 0]
    : spell.id === 'call-lightning' && geometry?.weather === 'storm'
      ? [baseDamageDiceCounts[0] + 1, ...baseDamageDiceCounts.slice(1)]
      : baseDamageDiceCounts
  const usesSpellAttackRoll = spell.effect === 'spell-attack' ||
    sustainedAttack?.resolution === 'spell-attack' ||
    (sustainedAttack != null && sustainedAttack.resolution == null)
  const effectiveSavingThrowModifier = (
    combatant: typeof targetCombatant,
    ability: AbilityKey,
  ) => (combatant.savingThrowBonuses[ability] ??
    rules.abilityModifier(combatant.abilities[ability])) +
    dnd5eActiveSavingThrowBonus(combatant.classState.activeEffects, ability)
  const openingAttackSavingThrowFor = (
    currentTarget: typeof targetCombatant,
  ): PreparedDnd5eOpeningAttackSavingThrow | undefined => {
    const requirement = dnd5eOpeningAttackSavingThrowRequirement(
      snapshot.state,
      actorCombatant,
      currentTarget,
    )
    return requirement ? {
      featureId: requirement.featureId,
      ability: requirement.ability,
      dc: requirement.dc,
      modifier: effectiveSavingThrowModifier(currentTarget, requirement.ability),
      mode: dnd5eSavingThrowMode(currentTarget, requirement.ability),
      blessed: dnd5eCombatantHasConcentrationEffect(
        snapshot.state,
        currentTarget.id,
        'bless',
      ),
      baned: dnd5eCombatantHasConcentrationEffect(
        snapshot.state,
        currentTarget.id,
        'bane',
      ),
      failureDamageMultiplier: requirement.failureDamageMultiplier,
    } : undefined
  }
  const spellAttackDelivery = dnd5eSpellAttackDelivery(spell, sustainedAttack)
  const rangedSpellThreatened = usesSpellAttackRoll && spellAttackDelivery === 'ranged' && input.map.tokens.some((candidate) => {
    const candidateCombatant = snapshot.state.combatants[candidate.id]
    return candidate.id !== actorToken.id && candidate.type !== 'obstacle' && areOpposedCombatTokens(actorToken, candidate) &&
      dnd5eMapTokenCanThreatenRangedAttacker(actorCombatant, candidate, candidateCombatant) &&
      dnd5eMapTokenDistanceFeet({
        map: input.map,
        geometry,
        left: actorToken,
        right: candidate,
      }) <= 5
  })
  const actorProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const targetProne = targetCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const advantageAllowed = !dnd5ePreventsAttackAdvantage(targetCombatant)
  const actorAttackRollEffect = dnd5eActiveAttackRollFlags(
    actorCombatant.classState.activeEffects,
  )
  const targetLinkedAttackAdvantage = dnd5eActiveTargetLinkedAttackRollFlags(
    targetCombatant.classState.activeEffects,
    actorCombatant.id,
    actorCombatant.creatureType,
  ).advantage
  const attackModeResolution = usesSpellAttackRoll && metamagic?.kind !== 'twinned' && spell.id !== 'eldritch-blast'
    ? resolveDnd5eRollMode({
        advantage: [
          ...dnd5eTargetAttackAdvantageReasons(targetCombatant)
            .map((reason) => ({ active: advantageAllowed, reason })),
          { active: advantageAllowed && spell.id === 'shocking-grasp' && targetCombatant.wearingMetalArmor, reason: '电爪攻击穿着金属护甲的目标' },
          { active: advantageAllowed && actorCombatant.classState.hiddenCheckTotal != null, reason: '攻击者处于隐藏状态' },
          { active: advantageAllowed && !!targetCombatant.classState.recklessAttackTurnKey, reason: '目标本回合发动了鲁莽攻击' },
          { active: advantageAllowed && !!targetCombatant.classState.stunnedByActorId, reason: '目标处于震慑状态' },
          { active: advantageAllowed && dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id), reason: '目标看不见攻击者' },
          { active: advantageAllowed && dnd5eHelpAttackApplies(snapshot.state, actorCombatant, targetCombatant), reason: '协助动作' },
          { active: advantageAllowed && dnd5eUtilityProjectionAttackAdvantageApplies(snapshot.state, actorCombatant, targetCombatant), reason: '规则效果提供攻击优势' },
          { active: advantageAllowed && dnd5eNextD20AdvantageApplies(actorCombatant, 'attack'), reason: '下一次 d20 攻击优势' },
          { active: advantageAllowed && targetLinkedAttackAdvantage, reason: '目标关联效果提供攻击优势' },
          { active: advantageAllowed && dnd5ePendingAllyAttackAdvantage(actorCombatant, targetCombatant), reason: '盟友能力提供攻击优势' },
          { active: advantageAllowed && targetProne && distanceFeet <= 5, reason: '目标倒地且攻击者在 5 尺内' },
          { active: advantageAllowed && dnd5eRageAllyMeleeAdvantage(snapshot.state, actorCombatant, targetCombatant, spellAttackDelivery === 'melee'), reason: '狂暴盟友能力提供近战优势' },
          { active: advantageAllowed && dnd5eOpeningAttackHasAdvantage(snapshot.state, actorCombatant, targetCombatant), reason: '首击能力提供优势' },
          ...actorAttackRollEffect.advantageReasons
            .map((reason) => ({ active: advantageAllowed, reason })),
        ],
        disadvantage: [
          { active: rangedSpellThreatened, reason: '远程法术攻击者 5 尺内有敌人' },
          { active: actorCombatant.exhaustionLevel >= 3, reason: '3 级或更高力竭' },
          { active: dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant), reason: '恶毒嘲笑' },
          { active: dnd5eTargetIsDodging(targetCombatant), reason: '目标正在闪避' },
          { active: dnd5eBlurImposesAttackDisadvantage(snapshot.state, actorToken.id, targetToken.id), reason: '目标受朦胧术影响' },
          { active: dnd5eFrightenedAttackDisadvantage(snapshot.state, actorCombatant), reason: '攻击者处于恐慌且能看见恐惧源' },
          { active: dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id), reason: '攻击者看不见目标' },
          { active: actorProne, reason: '攻击者处于倒地状态' },
          { active: targetProne && distanceFeet > 5, reason: '目标倒地且攻击距离超过 5 尺' },
          { active: dnd5eSourceMarkedAttackDisadvantage(actorCombatant, targetCombatant), reason: '攻击受到标记类能力限制' },
          { active: dnd5eRageAllyProtectionDisadvantage(snapshot.state, actorCombatant, targetCombatant), reason: '目标受到盟友保护能力影响' },
          ...actorAttackRollEffect.disadvantageReasons
            .map((reason) => ({ active: true, reason })),
        ],
      })
    : undefined
  const attackMode = attackModeResolution?.mode
  const sequencedSpellAttackTargets = dnd5eSpellUsesSequencedAttacks(spell)
    ? projectileTargetIds!.map((targetId) => validTargetTokens.find((token) => token.id === targetId)!)
    : validTargetTokens
  const targetSpellAttacks = usesSpellAttackRoll &&
    (metamagic?.kind === 'twinned' || dnd5eSpellUsesSequencedAttacks(spell))
    ? sequencedSpellAttackTargets.map((currentTargetToken, targetIndex) => {
        const currentTarget = snapshot.state.combatants[currentTargetToken.id]!
        const currentDistanceFeet = dnd5eMapTokenDistanceFeet({
          map: input.map,
          geometry,
          left: actorToken,
          right: currentTargetToken,
        })
        const currentTargetProne = currentTarget.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
        const targetLinkedAttackRollAdvantage =
          dnd5eActiveTargetLinkedAttackRollFlags(
            currentTarget.classState.activeEffects,
            actorCombatant.id,
            actorCombatant.creatureType,
          ).advantage &&
          !sequencedSpellAttackTargets.slice(0, targetIndex)
            .some((earlierTarget) => earlierTarget.id === currentTarget.id)
        const currentAdvantageAllowed = !dnd5ePreventsAttackAdvantage(currentTarget)
        const modeResolution = resolveDnd5eRollMode({
          advantage: [
            ...dnd5eTargetAttackAdvantageReasons(currentTarget)
              .map((reason) => ({ active: currentAdvantageAllowed, reason })),
            { active: currentAdvantageAllowed && spell.id === 'shocking-grasp' && currentTarget.wearingMetalArmor, reason: '电爪攻击穿着金属护甲的目标' },
            { active: currentAdvantageAllowed && targetIndex === 0 && actorCombatant.classState.hiddenCheckTotal != null, reason: '攻击者处于隐藏状态' },
            { active: currentAdvantageAllowed && !!currentTarget.classState.recklessAttackTurnKey, reason: '目标本回合发动了鲁莽攻击' },
            { active: currentAdvantageAllowed && !!currentTarget.classState.stunnedByActorId, reason: '目标处于震慑状态' },
            { active: currentAdvantageAllowed && dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, currentTarget.id), reason: '目标看不见攻击者' },
            { active: currentAdvantageAllowed && dnd5eHelpAttackApplies(snapshot.state, actorCombatant, currentTarget), reason: '协助动作' },
            { active: currentAdvantageAllowed && dnd5eUtilityProjectionAttackAdvantageApplies(snapshot.state, actorCombatant, currentTarget), reason: '规则效果提供攻击优势' },
            { active: currentAdvantageAllowed && dnd5eNextD20AdvantageApplies(actorCombatant, 'attack'), reason: '下一次 d20 攻击优势' },
            { active: currentAdvantageAllowed && targetLinkedAttackRollAdvantage, reason: '目标关联效果提供攻击优势' },
            { active: currentAdvantageAllowed && dnd5ePendingAllyAttackAdvantage(actorCombatant, currentTarget), reason: '盟友能力提供攻击优势' },
            { active: currentAdvantageAllowed && currentTargetProne && currentDistanceFeet <= 5, reason: '目标倒地且攻击者在 5 尺内' },
            { active: currentAdvantageAllowed && dnd5eRageAllyMeleeAdvantage(snapshot.state, actorCombatant, currentTarget, spellAttackDelivery === 'melee'), reason: '狂暴盟友能力提供近战优势' },
            { active: currentAdvantageAllowed && dnd5eOpeningAttackHasAdvantage(snapshot.state, actorCombatant, currentTarget), reason: '首击能力提供优势' },
            ...actorAttackRollEffect.advantageReasons
              .map((reason) => ({ active: currentAdvantageAllowed, reason })),
          ],
          disadvantage: [
            { active: rangedSpellThreatened, reason: '远程法术攻击者 5 尺内有敌人' },
            { active: actorCombatant.exhaustionLevel >= 3, reason: '3 级或更高力竭' },
            { active: targetIndex === 0 && dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant), reason: '恶毒嘲笑' },
            { active: dnd5eTargetIsDodging(currentTarget), reason: '目标正在闪避' },
            { active: dnd5eBlurImposesAttackDisadvantage(snapshot.state, actorToken.id, currentTarget.id), reason: '目标受朦胧术影响' },
            { active: dnd5eFrightenedAttackDisadvantage(snapshot.state, actorCombatant), reason: '攻击者处于恐慌且能看见恐惧源' },
            { active: dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, currentTarget.id), reason: '攻击者看不见目标' },
            { active: actorProne, reason: '攻击者处于倒地状态' },
            { active: currentTargetProne && currentDistanceFeet > 5, reason: '目标倒地且攻击距离超过 5 尺' },
            { active: dnd5eSourceMarkedAttackDisadvantage(actorCombatant, currentTarget), reason: '攻击受到标记类能力限制' },
            { active: dnd5eRageAllyProtectionDisadvantage(snapshot.state, actorCombatant, currentTarget), reason: '目标受到盟友保护能力影响' },
            ...actorAttackRollEffect.disadvantageReasons
              .map((reason) => ({ active: true, reason })),
          ],
        })
        return {
          targetToken: currentTargetToken,
          mode: modeResolution.mode,
          modeResolution,
          armorClass: dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, currentTargetToken.id, 'spell'),
          openingAttackSavingThrow:
            openingAttackSavingThrowFor(currentTarget),
        }
      })
    : undefined
  const savingThrowAbility = spell.saveAbility ?? spell.unwillingSaveAbility
  const unwillingTargetTokens = spell.unwillingSaveAbility
    ? validTargetTokens.filter((candidate) => areOpposedCombatTokens(actorToken, candidate))
    : []
  const hiddenSpellSaveDisadvantage =
    sustainedAttack == null &&
    dnd5eHiddenSpellSaveDisadvantageApplies(actorCombatant)
  const hideousLaughterTargetUnaffected =
    spell.id === 'hideous-laughter' && targetCombatant.abilities.int <= 4
  const spellSavingThrowMode = (combatant: typeof targetCombatant, targetId: string) => {
    const savingThrowTargetToken = validTargetTokens.find((candidate) => candidate.id === targetId)
    const sourceDistanceFeet = savingThrowTargetToken
      ? tokenFootprintDistanceCells(actorToken, savingThrowTargetToken, input.map) *
        Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
      : undefined
    let mode = dnd5eHeightenedSavingThrowMode(
      dnd5eSavingThrowMode(combatant, savingThrowAbility!, {
        effectVisible: true,
        sourceCreatureType: actorCombatant.creatureType,
        sourceIsSpell: true,
        sourceDistanceFeet,
      }),
      heightenedTargetId === targetId || hiddenSpellSaveDisadvantage,
    )
    mode = dnd5eSpellSpecificSavingThrowMode({
      spellId: spell.id,
      mode,
      casterAndTargetAreFighting: actorCombatant.controller !== combatant.controller,
      targetStatBlockId: combatant.statBlockId,
      targetName: combatant.name,
      targetCreatureType: combatant.creatureType,
    })
    const creatureType = (combatant.creatureType ?? '').trim().toLowerCase()
    if (spell.id === 'blight' && (creatureType === 'plant' || creatureType.includes('植物'))) {
      mode = dnd5eHeightenedSavingThrowMode(mode, true)
    }
    if (dnd5eSpellSavePressureApplies(actorCombatant, combatant)) {
      mode = imposeDnd5eRollDisadvantage(mode, 'weapon-hit-save-pressure').mode
    }
    return mode
  }
  const usesSingleSavingThrow = (
    spell.effect === 'saving-throw' &&
    validTargetTokens.length === 1 &&
    sculptedTargetIds.length === 0 &&
    carefulTargetIds.length === 0 &&
    !hideousLaughterTargetUnaffected
  ) || (
    spell.effect === 'active-effect' &&
    unwillingTargetTokens.length === 1 &&
    validTargetTokens.length === 1
  )
  const savingThrow = usesSingleSavingThrow
    ? {
        modifier: effectiveSavingThrowModifier(targetCombatant, savingThrowAbility!),
        dc: spellSaveDc,
        mode: spellSavingThrowMode(targetCombatant, targetToken.id),
      }
    : undefined
  const targetSavingThrows = spell.effect === 'attack-save-debuff' ||
    (spell.effect === 'saving-throw' &&
      (validTargetTokens.length > 1 || sculptedTargetIds.length > 0 || carefulTargetIds.length > 0)) ||
    (spell.effect === 'active-effect' && unwillingTargetTokens.length > 0 && validTargetTokens.length > 1)
    ? (spell.effect === 'active-effect' ? unwillingTargetTokens : validTargetTokens).filter((currentTargetToken) =>
      !sculptedTargetIdSet.has(currentTargetToken.id) && !carefulTargetIdSet.has(currentTargetToken.id),
    ).map((currentTargetToken) => {
        const currentTarget = snapshot.state.combatants[currentTargetToken.id]!
        return {
          targetToken: currentTargetToken,
          modifier: effectiveSavingThrowModifier(currentTarget, savingThrowAbility!),
          dc: spellSaveDc,
          mode: spellSavingThrowMode(currentTarget, currentTargetToken.id),
          blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, currentTargetToken.id, 'bless'),
          baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, currentTargetToken.id, 'bane'),
        }
      })
    : undefined
  const includeNatureSanctuary = usesSpellAttackRoll
  const hostileAction = spell.target === 'hostile' || sustainedAttack != null
  const targetTranquilityWards = hostileAction &&
    (spell.effect === 'attack-save-debuff' || validTargetTokens.length > 1)
    ? validTargetTokens.flatMap((currentTargetToken) => {
        const ward = dnd5eTranquilityWardCheck(
          actorCombatant,
          snapshot.state.combatants[currentTargetToken.id]!,
          snapshot.state,
          includeNatureSanctuary,
        )
        return ward ? [{ targetToken: currentTargetToken, ward }] : []
      })
    : undefined
  return {
    ok: true,
    prepared: {
      action: input.action,
      map: sustainedAreaMovement?.ok ? sustainedAreaMovement.map : input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      focusItemInstanceId,
      spellMaterialPlan,
      itemSpellSource,
      castingClassId,
      castingClassLevel,
      racialInnate: racialGrant != null,
      racialGrant,
      alternateResourceSpell,
      ritual: ritual || undefined,
      spellcastingAbility,
      spellAttackModifier,
      spellSaveDc,
      actorToken,
      targetToken,
      targetTokens: validTargetTokens,
      guessedTargetCell,
      blindTargetMiss,
      projectileTargetIds,
      spell,
      activity: runtimeDefinition!.activity,
      slotLevel,
      diceCount: damageDiceCounts[0],
      damageDiceCounts,
      delayedDamageDiceCount: dnd5eSpellDelayedDamageDiceCount(spell, slotLevel),
      higherSlotDamageType: payload.higherSlotDamageType,
      effectBonus: spell.dice.bonus + (spell.bonusPerDie ? diceCount : 0) +
        (spell.addSpellcastingModifier ? abilityModifier : 0) +
        (spell.id === 'eldritch-blast' && invocations.includes('agonizing-blast') ? abilityModifier : 0),
      attackMode,
      attackModeResolution,
      targetSpellAttacks,
      openingAttackSavingThrow: attackMode
        ? openingAttackSavingThrowFor(targetCombatant)
        : undefined,
      attackBlessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      attackBaned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
      savingThrow,
      savingThrowBlessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetToken.id, 'bless'),
      savingThrowBaned: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetToken.id, 'bane'),
      targetSavingThrows,
      tranquilityWard: hostileAction && spell.effect !== 'attack-save-debuff' && validTargetTokens.length === 1
        ? dnd5eTranquilityWardCheck(actorCombatant, targetCombatant, snapshot.state, includeNatureSanctuary)
        : undefined,
      targetTranquilityWards,
      overchannel,
      damageMaximizationFeatureId: damageMaximizationFeature?.id,
      maximizedDamage,
      overchannelSelfDamageDiceCount,
      sculptedTargetIds,
      metamagic,
      empowered,
      carefulTargetIds,
      draconicResistance,
      repellingBlast,
      conditionChoice,
      effectDamageType,
      enlargeReduceChoice,
      enhanceAbilityChoice,
      calmEmotionsMode,
      calmEmotionsIndifferenceScope,
      healingAllocations,
      areaCells,
      areaAnchorCell,
      areaAnchorCells,
      dancingLightsForm,
      areaTargetOrientation: payload.areaTargetOrientation,
      wallOfFireGeometry,
      excludedAreaTargetIds,
      sustainedEffectAttack,
      sustainedEffectAreaId: authorizedSustainedEffectAreaId,
      teleportDestination,
      areaDurationRounds: spell.concentration
        ? Math.min(
            14_400,
            dnd5eSpellConcentrationDurationRounds(spell, slotLevel) * (metamagic?.kind === 'extended' ? 2 : 1),
          )
        : spell.effect === 'persistent-area'
          ? Math.min(
              14_400,
              (spell.effectDurationRounds ?? 0) * (metamagic?.kind === 'extended' ? 2 : 1),
            )
          : undefined,
    },
  }
}

export function dnd5eSpellAttackModeWithProtection(
  mode: NonNullable<PreparedDnd5eSpellCast['attackMode']>,
  protectedAttack: boolean,
): NonNullable<PreparedDnd5eSpellCast['attackMode']> {
  return protectedAttack ? imposeDnd5eRollDisadvantage(mode, 'protection').mode : mode
}

export function dnd5eSpellAttackModeResolutionWithProtection(
  resolution: Dnd5eRollModeResolution,
  protectedAttack: boolean,
): Dnd5eRollModeResolution {
  return resolveDnd5eRollMode({
    advantage: resolution.advantageReasons.map((reason) => ({ active: true, reason })),
    disadvantage: [
      ...resolution.disadvantageReasons.map((reason) => ({ active: true, reason })),
      { active: protectedAttack, reason: '保护战斗风格' },
    ],
  })
}

export function previewDnd5eSpellAttack(prepared: PreparedDnd5eSpellCast, d20: number, d20Second?: number, protectedAttack = false, blessRoll?: number, baneRoll?: number, postD20Adjustment?: Dnd5ePostD20AdjustmentUse) {
  if (!prepared.attackMode) throw new TypeError('spell does not use a spell attack')
  const mode = dnd5eSpellAttackModeWithProtection(prepared.attackMode, protectedAttack)
  const rolls = mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const targetAc = dnd5eTargetArmorClassForAttack(
    prepared.state,
    prepared.actorToken.id,
    prepared.targetToken.id,
    'spell',
  )
  return previewDnd5ePostD20AdjustedAttack({
    state: prepared.state,
    affectedId: prepared.actorToken.id,
    targetAc,
    resolution: rules.resolveAttack({
      rolls,
      mode,
      modifier: prepared.spellAttackModifier + (blessRoll ?? 0) - (baneRoll ?? 0),
      targetAc,
    }),
    use: postD20Adjustment,
  })
}

export function previewDnd5eSpellTargetAttack(
  prepared: PreparedDnd5eSpellCast,
  targetIndex: number,
  d20: number,
  d20Second?: number,
  protectedAttack = false,
  blessRoll?: number,
  baneRoll?: number,
  postD20Adjustment?: Dnd5ePostD20AdjustmentUse,
) {
  const target = prepared.targetSpellAttacks?.[targetIndex]
  if (!target) throw new RangeError('spell does not use a target spell attack at this index')
  const mode = dnd5eSpellAttackModeWithProtection(target.mode, protectedAttack)
  const rolls = mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  return previewDnd5ePostD20AdjustedAttack({
    state: prepared.state,
    affectedId: target.targetToken.id,
    targetAc: target.armorClass,
    resolution: rules.resolveAttack({
      rolls,
      mode,
      modifier: prepared.spellAttackModifier + (blessRoll ?? 0) - (baneRoll ?? 0),
      targetAc: target.armorClass,
    }),
    use: postD20Adjustment,
  })
}

export function previewDnd5eSpellSavingThrow(prepared: PreparedDnd5eSpellCast, d20: number, d20Second?: number, blessRoll?: number, baneRoll?: number, postD20Adjustment?: Dnd5ePostD20AdjustmentUse) {
  if (!prepared.savingThrow) throw new TypeError('spell does not use a saving throw')
  const ability = prepared.spell.saveAbility ?? prepared.spell.unwillingSaveAbility
  if (!ability) throw new TypeError('spell does not define a saving throw ability')
  const rolls = prepared.savingThrow.mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const target = prepared.state.combatants[prepared.targetToken.id]
  const shieldSoleTargetDexteritySaveBonus = target && ability === 'dex' &&
    prepared.targetTokens.length === 1 && prepared.spell.target !== 'area' && prepared.spell.area == null &&
    target.shieldDexteritySaveBonusWhenSoleTarget === true && target.hasShield &&
    target.currentHp > 0 && !dnd5eIsIncapacitated(target)
    ? 2
    : 0
  const resolved = previewDnd5ePostD20AdjustedSavingThrow({
    state: prepared.state,
    affectedId: prepared.targetToken.id,
    resolution: rules.resolveSavingThrow({ rolls, mode: prepared.savingThrow.mode, modifier: prepared.savingThrow.modifier + (blessRoll ?? 0) - (baneRoll ?? 0) + shieldSoleTargetDexteritySaveBonus, dc: prepared.savingThrow.dc }),
    use: postD20Adjustment,
  })
  return target && dnd5eConditionSavingThrowAutomaticallyFails(target, ability)
    ? { ...resolved, success: false }
    : resolved
}

export function previewDnd5eSpellTargetSavingThrow(
  prepared: PreparedDnd5eSpellCast,
  targetIndex: number,
  d20: number,
  d20Second?: number,
  blessRoll?: number,
  baneRoll?: number,
  postD20Adjustment?: Dnd5ePostD20AdjustmentUse,
) {
  const savingThrow = prepared.targetSavingThrows?.[targetIndex]
  if (!savingThrow) throw new RangeError('spell does not use a target saving throw at this index')
  const ability = prepared.spell.saveAbility ?? prepared.spell.unwillingSaveAbility
  if (!ability) throw new TypeError('spell does not define a saving throw ability')
  const rolls = savingThrow.mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const resolved = previewDnd5ePostD20AdjustedSavingThrow({
    state: prepared.state,
    affectedId: savingThrow.targetToken.id,
    resolution: rules.resolveSavingThrow({
      rolls,
      mode: savingThrow.mode,
      modifier: savingThrow.modifier + (blessRoll ?? 0) - (baneRoll ?? 0),
      dc: savingThrow.dc,
    }),
    use: postD20Adjustment,
  })
  const target = prepared.state.combatants[savingThrow.targetToken.id]
  return target && dnd5eConditionSavingThrowAutomaticallyFails(target, ability)
    ? { ...resolved, success: false }
    : resolved
}

export function resolvePreparedDnd5eSpellCast(input: {
  prepared: PreparedDnd5eSpellCast
  /** Host-owned roll required by an active Slow action-spell delay modifier. */
  slowSpellDelayD20?: number
  opportunityAttackSpell?: boolean
  mountedAttackRedirect?: Dnd5eMountedAttackRedirectUse
  d20?: number
  d20Second?: number
  halflingLuckyD20?: number
  halflingLuckyD20Second?: number
  openingAttackSavingThrow?: Dnd5eOpeningAttackSavingThrowRoll
  attackBlessRoll?: number
  attackBaneRoll?: number
  cuttingWords?: Dnd5eCuttingWordsUse
  cuttingWordsDamage?: Dnd5eCuttingWordsUse
  attackPostD20Adjustment?: Dnd5ePostD20AdjustmentUse
  standAgainstTide?: Dnd5eStandAgainstTideUse
  savingThrowD20?: number
  savingThrowD20Second?: number
  savingThrowBlessRoll?: number
  savingThrowBaneRoll?: number
  savingThrowPostD20Adjustment?: Dnd5ePostD20AdjustmentUse
  targetSavingThrows?: readonly Dnd5eSpellTargetSavingThrowRoll[]
  forcedMovements?: readonly Dnd5eSpellForcedMovement[]
  targetAttacks?: readonly Dnd5eSpellTargetAttackRoll[]
  empoweredRerolls?: readonly Dnd5eEmpoweredSpellReroll[]
  spellDamageMaxDieBonus?: Dnd5eSpellDamageMaxDieBonusUse
  bestowCurseDamageRolls?: readonly { targetId: string; rolls: readonly number[] }[]
  targetTranquilitySaves?: readonly Dnd5eTargetTranquilitySaveRoll[]
  savingThrowRerollD20?: number
  savingThrowRerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
  optionalBonusDice?: readonly Dnd5eOptionalBonusDieUse[]
  damageMitigationInterrupts?: readonly Dnd5eDamageMitigationInterruptUse[]
  hurlThroughHellDamageRolls?: readonly number[]
  overchannelSelfDamageRolls?: readonly number[]
  protectionReactionActorId?: string
  shieldSpellReaction?: boolean
  counterspellReaction?: Dnd5eCounterspellReaction
  spellInterceptionReaction?: Dnd5eSpellInterceptionReaction
  shieldSpellReactionTargetIds?: readonly string[]
  shieldSuccessfulSaveNegationTargetIds?: readonly string[]
  legendaryResistanceTargetIds?: readonly string[]
  dispelMagicChecks?: readonly Dnd5eDispelMagicCheck[]
  tranquilitySave?: Dnd5eTranquilitySaveRoll
  uncannyDodge?: boolean
  effectRolls: readonly number[]
  additionalEffectRolls?: readonly (readonly number[])[]
  delayedEffectRolls?: readonly number[]
  airborneFallDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
  attackDecoyRolls?: readonly import('./headlessCombatEngine').Dnd5eAttackDecoyOccurrenceRoll[]
}): {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  airborneFalls?: readonly Dnd5eUnsupportedAirborneFallPreview[]
} {
  const { prepared } = input
  const action = {
    type: 'cast-spell',
    actorId: prepared.actorToken.id,
    itemSpellSource: prepared.itemSpellSource ? {
      instanceId: prepared.itemSpellSource.instanceId,
      useActionId: prepared.itemSpellSource.useActionId,
      itemName: prepared.itemSpellSource.itemName,
      economy: prepared.itemSpellSource.economy,
    } : undefined,
    spellAttackModifier: prepared.spellAttackModifier,
    spellSaveDc: prepared.spellSaveDc,
    castingClassId: prepared.castingClassId,
    racialInnate: prepared.racialInnate || undefined,
    opportunityAttackSpell: input.opportunityAttackSpell,
    ritual: prepared.ritual,
    mountedAttackRedirect: input.mountedAttackRedirect,
    alternateResourceSpell: prepared.alternateResourceSpell ? {
      featureId: prepared.alternateResourceSpell.featureId,
      grantId: prepared.alternateResourceSpell.grantId,
    } : undefined,
    targetId: prepared.targetToken.id,
    targetIds: prepared.targetTokens.map((target) => target.id),
    blindTargetMiss: prepared.blindTargetMiss || undefined,
    projectileTargetIds: prepared.projectileTargetIds,
    sculptedTargetIds: prepared.sculptedTargetIds,
    metamagic: prepared.metamagic,
    empowered: prepared.empowered,
    empoweredRerolls: input.empoweredRerolls,
    spellDamageMaxDieBonus: input.spellDamageMaxDieBonus,
    bestowCurseDamageRolls: input.bestowCurseDamageRolls,
    draconicResistance: prepared.draconicResistance,
    repellingBlast: prepared.repellingBlast,
    conditionChoice: prepared.conditionChoice,
    effectDamageType: prepared.effectDamageType,
    enlargeReduceChoice: prepared.enlargeReduceChoice,
    enhanceAbilityChoice: prepared.enhanceAbilityChoice,
    calmEmotionsMode: prepared.calmEmotionsMode,
    calmEmotionsIndifferenceScope: prepared.calmEmotionsIndifferenceScope,
    sustainedEffectAttack: prepared.sustainedEffectAttack,
    sustainedEffectAreaId: prepared.sustainedEffectAreaId,
    healingAllocations: prepared.healingAllocations,
    counterspellReaction: input.counterspellReaction,
    spellInterceptionReaction: input.spellInterceptionReaction,
    spellId: prepared.spell.id,
    slotLevel: prepared.slotLevel,
    slowSpellDelayD20: input.slowSpellDelayD20,
    higherSlotDamageType: prepared.higherSlotDamageType,
    d20: input.d20,
    d20Second: input.d20Second,
    halflingLuckyD20: input.halflingLuckyD20,
    halflingLuckyD20Second: input.halflingLuckyD20Second,
    openingAttackSavingThrow: input.openingAttackSavingThrow,
    attackBlessRoll: input.attackBlessRoll,
    attackBaneRoll: input.attackBaneRoll,
    cuttingWords: input.cuttingWords,
    cuttingWordsDamage: input.cuttingWordsDamage,
    attackPostD20Adjustment: input.attackPostD20Adjustment,
    standAgainstTide: input.standAgainstTide,
    mode: prepared.attackMode,
    targetAttacks: input.targetAttacks,
    protectionReactionActorId: input.protectionReactionActorId,
    shieldSpellReaction: input.shieldSpellReaction,
    shieldSpellReactionTargetIds: input.shieldSpellReactionTargetIds,
    shieldSuccessfulSaveNegationTargetIds: input.shieldSuccessfulSaveNegationTargetIds,
    legendaryResistanceTargetIds: input.legendaryResistanceTargetIds,
    dispelMagicChecks: input.dispelMagicChecks,
    tranquilitySave: input.tranquilitySave,
    targetTranquilitySaves: input.targetTranquilitySaves,
    savingThrowD20: input.savingThrowD20,
    savingThrowD20Second: input.savingThrowD20Second,
    savingThrowBlessRoll: input.savingThrowBlessRoll,
    savingThrowBaneRoll: input.savingThrowBaneRoll,
    savingThrowPostD20Adjustment: input.savingThrowPostD20Adjustment,
    targetSavingThrows: input.targetSavingThrows,
    forcedMovements: input.forcedMovements,
    teleportDestination: prepared.teleportDestination,
    savingThrowRerollD20: input.savingThrowRerollD20,
    savingThrowRerollD20Second: input.savingThrowRerollD20Second,
    bardicInspirationRoll: input.bardicInspirationRoll,
    darkOnesOwnLuckRoll: input.darkOnesOwnLuckRoll,
    optionalBonusDice: input.optionalBonusDice,
    damageMitigationInterrupts: input.damageMitigationInterrupts,
      hurlThroughHellDamageRolls: input.hurlThroughHellDamageRolls,
      overchannel: input.prepared.overchannel,
      damageMaximizationFeatureId: input.prepared.damageMaximizationFeatureId,
      overchannelSelfDamageRolls: input.overchannelSelfDamageRolls,
      uncannyDodge: input.uncannyDodge,
    effectRolls: input.effectRolls,
    additionalEffectRolls: input.additionalEffectRolls,
    delayedEffectRolls: input.delayedEffectRolls,
    airborneFallDamageRollsByCombatantId: input.airborneFallDamageRollsByCombatantId,
    attackDecoyRolls: input.attackDecoyRolls,
  } as Dnd5eAction
  const resolutionState = prepared.state
  const fallPreview = input.airborneFallDamageRollsByCombatantId == null
    ? previewDnd5eUnsupportedAirborneFalls(resolutionState, action)
    : undefined
  const airborneFalls = fallPreview?.ok ? fallPreview.falls : undefined
  let result = resolveDnd5eHeadlessAction(resolutionState, action)
  if (!result.ok) return { result, airborneFalls }
  let settlementCharacters = prepared.characters
  if (prepared.itemSpellSource) {
    const sourceIndex = settlementCharacters.findIndex((character) => character.id === prepared.actor.id)
    if (sourceIndex < 0) {
      return {
        result: { ok: false, state: prepared.state, events: [], reason: 'invalid-actor' },
        airborneFalls,
      }
    }
    const spent = applyDnd5eInventoryActivityCosts(settlementCharacters[sourceIndex], {
      instanceId: prepared.itemSpellSource.instanceId,
      costs: prepared.itemSpellSource.costs,
      receiptId: prepared.action.id,
      expectedInventoryRevision: prepared.itemSpellSource.expectedInventoryRevision,
    })
    if (!spent.ok) {
      return {
        result: { ok: false, state: prepared.state, events: [], reason: 'item-resource-unavailable' },
        airborneFalls,
      }
    }
    settlementCharacters = settlementCharacters.map((character, index) =>
      index === sourceIndex ? spent.character : character,
    )
    if (spent.lastChargeChecks?.length) {
      result = {
        ...result,
        events: [
          ...result.events,
          ...spent.lastChargeChecks.map((check) => ({
            type: 'item-last-charge-check' as const,
            actorId: prepared.actorToken.id,
            itemInstanceId: prepared.itemSpellSource!.instanceId,
            itemName: prepared.itemSpellSource!.itemName,
            ...check,
          })),
        ],
      }
    }
  }
  if (prepared.spellMaterialPlan) {
    const currentActor = settlementCharacters.find((character) => character.id === prepared.actor.id)
    const settled = settleDnd5eSpellMaterialConsumption(
      settlementCharacters,
      prepared.actor.id,
      prepared.spellMaterialPlan,
      prepared.itemSpellSource ? currentActor?.dnd5eInventory?.revision ?? 0 : undefined,
    )
    if (!settled.ok) {
      return {
        result: { ok: false, state: prepared.state, events: [], reason: 'item-resource-unavailable' },
        airborneFalls,
      }
    }
    settlementCharacters = settled.characters
  }
  let application = planDnd5eMapResultApplication({
      state: result.state,
      map: prepared.map,
      characters: settlementCharacters,
      baselineCharacters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
      events: [...result.events],
    })
  const declaration = getDnd5eCoreSpellAreaDeclaration(prepared.spell.id)
  const counterspelled = result.events.some((event) =>
    event.type === 'counterspell-resolved' &&
    event.casterId === prepared.actorToken.id &&
    event.spellId === prepared.spell.id &&
    event.success,
  )
  const slowDelayed = result.events.some((event) =>
    event.type === 'slow-spell-delay-resolved' &&
    event.actorId === prepared.actorToken.id &&
    event.spellId === prepared.spell.id &&
    event.delayed,
  )
  if (
    declaration &&
    prepared.areaCells &&
    prepared.areaAnchorCell &&
    !prepared.sustainedEffectAttack &&
    !counterspelled &&
    !slowDelayed
  ) {
    const actorCombatant = result.state.combatants[prepared.actorToken.id]
    if (actorCombatant) {
      const sourceSaveDc = prepared.spellSaveDc
      const effectTokenId = declaration.anchorMode === 'effect-token'
        ? `core-spell-effect:${prepared.action.id}`
        : undefined
      const coreAreaAnchorCell = declaration.spellId === 'call-lightning'
        ? tokenAnchorCellFromPixel(
            prepared.actorToken.x,
            prepared.actorToken.y,
            prepared.actorToken,
            application.map,
          )
        : prepared.areaAnchorCell
      const coreAreaCells = declaration.spellId === 'call-lightning'
        ? cellsForAoe(declaration.template, coreAreaAnchorCell, coreAreaAnchorCell)
        : prepared.areaCells
      const coreAreaAnchorPoint = tokenCenterForAnchorCell(
        coreAreaAnchorCell,
        { size: 1 },
        application.map,
      )
      const coreAreaGeometry = mapGeometryRuntimeForMap(application.map.id)
      const coreAreaBaseElevationFeet = declaration.anchorMode === 'source-token'
        ? mapGeometryTokenElevation(coreAreaGeometry, prepared.actorToken)
        : prepared.action.targetElevationFeet ??
          mapGeometryTerrainElevationAtPoint(coreAreaGeometry, coreAreaAnchorPoint)
      const wallDamageCells = declaration.spellId === 'wall-of-fire'
        ? prepared.wallOfFireGeometry
          ? dnd5eWallOfFireDamageCells({
              anchor: coreAreaAnchorCell,
              wallCells: coreAreaCells,
              ...prepared.wallOfFireGeometry,
              map: application.map,
            })
          : dnd5eWallOfFireDamagingSideCells({
              wallCells: coreAreaCells,
              orientation: prepared.areaTargetOrientation ?? 0,
              map: application.map,
            })
        : undefined
      const area = createDnd5eCoreSpellArea({
        declaration,
        actionId: prepared.action.id,
        sourceCharacterId: prepared.actor.id,
        sourceTokenId: prepared.actorToken.id,
        castingClassId: prepared.castingClassId,
        slotLevel: prepared.slotLevel,
        sourceSaveDc,
        round: result.state.round,
        cells: coreAreaCells,
        anchorCell: coreAreaAnchorCell,
        baseElevationFeet: coreAreaBaseElevationFeet,
        durationRounds: prepared.areaDurationRounds,
        sourceAlignment: prepared.actor.alignment,
        anchorTokenId: effectTokenId,
        triggerCellsById: wallDamageCells
          ? { 'wall-of-fire-turn-end': wallDamageCells }
          : undefined,
        wallOfFireGeometry: prepared.wallOfFireGeometry,
        lightingAnchorCells: declaration.spellId === 'dancing-lights'
          ? prepared.areaAnchorCells ?? [coreAreaAnchorCell]
          : undefined,
        dancingLightsForm: prepared.dancingLightsForm,
        excludedTargetIds: declaration.spellId === 'spirit-guardians' ? prepared.excludedAreaTargetIds : undefined,
      })
      const effectToken = effectTokenId
        ? {
            id: effectTokenId,
            label: declaration.label,
            ...tokenCenterForAnchorCell(prepared.areaAnchorCell, { size: 1 }, application.map),
            color: declaration.color,
            emoji: prepared.spell.id === 'flaming-sphere'
              ? '🔥'
              : prepared.spell.id === 'spiritual-weapon'
                ? '⚔'
                : '✦',
            size: 1,
            type: 'obstacle' as const,
            elevationFeet: coreAreaBaseElevationFeet,
            showHpOnToken: false,
            showDetailOnToken: false,
            dnd5eSpellEffect: {
              schemaVersion: 1 as const,
              spellId: prepared.spell.id,
              sourceCharacterId: prepared.actor.id,
              sourceTokenId: prepared.actorToken.id,
              createdRound: result.state.round,
              expiresAfterRound: area.expiresAfterRound,
              concentrationId: area.concentrationId,
            },
          }
        : undefined
      const replacesPreviousSameCasterArea = declaration.spellId === 'mage-hand' ||
        declaration.spellId === 'spiritual-weapon'
      const recastReplacedAreas = replacesPreviousSameCasterArea
        ? (application.map.dnd5ePluginAreas ?? []).filter((candidate) =>
            candidate.sourceTokenId === prepared.actorToken.id &&
            candidate.coreSpellId === declaration.spellId,
          )
        : []
      if (recastReplacedAreas.length > 0) {
        const replacedAreaIds = new Set(recastReplacedAreas.map((candidate) => candidate.id))
        actorCombatant.classState.activeEffects = (actorCombatant.classState.activeEffects ?? []).filter((effect) =>
          !effect.stackingKey || !replacedAreaIds.has(effect.stackingKey),
        )
        application = planDnd5eMapResultApplication({
          state: result.state,
          map: prepared.map,
          characters: settlementCharacters,
          baselineCharacters: prepared.characters,
          characterIdByCombatantId: prepared.characterIdByCombatantId,
          events: [...result.events],
        })
      }
      const existingAreas = (application.map.dnd5ePluginAreas ?? []).filter((candidate) => {
        if (candidate.sourceTokenId !== prepared.actorToken.id) return true
        if (candidate.concentrationId) return false
        // Both spells explicitly end the prior same-caster instance on recast.
        // Replace the area, effect token and linked active effect atomically so
        // reconnecting clients cannot expose duplicate controls or entities.
        return !replacesPreviousSameCasterArea || candidate.coreSpellId !== declaration.spellId
      })
      const lightingConflict = resolveDnd5eCoreSpellLightingConflicts(existingAreas, area)
      const endedConcentrationSources = [
        ...lightingConflict.removedAreas,
        ...(!lightingConflict.applied && area.concentrationId ? [area] : []),
      ]
      if (endedConcentrationSources.length > 0) {
        const events = [...result.events]
        for (const endedArea of endedConcentrationSources) {
          if (!endedArea.concentrationId) continue
          const source = result.state.combatants[endedArea.sourceTokenId]
          if (source?.classState.concentrationSpellId === endedArea.concentrationId) {
            endDnd5eConcentration(result.state, source, events)
          }
        }
        result = { ...result, events }
        application = planDnd5eMapResultApplication({
          state: result.state,
          map: prepared.map,
          characters: settlementCharacters,
          baselineCharacters: prepared.characters,
          characterIdByCombatantId: prepared.characterIdByCombatantId,
          events: [...result.events],
        })
      }
      const liveEffectTokenIds = new Set(lightingConflict.areas.flatMap((candidate) =>
        candidate.anchorMode === 'effect-token' && candidate.anchorTokenId ? [candidate.anchorTokenId] : [],
      ))
      application.map = {
        ...application.map,
        tokens: [
          ...application.map.tokens.filter((candidate) =>
            (!candidate.dnd5eSpellEffect || liveEffectTokenIds.has(candidate.id)) &&
            (candidate.dnd5eSpellEffect?.sourceTokenId !== prepared.actorToken.id ||
              !candidate.dnd5eSpellEffect.concentrationId),
          ),
          ...(effectToken && lightingConflict.applied ? [effectToken] : []),
        ],
        dnd5ePluginAreas: lightingConflict.areas,
      }
    }
  }
  return {
    result,
    application,
    airborneFalls,
  }
}
