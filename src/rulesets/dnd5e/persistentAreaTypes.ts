import { normalizeDnd5eAbilityCheckRules, type Dnd5eAbilityCheckRule } from './abilityCheckRules'
import { SKILLS, type AbilityKey } from '../../lib/dnd'
import { normalizeSurfaceDrawing, type SurfaceDrawing } from './surfaceDrawing'
import { normalizeVerticalSurfaceProjection } from './verticalSurfaceProjection'
import type { VerticalMaterialSurface } from './verticalMaterialSurface'
import {normalizeHorizontalMaterialSurface,type HorizontalMaterialSurface} from './horizontalMaterialSurface'
import { validPersistentAreaColumns } from '../../../shared/persistent-area-columns.mjs'
import { normalizeDnd5ePersistentAreaCapacity, type Dnd5ePersistentAreaCapacityDeclaration } from './persistentAreaCapacity'
import { normalizePersistentAreaCreatureTypes } from './persistentAreaCreatureFilter'
import { normalizePersistentAreaRemovalAction, type Dnd5ePersistentAreaRemovalAction, type Dnd5ePersistentAreaRemovalActionDeclaration } from './persistentAreaRemovalAction'
import type { GridCell } from '../../lib/gridCombat'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from './conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
import {
  validateDnd5eWorkshopDamageFormulaV1,
  type Dnd5eWorkshopDamageFormulaV1,
} from './workshopDamageFormula'

export const DND5E_DECLARATIVE_LABEL_MAX_LENGTH = 120
export const DND5E_DECLARATIVE_DURATION_MAX_ROUNDS = 14_400
/** Long-lived spell areas may persist for as much as one in-world year. */
export const DND5E_PERSISTENT_AREA_DURATION_MAX_ROUNDS = 5_256_000

export const DND5E_PERSISTENT_AREA_VISUAL_PRESETS = [
  'arcane',
  'surface-inscription',
  'surface-color',
  'surface-drawing',
  'cloud-text',
  'dancing-lights',
  'toxic-cloud',
  'daylight',
  'darkness',
  'moonbeam',
  'call-lightning',
  'spirit-guardians',
  'spike-growth',
  'flaming-sphere',
  'bonfire',
  'spiritual-weapon',
  'grease',
  'entangle',
  'black-tentacles',
  'wall-of-fire',
  'mage-hand',
  'insect-plague',
  'blade-barrier',
  'cloudkill',
  'ice-storm-ground',
  'fog-cloud',
  'web',
  'silence',
  'sleet-storm',
  'stinking-cloud',
  'wind-wall',
  'wall-of-force',
  'wall-of-stone',
  'wall-of-ice',
  'wall-of-thorns',
  'silent-image',
  'major-image',
  'unseen-servant',
  'mislead',
  'project-image',
] as const

export type Dnd5ePersistentAreaVisualPreset = typeof DND5E_PERSISTENT_AREA_VISUAL_PRESETS[number]
export type Dnd5ePersistentAreaVisualIntensity = 'subtle' | 'normal' | 'strong'

/**
 * A bounded presentation hint. The Host synchronizes this declaration, while each
 * client renders the animation locally; no animation frame enters authoritative state.
 */
export interface Dnd5ePersistentAreaVisual {
  preset: Dnd5ePersistentAreaVisualPreset
  intensity?: Dnd5ePersistentAreaVisualIntensity
  drawing?: SurfaceDrawing
  verticalSurface?: VerticalMaterialSurface
  horizontalSurface?: HorizontalMaterialSurface
}

/**
 * 地图光照只接受 Host 白名单声明。法术区域不能携带渲染回调；画布和
 * 权威视线判定会读取同一份半径、环级与压制规则。
 */
export type Dnd5ePersistentAreaLighting =
  | {
      /** Reduce resolved illumination one tier; overlapping reductions do not stack. */
      kind: 'reduce-light'
      radiusFeet: number
      spellLevel: number
    }
  | {
      kind: 'light'
      sunlight?: true
      /** Illumination is confined to the declared occupied cells and vertical volume. */
      areaOnly?: true
      /** Emit continuously from a rotated rectangle's full volume. */
      emission?: 'rectangle-volume'
      brightRadiusFeet: number
      dimRadiusFeet: number
      color: string
      spellLevel: number
      suppressesMagicalDarknessThroughLevel?: number
    }
  | {
      kind: 'magical-darkness'
      radiusFeet: number
      spellLevel: number
      suppressesMagicalLightThroughLevel?: number
      /** Suppress illumination locally without ending the light-producing spell. */
      lightSuppressionScope?: 'within-area'
    }

export const DND5E_HALLOW_ADDITIONAL_EFFECTS = [
  'courage',
  'darkness',
  'daylight',
  'energy-protection',
  'energy-vulnerability',
  'everlasting-rest',
  'extradimensional-interference',
  'fear',
  'silence',
  'tongues',
] as const

export type Dnd5eHallowAdditionalEffect = typeof DND5E_HALLOW_ADDITIONAL_EFFECTS[number]

/** Closed, cast-time choices retained by the permanent Hallow area. */
export interface Dnd5eHallowAreaState {
  additionalEffect: Dnd5eHallowAdditionalEffect
  damageType?: Dnd5eDamageType
  effectScope: 'all' | 'allies' | 'enemies' | 'creature-type'
  affectedCreatureType?: string
  wardedCreatureTypes: readonly ('celestial' | 'elemental' | 'fey' | 'fiend' | 'undead')[]
}

export const DND5E_HALLUCINATORY_TERRAIN_APPEARANCES = [
  'swamp',
  'hill',
  'crevasse',
  'meadow',
  'gentle-slope',
  'road',
  'other-natural-terrain',
] as const

export type Dnd5eHallucinatoryTerrainAppearance =
  typeof DND5E_HALLUCINATORY_TERRAIN_APPEARANCES[number]

/** Closed appearance declaration retained by a Hallucinatory Terrain area. */
export interface Dnd5eHallucinatoryTerrainAreaState {
  appearance: Dnd5eHallucinatoryTerrainAppearance
}

export const DND5E_PROGRAMMED_ILLUSION_FORMS = [
  'object',
  'creature',
  'visible-phenomenon',
] as const

export type Dnd5eProgrammedIllusionForm = typeof DND5E_PROGRAMMED_ILLUSION_FORMS[number]

export const DND5E_PROGRAMMED_ILLUSION_TRIGGER_SENSES = [
  'visual',
  'auditory',
  'visual-or-auditory',
] as const

export type Dnd5eProgrammedIllusionTriggerSense =
  typeof DND5E_PROGRAMMED_ILLUSION_TRIGGER_SENSES[number]

/** Closed parts of Programmed Illusion's declaration retained by its map area. */
export interface Dnd5eProgrammedIllusionAreaState {
  form: Dnd5eProgrammedIllusionForm
  triggerSense: Dnd5eProgrammedIllusionTriggerSense
}

export interface Dnd5ePluginEffectDuration {
  expiresAt: 'source-next-turn-start' | 'source-turn-end' | 'target-next-turn-start' | 'target-turn-end' | 'target-turn-end-save' | 'permanent'
  remainingRounds?: number
  includeCreationTurn?: boolean
  saveAbility?: AbilityKey
  saveDc?: number
}

export type Dnd5ePersistentAreaTriggerTiming =
  | 'on-create'
  | 'on-enter'
  | 'on-move-distance'
  | 'on-area-move-impact'
  | 'turn-start'
  | 'turn-end'
  /** Resolves against all eligible occupants when the area's source starts a turn. */
  | 'source-turn-start'
  | 'source-turn-end'
  /** Resolves against all eligible occupants when an entitled Activity detonates the area. */
  | 'on-detonate'

export type Dnd5ePersistentAreaSourceKind = 'plugin-feature' | 'core-spell'
export type Dnd5ePersistentAreaAnchorMode = 'fixed' | 'source-token' | 'target-token' | 'effect-token'

export interface Dnd5ePersistentAreaObscuration {
  kind: 'light' | 'heavy'
  /** Conceals only the source creature, without blocking rays through the area. */
  scope?: 'source-token'
  /** Some monster-created clouds explicitly exempt their source from obscuration. */
  sourceCanSeeThrough?: boolean
}

/** Host-owned environmental rules projected onto creatures occupying an area. */
export interface Dnd5ePersistentAreaOccupantModifiers {
  /** Limit continuous benefits independently from the initial chosen recipients. */
  relation?: 'ally' | 'enemy' | 'any'
  savingThrowAdvantages?: readonly AbilityKey[]
  /** Context-qualified checks while occupying the area. */
  abilityCheckRules?: readonly Dnd5eAbilityCheckRule[]
  /** Independent spherical check radius from the area anchor/volume center. */
  abilityCheckRadiusFeet?: number
  /** Applies only to falling damage when the final landing point occupies this volume. */
  halvesFallingDamage?: boolean
  /** Additive high-jump height, not a long-jump or movement-speed bonus. */
  verticalJumpBonusFeet?: number
  /** Flat bonuses scoped to current occupants; same feature instances do not stack. */
  skillCheckBonuses?: Readonly<Record<string, number>>
  /** Total cover between the fixed area anchor and occupant blocks these modifiers. */
  requiresLineOfEffectFromAnchor?: true
  /** Standard conditions projected only while occupying this area; not timed entry riders. */
  conditions?: readonly Dnd5eStandardConditionId[]
  /** `fully-contained` is used by effects such as Silence; the default is any overlap. */
  containment?: 'intersects' | 'fully-contained'
  preventsVerbalComponents?: boolean
  /** Suppresses spellcasting and magical ActiveEffects while the creature occupies the area. */
  suppressesMagic?: boolean
  /** Blocks spells at or below this base spell level when cast across the area's boundary. */
  suppressesSpellsThroughLevel?: number
  damageImmunities?: readonly Dnd5eDamageType[]
  damageResistances?: readonly Dnd5eDamageType[]
  damageVulnerabilities?: readonly Dnd5eDamageType[]
  conditionImmunities?: readonly Dnd5eStandardConditionId[]
  /** Incoming attacks from these Host-canonical creature types have disadvantage. */
  attacksAgainstOccupantDisadvantageCreatureTypes?: readonly string[]
  /** Source-qualified condition immunity projected only while occupying the area. */
  conditionImmunitiesBySourceCreatureType?: readonly {
    conditions: readonly string[]
    sourceCreatureTypes: readonly string[]
  }[]
  /** Source-qualified save advantage. `any` matches saves without a condition payload. */
  savingThrowAdvantagesBySourceCreatureType?: readonly {
    conditions: readonly string[]
    sourceCreatureTypes: readonly string[]
  }[]
  /** Advantage on saving throws against spells while occupying the area. */
  spellSavingThrowAdvantage?: boolean
  /** Host-enforced immunity to being selected by spells from these schools. */
  spellTargetingImmunitySchools?: readonly import('./spellbook').Dnd5eSpellbookSchoolId[]
  /** Evasion-style suppression of half damage after a successful spell save. */
  successfulSpellSaveNegatesDamage?: boolean
  hitPointMaximumReductionImmunity?: boolean
  /** Keeps unsupported occupants airborne until they leave or the area ends. */
  magicallyHeldAloft?: boolean
  /** Severe environmental wind makes ranged weapon attacks impossible. */
  preventsRangedWeaponAttacks?: boolean
  /** Environmental distraction imposes disadvantage on damage-triggered concentration saves. */
  concentrationSavingThrowDisadvantage?: boolean
  /** Bounded language projection used by environmental effects such as Hallow. */
  languageCapabilities?: {
    understandSpoken?: 'all'
    speechUnderstoodBy?: 'any-creature-knowing-a-language'
  }
}

/** Extra movement spent per foot against the selected planar area orientation. */
export interface Dnd5ePersistentAreaDirectionalMovementDeclaration {
  direction: 'area-orientation'
  additionalFeetPerFoot: number
}

/** Host snapshot; independent of the caster's later position. */
export interface Dnd5ePersistentAreaDirectionalMovementCost {
  direction: { dc: number; dr: number }
  additionalFeetPerFoot: number
}

export function normalizeDnd5eDirectionalMovementDeclaration(value: unknown): Dnd5ePersistentAreaDirectionalMovementDeclaration | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (Object.keys(raw).some(key => !['direction', 'additionalFeetPerFoot'].includes(key)) ||
    raw.direction !== 'area-orientation' || typeof raw.additionalFeetPerFoot !== 'number' ||
    !Number.isFinite(raw.additionalFeetPerFoot) || raw.additionalFeetPerFoot <= 0 || raw.additionalFeetPerFoot > 10) return undefined
  return { direction: 'area-orientation', additionalFeetPerFoot: raw.additionalFeetPerFoot }
}

export function normalizeDnd5eDirectionalMovementCost(value: unknown): Dnd5ePersistentAreaDirectionalMovementCost | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>, direction = raw.direction as Record<string, unknown> | undefined
  if (Object.keys(raw).some(key => !['direction', 'additionalFeetPerFoot'].includes(key)) ||
    !direction || typeof direction !== 'object' || Array.isArray(direction) ||
    Object.keys(direction).some(key => !['dc', 'dr'].includes(key)) ||
    typeof direction.dc !== 'number' || typeof direction.dr !== 'number' ||
    !Number.isFinite(direction.dc) || !Number.isFinite(direction.dr) ||
    Math.abs(Math.hypot(direction.dc, direction.dr) - 1) > 1e-6 ||
    typeof raw.additionalFeetPerFoot !== 'number' || !Number.isFinite(raw.additionalFeetPerFoot) ||
    raw.additionalFeetPerFoot <= 0 || raw.additionalFeetPerFoot > 10) return undefined
  return { direction: { dc: direction.dc, dr: direction.dr }, additionalFeetPerFoot: raw.additionalFeetPerFoot }
}

/** Closed mechanical profiles; selecting another profile replaces these fields. */
export interface Dnd5ePersistentAreaModeDeclaration {
  id: string
  label?: string
  blocking?: Dnd5ePersistentAreaBlocking
  movementCostMultiplier?: number
  directionalMovementCost?: Dnd5ePersistentAreaDirectionalMovementDeclaration
  occupantModifiers?: Dnd5ePersistentAreaOccupantModifiers
  obscuration?: Dnd5ePersistentAreaObscuration
  triggers?: readonly Dnd5ePersistentAreaTriggerDeclaration[]
}

