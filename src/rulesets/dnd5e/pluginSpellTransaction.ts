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
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
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
import { createDnd5eMapCombatSnapshot, dnd5eRequestedInitiativeActorIndex, planDnd5eMapResultApplication, prepareDnd5eExplorationActor, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5ePreventsAttackAdvantage, dnd5eSavingThrowMode, dnd5eTargetGrantsAttackAdvantage, dnd5eTargetIsDodging } from './passiveDefenses'
import { dnd5eConditionSavingThrowAutomaticallyFails } from './conditions'
import { resolveDnd5eRollMode } from './rollMode'
import {
  dnd5ePluginHeadlessActionDefinition,
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
import { dnd5eActivityOutcomeAllowsChoicesV1, dnd5eActivityTargetOverrideForChoicesV1, dnd5eActivityWithTargetChoicesV1 } from './activities/dnd5eActivityChoices'
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
  | 'invalid-action'
  | 'invalid-actor'
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
  action: SharedPlayerActionState
  payload: Dnd5eSpellCastPayload
  spell: RegisteredDnd5ePluginSpell
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  castingClassId: Dnd5eClassId
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
  activityHeadlessAction?: Dnd5ePluginAction
  activityTargetCell?: GridCell
  activityTargetCells: GridCell[]
  activityAreaPlacement?: Dnd5eActivityAreaPlacementV1
  activityAreaPlacementDistanceFeet?: number
  activityAreaExemptTargetIds: readonly string[]
  slotLevel: number
  ritual: boolean
  /** `long` is a minute/hour cast completed outside initiative. */
  castingTime: 'action' | 'bonus-action' | 'reaction' | 'long'
  componentCheck: Dnd5ePluginSpellComponentCheck
  spellMaterialPlan?: Dnd5eSpellMaterialConsumptionPlan
  attackModifier: number
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
    ) || activity.authorityBinding ||
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
  return activity == null || dnd5eActivityAutomationAnalysisV1(activity).capability.level === 'full'
}

