import {
  DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
  type MonsterDecisionMetrics,
  type MonsterDecisionProvider,
} from './monsterDecisionProvider'

export const DND5E_LEARNED_STRATEGY_SCHEMA_VERSION = 1

export type Dnd5eStrategyFeature =
  | 'damage'
  | 'hit'
  | 'finish'
  | 'priority'
  | 'threat'
  | 'control'
  | 'support'
  | 'coordination'
  | 'survival'
  | 'distance'
  | 'cover'
  | 'opportunityRisk'
  | 'resource'

const FEATURES: readonly Dnd5eStrategyFeature[] = [
  'damage', 'hit', 'finish', 'priority', 'threat', 'control',
  'support', 'coordination', 'survival', 'distance', 'cover', 'opportunityRisk', 'resource',
]

export interface Dnd5eLearnedMonsterStrategy {
  sampleCount: number
  confidence: number
  weights: Readonly<Partial<Record<Dnd5eStrategyFeature, number>>>
}

export interface Dnd5eLearnedStrategyProfile {
  schemaVersion: typeof DND5E_LEARNED_STRATEGY_SCHEMA_VERSION
  id: string
  baseProviderId: typeof DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3.id
  sourceTrials: number
  sourceSeed: number
  explorationRate: number
  terminalRewardWeight: number
  trainedAt: number
  global: Dnd5eLearnedMonsterStrategy
  monsters: Readonly<Record<string, Dnd5eLearnedMonsterStrategy>>
  players: Readonly<Record<string, Dnd5eLearnedMonsterStrategy>>
}

interface FeatureMoments {
  count: number
  rewardSum: number
  featureSum: Record<Dnd5eStrategyFeature, number>
  featureSquareSum: Record<Dnd5eStrategyFeature, number>
  featureRewardSum: Record<Dnd5eStrategyFeature, number>
}

export interface Dnd5eStrategyLearningAccumulator {
  global: FeatureMoments
  monsters: Map<string, FeatureMoments>
  players: Map<string, FeatureMoments>
}

function emptyFeatureRecord(): Record<Dnd5eStrategyFeature, number> {
  return Object.fromEntries(FEATURES.map((feature) => [feature, 0])) as Record<Dnd5eStrategyFeature, number>
}

function emptyMoments(): FeatureMoments {
  return {
    count: 0,
    rewardSum: 0,
    featureSum: emptyFeatureRecord(),
    featureSquareSum: emptyFeatureRecord(),
    featureRewardSum: emptyFeatureRecord(),
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : 0))
}

export function dnd5eStrategyFeatureVector(
  metrics: Readonly<MonsterDecisionMetrics>,
): Readonly<Record<Dnd5eStrategyFeature, number>> {
  const maximumHp = Math.max(1, metrics.targetMaximumHp ?? metrics.targetCurrentHp)
  return {
    damage: clamp(metrics.expectedDamage / 30, 0, 2),
    hit: clamp(metrics.hitProbability, 0, 1),
    finish: clamp(metrics.expectedDamage / Math.max(1, metrics.targetCurrentHp), 0, 2),
    priority: clamp(metrics.targetPriorityWeight ?? 0, 0, 1),
    threat: clamp(Math.log2(1 + Math.max(0, metrics.targetThreat ?? 0)) / 8, 0, 1),
    control: clamp((metrics.controlValue ?? 0) / 20, 0, 2),
    support: clamp((metrics.supportValue ?? 0) / 20, 0, 2),
    coordination: clamp(
      ((metrics.affectedEnemyCount ?? 0) - (metrics.affectedAllyCount ?? 0) * 2 +
        (metrics.allyEmergency ?? 0)) / 4,
      -1,
      2,
    ),
    survival: clamp((metrics.expectedIncomingDamage ?? 0) / maximumHp, 0, 2),
    distance: clamp(metrics.distanceImprovementFeet / 30, 0, 2),
    cover: clamp(metrics.defensiveCoverBonus / 5, 0, 1),
    opportunityRisk: clamp(metrics.opportunityAttackRisk / 3, 0, 1),
    resource: clamp((metrics.resourceCost ?? 0) / 20, 0, 2),
  }
}

export function createDnd5eStrategyLearningAccumulator(): Dnd5eStrategyLearningAccumulator {
  return { global: emptyMoments(), monsters: new Map(), players: new Map() }
}

function observeMoments(
  moments: FeatureMoments,
  metrics: Readonly<MonsterDecisionMetrics>,
  reward: number,
): void {
  const features = dnd5eStrategyFeatureVector(metrics)
  const boundedReward = clamp(reward, -4, 4)
  moments.count += 1
  moments.rewardSum += boundedReward
  for (const feature of FEATURES) {
    const value = features[feature]
    moments.featureSum[feature] += value
    moments.featureSquareSum[feature] += value * value
    moments.featureRewardSum[feature] += value * boundedReward
  }
}

export function observeDnd5eStrategyOutcome(
  accumulator: Dnd5eStrategyLearningAccumulator,
  input: {
    monsterId: string
    side?: 'players' | 'monsters'
    metrics: Readonly<MonsterDecisionMetrics>
    damage: number
    healing?: number
    hits: number
    executed: boolean
    defeatedTarget: boolean
    terminalReward?: number
  },
): void {
  const reward = (
    Math.max(0, input.damage) +
    Math.max(0, input.healing ?? 0) * 0.8 +
    Math.max(0, input.hits) * 2 +
    (input.defeatedTarget ? 18 : 0) +
    (input.executed ? 1 : -4)
  ) / 20 + (input.terminalReward ?? 0)
  if (input.side === 'players') {
    const playerMoments = accumulator.players.get(input.monsterId) ?? emptyMoments()
    observeMoments(playerMoments, input.metrics, reward)
    accumulator.players.set(input.monsterId, playerMoments)
    return
  }
  observeMoments(accumulator.global, input.metrics, reward)
  const monsterMoments = accumulator.monsters.get(input.monsterId) ?? emptyMoments()
  observeMoments(monsterMoments, input.metrics, reward)
  accumulator.monsters.set(input.monsterId, monsterMoments)
}

