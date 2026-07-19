export function clearCharacterScopedRecord<T>(
  record: Record<string, T>,
  characterId: string,
): Record<string, T> {
  const prefix = `${characterId}:`
  let changed = false
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith(prefix)) {
      changed = true
      continue
    }
    next[key] = value
  }
  return changed ? next : record
}

export function removeDisengagedCharacterId(previous: Set<string>, characterId: string): Set<string> {
  if (!previous.has(characterId)) return previous
  const next = new Set(previous)
  next.delete(characterId)
  return next
}
