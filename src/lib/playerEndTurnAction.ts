import type { HeadlessEndTurnAction } from './headlessDmCombatEngine'

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

export function removeDisengagedCharacterId(prev: Set<string>, characterId: string): Set<string> {
  if (!prev.has(characterId)) return prev
  const next = new Set(prev)
  next.delete(characterId)
  return next
}

export function buildHeadlessEndTurnAction(input: {
  actorTokenId: string
  characterId?: string
}): HeadlessEndTurnAction {
  return {
    type: 'end-turn',
    actorTokenId: input.actorTokenId,
    characterId: input.characterId,
  }
}
