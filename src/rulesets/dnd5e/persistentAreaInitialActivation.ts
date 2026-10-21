import type { Dnd5ePluginArea } from '../../store/maps'
import type { Dnd5ePersistentAreaGrantedActivity } from './persistentAreaTypes'
import { persistentAreaMovementScope } from './persistentAreaMovementScope'

export type Dnd5eAreaActivationClock = {
  combatId?: string; round?: number; turnKey?: string; worldMinute?: number; worldSecondRemainder?: number
}

/** Shared by Host authorization and UI economy labels; missing strict scope never waives an action. */
export function dnd5eAreaInitialActivationAvailable(
  mapId: string, area: Dnd5ePluginArea, grant: Dnd5ePersistentAreaGrantedActivity,
  clock: Dnd5eAreaActivationClock = {},
): boolean {
  if (!grant.activateOnCreate || area.grantedActivityUseReceipts?.includes(grant.activityId)) return false
  if (grant.activationWindow !== 'creation-turn') return true
  const created = area.creationActivationScope
  const current = persistentAreaMovementScope({ ...clock, mapId, actorId: area.sourceTokenId, round: clock.round ?? 0 })
  return !!created && !!current && created.combatId === current.combatId &&
    created.round === current.round && created.turnKey === current.turnKey
}
