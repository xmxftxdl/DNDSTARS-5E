import { dnd5eActivePlanarPhase, type Dnd5eActiveEffectInstance } from './activeEffects'

export function dnd5eActorEtherealAccess(
  state: { sceneEtherealAccess?: 'adjacent' | 'unavailable' | 'unknown' } | undefined,
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): 'available' | 'unavailable' | 'unknown' {
  if (dnd5eActivePlanarPhase(effects).plane === 'ethereal') return 'unavailable'
  return state?.sceneEtherealAccess === 'adjacent' ? 'available' : state?.sceneEtherealAccess ?? 'unknown'
}
