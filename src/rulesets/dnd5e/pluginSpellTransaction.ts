import{readDnd5eActualConcentrationResolution,completeDnd5eActualPluginTempestuousPhaseFlightWithConcentration}from'./headlessCombatEngine'
import{dnd5eAvailableTempestuousSpellFlight}from'./headlessCombatEngine'
import{dnd5eRulesPluginRegistrySnapshot}from'./pluginApi'
import{completeDnd5eActualPluginTempestuousPhaseFlight,type Dnd5eActualPluginTempestuousFlightContinuation}from'./headlessCombatEngine'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{captureDnd5eActualPluginTempestuousLanding,readDnd5eActualPluginTempestuousLanding,resolveDnd5eActualPluginTempestuousLanding,type Dnd5eActualPluginTempestuousLanding}from'./headlessCombatEngine'
import{withTempestuousCastGeometry}from'./tempestuousCastGeometry'
import{resolveDnd5eActualPluginTempestuousFlight}from'./headlessCombatEngine'
import type{TempestuousSpellFlightIntent}from'./tempestuousSpellFlight'
import{createDnd5eParentEffectClock}from'./activeEffects'
import{readDnd5eActualPluginTempestuousPhase,disposeDnd5eActualPluginTempestuousPhase,type Dnd5eActualPluginTempestuousPhase}from'./headlessCombatEngine'
import{wrapDnd5eMagicTruthPreparedFactory}from'./mastermindMagicTruthParent'
import {applyDnd5eSpellDamageDieRerolls,type Dnd5eSpellDamageDieRerollUse} from './spellDamageDieRerolls'
import { previewDnd5eSourceActionInterruption } from './headlessCombatEngine'
import { previewDnd5eSpellcastingSaves } from './headlessCombatEngine'
import { dnd5eActorEtherealAccess } from './etherealAccess'
import { dnd5eActivityAnimatesSelectedObjects } from './activities/dnd5eObjectAnimationTargeting'
import { dnd5eAnimatedObjectSnapshot } from './animatedObjectSnapshot'
import { annularAreaOverlapsBox } from '../../../shared/annular-area-geometry.mjs'
import { tokenFootprintCells } from '../../lib/gridCombat'
import { bindDnd5eSpellMaterialEffects } from './spellMaterialEffectBindings'
import { dnd5eActiveRevivalPrevented } from './activeEffects'
import { createDnd5eMapHostilityView } from './mapPerceivedHostility'
import {mapGeometryWithObjectSurfaces} from './mapObjectSurfaceGeometry'
import { resolveDnd5eActivityAreaMapSelectionV1 } from './activities/dnd5eActivityMapInteraction'
import { dnd5eActivityGroundWithinVerticalRange } from './activities/dnd5eActivityTargetExclusions'
import { mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import { resolveGroundedSphereElevation } from './activities/groundedSphereElevation'
import { dnd5eMapItemConversionBinding, settleDnd5eMapItemConversion } from './mapItemConversion'
import { dnd5eHasLivingSummonBond } from './livingSummonBond'
import { dnd5eRevivalMaterialWaived } from './revivalMaterialWaiver'
import { dnd5eActivityProtectsRemains } from './undeadCreationProtection'
import { planDnd5eMapObjectFlightAtAnchor, planDnd5eHarmlessObjectPushAtAnchor } from './mapObjectFlight'
import { dnd5eIndependentSpellRulesForCharacter, dnd5eRacialInnateSpellGrant, DND5E_RACIAL_RESOURCE_KEYS } from './racialAutomation'
import { projectSimulacrumCharacterForMapDetail } from './simulacrum'
import { settleDnd5eActivityPhysicalAlterations, dnd5eActivityReachableInventoryOwners } from './activities/dnd5eActivityInventorySettlement'
import { dnd5eActivityPointVisible } from './activityPointVisibility'
import { dnd5eCombatantCanSee } from './headlessCombatEngine'
import { dnd5eAreaTargetSelectionValid } from './activities/dnd5eAreaTargetSelection'
import { reserveDnd5eSpellMaterials, dnd5eSpellMaterialEscrowBinding } from './spellMaterialEscrow'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { dnd5eConditionalSpellMaterialProblems } from './conditionalSpellMaterials'
import { dnd5eCharacterKnownLanguagesV1 } from './buildChoices'
import { resolveSpellAreaObstruction, spellAreaPointElevation, dnd5eAreaPlacementMatchesSurface } from './spellAreaObstruction'
import { mapGeometryRuntimeForMap, mapGeometryTokenElevation, mapGeometryLineOfEffectBlocked } from '../../lib/mapGeometry'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { Dnd5eSpellCastPayload, Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import {
  appendRollLedgerEntry,
  commitCombatTransaction,
  createCombatTransaction,
  rollbackCombatTransaction,
  type CombatTransaction,
} from '../../lib/combatTransaction'
import { DND_FEET_PER_CELL, cellDistance, cellKey, cellToPixel, mapCellExtent, pixelToCell, tokenOccupiedCellsAt, type GridCell } from '../../lib/gridCombat'
import { getEnemyStatBlock } from '../../lib/enemyStatBlocks'
import { aoeOrientFromCell, canPlaceAoe, cellsForAoe, resolveAoeDimensions, tokensInCells, type SkillAoeTargeting } from '../../lib/skillTargeting'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { D20RollMode } from '../contracts'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eClassDefinition, dnd5ePactSlotLevel, type Dnd5eClassId } from './classes'
import { dnd5eAttackerIsUnseenForAttack, dnd5eBlurImposesAttackDisadvantage, dnd5eDirectedCombatantPairKey, dnd5eTargetArmorClassForAttack, dnd5eTargetIsUnseenForAttack, type Dnd5eActionResult, type Dnd5eCombatEvent, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import {
  resolveDnd5eActionWithAirborneFallPreview,
  type Dnd5eAirborneFallDamageRolls,
  type Dnd5eAirborneFallPreview,
} from './airborneFallActionResolution'
import { createDnd5eMapCombatSnapshot, dnd5eRequestedInitiativeActorIndex, planDnd5eMapResultApplication, prepareDnd5eExplorationActor, projectDnd5eRoomBenefitDeathPeers, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eBenefitDeathPeerMatches } from './benefitHistoryRenewal'
import { captureDnd5eCastingProximity, verifyDnd5eCastingProximity, dnd5eCastingTargetsWithinRange,
  type Dnd5eCastingProximityReceipt, type Dnd5eCastingProximityBinding } from './castingProximity'
import { dnd5eSpellPlacementQualified } from './spellPlacementQualification'
import { captureDnd5eLongCasting, observeDnd5eLongCasting, beginDnd5eLongCasting, armDnd5eLongCasting,
  dnd5eLongCastingStarted, dnd5eLongCastingCanComplete, dnd5eLongCastingConcentrationId, invalidateDnd5eLongCasting,
  type Dnd5eLongCastingReceipt, type Dnd5eLongCastingBinding } from './longCastingContinuity'
import { endDnd5eConcentration } from './headlessCombatEngine'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5ePreventsAttackAdvantage, dnd5eSavingThrowMode, dnd5eTargetGrantsAttackAdvantage, dnd5eTargetIsDodging } from './passiveDefenses'
import { dnd5eConditionSavingThrowAutomaticallyFails } from './conditions'
import { resolveDnd5eRollMode } from './rollMode'
import {
  dnd5ePluginHeadlessActionDefinition,
  dnd5eAlternateResourceSpellForCharacter,
  dnd5ePluginSpellDefinition,
  dnd5eSpellAttackRangeMultiplierForCharacter,
  missingDnd5eRulesPluginRequirements,
  type Dnd5ePluginAction,
  type Dnd5ePluginDiceRollResult,
  type RegisteredDnd5ePluginSpell,
} from './pluginApi'
import { dnd5eSpellcastingClassIdForSpell } from './spells'
import {
  dnd5eSpellCantripScalingTotals,
  dnd5eSpellUpcastTotals,
  type Dnd5eSpellConditionDuration,
  type Dnd5eSpellMechanicsDefinition,
} from './spellMechanics'
import { dnd5eCharacterClassLevel } from './multiclass'
import { dnd5eWearingUnproficientArmor } from './equipment'
import { resolveDnd5eDamageDefenses } from './damageDefenses'
import { dnd5eLimitedMagicImmunityNegatesSpell } from './monsterGenericAbilities'
import {
  dnd5eHeldSpellcastingFocusMatches,
  dnd5eSpellComponentCheck,
  dnd5eSpellComponentsAvailable,
  type Dnd5eSpellComponentCheck,
} from './spellComponents'
import type { Dnd5eEffectiveRulesContextV1 } from './effectiveRulesContext'
import {
  dnd5ePluginSpellArea,
  dnd5ePluginSpellTargetCapacity,
  dnd5ePluginSpellUsesSelfTarget,
} from './pluginSpellTargeting'
import { dnd5eTrackableDefinitionIdV1 } from './activities/dnd5eActivityIdentity'
import type { Dnd5eActivityAreaPlacementV1, Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { dnd5eActivityLanguageChoicesV1, dnd5eActivityOutcomeAllowsChoicesV1, dnd5eActivityTargetOverrideForChoicesV1, dnd5eActivityWithTargetChoicesV1 } from './activities/dnd5eActivityChoices'
import { dnd5eActivityMapTemplateV1 } from './activities/dnd5eActivityMapInteraction'
import { dnd5eActivityManualAdjudicationOperationsV1 } from './activities/dnd5eActivityHeadlessCompiler'
import { scaleDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityScaling'
import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import { dnd5eActivityAutomationAnalysisV1 } from './plugins/pluginMechanicsRegistry'
import { evaluateDnd5eWorkshopDamageFormula, normalizeDnd5eWorkshopFormulaClassLevels } from './workshopDamageFormula'
import { dnd5eActiveAttackRollFlags, dnd5eActiveTargetLinkedAttackRollFlags } from './activeEffects'
import {
  DND5E_SRD_AUDITED_SPELL_PACKAGE_ID,
  dnd5eConjureCelestialChoicesAtSlotV1,
  dnd5eConjureElementalChoicesAtSlotV1,
  dnd5eConjureFeyChoicesAtSlotV1,
  dnd5eConjureMinorElementalChoicesForFormationV1,
  dnd5eConjureWoodlandBeingChoicesForFormationV1,
} from './activities/dnd5eSrdAuditedSpellActivities'
import { dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'
import {
  dnd5eCoreSpellMaterialRequirement,
  settleDnd5eSpellMaterialConsumption,
  type Dnd5eSpellMaterialConsumptionPlan,
} from './spellMaterials'
import {
  dnd5eCharacterIsBlinded,
  dnd5eSpellTargetRequiresSight,
  dnd5eSpellVisibilityRequirement,
} from './spellVisibility'

export type Dnd5ePluginSpellRejectReason =
  | 'ethereal-plane-unknown'
  | 'invalid-action'
  | 'invalid-actor'
  | 'casting-continuity-lost'
  | 'plugin-missing'
  | 'room-rules-unavailable'
  | 'plugin-not-enabled-for-room'
  | 'plugin-version-mismatch'
  | 'spell-unavailable'
  | 'spell-not-known-or-prepared'
  | 'spellcasting-class-unavailable'
  | 'wild-shape-spellcasting-unavailable'
  | 'armor-proficiency-required'
  | 'spell-not-headless'
  | 'component-unavailable'
  | 'verbal-component-unavailable'
  | 'somatic-component-unavailable'
  | 'material-component-unavailable'
  | 'costly-material-unavailable'
  | 'invalid-target'
  | 'target-immune'
  | 'target-out-of-range'
  | 'spell-target-not-visible'
  | 'effect-line-blocked'
  | 'slot-unavailable'
  | 'action-unavailable'
  | 'bonus-action-unavailable'
  | 'reaction-unavailable'
  | 'combatant-missing'
  | 'invalid-dice'
  | 'ritual-unavailable'

export type Dnd5ePluginSpellComponentCheck = Dnd5eSpellComponentCheck

export interface PreparedDnd5ePluginSpellTarget {
  key: string
  token: Token
  distanceFeet: number
  attackMode: D20RollMode
  saveModifier?: number
  saveMode?: D20RollMode
  saveAutomaticallyFails: boolean
  armorClass: number
}

export interface PreparedDnd5ePluginSpellCast {
  /** Host-captured physical identity; a replacement at the same point is not the original target. */
  mapItemConversionBinding?: string
  /** Host-local observed death/incapacity interruption for a long cast. */
  longCastingReceipt?: Dnd5eLongCastingReceipt
  /** Host-local range history; serialization does not preserve this evidence. */
  castingProximityReceipt?: Dnd5eCastingProximityReceipt
  action: SharedPlayerActionState
  payload: Dnd5eSpellCastPayload
  spell: RegisteredDnd5ePluginSpell
  map: BattleMap
  characters: readonly Character[]
  roomMaps?: readonly BattleMap[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  castingClassId?: Dnd5eClassId
  racialInnate?: true
  castingClassLevel: number
  actorToken: Token
  targetToken: Token
  targetTokens: Token[]
  targets: PreparedDnd5ePluginSpellTarget[]
  /** Host-normalized appearance and interior illumination for Tiny Hut. */
  tinyHut?: Dnd5eSpellCastPayload['tinyHut']
  /** Host-normalized mode, target and creature-category declaration. */
  antipathySympathy?: Dnd5eSpellCastPayload['antipathySympathy']
  area?: SkillAoeTargeting
  /** Unified, data-only Activity bound to this spell by the content package compiler. */
  activity?: Dnd5eActivityDefinitionV1
  /** Host-resolved targeting after choice overrides and upcasting. */
  targetSelection?: Dnd5eActivityDefinitionV1['target']
  activityHeadlessAction?: Dnd5ePluginAction
  activityTargetCell?: GridCell
  activityTargetCells: GridCell[]
  activityAreaPlacement?: Dnd5eActivityAreaPlacementV1
  activityAreaPlacementDistanceFeet?: number
  activityAreaExemptTargetIds: readonly string[]
  alternateResourceSpell?: { featureId: string; grantId: string }
  slotLevel: number
  ritual: boolean
  /** Minute/hour or ritual cast; live combat requires a paid action each round. */
  castingTime: 'action' | 'bonus-action' | 'reaction' | 'long'
  componentCheck: Dnd5ePluginSpellComponentCheck
  spellMaterialPlan?: Dnd5eSpellMaterialConsumptionPlan
  attackModifier: number
  castingAbility: import('../../lib/dnd').AbilityKey
  attackMode: D20RollMode
  saveDc: number
  saveModifier?: number
  saveMode?: D20RollMode
  saveAutomaticallyFails: boolean
  targetArmorClass: number
  damageDice: { count: number; sides: number; bonus: number }
  overchannel: boolean
  overchannelSelfDamageDiceCount: number
  sculptedTargetIds: readonly string[]
  concentrationRounds?: number
  upcastDurationRounds: number
  transaction: CombatTransaction
}

/**
 * Whole campaign-clock minutes that pass before an audited plugin spell takes
 * effect. Action/bonus-action/reaction casts are below the clock's one-minute
 * resolution, while a ritual adds ten minutes to the spell's printed casting
 * time (PHB/SRD ritual rule).
 */
export function dnd5ePluginSpellElapsedCastingMinutes(input: {
  castingTime: RegisteredDnd5ePluginSpell['castingTime']
  ritual: boolean
}): number {
  const printedMinutes = input.castingTime.unit === 'hour'
    ? input.castingTime.value * 60
    : input.castingTime.unit === 'minute'
      ? input.castingTime.value
      : 0
  return Math.max(0, Math.floor(printedMinutes + (input.ritual ? 10 : 0)))
}

export interface Dnd5ePluginSpellResolutionRolls {
  spellDamageDieRerolls?:readonly Dnd5eSpellDamageDieRerollUse[]
  sourceSlotSpellHealingTargets?: readonly { areaId: string; targetIds: readonly string[] }[]
  sourceActionInterruptionReaction?: import('./headlessCombatEngine').Dnd5eSourceActionInterruptionReaction
  activityTeleportInterruptions?: readonly import('./headlessCombatEngine').Dnd5eActivityTeleportInterruptionUse[]
  spellcastingSavingThrows?: readonly import('./headlessCombatEngine').Dnd5eSpellcastingSavingThrowRoll[]
  effectRollDice?: Readonly<Record<string, readonly number[]>>
  attackD20?: number
  attackD20Second?: number
  savingThrowD20?: number
  savingThrowD20Second?: number
  damageRolls?: number[]
  overchannelSelfDamageRolls?: number[]
  targetRolls?: Array<{
    attackD20?: number
    attackD20Second?: number
    savingThrowD20?: number
    savingThrowD20Second?: number
    damageRolls?: number[]
  }>
  /** Host-expanded formula and per-target save recipe from the unified Activity compiler. */
  activityRolls?: Record<string, Dnd5ePluginDiceRollResult>
  activityRetainedSaveDice?: import('./activities/dnd5eActivityRetainedSaveDice').Dnd5eActivityRetainedSaveDice
  /** Shared DM interrupt receipt for an assisted Activity transaction. */
  activityInterruptChoiceId?: 'dm-apply'
}

export interface Dnd5ePluginSpellTargetResolution {
  key: string
  targetTokenId: string
  attackHit?: boolean
  critical: boolean
  saveSucceeded?: boolean
  rawDamage: number
  finalDamage: number
}

export interface Dnd5ePluginSpellResolution {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  transaction: CombatTransaction
  attackHit?: boolean
  critical?: boolean
  saveSucceeded?: boolean
  rawDamage?: number
  finalDamage?: number
  targetResolutions?: Dnd5ePluginSpellTargetResolution[]
  airborneFalls?: readonly Dnd5eAirborneFallPreview[]
}

/** 当前 Host 事务真正覆盖的插件法术子集；超出能力的声明必须回落到 DM 裁定。 */
export type SupportedDnd5ePluginSpell = RegisteredDnd5ePluginSpell & {
  automation: { mode: 'headless-action'; actionId: string }
  mechanics?: Dnd5eSpellMechanicsDefinition
}

/** Authoritative damage totals for Activity-backed spell presentation. */
export function dnd5ePluginSpellDamageByTargetId(
  events: readonly Dnd5eCombatEvent[],
): ReadonlyMap<string, number> {
  const damageByTargetId = new Map<string, number>()
  for (const event of events) {
    if (event.type !== 'damage-applied' || event.amount <= 0) continue
    damageByTargetId.set(
      event.targetId,
      (damageByTargetId.get(event.targetId) ?? 0) + event.amount,
    )
  }
  return damageByTargetId
}

export function dnd5ePluginSpellActivity(
  spell: RegisteredDnd5ePluginSpell | undefined,
): Dnd5eActivityDefinitionV1 | undefined {
  if (!spell || spell.automation.mode !== 'headless-action') return undefined
  let activity = getRegisteredDnd5eActivity(spell.ownerPluginId, spell.automation.actionId)
  // The player map asks for the Activity before it compiles a Host action.
  // Lazily establish the built-in package here as well, otherwise audited
  // target overrides disappear only in the live UI while Host settlement still
  // sees them later in the transaction.
  if (!activity && spell.ownerPluginId === DND5E_SRD_AUDITED_SPELL_PACKAGE_ID) {
    dnd5ePluginHeadlessActionDefinition(spell.ownerPluginId, spell.automation.actionId)
    activity = getRegisteredDnd5eActivity(spell.ownerPluginId, spell.automation.actionId)
  }
  const actualAutomation = activity ? dnd5eActivityAutomationAnalysisV1(activity).capability : undefined
  if (
    !activity || (
      actualAutomation?.level !== 'full' &&
      !(
        actualAutomation?.level === 'assisted' &&
        dnd5eActivityManualAdjudicationOperationsV1(activity).length > 0
      )
    ) || activity.authorityBinding || activity.requiresEffectGrant ||
    activity.legacySource?.kind !== 'spell'
  ) return undefined
  const localSpellId = spell.id.startsWith(`${spell.ownerPluginId}:`)
    ? spell.id.slice(spell.ownerPluginId.length + 1)
    : spell.id
  return activity.legacySource.id === localSpellId || activity.legacySource.id === spell.id
    ? activity
    : undefined
}

export function dnd5ePluginSpellAutomationSupported(spell: RegisteredDnd5ePluginSpell | undefined): spell is SupportedDnd5ePluginSpell {
  if (!spell || spell.automation.mode !== 'headless-action' ||
    !dnd5ePluginHeadlessActionDefinition(spell.ownerPluginId, spell.automation.actionId)) return false
  // A rejected effect-only Activity must not become a cast via legacy mechanics.
  if (getRegisteredDnd5eActivity(spell.ownerPluginId, spell.automation.actionId)?.requiresEffectGrant) return false
  const activity = dnd5ePluginSpellActivity(spell)
  if (activity) return ['self', 'touch', 'distance', 'sight', 'unlimited', 'special'].includes(spell.range.type) &&
    (spell.range.shape == null || dnd5ePluginSpellArea(spell) != null)
  if (!spell.mechanics || spell.mechanics.resolution === 'dm-adjudication') return false
  return spell.mechanics.kind !== 'healing' &&
    (!!spell.mechanics.damage || !!spell.mechanics.conditions?.length) &&
    ['self', 'touch', 'distance', 'sight', 'unlimited', 'special'].includes(spell.range.type) &&
    (spell.range.shape == null || dnd5ePluginSpellArea(spell) != null)
}

/**
 * Strict UI/authority routing predicate. Assisted Activities remain executable
 * inside the low-level engine for migration and replay compatibility, but a
 * live cast may only enter the automatic route when every Activity branch is
 * audited as full. Everything else must use the single DM-adjudicated cast
 * transaction so target/effect validation cannot fail halfway through.
 */
export function dnd5ePluginSpellHasFullHeadlessAutomation(
  spell: RegisteredDnd5ePluginSpell | undefined,
): spell is SupportedDnd5ePluginSpell {
  if (!dnd5ePluginSpellAutomationSupported(spell)) return false
  // The Activity graph may completely cover the deterministic subset of an
  // audited partial spell while the spell still has an explicit scene/DM
  // boundary outside that graph. Never let graph completeness promote that
  // catalog decision back to full automation.
  if (spell.tags?.some((tag) => tag === 'headless-target:partial' || tag === 'headless-target:manual')) {
    return false
  }
  const activity = dnd5ePluginSpellActivity(spell)
  return activity == null || (activity.automation.level === 'full' && dnd5eActivityAutomationAnalysisV1(activity).capability.level === 'full')
}

/** Only an explicit selected-Activity declaration overrides an already-concentrating spell. */
export function dnd5ePluginSpellConcentrationRounds(input: {
  activity?: Pick<Dnd5eActivityDefinitionV1,'concentrationCastLevelProfiles'>
  slotLevel: number
  baseRounds?: number
}): number | undefined {
  if (input.baseRounds == null) return undefined
  const profile = [...(input.activity?.concentrationCastLevelProfiles ?? [])]
    .filter(candidate => candidate.minimumCastLevel <= input.slotLevel)
    .sort((left,right) => right.minimumCastLevel-left.minimumCastLevel)[0]
  return profile?.maximumRounds ?? input.baseRounds
}

function prepareDnd5ePluginSpellCastInternal(input: {
  worldMinute?: number
  action: SharedPlayerActionState
  /** Host-authoritative current round. Exploration clients may submit a stale synthetic round. */
  authorityRound?: number
  map: BattleMap
  characters: readonly Character[]
  roomMaps?: readonly BattleMap[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
  roomRequiredPlugins?: readonly { id: string; version: string; integrity?: string }[] | null
  now?: number
  effectiveRules?: Dnd5eEffectiveRulesContextV1 | null
}): { ok: true; prepared: PreparedDnd5ePluginSpellCast } | { ok: false; reason: Dnd5ePluginSpellRejectReason } {
  const payload = input.action.dnd5eSpellCast ? { ...input.action.dnd5eSpellCast } : undefined
  if (input.action.type !== 'dnd5e-spell-cast' || !payload) return { ok: false, reason: 'invalid-action' }
  const spell = dnd5ePluginSpellDefinition(payload.spellId)
  if (!spell) return { ok: false, reason: 'plugin-missing' }
  // Legacy clients used to submit Message text through the combat authority
  // channel. The spell is now action-only; fail closed on stale/injected
  // private content instead of reopening the retired delivery workflow.
  if (payload.communicationText != null) {
    return { ok: false, reason: 'invalid-action' }
  }
  // Minor Illusion is action-only in the tabletop runtime. Reject stale
  // clients that still submit an image/sound declaration instead of silently
  // restoring the retired mode picker or DM approval path.
  if (payload.minorIllusion != null) {
    return { ok: false, reason: 'invalid-action' }
  }
  const tinyHut = (() => {
    if (spell.id !== 'tiny-hut') return undefined
    const candidate = payload.tinyHut ?? {
      schemaVersion: 1 as const,
      color: '#7c3aed',
      interiorIllumination: 'dim' as const,
    }
    if (
      candidate.schemaVersion !== 1 ||
      typeof candidate.color !== 'string' ||
      !/^#[0-9a-f]{6}$/i.test(candidate.color) ||
      (candidate.interiorIllumination !== 'dim' && candidate.interiorIllumination !== 'darkness')
    ) return undefined
    return {
      schemaVersion: 1 as const,
      color: candidate.color.toLowerCase(),
      interiorIllumination: candidate.interiorIllumination,
    }
  })()
  if (spell.id === 'tiny-hut') {
    if (!tinyHut) return { ok: false, reason: 'invalid-action' }
  } else if (payload.tinyHut != null) {
    return { ok: false, reason: 'invalid-action' }
  }
  const antipathySympathy = (() => {
    if (spell.id !== 'antipathy-sympathy') return undefined
    const candidate = payload.antipathySympathy
    if (
      !candidate || candidate.schemaVersion !== 1 ||
      !['antipathy', 'sympathy'].includes(candidate.mode) ||
      !['creature', 'object', 'area'].includes(candidate.targetKind) ||
      payload.activityChoices?.mode !== candidate.mode ||
      payload.activityChoices?.['target-form'] !== candidate.targetKind
    ) return undefined
    const creatureCategory = candidate.creatureCategory?.trim()
    const targetDescription = candidate.targetDescription?.trim()
    if (
      !creatureCategory || creatureCategory.length > 120 ||
      !targetDescription || targetDescription.length > 240
    ) return undefined
    if (candidate.targetKind === 'area') {
      const size = candidate.areaSizeFeet
      if (!Number.isInteger(size) || size! < 5 || size! > 200 || size! % 5 !== 0) return undefined
      if (
        payload.areaTargetLengthFeet !== size ||
        payload.areaTargetWidthFeet !== size ||
        payload.areaTargetHeightFeet !== size
      ) return undefined
    } else if (candidate.areaSizeFeet != null) return undefined
    return {
      schemaVersion: 1 as const,
      mode: candidate.mode,
      targetKind: candidate.targetKind,
      creatureCategory,
      targetDescription,
      ...(candidate.targetKind === 'area' ? { areaSizeFeet: candidate.areaSizeFeet } : {}),
    }
  })()
  if (spell.id === 'antipathy-sympathy') {
    if (!antipathySympathy) return { ok: false, reason: 'invalid-action' }
  } else if (payload.antipathySympathy != null) {
    return { ok: false, reason: 'invalid-action' }
  }
  if (!dnd5ePluginSpellAutomationSupported(spell)) return { ok: false, reason: 'spell-not-headless' }
  let activity = dnd5ePluginSpellActivity(spell)
  const mechanics = spell.mechanics
  if (input.roomRequiredPlugins === null) return { ok: false, reason: 'room-rules-unavailable' }
  if (input.roomRequiredPlugins) {
    if (spell.ownerPluginId !== DND5E_SRD_AUDITED_SPELL_PACKAGE_ID) {
      const requirement = input.roomRequiredPlugins.find((plugin) => plugin.id === spell.ownerPluginId)
      if (!requirement) return { ok: false, reason: 'plugin-not-enabled-for-room' }
      if (missingDnd5eRulesPluginRequirements([requirement]).length > 0) return { ok: false, reason: 'plugin-version-mismatch' }
    }
  }
  const actorSubject = input.characters.find((character) => character.id === input.action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === input.action.actorTokenId && token.characterId === input.action.characterId)
  const actor = actorSubject && actorToken ? projectSimulacrumCharacterForMapDetail(actorToken, actorSubject) : actorSubject
  const enforceSpellcastingPrerequisites =
    input.effectiveRules?.houseRules.spellcastingPrerequisitesEnabled !== false
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  if (activity) activity = dnd5eActivityLanguageChoicesV1(activity, dnd5eCharacterKnownLanguagesV1(actor), actor.hitPointDice)
  if (dnd5eConditionalSpellMaterialProblems(spell.components, activity, spell.duration).length > 0) return { ok: false, reason: 'invalid-action' }
  const materialModes = spell.components.materialRequirementByChoice
  if (materialModes && !materialModes.options.some(option => option.optionId === payload.activityChoices?.[materialModes.choiceId])) return { ok: false, reason: 'invalid-action' }
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
  if (enforceSpellcastingPrerequisites && dnd5eWearingUnproficientArmor(actor)) {
    return { ok: false, reason: 'armor-proficiency-required' }
  }
  const racialGrant = payload.racialInnate === true
    ? dnd5eRacialInnateSpellGrant(dnd5eIndependentSpellRulesForCharacter(actor), spell.id) : undefined
  if (payload.racialInnate === true && (!racialGrant || payload.castingClassId != null ||
    payload.alternateResourceSpell != null || payload.ritual === true || payload.slotLevel !== racialGrant.castAtLevel)) {
    return { ok: false, reason: 'spell-not-known-or-prepared' }
  }
  const alternateResourceSpell = !racialGrant && payload.alternateResourceSpell
    ? dnd5eAlternateResourceSpellForCharacter({ character: actor, ...payload.alternateResourceSpell,
        spellId: spell.id, slotLevel: payload.slotLevel }) : undefined
  if (payload.alternateResourceSpell != null && (!alternateResourceSpell || payload.racialInnate === true ||
    payload.castingClassId != null || payload.ritual === true || payload.itemInstanceId != null)) return { ok: false, reason: 'spell-not-known-or-prepared' }
  const castingClassId = racialGrant || alternateResourceSpell ? undefined : dnd5eSpellcastingClassIdForSpell(actor, spell.id, payload.castingClassId, spell.classes)
  // An empty class list is a grant-only spell, not a back door through forged
  // prepared selections or Magical Secrets. Grants above have Host ownership checks.
  if (spell.classes.length === 0 && !racialGrant && !alternateResourceSpell) return { ok: false, reason: 'spell-not-known-or-prepared' }
  if (racialGrant?.targetRestriction === 'self' && [
    payload.targetTokenId, ...(payload.targetTokenIds ?? []), ...(payload.projectileTargetIds ?? []),
    input.action.targetTokenId, ...(input.action.targetTokenIds ?? []),
  ].some(id => id != null && id !== actorToken.id)) return { ok: false, reason: 'invalid-target' }
  if (!racialGrant && !alternateResourceSpell && !castingClassId) return { ok: false, reason: 'spell-not-known-or-prepared' }
  const classDefinition = castingClassId ? dnd5eClassDefinition(castingClassId) : undefined
  const castingClassLevel = castingClassId ? dnd5eCharacterClassLevel(actor, castingClassId) : 0
  if (!racialGrant && !alternateResourceSpell && (!classDefinition?.spellcasting || castingClassLevel < 1)) {
    return { ok: false, reason: 'spellcasting-class-unavailable' }
  }
  const castingAbility = racialGrant?.ability ?? alternateResourceSpell?.ability ?? classDefinition?.spellcasting?.ability
  if (!castingAbility) return { ok: false, reason: 'spellcasting-class-unavailable' }
  const ritual = payload.ritual === true
  if (ritual && (
    spell.ritual !== true ||
    spell.level < 1 ||
    classDefinition?.spellcasting?.ritualCasting !== true
  )) return { ok: false, reason: 'ritual-unavailable' }
  if (payload.itemInstanceId != null || (
    payload.focusItemInstanceId != null &&
    !dnd5eHeldSpellcastingFocusMatches(actor, payload.focusItemInstanceId, castingClassId)
  )) {
    return { ok: false, reason: 'component-unavailable' }
  }
  if (enforceSpellcastingPrerequisites && actor.dnd5eCombatState?.wildShapeFormId && actor.dnd5eCombatState.wildShapeMode !== 'shapechange' &&
    (['polymorph', 'true-polymorph', 'animal-shapes'].includes(actor.dnd5eCombatState.wildShapeMode ?? '') ||
      classDefinition?.id !== 'druid' || castingClassLevel < 18)) {
    return { ok: false, reason: 'wild-shape-spellcasting-unavailable' }
  }
  const isLongCast = spell.castingTime.unit === 'minute' || spell.castingTime.unit === 'hour'
  if (
    spell.castingTime.value < 1 ||
    !['action', 'bonus-action', 'reaction', 'minute', 'hour'].includes(spell.castingTime.unit)
  ) {
    return { ok: false, reason: 'invalid-action' }
  }
  const castingTime: PreparedDnd5ePluginSpellCast['castingTime'] = ritual
    ? 'long'
    : isLongCast
    ? 'long'
    : spell.castingTime.unit as 'action' | 'bonus-action' | 'reaction'
  // A serialized process marker is not proof of uninterrupted casting. Only
  // the original prepared request owns that receipt; recovery must not issue
  // a new receipt for the same already-started request.
  if (castingTime === 'long' && actor.dnd5eCombatState?.concentrationSpellId === dnd5eLongCastingConcentrationId({
    requestId: input.action.id, spellId: spell.id, mapId: input.map.id,
    actorTokenId: actorToken.id, actorCharacterId: actor.id,
  })) return { ok: false, reason: 'casting-continuity-lost' }
  const activityCompletionDelayRounds = dnd5ePluginSpellElapsedCastingMinutes({
    castingTime: spell.castingTime,
    ritual,
  }) * 10
  const liveCombatCast = input.action.combatId?.trim() != null && input.action.combatId.trim().length > 0
  if(liveCombatCast&&castingTime==='long'&&input.turnEconomy&&input.turnEconomy.action.current<1)return {ok:false,reason:'action-unavailable'}
  if (liveCombatCast && !ritual && castingTime === 'action' && input.turnEconomy && input.turnEconomy.action.current < 1) return { ok: false, reason: 'action-unavailable' }
  if (liveCombatCast && !ritual && castingTime === 'bonus-action' && input.turnEconomy && input.turnEconomy.bonusAction.current < 1) return { ok: false, reason: 'bonus-action-unavailable' }
  if (liveCombatCast && !ritual && castingTime === 'reaction' && input.turnEconomy && input.turnEconomy.reaction.current < 1) return { ok: false, reason: 'reaction-unavailable' }

  const requestedMaterialTargetId = payload.projectileTargetIds?.[0] ?? payload.targetTokenIds?.[0] ??
    payload.targetTokenId ?? input.action.targetTokenIds?.[0] ?? input.action.targetTokenId
  const requestedMaterialTarget = input.map.tokens.find((candidate) => candidate.id === requestedMaterialTargetId)
  const revivalMaterialWaived = dnd5eRevivalMaterialWaived({ activity, map: input.map, characters: input.characters,
    targetIds: [...new Set([
      ...(payload.projectileTargetIds ?? []), ...(payload.targetTokenIds ?? []),
      ...(input.action.targetTokenIds ?? []),
      ...(payload.targetTokenId ? [payload.targetTokenId] : []),
      ...(input.action.targetTokenId ? [input.action.targetTokenId] : []),
    ])],
  })
  const ignoreMaterialComponents = alternateResourceSpell?.ignoreMaterialComponents === true || revivalMaterialWaived
  const componentCheck = dnd5ePluginSpellComponentCheck(actor, spell, castingClassId, {
    targetHitDiceCount: requestedMaterialTarget
      ? dnd5eTokenHitDiceCount(requestedMaterialTarget, input.characters)
      : undefined,
    imprisonmentMode: payload.activityChoices?.mode,
    activityChoices: payload.activityChoices,
  })
  if (componentCheck.materialPlan?.consumptionTiming === 'spell-end' &&
    (spell.duration.type !== 'timed' || !spell.duration.value || spell.duration.value <= 0)) return { ok: false, reason: 'invalid-action' }
  const componentsAvailable = dnd5eSpellComponentsAvailable(componentCheck) || (ignoreMaterialComponents &&
    componentCheck.verbal !== 'unavailable-silenced' && componentCheck.somatic !== 'unavailable-hands-occupied')
  if (enforceSpellcastingPrerequisites && !componentsAvailable) {
    if (componentCheck.verbal === 'unavailable-silenced') {
      return { ok: false, reason: 'verbal-component-unavailable' }
    }
    if (componentCheck.somatic === 'unavailable-hands-occupied') {
      return { ok: false, reason: 'somatic-component-unavailable' }
    }
    if (
      componentCheck.material === 'missing-specific-material' ||
      componentCheck.material === 'unsupported-costly-material'
    ) {
      return { ok: false, reason: 'costly-material-unavailable' }
    }
    if (
      componentCheck.material === 'missing-focus-or-pouch' ||
      componentCheck.material === 'specific-material-hands-occupied'
    ) {
      return { ok: false, reason: 'material-component-unavailable' }
    }
    return { ok: false, reason: 'component-unavailable' }
  }

  const requestedSlot = Math.floor(payload.slotLevel)
  const slotLevel = spell.level === 0
    ? 0
    : classDefinition?.spellcasting?.kind === 'pact' && spell.level <= 5
      ? dnd5ePactSlotLevel(castingClassLevel)
      : requestedSlot
  const usesSpellAttackRoll = mechanics?.resolution === 'spell-attack' ||
    activity?.checks?.some((check) => check.kind === 'attack-roll') === true
  const spellAttackRangeMultiplier = usesSpellAttackRoll
    ? dnd5eSpellAttackRangeMultiplierForCharacter(actor)
    : 1
  if (!Number.isInteger(requestedSlot) || requestedSlot < 0 || requestedSlot > 9 || slotLevel < spell.level) {
    return { ok: false, reason: 'slot-unavailable' }
  }
  if (alternateResourceSpell) {
    const option = alternateResourceSpell.castLevelOptions.find(option => option.slotLevel === slotLevel)
    if (!option || (actor.classResources?.[alternateResourceSpell.resourceId]?.current ?? -1) < option.resourceCost) return { ok: false, reason: 'slot-unavailable' }
  } else if (spell.level > 0 && !ritual && racialGrant?.resetOn !== 'at-will') {
    const resourceKey = racialGrant ? DND5E_RACIAL_RESOURCE_KEYS.innateSpell(spell.id) : classDefinition?.spellcasting?.kind === 'pact' && spell.level <= 5
      ? 'dnd5e-pact-slot'
      : `dnd5e-spell-slot-${slotLevel}`
    if ((actor.classResources?.[resourceKey]?.current ?? 0) < 1) return { ok: false, reason: 'slot-unavailable' }
  }
  if (spell.id === 'conjure-celestial') {
    const selectedMonsterId = payload.activityChoices?.mode
    if (!dnd5eConjureCelestialChoicesAtSlotV1(slotLevel).some((choice) =>
      choice.id === selectedMonsterId)) {
      return { ok: false, reason: 'invalid-action' }
    }
  }
  if (spell.id === 'conjure-elemental') {
    const selectedMonsterId = payload.activityChoices?.mode
    if (!dnd5eConjureElementalChoicesAtSlotV1(slotLevel).some((choice) =>
      choice.id === selectedMonsterId)) {
      return { ok: false, reason: 'invalid-action' }
    }
  }
  if (spell.id === 'conjure-fey') {
    const selectedMonsterId = payload.activityChoices?.mode
    if (!dnd5eConjureFeyChoicesAtSlotV1(slotLevel).some((choice) =>
      choice.id === selectedMonsterId)) {
      return { ok: false, reason: 'invalid-action' }
    }
  }
  if (spell.id === 'conjure-minor-elementals') {
    const formationId = payload.activityChoices?.formation
    const selectedMonsterId = payload.activityChoices?.mode
    if (!formationId || !dnd5eConjureMinorElementalChoicesForFormationV1(formationId).some((choice) =>
      choice.id === selectedMonsterId)) {
      return { ok: false, reason: 'invalid-action' }
    }
  }
  if (spell.id === 'conjure-woodland-beings') {
    const formationId = payload.activityChoices?.formation
    const selectedMonsterId = payload.activityChoices?.mode
    if (!formationId || !dnd5eConjureWoodlandBeingChoicesForFormationV1(formationId).some((choice) =>
      choice.id === selectedMonsterId)) {
      return { ok: false, reason: 'invalid-action' }
    }
  }

  const activityTargetOverride = activity
    ? dnd5eActivityTargetOverrideForChoicesV1(activity, payload.activityChoices)
    : undefined
  const effectiveActivity = activity && activityTargetOverride
    ? dnd5eActivityWithTargetChoicesV1(activity, payload.activityChoices)
    : activity
  const scaledActivity = effectiveActivity
    ? scaleDnd5eActivityDefinitionV1(effectiveActivity, {
        actor: {
          level: actor.level,
          proficiencyBonus: 2 + Math.floor((Math.max(1, actor.level) - 1) / 4),
          classLevels: actor.dnd5eClassLevels,
          abilities: actor.abilities,
        },
        castLevel: slotLevel,
      }).activity
    : undefined
  if (scaledActivity?.target.kind !== 'area' && dnd5eCharacterIsBlinded(actor) && dnd5eSpellTargetRequiresSight({
    requiresVisibleTarget: spell.ownerPluginId === DND5E_SRD_AUDITED_SPELL_PACKAGE_ID &&
      dnd5eSpellVisibilityRequirement(spell.id) === 'required',
    activityTarget: scaledActivity?.target,
  })) return { ok: false, reason: 'spell-target-not-visible' }
  const activityAcceptsAreaExemptions = effectiveActivity?.outcomes.some((outcome) =>
    dnd5eActivityOutcomeAllowsChoicesV1(outcome, payload.activityChoices ?? {}) &&
    outcome.operations.some((operation) =>
      (operation.kind === 'create-persistent-area' &&
        operation.triggerExemptions === 'selected-creatures') ||
      (operation.kind === 'modify-map-object-lock' &&
        operation.mode === 'arcane-lock' &&
        operation.accessPolicy === 'selected-creatures-and-password')),
  ) === true
  const activityAcceptsSecretPhrase = effectiveActivity?.outcomes.some((outcome) =>
    dnd5eActivityOutcomeAllowsChoicesV1(outcome, payload.activityChoices ?? {}) &&
    outcome.operations.some((operation) =>
      operation.kind === 'modify-map-object-lock' &&
      operation.mode === 'arcane-lock' &&
      operation.accessPolicy === 'selected-creatures-and-password'),
  ) === true
  const activitySecretPhrase = payload.secretPhrase?.normalize('NFKC').trim()
  if (payload.secretPhrase != null && (
    !activityAcceptsSecretPhrase || !activitySecretPhrase || activitySecretPhrase.length > 120
  )) return { ok: false, reason: 'invalid-action' }
  const suppliedActivityAreaExemptTargetIds = payload.excludedAreaTargetIds ?? []
  const activityAreaExemptTargetIds = [...new Set(suppliedActivityAreaExemptTargetIds)]
  if (
    activityAreaExemptTargetIds.length !== suppliedActivityAreaExemptTargetIds.length ||
    activityAreaExemptTargetIds.length > 256 ||
    (!activityAcceptsAreaExemptions && activityAreaExemptTargetIds.length > 0) ||
    activityAreaExemptTargetIds.some((id) => {
      const token = input.map.tokens.find((candidate) => candidate.id === id)
      return !token || token.type === 'obstacle'
    })
  ) return { ok: false, reason: 'invalid-target' }
  const reviveOperation = effectiveActivity?.outcomes
    .flatMap((outcome) => outcome.operations)
    .find((operation) => operation.kind === 'revive')
  if (payload.trueResurrectionSpokenName != null && spell.id !== 'true-resurrection') {
    return { ok: false, reason: 'invalid-action' }
  }
  const objectLaunch = effectiveActivity?.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, payload.activityChoices ?? {})).flatMap(outcome => outcome.operations).find(operation => operation.kind === 'launch-map-object')
  if (payload.objectLaunchPitchDegrees != null && (!objectLaunch || !Number.isFinite(payload.objectLaunchPitchDegrees) ||
    payload.objectLaunchPitchDegrees < -90 || payload.objectLaunchPitchDegrees > 90)) return { ok: false, reason: 'invalid-target' }
  const activityPermitsEmptyArea = (effectiveActivity?.target.kind === 'area' &&
    (effectiveActivity.target.selection !== 'choose-any' || (effectiveActivity.target.minimumTargets ?? 0) === 0)) ||
    objectLaunch != null || effectiveActivity?.outcomes.some((outcome) =>
    outcome.operations.some((operation) =>
      // Caster movement still resolves when the departure area has no victims.
      (operation.kind === 'move' && operation.target === 'actor') ||
      operation.kind === 'create-persistent-area' ||
      operation.kind === 'summon' ||
      operation.kind === 'duplicate-creature' ||
      operation.kind === 'modify-map-object-lock' ||
      operation.kind === 'enchant-map-weapon' ||
      operation.kind === 'control-map-water' ||
      operation.kind === 'affect-persistent-entity' || operation.kind === 'enchant-map-object-light' ||
      operation.kind === 'convert-map-inventory-item' ||
      operation.kind === 'protect-map-remains' ||
      operation.kind === 'purify-map-consumables' ||
      operation.kind === 'wither-map-vegetation' ||
      // Some point-targeted world-state spells use a short-lived caster
      // receipt while the mapped point itself is resolved through an explicit
      // DM boundary. They must not fabricate a creature target merely because
      // the selected plant/object square is otherwise empty.
      (operation.kind === 'apply-effect' && operation.target === 'actor'),
    ),
  ) === true
  const activitySelectsMappedObject = effectiveActivity?.outcomes.some((outcome) =>
    dnd5eActivityOutcomeAllowsChoicesV1(outcome, payload.activityChoices ?? {}) &&
    outcome.operations.some((operation) =>
      operation.kind === 'modify-map-object-lock' ||
      operation.kind === 'enchant-map-weapon' ||
      operation.kind === 'affect-persistent-entity' || operation.kind === 'enchant-map-object-light' ||
      operation.kind === 'convert-map-inventory-item' ||
      operation.kind === 'protect-map-remains' ||
      operation.kind === 'purify-map-consumables'),
  ) === true
  // The audited Activity owns the live targeting contract whenever it declares
  // an area. Requiring a choice-driven override here made the player UI show
  // valid empty-ground placement while Host preparation silently fell back to
  // the prose spell range (which has no shape for point-created entities such
  // as Unseen Servant), so the approved cast was later rejected as invalid.
  const areaTemplate = scaledActivity?.target.kind === 'area'
    ? dnd5eActivityMapTemplateV1(scaledActivity)
    : dnd5ePluginSpellArea(spell)
  const area = areaTemplate ? resolveAoeDimensions(areaTemplate, {
    radiusFeet: payload.areaTargetRadiusFeet,
    widthFeet: payload.areaTargetWidthFeet,
    heightFeet: payload.areaTargetHeightFeet,
    volumeHeightFeet: payload.areaTargetVolumeHeightFeet,
    lengthFeet: payload.areaTargetLengthFeet,
  }) : undefined
  if (areaTemplate && !area) return { ok: false, reason: 'invalid-target' }
  if (!areaTemplate && (
    payload.areaTargetRadiusFeet != null || payload.areaTargetWidthFeet != null ||
    payload.areaTargetVolumeHeightFeet != null || payload.areaTargetHeightFeet != null || payload.areaTargetLengthFeet != null
  )) return { ok: false, reason: 'invalid-target' }
  const scaledActivityTargetCount = scaledActivity?.target.kind === 'creature'
    ? scaledActivity.target.count
    : scaledActivity?.target.kind === 'area' ? scaledActivity.target.maximumTargets ?? Number.POSITIVE_INFINITY : undefined
  const areaTargeting = scaledActivity?.target.kind === 'area' ? scaledActivity.target : spell.targeting
  const targetCapacity = dnd5ePluginSpellTargetCapacity(
    spell,
    slotLevel,
    scaledActivityTargetCount,
    scaledActivity?.target.kind === 'creature' ? scaledActivity.target.allowDuplicateTargets : undefined,
  )
  const perceivesHostile = createDnd5eMapHostilityView({ ...input, effectiveRules: input.effectiveRules ?? undefined, actorToken, combatId: input.action.combatId ?? `map-${input.map.id}`, round: input.action.round })
  let targetTokens: Token[]
  let activityTargetCell: GridCell | undefined
  let activityTargetCells: GridCell[] = []
  let activityAreaPlacement: Dnd5eActivityAreaPlacementV1 | undefined
  let activityAreaPlacementDistanceFeet: number | undefined
  if (payload.areaTargetPitchDegrees != null || payload.areaTargetRollDegrees != null) {
    if (!area || !scaledActivity || !payload.areaTargetCell || payload.verticalSurface || payload.areaTargetCells?.length) return {ok:false,reason:'invalid-target'}
    const selected=resolveDnd5eActivityAreaMapSelectionV1({activity:scaledActivity,map:input.map,actorToken,
      characters:input.characters,worldMinute:input.worldMinute,anchorCell:payload.areaTargetCell,
      targetElevationFeet:payload.targetElevationFeet,rectAngleDegrees:payload.areaTargetAngleDegrees,
      rectRotation:payload.areaTargetOrientation,rectPitchDegrees:payload.areaTargetPitchDegrees,rectRollDegrees:payload.areaTargetRollDegrees,
      dimensions:{widthFeet:payload.areaTargetWidthFeet,heightFeet:payload.areaTargetHeightFeet,
        lengthFeet:payload.areaTargetLengthFeet,volumeHeightFeet:payload.areaTargetVolumeHeightFeet}})
    if(!selected)return {ok:false,reason:'invalid-target'}
    activityTargetCell=selected.anchorCell;activityTargetCells=[...selected.cells]
    activityAreaPlacement=selected.areaPlacement;activityAreaPlacementDistanceFeet=selected.areaPlacementDistanceFeet
    const ids=new Set(selected.targetIds)
    targetTokens=input.map.tokens.filter(token=>ids.has(token.id)&&(token.type==='player'||token.type==='enemy')&&!isDefeatedAreaToken(token))
  } else if (payload.verticalSurface) {
    if (!area || !scaledActivity || payload.areaTargetCells?.length || payload.targetTokenIds?.length) return {ok:false,reason:'invalid-target'}
    const selected = resolveDnd5eActivityAreaMapSelectionV1({activity:scaledActivity,map:input.map,actorToken,
      characters:input.characters,worldMinute:input.worldMinute,anchorCell:payload.areaTargetCell??{col:0,row:0},
      targetElevationFeet:payload.targetElevationFeet,verticalSurface:payload.verticalSurface,
      dimensions:{widthFeet:payload.areaTargetWidthFeet,heightFeet:payload.areaTargetHeightFeet,volumeHeightFeet:area.volumeHeightFeet}})
    if(!selected)return {ok:false,reason:'invalid-target'}
    activityTargetCell=selected.anchorCell
    activityTargetCells=[...selected.cells]
    activityAreaPlacement=selected.areaPlacement
    activityAreaPlacementDistanceFeet=selected.areaPlacementDistanceFeet
    targetTokens=[]
  } else if (area) {
    const casterCell = pixelToCell(actorToken.x, actorToken.y, input.map)
    const fixedSelfCenter = scaledActivity?.target.kind === 'area' && scaledActivity.target.origin === 'self' &&
      (scaledActivity.target.shape === 'circle' || scaledActivity.target.shape === 'sphere')
    const targetCell = fixedSelfCenter ? casterCell : payload.areaTargetCell ?? (spell.range.type === 'self' ? casterCell : undefined)
    if (!targetCell || !canPlaceAoe(area, casterCell, targetCell, input.map.feetPerCell)) return { ok: false, reason: 'target-out-of-range' }
    if (payload.areaTargetAngleDegrees != null && (
      !Number.isFinite(payload.areaTargetAngleDegrees) ||
      payload.areaTargetAngleDegrees < 0 || payload.areaTargetAngleDegrees >= 360 ||
      area.shape !== 'rect' || !area.rotatable
    )) return { ok: false, reason: 'invalid-target' }
    const activityAreaTarget = scaledActivity?.target.kind === 'area' ? scaledActivity.target : undefined
    const maximumInstances = activityAreaTarget?.instanceCount ?? 1
    const minimumInstances = activityAreaTarget?.minimumInstanceCount ?? maximumInstances
    if (maximumInstances === 1 && (payload.areaTargetCells?.length ?? 0) > 1) {
      return { ok: false, reason: 'invalid-target' }
    }
    const anchorCells = maximumInstances > 1
      ? payload.areaTargetCells?.map((cell) => ({ ...cell })) ?? [{ ...targetCell }]
      : [{ ...targetCell }]
    if (
      anchorCells.length < minimumInstances || anchorCells.length > maximumInstances ||
      anchorCells[0]?.col !== targetCell.col || anchorCells[0]?.row !== targetCell.row ||
      new Set(anchorCells.map((cell) => `${cell.col}:${cell.row}`)).size !== anchorCells.length ||
      anchorCells.some((cell) => !canPlaceAoe(area, casterCell, cell, input.map.feetPerCell))
    ) return { ok: false, reason: 'invalid-target' }
    if (activityAreaTarget?.instanceAdjacency === 'face' && anchorCells.length > 1) {
      if (area.shape !== 'rect') return { ok: false, reason: 'invalid-target' }
      const feetPerCell = Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
      const widthCells = area.widthFeet / feetPerCell
      const heightCells = area.heightFeet / feetPerCell
      const joined = new Set([0])
      while (joined.size < anchorCells.length) {
        const nextIndex = anchorCells.findIndex((candidate, candidateIndex) =>
          !joined.has(candidateIndex) && [...joined].some((joinedIndex) => {
            const joinedCell = anchorCells[joinedIndex]!
            const deltaCol = Math.abs(candidate.col - joinedCell.col)
            const deltaRow = Math.abs(candidate.row - joinedCell.row)
            return (Math.abs(deltaCol - widthCells) <= 1e-6 && deltaRow <= 1e-6) ||
              (Math.abs(deltaRow - heightCells) <= 1e-6 && deltaCol <= 1e-6)
          }))
        if (nextIndex < 0) return { ok: false, reason: 'invalid-target' }
        joined.add(nextIndex)
      }
    }
    const { cols: mapColumns, rows: mapRows } = mapCellExtent(input.map)
    const geometry = scaledActivity?.outcomes.some(outcome=>outcome.operations.some(operation=>operation.kind==='create-persistent-area'&&operation.surfaceAtPlacementElevation))
      ? mapGeometryWithObjectSurfaces(input.map,mapGeometryRuntimeForMap(input.map.id),input.characters) : mapGeometryRuntimeForMap(input.map.id)
    if(activityAreaTarget?.maximumBottomHeightAboveGroundFeet!==undefined){
      const elevation=resolveGroundedSphereElevation(activityAreaTarget,mapGeometryTerrainElevationAtPoint(geometry,cellToPixel(targetCell,input.map)),payload.targetElevationFeet)
      if(elevation===undefined)return {ok:false,reason:'invalid-target'}
      payload.targetElevationFeet=elevation
    }
    const objectFlight = objectLaunch?.harmlessPush ? planDnd5eHarmlessObjectPushAtAnchor({map: input.map, geometry, anchorCell: targetCell, actorId: actorToken.id, slotLevel, limits: objectLaunch.limits}) : objectLaunch ? planDnd5eMapObjectFlightAtAnchor({ map: input.map, geometry, anchorCell: targetCell,
      angleDegrees: payload.areaTargetAngleDegrees ?? (payload.areaTargetOrientation ?? 0) * 90,
      pitchDegrees: payload.objectLaunchPitchDegrees, slotLevel, limits: objectLaunch.limits }) : undefined
    if (objectFlight) {
      if (!objectFlight.ok) return { ok: false, reason: 'invalid-target' }
      const object = input.map.tokens.find(token => token.id === objectFlight.plan.objectId)!
      payload.targetElevationFeet = mapGeometryTokenElevation(geometry, object)
      const distance = dnd5eMapTokenDistanceFeet({ map: input.map, geometry, left: actorToken, right: object })
      if ('placeRangeFeet' in area && area.placeRangeFeet != null && distance > area.placeRangeFeet + 1e-4) return { ok: false, reason: 'target-out-of-range' }
    }
    const areaObstructions: ReturnType<typeof resolveSpellAreaObstruction>[] = []
    if (anchorCells.some(cell => !dnd5eAreaPlacementMatchesSurface({ target: activityAreaTarget,
      geometry, point: cellToPixel(cell, input.map), elevationFeet: payload.targetElevationFeet,
    }))) return { ok: false, reason: 'invalid-target' }
    if (dnd5eSpellTargetRequiresSight({ activityTarget: activityAreaTarget,
      requiresVisibleTarget: spell.ownerPluginId === DND5E_SRD_AUDITED_SPELL_PACKAGE_ID && dnd5eSpellVisibilityRequirement(spell.id) === 'required',
    }) && anchorCells.some(cell => {
      const aim = cellToPixel(cell, input.map)
      return !dnd5eActivityPointVisible({ map: input.map, viewer: actorToken, characters: input.characters,
        worldMinute: input.worldMinute,
        point: { ...aim, elevationFeet: spellAreaPointElevation(geometry, aim, payload.targetElevationFeet) } })
    })) return { ok: false, reason: 'spell-target-not-visible' }
    if (area.origin === 'point' && activityAreaTarget?.requiresLineOfEffect !== false && anchorCells.some(cell => {
      const aim = cellToPixel(cell, input.map)
      return mapGeometryLineOfEffectBlocked({ geometry, map: input.map, from: actorToken, to: aim,
        fromElevationFeet: mapGeometryTokenElevation(geometry, actorToken), toElevationFeet: spellAreaPointElevation(geometry, aim, payload.targetElevationFeet) })
    })) return { ok: false, reason: 'effect-line-blocked' }
    const completeSiteVolume = scaledActivity?.outcomes.some(outcome => outcome.operations.some(operation =>
      operation.kind === 'create-persistent-area' && (operation.utilityProjectionId === 'druid-grove' || operation.utilityProjectionId === 'mighty-fortress'))) === true
    const affectedCells = [...new Map(anchorCells.flatMap((anchorCell) => {
      const orientFrom = aoeOrientFromCell(area, casterCell, anchorCell, {
        rectRotation: payload.areaTargetOrientation,
        rectAngleDegrees: payload.areaTargetAngleDegrees,
      })
      const aim = cellToPixel(anchorCell, input.map)
      const rawCells = cellsForAoe(area, orientFrom, anchorCell, input.map.feetPerCell)
      const obstruction = resolveSpellAreaObstruction({ spellId: spell.id, map: input.map, geometry,
        cells: rawCells, area,
        origin: area.origin === 'point' ? aim : actorToken,
        elevationFeet: area.origin === 'point' ? spellAreaPointElevation(geometry, aim, payload.targetElevationFeet) : mapGeometryTokenElevation(geometry, actorToken),
        heightFeet: area.volumeHeightFeet,
        ignoresWalls: activityAreaTarget?.requiresLineOfEffect === false,
        spreadsAroundCorners: activityAreaTarget?.spreadsAroundCorners,
      })
      areaObstructions.push(obstruction)
      // The site-specific Host pass validates the complete grove/fortress footprint.
      return (completeSiteVolume ? rawCells : obstruction.cells).filter(cell => !activityAreaTarget ||
        dnd5eActivityGroundWithinVerticalRange(activityAreaTarget,
          area.origin === 'point' ? spellAreaPointElevation(geometry, aim, payload.targetElevationFeet) : mapGeometryTokenElevation(geometry, actorToken),
          mapGeometryTerrainElevationAtPoint(geometry, cellToPixel(cell, input.map))))
    }).filter((cell) =>
      cell.col >= 0 && cell.row >= 0 && cell.col < mapColumns && cell.row < mapRows,
    ).map((cell) => [`${cell.col}:${cell.row}`, cell])).values()]
    if (affectedCells.length === 0) return { ok: false, reason: 'invalid-target' }
    activityTargetCell = { ...targetCell }
    activityTargetCells = affectedCells.map((cell) => ({ ...cell }))
    const anchor = cellToPixel(targetCell, input.map)
    // Placement preview/range validation uses the campaign's square-grid
    // distance (diagonals count as one square). Preserve that same metric in
    // the Activity receipt so an approved diagonal placement cannot pass the
    // UI/prepare boundary and then fail the authoritative executor.
    activityAreaPlacementDistanceFeet = Math.max(...anchorCells.map((cell) =>
      cellDistance(casterCell, cell),
    )) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
    const activityUsesPlanarRectangle = activityAreaTarget != null &&
      (activityAreaTarget.shape === 'rect' || activityAreaTarget.shape === 'cube') &&
      area.shape === 'rect'
    activityAreaPlacement = {
      x: anchor.x,
      y: anchor.y,
      objectLaunchPitchDegrees: payload.objectLaunchPitchDegrees,
      elevationFeet: activityAreaTarget?.origin === 'self' || area.origin === 'self'
        ? mapGeometryTokenElevation(geometry, actorToken)
        : spellAreaPointElevation(geometry, anchor, payload.targetElevationFeet),
      angleDegrees: payload.areaTargetAngleDegrees ??
        (payload.areaTargetOrientation == null ? undefined : payload.areaTargetOrientation * 90),
      radiusFeet: 'radiusFeet' in area ? area.radiusFeet : undefined,
      lengthFeet: activityUsesPlanarRectangle
        ? activityAreaTarget.lengthFeet == null ? undefined : area.heightFeet
        : 'lengthFeet' in area ? area.lengthFeet : payload.areaTargetLengthFeet,
      widthFeet: 'widthFeet' in area ? area.widthFeet : payload.areaTargetWidthFeet,
      // Rect/cube Activity height is vertical extent. The browser's
      // areaTargetHeightFeet is the second planar dimension, which belongs in
      // Activity lengthFeet and must never inflate or invalidate that volume.
      heightFeet: activityUsesPlanarRectangle
        ? area.volumeHeightFeet
        : area.volumeHeightFeet ?? activityAreaTarget?.heightFeet,
      instances: anchorCells.map((cell) => {
        const point = cellToPixel(cell, input.map)
        return { x: point.x, y: point.y, elevationFeet: activityAreaTarget?.origin === 'self' || area.origin === 'self'
          ? mapGeometryTokenElevation(geometry, actorToken)
          : spellAreaPointElevation(geometry, point, payload.targetElevationFeet) }
      }),
    }
    const perception = activityAreaTarget?.requiresVisibleTargets ? createDnd5eMapCombatSnapshot({
      combatId: `spell-area-perception:${input.map.id}`, map: input.map,
      characters: input.characters, worldMinute: input.worldMinute,
      initiativeOrder: input.map.tokens.filter(token => token.type !== 'obstacle').map(token => ({
        tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 0,
      })),
    }).state : undefined
    targetTokens = activitySelectsMappedObject
      ? []
      : tokensInCells(input.map, input.map.tokens, affectedCells).filter((token) => {
        if(activityAreaTarget?.wallThicknessFeet != null && area.shape==='circle' &&
          !anchorCells.some(anchorCell=>annularAreaOverlapsBox({anchorCell,circularGeometry:{radiusFeet:area.radiusFeet,
            innerRadiusFeet:area.radiusFeet-activityAreaTarget.wallThicknessFeet!}},input.map,token,tokenFootprintCells(token)*input.map.gridSize/2)))return false
        // NPC/obstacle tokens are map scenery, not Headless combatants. Letting
        // one of them leak into an area spell's authoritative target list makes
        // an otherwise valid exploration cast fail later as combatant-missing.
        if ((token.type !== 'player' && token.type !== 'enemy') || isDefeatedAreaToken(token)) return false
        if (activityAreaTarget?.requiresGroundContact && Math.abs(mapGeometryTokenElevation(geometry, token) - mapGeometryTerrainElevationAtPoint(geometry, token)) > 1e-4) return false
        if (perception && !dnd5eCombatantCanSee(perception, actorToken.id, token.id)) return false
        if (!areaObstructions.some(obstruction => obstruction.affectsToken(token))) return false
        if (
          spell.id === 'fire-storm' && payload.activityChoices?.mode === 'spare-plants' &&
          token.creatureTypes?.some((type) => {
            const normalized = type.trim().toLocaleLowerCase()
            return normalized === 'plant' || normalized.includes('植物')
          }) === true
        ) return false
        if (token.id === actorToken.id && areaTargeting?.includeSelf !== true) return false
        const opposed = perceivesHostile(token)
        if (areaTargeting?.relation === 'ally' && opposed) return false
        if (areaTargeting?.relation === 'enemy' && !opposed) return false
        return true
        }).slice(0, activityAreaTarget?.selection === 'choose-any' ? undefined : targetCapacity.maximumTargets)
    if (activityAreaTarget?.selection === 'choose-any') {
      if (!dnd5eAreaTargetSelectionValid(activityAreaTarget, targetTokens.map(token => token.id), payload.targetTokenIds)) {
        return { ok: false, reason: 'invalid-target' }
      }
      const chosen = new Set(payload.targetTokenIds)
      targetTokens = targetTokens.filter(token => chosen.has(token.id))
    }
    if (objectFlight?.ok) {
      // This order is derived from geometry after validating the starting object.
      // Client-supplied creature ids never determine which save happens first.
      targetTokens = objectFlight.plan.creatures.map(contact => input.map.tokens.find(token => token.id === contact.tokenId)!)
    }
  } else if (dnd5ePluginSpellUsesSelfTarget(spell, scaledActivity)) {
    targetTokens = [actorToken]
  } else {
    // Imported Activities own their targeting contract, including an explicit
    // self exclusion. Legacy spell metadata is only a fallback without one.
    const creatureTargeting = scaledActivity?.target.kind === 'creature'
      ? scaledActivity.target
      : spell.targeting
    const requestedIds = targetCapacity.allowDuplicateTargets
      ? payload.projectileTargetIds ?? payload.targetTokenIds ?? [payload.targetTokenId || input.action.targetTokenId]
      : [...new Set(payload.targetTokenIds?.length ? payload.targetTokenIds : [payload.targetTokenId || input.action.targetTokenId])]
    if (requestedIds.length < 1 || requestedIds.length > targetCapacity.maximumTargets) return { ok: false, reason: 'invalid-target' }
    targetTokens = requestedIds.flatMap((targetId) => {
      const token = input.map.tokens.find((candidate) => candidate.id === targetId)
      return token ? [token] : []
    })
    const animatesObjects = dnd5eActivityAnimatesSelectedObjects(scaledActivity)
    if (animatesObjects && payload.targetTokenIds && new Set(payload.targetTokenIds).size !== payload.targetTokenIds.length) {
      return { ok: false, reason: 'invalid-target' }
    }
    const animatedSizes = scaledActivity?.outcomes.flatMap(outcome => outcome.operations)
      .flatMap(operation => operation.kind === 'summon' && operation.animatedObjectSize ? [operation.animatedObjectSize] : []) ?? []
    if (targetTokens.length !== requestedIds.length || targetTokens.some(token => animatesObjects
      ? !animatedSizes.every(size => dnd5eAnimatedObjectSnapshot(token, size, actorToken.id))
      : token.type === 'obstacle')) {
      return { ok: false, reason: 'invalid-target' }
    }
    for (const token of targetTokens) {
      if (token.id === actorToken.id && creatureTargeting?.includeSelf !== true) return { ok: false, reason: 'invalid-target' }
      const opposed = perceivesHostile(token)
      if (creatureTargeting?.relation === 'ally' && opposed) return { ok: false, reason: 'invalid-target' }
      if (creatureTargeting?.relation === 'enemy' && !opposed) return { ok: false, reason: 'invalid-target' }
      const distanceFeet = dnd5eMapTokenDistanceFeet({
        map: input.map,
        left: actorToken,
        right: token,
      })
      const linkedTarget = token.characterId
        ? input.characters.find((character) => character.id === token.characterId)
        : undefined
      const targetCreatureName = (linkedTarget?.name ?? token.label).trim()
      const targetClassState = linkedTarget?.dnd5eCombatState ?? token.dnd5eCombatState
      if (dnd5eActiveRevivalPrevented(targetClassState?.activeEffects)) return { ok: false, reason: 'invalid-target' }
      const createsReplacementBody = targetClassState?.bodyPresent === false &&
        reviveOperation?.createsNewBodyIfMissing === true
      const maximumRange = createsReplacementBody && reviveOperation.newBodyPlacementRangeFeet != null
        ? reviveOperation.newBodyPlacementRangeFeet
        : spell.range.type === 'touch'
        ? 5
        : spell.range.type === 'distance'
          ? (spell.range.feet ?? 0) * spellAttackRangeMultiplier
          : Number.POSITIVE_INFINITY
      if (distanceFeet > maximumRange) return { ok: false, reason: 'target-out-of-range' }
      if (reviveOperation?.excludesDeathFromOldAge === true && targetClassState?.deathCause !== 'other') {
        return { ok: false, reason: 'invalid-target' }
      }
      if (reviveOperation?.requiresFreeWillingSoul === true && targetClassState?.soulReturnStatus !== 'free-willing') {
        return { ok: false, reason: 'invalid-target' }
      }
      if (createsReplacementBody) {
        const spokenName = payload.trueResurrectionSpokenName?.trim()
        if (
          reviveOperation.requiresSpokenNameIfBodyMissing === true &&
          (!spokenName || spokenName.localeCompare(targetCreatureName, undefined, { sensitivity: 'accent' }) !== 0)
        ) return { ok: false, reason: 'invalid-target' }
        const placementCells = new Set(tokenOccupiedCellsAt(token, input.map, token).map(cellKey))
        const occupiedByAnotherToken = input.map.tokens.some((candidate) =>
          candidate.id !== token.id &&
          tokenOccupiedCellsAt(candidate, input.map, candidate).some((cell) => placementCells.has(cellKey(cell))))
        if (occupiedByAnotherToken) return { ok: false, reason: 'invalid-target' }
      } else if (payload.trueResurrectionSpokenName != null) {
        return { ok: false, reason: 'invalid-action' }
      }
    }
  }
  if (racialGrant?.targetRestriction === 'self' && targetTokens.some(token => token.id !== actorToken.id)) {
    return { ok: false, reason: 'invalid-target' }
  }
  // Persistent/summoning and mapped-object Activities can legally be placed
  // where there is no creature token. Keep a caster fallback only for
  // UI/interrupt attribution; the actual Activity targetIds remain empty so
  // the caster is not fabricated as an affected target.
  const targetToken = targetTokens[0] ?? (area && (activityPermitsEmptyArea ||
    (scaledActivity?.target.kind === 'area' && scaledActivity.target.selection === 'choose-any' &&
      (scaledActivity.target.minimumTargets ?? 0) === 0)) ? actorToken : undefined)
  if (!targetToken) return { ok: false, reason: 'invalid-target' }
  const contextualWizard = castingClassId === 'wizard' &&
    actor.dnd5eClassChoices?.classes?.wizard?.subclass === 'evocation'
  const overchannel = payload.overchannel === true
  const canOverchannel = contextualWizard && castingClassLevel >= 14 &&
    spell.school === 'evocation' && spell.level >= 1 && spell.level <= 5 &&
    slotLevel >= spell.level && slotLevel <= 5 && mechanics?.damage != null
  if (overchannel && !canOverchannel) return { ok: false, reason: 'invalid-action' }
  if (
    payload.empowered === true || payload.draconicResistance === true ||
    payload.repellingBlast === true || payload.metamagic != null
  ) return { ok: false, reason: 'invalid-action' }
  const suppliedSculptedTargetIds = payload.sculptedTargetIds ?? []
  const sculptedTargetIds = [...new Set(suppliedSculptedTargetIds)]
  const canSculpt = contextualWizard && castingClassLevel >= 2 &&
    spell.school === 'evocation' && area != null &&
    (mechanics?.resolution === 'saving-throw' || activity?.checks?.some((check) => check.kind === 'saving-throw') === true)
  if (
    sculptedTargetIds.length !== suppliedSculptedTargetIds.length ||
    (!canSculpt && sculptedTargetIds.length > 0) ||
    sculptedTargetIds.length > spell.level + 1 ||
    sculptedTargetIds.some((targetId) =>
      targetId === actorToken.id || !targetTokens.some((token) => token.id === targetId),
    )
  ) return { ok: false, reason: 'invalid-target' }
  const sculptedTargetIdSet = new Set(sculptedTargetIds)
  const overchannelUses = Math.max(0, Math.floor(actor.dnd5eCombatState?.overchannelUsesSinceLongRest ?? 0))
  const overchannelSelfDamageDiceCount = overchannel && overchannelUses > 0
    ? (overchannelUses + 1) * slotLevel
    : 0

  // A specifically selected map NPC is a real creature target even though it
  // does not normally occupy the initiative tracker. Project only those NPCs
  // into this private authority snapshot, preserving the original map token
  // type while reusing the generic creature combatant builder. This keeps
  // willing exploration buffs such as Wind Walk atomic instead of accepting
  // the target in the UI and later rejecting it as combatant-missing.
  const snapshotNpcTargetIds = new Set(
    targetTokens.filter((target) => target.type === 'npc').map((target) => target.id),
  )
  const animatesCorpses=dnd5eActivityProtectsRemains(activity, payload.activityChoices) || activity?.outcomes.some(outcome=>outcome.operations.some(operation=>operation.kind==='summon'&&operation.corpseFormChoiceId))===true
  const snapshotExtraTargetIds=new Set([...snapshotNpcTargetIds,...animatesCorpses?targetTokens.filter(target=>(target.hp??target.maxHp??1)<=0).map(target=>target.id):[]])
  const snapshotMap: BattleMap = snapshotNpcTargetIds.size > 0
    ? {
        ...input.map,
        tokens: input.map.tokens.map((token) => snapshotNpcTargetIds.has(token.id)
          ? { ...token, type: 'player' as const }
          : token),
      }
    : input.map
  const snapshotInitiativeTokenIds = new Set(input.initiativeOrder.map((entry) => entry.tokenId))
  const snapshotInitiativeOrder: readonly InitiativeEntry[] = snapshotExtraTargetIds.size > 0
    ? [
        ...input.initiativeOrder,
        ...targetTokens.flatMap((target) =>
          snapshotExtraTargetIds.has(target.id) && !snapshotInitiativeTokenIds.has(target.id)
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
    worldMinute: input.worldMinute,
    combatId: input.action.combatId ?? `map-${input.map.id}`,
    round: input.authorityRound ?? input.action.round,
    turnSlotId: snapshotInitiativeOrder[input.action.initiativeIndex]?.slotId,
    map: snapshotMap,
    characters: input.characters,
    roomMaps: input.roomMaps,
    initiativeOrder: snapshotInitiativeOrder,
    objectInteractionTargetIds: dnd5eActivityAnimatesSelectedObjects(activity) ? targetTokens.map(token => token.id) : undefined,
    additionalCreatureTokenIds: [
      ...targetTokens.map(token => token.id),
      ...snapshotMap.tokens.filter(token => token.dnd5eSummon?.sourceTokenId === actorToken.id &&
        (token.dnd5eSummon.shareSelfSpellsRangeFeet ?? 0) >= 5).map(token => token.id),
    ],
  })
  // Exploration casts share the combat resolver, but a scene containing only
  // the caster produces an inactive one-combatant synthetic snapshot. Keep
  // combat-less spell transactions resolvable while preserving live-combat
  // turn and combat-id checks.
  if (!liveCombatCast) prepareDnd5eExplorationActor(snapshot.state, actorToken.id)
  const actorIndex = dnd5eRequestedInitiativeActorIndex(
    snapshot.state,
    actorToken.id,
    input.action.initiativeIndex,
  )
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  const targetCombatants = targetTokens.map((token) => snapshot.state.combatants[token.id])
  if (actorIndex < 0 || !actorCombatant || targetCombatants.some((target) => !target)) return { ok: false, reason: 'combatant-missing' }
  // Active-effect requirements are deterministic from the authoritative map
  // snapshot. Reject them before Host dice or an assisted DM boundary is
  // opened; otherwise a creature that already has source-bound immunity (for
  // example, a successful Imprisonment save) asks the DM to approve a cast
  // that the atomic resolver can only roll back afterward.
  const selectedChoiceRequirements = effectiveActivity?.choices?.flatMap((choice) => {
    const selectedOptionId = payload.activityChoices?.[choice.id] ?? choice.defaultOptionId
    return choice.options.find((option) => option.id === selectedOptionId)?.requirements ?? []
  }) ?? []
  const activeEffectRequirements = [
    ...(effectiveActivity?.requirements ?? []),
    ...selectedChoiceRequirements,
  ].filter((requirement) => requirement.kind === 'active-effect')
  if (effectiveActivity?.requirements?.some(requirement => requirement.kind === 'ethereal-access' && requirement.state === 'known') &&
      dnd5eActorEtherealAccess(snapshot.state, actorCombatant.classState.activeEffects) === 'unknown') {
    return { ok: false, reason: 'ethereal-plane-unknown' }
  }
  for (const requirement of activeEffectRequirements) {
    const subjects = requirement.subject === 'actor'
      ? [actorCombatant]
      : targetCombatants.filter((target): target is NonNullable<typeof target> => target != null)
    for (const subject of subjects) {
      const present = subject.classState.activeEffects?.some((effect) =>
        effect.definitionId.includes(`:${requirement.effectId}`) &&
        (requirement.source === 'any' || effect.source.actorId === actorCombatant.id),
      ) === true
      if (present === requirement.present) continue
      if (requirement.subject === 'target' && requirement.present === false && present) {
        return { ok: false, reason: 'target-immune' }
      }
      return { ok: false, reason: requirement.subject === 'target' ? 'invalid-target' : 'invalid-action' }
    }
  }
  if (!area && targetTokens.some((token) => snapshot.state.lineOfEffectBlockedByCombatantPair?.[dnd5eDirectedCombatantPairKey(actorToken.id, token.id)])) {
    return { ok: false, reason: 'effect-line-blocked' }
  }
  for (const [tokenId, economy] of Object.entries(input.turnEconomyByToken ?? {})) {
    const combatant = snapshot.state.combatants[tokenId]
    if (!combatant) continue
    combatant.turn = { ...combatant.turn, actionAvailable: economy.action.current > 0, bonusActionAvailable: economy.bonusAction.current > 0, reactionAvailable: economy.reaction.current > 0, movementRemaining: economy.movement.current }
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
  if (!liveCombatCast) {
    // Every exploration cast is a standalone transaction. Persistent map
    // snapshots can still contain the last synthetic turn's action pools and
    // spell-turn keys, but those must never lock a later out-of-combat cast.
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: true,
      bonusActionAvailable: true,
      reactionAvailable: true,
      objectInteractionAvailable: true,
      movementRemaining: actorCombatant.speed,
    }
    actorCombatant.classState.bonusActionSpellTurnKey = undefined
    actorCombatant.classState.leveledSpellTurnKey = undefined
  }
  const damage = mechanics?.damage
  const upcast = mechanics
    ? dnd5eSpellUpcastTotals(mechanics, slotLevel, spell.level)
    : { damageDice: 0, flatDamage: 0, durationRounds: 0 }
  const cantripScaling = dnd5eSpellCantripScalingTotals(damage, actor.level)
  const castingModifier = damage?.addSpellcastingModifier
    ? rules.abilityModifier(actor.abilities[castingAbility])
    : 0
  let workshopDamageModifier: number
  try {
    workshopDamageModifier = evaluateDnd5eWorkshopDamageFormula(damage?.dice.modifierFormula, {
      level: actor.level,
      proficiencyBonus: rules.proficiencyBonus(actor.level),
      abilities: actor.abilities,
      classLevels: normalizeDnd5eWorkshopFormulaClassLevels(actor.dnd5eClassLevels),
      currentHp: actor.currentHp,
      maxHp: actor.maxHp,
      spellcastingAbilityModifier: rules.abilityModifier(actor.abilities[castingAbility]),
    })
  } catch {
    return { ok: false, reason: 'invalid-dice' }
  }
  const spellSaveDc = 8 + rules.proficiencyBonus(actor.level) +
    rules.abilityModifier(actor.abilities[castingAbility])
  // Activity execution reads spell references and ActiveEffect source metadata
  // from the combatant snapshot. The legacy character saveDC field can be stale
  // (the UI derives the live class DC), so pin this cast to the selected class's
  // authoritative DC before the audited Headless Activity is executed.
  actorCombatant.saveDc = spellSaveDc
  const activitySavingThrow = activity?.checks?.find((check) => check.kind === 'saving-throw')
  const saveAbility = mechanics?.savingThrow?.ability ??
    (activitySavingThrow?.kind === 'saving-throw' ? activitySavingThrow.ability : undefined)
  const actorProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const affectedTargets: PreparedDnd5ePluginSpellTarget[] = targetTokens.map((token, index) => {
    const targetCombatant = snapshot.state.combatants[token.id]!
    const directedPairKey = dnd5eDirectedCombatantPairKey(actorToken.id, token.id)
    const distanceFeet = dnd5eMapTokenDistanceFeet({
      map: input.map,
      left: actorToken,
      right: token,
    })
    const saveModifier = saveAbility
      ? (targetCombatant.savingThrowBonuses[saveAbility] ?? rules.abilityModifier(targetCombatant.abilities[saveAbility])) +
        (saveAbility === 'dex' && spell.id !== 'sacred-flame' ? snapshot.state.coverBonusByCombatantPair?.[directedPairKey] ?? 0 : 0)
      : undefined
    const targetProne = targetCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
    const actorAttackRollEffect = dnd5eActiveAttackRollFlags(actorCombatant.classState.activeEffects, castingAbility, 'spell')
    const targetLinkedAttackRollEffect = dnd5eActiveTargetLinkedAttackRollFlags(
      targetCombatant.classState.activeEffects,
      actorCombatant.id,
      actorCombatant.creatureType,
      { ...snapshot.state, initiativeIndex: actorIndex },
    )
    const attackAdvantage = !dnd5ePreventsAttackAdvantage(targetCombatant) && (
      dnd5eTargetGrantsAttackAdvantage(targetCombatant) || actorCombatant.classState.hiddenCheckTotal != null ||
      !!targetCombatant.classState.recklessAttackTurnKey || !!targetCombatant.classState.stunnedByActorId ||
      dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, token.id) || (targetProne && distanceFeet <= 5)
      || actorAttackRollEffect.advantage
      || targetLinkedAttackRollEffect.advantage
    )
    const attackDisadvantage = actorCombatant.exhaustionLevel >= 3 || dnd5eTargetIsDodging(targetCombatant) ||
      dnd5eBlurImposesAttackDisadvantage(snapshot.state, actorToken.id, token.id) ||
      dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant) ||
      dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, token.id) || actorProne ||
      (targetProne && distanceFeet > 5) || actorAttackRollEffect.disadvantage
      || targetLinkedAttackRollEffect.disadvantage
    return {
      key: `${token.id}:${index}`,
      token,
      distanceFeet,
      attackMode: resolveDnd5eRollMode({
        advantage: [{ active: attackAdvantage, reason: 'plugin-spell-attack-advantage' }],
        disadvantage: [{ active: attackDisadvantage, reason: 'plugin-spell-attack-disadvantage' }],
      }).mode,
      saveModifier,
      saveMode: saveAbility ? dnd5eSavingThrowMode(targetCombatant, saveAbility, {
        effectVisible: true,
        sourceCreatureType: actorCombatant.creatureType,
        sourceIsSpell: true,
        sourceDistanceFeet: distanceFeet,
      }) : undefined,
      saveAutomaticallyFails: saveAbility ? dnd5eConditionSavingThrowAutomaticallyFails(targetCombatant, saveAbility) : false,
      armorClass: dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, token.id, 'spell'),
    }
  })
  const targets = affectedTargets.filter((target) => !sculptedTargetIdSet.has(target.token.id))
  const firstTarget = targets[0] ?? affectedTargets[0]
  const concentrationRounds = dnd5ePluginSpellConcentrationRounds({ activity: scaledActivity, slotLevel, baseRounds:
spell.duration.concentration &&
    !(spell.id === 'bestow-curse' && slotLevel >= 5) &&
    !(spell.id === 'major-image' && slotLevel >= 6)
    ? spell.id === 'bestow-curse' && slotLevel === 4
      ? 100
      : Math.min(14_400, spellDurationRounds(spell) + upcast.durationRounds)
    : undefined
  })
  const now = input.now ?? Date.now()
  const castingBinding = dnd5ePluginSpellCastingProximityBinding({ action: input.action, spell,
    map: input.map, actorToken, targetTokens, activityTargetCell, payload, activity })
  const castingProximityReceipt = castingBinding ? captureDnd5eCastingProximity(castingBinding, input.map, mapGeometryRuntimeForMap(input.map.id)) : undefined
  const mapItemConversions = activity?.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, payload.activityChoices ?? {}))
    .flatMap(outcome => outcome.operations.filter(operation => operation.kind === 'convert-map-inventory-item')) ?? []
  let mapItemConversionBinding: string | undefined
  if (mapItemConversions.length) {
    if (mapItemConversions.length !== 1 || !scaledActivity || !activityTargetCell || !settleDnd5eMapItemConversion({map:input.map,
      actorTokenId:actorToken.id,activity:scaledActivity,anchorCell:activityTargetCell,actionId:input.action.id,
      proposal:{...mapItemConversions[0],operationId:mapItemConversions[0].id}}).ok) return {ok:false,reason:'invalid-target'}
    mapItemConversionBinding = dnd5eMapItemConversionBinding(input.map, activityTargetCell, mapItemConversions[0].originalTemplateIds)
  }
  if (castingBinding && !castingProximityReceipt) return { ok: false, reason: 'invalid-target' }
  const longCastingReceipt = castingTime === 'long' ? captureDnd5eLongCasting({ requestId: input.action.id,
    spellId: spell.id, mapId: input.map.id, actorTokenId: actorToken.id, actorCharacterId: actor.id }, actorCombatant,
    liveCombatCast?{combatId:input.action.combatId!,requiredRounds:activityCompletionDelayRounds,startRound:snapshot.state.round}:undefined) : undefined
  if (castingTime === 'long' && !longCastingReceipt) return { ok: false, reason: 'invalid-actor' }
  return {
    ok: true,
    prepared: {
      mapItemConversionBinding,
      longCastingReceipt,
      castingProximityReceipt,
      action: input.action,
      payload,
      spell,
      map: input.map,
      characters: input.characters,
      roomMaps: input.roomMaps,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      castingClassId,
      racialInnate: racialGrant ? true : undefined,
      castingClassLevel,
      actorToken,
      targetToken,
      targetTokens,
      targets,
      tinyHut,
      antipathySympathy,
      area: area ?? undefined,
      activity,
      targetSelection: scaledActivity?.target,
      activityHeadlessAction: activity ? {
        type: 'plugin',
        pluginId: spell.ownerPluginId,
        actionId: spell.automation.actionId,
        transactionId: input.action.id,
        actorId: actorToken.id,
        targetId: targets[0]?.token.id,
        targetIds: [...new Set(targets.map((target) => target.token.id))],
        projectileTargetIds: scaledActivity?.target.kind === 'creature' && scaledActivity.target.allowDuplicateTargets === true
          ? targets.map(target => target.token.id) : undefined,
        targetCell: activityTargetCell,
        targetOrientation: payload.areaTargetOrientation,
        distanceFeet: Math.max(0, ...targets.map((target) => target.distanceFeet)),
        activityAreaPlacement,
        activityAreaPlacementDistanceFeet,
        ...(activityAreaExemptTargetIds.length > 0
          ? { activityAreaExemptTargetIds }
          : {}),
        castLevel: slotLevel,
        payload: payload.activityChoices || payload.activityTargetFormIds || payload.companionHelpTargets || payload.companionAttackTargets || payload.companionMovementDestinations || payload.companionGuardAreas || payload.companionObjectInteractions || payload.companionReadyTriggers || payload.companionTaskDescriptions || payload.activityInventoryInstanceId || payload.activityGroundInventorySelections || payload.magicMouth ||
          activitySecretPhrase || activityCompletionDelayRounds > 0
          ? {
              ...(payload.activityChoices ? { activityChoices: { ...payload.activityChoices } } : {}),
              ...(payload.activityTargetFormIds ? { activityTargetFormIds: structuredClone(payload.activityTargetFormIds) } : {}),
              ...(payload.companionHelpTargets ? { companionHelpTargets: structuredClone(payload.companionHelpTargets) } : {}),
              ...(payload.companionAttackTargets ? { companionAttackTargets: structuredClone(payload.companionAttackTargets) } : {}),
              ...(payload.companionMovementDestinations ? { companionMovementDestinations: structuredClone(payload.companionMovementDestinations) } : {}),
              ...(payload.companionTaskDescriptions ? { companionTaskDescriptions: structuredClone(payload.companionTaskDescriptions) } : {}),
              ...(payload.companionReadyTriggers ? { companionReadyTriggers: structuredClone(payload.companionReadyTriggers) } : {}),
              ...(payload.companionObjectInteractions ? { companionObjectInteractions: structuredClone(payload.companionObjectInteractions) } : {}),
              ...(payload.companionGuardAreas ? { companionGuardAreas: structuredClone(payload.companionGuardAreas) } : {}),
              ...(payload.magicMouth ? { magicMouth: { ...payload.magicMouth } } : {}),
              ...(activitySecretPhrase ? { secretPhrase: activitySecretPhrase } : {}),
              ...(payload.activityInventoryInstanceId
                ? { activityInventoryInstanceId: payload.activityInventoryInstanceId, expectedActivityInventoryRevision: payload.expectedActivityInventoryRevision }
                : {}),
              ...(payload.activityInventorySelections ? { activityInventorySelections: payload.activityInventorySelections } : {}),
              ...(payload.activityGroundInventorySelections ? { activityGroundInventorySelections: payload.activityGroundInventorySelections } : {}),
              ...(payload.activityInventoryCharacterId
                ? { activityInventoryCharacterId: payload.activityInventoryCharacterId }
                : {}),
              ...(activityCompletionDelayRounds > 0
                ? { activityCompletionDelayRounds }
                : {}),
            }
          : undefined,
      } : undefined,
      activityTargetCell,
      activityTargetCells,
      activityAreaPlacement,
      activityAreaPlacementDistanceFeet,
      activityAreaExemptTargetIds,
      slotLevel,
      ritual,
      castingTime,
      componentCheck,
      spellMaterialPlan: enforceSpellcastingPrerequisites && !ignoreMaterialComponents ? componentCheck.materialPlan : undefined,
      alternateResourceSpell: alternateResourceSpell ? { featureId: alternateResourceSpell.featureId, grantId: alternateResourceSpell.grantId } : undefined,
      attackModifier: spellSaveDc - 8,
      castingAbility,
      attackMode: firstTarget?.attackMode ?? 'normal',
      saveDc: spellSaveDc,
      saveModifier: firstTarget?.saveModifier,
      saveMode: firstTarget?.saveMode,
      saveAutomaticallyFails: firstTarget?.saveAutomaticallyFails ?? false,
      targetArmorClass: firstTarget?.armorClass ?? 0,
      damageDice: {
        count: Math.max(0, (damage?.dice.count ?? 0) + cantripScaling.damageDice + upcast.damageDice),
        sides: damage?.dice.sides ?? 2,
        bonus: (damage?.dice.bonus ?? 0) + workshopDamageModifier + cantripScaling.flatDamage + upcast.flatDamage + castingModifier,
      },
      overchannel,
      overchannelSelfDamageDiceCount,
      sculptedTargetIds,
      concentrationRounds,
      upcastDurationRounds: upcast.durationRounds,
      transaction: createCombatTransaction({
        id: input.action.id,
        mapId: input.map.id,
        combatId: input.action.combatId,
        actorId: actor.id,
        actionId: input.action.id,
        actionKind: 'plugin-spell',
        activityDefinitionId: dnd5eTrackableDefinitionIdV1({
          namespace: spell.ownerPluginId,
          kind: 'spell',
          localId: spell.id.startsWith(`${spell.ownerPluginId}:`)
            ? spell.id.slice(spell.ownerPluginId.length + 1)
            : spell.id,
        }),
        activityExecutionId: input.action.id,
        now,
      }),
    },
  }
}

