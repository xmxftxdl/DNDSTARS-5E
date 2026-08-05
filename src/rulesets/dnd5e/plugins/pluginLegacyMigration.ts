import type {
  DeclarativeSubclassAbilityV1,
  DeclarativeSubclassTargetingV1,
} from '../declarativeSubclassAbility'

export interface LegacyDnd5eFeatureActionV0 {
  id: string
  name: string
  description: string
  level?: number
  automation?: 'full' | 'partial' | 'manual'
  action?: {
    economy?: 'action' | 'bonusAction' | 'reaction' | 'none'
    targeting?: DeclarativeSubclassTargetingV1
  }
}

/**
 * Converts V0 feature/action data without inventing mechanics that the old
 * format never declared. The result therefore degrades to partial/manual.
 */
export function migrateLegacyFeatureActionToDeclarativeV1(
  input: LegacyDnd5eFeatureActionV0,
): DeclarativeSubclassAbilityV1 {
  return {
    schemaVersion: 1,
    id: input.id,
    name: input.name,
    description: input.description,
    level: Math.max(1, Math.min(20, Math.floor(input.level ?? 1))),
    trigger: { kind: 'active-use' },
    cost: { economy: input.action?.economy ?? 'none' },
    targeting: input.action?.targeting ?? { kind: 'self' },
    effects: [{
      kind: 'temporary-hit-points',
      target: 'actor',
      amount: { kind: 'fixed', value: 0 },
    }],
    automation: input.action ? 'partial' : 'manual',
  }
}
