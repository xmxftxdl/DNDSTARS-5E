import type { Mode, SharedRollRequestEvent } from '../../lib/sharedCombatTypes'
import { getRoomSession } from '../../lib/roomSession'
import { combatPlaybackScope } from '../../lib/combatPlaybackLedger'
import { writeDiceTrayHistory } from '../../presentation/maps/diceTrayHistory'

export const PLAYER_D20_REQUEST_TIMEOUT_MS = 300_000

export function playerDiceRequestMatchesCombat(event: SharedRollRequestEvent, combatId: string): boolean {
  return event.combatId === undefined || event.combatId === combatId
}

type PendingRoll = { event: SharedRollRequestEvent; value?: number; values?: number[]; completed?: boolean }
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

function validPlayerDiceShape(event: Pick<SharedRollRequestEvent, 'kind' | 'count' | 'sides'>): boolean {
  return (event.kind === 'd20' && event.count === 1 && event.sides === 20) ||
    (event.kind === 'dice' && Number.isInteger(event.count) && event.count >= 1 && event.count <= 100 &&
      Number.isInteger(event.sides) && event.sides >= 2 && event.sides <= 100)
}

export function savedPlayerDiceRollValues(requestId: string): number[] | undefined {
  const record = readPending()[requestId]
  if (!record) return undefined
  const values = record.values ?? (record.value == null ? undefined : [record.value])
  return values && validPlayerDiceShape(record.event) && values.length === record.event.count &&
    values.every(value => Number.isInteger(value) && value >= 1 && value <= record.event.sides) ? [...values] : undefined
}

export function savedPlayerDiceRollValue(requestId: string): number | undefined {
  return savedPlayerDiceRollValues(requestId)?.[0]
}

/** Save the entire authoritative pool before animation, including dice beyond the visual cap. */
export function savePlayerDiceRollValues(event: SharedRollRequestEvent, values: number[]): void {
  if (!validPlayerDiceShape(event) || values.length !== event.count ||
    !values.every(value => Number.isInteger(value) && value >= 1 && value <= event.sides)) throw new Error('Invalid dice values')
  const records = readPending()
  const saved = savedPlayerDiceRollValues(event.requestId) ?? [...values]
  records[event.requestId] = { event, values: saved }
  writePending(records)
  const session = getRoomSession()
  const scope = combatPlaybackScope({ roomId: session?.roomId, memberId: session?.memberId, mode: 'player' })
  writeDiceTrayHistory(`${scope}:${event.mapId}`, {
    id: `${event.kind}:${event.requestId}:player-authority`, label: event.label, targetName: event.targetName,
    sides: event.sides, check: event.check, values: saved, formula: `${event.count}d${event.sides}`,
  }, true)
}

export function savePlayerDiceRollValue(event: SharedRollRequestEvent, value: number): void {
  savePlayerDiceRollValues(event, [value])
}

/** The controlling player decides faces once; presentation cannot replace the saved pool. */
export async function performPlayerDiceRoll(
  request: SharedRollRequestEvent,
  rollDie: (sides: number) => number,
  present: (values: number[]) => Promise<unknown>,
): Promise<number[]> {
  const saved = savedPlayerDiceRollValues(request.requestId)
  if (saved) return saved
  const values = Array.from({ length: request.count }, () => rollDie(request.sides))
  savePlayerDiceRollValues(request, values)
  await present(values)
  return values
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
    validPlayerDiceShape(input.event) &&
    typeof input.event.targetCharacterId === 'string' &&
    input.controlledCharacterIds.has(input.event.targetCharacterId)
}

export function playerDiceRollResultValues(
  event: SharedRollRequestEvent,
  expected: Pick<SharedRollRequestEvent, 'kind' | 'count' | 'sides' | 'targetCharacterId'>,
): number[] | null {
  if (event.delivery !== 'player-roll-result' || !validPlayerDiceShape(event) ||
    event.kind !== expected.kind || event.count !== expected.count || event.sides !== expected.sides ||
    event.targetCharacterId !== expected.targetCharacterId || event.values.length !== expected.count ||
    !event.values.every(value => Number.isInteger(value) && value >= 1 && value <= expected.sides)) return null
  return [...event.values]
}

export interface PendingPlayerDicePresentation {
  kind: SharedRollRequestEvent['kind']
  count: number
  sides: number
  targetCharacterId?: string
  presentationDone?: Promise<void>
  resultReceived?: boolean
  resolve: (values: number[]) => void
}

/** Mirror the player's authoritative faces once, then release settlement after animation. */
export function receivePlayerDicePresentation(
  event: SharedRollRequestEvent,
  pending: PendingPlayerDicePresentation,
  present: (values: number[]) => Promise<void>,
): boolean {
  if (event.delivery !== 'player-roll-start' && event.delivery !== 'player-roll-result') return false
  const values = playerDiceRollResultValues({ ...event, delivery: 'player-roll-result' }, pending)
  if (!values) return false
  pending.presentationDone ??= present(values)
  if (event.delivery === 'player-roll-result' && !pending.resultReceived) {
    pending.resultReceived = true
    void pending.presentationDone.then(() => pending.resolve(values))
  }
  return true
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

/** Retry delivery, never randomness. Stop as soon as the Host receives a result. */
export function retryPlayerDiceRollRequest(publish: () => Promise<void>, isPending: () => boolean): void {
  const send = async () => {
    if (!isPending()) return
    try { await publish() } catch { /* A reconnect can deliver the next identical request. */ }
    if (isPending()) setTimeout(() => { void send() }, 3_000)
  }
  void send()
}

export function completePlayerDiceRollRequest(requestId: string): void {
  const records = readPending()
  if (records[requestId]) records[requestId].completed = true
  writePending(records)
}

export function completedPlayerDiceRollValues(requestId: string): number[] | undefined {
  return readPending()[requestId]?.completed ? savedPlayerDiceRollValues(requestId) : undefined
}

export function pendingPlayerDiceRollRequests(now = Date.now()): SharedRollRequestEvent[] {
  const records = readPending()
  for (const [requestId, { event }] of Object.entries(records)) {
    if (now - event.updatedAt > PLAYER_D20_REQUEST_TIMEOUT_MS) {
      delete records[requestId]
    }
  }
  writePending(records)
  return Object.values(records).filter(record => !record.completed).map(({ event }) => event)
}

export function forgetPendingPlayerDiceRollRequest(requestId: string): void {
  const records = readPending()
  delete records[requestId]
  writePending(records)
}

export function resetPendingPlayerDiceRollRequestsForTests(): void {
  writePending({})
}

export function clearPendingPlayerDiceRollRequests(): void {
  writePending({})
}