export function dnd5ePluginSpellCastingProximityBinding(prepared: Pick<PreparedDnd5ePluginSpellCast,
  'action' | 'spell' | 'map' | 'actorToken' | 'targetTokens' | 'activityTargetCell' | 'payload' | 'activity'>): Dnd5eCastingProximityBinding | undefined {
  const constraints = prepared.activity?.castingConstraints
  return constraints ? { requestId: prepared.action.id, spellId: prepared.spell.id, activityId: prepared.activity!.id,
    mapId: prepared.map.id, actorTokenId: prepared.actorToken.id, targetTokenIds: prepared.targetTokens.map(token => token.id),
    targetCell: prepared.activityTargetCell, targetElevationFeet: prepared.payload.targetElevationFeet,
    choices: prepared.payload.activityChoices, maximumTargetDistanceFeet: constraints.maximumTargetDistanceFeet } : undefined
}

export function dnd5ePreparedSpellCastingProximityValid(prepared: PreparedDnd5ePluginSpellCast,
  map: BattleMap | undefined, geometry = mapGeometryRuntimeForMap(prepared.map.id)): boolean {
  const binding = dnd5ePluginSpellCastingProximityBinding(prepared)
  if (!binding) return true
  if (!verifyDnd5eCastingProximity(prepared.castingProximityReceipt, binding, map, geometry)) return false
  // Remaining within a ten-foot ceremony tether is separate from being able to
  // touch the target when the completed spell is applied.
  return prepared.spell.range.type !== 'touch' || dnd5eCastingTargetsWithinRange({ ...binding,
    maximumTargetDistanceFeet: Math.min(binding.maximumTargetDistanceFeet, 5) }, map, geometry, true)
}

