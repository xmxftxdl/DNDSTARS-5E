import type {
  Dnd5eSequesterDeclarationV1,
  Dnd5eSequesterResolutionV1,
} from '../../lib/sharedCombatTypes'

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function normalizedText(value: unknown, maximumLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ')
  return normalized && normalized.length <= maximumLength ? normalized : undefined
}

export function normalizeDnd5eSequesterDeclarationV1(
  value: unknown,
): Dnd5eSequesterDeclarationV1 | undefined {
  const raw = record(value)
  const targetTokenId = normalizedText(raw?.targetTokenId, 160)
  const targetName = normalizedText(raw?.targetName, 160)
  const endingCondition = raw?.endingCondition == null || raw.endingCondition === ''
    ? undefined
    : normalizedText(raw.endingCondition, 500)
  if (
    !raw || raw.schemaVersion !== 1 ||
    (raw.targetKind !== 'creature' && raw.targetKind !== 'object') ||
    !targetTokenId || !targetName ||
    (raw.endingCondition != null && raw.endingCondition !== '' && !endingCondition)
  ) return undefined
  return {
    schemaVersion: 1,
    targetKind: raw.targetKind,
    targetTokenId,
    targetName,
    ...(endingCondition ? { endingCondition } : {}),
  }
}

export function normalizeDnd5eSequesterResolutionV1(
  value: unknown,
): Dnd5eSequesterResolutionV1 | undefined {
  const raw = record(value)
  if (!raw || raw.schemaVersion !== 1 || typeof raw.willingCreatureConfirmed !== 'boolean') {
    return undefined
  }
  return {
    schemaVersion: 1,
    willingCreatureConfirmed: raw.willingCreatureConfirmed,
  }
}
