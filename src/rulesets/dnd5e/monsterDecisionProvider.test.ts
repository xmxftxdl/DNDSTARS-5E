import { describe, expect, it } from 'vitest'
import {
  DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V2,
  DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
  rankMonsterDecisionCandidates,
  type MonsterDecisionCandidate,
  type MonsterDecisionContext,
  type MonsterDecisionProvider,
} from './monsterDecisionProvider'

interface Payload {
  action: string
}

const context: MonsterDecisionContext = {
  monsterId: 'srd-5.1:goblin',
  actorTokenId: 'goblin',
  targetTokenId: 'hero',
  currentHp: 7,
  maxHp: 7,
  tacticalRole: 'skirmisher',
  behaviorStyle: 'balanced',
}

function candidate(
  id: string,
  patch: Partial<MonsterDecisionCandidate<Payload>['metrics']> = {},
): MonsterDecisionCandidate<Payload> {
  return {
    id,
    kind: 'attack',
    payload: { action: id },
    metrics: {
      expectedDamage: 0,
      targetCurrentHp: 20,
      hitProbability: 0,
      targetDistanceFeet: 30,
      preferredDistanceFeet: 30,
      movementFeet: 0,
      distanceImprovementFeet: 0,
      defensiveCoverBonus: 0,
      opportunityAttackRisk: 0,
      attacksThisTurn: false,
      consumesAction: true,
      dodges: false,
      dashes: false,
      usesNimbleEscape: false,
      usesPreciseCoverRoute: false,
      ...patch,
    },
  }
}

describe('MonsterDecisionProvider', () => {
  it('deterministically ranks a damaging attack above waiting defensively', () => {
    const ranked = rankMonsterDecisionCandidates(
      DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V2,
      context,
      [
        candidate('dodge', { dodges: true }),
        candidate('attack', {
          expectedDamage: 4,
          hitProbability: 0.65,
          attacksThisTurn: true,
        }),
      ],
    )
    expect(ranked.map((entry) => entry.candidate.id)).toEqual(['attack', 'dodge'])
    expect(ranked[0].reasons.join(' ')).toContain('期望伤害')
  })

  it('rejects a provider response that does not match the Host candidate id', () => {
    const untrusted: MonsterDecisionProvider = {
      id: 'local-model',
      schemaVersion: 1,
      scoreCandidate: () => ({ candidateId: 'forged-action', score: 1_000_000, reasons: [] }),
    }
    const ranked = rankMonsterDecisionCandidates(untrusted, context, [candidate('host-action')])
    expect(ranked[0]).toMatchObject({
      candidate: { id: 'host-action' },
      score: Number.NEGATIVE_INFINITY,
    })
  })

  it('uses candidate id as the stable final tie breaker', () => {
    const tied: MonsterDecisionProvider = {
      id: 'tie',
      schemaVersion: 1,
      scoreCandidate: (_decisionContext, entry) => ({
        candidateId: entry.id,
        score: 10,
        reasons: [],
      }),
    }
    expect(rankMonsterDecisionCandidates(tied, context, [candidate('b'), candidate('a')])
      .map((entry) => entry.candidate.id)).toEqual(['a', 'b'])
  })

  it('fails closed when a decision provider throws', () => {
    const broken: MonsterDecisionProvider = {
      id: 'broken',
      schemaVersion: 1,
      scoreCandidate: () => {
        throw new Error('model unavailable')
      },
    }
    const ranked = rankMonsterDecisionCandidates(broken, context, [candidate('host-action')])
    expect(ranked[0].score).toBe(Number.NEGATIVE_INFINITY)
    expect(ranked[0].reasons.join(' ')).toContain('Host 已拒绝')
  })

  it('changes the ranking weights for aggressive and defensive behavior styles', () => {
    const options = [
      candidate('open-shot', {
        expectedDamage: 5,
        hitProbability: 0.7,
        attacksThisTurn: true,
      }),
      candidate('covered-shot', {
        expectedDamage: 4,
        hitProbability: 0.6,
        attacksThisTurn: true,
        defensiveCoverBonus: 5,
        usesPreciseCoverRoute: true,
      }),
    ]
    const aggressive = rankMonsterDecisionCandidates(
      DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V2,
      { ...context, behaviorStyle: 'aggressive' },
      options,
    )
    const defensive = rankMonsterDecisionCandidates(
      DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V2,
      { ...context, behaviorStyle: 'defensive' },
      options,
    )
    expect(aggressive[0].candidate.id).toBe('open-shot')
    expect(defensive[0].candidate.id).toBe('covered-shot')
  })

  it('V3 compares target priority, concentration and survival risk without creating actions', () => {
    const ranked = rankMonsterDecisionCandidates(
      DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
      context,
      [
        candidate('ordinary-target', {
          expectedDamage: 5,
          hitProbability: 0.7,
          attacksThisTurn: true,
          targetMaximumHp: 20,
        }),
        candidate('ordered-concentrator', {
          expectedDamage: 4,
          hitProbability: 0.65,
          attacksThisTurn: true,
          targetMaximumHp: 20,
          targetPriorityWeight: 1,
          targetConcentrating: true,
        }),
        candidate('unsafe-route', {
          expectedDamage: 6,
          hitProbability: 0.75,
          attacksThisTurn: true,
          targetMaximumHp: 20,
          expectedIncomingDamage: 30,
        }),
      ],
    )
    expect(ranked[0].candidate.id).toBe('ordered-concentrator')
    expect(ranked[0].reasons.join(' ')).toContain('专注')
    expect(ranked.at(-1)?.candidate.id).toBe('unsafe-route')
  })

  it('treats signed control utility as a benefit for enemies and a penalty for allies', () => {
    const ranked = rankMonsterDecisionCandidates(
      DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
      context,
      [
        candidate('friendly-control', { controlValue: -12 }),
        candidate('neutral-control', { controlValue: 0 }),
        candidate('hostile-control', { controlValue: 12 }),
      ],
    )

    expect(ranked.map((entry) => entry.candidate.id)).toEqual([
      'hostile-control',
      'neutral-control',
      'friendly-control',
    ])
    expect(ranked.at(-1)?.reasons.join(' ')).toContain('友方')
  })
})
