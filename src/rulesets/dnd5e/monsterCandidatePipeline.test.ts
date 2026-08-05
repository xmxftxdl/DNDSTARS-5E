import { describe, expect, it } from 'vitest'
import type { MonsterDecisionCandidate } from './monsterDecisionContracts'
import { collectMonsterDecisionCandidates } from './monsterCandidatePipeline'

const candidate = (id: string): MonsterDecisionCandidate<{ id: string }> => ({
  id,
  kind: 'attack',
  payload: { id },
  metrics: {
    expectedDamage: 1,
    targetCurrentHp: 1,
    hitProbability: 1,
    targetDistanceFeet: 5,
    preferredDistanceFeet: 5,
    movementFeet: 0,
    distanceImprovementFeet: 0,
    defensiveCoverBonus: 0,
    opportunityAttackRisk: 0,
    attacksThisTurn: true,
    consumesAction: true,
    dodges: false,
    dashes: false,
    usesNimbleEscape: false,
    usesPreciseCoverRoute: false,
  },
})

describe('collectMonsterDecisionCandidates', () => {
  it('keeps generators isolated and rejects duplicate IDs', () => {
    const result = collectMonsterDecisionCandidates({}, [
      { id: 'attacks', generate: () => [candidate('a')] },
      { id: 'support', generate: () => [candidate('a'), candidate('b')] },
    ])
    expect(result.candidates.map((entry) => entry.id)).toEqual(['a', 'b'])
    expect(result.issues).toEqual([{ generatorId: 'support', reason: 'duplicate-candidate-id' }])
  })

  it('fails a broken generator closed without losing other legal candidates', () => {
    const result = collectMonsterDecisionCandidates({}, [
      { id: 'broken', generate: () => { throw new Error('bad') } },
      { id: 'attacks', generate: () => [candidate('a')] },
    ])
    expect(result.candidates).toHaveLength(1)
    expect(result.issues).toEqual([{ generatorId: 'broken', reason: 'generator-failed' }])
  })
})
