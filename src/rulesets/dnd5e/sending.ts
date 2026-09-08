import type {
  Dnd5eSendingDeclarationV1,
  Dnd5eSendingResolutionV1,
} from '../../lib/sharedCombatTypes'
import { dnd5eMagicMouthMessageWordCount } from './magicMouth'

const SENDING_RECIPIENT_MAX_LENGTH = 120
const SENDING_MESSAGE_MAX_LENGTH = 250

function normalizedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.normalize('NFC').trim().replace(/\s+/g, ' ')
  return normalized && normalized.length <= maxLength ? normalized : undefined
}

export function dnd5eSendingMessageWordCount(message: string): number {
  return dnd5eMagicMouthMessageWordCount(message)
}

export function normalizeDnd5eSendingDeclarationV1(
  value: unknown,
): Dnd5eSendingDeclarationV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const recipientName = normalizedText(raw.recipientName, SENDING_RECIPIENT_MAX_LENGTH)
  const message = normalizedText(raw.message, SENDING_MESSAGE_MAX_LENGTH)
  if (
    raw.schemaVersion !== 1 ||
    !recipientName ||
    !message ||
    dnd5eSendingMessageWordCount(message) > 25
  ) return undefined
  return { schemaVersion: 1, recipientName, message }
}

export function normalizeDnd5eSendingResolutionV1(
  value: unknown,
): Dnd5eSendingResolutionV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (
    raw.schemaVersion !== 1 ||
    typeof raw.targetIntelligenceAtLeastOne !== 'boolean' ||
    (raw.plane !== 'same' && raw.plane !== 'different') ||
    typeof raw.delivered !== 'boolean'
  ) return undefined

  const crossPlaneRoll = raw.plane === 'different' ? Number(raw.crossPlaneRoll) : undefined
  const expectedDelivery = raw.plane === 'same' || (Number.isInteger(crossPlaneRoll) && crossPlaneRoll! > 5)
  if (
    (raw.plane === 'same' && raw.crossPlaneRoll != null) ||
    (raw.plane === 'different' && (
      !Number.isInteger(crossPlaneRoll) || crossPlaneRoll! < 1 || crossPlaneRoll! > 100
    )) ||
    raw.delivered !== expectedDelivery
  ) return undefined

  const reply = raw.reply == null || raw.reply === ''
    ? undefined
    : normalizedText(raw.reply, SENDING_MESSAGE_MAX_LENGTH)
  if (
    (raw.reply != null && raw.reply !== '' && !reply) ||
    (reply && (
      !raw.delivered ||
      !raw.targetIntelligenceAtLeastOne ||
      dnd5eSendingMessageWordCount(reply) > 25
    ))
  ) return undefined

  return {
    schemaVersion: 1,
    targetIntelligenceAtLeastOne: raw.targetIntelligenceAtLeastOne,
    plane: raw.plane,
    ...(crossPlaneRoll != null ? { crossPlaneRoll } : {}),
    delivered: raw.delivered,
    ...(reply ? { reply } : {}),
  }
}
