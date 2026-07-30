import type {
  Dnd5eMonsterAction,
  Dnd5eMonsterStatBlock,
} from './monsters'
import {
  dnd5eMonsterMultiattackRuntimeActionIds,
  type Dnd5eMonsterRuntimeMultiattackActor,
} from './monsterDynamicMultiattack'
import { dnd5eMonsterCompositeStepSkipPolicy } from './monsterCompositeMultiattack'

export interface Dnd5eMonsterActionResourceState {
  rechargeReadyByActionId?: Readonly<Record<string, boolean>>
  usesByActionId?: Readonly<Record<string, { current: number; max: number }>>
}

/**
 * Resources belong to the referenced child action, not the Multiattack
 * wrapper. Repeated ids intentionally remain repeated: three Tail Spikes
 * consume three of a Manticore's 24 daily spikes in one atomic transaction.
 */
export function dnd5eMonsterMultiattackChildUsageCounts(
  monster:
    Pick<Dnd5eMonsterStatBlock, 'actions'> &
    Partial<Pick<Dnd5eMonsterStatBlock, 'id' | 'slug'>>,
  action: Pick<Dnd5eMonsterAction, 'id' | 'kind' | 'sequence' | 'randomRepeat'>,
  randomRepeatCount?: number,
  actor?: Dnd5eMonsterRuntimeMultiattackActor,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  if (action.kind !== 'multiattack') return counts
  const actionIds = dnd5eMonsterMultiattackRuntimeActionIds({
    monster,
    action,
    actor,
    randomRepeatCount,
    unresolvedRandomRepeat: 'maximum',
  }) ?? []
  for (const actionId of actionIds) {
    const child = monster.actions.find((candidate) => candidate.id === actionId)
    if (!child?.usage) continue
    counts.set(actionId, (counts.get(actionId) ?? 0) + 1)
  }
  return counts
}

export function dnd5eMonsterMultiattackChildResourcesAvailable(
  monster:
    Pick<Dnd5eMonsterStatBlock, 'actions'> &
    Partial<Pick<Dnd5eMonsterStatBlock, 'id' | 'slug'>>,
  action: Pick<Dnd5eMonsterAction, 'id' | 'kind' | 'sequence' | 'randomRepeat'>,
  resources: Dnd5eMonsterActionResourceState,
  actor?: Dnd5eMonsterRuntimeMultiattackActor,
): boolean {
  const requiredCounts = new Map<string, number>()
  const actionIds = dnd5eMonsterMultiattackRuntimeActionIds({
    monster,
    action,
    actor,
    unresolvedRandomRepeat: 'maximum',
  }) ?? []
  for (const [sequenceIndex, actionId] of actionIds.entries()) {
    if (
      monster.id != null &&
      dnd5eMonsterCompositeStepSkipPolicy(
        monster.id,
        action.id,
        sequenceIndex,
      ) === 'when-resource-unavailable'
    ) continue
    requiredCounts.set(actionId, (requiredCounts.get(actionId) ?? 0) + 1)
  }
  for (const [actionId, requiredUses] of requiredCounts) {
    const child = monster.actions.find((candidate) => candidate.id === actionId)
    if (child?.usage?.kind === 'recharge') {
      if (
        requiredUses !== 1 ||
        resources.rechargeReadyByActionId?.[actionId] === false
      ) return false
    } else if (child?.usage?.kind === 'per-day') {
      const remaining = resources.usesByActionId?.[actionId]?.current ??
        child.usage.max
      if (remaining < requiredUses) return false
    }
  }
  return true
}
