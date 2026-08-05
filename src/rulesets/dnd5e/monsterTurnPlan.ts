import type { AbilityKey } from '../../lib/dnd'
import type { GridCell } from '../../lib/gridCombat'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { Dnd5eStandardConditionId } from './conditions'
import type {
  MonsterDecisionMetrics,
  MonsterDecisionProvider,
} from './monsterDecisionContracts'
import type { Dnd5eDamageType } from './monsters'
import type { Dnd5eSrdSpellDefinition } from './spells'

/** Pure result contract shared by planning, workers and map settlement. */
export interface Dnd5eMonsterTurnPlan {
  moved: boolean
  dashed?: boolean
  dodged?: boolean
  nimbleEscape?: 'disengage'
  moveApSpent?: number
  newPosition?: { x: number; y: number }
  newElevationFeet?: number
  movementMode?: 'walk' | 'fly'
  attacked: boolean
  spellCast?: {
    spellId: string
    spellName: string
    slotLevel: number
    targetTokenIds: readonly string[]
    projectileTargetIds?: readonly string[]
    effect: Dnd5eSrdSpellDefinition['effect']
    diceCount: number
    diceSides: number
    castingTime: Dnd5eSrdSpellDefinition['castingTime']
    saveAbility?: Dnd5eSrdSpellDefinition['saveAbility']
    area?: Dnd5eSrdSpellDefinition['area']
    areaTargetCell?: GridCell
    areaTargetOrientation?: 0 | 1 | 2 | 3
    areaTargetElevationFeet?: number
    conditionChoice?: 'blinded' | 'deafened' | 'paralyzed' | 'poisoned' | 'disease'
  }
  specialAction?:
    | {
        kind: 'healing-touch'
        actionId: string
        actionName: string
        targetTokenId: string
        healing: { diceCount: number; diceSides: number; bonus: number }
      }
    | {
        kind: 'teleport'
        actionId: string
        actionName: string
        destinationCell: GridCell
        destinationElevationFeet: number
      }
    | {
        kind: 'invisibility'
        actionId: string
        actionName: string
      }
  areaAction?: {
    actionId: string
    variantId?: string
    actionName: string
    targetTokenIds: readonly string[]
    area: SkillAoeTargeting
    areaTargetCell: GridCell
    areaTargetOrientation?: 0 | 1 | 2 | 3
    areaTargetElevationFeet?: number
    saveAbility: AbilityKey
    saveDc: number
    damage?: {
      diceCount: number
      diceSides: number
      damageBonus: number
      damageType: Dnd5eDamageType
    }
    conditionOnFailedSave?: {
      condition: Dnd5eStandardConditionId
      durationRounds: number
    }
  }
  escapeActiveEffect?: { effectId: string; dc: number }
  escapeGrapple?: { grapplerId: string }
  releaseGrapple?: { targetId: string; effectId: string }
  attackerTokenId?: string
  targetTokenId?: string
  attackTargetTokenIds?: readonly string[]
  actionIndex?: number
  attack?: {
    values: number[]
    sides: number
    bonus: number
    total: number
    label: string
    targetName: string
  }
  damageType?: 'physical'
  targetCharacterId?: string
  damage?: number
  message: string
  decision?: {
    providerId: string
    candidateId: string
    candidateCount: number
    score: number
    reasons: readonly string[]
    metrics?: Readonly<MonsterDecisionMetrics>
  }
}

export interface Dnd5eMonsterSimulationReachablePosition {
  cell: GridCell
  steps: number
  position: { x: number; y: number }
}

export interface Dnd5eMonsterSimulationRuntimeCache {
  reachablePositions: Map<string, readonly Dnd5eMonsterSimulationReachablePosition[]>
}

export interface Dnd5eMonsterTurnPlannerOptions {
  decisionProvider?: MonsterDecisionProvider
  turnEconomy?: Dnd5eTurnEconomyCounts
  requiredActionId?: string
  requiredTargetId?: string
  excludedTargetIds?: readonly string[]
  movementBudgetFeet?: number
  combatId?: string
  round?: number
  simulationOptimization?: {
    maxReachablePositions?: number
    approximateCandidateRoutes?: boolean
    skipDashWhenAttackAvailable?: boolean
    skipFinalRouteValidation?: boolean
    candidateRouteSearch?: 'shared-tree' | 'per-destination'
    candidateRouteTreeMaximumVisited?: number
    reachabilityCache?: Dnd5eMonsterSimulationRuntimeCache
  }
}
