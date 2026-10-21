export interface Dnd5eLongCastingBinding {
  requestId: string
  spellId: string
  mapId: string
  actorTokenId: string
  actorCharacterId: string
}
export function dnd5eLongCastingSignature(binding: Dnd5eLongCastingBinding): string {
  return JSON.stringify([binding.requestId, binding.spellId, binding.mapId, binding.actorTokenId, binding.actorCharacterId])
}
export function dnd5eLongCastingConcentrationId(binding: Dnd5eLongCastingBinding): string {
  return `casting:${dnd5eLongCastingSignature(binding)}`
}
/** Identity only: serialization never proves that a cast can finish. */
export function dnd5eLongCastingBindingFromConcentrationId(id: string): Dnd5eLongCastingBinding | undefined {
  if (!id.startsWith('casting:')) return undefined
  try {
    const parts: unknown = JSON.parse(id.slice('casting:'.length))
    return Array.isArray(parts) && parts.length === 5 && parts.every(part => typeof part === 'string' && part.length > 0)
      ? {requestId:parts[0],spellId:parts[1],mapId:parts[2],actorTokenId:parts[3],actorCharacterId:parts[4]} : undefined
  } catch { return undefined }
}
export function dnd5eLongCastingSpellId(id: string): string | undefined {
  return dnd5eLongCastingBindingFromConcentrationId(id)?.spellId
}
