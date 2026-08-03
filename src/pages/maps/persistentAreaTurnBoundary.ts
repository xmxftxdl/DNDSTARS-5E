import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function mergeUnkeyedArrayDelta(
  before: readonly unknown[],
  settled: readonly unknown[],
  current: readonly unknown[],
): unknown[] {
  const settledKeys = new Set(settled.map((entry) => JSON.stringify(entry)))
  const beforeKeys = new Set(before.map((entry) => JSON.stringify(entry)))
  const removedKeys = new Set(before
    .filter((entry) => !settledKeys.has(JSON.stringify(entry)))
    .map((entry) => JSON.stringify(entry)))
  const merged = current.filter((entry) => !removedKeys.has(JSON.stringify(entry)))
  const mergedKeys = new Set(merged.map((entry) => JSON.stringify(entry)))
  for (const entry of settled) {
    const key = JSON.stringify(entry)
    if (!beforeKeys.has(key) && !mergedKeys.has(key)) {
      merged.push(entry)
      mergedKeys.add(key)
    }
  }
  return merged
}

function mergeKeyedArrayDelta(
  before: readonly unknown[],
  settled: readonly unknown[],
  current: readonly unknown[],
  keyOf: (entry: unknown) => string | undefined,
): unknown[] {
  const beforeRecords = before.filter(isRecord)
  const settledRecords = settled.filter(isRecord)
  const currentRecords = current.filter(isRecord)
  const beforeByKey = new Map(beforeRecords.flatMap((entry) => {
    const key = keyOf(entry)
    return key ? [[key, entry] as const] : []
  }))
  const settledByKey = new Map(settledRecords.flatMap((entry) => {
    const key = keyOf(entry)
    return key ? [[key, entry] as const] : []
  }))
  const removedKeys = new Set([...beforeByKey.keys()].filter((key) => !settledByKey.has(key)))
  const currentKeys = new Set(currentRecords.flatMap((entry) => {
    const key = keyOf(entry)
    return key ? [key] : []
  }))
  const merged = current.flatMap((entry) => {
    const key = keyOf(entry)
    if (!key || removedKeys.has(key)) return key ? [] : [entry]
    const beforeEntry = beforeByKey.get(key)
    const settledEntry = settledByKey.get(key)
    if (!beforeEntry || !settledEntry || jsonEqual(beforeEntry, settledEntry) || !isRecord(entry)) {
      return [entry]
    }
    return [mergeRecordDelta(beforeEntry, settledEntry, entry)]
  })
  for (const entry of settled) {
    const key = keyOf(entry)
    if (key && !beforeByKey.has(key) && !currentKeys.has(key)) merged.push(entry)
  }
  return merged
}

function mergeArrayDelta(
  before: readonly unknown[],
  settled: readonly unknown[],
  current: readonly unknown[],
  fieldName: string,
): unknown[] {
  if (fieldName === 'triggerReceipts') {
    return mergeKeyedArrayDelta(before, settled, current, (entry) =>
      isRecord(entry) && typeof entry.transactionId === 'string' ? entry.transactionId : undefined)
  }
  const all = [...before, ...settled, ...current]
  if (all.length > 0 && all.every((entry) => isRecord(entry) && typeof entry.id === 'string')) {
    return mergeKeyedArrayDelta(before, settled, current, (entry) =>
      isRecord(entry) && typeof entry.id === 'string' ? entry.id : undefined)
  }
  return mergeUnkeyedArrayDelta(before, settled, current)
}

function mergeRecordDelta(
  before: Record<string, unknown>,
  settled: Record<string, unknown>,
  current: Record<string, unknown>,
  options: {
    numericDeltaFields?: ReadonlySet<string>
    skipFields?: ReadonlySet<string>
  } = {},
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current }
  for (const key of new Set([...Object.keys(before), ...Object.keys(settled)])) {
    if (options.skipFields?.has(key) || jsonEqual(before[key], settled[key])) continue
    const currentChanged = hasOwn(current, key) !== hasOwn(before, key) ||
      !jsonEqual(current[key], before[key])
    if (!hasOwn(settled, key)) {
      if (!currentChanged) delete next[key]
      continue
    }
    const beforeValue = before[key]
    const settledValue = settled[key]
    const currentValue = current[key]
    if (
      options.numericDeltaFields?.has(key) &&
      typeof beforeValue === 'number' &&
      typeof settledValue === 'number' &&
      typeof currentValue === 'number'
    ) {
      next[key] = Math.max(0, currentValue + settledValue - beforeValue)
    } else if (
      Array.isArray(beforeValue) &&
      Array.isArray(settledValue) &&
      Array.isArray(currentValue)
    ) {
      next[key] = mergeArrayDelta(beforeValue, settledValue, currentValue, key)
    } else if (isRecord(beforeValue) && isRecord(settledValue) && isRecord(currentValue)) {
      next[key] = mergeRecordDelta(beforeValue, settledValue, currentValue)
    } else if (currentChanged) {
      // A concurrent authority edit touched the exact same scalar. Preserve the
      // latest explicit value; additive HP and receipt semantics are handled above.
      continue
    } else {
      next[key] = settledValue
    }
  }
  return next
}

