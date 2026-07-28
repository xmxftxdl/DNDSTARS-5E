import { describe, expect, it } from 'vitest'
import {
  DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
  type MonsterDecisionMetrics,
} from './monsterDecisionProvider'
import {
  createDnd5eLearnedMonsterDecisionProvider,
  createDnd5eStrategyLearningAccumulator,
  finalizeDnd5eLearnedStrategy,
  observeDnd5eStrategyOutcome,
} from './monsterStrategyLearning'

function metrics(expectedDamage: number): MonsterDecisionMetrics {
  return {
    expectedDamage,
    targetCurrentHp: 20,
    targetMaximumHp: 20,
    hitProbability: expectedDamage > 0 ? 0.8 : 0,
    targetDistanceFeet: 5,
    preferredDistanceFeet: 5,
    movementFeet: 0,
    distanceImprovementFeet: 0,
    defensiveCoverBonus: 0,
    opportunityAttackRisk: 0,
    attacksThisTurn: expectedDamage > 0,
    consumesAction: true,
    dodges: expectedDamage === 0,
    dashes: false,
    usesNimbleEscape: false,
    usesPreciseCoverRoute: false,
  }
}

describe('D&D 5e learned monster strategy', () => {
  it('learns bounded contextual residuals without bypassing the base provider', () => {
    const accumulator = createDnd5eStrategyLearningAccumulator()
    for (let index = 0; index < 20; index += 1) {
      const strong = index % 2 === 0
      observeDnd5eStrategyOutcome(accumulator, {
        monsterId: 'test-monster',
        metrics: metrics(strong ? 18 : 0),
        damage: strong ? 18 : 0,
        hits: strong ? 1 : 0,
        executed: strong,
        defeatedTarget: strong && index % 4 === 0,
      })
    }
    const profile = finalizeDnd5eLearnedStrategy(accumulator, {
      trials: 20,
      seed: 7,
      trainedAt: 0,
    })
    expect(profile.monsters['test-monster']).toMatchObject({
      sampleCount: 20,
      confidence: expect.any(Number),
    })
    expect(profile.monsters['test-monster'].weights.damage).toBeGreaterThan(0)

    const context = {
      monsterId: 'test-monster',
      actorTokenId: 'token',
      currentHp: 20,
      maxHp: 20,
      tacticalRole: 'melee' as const,
      behaviorStyle: 'balanced' as const,
    }
    const candidate = {
      id: 'attack',
      kind: 'attack' as const,
      metrics: metrics(18),
    }
    const base = DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3.scoreCandidate(context, candidate)
    const learned = createDnd5eLearnedMonsterDecisionProvider(profile).scoreCandidate(context, candidate)
    expect(learned.candidateId).toBe(candidate.id)
    expect(learned.score).toBeGreaterThan(base.score)
    expect(learned.score - base.score).toBeLessThanOrEqual(12)
    expect(learned.reasons.at(-1)).toContain('离线策略修正')
  })

  it('keeps player coordination samples separate from the monster global policy', () => {
    const accumulator = createDnd5eStrategyLearningAccumulator()
    for (let index = 0; index < 12; index += 1) {
      observeDnd5eStrategyOutcome(accumulator, {
        monsterId: 'player:cleric',
        side: 'players',
        metrics: {
          ...metrics(0),
          supportValue: 18,
          allyEmergency: 0.9,
          affectedEnemyCount: 0,
          affectedAllyCount: 0,
        },
        damage: 0,
        healing: 12,
        hits: 0,
        executed: true,
        defeatedTarget: false,
        terminalReward: 1,
      })
    }
    const profile = finalizeDnd5eLearnedStrategy(accumulator, {
      trials: 12,
      seed: 8,
      trainedAt: 0,
    })
    expect(profile.global.sampleCount).toBe(0)
    expect(profile.monsters).toEqual({})
    expect(profile.players['player:cleric']).toMatchObject({
      sampleCount: 12,
      confidence: expect.any(Number),
    })
  })
})
