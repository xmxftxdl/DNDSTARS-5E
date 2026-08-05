import type {
  MonsterDecisionCandidate,
  MonsterDecisionContext,
  MonsterDecisionProvider,
  MonsterDecisionScore,
  RankedMonsterDecision,
} from './monsterDecisionContracts'

function finiteScore(value: number): number {
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY
}

/** Host accepts scores only for candidate IDs that it generated. */
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
