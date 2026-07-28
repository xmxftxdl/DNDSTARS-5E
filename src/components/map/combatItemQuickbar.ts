export const COMBAT_ITEM_QUICK_SLOT_COUNT = 7 as const

export interface CombatItemQuickbarPreferenceV1 {
  schemaVersion: 1
  slots: Array<string | null>
}

function uniqueInventoryIds(inventoryIds: readonly string[]): string[] {
  return [...new Set(inventoryIds.filter((id) => typeof id === 'string' && id.length > 0))]
}

export function reconcileCombatItemQuickbarPreference(
  preference: CombatItemQuickbarPreferenceV1 | undefined,
  inventoryIds: readonly string[],
): CombatItemQuickbarPreferenceV1 {
  const validIds = uniqueInventoryIds(inventoryIds)
  const validIdSet = new Set(validIds)
  if (!preference) {
    return {
      schemaVersion: 1,
      slots: Array.from(
        { length: COMBAT_ITEM_QUICK_SLOT_COUNT },
        (_, index) => validIds[index] ?? null,
      ),
    }
  }

  const seen = new Set<string>()
  return {
    schemaVersion: 1,
    slots: Array.from({ length: COMBAT_ITEM_QUICK_SLOT_COUNT }, (_, index) => {
      const instanceId = preference.slots[index]
      if (!instanceId || !validIdSet.has(instanceId) || seen.has(instanceId)) return null
      seen.add(instanceId)
      return instanceId
    }),
  }
}

/**
 * 将物品放进目标槽位。物品已位于另一槽时交换两个槽位；物品只在背包中时，
 * 目标槽原物品回到背包，避免同一实例同时出现在多个快捷槽。
 */
export function assignCombatItemQuickbarSlot(
  slots: readonly (string | null)[],
  instanceId: string,
  targetIndex: number,
): Array<string | null> {
  if (
    !instanceId ||
    !Number.isInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= COMBAT_ITEM_QUICK_SLOT_COUNT
  ) return [...slots]

  const next = Array.from(
    { length: COMBAT_ITEM_QUICK_SLOT_COUNT },
    (_, index) => slots[index] ?? null,
  )
  const sourceIndex = next.indexOf(instanceId)
  if (sourceIndex === targetIndex) return next

  const displaced = next[targetIndex]
  next[targetIndex] = instanceId
  if (sourceIndex >= 0) next[sourceIndex] = displaced
  return next
}

export function clearCombatItemQuickbarSlot(
  slots: readonly (string | null)[],
  targetIndex: number,
): Array<string | null> {
  const next = Array.from(
    { length: COMBAT_ITEM_QUICK_SLOT_COUNT },
    (_, index) => slots[index] ?? null,
  )
  if (
    Number.isInteger(targetIndex) &&
    targetIndex >= 0 &&
    targetIndex < COMBAT_ITEM_QUICK_SLOT_COUNT
  ) next[targetIndex] = null
  return next
}
