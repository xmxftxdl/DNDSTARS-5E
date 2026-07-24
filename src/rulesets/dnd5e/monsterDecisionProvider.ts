import type { Dnd5eMonsterBehaviorStyle } from './monsters'

/**
 * 决策器只能给 Host 已生成的合法候选方案评分。
 * 它不能创建移动、目标或攻击，也不能直接修改战斗状态。
 */
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
  hitProbability: number
  targetDistanceFeet: number
  preferredDistanceFeet: number
  movementFeet: number
  distanceImprovementFeet: number
  /** 仅统计当前主要目标反向攻击该落点时得到的精确掩护。 */
  defensiveCoverBonus: number
  /** 未使用撤离时，沿本次路线离开威胁范围的敌人数。 */
  opportunityAttackRisk: number
  attacksThisTurn: boolean
  consumesAction: boolean
  dodges: boolean
  dashes: boolean
  usesNimbleEscape: boolean
  usesPreciseCoverRoute: boolean
}

export interface MonsterDecisionCandidate<TPayload> {
  id: string
  kind: 'attack' | 'move-attack' | 'retreat-attack' | 'dash' | 'move-dodge' | 'dodge'
  payload: TPayload
  metrics: MonsterDecisionMetrics
}

export type MonsterDecisionCandidateView = Readonly<{
  id: string
  kind: MonsterDecisionCandidate<unknown>['kind']
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

function finiteScore(value: number): number {
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY
}

/**
 * Host 只接受与现有候选 ID 完全匹配的评分结果；无效分数不会获得执行机会。
 */
export function rankMonsterDecisionCandidates<TPayload>(
  provider: MonsterDecisionProvider,
  context: MonsterDecisionContext,
  candidates: readonly MonsterDecisionCandidate<TPayload>[],
): RankedMonsterDecision<TPayload>[] {
  const unique = new Map<string, MonsterDecisionCandidate<TPayload>>()
  for (const candidate of candidates) {
    if (!candidate.id || unique.has(candidate.id)) continue
    unique.set(candidate.id, candidate)
  }
  return [...unique.values()]
    .map((candidate) => {
      let scored: MonsterDecisionScore
      try {
        scored = provider.scoreCandidate(
          Object.freeze({ ...context }),
          Object.freeze({
            id: candidate.id,
            kind: candidate.kind,
            metrics: Object.freeze({ ...candidate.metrics }),
          }),
        )
      } catch {
        scored = {
          candidateId: candidate.id,
          score: Number.NEGATIVE_INFINITY,
          reasons: ['评分器执行失败，Host 已拒绝该分数。'],
        }
      }
      const score = scored.candidateId === candidate.id
        ? finiteScore(scored.score)
        : Number.NEGATIVE_INFINITY
      const reasons = Array.isArray(scored.reasons)
        ? scored.reasons
            .filter((reason): reason is string => typeof reason === 'string')
            .slice(0, 12)
            .map((reason) => reason.slice(0, 240))
        : []
      return {
        candidate,
        score,
        reasons: scored.candidateId === candidate.id ? reasons : ['评分器返回了未知候选 ID。'],
      }
    })
    .sort((left, right) => right.score - left.score || left.candidate.id.localeCompare(right.candidate.id))
}

function rounded(value: number): string {
  return (Math.round(value * 10) / 10).toString()
}

interface BehaviorWeights {
  damage: number
  cover: number
  opportunityRisk: number
  distance: number
  dodge: number
  dash: number
  retreat: number
}

const BEHAVIOR_WEIGHTS: Readonly<Record<Dnd5eMonsterBehaviorStyle, BehaviorWeights>> = {
  balanced: { damage: 1, cover: 1, opportunityRisk: 1, distance: 1, dodge: 1, dash: 1, retreat: 0 },
  aggressive: { damage: 1.25, cover: 0.55, opportunityRisk: 0.6, distance: 1.05, dodge: 0.5, dash: 1.25, retreat: -3 },
  defensive: { damage: 0.9, cover: 1.8, opportunityRisk: 1.45, distance: 1.15, dodge: 1.45, dash: 0.8, retreat: 3 },
  skirmisher: { damage: 1.05, cover: 1.5, opportunityRisk: 1.55, distance: 1.45, dodge: 1, dash: 0.9, retreat: 5 },
  cowardly: { damage: 0.72, cover: 2.1, opportunityRisk: 1.9, distance: 1.7, dodge: 1.8, dash: 1.2, retreat: 8 },
}

/**
 * 可预测、可测试的 Tactical Planner V2 效用评分器。
 * 分数只用于排序；命中、掩护、行动经济和伤害仍由 Headless 结算。
 */
export const DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V2: MonsterDecisionProvider = {
  id: 'dnd5e:deterministic-tactical-v2',
  schemaVersion: 1,
  scoreCandidate(context, candidate) {
    const metrics = candidate.metrics
    const weights = BEHAVIOR_WEIGHTS[context.behaviorStyle]
    const reasons: string[] = [`行为风格：${context.behaviorStyle}`]
    let score = 0

    if (metrics.attacksThisTurn) {
      const damageValue = metrics.expectedDamage * 8 * weights.damage
      score += 30 * weights.damage + damageValue
      reasons.push(`本回合可攻击，期望伤害 ${rounded(metrics.expectedDamage)}`)
      if (metrics.targetCurrentHp > 0) {
        const finishingChance = Math.min(1, metrics.expectedDamage / metrics.targetCurrentHp)
        score += finishingChance * 18 * weights.damage
        if (finishingChance >= 0.75) reasons.push('具有较高的击倒目标机会')
      }
      score += metrics.hitProbability * 6 * weights.damage
    }

    if (metrics.defensiveCoverBonus > 0) {
      score += metrics.defensiveCoverBonus * 2.5 * weights.cover
      reasons.push(`精确掩护路线提供 +${metrics.defensiveCoverBonus} AC 防御收益`)
    }

    if (metrics.opportunityAttackRisk > 0) {
      const penalty = metrics.opportunityAttackRisk * 24 * weights.opportunityRisk
      score -= penalty
      reasons.push(`路线可能承受 ${metrics.opportunityAttackRisk} 次借机攻击`)
    }

    if (metrics.usesNimbleEscape) {
      score += 8 + (context.behaviorStyle === 'skirmisher' ? 5 : 0)
      reasons.push('以附赠动作使用灵巧脱逃，路线不触发借机攻击')
    }

    const preferredDistanceError = Math.max(
      0,
      Math.abs(metrics.targetDistanceFeet - metrics.preferredDistanceFeet) - 5,
    )
    score -= preferredDistanceError * (metrics.attacksThisTurn ? 0.12 : 0.04) * weights.distance
    if (metrics.distanceImprovementFeet > 0) {
      score += metrics.distanceImprovementFeet * (metrics.dashes ? 0.7 : 0.22) * weights.distance
      reasons.push(`改善与目标的战术距离 ${rounded(metrics.distanceImprovementFeet)} 尺`)
    }
    score -= metrics.movementFeet * 0.035

    if (candidate.kind === 'retreat-attack') score += weights.retreat
    if (metrics.dodges) {
      score += 9 * weights.dodge
      reasons.push('无法形成更高收益攻击时采取闪避')
    }
    if (metrics.dashes) {
      score += 4 * weights.dash
      reasons.push('使用疾走建立下一回合威胁')
    }

    const hpRatio = Math.max(0, Math.min(1, context.currentHp / Math.max(1, context.maxHp)))
    if (context.behaviorStyle === 'cowardly' && hpRatio < 0.5) {
      if (candidate.kind === 'retreat-attack' || metrics.dodges) {
        score += (1 - hpRatio) * 30
        reasons.push('低生命值下优先保全自身')
      }
      if (metrics.usesPreciseCoverRoute) score += (1 - hpRatio) * 12
    }

    if (metrics.consumesAction && !metrics.attacksThisTurn && !metrics.dodges && !metrics.dashes) {
      score -= 10
    }

    return { candidateId: candidate.id, score, reasons }
  },
}
