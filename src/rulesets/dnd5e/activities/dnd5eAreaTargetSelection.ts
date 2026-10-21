import type { Dnd5eActivityTargetV1 } from './dnd5eActivityContracts'

/** Selection is intent; eligibleIds must come from current Host geometry/perception. */
export function dnd5eAreaTargetSelectionValid(
  target: Dnd5eActivityTargetV1, eligibleIds: readonly string[], selectedIds: unknown,
): selectedIds is string[] {
  if (target.kind !== 'area' || target.selection !== 'choose-any' || !Array.isArray(selectedIds)) return false
  const eligible = new Set(eligibleIds)
  return selectedIds.length >= (target.minimumTargets ?? 0) &&
    selectedIds.length <= (target.maximumTargets ?? eligible.size) &&
    new Set(selectedIds).size === selectedIds.length &&
    selectedIds.every(id => typeof id === 'string' && eligible.has(id))
}
