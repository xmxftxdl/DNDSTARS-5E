import { useEffect, useState } from 'react'
import { loadRoomRoster } from '../../lib/roomApi'
import type { RoomSession } from '../../lib/roomSession'

export function sameRoomPlayerMemberIds(
  current: ReadonlySet<string> | undefined,
  next: ReadonlySet<string>,
): boolean {
  return current != null
    && current.size === next.size
    && [...next].every((memberId) => current.has(memberId))
}

/** Polls DM presence while preserving the Set identity when the roster is unchanged. */
export function useRoomPlayerMemberIds(
  roomSession: RoomSession | null,
): ReadonlySet<string> | undefined {
  const [memberIds, setMemberIds] = useState<ReadonlySet<string> | undefined>()

  useEffect(() => {
    if (!roomSession || roomSession.role !== 'dm') return
    let disposed = false
    const refresh = async () => {
      try {
        const roster = await loadRoomRoster(roomSession)
        if (disposed) return
        const next = new Set(
          roster.players
            .filter((player) => player.online && player.role === 'player')
            .map((player) => player.memberId),
        )
        setMemberIds((current) => sameRoomPlayerMemberIds(current, next) ? current : next)
      } catch {
        // Keep the last successful roster while the room service reconnects.
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5_000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [roomSession])

  return memberIds
}
