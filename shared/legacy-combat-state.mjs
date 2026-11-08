/**
 * Dedicated SRD 5.1 servers must not relay retired AP balances even when an
 * older client reconnects and writes a pre-migration snapshot. Keeping this at
 * the HTTP persistence boundary prevents stale tabs from reintroducing AP into
 * otherwise migrated DM/player sessions.
 */
export function migrateLegacyApCombatLogText(text) {
  return String(text ?? '')
    .replace(/(?:花费|消耗)\s*\d+\s*(?:点\s*)?AP\s*(?:[：:]\s*)?/giu, '')
    .replace(/(?:未|不|无需)消耗\s*AP\s*(?:[：:]\s*)?/giu, '')
    .replace(/\s*[；;,，]?\s*(?:本回合)?剩余\s*AP\s*\d+\s*\/\s*\d+/giu, '')
    .replace(/\s*[；;,，]?\s*AP\s*\d+\s*\/\s*\d+/giu, '')
    .replace(/AP\s*回满为\s*\d+\s*\/\s*\d+/giu, '')
    .replace(/保留\s*AP\s*(?:[：:]\s*)?/giu, '')
    .replace(/AP\s*不足/giu, '行动资源不足')
    .replace(/\bAP\b/giu, '')
    .replace(/\s+([，。；：,.;:])/gu, '$1')
    .replace(/([，,]){2,}/gu, '$1')
    .replace(/\s{2,}/gu, ' ')
    .trim()
}

export function normalizeDedicatedDnd5eSharedState(name, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  if (name === 'combat') {
    if (!Object.prototype.hasOwnProperty.call(value, 'enemyApByToken')) return value
    const normalized = { ...value }
    delete normalized.enemyApByToken
    return normalized
  }
  if (name !== 'combat-log' || !Array.isArray(value.entries)) return value
  return {
    ...value,
    entries: value.entries.map((entry) => entry && typeof entry === 'object'
      ? { ...entry, text: migrateLegacyApCombatLogText(entry.text) }
      : entry),
  }
}

