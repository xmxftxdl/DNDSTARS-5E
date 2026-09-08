export type Dnd5eMagicMouthTriggerModeV1 = 'proximity' | 'dm-observed'

export interface Dnd5eMagicMouthConfigV1 {
  schemaVersion: 1
  message: string
  trigger: string
  triggerMode: Dnd5eMagicMouthTriggerModeV1
  repeat: boolean
}

export interface Dnd5eMagicMouthStateV1 extends Dnd5eMagicMouthConfigV1 {
  objectKind: 'door' | 'geometry-obstacle' | 'obstacle-token'
  objectId: string
  objectLabel: string
}

const MESSAGE_MAX_LENGTH = 250
const TRIGGER_MAX_LENGTH = 320
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,199}$/i

export function dnd5eMagicMouthMessageWordCount(message: string): number {
  const normalized = message.normalize('NFKC').trim()
  if (!normalized) return 0
  return normalized.match(/[\p{Script=Han}]|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0
}

export function normalizeDnd5eMagicMouthConfigV1(
  value: unknown,
): Dnd5eMagicMouthConfigV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (
    raw.schemaVersion !== 1 ||
    typeof raw.message !== 'string' ||
    typeof raw.trigger !== 'string' ||
    (raw.triggerMode !== 'proximity' && raw.triggerMode !== 'dm-observed') ||
    typeof raw.repeat !== 'boolean'
  ) return undefined
  // Preserve the player's exact punctuation while still canonicalizing Unicode.
  const message = raw.message.normalize('NFC').trim().replace(/\s+/g, ' ')
  const trigger = raw.trigger.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (
    !message || message.length > MESSAGE_MAX_LENGTH ||
    dnd5eMagicMouthMessageWordCount(message) > 25 ||
    !trigger || trigger.length > TRIGGER_MAX_LENGTH
  ) return undefined
  return {
    schemaVersion: 1,
    message,
    trigger,
    triggerMode: raw.triggerMode,
    repeat: raw.repeat,
  }
}

export function normalizeDnd5eMagicMouthStateV1(
  value: unknown,
): Dnd5eMagicMouthStateV1 | undefined {
  const config = normalizeDnd5eMagicMouthConfigV1(value)
  if (!config || !value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (
    !['door', 'geometry-obstacle', 'obstacle-token'].includes(String(raw.objectKind)) ||
    typeof raw.objectId !== 'string' || !ID_PATTERN.test(raw.objectId) ||
    typeof raw.objectLabel !== 'string' || !raw.objectLabel.trim() || raw.objectLabel.length > 120
  ) return undefined
  return {
    ...config,
    objectKind: raw.objectKind as Dnd5eMagicMouthStateV1['objectKind'],
    objectId: raw.objectId,
    objectLabel: raw.objectLabel.trim(),
  }
}
