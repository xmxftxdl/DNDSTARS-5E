function orderedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(orderedJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, next]) => [key, orderedJson(next)]))
  }
  return value
}

/** Compare the entire JSON-visible character projection. Object insertion
 * order is presentation; array order and every value remain part of the guard.
 * Snapshot each operand once, as the original JSON guard did. */
export function sameDnd5eCombatStartCharacterProjection(projected: readonly unknown[], current: readonly unknown[]): boolean {
  if (!Array.isArray(projected) || !Array.isArray(current)) return false
  const projectedJson = JSON.stringify(projected)
  const currentJson = JSON.stringify(current)
  if (projectedJson === currentJson) return true
  return JSON.stringify(orderedJson(JSON.parse(projectedJson))) === JSON.stringify(orderedJson(JSON.parse(currentJson)))
}