export interface Dnd5ePersistentAreaModeSnapshot extends Omit<Dnd5ePersistentAreaModeDeclaration, 'directionalMovementCost' | 'triggers'> {
  directionalMovementCost?: Dnd5ePersistentAreaDirectionalMovementCost
  triggers?: readonly Dnd5ePersistentAreaTriggerSnapshot[]
}

export interface Dnd5ePersistentAreaModeState {
  profiles: readonly Dnd5ePersistentAreaModeSnapshot[]
  selectedModeId: string
  paused: boolean
  changeReceipts: readonly string[]
}

/** Bounded physical geometry supplied by a persistent-area entity. */
export interface Dnd5ePersistentAreaBlocking {
  /** Damage of these types is halved when its effect path passes through this volume. */
  halvedDamageTypes?: readonly Dnd5eDamageType[]
  freezesOnColdSpell?: true
  /** Weapon attack rays touching this volume or crossing its boundary have disadvantage. */
  rangedWeaponAttackDisadvantage?: 'occupancy' | 'boundary'
  restrictedTokenIds?:readonly string[]
  /** Exit wards require the entire creature footprint and height to remain inside. */
  containEntireTokenOnExit?: boolean
  protectsOccupantsFromRestrictedTokens?:boolean
  /** Treat mapped walls/doors/obstacles covered by this volume as an open passage. */
  suppressesMappedBarriers?: true
  movement?: boolean
  /**
   * `occupancy` preserves wall-like blocking. Directional modes block only
   * crossing the area's boundary and therefore support reusable wards such as
   * "cannot enter" without trapping a creature that already starts inside.
   */
  movementMode?: 'occupancy' | 'enter' | 'exit' | 'boundary'
  includedCreatureTypes?: readonly string[]
  excludedCreatureTypes?: readonly string[]
  excludeSourceToken?: boolean
  /**
   * Only Token ids captured by the Host when the area is created may cross an
   * entry boundary. Content requests the policy; the map handoff owns the ids.
   */
  entryPermission?: 'occupants-at-creation'
  authorizedTokenIds?: readonly string[]
  /** Prevents teleportation crossing into or out of this area boundary. */
  blocksTeleportationEntry?: boolean
  blocksTeleportationExit?: boolean
  /** Optional saving throw that allows teleportation across an exit ward. */
  teleportationExitSavingThrow?: { ability: AbilityKey; dc: number }
  /** `boundary` permits effects within either side but never across the edge. */
  lineOfEffectMode?: 'occupancy' | 'boundary'
  /** Outside viewers cannot see through the area; inside viewers can see out. */
  visionMode?: 'occupancy' | 'outside-in'
  vision?: boolean
  lineOfEffect?: boolean
}

export type Dnd5ePersistentAreaVerticalSnapshot =
  | { mode: 'ground' }
  | {
      mode: 'volume'
      baseElevationFeet: number
      heightFeet: number
      anchorOffsetFeet?: number
      /** Sphere diameter is heightFeet; its center is halfway above the base. */
      shape?: 'sphere'
      /** Absolute ground-following bands; each column belongs to this same effect. */
      columns?: { col: number; row: number; baseElevationFeet: number; heightFeet: number }[]
    }

export interface Dnd5ePersistentAreaSurfaceCloud {
  materials: readonly ('sand' | 'dust' | 'loose-earth' | 'gravel')[]
  radiusFeet: number
}
export function validDnd5ePersistentAreaSurfaceCloud(value: unknown): value is Dnd5ePersistentAreaSurfaceCloud {
  const cloud = record(value)
  return !!cloud && Object.keys(cloud).every(key=>key==='materials'||key==='radiusFeet') &&
    integer(cloud.radiusFeet,1,100) && Array.isArray(cloud.materials) && cloud.materials.length>0 && cloud.materials.length<=4 &&
    cloud.materials.every(material=>['sand','dust','loose-earth','gravel'].includes(String(material))) &&
    new Set(cloud.materials).size===cloud.materials.length
}
export interface Dnd5ePersistentAreaMovementDeclaration {
  /** The source must perceive the destination point when commanding movement. */
  requiresVisibleDestination?: true
  /** Raise a following obscuring cloud until the next source turn starts. */
  surfaceCloud?: Dnd5ePersistentAreaSurfaceCloud
  /** Preserve absolute volume altitude and allow explicit vertical destinations. */
  allowVertical?: true
  /** Maximum commanded bottom clearance over the destination terrain. */
  maximumBottomHeightAboveGroundFeet?: number
  /** Mandatory safe drops during horizontal commands; requires a maximum clearance. */
  descendOverLowerGround?: true
  /** Command movement carries creatures restrained by this exact area instance. */
  carryRestrainedTargets?: true
  /** Capture explicitly unsecured, unattended objects up to this size rank (0..5). */
  collectObjectsMaximumSizeRank?: number
  /** `none` is used by rule-mandated movement chosen at a turn boundary. */
  economy: 'action' | 'bonus-action' | 'none'
  maximumFeet: number
  /** A moving effect may clear mapped barriers whose top is no higher than this above its path. */
  maximumBarrierHeightFeet?: number
  /** A moving effect may cross, but may not finish inside, a terrain gap no wider than this. */
  maximumGapWidthFeet?: number
  /** Source must be within this distance of the current volume before issuing a move; no destination tether. */
  maximumSourceDistanceBeforeMoveFeet?: number
  /** Optional tether to the source token, checked again after every move. */
  maximumDistanceFromSourceFeet?: number
  /** The effect ends after the command instead of rejecting an over-tether destination. */
  endWhenExceedingSourceDistance?: boolean
}

/** Host-owned follower rules for an independent area/effect token. */
export interface Dnd5ePersistentAreaSourceFollower {
  stationaryWithinFeet: number
  maximumSeparationFeet: number
  maximumStepHeightFeet?: number
  carryingCapacityPounds?: number
}

/**
 * Closed turn-boundary evolution for an authoritative map area. This is used
 * by moving hazards such as a wave, but remains content-neutral so Workshop
 * rules can reuse the same Host-owned translation and scaling transaction.
 */
export interface Dnd5ePersistentAreaTurnLifecycle {
  timing: 'source-turn-start' | 'source-turn-end'
  expireAfterAdvances?: number
  /** Some effects, such as Delayed Blast Fireball, advance at the end of the turn that created them. */
  advanceOnCreationRound?: boolean
  /** Stop mutating the area after this many completed lifecycle advances. */
  maximumAdvances?: number
  /** Move the complete occupied-cell snapshot directly away from its source. */
  translateAwayFromSourceFeet?: number
  /** Reduce the authoritative vertical volume after each translation. */
  heightReductionFeet?: number
  /** Apply this delta to the named trigger damage dice after each advance. */
  damageDiceCountDelta?: number
  damageTriggerIds?: readonly string[]
  minimumDamageDiceCount?: number
  /** Declarative property transitions keyed by completed source-turn advances. */
  stages?: readonly {
    atAdvance: number
    movementCostMultiplier?: number
    obscuration?: Dnd5ePersistentAreaObscuration
    occupantModifiers?: Dnd5ePersistentAreaOccupantModifiers
    /** Strong wind at this stage removes overlapping fog, mist, and similar core spell areas. */
    dispersesFogAndMist?: boolean
  }[]
}

export interface Dnd5ePersistentAreaDamageDeclaration {
  count: number
  sides: number
  modifier?: number
  modifierFormula?: import('./workshopDamageFormula').Dnd5eWorkshopDamageFormulaV1
  type: Dnd5eDamageType
}

/**
 * A data-only rider projected from the current occupants of a persistent area.
 * It is intentionally narrower than an arbitrary on-hit callback: the Host
 * owns target membership, attack eligibility, dice, critical doubling and
 * damage defenses on every weapon hit.
 */
export interface Dnd5ePersistentAreaWeaponHitBonusDamage {
  count: number
  sides: number
  bonus?: number
  type: Dnd5eDamageType
  magical?: boolean
}

/**
 * An active Activity made available only while the owning map area exists.
 * The area is an entitlement token, not an executable callback: the Host still
 * reloads the registered Activity, validates ownership/economy/targets and rolls.
 */
export interface Dnd5ePersistentAreaGrantedActivity {
  activityId: string
  /** Optional map-facing label; the Activity name remains the rules identity. */
  label?: string
  /** Prompt the same target workflow after the area is first committed. */
  activateOnCreate?: boolean
  /** Restrict the free initial control to the Host creation turn (six seconds outside combat). */
  activationWindow?: 'creation-turn'
  /** A successful invocation replaces this area's previously bound restraints, including on other maps. */
  releaseBoundEffects?: true
}

export interface Dnd5ePersistentAreaSaveDeclaration {
  ability: AbilityKey
  dc: number | 'source-save-dc'
  onSuccess: 'none' | 'half'
  /** Only the target's controller may opt out of rolling where the rule explicitly permits it. */
  allowWillingFailure?: boolean
  /** The saving throw is against a magical effect, so Magic Resistance applies. */
  magical?: boolean
  /** 核心规则扩展：变形生物进行此豁免时具有劣势。 */
  shapechangerDisadvantage?: boolean
  /** 核心规则扩展：变形生物豁免失败时恢复原形。 */
  revertShapechangerOnFailure?: boolean
  /** Creatures with an authoritative swim speed roll this save with advantage. */
  advantageIfTargetHasSwimSpeed?: boolean
  /** Damage immunity may make the environmental saving throw automatically succeed. */
  automaticSuccessForDamageImmunity?: Dnd5eDamageType
  /** Inclusive Host size rank threshold; e.g. 4 for Huge or larger. */
  automaticSuccessMinimumSizeRank?: number
}

export function dnd5ePersistentAreaSizeSaveSucceeds(
  save: Dnd5ePersistentAreaSaveDeclaration | undefined,
  sizeRank: number | undefined,
): boolean {
  return save?.automaticSuccessMinimumSizeRank != null &&
    Number.isInteger(save.automaticSuccessMinimumSizeRank) &&
    save.automaticSuccessMinimumSizeRank >= 0 && save.automaticSuccessMinimumSizeRank <= 5 &&
    Number.isInteger(sizeRank) && sizeRank! <= 5 && sizeRank! >= save.automaticSuccessMinimumSizeRank
}

export interface Dnd5ePersistentAreaConditionDeclaration {
  /** Independent attackable restraint; destroying it releases only its captive. */
  destructibleRestraint?: { label:string; armorClass:number; hitPoints:number }
  /** Restraint magically holds the creature at this height above its ground surface. */
  suspendAboveGroundFeet?: number
  /** A creature in reach may spend its action to free the affected creature. */
  removalAction?: Dnd5ePersistentAreaRemovalActionDeclaration
  /** Bind fear's spatial source and conditional repeat save to the independent area entity. */
  fearSourceIsAnchor?: true
  condition: Dnd5eStandardConditionId
  /** True binds restraints to the area. False keeps the declared duration independent
   * of source concentration. Omitted preserves legacy concentration inheritance. */
  endsWithArea?: boolean
  /** On a successful repeat save, atomically place the released creature outside this area. */
  ejectOnSuccessfulRepeatSave?: true
  /** Escape success flings the captive in a Host-rolled d8 compass direction. */
  escapeEjection?: { count: number; sides: number; feetPerPoint: number }
  /** Apply prone only when the owning area ends, not when this condition is escaped. */
  proneOnAreaEnd?: true
  /** The area carries its captives down before releasing them, without falling damage. */
  groundOnAreaEnd?: true
  duration: Omit<Dnd5ePluginEffectDuration, 'saveDc'> & { saveDc?: number | 'source-save-dc' }
  /** Extra bounded mechanics carried by the same authoritative condition instance. */
  modifiers?: Pick<
    import('./activeEffects').Dnd5eActiveEffectModifiers,
    'actionOrBonusActionOnly' | 'preventReactions' | 'magicallyHeldAloft' | 'submerged'
  >
  escapeCheck?: {
    ability: AbilityKey
    skill?: 'athletics' | 'acrobatics'
    alternativeAbility?: AbilityKey
    dc: number | 'source-save-dc'
    economy: 'action'
  }
}

/**
 * Declarative only: plugins cannot execute callbacks when an area is triggered.
 * The Host owns dice, saves, damage adjustment, ActiveEffect creation and receipts.
 */