export function prepareDnd5ePluginSpellCast(input: {
  action: SharedPlayerActionState
  /** Host-authoritative current round. Exploration clients may submit a stale synthetic round. */
  authorityRound?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
  roomRequiredPlugins?: readonly { id: string; version: string; integrity?: string }[] | null
  now?: number
  effectiveRules?: Dnd5eEffectiveRulesContextV1 | null
}): { ok: true; prepared: PreparedDnd5ePluginSpellCast } | { ok: false; reason: Dnd5ePluginSpellRejectReason } {
  const payload = input.action.dnd5eSpellCast
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
  const activity = dnd5ePluginSpellActivity(spell)
  const mechanics = spell.mechanics
  if (input.roomRequiredPlugins === null) return { ok: false, reason: 'room-rules-unavailable' }
  if (input.roomRequiredPlugins) {
    if (spell.ownerPluginId !== DND5E_SRD_AUDITED_SPELL_PACKAGE_ID) {
      const requirement = input.roomRequiredPlugins.find((plugin) => plugin.id === spell.ownerPluginId)
      if (!requirement) return { ok: false, reason: 'plugin-not-enabled-for-room' }
      if (missingDnd5eRulesPluginRequirements([requirement]).length > 0) return { ok: false, reason: 'plugin-version-mismatch' }
    }
  }
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === input.action.actorTokenId && token.characterId === input.action.characterId)
  const enforceSpellcastingPrerequisites =
    input.effectiveRules?.houseRules.spellcastingPrerequisitesEnabled !== false
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
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
  const castingClassId = dnd5eSpellcastingClassIdForSpell(actor, spell.id, payload.castingClassId, spell.classes)
  if (!castingClassId) return { ok: false, reason: 'spell-not-known-or-prepared' }
  const classDefinition = castingClassId ? dnd5eClassDefinition(castingClassId) : undefined
  const castingClassLevel = castingClassId ? dnd5eCharacterClassLevel(actor, castingClassId) : 0
  if (!classDefinition?.spellcasting || castingClassLevel < 1) {
    return { ok: false, reason: 'spellcasting-class-unavailable' }
  }
  const ritual = payload.ritual === true
  if (ritual && (
    spell.ritual !== true ||
    spell.level < 1 ||
    classDefinition.spellcasting.ritualCasting !== true
  )) return { ok: false, reason: 'ritual-unavailable' }
  if (payload.itemInstanceId != null || (
    payload.focusItemInstanceId != null &&
    !dnd5eHeldSpellcastingFocusMatches(actor, payload.focusItemInstanceId, castingClassId)
  )) {
    return { ok: false, reason: 'component-unavailable' }
  }
  if (enforceSpellcastingPrerequisites && actor.dnd5eCombatState?.wildShapeFormId && (classDefinition.id !== 'druid' || castingClassLevel < 18)) {
    return { ok: false, reason: 'wild-shape-spellcasting-unavailable' }
  }
  const isLongCast = spell.castingTime.unit === 'minute' || spell.castingTime.unit === 'hour'
  if (
    spell.castingTime.value < 1 ||
    !['action', 'bonus-action', 'reaction', 'minute', 'hour'].includes(spell.castingTime.unit) ||
    (isLongCast && input.action.combatId != null && !ritual)
  ) {
    return { ok: false, reason: 'invalid-action' }
  }
  const castingTime: PreparedDnd5ePluginSpellCast['castingTime'] = ritual
    ? 'long'
    : isLongCast
    ? 'long'
    : spell.castingTime.unit as 'action' | 'bonus-action' | 'reaction'
  const activityCompletionDelayRounds = dnd5ePluginSpellElapsedCastingMinutes({
    castingTime: spell.castingTime,
    ritual,
  }) * 10
  const liveCombatCast = input.action.combatId?.trim() != null && input.action.combatId.trim().length > 0
  if (liveCombatCast && !ritual && castingTime === 'action' && input.turnEconomy && input.turnEconomy.action.current < 1) return { ok: false, reason: 'action-unavailable' }
  if (liveCombatCast && !ritual && castingTime === 'bonus-action' && input.turnEconomy && input.turnEconomy.bonusAction.current < 1) return { ok: false, reason: 'bonus-action-unavailable' }
  if (liveCombatCast && !ritual && castingTime === 'reaction' && input.turnEconomy && input.turnEconomy.reaction.current < 1) return { ok: false, reason: 'reaction-unavailable' }

  const requestedMaterialTargetId = payload.projectileTargetIds?.[0] ?? payload.targetTokenIds?.[0] ??
    payload.targetTokenId ?? input.action.targetTokenIds?.[0] ?? input.action.targetTokenId
  const requestedMaterialTarget = input.map.tokens.find((candidate) => candidate.id === requestedMaterialTargetId)
  const componentCheck = dnd5ePluginSpellComponentCheck(actor, spell, castingClassId, {
    targetHitDiceCount: requestedMaterialTarget
      ? dnd5eTokenHitDiceCount(requestedMaterialTarget, input.characters)
      : undefined,
    imprisonmentMode: payload.activityChoices?.mode,
  })
  if (enforceSpellcastingPrerequisites && !dnd5eSpellComponentsAvailable(componentCheck)) {
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
    : classDefinition.spellcasting.kind === 'pact' && spell.level <= 5
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
  if (spell.level > 0 && !ritual) {
    const resourceKey = classDefinition.spellcasting.kind === 'pact' && spell.level <= 5
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
        },
        castLevel: slotLevel,
      }).activity
    : undefined
  if (dnd5eCharacterIsBlinded(actor) && dnd5eSpellTargetRequiresSight({
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
  const activityPermitsEmptyArea = effectiveActivity?.outcomes.some((outcome) =>
    outcome.operations.some((operation) =>
      operation.kind === 'create-persistent-area' ||
      operation.kind === 'summon' ||
      operation.kind === 'duplicate-creature' ||
      operation.kind === 'modify-map-object-lock' ||
      operation.kind === 'enchant-map-object-light' ||
      operation.kind === 'purify-map-consumables' ||
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
      operation.kind === 'enchant-map-object-light' ||
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
    lengthFeet: payload.areaTargetLengthFeet,
  }) : undefined
  if (areaTemplate && !area) return { ok: false, reason: 'invalid-target' }
  if (!areaTemplate && (
    payload.areaTargetRadiusFeet != null || payload.areaTargetWidthFeet != null ||
    payload.areaTargetHeightFeet != null || payload.areaTargetLengthFeet != null
  )) return { ok: false, reason: 'invalid-target' }
  const scaledActivityTargetCount = scaledActivity?.target.kind === 'creature'
    ? scaledActivity.target.count
    : undefined
  const targetCapacity = dnd5ePluginSpellTargetCapacity(
    spell,
    slotLevel,
    scaledActivityTargetCount,
  )
  let targetTokens: Token[]
  let activityTargetCell: GridCell | undefined
  let activityTargetCells: GridCell[] = []
  let activityAreaPlacement: Dnd5eActivityAreaPlacementV1 | undefined
  let activityAreaPlacementDistanceFeet: number | undefined
  if (area) {
    const casterCell = pixelToCell(actorToken.x, actorToken.y, input.map)
    const targetCell = payload.areaTargetCell ?? (spell.range.type === 'self' ? casterCell : undefined)
    if (!targetCell || !canPlaceAoe(area, casterCell, targetCell)) return { ok: false, reason: 'target-out-of-range' }
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
      anchorCells.some((cell) => !canPlaceAoe(area, casterCell, cell))
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
    const affectedCells = [...new Map(anchorCells.flatMap((anchorCell) => {
      const orientFrom = aoeOrientFromCell(area, casterCell, anchorCell, {
        rectRotation: payload.areaTargetOrientation,
        rectAngleDegrees: payload.areaTargetAngleDegrees,
      })
      return cellsForAoe(area, orientFrom, anchorCell)
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
      elevationFeet: actorToken.elevationFeet,
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
        ? activityAreaTarget.heightFeet
        : payload.areaTargetHeightFeet ?? activityAreaTarget?.heightFeet,
      instances: anchorCells.map((cell) => {
        const point = cellToPixel(cell, input.map)
        return { x: point.x, y: point.y, elevationFeet: actorToken.elevationFeet }
      }),
    }
    targetTokens = activitySelectsMappedObject
      ? []
      : tokensInCells(input.map, input.map.tokens, affectedCells).filter((token) => {
        // NPC/obstacle tokens are map scenery, not Headless combatants. Letting
        // one of them leak into an area spell's authoritative target list makes
        // an otherwise valid exploration cast fail later as combatant-missing.
        if ((token.type !== 'player' && token.type !== 'enemy') || isDefeatedAreaToken(token)) return false
        if (
          spell.id === 'fire-storm' && payload.activityChoices?.mode === 'spare-plants' &&
          token.creatureTypes?.some((type) => {
            const normalized = type.trim().toLocaleLowerCase()
            return normalized === 'plant' || normalized.includes('植物')
          }) === true
        ) return false
        if (token.id === actorToken.id && spell.targeting?.includeSelf !== true) return false
        const opposed = areOpposedCombatTokens(actorToken, token)
        if (spell.targeting?.relation === 'ally' && opposed) return false
        if (spell.targeting?.relation === 'enemy' && !opposed) return false
        return true
        }).slice(0, targetCapacity.maximumTargets)
  } else if (dnd5ePluginSpellUsesSelfTarget(spell, scaledActivity)) {
    targetTokens = [actorToken]
  } else {
    const requestedIds = targetCapacity.allowDuplicateTargets
      ? payload.projectileTargetIds ?? payload.targetTokenIds ?? [payload.targetTokenId || input.action.targetTokenId]
      : [...new Set(payload.targetTokenIds?.length ? payload.targetTokenIds : [payload.targetTokenId || input.action.targetTokenId])]
    if (requestedIds.length < 1 || requestedIds.length > targetCapacity.maximumTargets) return { ok: false, reason: 'invalid-target' }
    targetTokens = requestedIds.flatMap((targetId) => {
      const token = input.map.tokens.find((candidate) => candidate.id === targetId)
      return token ? [token] : []
    })
    if (targetTokens.length !== requestedIds.length || targetTokens.some((token) => token.type === 'obstacle')) {
      return { ok: false, reason: 'invalid-target' }
    }
    for (const token of targetTokens) {
      if (token.id === actorToken.id && spell.targeting?.includeSelf !== true) return { ok: false, reason: 'invalid-target' }
      const opposed = areOpposedCombatTokens(actorToken, token)
      if (spell.targeting?.relation === 'ally' && opposed) return { ok: false, reason: 'invalid-target' }
      if (spell.targeting?.relation === 'enemy' && !opposed) return { ok: false, reason: 'invalid-target' }
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
  // Persistent/summoning and mapped-object Activities can legally be placed
  // where there is no creature token. Keep a caster fallback only for
  // UI/interrupt attribution; the actual Activity targetIds remain empty so
  // the caster is not fabricated as an affected target.
  const targetToken = targetTokens[0] ?? (area && activityPermitsEmptyArea ? actorToken : undefined)
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
        ...targetTokens.flatMap((target) =>
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
    round: input.authorityRound ?? input.action.round,
    turnSlotId: snapshotInitiativeOrder[input.action.initiativeIndex]?.slotId,
    map: snapshotMap,
    characters: input.characters,
    initiativeOrder: snapshotInitiativeOrder,
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
    ? rules.abilityModifier(actor.abilities[classDefinition.spellcasting.ability])
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
      spellcastingAbilityModifier: rules.abilityModifier(actor.abilities[classDefinition.spellcasting.ability]),
    })
  } catch {
    return { ok: false, reason: 'invalid-dice' }
  }
  const spellSaveDc = 8 + rules.proficiencyBonus(actor.level) +
    rules.abilityModifier(actor.abilities[classDefinition.spellcasting.ability])
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
    const actorAttackRollEffect = dnd5eActiveAttackRollFlags(actorCombatant.classState.activeEffects)
    const targetLinkedAttackRollEffect = dnd5eActiveTargetLinkedAttackRollFlags(
      targetCombatant.classState.activeEffects,
      actorCombatant.id,
      actorCombatant.creatureType,
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
  const concentrationRounds = spell.duration.concentration &&
    !(spell.id === 'bestow-curse' && slotLevel >= 5) &&
    !(spell.id === 'major-image' && slotLevel >= 6)
    ? spell.id === 'bestow-curse' && slotLevel === 4
      ? 100
      : Math.min(14_400, spellDurationRounds(spell) + upcast.durationRounds)
    : undefined
  const now = input.now ?? Date.now()
  return {
    ok: true,
    prepared: {
      action: input.action,
      payload,
      spell,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      castingClassId,
      castingClassLevel,
      actorToken,
      targetToken,
      targetTokens,
      targets,
      tinyHut,
      antipathySympathy,
      area: area ?? undefined,
      activity,
      activityHeadlessAction: activity ? {
        type: 'plugin',
        pluginId: spell.ownerPluginId,
        actionId: spell.automation.actionId,
        transactionId: input.action.id,
        actorId: actorToken.id,
        targetId: targets[0]?.token.id,
        targetIds: targets.map((target) => target.token.id),
        targetCell: activityTargetCell,
        targetOrientation: payload.areaTargetOrientation,
        distanceFeet: Math.max(0, ...targets.map((target) => target.distanceFeet)),
        activityAreaPlacement,
        activityAreaPlacementDistanceFeet,
        ...(activityAreaExemptTargetIds.length > 0
          ? { activityAreaExemptTargetIds }
          : {}),
        castLevel: slotLevel,
        payload: payload.activityChoices || payload.activityInventoryInstanceId || payload.magicMouth ||
          activitySecretPhrase || activityCompletionDelayRounds > 0
          ? {
              ...(payload.activityChoices ? { activityChoices: { ...payload.activityChoices } } : {}),
              ...(payload.magicMouth ? { magicMouth: { ...payload.magicMouth } } : {}),
              ...(activitySecretPhrase ? { secretPhrase: activitySecretPhrase } : {}),
              ...(payload.activityInventoryInstanceId
                ? { activityInventoryInstanceId: payload.activityInventoryInstanceId }
                : {}),
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
      spellMaterialPlan: enforceSpellcastingPrerequisites ? componentCheck.materialPlan : undefined,
      attackModifier: spellSaveDc - 8,
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

export function resolvePreparedDnd5ePluginSpellCast(input: {
  prepared: PreparedDnd5ePluginSpellCast
  rolls: Dnd5ePluginSpellResolutionRolls
  now?: number
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
  attackDecoyRolls?: readonly import('./headlessCombatEngine').Dnd5eAttackDecoyOccurrenceRoll[]
}): Dnd5ePluginSpellResolution {
  const { prepared, rolls: supplied } = input
  if (prepared.activity && prepared.activityHeadlessAction) {
    const now = input.now ?? Date.now()
    const activityAction: Dnd5ePluginAction = {
      ...prepared.activityHeadlessAction,
      rolls: supplied.activityRolls,
      interruptChoiceId: supplied.activityInterruptChoiceId,
    }
    const activityResolution = resolveDnd5eActionWithAirborneFallPreview(
      prepared.state,
      {
        type: 'plugin-spell-activity',
        actorId: prepared.actorToken.id,
        pluginAction: activityAction,
        attackDecoyRolls: input.attackDecoyRolls,
        spell: {
          castingClassId: prepared.castingClassId,
          spellId: prepared.spell.id,
          spellName: prepared.spell.name,
          spellLevel: prepared.spell.level,
          slotLevel: prepared.slotLevel,
          castingTime: prepared.castingTime,
          ritual: prepared.ritual || undefined,
          declaredTargetIds: prepared.targets.map((target) => target.token.id),
          concentrationRounds: prepared.concentrationRounds,
          concentrationTargetIds: prepared.concentrationRounds
            ? prepared.targets.length > 0
              ? prepared.targets.map((target) => target.token.id)
              : [prepared.actorToken.id]
            : undefined,
          spellSchool: prepared.spell.school,
          sculptedTargetIds: prepared.sculptedTargetIds,
        },
      },
      input.airborneFallDamageRollsByCombatantId,
      { transaction: prepared.transaction, now },
    )
    let { result } = activityResolution
    const { airborneFalls } = activityResolution
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
      ? settleDnd5eSpellMaterialConsumption(
          prepared.characters,
          prepared.actor.id,
          prepared.spellMaterialPlan,
        )
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
        map: prepared.map,
        characters: materialSettlement?.characters ?? prepared.characters,
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
  const sourceCombatant = prepared.state.combatants[prepared.actorToken.id]
  const sharedAreaDamage = !!prepared.area && mechanics.resolution !== 'spell-attack'
  const suppliedOverchannelSelfDamageRolls = supplied.overchannelSelfDamageRolls ?? []
  if (
    suppliedOverchannelSelfDamageRolls.length !== prepared.overchannelSelfDamageDiceCount ||
    suppliedOverchannelSelfDamageRolls.some((value) => !validDie(value, 12))
  ) return invalidDice(prepared, transaction, now)
  const sharedDamageValues = prepared.overchannel && sharedAreaDamage && mechanics.damage
    ? Array.from({ length: prepared.damageDice.count }, () => prepared.damageDice.sides)
    : supplied.damageRolls ?? []
  if (prepared.overchannel && (supplied.damageRolls?.length ?? 0) > 0) {
    return invalidDice(prepared, transaction, now)
  }
  if (sharedAreaDamage && mechanics.damage && (
    sharedDamageValues.length !== prepared.damageDice.count ||
    sharedDamageValues.some((value) => !validDie(value, prepared.damageDice.sides))
  )) return invalidDice(prepared, transaction, now)
  if (sharedAreaDamage && mechanics.damage) {
    transaction = appendRollLedgerEntry(transaction, {
      id: `${prepared.action.id}:damage:shared`, kind: 'damage', label: `${prepared.spell.name}·范围伤害`,
      dice: { sides: prepared.damageDice.sides, values: sharedDamageValues }, modifier: prepared.damageDice.bonus, visibility: 'public',
      sourceId: prepared.actor.id, targetId: prepared.targetToken.id, createdAt: now,
    })
  }

  const effects: import('./headlessCombatEngine').Dnd5eAdjudicatedSpellEffect[] = []
  const targetResolutions: Dnd5ePluginSpellTargetResolution[] = []
  for (let index = 0; index < prepared.targets.length; index += 1) {
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
      const values = sharedAreaDamage
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

  const { result, airborneFalls } = resolveDnd5eActionWithAirborneFallPreview(prepared.state, {
    type: 'adjudicated-spell',
    actorId: prepared.actorToken.id,
    castingClassId: prepared.castingClassId,
    spellId: prepared.spell.id,
    spellName: prepared.spell.name,
    spellLevel: prepared.spell.level,
    slotLevel: prepared.slotLevel,
    castingTime: prepared.castingTime,
    effects,
    concentrationRounds: prepared.concentrationRounds,
    spellSchool: prepared.spell.school,
    sculptedTargetIds: prepared.sculptedTargetIds,
    overchannel: prepared.overchannel,
    overchannelSelfDamageRolls: suppliedOverchannelSelfDamageRolls,
  }, input.airborneFallDamageRollsByCombatantId, { transaction, now })
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
  const materialSettlement = settleDnd5eSpellMaterialConsumption(
    prepared.characters,
    prepared.actor.id,
    prepared.spellMaterialPlan,
  )
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
  context?: { targetHitDiceCount?: number; imprisonmentMode?: string },
): Dnd5ePluginSpellComponentCheck {
  const localSpellId = spell.id.startsWith(`${spell.ownerPluginId}:`)
    ? spell.id.slice(spell.ownerPluginId.length + 1)
    : spell.id
  return dnd5eSpellComponentCheck(actor, {
    verbal: spell.components.verbal,
    somatic: spell.components.somatic,
    material: spell.components.material,
    costlyMaterial: (spell.components.materialCostGp ?? 0) > 0,
    consumedMaterial: spell.components.materialConsumed === true,
    specificMaterial: spell.components.materialRequirement ?? (
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
