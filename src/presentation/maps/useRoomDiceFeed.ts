import { useCallback, useState } from 'react'
import { clearCompletedRoomDice, clearedRoomDiceReplay, readRoomDiceFeed, upsertRoomDice, writeRoomDiceFeed, type RoomDiceEntry } from './roomDiceFeed'

export function useRoomDiceFeed(scope: string) {
  const [state, setState] = useState(() => ({ scope, entries: readRoomDiceFeed(scope) }))
  const entries = state.scope === scope ? state.entries : readRoomDiceFeed(scope)
  const add = useCallback((entry: RoomDiceEntry) => {
    const stored = readRoomDiceFeed(scope)
    if (clearedRoomDiceReplay(scope, stored, entry)) return false
    const isNew = !stored.some(row => row.id === entry.id)
    setState(current => {
      const previous = current.scope === scope ? current.entries : readRoomDiceFeed(scope)
      // Cleared results must not return through room replay or late confirmation.
      if (clearedRoomDiceReplay(scope, previous, entry)) return current
      const next = upsertRoomDice(previous, entry)
      writeRoomDiceFeed(scope, next)
      return { scope, entries: next }
    })
    return isNew
  }, [scope])
  const clear = useCallback(() => {
    setState(current => {
      const previous = current.scope === scope ? current.entries : readRoomDiceFeed(scope)
      const next = clearCompletedRoomDice(scope, previous)
      return { scope, entries: next }
    })
  }, [scope])
  const discardPending = useCallback(() => {
    setState(current => {
      const previous = current.scope === scope ? current.entries : readRoomDiceFeed(scope)
      const pending = previous.filter(entry => entry.status === 'waiting' || entry.status === 'review')
      clearCompletedRoomDice(scope, pending.map(entry => ({ ...entry, status: 'result' as const })))
      const next = previous.filter(entry => entry.status !== 'waiting' && entry.status !== 'review')
      writeRoomDiceFeed(scope, next)
      return { scope, entries: next }
    })
  }, [scope])
  return { entries, add, clear, discardPending }
}