function mergeEntityDelta<T extends { id: string }>(input: {
  before: readonly T[]
  settled: readonly T[]
  current: readonly T[]
  mergeChanged?: (before: T, settled: T, current: T) => T
}): T[] {
  const beforeById = new Map(input.before.map((entry) => [entry.id, entry]))
  const settledById = new Map(input.settled.map((entry) => [entry.id, entry]))
  const removedIds = new Set(input.before
    .filter((entry) => !settledById.has(entry.id))
    .map((entry) => entry.id))
  const changedById = new Map(input.settled.flatMap((entry) => {
    const before = beforeById.get(entry.id)
    return before && !jsonEqual(before, entry) ? [[entry.id, { before, settled: entry }] as const] : []
  }))
  const currentIds = new Set(input.current.map((entry) => entry.id))
  const merged = input.current.flatMap((entry) => {
    if (removedIds.has(entry.id)) return []
    const changed = changedById.get(entry.id)
    if (!changed) return [entry]
    return [input.mergeChanged
      ? input.mergeChanged(changed.before, changed.settled, entry)
      : mergeRecordDelta(
          changed.before as T & Record<string, unknown>,
          changed.settled as T & Record<string, unknown>,
          entry as T & Record<string, unknown>,
        ) as T]
  })
  for (const entry of input.settled) {
    if (!beforeById.has(entry.id) && !currentIds.has(entry.id)) merged.push(entry)
  }
  return merged
}

/**
 * Applies only the Token/area relations changed by boundary settlement to the
 * latest authority map. This removes ended spell entities without rebasing an
 * unrelated DM map edit that happened while dice/interrupts were resolving.
 */
export function mergeDnd5ePersistentAreaTurnMapDelta(input: {
  before: BattleMap
  settled: BattleMap
  current: BattleMap
}): BattleMap {
  const tokens = mergeEntityDelta({
    before: input.before.tokens,
    settled: input.settled.tokens,
    current: input.current.tokens,
    mergeChanged: (before, settled, current) => mergeRecordDelta(
      before as typeof before & Record<string, unknown>,
      settled as typeof settled & Record<string, unknown>,
      current as typeof current & Record<string, unknown>,
      { numericDeltaFields: new Set(['hp', 'maxHp']) },
    ) as unknown as typeof current,
  })
  const dnd5ePluginAreas = mergeEntityDelta({
    before: input.before.dnd5ePluginAreas ?? [],
    settled: input.settled.dnd5ePluginAreas ?? [],
    current: input.current.dnd5ePluginAreas ?? [],
  })
  if (
    jsonEqual(tokens, input.current.tokens) &&
    jsonEqual(dnd5ePluginAreas, input.current.dnd5ePluginAreas ?? [])
  ) return input.current
  return { ...input.current, tokens, dnd5ePluginAreas }
}

/** Three-way merge for boundary damage/effect changes against the latest roster. */
export function mergeDnd5ePersistentAreaTurnCharacterDelta(input: {
  before: readonly Character[]
  settled: readonly Character[]
  current: readonly Character[]
}): Character[] {
  return mergeEntityDelta({
    ...input,
    mergeChanged: (before, settled, current) => {
      const next = mergeRecordDelta(
        before as Character & Record<string, unknown>,
        settled as Character & Record<string, unknown>,
        current as Character & Record<string, unknown>,
        {
          numericDeltaFields: new Set(['maxHp']),
          skipFields: new Set(['currentHp', 'tempHp']),
        },
      ) as unknown as Character
      const beforeHealth = before.currentHp + before.tempHp
      const settledHealth = settled.currentHp + settled.tempHp
      const healthDelta = settledHealth - beforeHealth
      if (healthDelta < 0) {
        let damage = -healthDelta
        const absorbed = Math.min(current.tempHp, damage)
        next.tempHp = current.tempHp - absorbed
        damage -= absorbed
        next.currentHp = Math.max(0, current.currentHp - damage)
      } else if (healthDelta > 0) {
        next.tempHp = current.tempHp
        next.currentHp = Math.min(next.maxHp, current.currentHp + healthDelta)
      } else {
        next.tempHp = current.tempHp
        next.currentHp = current.currentHp
      }
      return next
    },
  })
}

