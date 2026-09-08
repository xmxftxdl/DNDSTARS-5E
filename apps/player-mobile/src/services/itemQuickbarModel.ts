export const MOBILE_ITEM_QUICKBAR_SLOT_COUNT = 7

export function parseMobileItemQuickbar(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string').slice(0, MOBILE_ITEM_QUICKBAR_SLOT_COUNT)
      : []
  } catch {
    return []
  }
}

export function reconcileMobileItemQuickbar(current: readonly string[], validInstanceIds: ReadonlySet<string>): string[] {
  return Array.from({ length: MOBILE_ITEM_QUICKBAR_SLOT_COUNT }, (_, index) => {
    const id = current[index] ?? ''
    return validInstanceIds.has(id) ? id : ''
  })
}

export function assignMobileItemQuickbar(current: readonly string[], slot: number, instanceId: string): string[] {
  const next = Array.from({ length: MOBILE_ITEM_QUICKBAR_SLOT_COUNT }, (_, index) => current[index] ?? '')
  for (let index = 0; index < next.length; index += 1) if (next[index] === instanceId) next[index] = ''
  if (slot >= 0 && slot < next.length) next[slot] = instanceId
  return next
}
