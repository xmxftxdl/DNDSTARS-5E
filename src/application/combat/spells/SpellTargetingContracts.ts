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
  characterId: string
  castingClassId?: Dnd5eClassId
  racialInnate?: boolean
  spellId: string
  slotLevel: number
  maximumTargets: number
  allowDuplicateTargets: boolean
  targetTokenIds: string[]
  overchannel: boolean
  empowered: boolean
  draconicResistance: boolean
  repellingBlast: boolean
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
  guessedTargeting?: boolean
  area?: SkillAoeTargeting
  areaTargetCell?: GridCell
  areaTargetCells?: GridCell[]
  areaTargetCount?: number
  /** Free-angle orientation for a generic rotatable rectangular template. */
  areaTargetAngleDegrees?: number
  wallOfFireShape?: 'line' | 'ring'
  wallOfFireAngleDegrees?: number
  wallOfFireDamagingSide?: 'left' | 'right' | 'inside' | 'outside'
  conditionChoice?: 'blinded' | 'deafened' | 'paralyzed' | 'poisoned' | 'disease'
  effectDamageType?: NonNullable<Dnd5eSpellCastPayload['effectDamageType']>
  enlargeReduceChoice?: NonNullable<Dnd5eSpellCastPayload['enlargeReduceChoice']>
  enhanceAbilityChoice?: NonNullable<Dnd5eSpellCastPayload['enhanceAbilityChoice']>
  sustainedEffectAttack?: NonNullable<Dnd5eSpellCastPayload['sustainedEffectAttack']>
  sustainedEffectAreaId?: string
  areaOriginCell?: GridCell
  higherSlotDamageType?: Dnd5eDamageType
  areaTargetSelected?: boolean
  autoSubmitOnAreaSelection?: boolean
  autoSculpt?: boolean
}
