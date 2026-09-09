import type { Mode, SharedRollRequestEvent } from '../../lib/sharedCombatTypes'
import { getRoomSession } from '../../lib/roomSession'
import { combatPlaybackScope } from '../../lib/combatPlaybackLedger'
import { writeDiceTrayHistory } from '../../presentation/maps/diceTrayHistory'

export const PLAYER_D20_REQUEST_TIMEOUT_MS = 300_000

type PendingRoll = { event: SharedRollRequestEvent; value?: number }
const memory = new Map<string, Record<string, PendingRoll>>()
function storageKey() {
  const session = getRoomSession()
  return `astraltrace:pending-player-dice:v1:${session?.roomId ?? 'local'}:${session?.memberId ?? 'local'}`
}
function readPending(): Record<string, PendingRoll> {
  const key = storageKey()
  try {
    const raw: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? 'null')
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return Object.fromEntries(Object.entries(raw).filter(([id, item]) => {
        const record = item as PendingRoll | null
        return record?.event?.requestId === id && record.event.delivery === 'player-roll-request'
          && Number.isFinite(record.event.updatedAt)
      }))
    }
  } catch { /* Storage can be unavailable; keep the in-memory handoff. */ }
  return memory.get(key) ?? {}
}
function writePending(records: Record<string, PendingRoll>) {
  const key = storageKey()
  memory.set(key, records)
  try { window.sessionStorage.setItem(key, JSON.stringify(records)) } catch { /* Keep memory fallback. */ }
}

export function savedPlayerDiceRollValue(requestId: string): number | undefined {
  const value = readPending()[requestId]?.value
  return Number.isInteger(value) && value! >= 1 && value! <= 20 ? value : undefined
}

/** Save BEFORE animation so refresh/retry cannot roll a second value. */
export function savePlayerDiceRollValue(event: SharedRollRequestEvent, value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error('Invalid d20 value')
  const records = readPending()
  records[event.requestId] = { event, value: savedPlayerDiceRollValue(event.requestId) ?? value }
  writePending(records)
  const session = getRoomSession()
  const scope = combatPlaybackScope({ roomId: session?.roomId, memberId: session?.memberId, mode: 'player' })
  writeDiceTrayHistory(`${scope}:${event.mapId}`, {
    id: `d20:${event.requestId}:player-authority`, label: event.label, targetName: event.targetName,
    sides: 20, values: [records[event.requestId].value!], formula: '1d20',
  }, true)
}

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
  const records = readPending()
  records[event.requestId] = { ...records[event.requestId], event }
  writePending(records)
}

export function pendingPlayerDiceRollRequests(now = Date.now()): SharedRollRequestEvent[] {
  const records = readPending()
  for (const [requestId, { event }] of Object.entries(records)) {
    if (now - event.updatedAt > PLAYER_D20_REQUEST_TIMEOUT_MS) {
      delete records[requestId]
    }
  }
  writePending(records)
  return Object.values(records).map(({ event }) => event)
}

export function forgetPendingPlayerDiceRollRequest(requestId: string): void {
  const records = readPending()
  delete records[requestId]
  writePending(records)
}

export function resetPendingPlayerDiceRollRequestsForTests(): void {
  writePending({})
}