export function dnd5ePreparedLongCastingBinding(prepared: PreparedDnd5ePluginSpellCast): Dnd5eLongCastingBinding {
  return { requestId: prepared.action.id, spellId: prepared.spell.id, mapId: prepared.map.id,
    actorTokenId: prepared.actorToken.id, actorCharacterId: prepared.actor.id }
}
function freshLongCastingSnapshot(prepared: PreparedDnd5ePluginSpellCast,
  room: { maps: readonly BattleMap[]; characters: readonly Character[] } | undefined) {
  if (!room) return undefined
  const maps = room.maps.filter(map => map.id === prepared.map.id)
  if (maps.length !== 1) return undefined
  const animatesObjects = dnd5eActivityAnimatesSelectedObjects(prepared.activity)
  if (animatesObjects) {
    const sizes = prepared.activity!.outcomes.flatMap(outcome => outcome.operations).flatMap(operation =>
      operation.kind === 'summon' && operation.animatedObjectSize ? [operation.animatedObjectSize] : [])
    if (prepared.targetTokens.some(target => !sizes.every(size => dnd5eAnimatedObjectSnapshot(
      maps[0].tokens.find(token => token.id === target.id), size, prepared.actorToken.id)))) return undefined
  }
  const selectedNpcIds = new Set(prepared.targetTokens.filter(token => token.type === 'npc').map(token => token.id))
  // Preserve the ordinary prepare path's private generic-creature projection
  // for selected scenery NPCs; never rewrite their persisted token type.
  const snapshotMap = { ...maps[0], tokens: maps[0].tokens.map(token => token.type === 'npc' && selectedNpcIds.has(token.id)
    ? { ...token, type: 'player' as const } : token) }
  const snapshot=createDnd5eMapCombatSnapshot({ combatId: prepared.state.combatId, round: prepared.state.round,
    worldMinute: prepared.state.combatants[prepared.actorToken.id]?.campaignWorldMinute,
    map: snapshotMap, roomMaps: room.maps, characters: room.characters,
    objectInteractionTargetIds: animatesObjects ? prepared.targetTokens.map(token => token.id) : undefined,
    initiativeOrder: prepared.state.initiativeOrder.flatMap(id=>{
      const token=maps[0].tokens.find(token=>token.id===id)
      return token?[{tokenId:token.id,label:token.label,color:token.color,emoji:token.emoji,roll:0}]:[]
    }) })
  snapshot.state.initiativeIndex=snapshot.state.initiativeOrder.indexOf(prepared.actorToken.id)
  snapshot.state.active=prepared.state.active
  return snapshot
}
/** Start consumes no material or slot. Caller must publish then arm the private receipt. */
export function prepareDnd5eLongCastingStart(prepared: PreparedDnd5ePluginSpellCast,
  room: { maps: readonly BattleMap[]; characters: readonly Character[] }): Dnd5eMapResultPlan | undefined {
  if (!dnd5eSpellPlacementQualified(prepared)) return undefined
  if (prepared.castingTime !== 'long' || !dnd5eObservePreparedLongCasting(prepared, room)) return undefined
  const snapshot = freshLongCastingSnapshot(prepared, room)
  const state = snapshot && beginDnd5eLongCasting(prepared.longCastingReceipt,
    dnd5ePreparedLongCastingBinding(prepared), snapshot.state)
  if (!state || !snapshot) return undefined
  return planDnd5eMapResultApplication({ state, map: room.maps.find(map => map.id === prepared.map.id)!,
    characters: room.characters, characterIdByCombatantId: snapshot.characterIdByCombatantId })
}
export function activateDnd5ePreparedLongCasting(prepared: PreparedDnd5ePluginSpellCast,
  room: { maps: readonly BattleMap[]; characters: readonly Character[] },publishedCombatState?:Dnd5eHeadlessCombatState): boolean {
  if (!dnd5eObservePreparedLongCasting(prepared, room)) return false
  const snapshot = freshLongCastingSnapshot(prepared, room)
  if(prepared.action.combatId){
    if(!snapshot||!publishedCombatState||publishedCombatState.combatId!==prepared.state.combatId||
      publishedCombatState.round!==prepared.state.round||publishedCombatState.initiativeOrder[publishedCombatState.initiativeIndex]!==prepared.actorToken.id)return false
    snapshot.state.combatants[prepared.actorToken.id].turn={...publishedCombatState.combatants[prepared.actorToken.id].turn}
  }
  return !!snapshot && armDnd5eLongCasting(prepared.longCastingReceipt, dnd5ePreparedLongCastingBinding(prepared),
    snapshot.state.combatants[prepared.actorToken.id])
}
export function invalidateDnd5ePreparedLongCasting(prepared: PreparedDnd5ePluginSpellCast): void {
  invalidateDnd5eLongCasting(prepared.longCastingReceipt)
}
/** Cleanup only this request's channel; never cancel a replacement spell. */
export function prepareDnd5eRecoveredLongCastingEnd(binding: Dnd5eLongCastingBinding,
  room: { maps: readonly BattleMap[]; characters: readonly Character[] }): Dnd5eMapResultPlan | undefined {
  const maps = room.maps.filter(map => map.id === binding.mapId)
  const characters = room.characters.filter(character => character.id === binding.actorCharacterId)
  const tokens = maps[0]?.tokens.filter(token => token.id === binding.actorTokenId && token.characterId === binding.actorCharacterId)
  if (maps.length !== 1 || characters.length !== 1 || tokens?.length !== 1 ||
    characters[0].dnd5eCombatState?.concentrationSpellId !== dnd5eLongCastingConcentrationId(binding)) return undefined
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: `casting-recovery:${binding.requestId}`, round: 1,
    worldMinute: characters[0].dnd5eWorldTimeAppliedMinute, map: maps[0], roomMaps: room.maps, characters: room.characters,
    initiativeOrder: maps[0].tokens.map(token => ({tokenId:token.id,label:token.label,color:token.color,emoji:token.emoji,roll:0})) })
  const actor = snapshot.state.combatants[binding.actorTokenId]
  if (!actor || actor.classState.concentrationSpellId !== dnd5eLongCastingConcentrationId(binding)) return undefined
  endDnd5eConcentration(snapshot.state, actor, [])
  return planDnd5eMapResultApplication({state:snapshot.state,map:maps[0],characters:room.characters,
    characterIdByCombatantId:snapshot.characterIdByCombatantId})
}
export function prepareDnd5eLongCastingEnd(prepared: PreparedDnd5ePluginSpellCast,
  room: { maps: readonly BattleMap[]; characters: readonly Character[] }): Dnd5eMapResultPlan | undefined {
  if (prepared.castingTime !== 'long' || !prepared.longCastingReceipt) return undefined
  const snapshot = freshLongCastingSnapshot(prepared, room)
  const actor = snapshot?.state.combatants[prepared.actorToken.id]
  if (!actor || actor.classState.concentrationSpellId !== dnd5eLongCastingConcentrationId(dnd5ePreparedLongCastingBinding(prepared))) return undefined
  endDnd5eConcentration(snapshot!.state, actor, [])
  return planDnd5eMapResultApplication({ state: snapshot!.state, map: room.maps.find(map => map.id === prepared.map.id)!,
    characters: room.characters, characterIdByCombatantId: snapshot!.characterIdByCombatantId })
}

