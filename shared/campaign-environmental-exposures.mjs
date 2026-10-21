const id = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 160
const minute = value => Number.isSafeInteger(value) && value >= 0
const hazards = ['extreme-heat', 'extreme-cold']
const overlaps = (a, b) => a.subjectId === b.subjectId && a.hazard === b.hazard &&
  a.fromWorldMinute < b.toWorldMinute && b.fromWorldMinute < a.toWorldMinute

/** Terminal receipts must survive reload and map changes. Subject IDs are character IDs
 * for player characters, or map-qualified token IDs for other creatures. */
export function validCampaignEnvironmentalExposures(value, worldMinute) {
  if (value === undefined) return true
  if (!minute(worldMinute) || !Array.isArray(value) || value.length > 4096) return false
  const ids = new Set()
  for (let index = 0; index < value.length; index++) {
    const row = value[index]
    if (!row || !id(row.id) || ids.has(row.id) || !id(row.subjectId) || !hazards.includes(row.hazard) ||
      !minute(row.fromWorldMinute) || !minute(row.toWorldMinute) || row.fromWorldMinute >= row.toWorldMinute ||
      row.toWorldMinute > worldMinute || !Number.isSafeInteger(row.dc) || row.dc < 1 || row.dc > 100 ||
      !['protected', 'success', 'failure'].includes(row.outcome)) return false
    ids.add(row.id)
    if (value.slice(0, index).some(previous => overlaps(previous, row))) return false
  }
  return true
}

/** Call only when planning the atomic actor + clock commit. This does not apply damage
 * or exhaustion, and never silently forgets old receipts to make room for new ones. */
export function appendCampaignEnvironmentalExposure(rows, receipt, worldMinute) {
  if (!validCampaignEnvironmentalExposures(rows, worldMinute) ||
    !validCampaignEnvironmentalExposures([receipt], worldMinute)) return { ok: false, reason: 'invalid-environmental-exposure' }
  const previous = rows ?? []
  if (previous.some(row => row.id === receipt.id || overlaps(row, receipt))) return { ok: false, reason: 'environmental-exposure-already-settled' }
  if (previous.length >= 4096) return { ok: false, reason: 'environmental-exposure-record-limit' }
  return { ok: true, receipts: [...previous.map(row => ({ ...row })), { ...receipt }] }
}