export interface Dnd5ePersistentAreaTurnCursor {
  mapId: string
  combatId: string
  round: number
  initiativeIndex: number
  tokenId: string
  slotId: string
}

export interface Dnd5ePersistentAreaTurnBoundary {
  timing: 'turn-start' | 'turn-end'
  round: number
  tokenId: string
  /** Stable across an idempotent command retry and distinct for duplicate initiative slots. */
  turnKey: string
}

export interface Dnd5ePersistentAreaTurnTransition {
  cursor: Dnd5ePersistentAreaTurnCursor
  boundaries: Dnd5ePersistentAreaTurnBoundary[]
}

export async function commitDnd5ePersistentAreaTurnCursorAfterSuccess<T>(input: {
  cursor: Dnd5ePersistentAreaTurnCursor
  task: () => Promise<T>
  commit: (cursor: Dnd5ePersistentAreaTurnCursor) => void
}): Promise<T> {
  const result = await input.task()
  input.commit(input.cursor)
  return result
}

export function dnd5ePersistentAreaTurnCursorEquals(
  left: Dnd5ePersistentAreaTurnCursor,
  right: Dnd5ePersistentAreaTurnCursor,
): boolean {
  return left.mapId === right.mapId &&
    left.combatId === right.combatId &&
    left.round === right.round &&
    left.initiativeIndex === right.initiativeIndex &&
    left.tokenId === right.tokenId &&
    left.slotId === right.slotId
}

function turnKey(cursor: Dnd5ePersistentAreaTurnCursor): string {
  return `${cursor.round}:${cursor.slotId || cursor.tokenId}`
}

/**
 * Converts one authoritative initiative cursor change into the exact persistent
 * area boundaries that must be settled. Replaying the same ACK/cursor is a no-op.
 */
export function planDnd5ePersistentAreaTurnTransition(
  previous: Dnd5ePersistentAreaTurnCursor | null | undefined,
  current: Dnd5ePersistentAreaTurnCursor,
): Dnd5ePersistentAreaTurnTransition {
  if (previous && dnd5ePersistentAreaTurnCursorEquals(previous, current)) {
    return { cursor: current, boundaries: [] }
  }
  const boundaries: Dnd5ePersistentAreaTurnBoundary[] = []
  if (
    previous &&
    previous.mapId === current.mapId &&
    previous.combatId === current.combatId
  ) {
    boundaries.push({
      timing: 'turn-end',
      round: previous.round,
      tokenId: previous.tokenId,
      turnKey: turnKey(previous),
    })
  }
  boundaries.push({
    timing: 'turn-start',
    round: current.round,
    tokenId: current.tokenId,
    turnKey: turnKey(current),
  })
  return { cursor: current, boundaries }
}

export function dnd5ePersistentAreaTurnCursor(input: {
  mapId: string
  combatId: string
  round: number
  initiativeIndex: number
  initiativeOrder: readonly InitiativeEntry[]
}): Dnd5ePersistentAreaTurnCursor | undefined {
  const slot = input.initiativeOrder[input.initiativeIndex]
  if (!slot) return undefined
  return {
    mapId: input.mapId,
    combatId: input.combatId,
    round: input.round,
    initiativeIndex: input.initiativeIndex,
    tokenId: slot.tokenId,
    slotId: slot.slotId ?? slot.tokenId,
  }
}

export async function settleDnd5ePersistentAreaTurnTransition(input: {
  transition: Dnd5ePersistentAreaTurnTransition
  map: BattleMap
  characters: readonly Character[]
  settleBoundary: (input: {
    boundary: Dnd5ePersistentAreaTurnBoundary
    map: BattleMap
    characters: readonly Character[]
  }) => Promise<{ map: BattleMap; characters: Character[]; logs: string[] }>
  expireBoundary: (input: {
    boundary: Dnd5ePersistentAreaTurnBoundary
    map: BattleMap
    characters: readonly Character[]
  }) => BattleMap
}): Promise<{ map: BattleMap; characters: Character[]; logs: string[] }> {
  let map = input.map
  let characters = [...input.characters]
  const logs: string[] = []
  for (const boundary of input.transition.boundaries) {
    const settled = await input.settleBoundary({ boundary, map, characters })
    map = input.expireBoundary({
      boundary,
      map: settled.map,
      characters: settled.characters,
    })
    characters = settled.characters
    logs.push(...settled.logs)
  }
  return { map, characters, logs }
}