export interface Dnd5ePersistentAreaTriggerDeclaration {
  /** At the captive's turn start, lift this area's bound restraint up to its volume ceiling. */
  boundRestraintRiseFeet?: number
  /** Turn-boundary reach beyond the area's occupied cells; does not enlarge its body. */
  proximityFeet?: number
  /** Use explicitly mapped objects inside the area as proximity origins. */
  proximityObjectKind?: 'tree' | 'undergrowth' | 'rock'
  targetRelation?: 'ally' | 'enemy' | 'any'
  /** Capacity admission after this trigger successfully applies its restrained condition. */
  capacity?: Dnd5ePersistentAreaCapacityDeclaration
  id: string
  /** 不同触发时机可共享同一频率组，实现“首次进入或回合开始，每回合仅一次”。 */
  frequencyGroupId?: string
  label: string
  timing: Dnd5ePersistentAreaTriggerTiming
  /** Inclusive lifecycle stage bounds. Cast-time is 0; first source-turn advance is 1. */
  minimumLifecycleAdvances?: number
  maximumLifecycleAdvances?: number
  oncePerRound?: boolean
  /** 同一目标在每个生物回合内最多触发一次；用于“每回合首次进入/开始”语义。 */
  oncePerTurn?: boolean
  /** 同一目标在区域完整生命周期内最多触发一次。 */
  oncePerTarget?: boolean
  /** Host-captured cast-time exemptions; clients cannot mutate this list after area creation. */
  excludedTokenIds?: readonly string[]
  /** Total number of successful trigger transactions allowed for the area. */
  maximumTotalUses?: number
  /** Shared target budget for one source turn, replenished at the next distinct turn key. */
  maximumTargetsPerTurn?: number
  /** After a committed trigger, end the area when none of its bound conditions remain. */
  endAreaWhenNoBoundConditions?: true
  /**
   * The area source must explicitly choose which eligible occupants receive
   * this trigger. The Host captures the choices before settling any target so
   * a bounded multi-target wave cannot silently use map/token iteration order.
   */
  sourceChoosesTargets?: boolean
  /** Eligible creature targets. Durable map objects are never spell-automated. */
  targetKinds?: readonly ('creature' | 'object')[]
  /** Allowed authoritative creature size ranks (Tiny=0 through Gargantuan=5). */
  targetSizeRanks?: readonly number[]
  includedCreatureTypes?: readonly string[]
  excludedCreatureTypes?: readonly string[]
  /** Requires Host provenance of a spell summon created by the area source. */
  requiresSourceSpellSummon?: true
  /** Requires live flight capability and a bottom above the local terrain surface. */
  requiresTargetFlying?: true
  /** Only a creature touching its actual terrain surface may trigger this area. */
  requiresTargetGrounded?: true
  /** Other targets must be visible to the area source at the instant of triggering. */
  requiresSourceVision?: boolean
  /** On creation, consider all eligible observers who can see the linked entity, regardless of occupied cells. */
  targetSeesAnchorOnCreate?: true
  /** Physical effect path from the current source token; independent of visibility. */
  requiresSourceLineOfEffect?: boolean
  /** Physical effect path from the saved area anchor, independent of the caster. */
  requiresAnchorLineOfEffect?: boolean
  sourceMayDecline?: boolean
  /** Remove the owning area after this frequency group has actually dealt this much damage. */
  maximumTotalDamage?: number
  /** `on-move-distance` 每累计多少尺触发一次；由 Host 根据完整移动路径计数。 */
  movementIntervalFeet?: number
  savingThrow?: Dnd5ePersistentAreaSaveDeclaration
  /** After a failed primary save, this separate save gates only the condition. */
  conditionSavingThrow?: Dnd5ePersistentAreaSaveDeclaration
  /**
   * 目标已带有同一来源的指定状态时跳过本次豁免。
   * 用于黑触手这类“已被本法术束缚者在回合开始自动受伤”的规则。
   */
  skipSaveWhenSourceConditionActive?: Dnd5eStandardConditionId
  damage?: Dnd5ePersistentAreaDamageDeclaration
  healing?: { amount: number; dice?: { count: number; sides: number }; onlyIfAtZero?: boolean }
  condition?: Dnd5ePersistentAreaConditionDeclaration
  /**
   * Data-only alert emitted by the Host when this trigger resolves. Mental
   * notifications are addressed to the area source; audible notifications
   * carry a bounded hearing radius for presentation/audibility consumers.
   */
  notification?:
    | { delivery: 'mental-to-source'; message?: string }
    | { delivery: 'audible'; audibleRadiusFeet: number; message?: string }
  /** On a failed save, consume the target's action for the current turn. */
  consumeActionOnFailedSave?: boolean
  /** Removable levels gained only on a failed save, bound to this exact area instance. */
  exhaustionOnFailedSave?: { levels: number; endsWithArea: true }
  visibilityOnFailedSave?: { dimRadiusFeet:number; color:string; suppressInvisibilityBenefits:true; endsWithArea:true }
  /** On a failed Constitution save, end any spell or feature the target is concentrating on. */
  endTargetConcentrationOnFailedSave?: boolean
  /** Host moves the affected token after the trigger's save is settled. */
  forcedMovement?: {
    mode: 'push-from-source' | 'push-from-area-anchor' | 'pull-to-area-anchor'
    distanceFeet: number
    appliesOn: 'failed-save' | 'successful-save' | 'always'
  } | {
    mode: 'push-fixed-direction'
    direction: { dc: number; dr: number }
    distanceFeet: number
    appliesOn: 'failed-save' | 'successful-save' | 'always'
  } | {
    /** Move the entire footprint into the nearest reachable free space outside this area. */
    mode: 'nearest-outside-area'
    /** Destination footprint must be within this distance of the area's cells. */
    maximumOutsideDistanceFeet?: number
    appliesOn: 'failed-save' | 'successful-save' | 'always'
  }
  /** Pause before commit so the DM may adjust the proposed save, damage or condition. */
  dmAdjustable?: boolean
}

export interface Dnd5ePersistentAreaTriggerSnapshot extends Omit<Dnd5ePersistentAreaTriggerDeclaration, 'savingThrow' | 'conditionSavingThrow' | 'condition'> {
  savingThrow?: Omit<Dnd5ePersistentAreaSaveDeclaration, 'dc'> & { dc: number }
  conditionSavingThrow?: Omit<Dnd5ePersistentAreaSaveDeclaration, 'dc'> & { dc: number }
  condition?: Omit<Dnd5ePersistentAreaConditionDeclaration, 'duration' | 'escapeCheck' | 'removalAction'> & {
    removalAction?: Dnd5ePersistentAreaRemovalAction
    duration: Dnd5ePluginEffectDuration
    escapeCheck?: Omit<NonNullable<Dnd5ePersistentAreaConditionDeclaration['escapeCheck']>, 'dc'> & { dc: number }
  }
  /** 核心法术可为单个触发器限定权威触发格；缺省使用区域本体格。 */
  cells?: readonly GridCell[]
}

export interface Dnd5ePersistentAreaTriggerReceipt {
  triggerId: string
  targetTokenId: string
  round: number
  /** `${round}:${activeTokenId}`；旧存档可缺省并按 once-per-round 兼容。 */
  turnKey?: string
  transactionId: string
  /** Authoritative HP damage committed by this trigger transaction. */
  damage?: number
  /** Save gate retained by Hallow until this target leaves the area. */
  savingThrowSucceeded?: boolean
  declined?: boolean
}

const ABILITIES: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const TIMINGS: readonly Dnd5ePersistentAreaTriggerTiming[] = [
  'on-create', 'on-enter', 'on-move-distance', 'on-area-move-impact', 'turn-start', 'turn-end', 'source-turn-start', 'source-turn-end', 'on-detonate',
]
const EXPIRATIONS: readonly Dnd5ePluginEffectDuration['expiresAt'][] = [
  'source-next-turn-start', 'source-turn-end', 'target-next-turn-start', 'target-turn-end', 'target-turn-end-save', 'permanent',
]

