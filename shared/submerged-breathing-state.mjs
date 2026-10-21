/** Shared persistence validation for Host-owned 2014 breathing counters. */
export function normalizeDnd5eSubmergedBreathing(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const clock = value.combatClock
  if (clock != null && (typeof clock !== 'object' || Array.isArray(clock) ||
    Object.keys(clock).some(key => !['combatId', 'round'].includes(key)) || typeof clock.combatId !== 'string' ||
    !clock.combatId.length || clock.combatId.length > 256 || !Number.isSafeInteger(clock.round) || clock.round < 0)) return undefined
  if (Object.keys(value).some(key => !['schemaVersion', 'breathSeconds', 'breathCapacitySeconds', 'survivalSeconds', 'collapsed', 'lastStepKey', 'combatClock', 'campaignClockSeconds', 'pendingCollapseAtSeconds'].includes(key)) ||
    (value.pendingCollapseAtSeconds != null && (!value.collapsed || !Number.isSafeInteger(value.pendingCollapseAtSeconds) || value.pendingCollapseAtSeconds < 0)) ||
    (value.campaignClockSeconds != null && (!Number.isSafeInteger(value.campaignClockSeconds) || value.campaignClockSeconds < 0)) ||
    value.schemaVersion !== 1 || typeof value.collapsed !== 'boolean' ||
    typeof value.lastStepKey !== 'string' || !value.lastStepKey.length || value.lastStepKey.length > 512 ||
    !Number.isSafeInteger(value.breathSeconds) || value.breathSeconds < 0 || value.breathSeconds > 86_400 ||
    (value.breathCapacitySeconds != null && (!Number.isSafeInteger(value.breathCapacitySeconds) ||
      value.breathCapacitySeconds < 30 || value.breathCapacitySeconds > 86_400 || value.breathSeconds > value.breathCapacitySeconds)) ||
    !Number.isSafeInteger(value.survivalSeconds) || value.survivalSeconds < 0 || value.survivalSeconds > 60 ||
    (value.collapsed && (value.breathSeconds !== 0 || value.survivalSeconds !== 0))) return undefined
  return { schemaVersion: 1, breathSeconds: value.breathSeconds, survivalSeconds: value.survivalSeconds,
    collapsed: value.collapsed, lastStepKey: value.lastStepKey,
    ...(value.breathCapacitySeconds != null ? { breathCapacitySeconds: value.breathCapacitySeconds } : {}),
    ...(value.campaignClockSeconds != null ? { campaignClockSeconds: value.campaignClockSeconds } : {}),
    ...(value.pendingCollapseAtSeconds != null ? { pendingCollapseAtSeconds: value.pendingCollapseAtSeconds } : {}),
    ...(clock ? { combatClock: { combatId: clock.combatId, round: clock.round } } : {}) }
}

export function normalizeSubmergedBreathingEffectDeadlines(value) {
  if (!Array.isArray(value) || value.length > 2048) return undefined
  const seen = new Set()
  const result = []
  for (const entry of value) {
    if (!entry || Object.keys(entry).some(key => !['effectId', 'appliedAt', 'expiresAtSeconds'].includes(key)) ||
      typeof entry.effectId !== 'string' || !entry.effectId.length || entry.effectId.length > 2048 || seen.has(entry.effectId) ||
      !Number.isFinite(entry.appliedAt) || entry.appliedAt < 0 ||
      !Number.isSafeInteger(entry.expiresAtSeconds) || entry.expiresAtSeconds < 0) return undefined
    seen.add(entry.effectId)
    result.push({ effectId: entry.effectId, appliedAt: entry.appliedAt, expiresAtSeconds: entry.expiresAtSeconds })
  }
  return result
}
