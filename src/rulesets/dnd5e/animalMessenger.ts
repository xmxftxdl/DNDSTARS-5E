import type {
  Dnd5eAnimalMessengerDeclarationV1,
  Dnd5eAnimalMessengerResolutionV1,
} from '../../lib/sharedCombatTypes'
import { dnd5eMagicMouthMessageWordCount } from './magicMouth'
import { getDnd5eSrdMonster } from './monsters'
import type { Token } from '../../store/maps'

const TARGET_NAME_MAX_LENGTH = 120
const DESTINATION_MAX_LENGTH = 240
const RECIPIENT_MAX_LENGTH = 240
const MESSAGE_MAX_LENGTH = 250

function normalizedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.normalize('NFC').trim().replace(/\s+/g, ' ')
  return normalized && normalized.length <= maxLength ? normalized : undefined
}

export function dnd5eAnimalMessengerMessageWordCount(message: string): number {
  return dnd5eMagicMouthMessageWordCount(message)
}

export function normalizeDnd5eAnimalMessengerDeclarationV1(
  value: unknown,
): Dnd5eAnimalMessengerDeclarationV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const targetTokenId = normalizedText(raw.targetTokenId, 160)
  const targetName = normalizedText(raw.targetName, TARGET_NAME_MAX_LENGTH)
  const destination = normalizedText(raw.destination, DESTINATION_MAX_LENGTH)
  const recipientDescription = normalizedText(raw.recipientDescription, RECIPIENT_MAX_LENGTH)
  const message = normalizedText(raw.message, MESSAGE_MAX_LENGTH)
  const routeDistanceMiles = Number(raw.routeDistanceMiles)
  if (
    raw.schemaVersion !== 1 || !targetTokenId || !targetName || !destination ||
    !recipientDescription || !message || dnd5eAnimalMessengerMessageWordCount(message) > 25 ||
    !Number.isFinite(routeDistanceMiles) || routeDistanceMiles <= 0 || routeDistanceMiles > 10_000
  ) return undefined
  return {
    schemaVersion: 1,
    targetTokenId,
    targetName,
    destination,
    recipientDescription,
    message,
    routeDistanceMiles: Math.round(routeDistanceMiles * 10) / 10,
  }
}

export function normalizeDnd5eAnimalMessengerResolutionV1(
  value: unknown,
): Dnd5eAnimalMessengerResolutionV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (
    raw.schemaVersion !== 1 ||
    typeof raw.destinationPreviouslyVisitedConfirmed !== 'boolean' ||
    typeof raw.targetVisibleConfirmed !== 'boolean'
  ) return undefined
  return {
    schemaVersion: 1,
    destinationPreviouslyVisitedConfirmed: raw.destinationPreviouslyVisitedConfirmed,
    targetVisibleConfirmed: raw.targetVisibleConfirmed,
  }
}

export function dnd5eAnimalMessengerDurationHours(slotLevel: number): number {
  return 24 + Math.max(0, Math.floor(slotLevel) - 2) * 48
}

export function dnd5eAnimalMessengerDurationRounds(slotLevel: number): number {
  return dnd5eAnimalMessengerDurationHours(slotLevel) * 600
}

export function dnd5eAnimalMessengerTargetUsesFlight(token: Token): boolean {
  const monster = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
  return (monster?.speed.fly ?? 0) > 0
}

export function dnd5eAnimalMessengerTravelCapacityMiles(token: Token, slotLevel: number): number {
  const milesPerDay = dnd5eAnimalMessengerTargetUsesFlight(token) ? 50 : 25
  return milesPerDay * dnd5eAnimalMessengerDurationHours(slotLevel) / 24
}

export function dnd5eAnimalMessengerTokenIsTinyBeast(token: Token): boolean {
  const monster = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
  const creatureSize = token.creatureSize ?? monster?.size
  const creatureTypes = token.creatureTypes ?? (monster ? [monster.creatureType] : [])
  return creatureSize === '微型' && creatureTypes.some((type) => type === '野兽')
}
