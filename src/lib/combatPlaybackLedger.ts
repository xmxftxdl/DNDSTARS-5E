export type CombatPlaybackLedgerKind = 'dice' | 'roll-request' | 'player-action-ack'

const STORAGE_PREFIX = 'astraltrace:combat-playback:v1'
const MAX_IDS = 600
const TRIM_TO_IDS = 300

class PersistentBoundedIdSet extends Set<string> {
  readonly #storageKey: string

  constructor(storageKey: string) {
    super()
    this.#storageKey = storageKey
    for (const id of readStoredIds(storageKey)) super.add(id)
  }

  override add(value: string): this {
    if (!value) return this
    super.add(value)
    if (this.size > MAX_IDS) {
      const retained = [...this].slice(-TRIM_TO_IDS)
      super.clear()
      for (const id of retained) super.add(id)
    }
    writeStoredIds(this.#storageKey, this)
    return this
  }

  override clear(): void {
    super.clear()
    writeStoredIds(this.#storageKey, this)
  }
}

const ledgers = new Map<string, PersistentBoundedIdSet>()

function sessionStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.sessionStorage
  } catch {
    return false
  }
}

function readStoredIds(key: string): string[] {
  if (!sessionStorageAvailable()) return []
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(-MAX_IDS)
  } catch {
    return []
  }
}

function writeStoredIds(key: string, ids: ReadonlySet<string>): void {
  if (!sessionStorageAvailable()) return
  try {
    window.sessionStorage.setItem(key, JSON.stringify([...ids].slice(-MAX_IDS)))
  } catch {
    // Playback de-duplication remains valid for the current module lifetime even
    // when storage is disabled or full.
  }
}

export function combatPlaybackScope(input: {
  roomId?: string
  memberId?: string
  mode?: 'dm' | 'player' | null
}): string {
  return [input.roomId ?? 'local', input.memberId ?? 'local', input.mode ?? 'unknown']
    .map((part) => encodeURIComponent(part))
    .join(':')
}

/**
 * Returns the same bounded Set for every consumer in a room endpoint. The map
 * page and the off-map background receiver therefore share one playback ACK
 * ledger instead of replaying persisted dice after route remounts.
 */
export function combatPlaybackIds(
  scope: string,
  kind: CombatPlaybackLedgerKind,
): Set<string> {
  const key = `${STORAGE_PREFIX}:${scope}:${kind}`
  let ids = ledgers.get(key)
  if (!ids) {
    ids = new PersistentBoundedIdSet(key)
    ledgers.set(key, ids)
  }
  return ids
}

export function resetCombatPlaybackLedgersForTests(): void {
  for (const ids of ledgers.values()) ids.clear()
  ledgers.clear()
}
