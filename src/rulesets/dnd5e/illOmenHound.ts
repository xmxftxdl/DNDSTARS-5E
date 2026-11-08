/** Original chosen body identity; it is not visibility, consent or a spell source entitlement. */
export interface Dnd5eIllOmenHoundTarget {
  targetTokenId: string
  targetCharacterId?: string
}

export interface Dnd5eIllOmenHoundBinding extends Dnd5eIllOmenHoundTarget {
  sourceTokenId: string
  sourceCharacterId: string
}

export function normalizeDnd5eIllOmenHoundTarget(value: unknown): Dnd5eIllOmenHoundTarget | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw=value as Record<string,unknown>
  if (Object.keys(raw).some(key=>!['targetTokenId','targetCharacterId'].includes(key)) ||
    typeof raw.targetTokenId!=='string' || !raw.targetTokenId.trim() ||
    (raw.targetCharacterId!=null && (typeof raw.targetCharacterId!=='string' || !raw.targetCharacterId.trim()))) return undefined
  return {targetTokenId:raw.targetTokenId,...(raw.targetCharacterId!=null?{targetCharacterId:raw.targetCharacterId as string}:{})}
}
