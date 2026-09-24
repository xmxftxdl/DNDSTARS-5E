import type { RoomDiceEntry } from './roomDiceFeed'
export interface RoomDiceDismissal { ids: string[]; latest: number }
export function dismissRoomDice(entries: readonly RoomDiceEntry[]): RoomDiceDismissal {
  return { ids: entries.map(entry => entry.id), latest: Math.max(0, ...entries.map(entry => entry.updatedAt)) }
}
export function roomDiceDismissed(entries: readonly RoomDiceEntry[], dismissal: RoomDiceDismissal | null): boolean {
  return dismissal != null && !entries.some(entry => !dismissal.ids.includes(entry.id) && entry.updatedAt >= dismissal.latest)
}
export function loadRoomDiceDismissal(scope?: string): RoomDiceDismissal | null {
  if (!scope) return null
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(`room-dice-dismissal:${scope}`) ?? 'null')
    return saved && Array.isArray(saved.ids) && saved.ids.every((id: unknown) => typeof id === 'string') && Number.isFinite(saved.latest) ? saved : null
  } catch { return null }
}
export function saveRoomDiceDismissal(scope: string | undefined, value: RoomDiceDismissal | null) {
  if (!scope) return
  try { window.sessionStorage.setItem(`room-dice-dismissal:${scope}`, JSON.stringify(value)) } catch { /* Optional UI preference. */ }
}