/** Project fresh canonical caster conditions, rather than token HP mirrors or saved preparation state. */
export function dnd5eObservePreparedLongCasting(prepared: PreparedDnd5ePluginSpellCast,
  room: { maps: readonly BattleMap[]; characters: readonly Character[] } | undefined): boolean {
  if (prepared.castingTime !== 'long') return true
  if (prepared.mapItemConversionBinding) {
    const operations = prepared.activity?.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, prepared.payload.activityChoices ?? {}))
      .flatMap(outcome => outcome.operations.filter(operation => operation.kind === 'convert-map-inventory-item')) ?? []
    const maps = room?.maps.filter(map => map.id === prepared.map.id) ?? []
    if (operations.length !== 1 || maps.length !== 1 || !prepared.activityTargetCell ||
      dnd5eMapItemConversionBinding(maps[0],prepared.activityTargetCell,operations[0].originalTemplateIds) !== prepared.mapItemConversionBinding) {
      invalidateDnd5ePreparedLongCasting(prepared)
      return false
    }
  }
  const binding = dnd5ePreparedLongCastingBinding(prepared)
  const maps = room?.maps.filter(map => map.id === binding.mapId) ?? []
  const tokens = maps.length === 1 ? maps[0].tokens.filter(token => token.id === binding.actorTokenId) : []
  const characters = room?.characters.filter(character => character.id === binding.actorCharacterId) ?? []
  const validIdentity = tokens.length === 1 && tokens[0].characterId === binding.actorCharacterId && characters.length === 1
  const actor = validIdentity ? createDnd5eMapCombatSnapshot({ combatId: prepared.state.combatId,
    map: { ...maps[0], tokens }, characters, initiativeOrder: [{ tokenId: tokens[0].id,
      label: tokens[0].label, color: tokens[0].color, emoji: tokens[0].emoji, roll: 0 }] }).state.combatants[binding.actorTokenId] : undefined
  return observeDnd5eLongCasting(prepared.longCastingReceipt, binding, actor)
}

