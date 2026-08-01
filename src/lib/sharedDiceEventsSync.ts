import { mutateSharedRoomResource } from './sharedApi'
import type { SharedDiceEventsState, SharedDiceState } from './sharedCombatTypes'

export function appendSharedDiceEvent(
  mapId: string,
  event: SharedDiceState,
): Promise<SharedDiceEventsState> {
  return mutateSharedRoomResource<SharedDiceEventsState>(
    'dice-events',
    '/state/dice-events/append',
    { operation: 'append', mapId, event },
  )
}
