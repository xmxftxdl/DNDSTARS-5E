import type { MonsterDecisionCandidate } from './monsterDecisionContracts'

export interface MonsterCandidateGenerator<TContext, TPayload> {
  id: string
  enabled?: (context: Readonly<TContext>) => boolean
  generate: (context: Readonly<TContext>) => readonly MonsterDecisionCandidate<TPayload>[]
}

export interface MonsterCandidateGenerationIssue {
  generatorId: string
  reason: 'generator-failed' | 'duplicate-candidate-id'
}

export interface MonsterCandidatePipelineResult<TPayload> {
  candidates: MonsterDecisionCandidate<TPayload>[]
  issues: MonsterCandidateGenerationIssue[]
}

/**
 * Runs independent candidate generators without granting any of them write
 * access to combat state. Duplicate IDs and generator failures fail closed.
 */
export function collectMonsterDecisionCandidates<TContext, TPayload>(
  context: Readonly<TContext>,
  generators: readonly MonsterCandidateGenerator<TContext, TPayload>[],
): MonsterCandidatePipelineResult<TPayload> {
  const candidates: MonsterDecisionCandidate<TPayload>[] = []
  const issues: MonsterCandidateGenerationIssue[] = []
  const ids = new Set<string>()
  for (const generator of generators) {
    if (generator.enabled && !generator.enabled(context)) continue
    let generated: readonly MonsterDecisionCandidate<TPayload>[]
    try {
      generated = generator.generate(context)
    } catch {
      issues.push({ generatorId: generator.id, reason: 'generator-failed' })
      continue
    }
    for (const candidate of generated) {
      if (!candidate.id || ids.has(candidate.id)) {
        issues.push({ generatorId: generator.id, reason: 'duplicate-candidate-id' })
        continue
      }
      ids.add(candidate.id)
      candidates.push(candidate)
    }
  }
  return { candidates, issues }
}
