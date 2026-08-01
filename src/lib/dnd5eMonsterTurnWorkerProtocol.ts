import type { MapGeometryState } from './mapGeometry'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import type { Dnd5eMonsterStatBlock } from '../rulesets/dnd5e/monsters'
import type {
  Dnd5eMonsterTurnPlan,
  Dnd5eMonsterTurnPlannerOptions,
} from '../rulesets/dnd5e/monsterTurnPlanner'
import type { Dnd5eLearnedStrategyProfile } from '../rulesets/dnd5e/monsterStrategyLearning'

type PlannerSimulationOptimization = NonNullable<
  Dnd5eMonsterTurnPlannerOptions['simulationOptimization']
>

/**
 * Functions and main-thread caches cannot cross a structured-clone boundary.
 * A learned provider is represented by `learnedStrategy` and rebuilt in the
 * Worker; the Worker owns its own reachability cache.
 */
export type Dnd5eMonsterTurnWorkerPlannerOptions = Omit<
  Dnd5eMonsterTurnPlannerOptions,
  'decisionProvider' | 'simulationOptimization'
> & {
  simulationOptimization?: Omit<PlannerSimulationOptimization, 'reachabilityCache'>
}

/** A complete, immutable planning snapshot sent to the background Worker. */
export interface Dnd5eMonsterTurnWorkerInput {
  map: BattleMap
  enemy: Token
  characters: readonly Character[]
  geometry?: MapGeometryState
  /**
   * Encounter-local stat blocks, including custom and plugin monsters. Built-in
   * SRD entries need not be included, but accepting them is harmless.
   */
  monsterCatalog?: readonly Dnd5eMonsterStatBlock[]
  learnedStrategy?: Dnd5eLearnedStrategyProfile
  options?: Dnd5eMonsterTurnWorkerPlannerOptions
}

export interface Dnd5eMonsterTurnWorkerPlanRequest {
  type: 'plan'
  requestId: number
  input: Dnd5eMonsterTurnWorkerInput
}

export type Dnd5eMonsterTurnWorkerRequest = Dnd5eMonsterTurnWorkerPlanRequest

export type Dnd5eMonsterTurnWorkerResponse =
  | {
      type: 'planned'
      requestId: number
      plan: Dnd5eMonsterTurnPlan
    }
  | {
      type: 'failed'
      requestId: number
      error: string
    }