export function resolvePreparedDnd5ePluginSpellCast(input: {
  prepared: PreparedDnd5ePluginSpellCast
  /** Fresh Host store data after asynchronous dice/confirmation, never action payload. */
  currentRoom?: { maps: readonly BattleMap[]; characters: readonly Character[] }
  /** Current canonical Host turn snapshot; never taken from a player payload. */
  currentCombatState?:Dnd5eHeadlessCombatState
  rolls: Dnd5ePluginSpellResolutionRolls
  now?: number
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
  attackDecoyRolls?: readonly import('./headlessCombatEngine').Dnd5eAttackDecoyOccurrenceRoll[]
}): Dnd5ePluginSpellResolution {
  let prepared = input.prepared
  if (!dnd5eSpellPlacementQualified(prepared)) return {
    result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
    transaction: rollbackCombatTransaction(prepared.transaction, 'invalid-target', input.now ?? Date.now()),
  }
  const supplied = input.rolls
  if (prepared.mapItemConversionBinding) {
    const operations = prepared.activity?.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, prepared.payload.activityChoices ?? {}))
      .flatMap(outcome => outcome.operations.filter(operation => operation.kind === 'convert-map-inventory-item')) ?? []
    const maps = input.currentRoom?.maps.filter(map => map.id === prepared.map.id) ?? [prepared.map]
    if (operations.length !== 1 || maps.length !== 1 || !prepared.activityTargetCell ||
      dnd5eMapItemConversionBinding(maps[0],prepared.activityTargetCell,operations[0].originalTemplateIds) !== prepared.mapItemConversionBinding) return {
      result:{ok:false,state:prepared.state,events:[],reason:'invalid-target'},
      transaction:rollbackCombatTransaction(prepared.transaction,'invalid-target',input.now??Date.now()),
    }
  }
  if (prepared.castingTime === 'long' && !dnd5eLongCastingStarted(prepared.longCastingReceipt)) return {
    result: { ok: false, state: prepared.state, events: [], reason: 'invalid-actor' },
    transaction: rollbackCombatTransaction(prepared.transaction, 'invalid-actor', input.now ?? Date.now()),
  }
  if (!dnd5eObservePreparedLongCasting(prepared, input.currentRoom)) return {
    result: { ok: false, state: prepared.state, events: [], reason: 'invalid-actor' },
    transaction: rollbackCombatTransaction(prepared.transaction, 'invalid-actor', input.now ?? Date.now()),
  }
  if(prepared.castingTime==='long'&&!dnd5eLongCastingCanComplete(prepared.longCastingReceipt,
   dnd5ePreparedLongCastingBinding(prepared),input.currentCombatState))return {
    result:{ok:false,state:prepared.state,events:[],reason:'casting-incomplete'},
    transaction:rollbackCombatTransaction(prepared.transaction,'casting-incomplete',input.now??Date.now()),
  }
  if (!dnd5ePreparedSpellCastingProximityValid(prepared,
    input.currentRoom?.maps.find(map => map.id === prepared.map.id))) return {
      result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
      transaction: rollbackCombatTransaction(prepared.transaction, 'invalid-target', input.now ?? Date.now()),
    }
  if (prepared.roomMaps && prepared.activity?.outcomes.some(outcome => outcome.operations.some(operation =>
    operation.kind === 'establish-spell-authority' && operation.recordKind === 'benefit-history' && operation.benefitRenewal))) {
    const histories = prepared.targets.flatMap(target => Object.values(
      prepared.state.combatants[target.token.id]?.classState.spellAuthorityRecords ?? {},
    ).filter(record => record.kind === 'benefit-history' && record.renewal))
    {
      const currentMap = input.currentRoom?.maps.find(map => map.id === prepared.map.id)
      const peers = input.currentRoom ? projectDnd5eRoomBenefitDeathPeers(input.currentRoom) : []
      const historyChanged = prepared.targets.some(target => {
        const characterId = prepared.characterIdByCombatantId[target.token.id]
        const latest = characterId
          ? input.currentRoom?.characters.find(character => character.id === characterId)?.dnd5eCombatState
          : currentMap?.tokens.find(token => token.id === target.token.id)?.dnd5eCombatState
        const relevant = (records: Record<string, import('./spellAuthorityState').Dnd5eSpellAuthorityRecordV1> | undefined) =>
          Object.values(records ?? {}).filter(record => record.kind === 'benefit-history' &&
            record.sourcePackageId === prepared.spell.ownerPluginId).sort((a, b) => a.id.localeCompare(b.id))
        return JSON.stringify(relevant(latest?.spellAuthorityRecords)) !== JSON.stringify(relevant(
          prepared.state.combatants[target.token.id]?.classState.spellAuthorityRecords))
      })
      const changed = !currentMap || historyChanged || histories.some(record => {
        if (record.kind !== 'benefit-history' || !record.renewal) return false
        const characterId = prepared.characterIdByCombatantId[record.subjectActorId]
        const latest = characterId
          ? input.currentRoom?.characters.find(character => character.id === characterId)?.dnd5eCombatState?.spellAuthorityRecords?.[record.id]
          : currentMap.tokens.find(token => token.id === record.subjectActorId)?.dnd5eCombatState?.spellAuthorityRecords?.[record.id]
        if (JSON.stringify(latest) !== JSON.stringify(record)) return true
        return record.renewal.recipients.some(member => {
          const deaths = (values: readonly import('./benefitHistoryRenewal').Dnd5eBenefitDeathPeer[]) => values.filter(peer => dnd5eBenefitDeathPeerMatches(member, peer)).map(peer => peer.dead).sort()
          return JSON.stringify(deaths(peers)) !== JSON.stringify(deaths(prepared.state.benefitHistoryDeathPeers ?? []))
        })
      })
      if (changed) return {
        result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
        transaction: rollbackCombatTransaction(prepared.transaction, 'invalid-target', input.now ?? Date.now()),
      }
    }
  }
  if (prepared.castingTime === 'long') {
    // Settle from current HP, effects and resources after all asynchronous
    // concentration saves. Never overwrite damage with preparation-time HP.
    const snapshot = freshLongCastingSnapshot(prepared, input.currentRoom)
    if (!snapshot) return {
      result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
      transaction: rollbackCombatTransaction(prepared.transaction, 'invalid-target', input.now ?? Date.now()),
    }
    const map = input.currentRoom!.maps.find(map => map.id === prepared.map.id)!
    const actor = input.currentRoom!.characters.find(character => character.id === prepared.actor.id)!
    endDnd5eConcentration(snapshot.state, snapshot.state.combatants[prepared.actorToken.id], [])
    prepareDnd5eExplorationActor(snapshot.state, prepared.actorToken.id)
    snapshot.state.initiativeIndex = snapshot.state.initiativeOrder.indexOf(prepared.actorToken.id)
    const caster = snapshot.state.combatants[prepared.actorToken.id]
    if(prepared.action.combatId&&input.currentCombatState){
      snapshot.state.combatId=input.currentCombatState.combatId
      snapshot.state.active=input.currentCombatState.active
      snapshot.state.round=input.currentCombatState.round
      caster.turn={...input.currentCombatState.combatants[prepared.actorToken.id].turn}
    }
    if (!prepared.action.combatId) {
      caster.turn = { ...caster.turn, actionAvailable: true, bonusActionAvailable: true, reactionAvailable: true }
      caster.classState.bonusActionSpellTurnKey = undefined
      caster.classState.leveledSpellTurnKey = undefined
    }
    prepared = { ...prepared, state: snapshot.state, map, actor, characters: input.currentRoom!.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId }
  }
  if (prepared.activity && prepared.activityHeadlessAction) {
    const now = input.now ?? Date.now()
    const activityAction: Dnd5ePluginAction = {
      ...prepared.activityHeadlessAction,
      ...(prepared.castingTime==='long'&&prepared.action.combatId?{payload:{
        ...(prepared.activityHeadlessAction.payload&&typeof prepared.activityHeadlessAction.payload==='object'&&!Array.isArray(prepared.activityHeadlessAction.payload)
          ?prepared.activityHeadlessAction.payload:{}),activityCompletionDelayRounds:0,
      }}:{}),
      rolls: supplied.activityRolls,
      activityTeleportInterruptions: supplied.activityTeleportInterruptions,
      ...(supplied.activityRetainedSaveDice ? { payload: {
        ...(prepared.activityHeadlessAction.payload && typeof prepared.activityHeadlessAction.payload === 'object' && !Array.isArray(prepared.activityHeadlessAction.payload)
          ? prepared.activityHeadlessAction.payload : {}),
        ...(prepared.castingTime === 'long' && prepared.action.combatId ? { activityCompletionDelayRounds: 0 } : {}),
        activityRetainedSaveDice: supplied.activityRetainedSaveDice,
      } } : {}),
      interruptChoiceId: supplied.activityInterruptChoiceId,
    }
    const activityResolution = resolveDnd5eActionWithAirborneFallPreview(
      prepared.state,
      {
        type: 'plugin-spell-activity',
        sourceSlotSpellHealingTargets: supplied.sourceSlotSpellHealingTargets,
        sourceActionInterruptionReaction: supplied.sourceActionInterruptionReaction,
        spellcastingSavingThrows: supplied.spellcastingSavingThrows,
        effectRollDice: supplied.effectRollDice,
        actorId: prepared.actorToken.id,
        pluginAction: activityAction,
        attackDecoyRolls: input.attackDecoyRolls,
        spell: {
          castingClassId: prepared.castingClassId,
          racialInnate: prepared.racialInnate,
          alternateResourceSpell: prepared.alternateResourceSpell,
          spellId: prepared.spell.id,
          spellName: prepared.spell.name,
          spellLevel: prepared.spell.level,
          slotLevel: prepared.slotLevel,
          castingTime: prepared.castingTime,
          ritual: prepared.ritual || undefined,
          declaredTargetIds: [...new Set(prepared.targets.map((target) => target.token.id))],
          concentrationRounds: prepared.concentrationRounds,
          concentrationTargetIds: prepared.concentrationRounds
            ? prepared.targets.length > 0
              ? [...new Set(prepared.targets.map((target) => target.token.id))]
              : [prepared.actorToken.id]
            : undefined,
          spellSchool: prepared.spell.school,
          sculptedTargetIds: prepared.sculptedTargetIds,
        },
      },
      input.airborneFallDamageRollsByCombatantId,
      { transaction: prepared.transaction, now },
      pluginTempestuousObserverFor(input)?{observeActualPluginTempestuousCast:pluginTempestuousObserverFor(input)}:undefined,
    )
    let { result } = activityResolution
    const { airborneFalls } = activityResolution
    // Validate the resolved summon proposals against the fresh complete room
    // before exposing an application that spends HP, slots, or materials.
    const uniqueSummons = result.ok ? result.activityHandoffs?.summons.filter(summon => summon.existingBondPolicy === 'reject-living') ?? [] : []
    if (uniqueSummons.length && (!input.currentRoom || uniqueSummons.some(summon =>
      !summon.bondKey || dnd5eHasLivingSummonBond({ maps: input.currentRoom!.maps,
        characters: input.currentRoom!.characters, mapId: prepared.map.id, actor: prepared.actorToken,
        packageId: prepared.spell.ownerPluginId, bondKey: summon.bondKey })))) return {
      result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
      transaction: rollbackCombatTransaction(prepared.transaction, 'invalid-target', now),
    }
    if (
      result.ok && prepared.upcastDurationRounds > 0 &&
      result.activityHandoffs && result.activityHandoffs.persistentAreas.length > 0
    ) {
      result = {
        ...result,
        activityHandoffs: {
          ...result.activityHandoffs,
          persistentAreas: result.activityHandoffs.persistentAreas.map((area) => ({
            ...area,
            durationRounds: Math.min(14_400, area.durationRounds + prepared.upcastDurationRounds),
          })),
        },
      }
    }
    const materialSettlement = result.ok
      ? settlePluginSpellMaterials(prepared, result.state)
      : undefined
    if (materialSettlement && !materialSettlement.ok) {
      return {
        result: { ok: false, state: prepared.state, events: [], reason: 'item-resource-unavailable' },
        transaction: rollbackCombatTransaction(prepared.transaction, 'item-resource-unavailable', now),
        airborneFalls,
      }
    }
    const transaction = result.transaction ?? (result.ok
      ? commitCombatTransaction(prepared.transaction, now)
      : rollbackCombatTransaction(prepared.transaction, result.reason, now))
    if (!result.ok) return { result, transaction, airborneFalls }
    const inventoryPayload = activityAction.payload && typeof activityAction.payload === 'object' && !Array.isArray(activityAction.payload) ? activityAction.payload : undefined
    const alteredInventory = settleDnd5eActivityPhysicalAlterations({
      map: prepared.map, now, groundSelections: inventoryPayload?.activityGroundInventorySelections,
      characters: materialSettlement?.characters ?? prepared.characters, baselineCharacters: prepared.characters,
      state: result.state, actorId: prepared.actorToken.id, characterId: prepared.actor.id,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
      proposals: result.activityHandoffs?.inventoryAlterations ?? [],
      reachableOwnerIdsByRange: dnd5eActivityReachableInventoryOwners(prepared.map, prepared.actorToken.id,
        (result.activityHandoffs?.inventoryAlterations ?? []).flatMap(proposal => proposal.selectionRangeFeet == null ? [] : [proposal.selectionRangeFeet])),
      selection: { instanceId: inventoryPayload?.activityInventoryInstanceId,
        items: inventoryPayload?.activityInventorySelections,
        ownerId: inventoryPayload?.activityInventoryCharacterId,
        expectedRevision: inventoryPayload?.expectedActivityInventoryRevision },
    })
    if (!alteredInventory.ok) return {
      result: { ok: false, state: prepared.state, events: [], reason: 'item-resource-unavailable' },
      transaction: rollbackCombatTransaction(prepared.transaction, 'item-resource-unavailable', now), airborneFalls,
    }
    const damageByTargetId = dnd5ePluginSpellDamageByTargetId(result.events)
    const targetResolutions = prepared.targets.map((target) => {
      // A creature-form operation replaces the target's HP pool without
      // dealing damage. Deriving damage from the before/after HP delta made a
      // successful Polymorph from 203 HP to 136 form HP appear as 67 damage in
      // the live combat log. Damage events are the authoritative receipt.
      const finalDamage = damageByTargetId.get(target.token.id) ?? 0
      return {
        key: target.key,
        targetTokenId: target.token.id,
        critical: false,
        rawDamage: finalDamage,
        finalDamage,
      }
    })
    const finalDamage = targetResolutions.reduce((total, target) => total + target.finalDamage, 0)
    return {
      result,
      application: planDnd5eMapResultApplication({
        state: result.state,
        map: alteredInventory.map,
        characters: alteredInventory.characters,
        baselineCharacters: prepared.characters,
        characterIdByCombatantId: prepared.characterIdByCombatantId,
        events: [...result.events],
      }),
      transaction,
      critical: false,
      rawDamage: finalDamage,
      finalDamage,
      targetResolutions,
      airborneFalls,
    }
  }
  const mechanics = prepared.spell.mechanics!
  const now = input.now ?? Date.now()
  let transaction = prepared.transaction
  const castingAllowed = previewDnd5eSpellcastingSaves(prepared.state, prepared.actorToken.id, supplied.spellcastingSavingThrows, { spellId: prepared.spell.id, slotLevel: prepared.slotLevel })
  if (castingAllowed == null) return invalidDice(prepared, transaction, now)
  const interruptionPreview = previewDnd5eSourceActionInterruption(prepared.state, prepared.actorToken.id, 'spell-cast', supplied.sourceActionInterruptionReaction)
  if (interruptionPreview == null || (!castingAllowed && supplied.sourceActionInterruptionReaction)) return invalidDice(prepared, transaction, now)
  const castingPrevented = castingAllowed === false || interruptionPreview
  const sourceCombatant = prepared.state.combatants[prepared.actorToken.id]
  const rerollAudits:Array<Extract<import('./headlessCombatEngine').Dnd5eCombatEvent,{type:'spell-damage-dice-rerolled'}>>=[]
  const consumedRerollGroups=new Set<string>()
  const rerollDamageGroup=(id:string,values:readonly number[])=>{
    const uses=supplied.spellDamageDieRerolls?.filter(use=>use.rollId===id)??[]
    if(!uses.length)return values
    if(prepared.overchannel||!mechanics.damage)throw Error('invalid spell damage reroll')
    const group={id,sides:prepared.damageDice.sides,damageType:mechanics.damage.type,rolls:values}
    const next=applyDnd5eSpellDamageDieRerolls(sourceCombatant,[group],uses).get(id)!
    consumedRerollGroups.add(id)
    rerollAudits.push({type:'spell-damage-dice-rerolled',actorId:sourceCombatant.id,spellId:prepared.spell.id,rollId:id,originalValues:[...values],values:[...next],selections:structuredClone(uses)})
    return next
  }
  const sharedAreaDamage = !castingPrevented && !!prepared.area && mechanics.resolution !== 'spell-attack'
  const suppliedOverchannelSelfDamageRolls = castingPrevented ? [] : supplied.overchannelSelfDamageRolls ?? []
  if (
    suppliedOverchannelSelfDamageRolls.length !== (castingPrevented ? 0 : prepared.overchannelSelfDamageDiceCount) ||
    suppliedOverchannelSelfDamageRolls.some((value) => !validDie(value, 12))
  ) return invalidDice(prepared, transaction, now)
  let sharedDamageValues = prepared.overchannel && sharedAreaDamage && mechanics.damage
    ? Array.from({ length: prepared.damageDice.count }, () => prepared.damageDice.sides)
    : supplied.damageRolls ?? []
  if (!castingPrevented && prepared.overchannel && (supplied.damageRolls?.length ?? 0) > 0) {
    return invalidDice(prepared, transaction, now)
  }
  if (sharedAreaDamage && mechanics.damage && (
    sharedDamageValues.length !== prepared.damageDice.count ||
    sharedDamageValues.some((value) => !validDie(value, prepared.damageDice.sides))
  )) return invalidDice(prepared, transaction, now)
  if(sharedAreaDamage){try{sharedDamageValues=[...rerollDamageGroup('plugin-shared',sharedDamageValues)]}catch{return invalidDice(prepared,transaction,now)}}
  if (sharedAreaDamage && mechanics.damage) {
    transaction = appendRollLedgerEntry(transaction, {
      id: `${prepared.action.id}:damage:shared`, kind: 'damage', label: `${prepared.spell.name}·范围伤害`,
      dice: { sides: prepared.damageDice.sides, values: sharedDamageValues }, modifier: prepared.damageDice.bonus, visibility: 'public',
      sourceId: prepared.actor.id, targetId: prepared.targetToken.id, createdAt: now,
    })
  }

  const effects: import('./headlessCombatEngine').Dnd5eAdjudicatedSpellEffect[] = []
  const targetResolutions: Dnd5ePluginSpellTargetResolution[] = []
  for (let index = 0; !castingPrevented && index < prepared.targets.length; index += 1) {
    const target = prepared.targets[index]
    const targetSupplied = supplied.targetRolls?.[index] ?? (index === 0 ? supplied : {})
    const targetCombatant = prepared.state.combatants[target.token.id]
    let attackHit: boolean | undefined
    let critical = false
    let saveSucceeded: boolean | undefined
    if (mechanics.resolution === 'spell-attack') {
      if (!validD20Pair(targetSupplied.attackD20, targetSupplied.attackD20Second, target.attackMode)) return invalidDice(prepared, transaction, now)
      const attackD20 = selectedD20(targetSupplied.attackD20!, targetSupplied.attackD20Second, target.attackMode)
      transaction = appendRollLedgerEntry(transaction, {
        id: `${prepared.action.id}:spell-attack:${index}`, kind: 'attack', label: `${prepared.spell.name}·法术攻击`,
        dice: { sides: 20, values: target.attackMode === 'normal' ? [targetSupplied.attackD20!] : [targetSupplied.attackD20!, targetSupplied.attackD20Second!] }, modifier: prepared.attackModifier, visibility: 'public',
        sourceId: prepared.actor.id, targetId: target.token.id, createdAt: now,
      })
      critical = attackD20 === 20
      attackHit = critical || (attackD20 !== 1 && attackD20 + prepared.attackModifier >= target.armorClass)
    } else if (mechanics.resolution === 'saving-throw') {
      if (!target.saveMode || !validD20Pair(targetSupplied.savingThrowD20, targetSupplied.savingThrowD20Second, target.saveMode) || target.saveModifier == null) {
        return invalidDice(prepared, transaction, now)
      }
      const savingThrowD20 = selectedD20(targetSupplied.savingThrowD20!, targetSupplied.savingThrowD20Second, target.saveMode)
      transaction = appendRollLedgerEntry(transaction, {
        id: `${prepared.action.id}:saving-throw:${index}`, kind: 'saving-throw', label: `${prepared.spell.name}·豁免`,
        dice: { sides: 20, values: target.saveMode === 'normal' ? [targetSupplied.savingThrowD20!] : [targetSupplied.savingThrowD20!, targetSupplied.savingThrowD20Second!] }, modifier: target.saveModifier, visibility: 'public',
        sourceId: target.token.id, targetId: prepared.actor.id, createdAt: now,
      })
      saveSucceeded = !target.saveAutomaticallyFails && savingThrowD20 + target.saveModifier >= prepared.saveDc
    }

    let rawDamage = 0
    let finalDamage = 0
    const shouldDealDamage = !!mechanics.damage && (mechanics.resolution !== 'spell-attack' || attackHit)
    if (shouldDealDamage) {
      const count = prepared.damageDice.count * (critical ? 2 : 1)
      let values = sharedAreaDamage
        ? sharedDamageValues
        : prepared.overchannel
          ? Array.from({ length: count }, () => prepared.damageDice.sides)
          : targetSupplied.damageRolls ?? []
      if (prepared.overchannel && !sharedAreaDamage && (targetSupplied.damageRolls?.length ?? 0) > 0) {
        return invalidDice(prepared, transaction, now)
      }
      if (values.length !== count || values.some((value) => !validDie(value, prepared.damageDice.sides))) {
        return invalidDice(prepared, transaction, now)
      }
      if(!sharedAreaDamage){try{values=[...rerollDamageGroup('plugin-target:'+index+':'+target.token.id,values)]}catch{return invalidDice(prepared,transaction,now)}}
      if (!sharedAreaDamage) {
        transaction = appendRollLedgerEntry(transaction, {
          id: `${prepared.action.id}:damage:${index}`, kind: 'damage', label: `${prepared.spell.name}·伤害`,
          dice: { sides: prepared.damageDice.sides, values }, modifier: prepared.damageDice.bonus, visibility: 'public',
          sourceId: prepared.actor.id, targetId: target.token.id, createdAt: now,
        })
      }
      rawDamage = Math.max(0, values.reduce((total, value) => total + value, prepared.damageDice.bonus))
      if (saveSucceeded) {
        const onSuccess = mechanics.savingThrow?.onSuccess ?? 'none'
        rawDamage = onSuccess === 'half' ? Math.floor(rawDamage / 2) : onSuccess === 'full' ? rawDamage : 0
      }
      finalDamage = resolveDnd5eDamageDefenses({
        damage: rawDamage,
        source: {
          damageType: mechanics.damage!.type,
          delivery: 'spell', magical: true, spellLevel: prepared.slotLevel,
          sourceMoralAlignment: sourceCombatant.moralAlignment,
        },
        defenses: {
          immunities: targetCombatant.damageImmunities,
          resistances: targetCombatant.damageResistances,
          vulnerabilities: targetCombatant.damageVulnerabilities,
          damageDefenseRules: targetCombatant.damageDefenseRules,
        },
      }).finalDamage
      const targetWilling = sourceCombatant.controller === targetCombatant.controller
      if (dnd5eLimitedMagicImmunityNegatesSpell({
        rule: targetCombatant.limitedMagicImmunity,
        spellLevel: prepared.slotLevel,
        target: targetWilling ? 'ally' : 'hostile',
        willing: targetWilling,
      })) finalDamage = 0
    }

    if (mechanics.damage && (shouldDealDamage || mechanics.resolution === 'saving-throw')) {
      effects.push({ targetId: target.token.id, operation: 'damage', amount: finalDamage })
    }
    for (const condition of mechanics.conditions ?? []) {
      const applies = condition.trigger === 'always' ||
        (condition.trigger === 'on-hit' && attackHit === true) ||
        (condition.trigger === 'on-failed-save' && saveSucceeded === false)
      if (applies) effects.push({
        targetId: target.token.id,
        addCondition: condition.condition,
        ...dnd5ePluginSpellConditionLifecycle(condition.duration, prepared.saveDc, prepared.upcastDurationRounds),
      })
    }
    targetResolutions.push({
      key: target.key,
      targetTokenId: target.token.id,
      attackHit,
      critical,
      saveSucceeded,
      rawDamage,
      finalDamage,
    })
  }

  if(supplied.spellDamageDieRerolls?.some(use=>!consumedRerollGroups.has(use.rollId)))return invalidDice(prepared,transaction,now)
  const { result: initialResult, airborneFalls } = resolveDnd5eActionWithAirborneFallPreview(prepared.state, {
    type: 'adjudicated-spell',
    sourceActionInterruptionReaction: supplied.sourceActionInterruptionReaction,
    spellcastingSavingThrows: supplied.spellcastingSavingThrows,
    actorId: prepared.actorToken.id,
    castingClassId: prepared.castingClassId,
          racialInnate: prepared.racialInnate,
          alternateResourceSpell: prepared.alternateResourceSpell,
    spellId: prepared.spell.id,
    spellName: prepared.spell.name,
    spellLevel: prepared.spell.level,
    slotLevel: prepared.slotLevel,
    castingTime: prepared.castingTime,
    effects,
    concentrationRounds: prepared.concentrationRounds,
    spellSchool: prepared.spell.school,
    sculptedTargetIds: prepared.sculptedTargetIds,
    overchannel: castingPrevented ? false : prepared.overchannel,
    overchannelSelfDamageRolls: suppliedOverchannelSelfDamageRolls,
  }, input.airborneFallDamageRollsByCombatantId, { transaction, now })
  let result=initialResult
  if(result.ok&&rerollAudits.length)result={...result,events:[...result.events,...rerollAudits]}
  transaction = result.transaction ?? (result.ok
    ? commitCombatTransaction(transaction, now)
    : rollbackCombatTransaction(transaction, result.reason, now))
  const first = targetResolutions[0]
  const rawDamage = targetResolutions.reduce((total, resolution) => total + resolution.rawDamage, 0)
  const finalDamage = targetResolutions.reduce((total, resolution) => total + resolution.finalDamage, 0)
  if (!result.ok) return {
    result, transaction,
    attackHit: first?.attackHit, critical: first?.critical ?? false,
    saveSucceeded: first?.saveSucceeded, rawDamage, finalDamage, targetResolutions, airborneFalls,
  }
  const materialSettlement = settlePluginSpellMaterials(prepared, result.state)
  if (!materialSettlement.ok) {
    return {
      result: { ok: false, state: prepared.state, events: [], reason: 'item-resource-unavailable' },
      transaction: rollbackCombatTransaction(prepared.transaction, 'item-resource-unavailable', now),
      attackHit: first?.attackHit,
      critical: first?.critical ?? false,
      saveSucceeded: first?.saveSucceeded,
      rawDamage,
      finalDamage,
      targetResolutions,
      airborneFalls,
    }
  }
  return {
    result,
    application: planDnd5eMapResultApplication({ state: result.state, map: prepared.map, characters: materialSettlement.characters, baselineCharacters: prepared.characters, characterIdByCombatantId: prepared.characterIdByCombatantId, events: [...result.events] }),
    transaction,
    attackHit: first?.attackHit,
    critical: first?.critical ?? false,
    saveSucceeded: first?.saveSucceeded,
    rawDamage,
    finalDamage,
    targetResolutions,
    airborneFalls,
  }
}

