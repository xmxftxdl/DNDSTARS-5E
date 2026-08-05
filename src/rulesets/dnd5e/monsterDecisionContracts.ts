import type { Dnd5eMonsterBehaviorStyle } from './monsters'

/** A provider scores only Host-generated legal candidates. */
export interface MonsterDecisionContext {
  monsterId: string
  actorTokenId: string
  targetTokenId?: string
  currentHp: number
  maxHp: number
  tacticalRole: 'melee' | 'ranged' | 'skirmisher'
  behaviorStyle: Dnd5eMonsterBehaviorStyle
}

export interface MonsterDecisionMetrics {
  expectedDamage: number
  targetCurrentHp: number
  targetMaximumHp?: number
  targetArmorClass?: number
  targetPriorityWeight?: number
  targetThreat?: number
  targetConcentrating?: boolean
  targetSupportCount?: number
  expectedIncomingDamage?: number
  controlValue?: number
  supportValue?: number
  affectedEnemyCount?: number
  affectedAllyCount?: number
  allyEmergency?: number
  resourceCost?: number
  hitProbability: number
  targetDistanceFeet: number
  preferredDistanceFeet: number
  movementFeet: number
  distanceImprovementFeet: number
  defensiveCoverBonus: number
  opportunityAttackRisk: number
  attacksThisTurn: boolean
  consumesAction: boolean
  dodges: boolean
  dashes: boolean
  usesNimbleEscape: boolean
  usesPreciseCoverRoute: boolean
}

export type MonsterDecisionCandidateKind =
  | 'attack'
  | 'move-attack'
  | 'retreat-attack'
  | 'spell'
  | 'move-spell'
  | 'retreat-spell'
  | 'area-action'
  | 'move-area-action'
  | 'retreat-area-action'
  | 'control'
  | 'move-control'
  | 'retreat-control'
  | 'heal'
  | 'support'
  | 'dash'
  | 'move-dodge'
  | 'dodge'

export interface MonsterDecisionCandidate<TPayload> {
  id: string
  kind: MonsterDecisionCandidateKind
  payload: TPayload
  metrics: MonsterDecisionMetrics
}

export type MonsterDecisionCandidateView = Readonly<{
  id: string
  kind: MonsterDecisionCandidateKind
  metrics: Readonly<MonsterDecisionMetrics>
}>

export interface MonsterDecisionScore {
  candidateId: string
  score: number
  reasons: readonly string[]
}

export interface MonsterDecisionProvider {
  readonly id: string
  readonly schemaVersion: 1
  scoreCandidate(
    context: Readonly<MonsterDecisionContext>,
    candidate: MonsterDecisionCandidateView,
  ): MonsterDecisionScore
}

export interface RankedMonsterDecision<TPayload> {
  candidate: MonsterDecisionCandidate<TPayload>
  score: number
  reasons: readonly string[]
}
