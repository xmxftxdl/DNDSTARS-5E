import { adoptedD20Index, type DiceCheckPresentation } from './diceCheckPresentation'
import type { SharedDiceState, SharedRollRequestEvent } from '../../lib/sharedCombatTypes'
import { dismissRoomDice, loadRoomDiceDismissal, roomDiceDismissed, saveRoomDiceDismissal } from './roomDiceDismissal'

export function clearedRoomDiceReplay(scope: string, entries: readonly RoomDiceEntry[], incoming: RoomDiceEntry) {
  return !entries.some(entry => entry.id === incoming.id)
    && roomDiceDismissed([incoming], loadRoomDiceDismissal(`cleared:${scope}`))
}

export function clearCompletedRoomDice(scope: string, entries: readonly RoomDiceEntry[]): RoomDiceEntry[] {
  const marker = dismissRoomDice(entries.filter(entry => entry.status === 'result' || entry.status === 'confirmed'))
  const saved = loadRoomDiceDismissal(`cleared:${scope}`)
  saveRoomDiceDismissal(`cleared:${scope}`, {
    ids: [...new Set([...(saved?.ids ?? []), ...marker.ids])],
    latest: Math.max(saved?.latest ?? 0, marker.latest),
  })
  const pending = entries.filter(entry => entry.status === 'waiting' || entry.status === 'review')
  writeRoomDiceFeed(scope, pending)
  return pending
}

export interface RoomDiceEntry {
  sourceRollIds?: string[]
  check?: DiceCheckPresentation
  rollerTokenId?: string
  rollerCharacterId?: string
  dieSides?: number[]
  id: string
  rollerName: string
  label: string
  targetName: string
  sides: number
  values: number[]
  formula: string
  total?: number
  bonus?: number
  status: 'waiting' | 'review' | 'confirmed' | 'result'
  updatedAt: number
}

export function upsertRoomDice(entries: readonly RoomDiceEntry[], incoming: RoomDiceEntry): RoomDiceEntry[] {
  // A late raw-face confirmation cannot recreate a finalized check row.
  if (!incoming.sourceRollIds?.length && entries.some(entry => entry.sourceRollIds?.includes(incoming.id))) return [...entries]
  const existing = entries.find(entry => entry.id === incoming.id)
  const rank = { waiting: 0, review: 1, result: 2, confirmed: 3 }
  if (existing && ((!incoming.sourceRollIds?.length && rank[incoming.status] < rank[existing.status]) || incoming.updatedAt < existing.updatedAt)) return [...entries]
  const entry = incoming.status === 'confirmed' && existing ? { ...incoming, rollerName: existing.rollerName } : incoming
  return [...entries.filter(entry => entry.id !== incoming.id && !incoming.sourceRollIds?.includes(entry.id)), entry]
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 24)
}

export function sharedDicePresentationLabels(event: Pick<SharedRollRequestEvent, 'label' | 'targetName'>) {
  return { label: event.label.replace(/（DM 修正）$/, ''), targetName: event.targetName }
}

export function roomDiceRequest(event: SharedRollRequestEvent): RoomDiceEntry {
  const adopted = event.sides === 20 ? adoptedD20Index(event.values, event.check) : undefined
  const confirmed = event.requestId.endsWith(':dm-confirmed')
  return {
    id: event.requestId.replace(/:dm-confirmed$/, ''),
    rollerTokenId: event.rollerTokenId, rollerCharacterId: event.targetCharacterId,
    rollerName: event.rollerName || (event.delivery === 'player-roll-result' || event.delivery === 'player-roll-request'
      ? event.targetName : event.sourceMode === 'dm' ? 'DM' : '玩家'),
    ...sharedDicePresentationLabels(event),
    sides: event.sides, values: event.values, check: event.check,
    formula: `${event.count}d${event.sides}`,
    total: adopted != null ? event.values[adopted] : event.values.length ? event.values.reduce((sum, value) => sum + value, 0) : undefined,
    status: confirmed ? 'confirmed' : event.delivery === 'player-roll-request' ? 'waiting' : 'review',
    updatedAt: event.updatedAt,
  }
}

export function roomDiceResult(event: SharedDiceState): RoomDiceEntry | null {
  if (!event.roll) return null
  return {
    dieSides: event.roll.dieSides,
    id: event.roll.sourceRollIds?.[0] ?? event.id, sourceRollIds: event.roll.sourceRollIds,
    rollerName: event.rollerName || (event.sourceMode === 'dm' ? 'DM' : '玩家'),
    label: event.roll.label, targetName: event.roll.targetName,
    sides: event.roll.sides, values: event.roll.values, total: event.roll.total, bonus: event.roll.bonus,
    formula: event.roll.formula || `${event.roll.values.length}d${event.roll.sides}${event.roll.bonus ? `${event.roll.bonus > 0 ? '+' : ''}${event.roll.bonus}` : ''}`,
    status: 'result', updatedAt: event.updatedAt,
  }
}

export function readRoomDiceFeed(scope: string): RoomDiceEntry[] {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(`astraltrace:room-dice:v1:${scope}`) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is RoomDiceEntry => item && typeof item.id === 'string'
      && typeof item.rollerName === 'string' && typeof item.label === 'string' && typeof item.formula === 'string'
      && ['waiting', 'review', 'confirmed', 'result'].includes(item.status)
      && Number.isInteger(item.sides) && item.sides >= 2 && item.sides <= 100
      && Array.isArray(item.values) && item.values.length <= 100
      && item.values.every((n: number) => Number.isInteger(n) && n >= 1 && n <= item.sides)
      && Number.isFinite(item.updatedAt)).slice(0, 24)
  } catch { return [] }
}

export function writeRoomDiceFeed(scope: string, entries: readonly RoomDiceEntry[]) {
  try { window.sessionStorage.setItem(`astraltrace:room-dice:v1:${scope}`, JSON.stringify(entries.slice(0, 24))) } catch { /* Optional display cache. */ }
}

/** Public records do not imply animating another creature's opposed die in this player's tray. */
export function shouldPresentSharedDiceInPlayerTray(
  event: Pick<SharedRollRequestEvent, 'ownerOnlyPresentation' | 'targetCharacterId'>,
  controlledCharacterIds: ReadonlySet<string>,
): boolean {
  if (event.targetCharacterId) return controlledCharacterIds.has(event.targetCharacterId)
  return !event.ownerOnlyPresentation
}