function dnd5ePluginSpellConditionLifecycle(
  duration: Dnd5eSpellConditionDuration,
  saveDc: number,
  upcastDurationRounds = 0,
): Pick<import('./headlessCombatEngine').Dnd5eAdjudicatedSpellEffect, 'conditionDuration' | 'conditionRepeatSave'> {
  if (duration.kind === 'source-next-turn-start') {
    return { conditionDuration: { type: 'until-turn-boundary', boundary: 'source-turn-start' } }
  }
  if (duration.kind === 'target-next-turn-start') {
    return { conditionDuration: { type: 'until-turn-boundary', boundary: 'target-turn-start' } }
  }
  if (duration.kind === 'fixed-rounds') {
    return { conditionDuration: { type: 'rounds', remainingRounds: duration.rounds + upcastDurationRounds, tickOn: 'target-turn-end' } }
  }
  if (duration.kind === 'save-ends') {
    return {
      conditionDuration: { type: 'rounds', remainingRounds: duration.maximumRounds + upcastDurationRounds, tickOn: 'target-turn-end' },
      conditionRepeatSave: {
        ability: duration.saveAbility,
        dc: saveDc,
        timing: duration.timing,
        onSuccess: 'remove',
      },
    }
  }
  return {}
}

export function dnd5ePluginSpellComponentCheck(
  actor: Character,
  spell: RegisteredDnd5ePluginSpell,
  classId?: Dnd5eClassId,
  context?: { targetHitDiceCount?: number; imprisonmentMode?: string; activityChoices?: Readonly<Record<string, string>> },
): Dnd5ePluginSpellComponentCheck {
  const localSpellId = spell.id.startsWith(`${spell.ownerPluginId}:`)
    ? spell.id.slice(spell.ownerPluginId.length + 1)
    : spell.id
  const conditional = spell.components.materialRequirementByChoice
  const selected = conditional?.options.find(option => option.optionId === context?.activityChoices?.[conditional.choiceId])
  if (conditional && !selected) return { verbal: 'not-required', somatic: 'not-required', material: 'missing-specific-material' }
  return dnd5eSpellComponentCheck(actor, {
    verbal: spell.components.verbal,
    somatic: spell.components.somatic,
    material: spell.components.material,
    costlyMaterial: (spell.components.materialCostGp ?? 0) > 0,
    consumedMaterial: spell.components.materialConsumed === true,
    specificMaterial: selected?.requirement ?? spell.components.materialRequirement ?? (
      spell.ownerPluginId === DND5E_SRD_AUDITED_SPELL_PACKAGE_ID
        ? dnd5eCoreSpellMaterialRequirement(localSpellId, context)
        : undefined
    ),
  }, classId)
}

/**
 * A manual operation may live behind a check-dependent outcome.  The map UI
 * must ask the DM only when a dry Host resolution reaches that boundary; the
 * mere presence of manual prose elsewhere in the Activity is not sufficient.
 */
export function dnd5ePluginSpellActivityResolutionRequiresDmAdjudication(
  resolution: Pick<Dnd5ePluginSpellResolution, 'result'>,
): boolean {
  return !resolution.result.ok && resolution.result.reason === 'dm-adjudication-pending'
}

function dnd5eTokenHitDiceCount(
  token: Token,
  characters: readonly Character[],
): number | undefined {
  const characterHitDice = token.characterId
    ? characters.find((character) => character.id === token.characterId)?.hitDice
    : undefined
  const monsterHitDice = token.poolId ? getEnemyStatBlock(token.poolId)?.hitDice : undefined
  const match = (characterHitDice ?? monsterHitDice)?.trim().match(/^(\d*)\s*d\d+/i)
  if (!match) return undefined
  const count = match[1] ? Number(match[1]) : 1
  return Number.isInteger(count) && count > 0 ? count : undefined
}

function invalidDice(prepared: PreparedDnd5ePluginSpellCast, transaction: CombatTransaction, now: number): Dnd5ePluginSpellResolution {
  return {
    result: { ok: false, state: prepared.state, events: [], reason: 'invalid-dice' },
    transaction: rollbackCombatTransaction(transaction, 'invalid-dice', now),
  }
}

function validDie(value: number | undefined, sides: number): boolean {
  return Number.isInteger(value) && value! >= 1 && value! <= sides
}

function validD20Pair(first: number | undefined, second: number | undefined, mode: D20RollMode): boolean {
  return validDie(first, 20) && (mode === 'normal' || validDie(second, 20))
}

function selectedD20(first: number, second: number | undefined, mode: D20RollMode): number {
  if (mode === 'normal' || second == null) return first
  return mode === 'advantage' ? Math.max(first, second) : Math.min(first, second)
}

function spellDurationRounds(spell: RegisteredDnd5ePluginSpell): number {
  if (spell.duration.type !== 'timed') return 10
  const value = Math.max(1, Math.floor(spell.duration.value ?? 1))
  const multiplier = spell.duration.unit === 'round' ? 1 : spell.duration.unit === 'minute' ? 10 : spell.duration.unit === 'hour' ? 600 : 14_400
  return Math.min(14_400, value * multiplier)
}

function settlePluginSpellMaterials(prepared: PreparedDnd5ePluginSpellCast, state: Dnd5eHeadlessCombatState):
  { ok: true; characters: readonly Character[] } | { ok: false } {
  const plan = prepared.spellMaterialPlan
  if (plan?.consumptionTiming !== 'spell-end') {
    const settlement = settleDnd5eSpellMaterialConsumption(prepared.characters, prepared.actor.id, plan)
    if (!settlement.ok || !plan?.allocations.some(allocation => allocation.bindEffectId)) return settlement
    const combatant = state.combatants[prepared.actorToken.id]
    if (!combatant) return { ok: false }
    const effects = bindDnd5eSpellMaterialEffects(plan,
      prepared.state.combatants[prepared.actorToken.id]?.classState.activeEffects ?? [],
      combatant.classState.activeEffects ?? [],
      [...prepared.characters.flatMap(character => character.dnd5eCombatState?.activeEffects ?? []),
        ...Object.values(prepared.state.combatants).flatMap(entry => entry.classState.activeEffects ?? [])], prepared.spell.id)
    if (!effects) return { ok: false }
    combatant.classState.activeEffects = effects
    return settlement
  }
  const owner = prepared.characters.find(character => character.id === prepared.actor.id)
  const combatant = state.combatants[prepared.actorToken.id]
  if (!owner || !combatant) return { ok: false }
  const binding = dnd5eSpellMaterialEscrowBinding(prepared.action.id, prepared.spell.id)
  const effectId = binding.sourceEffectId
  const reserved = reserveDnd5eSpellMaterials(owner, plan, binding)
  if (!reserved.ok) return { ok: false }
  const record = reserved.character.dnd5eInventory?.spellMaterialEscrows?.find(entry => entry.id === prepared.action.id)
  if (record?.status === 'reserved' && !combatant.classState.activeEffects?.some(effect => effect.id === effectId) &&
    (!prepared.spell.duration.concentration || combatant.classState.concentrationSpellId === prepared.spell.id)) {
    const multiplier = prepared.spell.duration.unit === 'round' ? 1 : prepared.spell.duration.unit === 'minute' ? 10 : prepared.spell.duration.unit === 'hour' ? 600 : 14_400
    const rounds = Math.max(1, Math.floor(prepared.spell.duration.value! * multiplier)) + prepared.upcastDurationRounds
    const effect = createDnd5eMechanicalEffect({ id: effectId, definitionId: `spell-material:${prepared.spell.id}`, label: plan.requirementLabel,
      targetId: combatant.id, source: { kind: 'spell', actorId: combatant.id, rulesId: prepared.spell.id, magical: true },
      duration: prepared.spell.duration.concentration
        ? { type: 'concentration', sourceActorId: combatant.id, concentrationId: prepared.spell.id, remainingRounds: rounds }
        : { type: 'rounds', remainingRounds: rounds, tickOn: 'source-turn-end' },
    })
    combatant.classState.activeEffects = [...(combatant.classState.activeEffects ?? []), effect]
  }
  return { ok: true, characters: prepared.characters.map(character => character.id === owner.id ? reserved.character : character) }
}

