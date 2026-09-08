import type { Mode, SharedRollRequestEvent } from '../../lib/sharedCombatTypes'

export const PLAYER_D20_REQUEST_TIMEOUT_MS = 300_000

const pendingPlayerDiceRollRequestsById = new Map<string, SharedRollRequestEvent>()

export type PlayerSavingThrowAbility = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

const SAVING_THROW_LABEL_PATTERNS: ReadonlyArray<readonly [PlayerSavingThrowAbility, RegExp]> = [
  ['str', /力量|\bSTR\b/i],
  ['dex', /敏捷|\bDEX\b/i],
  ['con', /体质|\bCON\b/i],
  ['int', /智力|\bINT\b/i],
  ['wis', /感知|\bWIS\b/i],
  ['cha', /魅力|\bCHA\b/i],
]

export function savingThrowAbilityFromRollLabel(label: string): PlayerSavingThrowAbility | undefined {
  return SAVING_THROW_LABEL_PATTERNS.find(([, pattern]) => pattern.test(label))?.[0]
}

export function shouldDelegateCombatD20ToPlayer(input: {
  sourceMode: Mode | null | undefined
  rollKind?: 'attack' | 'ability-check' | 'saving-throw'
  rollerSide?: 'player' | 'enemy'
  targetCharacterId?: string
}): boolean {
  return input.sourceMode === 'dm' &&
    input.rollerSide === 'player' &&
    !!input.targetCharacterId &&
    (input.rollKind === 'attack' || input.rollKind === 'saving-throw' || input.rollKind === 'ability-check')
}

export function isPlayerDiceRollRequestForClient(input: {
  event: SharedRollRequestEvent
  mode: Mode | null | undefined
  spectator: boolean
  controlledCharacterIds: ReadonlySet<string>
}): boolean {
  return input.mode === 'player' &&
    !input.spectator &&
    input.event.delivery === 'player-roll-request' &&
    input.event.kind === 'd20' &&
    input.event.count === 1 &&
    input.event.sides === 20 &&
    typeof input.event.targetCharacterId === 'string' &&
    input.controlledCharacterIds.has(input.event.targetCharacterId)
}

export function playerDiceRollResultValue(
  event: SharedRollRequestEvent,
  expectedTargetCharacterId: string,
): number | null {
  if (
    event.delivery !== 'player-roll-result' ||
    event.kind !== 'd20' ||
    event.count !== 1 ||
    event.sides !== 20 ||
    event.targetCharacterId !== expectedTargetCharacterId ||
    event.values.length !== 1
  ) return null
  const value = event.values[0]
  return Number.isInteger(value) && value >= 1 && value <= 20 ? value : null
}

/**
 * Keeps an actionable request alive while the campaign shell hands control
 * from a non-map page to the map workspace. Shared events use one process-wide
 * SSE cursor, so mounting a second listener cannot replay an event already
 * observed by the background listener.
 */
export function rememberPendingPlayerDiceRollRequest(event: SharedRollRequestEvent): void {
  if (event.delivery !== 'player-roll-request') return
  pendingPlayerDiceRollRequestsById.set(event.requestId, event)
}

export function pendingPlayerDiceRollRequests(now = Date.now()): SharedRollRequestEvent[] {
  for (const [requestId, event] of pendingPlayerDiceRollRequestsById) {
    if (now - event.updatedAt > PLAYER_D20_REQUEST_TIMEOUT_MS) {
      pendingPlayerDiceRollRequestsById.delete(requestId)
    }
  }
  return [...pendingPlayerDiceRollRequestsById.values()]
}

export function forgetPendingPlayerDiceRollRequest(requestId: string): void {
  pendingPlayerDiceRollRequestsById.delete(requestId)
}

export function resetPendingPlayerDiceRollRequestsForTests(): void {
  pendingPlayerDiceRollRequestsById.clear()
}
