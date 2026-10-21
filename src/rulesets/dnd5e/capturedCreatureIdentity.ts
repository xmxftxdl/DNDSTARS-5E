import { normalizeDnd5eLinkedTargetPresentation, type Dnd5eLinkedTargetPresentation } from './linkedTargetPresentationSchema'

/** A remembered identity, never a replacement stat block or ownership grant. */
export interface Dnd5eCapturedCreatureIdentity {
  actorId: string
  name: string
  creatureType?: string
  presentation?: Dnd5eLinkedTargetPresentation
  presentationCaptured?: true
}

export function normalizeDnd5eCapturedCreatureIdentity(value: unknown): Dnd5eCapturedCreatureIdentity | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (Object.keys(raw).some(key => !['actorId', 'name', 'creatureType', 'presentation', 'presentationCaptured'].includes(key)) ||
    typeof raw.actorId !== 'string' || !raw.actorId.trim() || raw.actorId.length > 256 ||
    typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 1000 ||
    (raw.creatureType != null && (typeof raw.creatureType !== 'string' || !raw.creatureType || raw.creatureType.length > 100)) ||
    (raw.presentationCaptured != null && raw.presentationCaptured !== true)) return undefined
  const presentation = normalizeDnd5eLinkedTargetPresentation(raw.presentation)
  if (raw.presentation != null && (!presentation || raw.presentationCaptured !== true)) return undefined
  return { actorId: raw.actorId, name: raw.name,
    ...(typeof raw.creatureType === 'string' ? { creatureType: raw.creatureType } : {}),
    ...(presentation ? { presentation } : {}),
    ...(raw.presentationCaptured === true ? { presentationCaptured: true as const } : {}) }
}