/** Keep the public factory signature; only its actual successful result acquires local preparation provenance. */
function pluginTempestuousExactSignature(value:unknown){try{return JSON.stringify(encodeSecondChanceParentWire(value))}catch{return undefined}}
const actualPluginTempestuousPreparations=new WeakMap<object,{registry:number;preparedSignature:string;input:Parameters<typeof prepareDnd5ePluginSpellCastInternal>[0];inputSignature:string;selector?:Function;selectorPresent:boolean}>()
export const prepareDnd5ePluginSpellCast:typeof prepareDnd5ePluginSpellCastInternal=wrapDnd5eMagicTruthPreparedFactory(input=>{const result=prepareDnd5ePluginSpellCastInternal(input);if(result.ok){const facts=pluginTempestuousPreparationData(input);if(facts){const preparedSignature=pluginTempestuousExactSignature(result.prepared),inputSignature=pluginTempestuousExactSignature({keys:Object.keys(facts.data),data:facts.data});if(preparedSignature&&inputSignature)actualPluginTempestuousPreparations.set(result.prepared,{registry:dnd5eRulesPluginRegistrySnapshot(),preparedSignature,input,inputSignature,selector:facts.selector,selectorPresent:facts.selectorPresent})}};return result})
export interface Dnd5ePluginTempestuousNativeOperation{readonly pluginTempestuousNativeOperation:unique symbol}
type PluginTempestuousInput=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
const actualPluginTempestuousOperations=new WeakMap<object,{operation:Dnd5eActualPluginTempestuousPhase;input:PluginTempestuousInput;signature:string;effectTimestamp:number}>()
type PluginTempestuousObserver={input:PluginTempestuousInput;matches?:(input:PluginTempestuousInput)=>boolean;observe:(operation:Dnd5eActualPluginTempestuousPhase)=>Dnd5eActualPluginTempestuousFlightContinuation|void;previous?:PluginTempestuousObserver}
let activePluginTempestuousObserver:PluginTempestuousObserver|undefined
function pluginTempestuousObserverFor(input:PluginTempestuousInput){let found=false;for(let row=activePluginTempestuousObserver;row;row=row.previous)if(row.input===input||row.matches?.(input)){found=true;break}if(!found)return;return(operation:Dnd5eActualPluginTempestuousPhase)=>{let continued:Dnd5eActualPluginTempestuousFlightContinuation|undefined;for(let row=activePluginTempestuousObserver;row;row=row.previous){if(row.input!==input&&!row.matches?.(input))continue;const next=row.observe(operation);if(next!==undefined){if(continued)throw Error('plugin-tempestuous-replay:ambiguous-native-flight');continued=next}}return continued}}
/** Only the existing typed random-target producer callback is kept separately.
 * Its identity is never serialized, executed by recovery, or accepted as permission. */
function pluginTempestuousPreparationData(input:Parameters<typeof prepareDnd5ePluginSpellCastInternal>[0]){const allowed=['worldMinute','action','authorityRound','map','characters','roomMaps','initiativeOrder','turnEconomy','turnEconomyByToken','roomRequiredPlugins','now','effectiveRules'],data:Record<string,unknown>={};let selector:Function|undefined,selectorPresent=false;for(const key of Object.keys(input)){const descriptor=Object.getOwnPropertyDescriptor(input,key);if(!descriptor||descriptor.get||descriptor.set)return;if(key==='chooseRandomTarget'){if(typeof descriptor.value!=='function')return;selector=descriptor.value;selectorPresent=true;continue}if(!allowed.includes(key)||!pluginTempestuousDataOnly(descriptor.value))return;data[key]=descriptor.value}return{data,selector,selectorPresent}}
function actualPluginTempestuousPreparationCurrent(prepared:PreparedDnd5ePluginSpellCast){const row=actualPluginTempestuousPreparations.get(prepared),facts=row&&pluginTempestuousPreparationData(row.input);return!!row&&row.registry===dnd5eRulesPluginRegistrySnapshot()&&!!facts&&facts.selector===row.selector&&facts.selectorPresent===row.selectorPresent&&row.preparedSignature===pluginTempestuousExactSignature(prepared)&&row.inputSignature===pluginTempestuousExactSignature({keys:Object.keys(facts.data),data:facts.data})&&JSON.stringify(dnd5ePluginSpellDefinition(prepared.spell.id))===JSON.stringify(prepared.spell)&&JSON.stringify(dnd5ePluginSpellActivity(dnd5ePluginSpellDefinition(prepared.spell.id)))===JSON.stringify(prepared.activity)}

/** Genuine native pause only; this operation grants no Room/dice/world rights. */
function pluginTempestuousDataOnly(value:unknown,active=new Set<object>()):boolean{if(value===null||value===undefined||typeof value==='string'||typeof value==='boolean')return true;if(typeof value==='number')return Number.isFinite(value);if(typeof value!=='object'||active.has(value))return false;const prototype=Object.getPrototypeOf(value);if(!Array.isArray(value)&&prototype!==Object.prototype&&prototype!==null)return false;active.add(value);for(const key of Object.keys(value)){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||descriptor.get||descriptor.set||!pluginTempestuousDataOnly(descriptor.value,active)){active.delete(value);return false}}active.delete(value);return true}
export function beginDnd5ePluginTempestuousNativePhase(source:PluginTempestuousInput,phase:'before'|'after'){
 if(Object.keys(source).some(key=>!['prepared','currentRoom','currentCombatState','rolls','now','airborneFallDamageRollsByCombatantId','attackDecoyRolls'].includes(key))||Object.keys(source.rolls??{}).some(key=>!['spellDamageDieRerolls','sourceSlotSpellHealingTargets','sourceActionInterruptionReaction','activityTeleportInterruptions','spellcastingSavingThrows','effectRollDice','attackD20','attackD20Second','savingThrowD20','savingThrowD20Second','damageRolls','overchannelSelfDamageRolls','targetRolls','activityRolls','activityRetainedSaveDice','activityInterruptChoiceId'].includes(key))||!pluginTempestuousDataOnly(source))throw Error('plugin-tempestuous-original:closed-data-source-required')
 if(!['before','after'].includes(phase)||!actualPluginTempestuousPreparationCurrent(source.prepared)||source.currentCombatState&&JSON.stringify(source.currentCombatState)!==JSON.stringify(source.prepared.state)||source.currentRoom&&(JSON.stringify(source.currentRoom.characters)!==JSON.stringify(source.prepared.characters)||JSON.stringify(source.currentRoom.maps)!==JSON.stringify(source.prepared.roomMaps??[source.prepared.map])))throw Error('plugin-tempestuous-original:actual-unchanged-preparation-required')
 const input={...source,now:source.now??Date.now()},signature=pluginTempestuousExactSignature(input);if(!signature)throw Error('plugin-tempestuous-original:exact-data-source-required');let pending:Dnd5ePluginTempestuousNativeOperation|undefined;class ActualPluginTempestuousPause extends Error{};const previous=activePluginTempestuousObserver;activePluginTempestuousObserver={input,previous,observe:operation=>{const native=readDnd5eActualPluginTempestuousPhase(operation);if(native.phase!==phase)return;if(native.transaction.id!==input.prepared.action.id||native.transaction.actorId!==input.prepared.actor.id||native.action.actorId!==input.prepared.actorToken.id||native.action.spell.spellId!==input.prepared.spell.id||!actualPluginTempestuousPreparationCurrent(input.prepared)||signature!==pluginTempestuousExactSignature(input))throw Error('plugin-tempestuous-original:same-actual-cast-required');pending=Object.freeze({})as Dnd5ePluginTempestuousNativeOperation;actualPluginTempestuousOperations.set(pending,{operation,input,signature,effectTimestamp:input.now});throw new ActualPluginTempestuousPause()}}
 try{return{status:'resolved'as const,native:createDnd5eParentEffectClock({parentId:input.prepared.action.id,sourceKey:JSON.stringify(input.prepared),timestamp:input.now}).run(()=>resolvePreparedDnd5ePluginSpellCast(input))}}catch(error){if(!(error instanceof ActualPluginTempestuousPause)||!pending)throw error;return{status:'pending-plugin-tempestuous-phase'as const,operation:pending}}finally{activePluginTempestuousObserver=previous}
}
export function readDnd5ePluginTempestuousNativeOperation(cap:Dnd5ePluginTempestuousNativeOperation){const row=actualPluginTempestuousOperations.get(cap);if(!row||row.signature!==pluginTempestuousExactSignature(row.input)||!actualPluginTempestuousPreparationCurrent(row.input.prepared))throw Error('plugin-tempestuous-original:actual-current-operation-required');const native=readDnd5eActualPluginTempestuousPhase(row.operation);return{...native,effectTimestamp:row.effectTimestamp,source:row.input}}
export function disposeDnd5ePluginTempestuousNativeOperation(cap:Dnd5ePluginTempestuousNativeOperation){const row=actualPluginTempestuousOperations.get(cap);if(row)disposeDnd5eActualPluginTempestuousPhase(row.operation);actualPluginTempestuousOperations.delete(cap)}

export interface Dnd5ePluginTempestuousNativeFlight{readonly pluginTempestuousNativeFlight:unique symbol}
const actualPluginTempestuousFlights=new WeakMap<object,{original:Dnd5ePluginTempestuousNativeOperation;result:ReturnType<typeof resolveDnd5eActualPluginTempestuousFlight>;signature:string;intent:TempestuousSpellFlightIntent;rolls?:Parameters<typeof resolveDnd5eActualPluginTempestuousFlight>[2]}>()
/** Native mechanical continuation only. No Room/raw/publication capability. */
export function completeDnd5ePluginTempestuousNativeFlight(operation:Dnd5ePluginTempestuousNativeOperation,intent:TempestuousSpellFlightIntent,rolls?:Parameters<typeof resolveDnd5eActualPluginTempestuousFlight>[2]){
 const facts=readDnd5ePluginTempestuousNativeOperation(operation),row=actualPluginTempestuousOperations.get(operation)!;if(!pluginTempestuousDataOnly(intent)||!pluginTempestuousDataOnly(rolls))throw Error('plugin-tempestuous-flight:closed-data-required')
 const result=createDnd5eParentEffectClock({parentId:facts.transaction.id,sourceKey:JSON.stringify(facts.source.prepared),timestamp:facts.effectTimestamp}).run(()=>withTempestuousCastGeometry({parentId:facts.transaction.id,actorId:facts.action.actorId,map:facts.source.prepared.map},()=>resolveDnd5eActualPluginTempestuousFlight(row.operation,intent,rolls)))
 const cap=Object.freeze({})as Dnd5ePluginTempestuousNativeFlight;actualPluginTempestuousFlights.set(cap,{original:operation,result,signature:JSON.stringify(result),intent:structuredClone(intent),rolls:structuredClone(rolls)});return cap
}
export function readDnd5ePluginTempestuousNativeFlight(cap:Dnd5ePluginTempestuousNativeFlight){const row=actualPluginTempestuousFlights.get(cap);if(!row||row.signature!==JSON.stringify(row.result))throw Error('plugin-tempestuous-flight:actual-current-flight-required');const facts=readDnd5ePluginTempestuousNativeOperation(row.original);return{...facts,intent:structuredClone(row.intent),flight:structuredClone(row.result)}}

export interface Dnd5ePluginTempestuousLandingOperation{readonly pluginTempestuousLandingOperation:unique symbol}
const actualPluginTempestuousLandings=new WeakMap<object,{original:Dnd5ePluginTempestuousNativeOperation;native:Dnd5eActualPluginTempestuousLanding;intent:TempestuousSpellFlightIntent;signature:string;prefixRolls?:Parameters<typeof resolveDnd5eActualPluginTempestuousFlight>[2]}>()
/** Stop at the actual missing landing pool, never a zero/one fake physical die. */
export function tryCompleteDnd5ePluginTempestuousNativeFlight(operation:Dnd5ePluginTempestuousNativeOperation,intent:TempestuousSpellFlightIntent,rolls?:Parameters<typeof resolveDnd5eActualPluginTempestuousFlight>[2]){try{return{status:'resolved'as const,flight:completeDnd5ePluginTempestuousNativeFlight(operation,intent,rolls)}}catch(error){const native=captureDnd5eActualPluginTempestuousLanding(error);if(!native)throw error;const facts=readDnd5ePluginTempestuousNativeOperation(operation),landing=readDnd5eActualPluginTempestuousLanding(native);if(landing.frame.parentId!==facts.transaction.id||landing.frame.actorId!==facts.action.actorId||landing.frame.timing!==facts.phase)throw Error('plugin-tempestuous-landing:same-actual-cast-required');const cap=Object.freeze({})as Dnd5ePluginTempestuousLandingOperation;actualPluginTempestuousLandings.set(cap,{original:operation,native,intent:structuredClone(intent),signature:JSON.stringify(landing),prefixRolls:structuredClone(rolls)});return{status:'pending-plugin-tempestuous-landing'as const,operation:cap}}}
export function readDnd5ePluginTempestuousLandingOperation(cap:Dnd5ePluginTempestuousLandingOperation){const row=actualPluginTempestuousLandings.get(cap);if(!row)throw Error('plugin-tempestuous-landing:actual-issued-operation-required');const facts=readDnd5ePluginTempestuousNativeOperation(row.original),landing=readDnd5eActualPluginTempestuousLanding(row.native);if(JSON.stringify(landing)!==row.signature)throw Error('plugin-tempestuous-landing:unchanged-native-prefix-required');return{...landing,effectTimestamp:facts.effectTimestamp,beforeFlightState:structuredClone(facts.state),source:facts.source,intent:structuredClone(row.intent),movementRollsPrefix:structuredClone(row.prefixRolls)}}

export function completeDnd5ePluginTempestuousNativeLanding(operation:Dnd5ePluginTempestuousLandingOperation,values:readonly number[]){const facts=readDnd5ePluginTempestuousLandingOperation(operation),row=actualPluginTempestuousLandings.get(operation)!;const result=createDnd5eParentEffectClock({parentId:facts.frame.parentId,sourceKey:JSON.stringify(facts.source.prepared),timestamp:facts.effectTimestamp}).run(()=>withTempestuousCastGeometry({parentId:facts.frame.parentId,actorId:facts.frame.actorId,map:facts.source.prepared.map},()=>resolveDnd5eActualPluginTempestuousLanding(row.native,values)));actualPluginTempestuousLandings.delete(operation);const cap=Object.freeze({})as Dnd5ePluginTempestuousNativeFlight;actualPluginTempestuousFlights.set(cap,{original:row.original,result,signature:JSON.stringify(result),intent:structuredClone(row.intent),rolls:{...structuredClone(row.prefixRolls),fallingDamageRolls:[...values]}});return cap}

export interface Dnd5ePluginTempestuousFlightAnswer{operation:Dnd5ePluginTempestuousNativeOperation;choice?:TempestuousSpellFlightIntent;rolls?:Parameters<typeof resolveDnd5eActualPluginTempestuousFlight>[2]}
type PluginTempestuousFlightAnswers={before?:Dnd5ePluginTempestuousFlightAnswer;after?:Dnd5ePluginTempestuousFlightAnswer}
let activePluginTempestuousReplay:{sourceSignature:string;answerSignature:string;observer:PluginTempestuousObserver;visits:Record<'before'|'after',number>}|undefined
/** Mechanical scope only, from actual own native phases. Its Room consumer must
 * independently authenticate the private owner/raw books and final original.
 * Neither source JSON nor a matching callback result is registered as authority. */
export function withDnd5ePluginTempestuousActualFlights<T>(source:PluginTempestuousInput,answers:PluginTempestuousFlightAnswers,runNative:()=>T):T{
 if(!answers||!pluginTempestuousDataOnly(answers)||Object.keys(answers).some(k=>!['before','after'].includes(k))||!answers.before&&!answers.after||runNative.constructor.name==='AsyncFunction')throw Error('plugin-tempestuous-replay:exact-native-phases-required')
 const sourceSignature=pluginTempestuousExactSignature(source);if(!sourceSignature)throw Error('plugin-tempestuous-replay:exact-data-source-required')
 const expected=new Map<'before'|'after',{answer:Dnd5ePluginTempestuousFlightAnswer;facts:ReturnType<typeof readDnd5ePluginTempestuousNativeOperation>}>()
 for(const phase of['before','after']as const){const answer=answers[phase];if(!answer)continue;if(Object.keys(answer).some(k=>!['operation','choice','rolls'].includes(k))||!answer.choice&&answer.rolls!==undefined||!pluginTempestuousDataOnly(answer.choice)||!pluginTempestuousDataOnly(answer.rolls))throw Error('plugin-tempestuous-replay:closed-native-answer-required');const facts=readDnd5ePluginTempestuousNativeOperation(answer.operation);if(facts.phase!==phase||pluginTempestuousExactSignature(facts.source)!==sourceSignature||source.now!==facts.effectTimestamp||answer.choice&&answer.choice.timing!==phase)throw Error('plugin-tempestuous-replay:same-actual-original-required');expected.set(phase,{answer,facts})}
 const answerSignature=JSON.stringify([...expected].map(([phase,row])=>[phase,row.facts.state,row.facts.action,row.facts.events,row.facts.transaction,row.facts.effectTimestamp,row.answer.choice,row.answer.rolls])),previousReplay=activePluginTempestuousReplay,previousObserver=activePluginTempestuousObserver
 const verify=()=>{for(const row of expected.values())readDnd5ePluginTempestuousNativeOperation(row.answer.operation);if(pluginTempestuousExactSignature(source)!==sourceSignature)throw Error('plugin-tempestuous-replay:changed-original-source')}
 if(previousReplay&&previousReplay.sourceSignature===sourceSignature&&previousReplay.answerSignature===answerSignature){const before={...previousReplay.visits};verify();const result=runNative();if(result&&typeof(result as{then?:unknown}).then==='function')throw Error('plugin-tempestuous-replay:sync-only');for(const phase of expected.keys())if(previousReplay.visits[phase]!==before[phase]+1)throw Error('plugin-tempestuous-replay:actual-native-phase-not-reached');verify();return result}
 const visits={before:0,after:0},observer:PluginTempestuousObserver={input:source,previous:previousObserver,matches:candidate=>pluginTempestuousExactSignature(candidate)===sourceSignature,observe:operation=>{const actual=readDnd5eActualPluginTempestuousPhase(operation),row=expected.get(actual.phase);if(!row)return;verify();if(visits[actual.phase]++!==0||JSON.stringify([actual.state,actual.action,actual.events,actual.transaction])!==JSON.stringify([row.facts.state,row.facts.action,row.facts.events,row.facts.transaction]))throw Error('plugin-tempestuous-replay:exact-native-prefix-required');if(!row.answer.choice)return;return withTempestuousCastGeometry({parentId:actual.transaction.id,actorId:actual.action.actorId,map:source.prepared.map},()=>completeDnd5eActualPluginTempestuousPhaseFlight(operation,row.answer.choice!,row.answer.rolls))}}
 activePluginTempestuousObserver=observer;activePluginTempestuousReplay={sourceSignature,answerSignature,observer,visits}
 try{verify();const result=runNative();if(result&&typeof(result as{then?:unknown}).then==='function')throw Error('plugin-tempestuous-replay:sync-only');for(const phase of expected.keys())if(visits[phase]!==1)throw Error('plugin-tempestuous-replay:actual-native-phase-not-reached');verify();return result}finally{activePluginTempestuousObserver=previousObserver;activePluginTempestuousReplay=previousReplay}
}
/** Fixed concrete facade for pure/native counters. Actual Room/Flow keeps the
 * canonical resolver identity and uses the same synchronous scope around it. */
export function resolveDnd5ePluginSpellWithActualTempestuousFlights(source:PluginTempestuousInput,answers:PluginTempestuousFlightAnswers){const timestamp=source.now;if(typeof timestamp!=='number')throw Error('plugin-tempestuous-replay:actual-original-clock-required');return withDnd5ePluginTempestuousActualFlights(source,answers,()=>createDnd5eParentEffectClock({parentId:source.prepared.action.id,sourceKey:JSON.stringify(source.prepared),timestamp}).run(()=>resolvePreparedDnd5ePluginSpellCast(source)))}

export interface Dnd5ePluginTempestuousSessionScope{readonly pluginTempestuousSessionScope:unique symbol}
export type Dnd5ePluginTempestuousSessionPending=
 |{status:'pending-plugin-tempestuous-flight';operation:Dnd5ePluginTempestuousNativeOperation;phase:'before'|'after';snapshot:Dnd5eHeadlessCombatState;effectTimestamp:number}
 |{status:'pending-plugin-tempestuous-landing';operation:Dnd5ePluginTempestuousLandingOperation;snapshot:Dnd5eHeadlessCombatState;effectTimestamp:number}
type PluginSessionRow={source:PluginTempestuousInput;signature:string;registry:number;effectTimestamp:number;closed:boolean;earlyBefore?:Dnd5ePluginTempestuousEarlyBeforePrelude;choices:Map<'before'|'after',Dnd5ePluginTempestuousFlightAnswer>;operations:Set<Dnd5ePluginTempestuousNativeOperation>;landings:Set<Dnd5ePluginTempestuousLandingOperation>;pending?:Dnd5ePluginTempestuousSessionPending}
const pluginTempestuousSessions=new WeakMap<object,PluginSessionRow>(),pluginTempestuousSessionErrors=new WeakMap<object,{scope:Dnd5ePluginTempestuousSessionScope;pending:Dnd5ePluginTempestuousSessionPending}>()
function pluginSession(scope:Dnd5ePluginTempestuousSessionScope){const row=pluginTempestuousSessions.get(scope);if(!row||row.closed||row.registry!==dnd5eRulesPluginRegistrySnapshot()||row.signature!==pluginTempestuousExactSignature(row.source)||!actualPluginTempestuousPreparationCurrent(row.source.prepared))throw Error('plugin-tempestuous-session:actual-current-original-required');return row}
/** Fixed canonical factory and genuine prepared identity only. This is a local
 * native suspension scope, never a Room/raw/World capability. */
