import { effectiveDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from './activeEffects'

/** Recomputed from the actual defender; never transfers a previous target's modifier. */
export function dnd5eTargetCriticalThreshold(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined, sourceId: string | undefined, base = 20,
): number {
  let threshold = Math.min(20, Math.max(2, Math.floor(base)))
  if (!sourceId) return threshold
  for (const effect of effectiveDnd5eActiveEffects(effects)) {
    const value = effect.modifiers?.attacksBySourceCriticalThreshold
    if (effect.source.actorId === sourceId && typeof value === 'number' && Number.isInteger(value) && value >= 2 && value <= 20) {
      threshold = Math.min(threshold, value)
    }
  }
  return threshold
}
