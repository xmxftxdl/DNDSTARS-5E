import type { Dnd5eMapInteractionPayload } from '../../application/combat/dnd5eCombatRules'
import {
  dnd5eMapInteractionCanOpenDoorDirectly,
} from '../../application/combat/dnd5eCombatRules'
import {
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
  type MapGeometryDoor,
} from '../../lib/mapGeometry'
import { dnd5eArcaneLockIsActive } from '../../rulesets/dnd5e/mapObjectState'

export type PlayerGeometryDoorClickRoute = 'ignore' | 'spell-target' | 'door-interaction'

export interface PlayerGeometryDoorInteractionOption {
  id: 'open' | 'close' | 'key' | 'password' | 'thieves-tools' | 'break'
  label: string
  payload: Dnd5eMapInteractionPayload
}

/**
 * An active spell picker owns the click first. Otherwise an ordinary player
 * click opens the bounded door-interaction menu; spectators and the DM keep
 * their existing edit/inspection routes.
 */
export function playerGeometryDoorClickRoute(input: {
  isDM: boolean
  isSpectator: boolean
  spellAoeSelectActive: boolean
}): PlayerGeometryDoorClickRoute {
  if (input.isDM || input.isSpectator) return 'ignore'
  return input.spellAoeSelectActive ? 'spell-target' : 'door-interaction'
}

export function playerGeometryDoorInteractionOptions(input: {
  door: MapGeometryDoor
  actorTokenId?: string
  hasMatchingKey: boolean
  hasThievesTools: boolean
  worldMinute?: number
  combatId?: string
  round?: number
}): readonly PlayerGeometryDoorInteractionOption[] {
  const { door } = input
  if (mapGeometryDoorOpenState(door) === 'open') {
    return [{
      id: 'close', label: '关门',
      payload: { doorId: door.id, operation: 'close', method: 'interact' },
    }]
  }

  const lockState = mapGeometryDoorLockState(door)
  const arcaneLockActive = dnd5eArcaneLockIsActive({
    lock: door.dnd5eArcaneLock,
    worldMinute: input.worldMinute,
    combatId: input.combatId,
    round: input.round,
  })
  const options: PlayerGeometryDoorInteractionOption[] = []
  if (dnd5eMapInteractionCanOpenDoorDirectly({
    door,
    actorTokenId: input.actorTokenId,
    worldMinute: input.worldMinute,
    combatId: input.combatId,
    round: input.round,
  })) {
    options.push({
      id: 'open', label: '开门',
      payload: { doorId: door.id, operation: 'open', method: 'interact' },
    })
  }
  if (lockState === 'locked' && input.hasMatchingKey && !arcaneLockActive) {
    options.push({
      id: 'key', label: '使用钥匙开锁',
      payload: { doorId: door.id, operation: 'unlock', method: 'key' },
    })
  }
  if (arcaneLockActive && door.dnd5eArcaneLock?.passwordDigest) {
    options.push({
      id: 'password', label: '说出口令',
      payload: { doorId: door.id, operation: 'open', method: 'password' },
    })
  }
  if (lockState !== 'jammed' && (lockState === 'locked' || arcaneLockActive) && input.hasThievesTools) {
    options.push({
      id: 'thieves-tools', label: '使用盗贼工具撬锁',
      payload: { doorId: door.id, operation: 'unlock', method: 'thieves-tools' },
    })
  }
  options.push({
    id: 'break', label: '力量破门',
    payload: { doorId: door.id, operation: 'break', method: 'force' },
  })
  return options
}