export function createDnd5ePluginTempestuousSessionScope(source:PluginTempestuousInput,resolve:unknown,earlyBefore?:Dnd5ePluginTempestuousEarlyBeforePrelude){
 if(resolve!==resolvePreparedDnd5ePluginSpellCast||typeof source.now!=='number')throw Error('plugin-tempestuous-session:actual-canonical-clock-required')
 if(earlyBefore)pluginEarlyBefore(earlyBefore,source)
 const first=beginDnd5ePluginTempestuousNativePhase(source,'before');if(first.status!=='pending-plugin-tempestuous-phase')return undefined
 const native=readDnd5ePluginTempestuousNativeOperation(first.operation),scope=Object.freeze({})as Dnd5ePluginTempestuousSessionScope
 pluginTempestuousSessions.set(scope,{source:native.source,signature:pluginTempestuousExactSignature(native.source)!,registry:dnd5eRulesPluginRegistrySnapshot(),effectTimestamp:native.effectTimestamp,closed:false,earlyBefore,choices:new Map(),operations:new Set([first.operation]),landings:new Set()});return scope
}
export function readDnd5ePluginTempestuousSessionScope(scope:Dnd5ePluginTempestuousSessionScope){const row=pluginSession(scope);return{parentId:row.source.prepared.action.id,effectTimestamp:row.effectTimestamp}}
function pausePluginSession(scope:Dnd5ePluginTempestuousSessionScope,pending:Dnd5ePluginTempestuousSessionPending):never{const row=pluginSession(scope),error=new Error('plugin-tempestuous-session:actual-native-pending');row.pending=pending;pluginTempestuousSessionErrors.set(error,{scope,pending});throw error}
export function readDnd5ePluginTempestuousSessionPause(scope:Dnd5ePluginTempestuousSessionScope,error:unknown){if(!error||typeof error!=='object')return;const entry=pluginTempestuousSessionErrors.get(error);if(!entry||entry.scope!==scope)return;const row=pluginSession(scope);if(row.pending!==entry.pending)throw Error('plugin-tempestuous-session:actual-pending-lineage-required');return{...entry.pending,snapshot:structuredClone(entry.pending.snapshot)}}
/** Every worker invocation keeps the caller's canonical resolver identity. The
 * synchronous observer exists only around the actual native invocation. */
export function withDnd5ePluginTempestuousSessionNative<T>(scope:Dnd5ePluginTempestuousSessionScope,candidate:unknown,runNative:()=>T):T{
 const row=pluginSession(scope);if(row.signature!==pluginTempestuousExactSignature(candidate)||runNative.constructor.name==='AsyncFunction')throw Error('plugin-tempestuous-session:exact-plain-original-required')
 const previous=activePluginTempestuousObserver,seen=new Set<'before'|'after'>(),make=(operation:Parameters<typeof readDnd5eActualPluginTempestuousPhase>[0])=>{const actual=readDnd5eActualPluginTempestuousPhase(operation);if(actual.transaction.id!==row.source.prepared.action.id||actual.transaction.actorId!==row.source.prepared.actor.id||actual.action.actorId!==row.source.prepared.actorToken.id)throw Error('plugin-tempestuous-session:same-actual-cast-required');const cap=Object.freeze({})as Dnd5ePluginTempestuousNativeOperation;actualPluginTempestuousOperations.set(cap,{operation,input:row.source,signature:row.signature,effectTimestamp:row.effectTimestamp});row.operations.add(cap);return cap}
 activePluginTempestuousObserver={input:row.source,previous,matches:input=>pluginTempestuousExactSignature(input)===row.signature,observe:operation=>{
  pluginSession(scope);const actual=readDnd5eActualPluginTempestuousPhase(operation);if(seen.has(actual.phase))throw Error('plugin-tempestuous-session:one-native-phase-required');seen.add(actual.phase)
  if(actual.phase==='before'&&row.earlyBefore)return continueActualPluginEarlyBefore(row.earlyBefore,row.source,operation)
  const answer=row.choices.get(actual.phase)
  if(!answer){const cap=make(operation);return pausePluginSession(scope,{status:'pending-plugin-tempestuous-flight',operation:cap,phase:actual.phase,snapshot:structuredClone(actual.state),effectTimestamp:row.effectTimestamp})}
  const held=readDnd5ePluginTempestuousNativeOperation(answer.operation)
  if(JSON.stringify([actual.state,actual.action,actual.events,actual.transaction])!==JSON.stringify([held.state,held.action,held.events,held.transaction]))throw Error('plugin-tempestuous-session:exact-native-prefix-required')
  if(!answer.choice)return
  try{return withTempestuousCastGeometry({parentId:actual.transaction.id,actorId:actual.action.actorId,map:row.source.prepared.map},()=>completeDnd5eActualPluginTempestuousPhaseFlight(operation,answer.choice!,answer.rolls))}
  catch(error){const native=captureDnd5eActualPluginTempestuousLanding(error);if(!native)throw error;const landing=readDnd5eActualPluginTempestuousLanding(native);if(landing.frame.parentId!==actual.transaction.id||landing.frame.actorId!==actual.action.actorId||landing.frame.timing!==actual.phase)throw Error('plugin-tempestuous-session:same-actual-landing-required');const cap=Object.freeze({})as Dnd5ePluginTempestuousLandingOperation;actualPluginTempestuousLandings.set(cap,{original:answer.operation,native,intent:structuredClone(answer.choice),signature:JSON.stringify(landing),prefixRolls:structuredClone(answer.rolls)});row.landings.add(cap);return pausePluginSession(scope,{status:'pending-plugin-tempestuous-landing',operation:cap,snapshot:structuredClone(landing.state),effectTimestamp:row.effectTimestamp})}
 }}
 try{const result=runNative();if(result&&typeof(result as{then?:unknown}).then==='function')throw Error('plugin-tempestuous-session:sync-only');if(!seen.has('before'))throw Error('plugin-tempestuous-session:actual-native-phase-not-reached');pluginSession(scope);return result}finally{activePluginTempestuousObserver=previous}
}
export function acceptDnd5ePluginTempestuousSessionFlight(scope:Dnd5ePluginTempestuousSessionScope,operation:Dnd5ePluginTempestuousNativeOperation,choice?:TempestuousSpellFlightIntent){const row=pluginSession(scope),pending=row.pending;if(!pending||pending.status!=='pending-plugin-tempestuous-flight'||pending.operation!==operation||!pluginTempestuousDataOnly(choice)||choice&&Object.keys(choice).some(key=>!['timing','featureId','to','elevationFeet'].includes(key)))throw Error('plugin-tempestuous-session:actual-pending-flight-required');const facts=readDnd5ePluginTempestuousNativeOperation(operation);if(facts.phase!==pending.phase||choice&&choice.timing!==facts.phase)throw Error('plugin-tempestuous-session:same-actual-phase-required');row.choices.set(facts.phase,{operation,choice:structuredClone(choice)});row.pending=undefined}
export function acceptDnd5ePluginTempestuousSessionLanding(scope:Dnd5ePluginTempestuousSessionScope,operation:Dnd5ePluginTempestuousLandingOperation,values:readonly number[]){const row=pluginSession(scope),pending=row.pending;if(!pending||pending.status!=='pending-plugin-tempestuous-landing'||pending.operation!==operation)throw Error('plugin-tempestuous-session:actual-pending-landing-required');const facts=readDnd5ePluginTempestuousLandingOperation(operation),answer=row.choices.get(facts.frame.timing);if(!answer||!Array.isArray(values)||values.length!==facts.frame.count||values.some(v=>!Number.isInteger(v)||v<1||v>6))throw Error('plugin-tempestuous-session:exact-original-landing-faces-required');answer.rolls={...answer.rolls,fallingDamageRolls:[...values]};row.pending=undefined}
export function cancelDnd5ePluginTempestuousSession(scope:Dnd5ePluginTempestuousSessionScope){const row=pluginTempestuousSessions.get(scope);if(!row)return;row.closed=true;row.pending=undefined;for(const op of row.operations)disposeDnd5ePluginTempestuousNativeOperation(op);for(const op of row.landings)actualPluginTempestuousLandings.delete(op);row.choices.clear()}

export interface Dnd5ePluginTempestuousSourceGuard{readonly pluginTempestuousSourceGuard:unique symbol}
const actualPluginTempestuousSourceGuards=new WeakMap<object,{source:PluginTempestuousInput;signature:string;input:PluginTempestuousInput;inputSignature:string;registry:number;effectTimestamp:number}>()
/** Read-only lifetime independent of temporary phase operations. This only
 * witnesses the real original preparation/input/provider, never a completed
 * Native, raw pool or publication permit. */
export function captureDnd5ePluginTempestuousSourceGuard(source:PluginTempestuousInput,resolve:unknown){
 if(resolve!==resolvePreparedDnd5ePluginSpellCast||typeof source.now!=='number')throw Error('plugin-tempestuous-source:actual-canonical-clock-required')
 const initial=beginDnd5ePluginTempestuousNativePhase(source,'before');if(initial.status!=='pending-plugin-tempestuous-phase')return undefined
 try{const native=readDnd5ePluginTempestuousNativeOperation(initial.operation),cap=Object.freeze({})as Dnd5ePluginTempestuousSourceGuard;actualPluginTempestuousSourceGuards.set(cap,{source:native.source,signature:pluginTempestuousExactSignature(native.source)!,input:source,inputSignature:pluginTempestuousExactSignature(source)!,registry:dnd5eRulesPluginRegistrySnapshot(),effectTimestamp:native.effectTimestamp});return cap}finally{disposeDnd5ePluginTempestuousNativeOperation(initial.operation)}
}
export function readDnd5ePluginTempestuousSourceGuard(cap:Dnd5ePluginTempestuousSourceGuard){const row=actualPluginTempestuousSourceGuards.get(cap);if(!row||row.inputSignature!==pluginTempestuousExactSignature(row.input)||row.registry!==dnd5eRulesPluginRegistrySnapshot()||!actualPluginTempestuousPreparationCurrent(row.source.prepared)||row.signature!==pluginTempestuousExactSignature(row.source))throw Error('plugin-tempestuous-source:actual-current-original-required');return{parentId:row.source.prepared.action.id,mapId:row.source.prepared.map.id,combatId:row.source.prepared.state.combatId,effectTimestamp:row.effectTimestamp}}

/** Read-only no-op presentation predicate, never a source/dice/world issuer. */
export function shouldPreserveActualPluginTempestuousEmptyIntent(prepared:PreparedDnd5ePluginSpellCast){
 if(!actualPluginTempestuousPreparationCurrent(prepared)||prepared.action.sourceMode!=='player'||!prepared.activity||!prepared.activityHeadlessAction)return false
 const activity=prepared.activity,emptyRecord=(v:unknown)=>v===undefined||!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===0,emptyList=(v:unknown)=>v===undefined||Array.isArray(v)&&v.length===0,previous=prepared.activityHeadlessAction.payload
 if(activity.target.kind!=='creature'||activity.target.requiresWilling||activity.choices?.length||activity.checks?.some(check=>check.kind==='saving-throw'&&check.allowWillingFailure)||prepared.payload.activityTargetFormIds!==undefined||!emptyRecord(prepared.payload.activityChoices)||!emptyList(prepared.payload.activityWillingTargetIds)||previous!==undefined&&(!previous||typeof previous!=='object'||Array.isArray(previous)))return false
 const data=previous as Record<string,unknown>|undefined
 if(data?.activityTargetFormIds!==undefined||!emptyRecord(data?.activityChoices)||!emptyList(data?.activityWillingTargetIds))return false
 return dnd5eAvailableTempestuousSpellFlight(prepared.state,prepared.actorToken.id).length>0
}

/** A genuine before phase with no original spell inputs yet. This is mechanical
 * continuity only; a Room consumer must independently authenticate its own early
 * owner book and every later original pool. It grants no raw or World access. */
export interface Dnd5ePluginTempestuousEarlyBeforePrelude{readonly pluginTempestuousEarlyBeforePrelude:unique symbol}
type PluginEarlyBeforeRow={operation:Dnd5ePluginTempestuousNativeOperation;choice?:TempestuousSpellFlightIntent;rolls?:Parameters<typeof resolveDnd5eActualPluginTempestuousFlight>[2];flight?:Dnd5ePluginTempestuousNativeFlight;beforeBaseState?:object;prefix:string;sourceSignature:string;registry:number}
const actualPluginEarlyBeforePreludes=new WeakMap<object,PluginEarlyBeforeRow>()
function pluginBeforePrefix(data:ReturnType<typeof readDnd5ePluginTempestuousNativeOperation>){const{rolls:_future,...pluginAction}=data.action.pluginAction??{},effectFields=['sourceSlotSpellHealingTargets','sourceActionInterruptionReaction','spellcastingSavingThrows','effectRollDice'];const fixed=Object.fromEntries(Object.entries(data.action).filter(([key])=>!effectFields.includes(key)));return JSON.stringify([data.state,{...fixed,pluginAction},data.events,data.transaction,data.effectTimestamp])}
function pluginSourceWithoutFutureRolls(source:PluginTempestuousInput){return pluginTempestuousExactSignature({...source,rolls:undefined})}
export function captureDnd5ePluginTempestuousEarlyBeforePrelude(operation:Dnd5ePluginTempestuousNativeOperation,choice?:TempestuousSpellFlightIntent,rolls?:Parameters<typeof resolveDnd5eActualPluginTempestuousFlight>[2]){
 const facts=readDnd5ePluginTempestuousNativeOperation(operation);if(facts.phase!=='before'||Object.values(facts.source.rolls??{}).some(v=>v!==undefined)||choice&&choice.timing!=='before'||!pluginTempestuousDataOnly(choice)||!pluginTempestuousDataOnly(rolls))throw Error('plugin-tempestuous-early:actual-missing-original-before-required')
 const flight=choice?completeDnd5ePluginTempestuousNativeFlight(operation,choice,rolls):undefined;if(flight){const actual=readDnd5ePluginTempestuousNativeFlight(flight).flight;if(!actual.ok||actual.events.some(e=>e.type==='concentration-check-required'&&!e.settled))throw Error('plugin-tempestuous-early:completed-before-Base-required')}const token=Object.freeze({})as Dnd5ePluginTempestuousEarlyBeforePrelude
 actualPluginEarlyBeforePreludes.set(token,{operation,choice:structuredClone(choice),rolls:structuredClone(rolls),flight,prefix:pluginBeforePrefix(facts),sourceSignature:pluginTempestuousExactSignature(facts.source)!,registry:dnd5eRulesPluginRegistrySnapshot()});return token
}
function pluginEarlyBefore(token:Dnd5ePluginTempestuousEarlyBeforePrelude,source:PluginTempestuousInput){
 const row=actualPluginEarlyBeforePreludes.get(token);if(!row||row.registry!==dnd5eRulesPluginRegistrySnapshot())throw Error('plugin-tempestuous-early:actual-current-prelude-required')
 if(Object.keys(source.rolls??{}).some(key=>!['activityRolls','effectRollDice','spellcastingSavingThrows','sourceActionInterruptionReaction','sourceSlotSpellHealingTargets','activityInterruptChoiceId','activityRetainedSaveDice','spellDamageDieRerolls','activityTeleportInterruptions','attackD20','attackD20Second','savingThrowD20','savingThrowD20Second','damageRolls','overchannelSelfDamageRolls','targetRolls'].includes(key)))throw Error('plugin-tempestuous-early:closed-future-original-input-required')
 const held=readDnd5ePluginTempestuousNativeOperation(row.operation);if(row.sourceSignature!==pluginTempestuousExactSignature(held.source)||source.prepared!==held.source.prepared||!actualPluginTempestuousPreparationCurrent(source.prepared)||pluginSourceWithoutFutureRolls(source)!==pluginSourceWithoutFutureRolls(held.source)||!pluginTempestuousDataOnly(source))throw Error('plugin-tempestuous-early:exact-original-and-future-input-required')
 if(row.flight)readDnd5ePluginTempestuousNativeFlight(row.flight);if(row.beforeBaseState)readDnd5eActualConcentrationResolution(row.beforeBaseState);return row
}
/** A new Native visit is mandatory on every synchronous invocation, including
 * nested calls. Only action.pluginAction.rolls is a future original input slot;
 * state, transaction, events, geometry, prepared recipe and T1 stay exact. */
export function withDnd5ePluginTempestuousEarlyBefore<T>(token:Dnd5ePluginTempestuousEarlyBeforePrelude,source:PluginTempestuousInput,runNative:()=>T):T{
 const row=pluginEarlyBefore(token,source),signature=pluginTempestuousExactSignature(source),previous=activePluginTempestuousObserver;let visits=0
 if(runNative.constructor.name==='AsyncFunction')throw Error('plugin-tempestuous-early:sync-native-required')
 activePluginTempestuousObserver={input:source,previous,matches:candidate=>actualPluginTempestuousPreparationCurrent(candidate.prepared)&&pluginTempestuousExactSignature(candidate)===signature,observe:operation=>{const actual=readDnd5eActualPluginTempestuousPhase(operation);if(actual.phase!=='before')return;pluginEarlyBefore(token,source);if(visits++!==0||row.prefix!==pluginBeforePrefix({...actual,effectTimestamp:source.now!,source}))throw Error('plugin-tempestuous-early:exact-new-native-prefix-required');if(row.choice)return withTempestuousCastGeometry({parentId:actual.transaction.id,actorId:actual.action.actorId,map:source.prepared.map},()=>row.beforeBaseState?completeDnd5eActualPluginTempestuousPhaseFlightWithConcentration(operation,row.choice!,row.rolls,row.beforeBaseState):completeDnd5eActualPluginTempestuousPhaseFlight(operation,row.choice!,row.rolls))}}
 try{const result=runNative();if(result&&typeof(result as{then?:unknown}).then==='function')throw Error('plugin-tempestuous-early:sync-native-required');if(visits!==1)throw Error('plugin-tempestuous-early:actual-new-native-before-required');if(signature!==pluginTempestuousExactSignature(source))throw Error('plugin-tempestuous-early:changed-future-input');pluginEarlyBefore(token,source);return result}finally{activePluginTempestuousObserver=previous}
}
export function resolveDnd5ePluginSpellWithEarlyBefore(token:Dnd5ePluginTempestuousEarlyBeforePrelude,source:PluginTempestuousInput){if(typeof source.now!=='number')throw Error('plugin-tempestuous-early:actual-original-clock-required');return withDnd5ePluginTempestuousEarlyBefore(token,source,()=>createDnd5eParentEffectClock({parentId:source.prepared.action.id,sourceKey:JSON.stringify(source.prepared),timestamp:source.now!}).run(()=>resolvePreparedDnd5ePluginSpellCast(source)))}

export function disposeDnd5ePluginTempestuousEarlyBeforePrelude(token:Dnd5ePluginTempestuousEarlyBeforePrelude){actualPluginEarlyBeforePreludes.delete(token)}

function continueActualPluginEarlyBefore(token:Dnd5ePluginTempestuousEarlyBeforePrelude,source:PluginTempestuousInput,operation:Dnd5eActualPluginTempestuousPhase){const row=pluginEarlyBefore(token,source),actual=readDnd5eActualPluginTempestuousPhase(operation);if(actual.phase!=='before'||row.prefix!==pluginBeforePrefix({...actual,effectTimestamp:source.now!,source}))throw Error('plugin-tempestuous-early:exact-new-native-prefix-required');if(row.choice)return withTempestuousCastGeometry({parentId:actual.transaction.id,actorId:actual.action.actorId,map:source.prepared.map},()=>row.beforeBaseState?completeDnd5eActualPluginTempestuousPhaseFlightWithConcentration(operation,row.choice!,row.rolls,row.beforeBaseState):completeDnd5eActualPluginTempestuousPhaseFlight(operation,row.choice!,row.rolls))}

/** Resume from the actual completed native flight, including its retained
 * mechanically resolved landing input. No caller values or choice are accepted. */
export function captureDnd5ePluginTempestuousEarlyBeforeFromFlight(flight:Dnd5ePluginTempestuousNativeFlight){
 const facts=readDnd5ePluginTempestuousNativeFlight(flight),held=actualPluginTempestuousFlights.get(flight)!;if(facts.phase!=='before'||Object.values(facts.source.rolls??{}).some(v=>v!==undefined))throw Error('plugin-tempestuous-early:actual-missing-original-before-required')
 if(!facts.flight.ok||facts.flight.events.some(e=>e.type==='concentration-check-required'&&!e.settled))throw Error('plugin-tempestuous-early:completed-before-Base-required')
 const token=Object.freeze({})as Dnd5ePluginTempestuousEarlyBeforePrelude;actualPluginEarlyBeforePreludes.set(token,{operation:held.original,choice:structuredClone(held.intent),rolls:structuredClone(held.rolls),flight,prefix:pluginBeforePrefix(facts),sourceSignature:pluginTempestuousExactSignature(facts.source)!,registry:dnd5eRulesPluginRegistrySnapshot()});return token
}

/** Read-only actual Native prefix for later dice geometry; no World projection. */
export function readDnd5ePluginTempestuousEarlyBeforePrelude(token:Dnd5ePluginTempestuousEarlyBeforePrelude,source?:PluginTempestuousInput){const held=actualPluginEarlyBeforePreludes.get(token);if(!held)throw Error('plugin-tempestuous-early:actual-current-prelude-required');const facts=readDnd5ePluginTempestuousNativeOperation(held.operation),row=pluginEarlyBefore(token,source??facts.source),state=row.beforeBaseState?readDnd5eActualConcentrationResolution(row.beforeBaseState).result.state:row.flight?readDnd5ePluginTempestuousNativeFlight(row.flight).flight.state:facts.state;return{parentId:facts.transaction.id,effectTimestamp:facts.effectTimestamp,state:structuredClone(state)}}

/** Native CON identity is mandatory even after the actual Page Base has checked
 * its own input/completion provenance. No caller Base snapshot is registered. */
export function captureDnd5ePluginTempestuousEarlyBeforeFromFlightAndConcentration(flight:Dnd5ePluginTempestuousNativeFlight,actualBaseState:object){const facts=readDnd5ePluginTempestuousNativeFlight(flight),held=actualPluginTempestuousFlights.get(flight)!,native=readDnd5eActualConcentrationResolution(actualBaseState),checks=facts.flight.events.filter(e=>e.type==='concentration-check-required'&&!e.settled);if(facts.phase!=='before'||!facts.flight.ok||Object.values(facts.source.rolls??{}).some(v=>v!==undefined)||checks.length!==1||checks[0].type!=='concentration-check-required'||checks[0].targetId!==native.action.actorId||checks[0].dc!==native.action.dc||native.before!==JSON.stringify(facts.flight.state)||native.options.now!==facts.effectTimestamp||native.options.transactionId!==JSON.stringify([facts.transaction.id,'concentration',0,native.action.actorId]))throw Error('plugin-tempestuous-early:actual-before-Base-native-required');const token=Object.freeze({})as Dnd5ePluginTempestuousEarlyBeforePrelude;actualPluginEarlyBeforePreludes.set(token,{operation:held.original,choice:structuredClone(held.intent),rolls:structuredClone(held.rolls),flight,beforeBaseState:actualBaseState,prefix:pluginBeforePrefix(facts),sourceSignature:pluginTempestuousExactSignature(facts.source)!,registry:dnd5eRulesPluginRegistrySnapshot()});return token}

export function assertDnd5ePluginTempestuousEarlyBeforeFlight(token:Dnd5ePluginTempestuousEarlyBeforePrelude,flight:Dnd5ePluginTempestuousNativeFlight){const facts=readDnd5ePluginTempestuousNativeFlight(flight),row=pluginEarlyBefore(token,facts.source);if(row.flight!==flight||!row.beforeBaseState)throw Error('plugin-tempestuous-early:actual-same-flight-Base-required')}
