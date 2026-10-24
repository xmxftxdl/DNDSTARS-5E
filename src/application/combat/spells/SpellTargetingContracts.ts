import type { GridCell } from '../../../lib/gridCombat'
import type { SkillAoeTargeting } from '../../../lib/skillTargeting'
import type {
  Dnd5eSpellCastPayload,
  Dnd5eSpellMetamagicPayload,
} from '../../../lib/sharedCombatTypes'
import type {
  Dnd5eClassId,
  Dnd5eDamageType,
} from '../dnd5eCombatRules'

/** Browser targeting draft. It contains no authoritative combat result. */
export interface Dnd5eSpellTargetingSession {
  bonusActionCasting?: boolean
  characterId: string
  spellOriginAreaId?: string
  focusItemInstanceId?: string
  itemInstanceId?: string
  itemUseActionId?: string
  castingClassId?: Dnd5eClassId
  racialInnate?: boolean
  alternateResourceSpell?: Dnd5eSpellCastPayload['alternateResourceSpell']
  spellId: string
  slotLevel: number
  ritual?: true
  /** Closed Activity choices already validated against the registered schema. */
  activityChoices?: Record<string, string>
  /** Selected inventory identity is retained while choosing its owner/area. */
  activityInventoryInstanceId?: Dnd5eSpellCastPayload['activityInventoryInstanceId']
  activityInventorySelections?: Dnd5eSpellCastPayload['activityInventorySelections']
  activityGroundInventorySelections?: Dnd5eSpellCastPayload['activityGroundInventorySelections']
  activityInventoryCharacterId?: Dnd5eSpellCastPayload['activityInventoryCharacterId']
  expectedActivityInventoryRevision?: Dnd5eSpellCastPayload['expectedActivityInventoryRevision']
  secretPhrase?: Dnd5eSpellCastPayload['secretPhrase']
  magicMouth?: Dnd5eSpellCastPayload['magicMouth']
  communicationText?: string
  minorIllusion?: Dnd5eSpellCastPayload['minorIllusion']
  tinyHut?: Dnd5eSpellCastPayload['tinyHut']
  antipathySympathy?: Dnd5eSpellCastPayload['antipathySympathy']
  /** Exact lower bound declared by a scaled Activity creature target. */
  minimumTargets?: number
  maximumTargets: number
  allowDuplicateTargets: boolean
  targetTokenIds: string[]
  overchannel: boolean
  damageMaximizationFeatureId?: string
  empowered: boolean
  draconicResistance: boolean
  repellingBlast: boolean; graspOfHadar?: boolean
  canSculpt: boolean
  maximumSculptedTargets: number
  sculptedTargetIds: string[]
  sculpting: boolean
  metamagic?: Dnd5eSpellMetamagicPayload
  maximumCarefulTargets: number
  carefulTargetIds: string[]
  carefulSelecting: boolean
  heightenedTargetId?: string
  heightenedSelecting: boolean
  /** Host-declared persistent-area exemption picker exposed by the map UI. */
  areaExemptionMode?: 'unaffected' | 'trigger'
  excludedAreaTargetIds?: string[]
  excludingAreaTargets?: boolean
  guessedTargeting?: boolean
  area?: SkillAoeTargeting
  areaTargetCell?: GridCell
  /** Absolute elevation of the area origin or the aimed point, in feet. */
  targetElevationFeet?: number
  surfaceTargetMode?: 'horizontal' | 'vertical'
  verticalSurface?: Dnd5eSpellCastPayload['verticalSurface']
  verticalSurfacePreviewCells?: GridCell[]
  areaTargetCells?: GridCell[]
  dancingLightsForm?: Dnd5eSpellCastPayload['dancingLightsForm']
  areaTargetCount?: number
  minimumAreaTargetCount?: number
  /** Free-angle orientation for a generic rotatable rectangular template. */
  areaTargetAngleDegrees?: number
  areaTargetPitchDegrees?: number
  areaTargetRollDegrees?: number
  objectLaunchPitchDegrees?: number
  areaTargetRadiusFeet?: number
  areaTargetWidthFeet?: number
  /** Selected vertical extent; areaTargetHeightFeet is planar length. */
  areaTargetVolumeHeightFeet?: number
  areaTargetHeightFeet?: number
  areaTargetLengthFeet?: number
  stoneWall?: import('../../../rulesets/dnd5e/stoneWall').StoneWallLayout
  wallOfForceShape?: 'plane' | 'hemisphere' | 'sphere'
  wallOfFireShape?: 'line' | 'ring'
  wallOfFireAngleDegrees?: number
  wallOfFireDamagingSide?: 'left' | 'right' | 'inside' | 'outside'
  wallOfFireLengthFeet?: number
  wallOfFireDiameterFeet?: number
  bladeBarrierShape?: 'line' | 'ring'
  bladeBarrierAngleDegrees?: number
  bladeBarrierLengthFeet?: number
  bladeBarrierDiameterFeet?: number
  conditionChoice?: 'blinded' | 'deafened' | 'paralyzed' | 'poisoned' | 'disease'
  effectDamageType?: NonNullable<Dnd5eSpellCastPayload['effectDamageType']>
  enlargeReduceChoice?: NonNullable<Dnd5eSpellCastPayload['enlargeReduceChoice']>
  enhanceAbilityChoice?: NonNullable<Dnd5eSpellCastPayload['enhanceAbilityChoice']>
  calmEmotionsMode?: NonNullable<Dnd5eSpellCastPayload['calmEmotionsMode']>
  calmEmotionsIndifferenceScope?: NonNullable<Dnd5eSpellCastPayload['calmEmotionsIndifferenceScope']>
  sustainedEffectAttack?: NonNullable<Dnd5eSpellCastPayload['sustainedEffectAttack']>
  sustainedEffectAreaId?: string
  areaOriginCell?: GridCell
  higherSlotDamageType?: Dnd5eDamageType
  areaTargetSelected?: boolean
  autoSubmitOnAreaSelection?: boolean
  autoSculpt?: boolean
}
