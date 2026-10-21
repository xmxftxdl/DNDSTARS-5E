/** Compare durable state by value, independent of object-key insertion order. */
export function dnd5eMovementAuthorityStamp(value: object): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry
    return Object.fromEntries(Object.entries(entry).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0))
  })
}
