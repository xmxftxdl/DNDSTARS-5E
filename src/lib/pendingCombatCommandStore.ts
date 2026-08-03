import {
  fingerprintCombatCommand,
  type CombatCommandV1,
} from './combatCommandApi'

export const PENDING_COMBAT_COMMANDS_STORAGE_KEY = 'stars:pending-combat-commands:v2'
const MAX_PENDING_COMBAT_COMMANDS = 24

export interface CombatCommandSessionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PendingCombatCommandScope {
  roomId: string
  memberId: string
}

interface StoredPendingCombatCommandV2 {
  scope: PendingCombatCommandScope
  command: CombatCommandV1
}

interface StoredCombatCommandsV2 {
  schemaVersion: 2
  entries: StoredPendingCombatCommandV2[]
}

const UNSCOPED_PENDING_COMMANDS: PendingCombatCommandScope = {
  roomId: 'local',
  memberId: 'local',
}

export function sameCombatActorTurn(
  left: CombatCommandV1,
  right: CombatCommandV1,
): boolean {
  return left.mapId === right.mapId &&
    left.combatId === right.combatId &&
    left.actorTokenId === right.actorTokenId &&
    left.round === right.round &&
    left.initiativeIndex === right.initiativeIndex
}

export function findPendingCombatCommandForActorTurn(
  command: CombatCommandV1,
  storage: CombatCommandSessionStorage | null = defaultStorage(),
  scope: PendingCombatCommandScope = UNSCOPED_PENDING_COMMANDS,
): CombatCommandV1 | undefined {
  return loadPendingCombatCommands(storage, scope)
    .find((candidate) => sameCombatActorTurn(candidate, command))
}

function defaultStorage(): CombatCommandSessionStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function validStoredCommand(value: unknown): value is CombatCommandV1 {
  try {
    fingerprintCombatCommand(value as CombatCommandV1)
    return true
  } catch {
    return false
  }
}

function validScope(value: unknown): value is PendingCombatCommandScope {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PendingCombatCommandScope>
  return typeof candidate.roomId === 'string' && candidate.roomId.length > 0 && candidate.roomId.length <= 256 &&
    typeof candidate.memberId === 'string' && candidate.memberId.length > 0 && candidate.memberId.length <= 256
}

function sameScope(left: PendingCombatCommandScope, right: PendingCombatCommandScope): boolean {
  return left.roomId === right.roomId && left.memberId === right.memberId
}

function loadStoredEntries(
  storage: CombatCommandSessionStorage | null,
): StoredPendingCombatCommandV2[] {
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(PENDING_COMBAT_COMMANDS_STORAGE_KEY) ?? 'null') as
      Partial<StoredCombatCommandsV2> | null
    if (parsed?.schemaVersion !== 2 || !Array.isArray(parsed.entries)) return []
    const byScopedId = new Map<string, StoredPendingCombatCommandV2>()
    for (const candidate of parsed.entries) {
      if (!candidate || typeof candidate !== 'object') continue
      const entry = candidate as Partial<StoredPendingCombatCommandV2>
      if (!validScope(entry.scope) || !validStoredCommand(entry.command)) continue
      byScopedId.set(
        `${entry.scope.roomId}\u0000${entry.scope.memberId}\u0000${entry.command.commandId}`,
        { scope: { ...entry.scope }, command: entry.command },
      )
    }
    return [...byScopedId.values()].sort((left, right) =>
      left.command.issuedAt - right.command.issuedAt)
  } catch {
    return []
  }
}

function writeStoredEntries(
  storage: CombatCommandSessionStorage,
  entries: readonly StoredPendingCombatCommandV2[],
): void {
  storage.setItem(PENDING_COMBAT_COMMANDS_STORAGE_KEY, JSON.stringify({
    schemaVersion: 2,
    entries: [...entries],
  } satisfies StoredCombatCommandsV2))
}

export function loadPendingCombatCommands(
  storage: CombatCommandSessionStorage | null = defaultStorage(),
  scope: PendingCombatCommandScope = UNSCOPED_PENDING_COMMANDS,
): CombatCommandV1[] {
  if (!validScope(scope)) return []
  return loadStoredEntries(storage)
    .filter((entry) => sameScope(entry.scope, scope))
    .map((entry) => entry.command)
}

export function persistPendingCombatCommand(
  command: CombatCommandV1,
  storage: CombatCommandSessionStorage | null = defaultStorage(),
  scope: PendingCombatCommandScope = UNSCOPED_PENDING_COMMANDS,
): boolean {
  if (!storage || !validStoredCommand(command) || !validScope(scope)) return false
  try {
    const entries = loadStoredEntries(storage)
    const commands = entries.filter((entry) => sameScope(entry.scope, scope)).map((entry) => entry.command)
    const existing = commands.find((candidate) => candidate.commandId === command.commandId)
    if (existing && fingerprintCombatCommand(existing) !== fingerprintCombatCommand(command)) return false
    if (commands.some((candidate) =>
      candidate.commandId !== command.commandId && sameCombatActorTurn(candidate, command))) return false
    if (!existing && commands.length >= MAX_PENDING_COMBAT_COMMANDS) return false
    const next = entries
      .filter((entry) => !(
        sameScope(entry.scope, scope) && entry.command.commandId === command.commandId
      ))
      .concat({ scope: { ...scope }, command })
      .sort((left, right) => left.command.issuedAt - right.command.issuedAt)
    writeStoredEntries(storage, next)
    return true
  } catch {
    return false
  }
}

export function clearPendingCombatCommand(
  commandId: string,
  storage: CombatCommandSessionStorage | null = defaultStorage(),
  scope: PendingCombatCommandScope = UNSCOPED_PENDING_COMMANDS,
): void {
  if (!storage || !validScope(scope)) return
  try {
    const next = loadStoredEntries(storage).filter((entry) => !(
      sameScope(entry.scope, scope) && entry.command.commandId === commandId
    ))
    if (next.length === 0) {
      storage.removeItem(PENDING_COMBAT_COMMANDS_STORAGE_KEY)
      return
    }
    writeStoredEntries(storage, next)
  } catch {
    // Storage is a resilience aid. Authority remains the server receipt.
  }
}