export function normalizeDnd5ePersistentAreaTurnLifecycle(
  value: unknown,
): Dnd5ePersistentAreaTurnLifecycle | undefined {
  const lifecycle = record(value)
  if (!lifecycle || (lifecycle.timing !== 'source-turn-start' && lifecycle.timing !== 'source-turn-end')) return undefined
  const allowed = new Set([
    'timing', 'translateAwayFromSourceFeet', 'heightReductionFeet',
    'advanceOnCreationRound', 'maximumAdvances', 'expireAfterAdvances',
    'damageDiceCountDelta', 'damageTriggerIds', 'minimumDamageDiceCount', 'stages',
  ])
  if (Object.keys(lifecycle).some((key) => !allowed.has(key))) return undefined
  if (
    lifecycle.advanceOnCreationRound != null &&
    typeof lifecycle.advanceOnCreationRound !== 'boolean'
  ) return undefined
  if (lifecycle.expireAfterAdvances != null && !integer(lifecycle.expireAfterAdvances,1,14_400)) return undefined
  if (lifecycle.maximumAdvances != null && !integer(lifecycle.maximumAdvances, 1, 14_400)) {
    return undefined
  }
  if (
    lifecycle.translateAwayFromSourceFeet != null &&
    !integer(lifecycle.translateAwayFromSourceFeet, 1, 10_000)
  ) return undefined
  if (lifecycle.heightReductionFeet != null && !integer(lifecycle.heightReductionFeet, 1, 10_000)) {
    return undefined
  }
  if (
    lifecycle.damageDiceCountDelta != null &&
    (!Number.isInteger(lifecycle.damageDiceCountDelta) || Number(lifecycle.damageDiceCountDelta) < -40 || Number(lifecycle.damageDiceCountDelta) > 40 || Number(lifecycle.damageDiceCountDelta) === 0)
  ) return undefined
  const damageTriggerIds = lifecycle.damageTriggerIds == null
    ? undefined
    : Array.isArray(lifecycle.damageTriggerIds) && lifecycle.damageTriggerIds.length > 0 &&
      lifecycle.damageTriggerIds.length <= 32 && lifecycle.damageTriggerIds.every((id) =>
        typeof id === 'string' && /^[a-z0-9][a-z0-9._-]*$/.test(id)) &&
      new Set(lifecycle.damageTriggerIds).size === lifecycle.damageTriggerIds.length
      ? [...lifecycle.damageTriggerIds] as string[]
      : null
  if (damageTriggerIds === null) return undefined
  if (
    lifecycle.minimumDamageDiceCount != null &&
    !integer(lifecycle.minimumDamageDiceCount, 0, 40)
  ) return undefined
  if (
    lifecycle.expireAfterAdvances == null &&
    lifecycle.translateAwayFromSourceFeet == null &&
    lifecycle.heightReductionFeet == null &&
    lifecycle.damageDiceCountDelta == null &&
    lifecycle.stages == null
  ) return undefined
  if (lifecycle.damageDiceCountDelta != null && !damageTriggerIds?.length) return undefined
  const stages = lifecycle.stages == null
    ? undefined
    : Array.isArray(lifecycle.stages) && lifecycle.stages.length > 0 && lifecycle.stages.length <= 32
      ? lifecycle.stages.flatMap((value) => {
          const stage = record(value)
          if (!stage || Object.keys(stage).some((key) => ![
            'atAdvance', 'movementCostMultiplier', 'obscuration', 'occupantModifiers', 'dispersesFogAndMist',
          ].includes(key))) return []
          if (!integer(stage.atAdvance, 1, 14_400)) return []
          if (stage.movementCostMultiplier != null && (
            typeof stage.movementCostMultiplier !== 'number' || !Number.isFinite(stage.movementCostMultiplier) ||
            Number(stage.movementCostMultiplier) < 1 || Number(stage.movementCostMultiplier) > 100
          )) return []
          const rawObscuration = record(stage.obscuration)
          const obscuration = rawObscuration &&
            Object.keys(rawObscuration).every((key) => key === 'kind' || key === 'sourceCanSeeThrough' || key === 'scope') &&
            (rawObscuration.scope == null || rawObscuration.scope === 'source-token') &&
            (rawObscuration.kind === 'light' || rawObscuration.kind === 'heavy') &&
            (rawObscuration.sourceCanSeeThrough == null || typeof rawObscuration.sourceCanSeeThrough === 'boolean')
            ? {
                kind: rawObscuration.kind as 'light' | 'heavy',
                sourceCanSeeThrough: rawObscuration.sourceCanSeeThrough === true ? true : undefined,
                ...(rawObscuration.scope === 'source-token' ? { scope: 'source-token' as const } : {}),
              }
            : undefined
          if (stage.obscuration != null && !obscuration) return []
          const occupantModifiers = stage.occupantModifiers == null
            ? undefined
            : normalizeDnd5ePersistentAreaOccupantModifiers(stage.occupantModifiers)
          if (stage.occupantModifiers != null && !occupantModifiers) return []
          const dispersesFogAndMist = stage.dispersesFogAndMist === true
          if (stage.dispersesFogAndMist != null && typeof stage.dispersesFogAndMist !== 'boolean') return []
          if (stage.movementCostMultiplier == null && !obscuration && !occupantModifiers && !dispersesFogAndMist) return []
          return [{
            atAdvance: Number(stage.atAdvance),
            movementCostMultiplier: stage.movementCostMultiplier as number | undefined,
            obscuration,
            occupantModifiers,
            dispersesFogAndMist: dispersesFogAndMist ? true : undefined,
          }]
        })
      : []
  if (lifecycle.stages != null && (
    !Array.isArray(lifecycle.stages) || stages?.length !== lifecycle.stages.length ||
    new Set(stages.map((stage) => stage.atAdvance)).size !== stages.length
  )) return undefined
  return {
    timing: lifecycle.timing,
    expireAfterAdvances: lifecycle.expireAfterAdvances as number | undefined,
    advanceOnCreationRound: lifecycle.advanceOnCreationRound === true ? true : undefined,
    maximumAdvances: lifecycle.maximumAdvances as number | undefined,
    translateAwayFromSourceFeet: lifecycle.translateAwayFromSourceFeet as number | undefined,
    heightReductionFeet: lifecycle.heightReductionFeet as number | undefined,
    damageDiceCountDelta: lifecycle.damageDiceCountDelta as number | undefined,
    damageTriggerIds,
    minimumDamageDiceCount: lifecycle.minimumDamageDiceCount as number | undefined,
    stages,
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function integer(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max
}

export function normalizeDnd5ePersistentAreaWeaponHitBonusDamage(
  value: unknown,
): Dnd5ePersistentAreaWeaponHitBonusDamage | undefined {
  const damage = record(value)
  if (
    !damage ||
    Object.keys(damage).some((key) => !['count', 'sides', 'bonus', 'type', 'magical'].includes(key)) ||
    !integer(damage.count, 1, 40) ||
    !integer(damage.sides, 2, 100) ||
    !integer(damage.bonus ?? 0, -1_000, 1_000) ||
    !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(damage.type) ||
    (damage.magical != null && typeof damage.magical !== 'boolean')
  ) return undefined
  return {
    count: Number(damage.count),
    sides: Number(damage.sides),
    bonus: Number(damage.bonus ?? 0),
    type: damage.type as Dnd5eDamageType,
    magical: damage.magical === true,
  }
}

export function normalizeDnd5ePersistentAreaOccupantModifiers(
  value: unknown,
): Dnd5ePersistentAreaOccupantModifiers | undefined {
  const modifiers = record(value)
  if (!modifiers || Object.keys(modifiers).some((key) => ![
    'relation', 'savingThrowAdvantages', 'abilityCheckRules', 'abilityCheckRadiusFeet', 'halvesFallingDamage', 'verticalJumpBonusFeet', 'skillCheckBonuses', 'requiresLineOfEffectFromAnchor',
    'containment', 'preventsVerbalComponents', 'suppressesMagic', 'suppressesSpellsThroughLevel', 'damageImmunities', 'damageResistances',
    'damageVulnerabilities',
    'conditions', 'conditionImmunities', 'attacksAgainstOccupantDisadvantageCreatureTypes',
    'conditionImmunitiesBySourceCreatureType', 'savingThrowAdvantagesBySourceCreatureType',
    'spellSavingThrowAdvantage', 'spellTargetingImmunitySchools',
    'successfulSpellSaveNegatesDamage', 'hitPointMaximumReductionImmunity', 'magicallyHeldAloft',
    'preventsRangedWeaponAttacks', 'concentrationSavingThrowDisadvantage', 'languageCapabilities',
  ].includes(key))) return undefined
  if (modifiers.relation != null && !['ally', 'enemy', 'any'].includes(String(modifiers.relation))) return undefined
  const savingThrowAdvantages = modifiers.savingThrowAdvantages
  if (savingThrowAdvantages != null && (!Array.isArray(savingThrowAdvantages) || !savingThrowAdvantages.length ||
    savingThrowAdvantages.some(value => !['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(value)))) return undefined
  const abilityCheckRules = modifiers.abilityCheckRules == null ? undefined : normalizeDnd5eAbilityCheckRules(modifiers.abilityCheckRules)
  if (modifiers.abilityCheckRules != null && (!abilityCheckRules || !abilityCheckRules.length)) return undefined
  if (modifiers.abilityCheckRadiusFeet != null && (!abilityCheckRules || !Number.isFinite(modifiers.abilityCheckRadiusFeet) || Number(modifiers.abilityCheckRadiusFeet) <= 0 || Number(modifiers.abilityCheckRadiusFeet) > 1000)) return undefined
  const skillCheckBonuses = modifiers.skillCheckBonuses == null ? undefined : record(modifiers.skillCheckBonuses)
  if (modifiers.skillCheckBonuses != null && (!skillCheckBonuses || Object.keys(skillCheckBonuses).length === 0 ||
    Object.entries(skillCheckBonuses).some(([skill, bonus]) => !SKILLS.some(entry => entry.key === skill) ||
      !Number.isInteger(bonus) || Number(bonus) < 1 || Number(bonus) > 30))) return undefined
  if (modifiers.requiresLineOfEffectFromAnchor != null && modifiers.requiresLineOfEffectFromAnchor !== true) return undefined
  const containment = modifiers.containment ?? 'intersects'
  if (containment !== 'intersects' && containment !== 'fully-contained') return undefined
  if (modifiers.preventsVerbalComponents != null && typeof modifiers.preventsVerbalComponents !== 'boolean') {
    return undefined
  }
  if (modifiers.suppressesMagic != null && typeof modifiers.suppressesMagic !== 'boolean') return undefined
  if (
    modifiers.suppressesSpellsThroughLevel != null &&
    (!Number.isInteger(modifiers.suppressesSpellsThroughLevel) ||
      Number(modifiers.suppressesSpellsThroughLevel) < 0 ||
      Number(modifiers.suppressesSpellsThroughLevel) > 9)
  ) return undefined
  const damageImmunities = modifiers.damageImmunities == null
    ? []
    : Array.isArray(modifiers.damageImmunities)
      ? [...new Set(modifiers.damageImmunities)]
      : []
  if (
    modifiers.damageImmunities != null &&
    (!Array.isArray(modifiers.damageImmunities) ||
      damageImmunities.some((entry) => !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(entry)))
  ) return undefined
  const damageResistances = modifiers.damageResistances == null
    ? []
    : Array.isArray(modifiers.damageResistances)
      ? [...new Set(modifiers.damageResistances)]
      : []
  if (modifiers.damageResistances != null && (
    !Array.isArray(modifiers.damageResistances) ||
    damageResistances.some((entry) => !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(entry))
  )) return undefined
  const damageVulnerabilities = modifiers.damageVulnerabilities == null
    ? []
    : Array.isArray(modifiers.damageVulnerabilities)
      ? [...new Set(modifiers.damageVulnerabilities)]
      : []
  if (modifiers.damageVulnerabilities != null && (
    !Array.isArray(modifiers.damageVulnerabilities) ||
    damageVulnerabilities.some((entry) => !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(entry))
  )) return undefined
  const conditionImmunities = modifiers.conditionImmunities == null
    ? []
    : Array.isArray(modifiers.conditionImmunities)
      ? [...new Set(modifiers.conditionImmunities)]
      : []
  if (modifiers.conditionImmunities != null && (
    !Array.isArray(modifiers.conditionImmunities) ||
    conditionImmunities.some((entry) => !(DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(entry))
  )) return undefined
  const conditions = modifiers.conditions == null ? [] : Array.isArray(modifiers.conditions) ? [...new Set(modifiers.conditions)] : undefined
  if (!conditions || conditions.length > DND5E_STANDARD_CONDITION_IDS.length || conditions.some(entry => !(DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(entry))) return undefined
  const identifierList = (value: unknown): string[] | undefined =>
    Array.isArray(value) && value.length > 0 && value.length <= 32 && value.every((entry) =>
      typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry))
      ? [...new Set(value)] as string[]
      : undefined
  const attacksAgainstOccupantDisadvantageCreatureTypes = modifiers.attacksAgainstOccupantDisadvantageCreatureTypes == null
    ? []
    : identifierList(modifiers.attacksAgainstOccupantDisadvantageCreatureTypes)
  if (attacksAgainstOccupantDisadvantageCreatureTypes == null) return undefined
  const sourceQualifiedRules = (value: unknown) => value == null
    ? []
    : Array.isArray(value) && value.length > 0 && value.length <= 32 && value.every((rule) => {
        const candidate = record(rule)
        return !!candidate && Object.keys(candidate).every((key) =>
          key === 'conditions' || key === 'sourceCreatureTypes') &&
          identifierList(candidate.conditions) != null && identifierList(candidate.sourceCreatureTypes) != null
      })
      ? value.map((rule) => {
          const candidate = record(rule)!
          return {
            conditions: identifierList(candidate.conditions)!,
            sourceCreatureTypes: identifierList(candidate.sourceCreatureTypes)!,
          }
        })
      : undefined
  const conditionImmunitiesBySourceCreatureType = sourceQualifiedRules(
    modifiers.conditionImmunitiesBySourceCreatureType,
  )
  const savingThrowAdvantagesBySourceCreatureType = sourceQualifiedRules(
    modifiers.savingThrowAdvantagesBySourceCreatureType,
  )
  if (conditionImmunitiesBySourceCreatureType == null || savingThrowAdvantagesBySourceCreatureType == null) {
    return undefined
  }
  const spellTargetingImmunitySchools = modifiers.spellTargetingImmunitySchools == null
    ? []
    : Array.isArray(modifiers.spellTargetingImmunitySchools)
      ? [...new Set(modifiers.spellTargetingImmunitySchools)]
      : []
  if (
    modifiers.spellTargetingImmunitySchools != null &&
    (!Array.isArray(modifiers.spellTargetingImmunitySchools) ||
      spellTargetingImmunitySchools.length === 0 ||
      spellTargetingImmunitySchools.some((entry) => ![
        'abjuration', 'conjuration', 'divination', 'enchantment',
        'evocation', 'illusion', 'necromancy', 'transmutation',
      ].includes(String(entry))))
  ) return undefined
  for (const key of [
    'spellSavingThrowAdvantage', 'successfulSpellSaveNegatesDamage',
    'halvesFallingDamage', 'hitPointMaximumReductionImmunity', 'magicallyHeldAloft',
    'preventsRangedWeaponAttacks', 'concentrationSavingThrowDisadvantage',
  ] as const) {
    if (modifiers[key] != null && typeof modifiers[key] !== 'boolean') return undefined
  }
  if (modifiers.verticalJumpBonusFeet != null && (typeof modifiers.verticalJumpBonusFeet !== 'number' ||
    !Number.isFinite(modifiers.verticalJumpBonusFeet) || modifiers.verticalJumpBonusFeet <= 0 || modifiers.verticalJumpBonusFeet > 100)) return undefined
  const languageCapabilities = modifiers.languageCapabilities == null
    ? undefined
    : record(modifiers.languageCapabilities)
  if (modifiers.languageCapabilities != null && (
    !languageCapabilities ||
    Object.keys(languageCapabilities).some((key) =>
      key !== 'understandSpoken' && key !== 'speechUnderstoodBy') ||
    (languageCapabilities.understandSpoken != null && languageCapabilities.understandSpoken !== 'all') ||
    (languageCapabilities.speechUnderstoodBy != null &&
      languageCapabilities.speechUnderstoodBy !== 'any-creature-knowing-a-language') ||
    languageCapabilities.understandSpoken == null && languageCapabilities.speechUnderstoodBy == null
  )) return undefined
  if (
    modifiers.preventsVerbalComponents !== true && modifiers.suppressesMagic !== true &&
    modifiers.suppressesSpellsThroughLevel == null && damageImmunities.length === 0 &&
    damageResistances.length === 0 && damageVulnerabilities.length === 0 && conditionImmunities.length === 0 && conditions.length === 0 &&
    attacksAgainstOccupantDisadvantageCreatureTypes.length === 0 &&
    conditionImmunitiesBySourceCreatureType.length === 0 &&
    savingThrowAdvantagesBySourceCreatureType.length === 0 &&
    modifiers.spellSavingThrowAdvantage !== true &&
    spellTargetingImmunitySchools.length === 0 &&
    modifiers.successfulSpellSaveNegatesDamage !== true &&
    modifiers.hitPointMaximumReductionImmunity !== true &&
    modifiers.halvesFallingDamage !== true && modifiers.verticalJumpBonusFeet == null &&
    modifiers.magicallyHeldAloft !== true &&
    modifiers.preventsRangedWeaponAttacks !== true &&
    modifiers.concentrationSavingThrowDisadvantage !== true && !languageCapabilities && !abilityCheckRules && !savingThrowAdvantages && !skillCheckBonuses && modifiers.requiresLineOfEffectFromAnchor !== true
  ) return undefined
  return {
    relation: modifiers.relation as 'ally' | 'enemy' | 'any' | undefined,
    savingThrowAdvantages: savingThrowAdvantages == null ? undefined : [...new Set(savingThrowAdvantages)] as AbilityKey[],
    abilityCheckRules,
    abilityCheckRadiusFeet: modifiers.abilityCheckRadiusFeet == null ? undefined : Number(modifiers.abilityCheckRadiusFeet),
    skillCheckBonuses: skillCheckBonuses ? { ...skillCheckBonuses } as Record<string, number> : undefined,
    requiresLineOfEffectFromAnchor: modifiers.requiresLineOfEffectFromAnchor === true ? true : undefined,
    containment,
    preventsVerbalComponents: modifiers.preventsVerbalComponents === true,
    suppressesMagic: modifiers.suppressesMagic === true,
    suppressesSpellsThroughLevel: modifiers.suppressesSpellsThroughLevel == null
      ? undefined
      : Number(modifiers.suppressesSpellsThroughLevel),
    damageImmunities: damageImmunities as Dnd5eDamageType[],
    damageResistances: damageResistances as Dnd5eDamageType[],
    damageVulnerabilities: damageVulnerabilities as Dnd5eDamageType[],
    conditionImmunities: conditionImmunities as Dnd5eStandardConditionId[],
    conditions: conditions as Dnd5eStandardConditionId[],
    attacksAgainstOccupantDisadvantageCreatureTypes: attacksAgainstOccupantDisadvantageCreatureTypes.length ? attacksAgainstOccupantDisadvantageCreatureTypes : undefined,
    conditionImmunitiesBySourceCreatureType: conditionImmunitiesBySourceCreatureType.length ? conditionImmunitiesBySourceCreatureType : undefined,
    savingThrowAdvantagesBySourceCreatureType: savingThrowAdvantagesBySourceCreatureType.length ? savingThrowAdvantagesBySourceCreatureType : undefined,
    spellSavingThrowAdvantage: modifiers.spellSavingThrowAdvantage === true,
    spellTargetingImmunitySchools:
      spellTargetingImmunitySchools.length ? spellTargetingImmunitySchools as import('./spellbook').Dnd5eSpellbookSchoolId[] : undefined,
    successfulSpellSaveNegatesDamage: modifiers.successfulSpellSaveNegatesDamage === true,
    hitPointMaximumReductionImmunity: modifiers.hitPointMaximumReductionImmunity === true,
    halvesFallingDamage: modifiers.halvesFallingDamage === true ? true : undefined,
    verticalJumpBonusFeet: modifiers.verticalJumpBonusFeet as number | undefined,
    magicallyHeldAloft: modifiers.magicallyHeldAloft === true,
    preventsRangedWeaponAttacks: modifiers.preventsRangedWeaponAttacks === true,
    concentrationSavingThrowDisadvantage: modifiers.concentrationSavingThrowDisadvantage === true,
    languageCapabilities: languageCapabilities
      ? {
          understandSpoken: languageCapabilities.understandSpoken as 'all' | undefined,
          speechUnderstoodBy: languageCapabilities.speechUnderstoodBy as
            'any-creature-knowing-a-language' | undefined,
        }
      : undefined,
  }
}

export function normalizeDnd5ePersistentAreaBlocking(
  value: unknown,
): Dnd5ePersistentAreaBlocking | undefined {
  const blocking = record(value)
  if (!blocking || Object.keys(blocking).some((key) => ![
    'suppressesMappedBarriers','restrictedTokenIds','protectsOccupantsFromRestrictedTokens','containEntireTokenOnExit',
    'movement', 'movementMode', 'includedCreatureTypes', 'excludedCreatureTypes',
    'excludeSourceToken', 'entryPermission', 'authorizedTokenIds',
    'blocksTeleportationEntry', 'blocksTeleportationExit', 'teleportationExitSavingThrow',
    'vision', 'visionMode', 'lineOfEffect', 'lineOfEffectMode',
    'rangedWeaponAttackDisadvantage', 'halvedDamageTypes', 'freezesOnColdSpell',
  ].includes(key))) return undefined
  if (blocking.suppressesMappedBarriers != null && blocking.suppressesMappedBarriers !== true) return undefined
  if (blocking.containEntireTokenOnExit != null && typeof blocking.containEntireTokenOnExit !== 'boolean') return undefined
  if (blocking.rangedWeaponAttackDisadvantage != null && !['occupancy', 'boundary'].includes(String(blocking.rangedWeaponAttackDisadvantage))) return undefined
  if(blocking.freezesOnColdSpell != null && blocking.freezesOnColdSpell !== true)return undefined
  const halvedDamageTypes = blocking.halvedDamageTypes == null ? undefined :
    Array.isArray(blocking.halvedDamageTypes) && blocking.halvedDamageTypes.length > 0 && blocking.halvedDamageTypes.length <= DND5E_DAMAGE_TYPES.length &&
      blocking.halvedDamageTypes.every(type => DND5E_DAMAGE_TYPES.includes(type as Dnd5eDamageType))
      ? [...new Set(blocking.halvedDamageTypes)] as Dnd5eDamageType[] : undefined
  if(blocking.halvedDamageTypes != null && !halvedDamageTypes)return undefined
  const restrictedTokenIds=blocking.restrictedTokenIds==null?undefined:Array.isArray(blocking.restrictedTokenIds)&&blocking.restrictedTokenIds.length>0&&blocking.restrictedTokenIds.length<=128&&blocking.restrictedTokenIds.every(id=>typeof id==='string'&&id.length>0&&id.length<=256)?[...new Set(blocking.restrictedTokenIds)] as string[]:undefined
  if(blocking.restrictedTokenIds!=null && !restrictedTokenIds)return undefined
  if(blocking.protectsOccupantsFromRestrictedTokens!=null && (typeof blocking.protectsOccupantsFromRestrictedTokens!=='boolean'||!restrictedTokenIds))return undefined
  if (['movement', 'blocksTeleportationEntry', 'blocksTeleportationExit', 'vision', 'lineOfEffect'].some((key) =>
    blocking[key] != null && typeof blocking[key] !== 'boolean')) return undefined
  if (blocking.excludeSourceToken != null && typeof blocking.excludeSourceToken !== 'boolean') return undefined
  if (blocking.entryPermission != null && blocking.entryPermission !== 'occupants-at-creation') return undefined
  const teleportationExitSavingThrow = blocking.teleportationExitSavingThrow == null
    ? undefined
    : record(blocking.teleportationExitSavingThrow)
  if (teleportationExitSavingThrow && (
    Object.keys(teleportationExitSavingThrow).some((key) => !['ability', 'dc'].includes(key)) ||
    !ABILITIES.includes(teleportationExitSavingThrow.ability as AbilityKey) ||
    !integer(teleportationExitSavingThrow.dc, 1, 40)
  )) return undefined
  if (blocking.teleportationExitSavingThrow != null && !teleportationExitSavingThrow) return undefined
  if (teleportationExitSavingThrow && blocking.blocksTeleportationExit !== true) return undefined
  const authorizedTokenIds = blocking.authorizedTokenIds == null
    ? undefined
    : Array.isArray(blocking.authorizedTokenIds) && blocking.authorizedTokenIds.length <= 128 &&
      blocking.authorizedTokenIds.every((id) => typeof id === 'string' && !!id && id.length <= 160) &&
      new Set(blocking.authorizedTokenIds).size === blocking.authorizedTokenIds.length
      ? [...blocking.authorizedTokenIds] as string[]
      : undefined
  if (blocking.authorizedTokenIds != null && !authorizedTokenIds) return undefined
  if (blocking.authorizedTokenIds != null && blocking.entryPermission !== 'occupants-at-creation') return undefined
  if (blocking.movementMode != null && ![
    'occupancy', 'enter', 'exit', 'boundary',
  ].includes(String(blocking.movementMode))) return undefined
  if (blocking.lineOfEffectMode != null && !['occupancy', 'boundary'].includes(String(blocking.lineOfEffectMode))) return undefined
  if (blocking.visionMode != null && !['occupancy', 'outside-in'].includes(String(blocking.visionMode))) return undefined
  const normalizeCreatureTypes = (input: unknown): string[] | undefined => {
    if (input == null) return undefined
    if (!Array.isArray(input) || input.length < 1 || input.length > 32) return undefined
    const values = input.map((entry) => typeof entry === 'string' ? entry.trim().toLowerCase() : '')
    if (values.some((entry) => !entry || entry.length > 80) || new Set(values).size !== values.length) return undefined
    return values
  }
  const includedCreatureTypes = normalizeCreatureTypes(blocking.includedCreatureTypes)
  const excludedCreatureTypes = normalizeCreatureTypes(blocking.excludedCreatureTypes)
  if (blocking.includedCreatureTypes != null && !includedCreatureTypes) return undefined
  if (blocking.excludedCreatureTypes != null && !excludedCreatureTypes) return undefined
  if (
    blocking.suppressesMappedBarriers !== true && blocking.movement !== true && blocking.blocksTeleportationEntry !== true &&
    blocking.blocksTeleportationExit !== true && blocking.vision !== true && blocking.lineOfEffect !== true && blocking.rangedWeaponAttackDisadvantage == null && halvedDamageTypes == null && blocking.freezesOnColdSpell !== true
  ) return undefined
  return {
    rangedWeaponAttackDisadvantage: blocking.rangedWeaponAttackDisadvantage as Dnd5ePersistentAreaBlocking['rangedWeaponAttackDisadvantage'],
    halvedDamageTypes,
    freezesOnColdSpell:blocking.freezesOnColdSpell === true ? true : undefined,
    suppressesMappedBarriers: blocking.suppressesMappedBarriers === true ? true : undefined,
    restrictedTokenIds,protectsOccupantsFromRestrictedTokens:blocking.protectsOccupantsFromRestrictedTokens===true?true:undefined,
    containEntireTokenOnExit: blocking.containEntireTokenOnExit === true ? true : undefined,
    movement: blocking.movement === true,
    movementMode: blocking.movement === true
      ? (blocking.movementMode as Dnd5ePersistentAreaBlocking['movementMode'] ?? 'occupancy')
      : undefined,
    includedCreatureTypes,
    excludedCreatureTypes,
    excludeSourceToken: blocking.excludeSourceToken === true,
    entryPermission: blocking.entryPermission === 'occupants-at-creation'
      ? 'occupants-at-creation'
      : undefined,
    authorizedTokenIds,
    blocksTeleportationEntry: blocking.blocksTeleportationEntry === true,
    blocksTeleportationExit: blocking.blocksTeleportationExit === true,
    teleportationExitSavingThrow: teleportationExitSavingThrow
      ? {
          ability: teleportationExitSavingThrow.ability as AbilityKey,
          dc: Number(teleportationExitSavingThrow.dc),
        }
      : undefined,
    vision: blocking.vision === true,
    visionMode: blocking.vision === true
      ? (blocking.visionMode as Dnd5ePersistentAreaBlocking['visionMode'] ?? 'occupancy')
      : undefined,
    lineOfEffect: blocking.lineOfEffect === true,
    lineOfEffectMode: blocking.lineOfEffect === true
      ? (blocking.lineOfEffectMode as Dnd5ePersistentAreaBlocking['lineOfEffectMode'] ?? 'occupancy')
      : undefined,
  }
}

export function normalizeDnd5ePersistentAreaGrantedActivity(
  value: unknown,
): Dnd5ePersistentAreaGrantedActivity | undefined {
  const grant = record(value)
  if (
    !grant ||
    Object.keys(grant).some((key) => !['activityId', 'label', 'activateOnCreate', 'activationWindow', 'releaseBoundEffects'].includes(key)) ||
    (grant.releaseBoundEffects != null && grant.releaseBoundEffects !== true) ||
    (grant.activationWindow != null && (grant.activationWindow !== 'creation-turn' || grant.activateOnCreate !== true)) ||
    typeof grant.activityId !== 'string' ||
    !/^[a-z0-9][a-z0-9._:-]{0,159}$/.test(grant.activityId) ||
    (grant.label != null && (
      typeof grant.label !== 'string' || !grant.label.trim() || grant.label.length > 120
    )) ||
    (grant.activateOnCreate != null && typeof grant.activateOnCreate !== 'boolean')
  ) return undefined
  return {
    activityId: grant.activityId,
    label: typeof grant.label === 'string' ? grant.label.trim() : undefined,
    activateOnCreate: grant.activateOnCreate === true,
    activationWindow: grant.activationWindow === 'creation-turn' ? 'creation-turn' : undefined,
    ...(grant.releaseBoundEffects === true ? { releaseBoundEffects: true as const } : {}),
  }
}

/** Runtime boundary for the authoritative vertical extent of a persistent area. */
export function normalizeDnd5ePersistentAreaVerticalSnapshot(
  value: unknown,
): Dnd5ePersistentAreaVerticalSnapshot | undefined {
  const vertical = record(value)
  if (!vertical) return undefined
  if (vertical.mode === 'ground') {
    return Object.keys(vertical).length === 1 ? { mode: 'ground' } : undefined
  }
  const allowed = new Set(['mode', 'baseElevationFeet', 'heightFeet', 'anchorOffsetFeet', 'shape', 'columns'])
  if (
    vertical.mode !== 'volume' ||
    Object.keys(vertical).some((key) => !allowed.has(key)) ||
    !(typeof vertical.baseElevationFeet === 'number' && Number.isFinite(vertical.baseElevationFeet) && vertical.baseElevationFeet >= -1_000 && vertical.baseElevationFeet <= 10_000) ||
    !(typeof vertical.heightFeet === 'number' && Number.isFinite(vertical.heightFeet) && vertical.heightFeet >= 0.001 && vertical.heightFeet <= 10_000) ||
    (vertical.shape != null && vertical.shape !== 'sphere') ||
    (vertical.columns != null && (!validPersistentAreaColumns(vertical.columns) || vertical.shape != null || vertical.anchorOffsetFeet != null)) ||
    (Object.prototype.hasOwnProperty.call(vertical, 'anchorOffsetFeet') &&
      !integer(vertical.anchorOffsetFeet, -1_000, 10_000))
  ) return undefined
  return {
    mode: 'volume',
    baseElevationFeet: Number(vertical.baseElevationFeet),
    heightFeet: Number(vertical.heightFeet),
    ...(vertical.columns == null ? {} : { columns: (vertical.columns as { col: number; row: number; baseElevationFeet: number; heightFeet: number }[]).map(column => ({ ...column })) }),
    ...(vertical.shape === 'sphere' ? { shape: 'sphere' as const } : {}),
    ...(vertical.anchorOffsetFeet == null
      ? {}
      : { anchorOffsetFeet: Number(vertical.anchorOffsetFeet) }),
  }
}

export function normalizeDnd5ePersistentAreaVisual(
  value: unknown,
): Dnd5ePersistentAreaVisual | undefined {
  const visual = record(value)
  if (!visual || !(DND5E_PERSISTENT_AREA_VISUAL_PRESETS as readonly unknown[]).includes(visual.preset)) {
    return undefined
  }
  if (visual.intensity != null && !['subtle', 'normal', 'strong'].includes(String(visual.intensity))) {
    return undefined
  }
  const drawing=visual.drawing==null?undefined:normalizeSurfaceDrawing(visual.drawing)
  const verticalSurface = visual.verticalSurface == null ? undefined : normalizeVerticalSurfaceProjection(visual.verticalSurface)
  const horizontalSurface=visual.horizontalSurface==null?undefined:normalizeHorizontalMaterialSurface(visual.horizontalSurface)
  if(visual.horizontalSurface!=null&&(!horizontalSurface||verticalSurface||!['surface-inscription','surface-color','surface-drawing'].includes(String(visual.preset))))return undefined
  if (visual.verticalSurface != null && (!verticalSurface || !['surface-inscription', 'surface-color', 'surface-drawing'].includes(String(visual.preset)))) return undefined
  if((visual.preset==='surface-drawing'&&!drawing)||(visual.drawing!=null&&(!drawing||visual.preset!=='surface-drawing')))return undefined
  return {
    preset: visual.preset as Dnd5ePersistentAreaVisualPreset,
    intensity: (visual.intensity as Dnd5ePersistentAreaVisualIntensity | undefined) ?? 'normal',
    ...(drawing?{drawing}:{}),
    ...(verticalSurface ? { verticalSurface } : {}),
    ...(horizontalSurface ? {horizontalSurface} : {}),
  }
}

export function normalizeDnd5eHallowAreaState(
  value: unknown,
): Dnd5eHallowAreaState | undefined {
  const hallow = record(value)
  if (
    !hallow ||
    Object.keys(hallow).some((key) => ![
      'additionalEffect', 'damageType', 'effectScope', 'affectedCreatureType',
      'wardedCreatureTypes',
    ].includes(key)) ||
    !(DND5E_HALLOW_ADDITIONAL_EFFECTS as readonly unknown[]).includes(hallow.additionalEffect) ||
    !['all', 'allies', 'enemies', 'creature-type'].includes(String(hallow.effectScope)) ||
    !Array.isArray(hallow.wardedCreatureTypes) ||
    hallow.wardedCreatureTypes.some((entry) =>
      !['celestial', 'elemental', 'fey', 'fiend', 'undead'].includes(String(entry))) ||
    new Set(hallow.wardedCreatureTypes).size !== hallow.wardedCreatureTypes.length ||
    (hallow.damageType != null &&
      !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(hallow.damageType)) ||
    (hallow.affectedCreatureType != null && (
      typeof hallow.affectedCreatureType !== 'string' ||
      !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(hallow.affectedCreatureType)
    )) ||
    (hallow.effectScope === 'creature-type') !== (hallow.affectedCreatureType != null) ||
    (hallow.additionalEffect === 'energy-protection' ||
      hallow.additionalEffect === 'energy-vulnerability') !== (hallow.damageType != null)
  ) return undefined
  return {
    additionalEffect: hallow.additionalEffect as Dnd5eHallowAdditionalEffect,
    damageType: hallow.damageType as Dnd5eDamageType | undefined,
    effectScope: hallow.effectScope as Dnd5eHallowAreaState['effectScope'],
    affectedCreatureType: hallow.affectedCreatureType as string | undefined,
    wardedCreatureTypes: [...hallow.wardedCreatureTypes] as Dnd5eHallowAreaState['wardedCreatureTypes'],
  }
}

export function normalizeDnd5eHallucinatoryTerrainAreaState(
  value: unknown,
): Dnd5eHallucinatoryTerrainAreaState | undefined {
  const terrain = record(value)
  if (
    !terrain ||
    Object.keys(terrain).some((key) => key !== 'appearance') ||
    !(DND5E_HALLUCINATORY_TERRAIN_APPEARANCES as readonly unknown[]).includes(terrain.appearance)
  ) return undefined
  return { appearance: terrain.appearance as Dnd5eHallucinatoryTerrainAppearance }
}

export function normalizeDnd5eProgrammedIllusionAreaState(
  value: unknown,
): Dnd5eProgrammedIllusionAreaState | undefined {
  const illusion = record(value)
  if (
    !illusion ||
    Object.keys(illusion).some((key) => !['form', 'triggerSense'].includes(key)) ||
    !(DND5E_PROGRAMMED_ILLUSION_FORMS as readonly unknown[]).includes(illusion.form) ||
    !(DND5E_PROGRAMMED_ILLUSION_TRIGGER_SENSES as readonly unknown[]).includes(illusion.triggerSense)
  ) return undefined
  return {
    form: illusion.form as Dnd5eProgrammedIllusionForm,
    triggerSense: illusion.triggerSense as Dnd5eProgrammedIllusionTriggerSense,
  }
}

export function normalizeDnd5ePersistentAreaLighting(
  value: unknown,
): Dnd5ePersistentAreaLighting | undefined {
  const lighting = record(value)
  if (!lighting || !integer(lighting.spellLevel, 0, 9)) return undefined
  if (lighting.kind === 'reduce-light') {
    if (Object.keys(lighting).some(key => !['kind', 'radiusFeet', 'spellLevel'].includes(key)) ||
      !integer(lighting.radiusFeet, 1, 1_000)) return undefined
    return { kind: 'reduce-light', radiusFeet: Number(lighting.radiusFeet), spellLevel: Number(lighting.spellLevel) }
  }
  if (lighting.kind === 'light') {
    const allowed = new Set([
      'kind', 'brightRadiusFeet', 'dimRadiusFeet', 'color', 'spellLevel', 'sunlight', 'areaOnly',
      'suppressesMagicalDarknessThroughLevel', 'emission',
    ])
    if (
      Object.keys(lighting).some((key) => !allowed.has(key)) ||
      (lighting.sunlight != null && lighting.sunlight !== true) ||
      (lighting.areaOnly != null && lighting.areaOnly !== true) ||
      (lighting.emission != null && (lighting.emission !== 'rectangle-volume' || lighting.areaOnly === true)) ||
      !integer(lighting.brightRadiusFeet, 0, 1_000) ||
      !integer(lighting.dimRadiusFeet, 0, 1_000) ||
      Number(lighting.brightRadiusFeet) + Number(lighting.dimRadiusFeet) < 1 ||
      typeof lighting.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(lighting.color) ||
      (lighting.suppressesMagicalDarknessThroughLevel != null &&
        !integer(lighting.suppressesMagicalDarknessThroughLevel, 0, 9))
    ) return undefined
    return {
      kind: 'light',
      ...(lighting.sunlight === true ? { sunlight: true as const } : {}),
      ...(lighting.areaOnly === true ? { areaOnly: true as const } : {}),
      ...(lighting.emission === 'rectangle-volume' ? { emission: 'rectangle-volume' as const } : {}),
      brightRadiusFeet: Number(lighting.brightRadiusFeet),
      dimRadiusFeet: Number(lighting.dimRadiusFeet),
      color: lighting.color,
      spellLevel: Number(lighting.spellLevel),
      suppressesMagicalDarknessThroughLevel:
        lighting.suppressesMagicalDarknessThroughLevel as number | undefined,
    }
  }
  const allowed = new Set(['kind', 'radiusFeet', 'spellLevel', 'suppressesMagicalLightThroughLevel', 'lightSuppressionScope'])
  if (Object.keys(lighting).some((key) => !allowed.has(key)) ||
    lighting.kind !== 'magical-darkness' || !integer(lighting.radiusFeet, 1, 1_000) ||
    (lighting.lightSuppressionScope != null && lighting.lightSuppressionScope !== 'within-area') ||
    (lighting.suppressesMagicalLightThroughLevel != null &&
      !integer(lighting.suppressesMagicalLightThroughLevel, 0, 9))) return undefined
  return {
    kind: 'magical-darkness',
    radiusFeet: Number(lighting.radiusFeet),
    spellLevel: Number(lighting.spellLevel),
    lightSuppressionScope: lighting.lightSuppressionScope as 'within-area' | undefined,
    suppressesMagicalLightThroughLevel:
      lighting.suppressesMagicalLightThroughLevel as number | undefined,
  }
}

/** Runtime boundary used by map migration and shared-state validation. */
export function normalizeDnd5ePersistentAreaTriggerSnapshot(
  value: unknown,
): Dnd5ePersistentAreaTriggerSnapshot | undefined {
  const trigger = record(value)
  if (!trigger) return undefined
  const id = trigger.id
  const frequencyGroupId = trigger.frequencyGroupId
  const label = trigger.label
  const timing = trigger.timing as Dnd5ePersistentAreaTriggerTiming
  if (
    typeof id !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(id) ||
    (frequencyGroupId != null && (
      typeof frequencyGroupId !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(frequencyGroupId)
    )) ||
    typeof label !== 'string' || !label.trim() || label.length > DND5E_DECLARATIVE_LABEL_MAX_LENGTH ||
    !TIMINGS.includes(timing)
  ) return undefined

  const rawDamage = record(trigger.damage)
  const modifierFormula = rawDamage?.modifierFormula as Dnd5eWorkshopDamageFormulaV1 | undefined
  // count=0 plus a positive modifier is the generic fixed-damage form used by
  // effects such as Guardian of Faith. It produces no client dice request.
  const damage = rawDamage && integer(rawDamage.count, 0, 40) && integer(rawDamage.sides, 2, 100) &&
    integer(rawDamage.modifier ?? 0, -1_000, 1_000) &&
    (!modifierFormula || validateDnd5eWorkshopDamageFormulaV1(modifierFormula).length === 0) &&
    (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawDamage.type)
    ? {
        count: rawDamage.count,
        sides: rawDamage.sides,
        modifier: Number(rawDamage.modifier ?? 0),
        ...(modifierFormula ? { modifierFormula: structuredClone(modifierFormula) } : {}),
        type: rawDamage.type as Dnd5eDamageType,
      }
    : undefined

  const rawHealing = record(trigger.healing)
  const rawHealingDice = record(rawHealing?.dice)
  const healingDice = rawHealingDice && integer(rawHealingDice.count, 1, 100) &&
    typeof rawHealingDice.sides === 'number' && [4, 6, 8, 10, 12, 20].includes(rawHealingDice.sides) &&
    Object.keys(rawHealingDice).every(key => key === 'count' || key === 'sides')
    ? { count: Number(rawHealingDice.count), sides: Number(rawHealingDice.sides) } : undefined
  const healing = rawHealing && integer(rawHealing.amount, healingDice ? 0 : 1, 1_000_000) &&
    (rawHealing.dice == null || healingDice != null) &&
    (rawHealing.onlyIfAtZero == null || typeof rawHealing.onlyIfAtZero === 'boolean')
    ? { amount: Number(rawHealing.amount), ...(healingDice ? { dice: healingDice } : {}), onlyIfAtZero: rawHealing.onlyIfAtZero === true }
    : undefined

  const rawNotification = record(trigger.notification)
  const notificationMessage = typeof rawNotification?.message === 'string' &&
    rawNotification.message.trim() && rawNotification.message.length <= 250
    ? rawNotification.message.normalize('NFKC').trim().replace(/\s+/g, ' ')
    : undefined
  const notification = rawNotification &&
    Object.keys(rawNotification).every((key) => key === 'delivery' || key === 'audibleRadiusFeet' || key === 'message') &&
    (rawNotification.message == null || notificationMessage != null) &&
    (
      (rawNotification.delivery === 'mental-to-source' && rawNotification.audibleRadiusFeet == null) ||
      (rawNotification.delivery === 'audible' && integer(rawNotification.audibleRadiusFeet, 1, 10_000))
    )
    ? rawNotification.delivery === 'mental-to-source'
      ? { delivery: 'mental-to-source' as const, message: notificationMessage }
      : { delivery: 'audible' as const, audibleRadiusFeet: Number(rawNotification.audibleRadiusFeet), message: notificationMessage }
    : undefined

  const rawSave = record(trigger.savingThrow)
  const savingThrow = rawSave && ABILITIES.includes(rawSave.ability as AbilityKey) &&
    integer(rawSave.dc, 1, 40) &&
    (rawSave.allowWillingFailure === undefined || typeof rawSave.allowWillingFailure === 'boolean') &&
    (rawSave.magical == null || typeof rawSave.magical === 'boolean') &&
    (rawSave.advantageIfTargetHasSwimSpeed == null || typeof rawSave.advantageIfTargetHasSwimSpeed === 'boolean') &&
    (rawSave.automaticSuccessMinimumSizeRank === undefined || integer(rawSave.automaticSuccessMinimumSizeRank, 0, 5)) &&
    (rawSave.onSuccess === 'none' || rawSave.onSuccess === 'half')
    ? {
        ability: rawSave.ability as AbilityKey,
        dc: rawSave.dc,
        onSuccess: rawSave.onSuccess as 'none' | 'half',
        allowWillingFailure: rawSave.allowWillingFailure === true,
        magical: rawSave.magical === true,
        shapechangerDisadvantage: rawSave.shapechangerDisadvantage === true,
        revertShapechangerOnFailure: rawSave.revertShapechangerOnFailure === true,
        advantageIfTargetHasSwimSpeed: rawSave.advantageIfTargetHasSwimSpeed === true,
        automaticSuccessMinimumSizeRank: rawSave.automaticSuccessMinimumSizeRank as number | undefined,
        automaticSuccessForDamageImmunity:
          (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawSave.automaticSuccessForDamageImmunity)
            ? rawSave.automaticSuccessForDamageImmunity as Dnd5eDamageType
            : undefined,
      }
    : undefined

  const rawCondition = record(trigger.condition)
  if(rawCondition?.proneOnAreaEnd !== undefined && (rawCondition.proneOnAreaEnd !== true || rawCondition.endsWithArea !== true || rawCondition.condition !== 'restrained'))return undefined
  if(rawCondition?.groundOnAreaEnd !== undefined && (rawCondition.groundOnAreaEnd !== true || rawCondition.proneOnAreaEnd !== true || rawCondition.endsWithArea !== true || rawCondition.condition !== 'restrained'))return undefined
  if (rawCondition?.fearSourceIsAnchor != null && (rawCondition.fearSourceIsAnchor !== true || rawCondition.condition !== 'frightened')) return undefined
  const rawConditionModifiers = record(rawCondition?.modifiers)
  const conditionModifiers = rawConditionModifiers &&
    Object.keys(rawConditionModifiers).every((key) =>
      key === 'actionOrBonusActionOnly' || key === 'preventReactions' || key === 'magicallyHeldAloft' || key === 'submerged') &&
    (rawConditionModifiers.submerged === undefined || (rawConditionModifiers.submerged === true && rawCondition?.endsWithArea === true)) &&
    (rawConditionModifiers.magicallyHeldAloft === undefined ||
      (rawConditionModifiers.magicallyHeldAloft === true && rawCondition?.condition === 'restrained' && rawCondition.endsWithArea === true)) &&
    (rawConditionModifiers.actionOrBonusActionOnly == null ||
      typeof rawConditionModifiers.actionOrBonusActionOnly === 'boolean') &&
    (rawConditionModifiers.preventReactions == null ||
      typeof rawConditionModifiers.preventReactions === 'boolean')
    ? {
        actionOrBonusActionOnly: rawConditionModifiers.actionOrBonusActionOnly as boolean | undefined,
        preventReactions: rawConditionModifiers.preventReactions as boolean | undefined,
        ...(rawConditionModifiers.magicallyHeldAloft === true ? { magicallyHeldAloft: true as const } : {}),
        ...(rawConditionModifiers.submerged === true ? { submerged: true as const } : {}),
      }
    : rawCondition?.modifiers == null
      ? undefined
      : null
  const rawDuration = record(rawCondition?.duration)
  const duration = rawDuration && EXPIRATIONS.includes(rawDuration.expiresAt as Dnd5ePluginEffectDuration['expiresAt']) &&
    (rawDuration.includeCreationTurn == null || (typeof rawDuration.includeCreationTurn === 'boolean' &&
      (rawDuration.remainingRounds ?? 1) === 1 && ['source-turn-end', 'target-turn-end'].includes(String(rawDuration.expiresAt)))) &&
    (rawDuration.remainingRounds == null || integer(rawDuration.remainingRounds, 1, DND5E_DECLARATIVE_DURATION_MAX_ROUNDS)) &&
    (rawDuration.saveAbility == null || ABILITIES.includes(rawDuration.saveAbility as AbilityKey)) &&
    (rawDuration.saveDc == null || integer(rawDuration.saveDc, 1, 40))
    ? {
        expiresAt: rawDuration.expiresAt as Dnd5ePluginEffectDuration['expiresAt'],
        remainingRounds: rawDuration.remainingRounds as number | undefined,
        includeCreationTurn: rawDuration.includeCreationTurn as boolean | undefined,
        saveAbility: rawDuration.saveAbility as AbilityKey | undefined,
        saveDc: rawDuration.saveDc as number | undefined,
      }
    : undefined
  const rawEscapeCheck = record(rawCondition?.escapeCheck)
  const destructibleRestraint=record(rawCondition?.destructibleRestraint)
  if(rawCondition?.destructibleRestraint!==undefined && (!destructibleRestraint ||
    Object.keys(destructibleRestraint).some(key=>!['label','armorClass','hitPoints'].includes(key)) ||
    typeof destructibleRestraint.label!=='string'||!destructibleRestraint.label.trim()||destructibleRestraint.label.length>120||
    !integer(destructibleRestraint.armorClass,1,40)||!integer(destructibleRestraint.hitPoints,1,1000000)||
    rawCondition.condition!=='restrained'||rawCondition.endsWithArea!==true||duration?.expiresAt!=='permanent'))return undefined
  if (rawCondition?.suspendAboveGroundFeet !== undefined &&
    (!integer(rawCondition.suspendAboveGroundFeet, 1, 1000) || rawCondition.condition !== 'restrained' || rawCondition.endsWithArea !== true)) return undefined
  const removalAction = normalizePersistentAreaRemovalAction(rawCondition?.removalAction)
  if (rawCondition?.removalAction !== undefined && !removalAction) return undefined
  const escapeCheck = rawCondition?.escapeCheck == null
    ? undefined
    : rawEscapeCheck &&
      Object.keys(rawEscapeCheck).every((key) => ['ability', 'skill', 'alternativeAbility', 'dc', 'economy'].includes(key)) &&
      ABILITIES.includes(rawEscapeCheck.ability as AbilityKey) &&
      (rawEscapeCheck.skill == null ||
        (rawEscapeCheck.skill === 'athletics' && rawEscapeCheck.ability === 'str') ||
        (rawEscapeCheck.skill === 'acrobatics' && rawEscapeCheck.ability === 'dex')) &&
      (rawEscapeCheck.alternativeAbility == null ||
        ABILITIES.includes(rawEscapeCheck.alternativeAbility as AbilityKey)) &&
      integer(rawEscapeCheck.dc, 1, 100) &&
      rawEscapeCheck.economy === 'action'
      ? {
          ability: rawEscapeCheck.ability as AbilityKey,
          ...(rawEscapeCheck.skill != null ? { skill: rawEscapeCheck.skill as 'athletics' | 'acrobatics' } : {}),
          alternativeAbility: rawEscapeCheck.alternativeAbility as AbilityKey | undefined,
          dc: Number(rawEscapeCheck.dc),
          economy: 'action' as const,
        }
      : null
  if (rawCondition?.endsWithArea != null &&
    (typeof rawCondition.endsWithArea !== 'boolean' || (rawCondition.endsWithArea && rawCondition.condition !== 'restrained'))) return undefined
  if (rawCondition?.ejectOnSuccessfulRepeatSave !== undefined &&
    (rawCondition.ejectOnSuccessfulRepeatSave !== true || rawCondition.endsWithArea !== true ||
      rawCondition.condition !== 'restrained' || duration?.expiresAt !== 'target-turn-end-save')) return undefined
  if (trigger.endAreaWhenNoBoundConditions !== undefined &&
    (trigger.endAreaWhenNoBoundConditions !== true || rawCondition?.endsWithArea !== true)) return undefined
  const escapeEjection=record(rawCondition?.escapeEjection)
  if (rawCondition?.escapeEjection !== undefined && (!escapeEjection || rawCondition.endsWithArea !== true ||
    rawCondition.condition !== 'restrained' || !escapeCheck ||
    Object.keys(escapeEjection).some(key=>!['count','sides','feetPerPoint'].includes(key)) ||
    !integer(escapeEjection.count,1,20) || !integer(escapeEjection.sides,2,100) || !integer(escapeEjection.feetPerPoint,1,100) ||
    Number(escapeEjection.count)*Number(escapeEjection.sides)*Number(escapeEjection.feetPerPoint)>1000)) return undefined
  const condition = rawCondition && duration &&
    (DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(rawCondition.condition) &&
    (duration.expiresAt !== 'target-turn-end-save' || (!!duration.saveAbility && !!duration.saveDc)) &&
    escapeCheck !== null && conditionModifiers !== null
    ? {
        condition: rawCondition.condition as Dnd5eStandardConditionId,
        ...(destructibleRestraint?{destructibleRestraint:{label:String(destructibleRestraint.label).trim(),armorClass:Number(destructibleRestraint.armorClass),hitPoints:Number(destructibleRestraint.hitPoints)}}:{}),
        ...(rawCondition.suspendAboveGroundFeet !== undefined ? { suspendAboveGroundFeet: Number(rawCondition.suspendAboveGroundFeet) } : {}),
        ...(rawCondition.fearSourceIsAnchor === true ? { fearSourceIsAnchor: true as const } : {}),
        endsWithArea: rawCondition.endsWithArea as boolean | undefined,
        ...(rawCondition.ejectOnSuccessfulRepeatSave === true ? { ejectOnSuccessfulRepeatSave: true as const } : {}),
        ...(escapeEjection ? {escapeEjection:{count:Number(escapeEjection.count),sides:Number(escapeEjection.sides),feetPerPoint:Number(escapeEjection.feetPerPoint)}} : {}),
        ...(rawCondition.proneOnAreaEnd === true ? { proneOnAreaEnd: true as const } : {}),
        ...(rawCondition.groundOnAreaEnd === true ? { groundOnAreaEnd: true as const } : {}),
        duration,
        escapeCheck,
        ...(removalAction ? { removalAction } : {}),
        modifiers: conditionModifiers,
      }
    : undefined

  const consumeActionOnFailedSave = trigger.consumeActionOnFailedSave === true
  const rawVisibility = record(trigger.visibilityOnFailedSave)
  if (trigger.visibilityOnFailedSave != null && (!rawVisibility || !savingThrow ||
    Object.keys(rawVisibility).some(key => !['dimRadiusFeet','color','suppressInvisibilityBenefits','endsWithArea'].includes(key)) ||
    !integer(rawVisibility.dimRadiusFeet,1,1000) || typeof rawVisibility.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(rawVisibility.color) ||
    rawVisibility.suppressInvisibilityBenefits !== true || rawVisibility.endsWithArea !== true)) return undefined
  const visibilityOnFailedSave = rawVisibility ? {dimRadiusFeet:rawVisibility.dimRadiusFeet as number,color:rawVisibility.color as string,
    suppressInvisibilityBenefits:true as const,endsWithArea:true as const} : undefined
  const rawExhaustion = record(trigger.exhaustionOnFailedSave)
  if (trigger.exhaustionOnFailedSave != null && (!rawExhaustion ||
    Object.keys(rawExhaustion).some(key => !['levels', 'endsWithArea'].includes(key)) ||
    !integer(rawExhaustion.levels, 1, 6) || rawExhaustion.endsWithArea !== true || !savingThrow)) return undefined
  const exhaustionOnFailedSave = rawExhaustion ? { levels: rawExhaustion.levels as number, endsWithArea: true as const } : undefined
  if (trigger.requiresSourceSpellSummon != null && trigger.requiresSourceSpellSummon !== true) return undefined
  if (trigger.consumeActionOnFailedSave != null && typeof trigger.consumeActionOnFailedSave !== 'boolean') return undefined
  const endTargetConcentrationOnFailedSave = trigger.endTargetConcentrationOnFailedSave === true
  if (
    trigger.endTargetConcentrationOnFailedSave != null &&
    typeof trigger.endTargetConcentrationOnFailedSave !== 'boolean'
  ) return undefined
  if (
    (trigger.proximityFeet != null && (!integer(trigger.proximityFeet, 1, 1000) || !['turn-start', 'turn-end', 'source-turn-start', 'source-turn-end'].includes(timing))) ||
    (trigger.oncePerRound != null && typeof trigger.oncePerRound !== 'boolean') ||
    (trigger.oncePerTurn != null && typeof trigger.oncePerTurn !== 'boolean') ||
    (trigger.oncePerTarget != null && typeof trigger.oncePerTarget !== 'boolean')
  ) return undefined
  if (trigger.proximityObjectKind != null && (
    typeof trigger.proximityObjectKind !== 'string' || !['tree', 'undergrowth', 'rock'].includes(trigger.proximityObjectKind) || trigger.proximityFeet == null
  )) return undefined
  if (trigger.targetRelation != null && (typeof trigger.targetRelation !== 'string' || !['ally', 'enemy', 'any'].includes(trigger.targetRelation))) return undefined
  const excludedTokenIds = trigger.excludedTokenIds == null
    ? undefined
    : Array.isArray(trigger.excludedTokenIds) && trigger.excludedTokenIds.length <= 256 &&
      trigger.excludedTokenIds.every((id) => typeof id === 'string' && /^[a-z0-9][a-z0-9._:-]{0,159}$/.test(id)) &&
      new Set(trigger.excludedTokenIds).size === trigger.excludedTokenIds.length
      ? [...trigger.excludedTokenIds] as string[]
      : null
  if (excludedTokenIds === null) return undefined
  const minimumLifecycleAdvances = trigger.minimumLifecycleAdvances == null
    ? undefined
    : integer(trigger.minimumLifecycleAdvances, 0, 14_400)
      ? Number(trigger.minimumLifecycleAdvances)
      : undefined
  const maximumLifecycleAdvances = trigger.maximumLifecycleAdvances == null
    ? undefined
    : integer(trigger.maximumLifecycleAdvances, 0, 14_400)
      ? Number(trigger.maximumLifecycleAdvances)
      : undefined
  if (
    (trigger.minimumLifecycleAdvances != null && minimumLifecycleAdvances == null) ||
    (trigger.maximumLifecycleAdvances != null && maximumLifecycleAdvances == null) ||
    (minimumLifecycleAdvances != null && maximumLifecycleAdvances != null && minimumLifecycleAdvances > maximumLifecycleAdvances)
  ) return undefined
  const rawForcedMovement = record(trigger.forcedMovement)
  const fixedDirection = rawForcedMovement?.mode === 'push-fixed-direction'
    ? normalizeDnd5eDirectionalMovementCost({ direction: rawForcedMovement.direction, additionalFeetPerFoot: 1 })?.direction : undefined
  const forcedMovement = rawForcedMovement &&
    Object.keys(rawForcedMovement).every((key) => ['mode', 'direction', 'distanceFeet', 'appliesOn', 'maximumOutsideDistanceFeet'].includes(key)) &&
    (rawForcedMovement.mode === 'push-fixed-direction' ? !!fixedDirection : rawForcedMovement.direction === undefined) &&
    (rawForcedMovement.mode === 'push-from-source' || rawForcedMovement.mode === 'push-from-area-anchor' || rawForcedMovement.mode === 'pull-to-area-anchor'
      || rawForcedMovement.mode === 'push-fixed-direction'
      ? integer(rawForcedMovement.distanceFeet, 1, 1_000) && rawForcedMovement.maximumOutsideDistanceFeet === undefined
      : rawForcedMovement.mode === 'nearest-outside-area' && rawForcedMovement.distanceFeet === undefined &&
        (rawForcedMovement.maximumOutsideDistanceFeet === undefined || integer(rawForcedMovement.maximumOutsideDistanceFeet, 1, 1_000))) &&
    ['failed-save', 'successful-save', 'always'].includes(String(rawForcedMovement.appliesOn))
    ? {
        ...(rawForcedMovement.mode === 'push-fixed-direction'
          ? { mode: 'push-fixed-direction' as const, direction: fixedDirection!, distanceFeet: Number(rawForcedMovement.distanceFeet) }
          : rawForcedMovement.mode === 'push-from-source' || rawForcedMovement.mode === 'push-from-area-anchor' || rawForcedMovement.mode === 'pull-to-area-anchor'
          ? { mode: rawForcedMovement.mode as 'push-from-source' | 'push-from-area-anchor' | 'pull-to-area-anchor', distanceFeet: Number(rawForcedMovement.distanceFeet) }
          : { mode: 'nearest-outside-area' as const,
              ...(rawForcedMovement.maximumOutsideDistanceFeet === undefined ? {} :
                { maximumOutsideDistanceFeet: Number(rawForcedMovement.maximumOutsideDistanceFeet) }) }),
        appliesOn: rawForcedMovement.appliesOn as 'failed-save' | 'successful-save' | 'always',
      }
    : undefined
  if (trigger.forcedMovement != null && !forcedMovement) return undefined
  if (forcedMovement && forcedMovement.appliesOn !== 'always' && !savingThrow) return undefined
  if (!damage && !healing && !condition && !notification && !savingThrow && !consumeActionOnFailedSave && !forcedMovement && trigger.boundRestraintRiseFeet == null) return undefined
  if (damage && damage.count === 0 && damage.modifier <= 0 && !damage.modifierFormula) return undefined
  if (trigger.healing != null && !healing) return undefined
  if (trigger.notification != null && !notification) return undefined
  if (trigger.savingThrow != null && !savingThrow) return undefined
  if (trigger.condition != null && !condition) return undefined
  const capacity = trigger.capacity === undefined ? undefined : normalizeDnd5ePersistentAreaCapacity(trigger.capacity)
  if (trigger.capacity !== undefined && (!capacity || condition?.condition !== 'restrained')) return undefined
  if (rawSave?.automaticSuccessForDamageImmunity != null &&
    !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawSave.automaticSuccessForDamageImmunity)) return undefined
  if (consumeActionOnFailedSave && !savingThrow) return undefined
  if (endTargetConcentrationOnFailedSave && savingThrow?.ability !== 'con') return undefined
  const movementIntervalFeet = trigger.timing === 'on-move-distance' &&
    integer(trigger.movementIntervalFeet, 1, 1_000)
    ? trigger.movementIntervalFeet
    : undefined
  if (trigger.timing === 'on-move-distance' && movementIntervalFeet == null) return undefined
  if (trigger.timing !== 'on-move-distance' && trigger.movementIntervalFeet != null) return undefined
  const maximumTotalUses = trigger.maximumTotalUses == null
    ? undefined
    : integer(trigger.maximumTotalUses, 1, 10_000)
      ? Number(trigger.maximumTotalUses)
      : undefined
  if (trigger.maximumTotalUses != null && maximumTotalUses == null) return undefined
  const sourceChoosesTargets = trigger.sourceChoosesTargets === true
  if (trigger.sourceChoosesTargets != null && typeof trigger.sourceChoosesTargets !== 'boolean') return undefined
  const maximumTargetsPerTurn = trigger.maximumTargetsPerTurn == null ? undefined
    : integer(trigger.maximumTargetsPerTurn, 1, 10_000) ? Number(trigger.maximumTargetsPerTurn) : undefined
  if (trigger.maximumTargetsPerTurn != null && maximumTargetsPerTurn == null) return undefined
  if (maximumTargetsPerTurn != null && (!sourceChoosesTargets || trigger.oncePerTurn !== true || trigger.oncePerTarget === true)) return undefined
  if (sourceChoosesTargets && (
    !['source-turn-start', 'source-turn-end'].includes(String(trigger.timing)) ||
    (maximumTotalUses == null && maximumTargetsPerTurn == null)
  )) return undefined
  const targetKinds = trigger.targetKinds == null
    ? undefined
    : Array.isArray(trigger.targetKinds) && trigger.targetKinds.length === 1 &&
      trigger.targetKinds.every((kind) => kind === 'creature') &&
      new Set(trigger.targetKinds).size === trigger.targetKinds.length
      ? [...trigger.targetKinds] as 'creature'[]
      : null
  if (targetKinds === null) return undefined
  if (trigger.targetSizeRanks !== undefined && (!Array.isArray(trigger.targetSizeRanks) ||
    trigger.targetSizeRanks.length < 1 || trigger.targetSizeRanks.length > 6 ||
    new Set(trigger.targetSizeRanks).size !== trigger.targetSizeRanks.length ||
    trigger.targetSizeRanks.some(rank => !Number.isInteger(rank) || rank < 0 || rank > 5))) return undefined
  if (trigger.requiresAnchorLineOfEffect != null && typeof trigger.requiresAnchorLineOfEffect !== 'boolean') return undefined
  if (trigger.requiresSourceLineOfEffect != null && typeof trigger.requiresSourceLineOfEffect !== 'boolean') return undefined
  if (trigger.requiresTargetFlying !== undefined && (trigger.requiresTargetFlying !== true || !['on-enter', 'turn-start'].includes(timing))) return undefined
  if (trigger.requiresTargetGrounded !== undefined && (trigger.requiresTargetGrounded !== true || trigger.requiresTargetFlying === true)) return undefined
  if (trigger.requiresSourceVision != null && typeof trigger.requiresSourceVision !== 'boolean') return undefined
  if (trigger.targetSeesAnchorOnCreate != null && (trigger.targetSeesAnchorOnCreate !== true || timing !== 'on-create')) return undefined
  if (trigger.sourceMayDecline != null && typeof trigger.sourceMayDecline !== 'boolean') return undefined
  const includedCreatureTypes = normalizePersistentAreaCreatureTypes(trigger.includedCreatureTypes)
  const excludedCreatureTypes = normalizePersistentAreaCreatureTypes(trigger.excludedCreatureTypes)
  if (trigger.includedCreatureTypes != null && !includedCreatureTypes) return undefined
  if (trigger.excludedCreatureTypes != null && !excludedCreatureTypes) return undefined
  const maximumTotalDamage = trigger.maximumTotalDamage == null
    ? undefined
    : integer(trigger.maximumTotalDamage, 1, 1_000_000)
      ? Number(trigger.maximumTotalDamage)
      : undefined
  if (trigger.maximumTotalDamage != null && maximumTotalDamage == null) return undefined
  const conditionSavingThrow = trigger.conditionSavingThrow == null ? undefined :
    normalizeDnd5ePersistentAreaTriggerSnapshot({id:trigger.id,label:trigger.label,timing,
      savingThrow:trigger.conditionSavingThrow})?.savingThrow
  if (trigger.conditionSavingThrow != null && (!savingThrow || !condition ||
    !conditionSavingThrow || conditionSavingThrow.onSuccess !== 'none')) return undefined
  if (trigger.boundRestraintRiseFeet != null && (!integer(trigger.boundRestraintRiseFeet, 1, 1000) ||
    timing !== 'turn-start' || trigger.oncePerTurn !== true || savingThrow || condition || damage || healing || forcedMovement)) return undefined
  const cells = trigger.cells == null
    ? undefined
    : Array.isArray(trigger.cells) && trigger.cells.length >= 1 && trigger.cells.length <= 4_096
      ? trigger.cells.flatMap((cell) => {
          const entry = record(cell)
          return entry && integer(entry.col, -10_000, 10_000) && integer(entry.row, -10_000, 10_000)
            ? [{ col: Number(entry.col), row: Number(entry.row) }]
            : []
        })
      : []
  if (trigger.cells != null && (
    !Array.isArray(trigger.cells) || cells?.length !== trigger.cells.length
  )) return undefined
  const skipSaveWhenSourceConditionActive =
    (DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(trigger.skipSaveWhenSourceConditionActive)
      ? trigger.skipSaveWhenSourceConditionActive as Dnd5eStandardConditionId
      : undefined
  if (trigger.skipSaveWhenSourceConditionActive != null && !skipSaveWhenSourceConditionActive) return undefined
  return {
    id,
    frequencyGroupId: frequencyGroupId as string | undefined,
    label: label.trim(),
    timing,
    minimumLifecycleAdvances,
    ...(trigger.proximityFeet == null ? {} : {proximityFeet: Number(trigger.proximityFeet)}),
    ...(trigger.proximityObjectKind == null ? {} : {proximityObjectKind: trigger.proximityObjectKind as 'tree' | 'undergrowth' | 'rock'}),
    ...(trigger.targetRelation == null ? {} : {targetRelation: trigger.targetRelation as 'ally' | 'enemy' | 'any'}),
    maximumLifecycleAdvances,
    oncePerRound: trigger.oncePerTarget === true || trigger.oncePerTurn === true
      ? false
      : trigger.oncePerRound !== false,
    oncePerTurn: trigger.oncePerTarget === true ? false : trigger.oncePerTurn === true,
    oncePerTarget: trigger.oncePerTarget === true,
    excludedTokenIds,
    maximumTotalUses,
    maximumTargetsPerTurn,
    ...(trigger.endAreaWhenNoBoundConditions === true ? { endAreaWhenNoBoundConditions: true as const } : {}),
    sourceChoosesTargets,
    targetKinds,
    requiresTargetFlying: trigger.requiresTargetFlying === true ? true : undefined,
    ...(trigger.requiresSourceSpellSummon === true ? { requiresSourceSpellSummon: true as const } : {}),
    ...(trigger.requiresTargetGrounded === true ? { requiresTargetGrounded: true as const } : {}),
    ...(trigger.targetSizeRanks !== undefined ? { targetSizeRanks: [...trigger.targetSizeRanks as number[]] } : {}),
    requiresSourceVision: trigger.requiresSourceVision === true,
    ...(trigger.targetSeesAnchorOnCreate === true ? { targetSeesAnchorOnCreate: true as const } : {}),
    requiresSourceLineOfEffect: trigger.requiresSourceLineOfEffect === true,
    requiresAnchorLineOfEffect: trigger.requiresAnchorLineOfEffect === true,
    sourceMayDecline: trigger.sourceMayDecline === true,
    includedCreatureTypes,
    excludedCreatureTypes,
    maximumTotalDamage,
    movementIntervalFeet,
    savingThrow,
    ...(trigger.conditionSavingThrow != null ? { conditionSavingThrow } : {}),
    ...(trigger.boundRestraintRiseFeet == null ? {} : { boundRestraintRiseFeet: Number(trigger.boundRestraintRiseFeet) }),
    skipSaveWhenSourceConditionActive,
    damage,
    healing,
    condition,
    notification,
    consumeActionOnFailedSave,
    exhaustionOnFailedSave,
    visibilityOnFailedSave,
    endTargetConcentrationOnFailedSave,
    forcedMovement,
    capacity,
    cells,
    dmAdjustable: trigger.dmAdjustable === true,
  }
}

/** Build-time boundary for plugin declarations whose save DC may come from the source. */
export function normalizeDnd5ePersistentAreaTriggerDeclaration(
  value: unknown,
): Dnd5ePersistentAreaTriggerDeclaration | undefined {
  const trigger = record(value)
  if (!trigger) return undefined
  const rawSave = record(trigger.savingThrow)
  if (rawSave && rawSave.dc !== 'source-save-dc' && !integer(rawSave.dc, 1, 40)) return undefined
  const rawConditionSave = record(trigger.conditionSavingThrow)
  if (trigger.conditionSavingThrow != null && (!rawConditionSave ||
    (rawConditionSave.dc !== 'source-save-dc' && !integer(rawConditionSave.dc,1,40)))) return undefined
  const rawCondition = record(trigger.condition)
  const rawDuration = record(rawCondition?.duration)
  const rawEscape = record(rawCondition?.escapeCheck)
  const rawRemoval = record(rawCondition?.removalAction)
  const rawRemovalCheck = record(rawRemoval?.abilityCheck)
  const normalized = normalizeDnd5ePersistentAreaTriggerSnapshot({
    ...trigger,
    conditionSavingThrow: rawConditionSave ? {...rawConditionSave,dc:rawConditionSave.dc==='source-save-dc'?10:rawConditionSave.dc} : undefined,
    savingThrow: rawSave
      ? { ...rawSave, dc: rawSave.dc === 'source-save-dc' ? 10 : rawSave.dc }
      : undefined,
    condition: rawCondition ? { ...rawCondition,
      duration: rawDuration ? { ...rawDuration, saveDc: rawDuration.saveDc === 'source-save-dc' ? 10 : rawDuration.saveDc } : undefined,
      escapeCheck: rawEscape ? { ...rawEscape, dc: rawEscape.dc === 'source-save-dc' ? 10 : rawEscape.dc } : rawCondition.escapeCheck,
      ...(rawRemoval ? { removalAction: { ...rawRemoval,
        ...(rawRemovalCheck ? { abilityCheck: { ...rawRemovalCheck, dc: rawRemovalCheck.dc === 'source-save-dc' ? 10 : rawRemovalCheck.dc } } : {}) } } : {}),
    } : trigger.condition,
  })
  if (!normalized) return undefined
  return {
    ...normalized,
    conditionSavingThrow: normalized.conditionSavingThrow ? {...normalized.conditionSavingThrow,
      dc:rawConditionSave?.dc==='source-save-dc'?'source-save-dc':normalized.conditionSavingThrow.dc} : undefined,
    condition: normalized.condition ? { ...normalized.condition,
      duration: { ...normalized.condition.duration, saveDc: rawDuration?.saveDc === 'source-save-dc' ? 'source-save-dc' : normalized.condition.duration.saveDc },
      escapeCheck: normalized.condition.escapeCheck ? { ...normalized.condition.escapeCheck,
        dc: rawEscape?.dc === 'source-save-dc' ? 'source-save-dc' : normalized.condition.escapeCheck.dc } : undefined,
      ...(normalized.condition.removalAction ? { removalAction: { ...normalized.condition.removalAction,
        ...(normalized.condition.removalAction.abilityCheck ? { abilityCheck: { ...normalized.condition.removalAction.abilityCheck,
          dc: rawRemovalCheck?.dc === 'source-save-dc' ? 'source-save-dc' as const : normalized.condition.removalAction.abilityCheck.dc } } : {}) } } : {}),
    } : undefined,
    savingThrow: normalized.savingThrow && rawSave
      ? {
          ability: normalized.savingThrow.ability,
          dc: rawSave.dc === 'source-save-dc' ? 'source-save-dc' : normalized.savingThrow.dc,
          onSuccess: normalized.savingThrow.onSuccess,
          magical: normalized.savingThrow.magical,
          shapechangerDisadvantage: normalized.savingThrow.shapechangerDisadvantage,
          revertShapechangerOnFailure: normalized.savingThrow.revertShapechangerOnFailure,
          advantageIfTargetHasSwimSpeed: normalized.savingThrow.advantageIfTargetHasSwimSpeed,
          automaticSuccessMinimumSizeRank: normalized.savingThrow.automaticSuccessMinimumSizeRank,
          allowWillingFailure: normalized.savingThrow.allowWillingFailure,
          automaticSuccessForDamageImmunity:
            normalized.savingThrow.automaticSuccessForDamageImmunity,
        }
      : undefined,
  }
}

/** Capture every declared DC at creation; persisted triggers contain numbers only. */
export function resolveDnd5ePersistentAreaTriggerSourceDc(
  trigger: Dnd5ePersistentAreaTriggerDeclaration, sourceSaveDc: number | undefined,
): Dnd5ePersistentAreaTriggerSnapshot | undefined {
  const needsSourceDc = [trigger.savingThrow?.dc, trigger.conditionSavingThrow?.dc, trigger.condition?.duration.saveDc, trigger.condition?.escapeCheck?.dc, trigger.condition?.removalAction?.abilityCheck?.dc].includes('source-save-dc')
  if (needsSourceDc && !integer(sourceSaveDc, 1, 40)) return undefined
  const resolve = (value: number | 'source-save-dc' | undefined) => value === 'source-save-dc' ? sourceSaveDc : value
  return normalizeDnd5ePersistentAreaTriggerSnapshot({ ...structuredClone(trigger),
    conditionSavingThrow: trigger.conditionSavingThrow ? {...trigger.conditionSavingThrow,dc:resolve(trigger.conditionSavingThrow.dc)} : undefined,
    savingThrow: trigger.savingThrow ? { ...trigger.savingThrow, dc: resolve(trigger.savingThrow.dc) } : undefined,
    condition: trigger.condition ? { ...trigger.condition,
      duration: { ...trigger.condition.duration, saveDc: resolve(trigger.condition.duration.saveDc) },
      escapeCheck: trigger.condition.escapeCheck ? { ...trigger.condition.escapeCheck, dc: resolve(trigger.condition.escapeCheck.dc) } : undefined,
      ...(trigger.condition.removalAction ? { removalAction: { ...trigger.condition.removalAction,
        ...(trigger.condition.removalAction.abilityCheck ? { abilityCheck: { ...trigger.condition.removalAction.abilityCheck,
          dc: resolve(trigger.condition.removalAction.abilityCheck.dc) } } : {}) } } : {}),
    } : undefined,
  })
}