function strategyFromMoments(moments: FeatureMoments): Dnd5eLearnedMonsterStrategy {
  const count = moments.count
  const confidence = clamp(Math.sqrt(count) / 20, 0, 1)
  if (count < 8) return { sampleCount: count, confidence: 0, weights: {} }
  const rewardMean = moments.rewardSum / count
  const weights: Partial<Record<Dnd5eStrategyFeature, number>> = {}
  for (const feature of FEATURES) {
    const featureMean = moments.featureSum[feature] / count
    const variance = moments.featureSquareSum[feature] / count - featureMean * featureMean
    if (variance <= 1e-6) continue
    const covariance = moments.featureRewardSum[feature] / count - featureMean * rewardMean
    weights[feature] = Math.round(clamp(covariance / variance, -3, 3) * 1_000) / 1_000
  }
  return { sampleCount: count, confidence, weights }
}

export function finalizeDnd5eLearnedStrategy(
  accumulator: Dnd5eStrategyLearningAccumulator,
  input: {
    trials: number
    seed: number
    trainedAt?: number
    explorationRate?: number
    terminalRewardWeight?: number
  },
): Dnd5eLearnedStrategyProfile {
  return {
    schemaVersion: DND5E_LEARNED_STRATEGY_SCHEMA_VERSION,
    id: `dnd5e:learned-contextual-v1:${input.seed}:${input.trials}`,
    baseProviderId: DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3.id,
    sourceTrials: input.trials,
    sourceSeed: input.seed,
    explorationRate: clamp(input.explorationRate ?? 0, 0, 0.5),
    terminalRewardWeight: clamp(input.terminalRewardWeight ?? 0, 0, 4),
    trainedAt: input.trainedAt ?? Date.now(),
    global: strategyFromMoments(accumulator.global),
    monsters: Object.fromEntries(
      [...accumulator.monsters.entries()].map(([monsterId, moments]) => [
        monsterId,
        strategyFromMoments(moments),
      ]),
    ),
    players: Object.fromEntries(
      [...accumulator.players.entries()].map(([playerId, moments]) => [
        playerId,
        strategyFromMoments(moments),
      ]),
    ),
  }
}

function learnedResidual(
  strategy: Dnd5eLearnedMonsterStrategy,
  metrics: Readonly<MonsterDecisionMetrics>,
): number {
  if (strategy.confidence <= 0) return 0
  const features = dnd5eStrategyFeatureVector(metrics)
  const raw = FEATURES.reduce((total, feature) =>
    total + features[feature] * (strategy.weights[feature] ?? 0), 0)
  return clamp(raw * strategy.confidence * 4, -12, 12)
}

export function createDnd5eLearnedMonsterDecisionProvider(
  profile: Dnd5eLearnedStrategyProfile,
): MonsterDecisionProvider {
  return {
    id: profile.id,
    schemaVersion: 1,
    scoreCandidate(context, candidate) {
      const base = DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3.scoreCandidate(context, candidate)
      const strategy = context.monsterId.startsWith('player:')
        ? profile.players[context.monsterId] ?? profile.global
        : profile.monsters[context.monsterId] ?? profile.global
      const residual = learnedResidual(strategy, candidate.metrics)
      return {
        candidateId: candidate.id,
        score: base.score + residual,
        reasons: [
          ...base.reasons,
          `离线策略修正 ${residual >= 0 ? '+' : ''}${Math.round(residual * 10) / 10}（置信度 ${Math.round(strategy.confidence * 100)}%）`,
        ].slice(0, 12),
      }
    },
  }
}

const STORAGE_PREFIX = 'dndstars:dnd5e:learned-strategy:v1'

function storageKey(scopeId: string): string {
  return `${STORAGE_PREFIX}:${scopeId || 'local'}`
}

export function saveDnd5eLearnedStrategy(scopeId: string, profile: Dnd5eLearnedStrategyProfile): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false
  try {
    window.localStorage.setItem(storageKey(scopeId), JSON.stringify(profile))
    return true
  } catch {
    return false
  }
}

export function loadDnd5eLearnedStrategy(scopeId: string): Dnd5eLearnedStrategyProfile | undefined {
  if (typeof window === 'undefined' || !window.localStorage) return undefined
  try {
    const raw = window.localStorage.getItem(storageKey(scopeId))
    if (!raw) return undefined
    const value = JSON.parse(raw) as Partial<Dnd5eLearnedStrategyProfile>
    if (
      value.schemaVersion !== DND5E_LEARNED_STRATEGY_SCHEMA_VERSION ||
      typeof value.id !== 'string' ||
      value.baseProviderId !== DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3.id ||
      !value.global || !value.monsters
    ) return undefined
    return {
      ...value,
      players: value.players ?? {},
    } as Dnd5eLearnedStrategyProfile
  } catch {
    return undefined
  }
}

export function clearDnd5eLearnedStrategy(scopeId: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false
  try {
    window.localStorage.removeItem(storageKey(scopeId))
    return true
  } catch {
    return false
  }
}

export function dnd5eStrategyScopeId(input: { campaignId?: string; roomId?: string } | null): string {
  return input?.campaignId ?? input?.roomId ?? 'local'
}
