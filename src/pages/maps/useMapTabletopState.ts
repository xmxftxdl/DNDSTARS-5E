import { useEffect, useState } from 'react'
import { browserSharedRoomService } from '../../composition/browserSharedRoomService'
import {
  EMPTY_MAP_TABLETOP_STATE,
  MAP_TABLETOP_CHANNEL,
  nextMapTabletopExpiration,
  reduceMapTabletopState,
  type MapTabletopState,
} from '../../lib/mapTabletop'

/**
 * Owns shared tabletop events without waking the map workspace on an idle poll.
 * Cleanup runs once at the next real expiration instead of once every second.
 */
export function useMapTabletopState(): MapTabletopState {
  const [state, setState] = useState<MapTabletopState>(EMPTY_MAP_TABLETOP_STATE)

  useEffect(() => browserSharedRoomService.subscribeSharedEvent(
    MAP_TABLETOP_CHANNEL,
    (event) => setState((current) => reduceMapTabletopState(current, event)),
  ), [])

  const nextExpiration = nextMapTabletopExpiration(state)
  useEffect(() => {
    if (nextExpiration == null) return
    const delay = Math.max(0, nextExpiration - Date.now()) + 1
    const timer = window.setTimeout(() => {
      setState((current) => reduceMapTabletopState(current, null))
    }, delay)
    return () => window.clearTimeout(timer)
  }, [nextExpiration])

  return state
}
