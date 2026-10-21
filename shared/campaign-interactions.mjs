const LIMIT = 128
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 160 && value.trim() === value
const integer = value => Number.isSafeInteger(value) && value >= 0
const fields = ['id', 'sourceId', 'bearerId', 'effectId', 'packageId', 'requiredRounds']

/** Identity/effect check against server-read state, never the mutation payload. */
export function campaignInteractionReferenceIssue(request, entities) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return 'invalid-interaction-start'
  if (!Array.isArray(entities)) return 'interaction-snapshot-required'
  const sources = entities.filter(entity => entity?.id === request.sourceId)
  const bearers = entities.filter(entity => entity?.id === request.bearerId)
  if (sources.length !== 1 || bearers.length !== 1) return 'interaction-participant-unavailable'
  const effects = (Array.isArray(bearers[0].effects) ? bearers[0].effects : []).filter(effect => effect?.id === request.effectId)
  if (effects.length !== 1) return 'interaction-effect-unavailable'
  const effect = effects[0]
  if (effect.source?.actorId !== request.sourceId || effect.source?.pluginId !== request.packageId ||
      !effect.completionGrant || effect.duration?.type !== 'rounds' ||
      effect.duration.remainingRounds !== request.requiredRounds || effect.suspendedBy?.length) return 'interaction-effect-mismatch'
  return null
}

export function validCampaignInteractions(value, worldMinute, advances) {
  if (value == null) return true
  if (!Array.isArray(value) || value.length > LIMIT || new Set(value.map(row => row?.id)).size !== value.length) return false
  return value.every(row => row && typeof row === 'object' && !Array.isArray(row) &&
    fields.slice(0, 5).every(key => id(row[key])) && integer(row.requiredRounds) && row.requiredRounds >= 1 && row.requiredRounds <= 14400 &&
    integer(row.startedAtWorldMinute) && row.startedAtWorldMinute <= worldMinute &&
    integer(row.createdAt) && id(row.startedByMemberId) &&
    (row.status === 'completed' ?
      integer(row.completedAtWorldMinute) && row.completedAtWorldMinute >= row.startedAtWorldMinute + Math.ceil(row.requiredRounds / 10) && row.completedAtWorldMinute <= worldMinute && id(row.completionAdvanceId) && Array.isArray(advances) && (advances.some(advance => advance?.id === row.completionAdvanceId && advance.kind === 'advance' && advance.fromWorldMinute === row.startedAtWorldMinute && advance.toWorldMinute === row.completedAtWorldMinute && advance.minutes === Math.ceil(row.requiredRounds / 10)) || (advances.length > 0 && row.completedAtWorldMinute <= advances[0].fromWorldMinute)) && row.interruptedAtWorldMinute == null && row.interruptionReason == null :
      row.completedAtWorldMinute == null && row.completionAdvanceId == null &&
      (row.status === 'active' ? row.interruptedAtWorldMinute == null && row.interruptionReason == null :
        row.status === 'interrupted' && integer(row.interruptedAtWorldMinute) && row.interruptedAtWorldMinute >= row.startedAtWorldMinute && row.interruptedAtWorldMinute <= worldMinute &&
        ['host-interrupted', 'unverified-time-advance'].includes(row.interruptionReason))))
}

/** Called only after the room server has authenticated the DM/Host. No grants are minted here. */
export function mutateCampaignInteraction(base, mutation, now, memberId) {
  const rows = base.interactions ?? []
  const fail = error => ({ ok: false, status: 400, error })
  if (!id(memberId) || !integer(now)) return fail('invalid-interaction-authority')
  if (mutation.operation === 'start-interaction') {
    if (!fields.slice(0, 5).every(key => id(mutation[key])) || !integer(mutation.requiredRounds) || mutation.requiredRounds < 1 || mutation.requiredRounds > 14400) return fail('invalid-interaction-start')
    const existing = rows.find(row => row.id === mutation.id)
    if (existing) return fields.every(key => existing[key] === mutation[key])
      ? { ok: true, changed: false, next: base }
      : fail('interaction-id-conflict')
    if (mutation.expectedWorldMinute !== base.worldMinute) return fail('stale-interaction-clock')
    if (rows.some(row => row.status === 'active' && row.effectId === mutation.effectId && row.bearerId === mutation.bearerId && row.packageId === mutation.packageId)) return fail('interaction-already-started')
    // Keep all identities until explicit lifecycle compaction exists; never evict a replay guard.
    if (rows.length >= LIMIT) return fail('interaction-record-limit')
    const row = { ...Object.fromEntries(fields.map(key => [key, mutation[key]])), status: 'active', startedAtWorldMinute: base.worldMinute, startedByMemberId: memberId, createdAt: now }
    return { ok: true, changed: true, next: { ...base, interactions: [...rows, row], updatedAt: now } }
  }
  if (mutation.operation === 'interrupt-interaction') {
    const existing = rows.find(row => row.id === mutation.id)
    if (!existing) return fail('interaction-not-found')
    if (existing.status !== 'active') return { ok: true, changed: false, next: base }
    if (mutation.expectedWorldMinute !== base.worldMinute) return fail('stale-interaction-clock')
    return { ok: true, changed: true, next: { ...base, interactions: rows.map(row => row.id === mutation.id ? {
      ...row, status: 'interrupted', interruptedAtWorldMinute: base.worldMinute, interruptionReason: 'host-interrupted',
    } : row), updatedAt: now } }
  }
  return fail('invalid-interaction-operation')
}

/** Ordinary elapsed time has no evidence of sustained participation. */
export function interruptCampaignInteractionsForTimeAdvance(rows, worldMinute) {
  return rows?.map(row => row.status === 'active' ? { ...row, status: 'interrupted', interruptedAtWorldMinute: worldMinute, interruptionReason: 'unverified-time-advance' } : row)
}
