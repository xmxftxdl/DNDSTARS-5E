import { settleDnd5eTempleMovementEntries } from './templeMovementSettlement'
import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'

type EntryInput = Parameters<typeof settleDnd5eTempleMovementEntries>[0]

/** Evaluate the ward before arrival/falling; the caller owns the final commit. */
export async function settleAttackTeleportBoundary(input: Omit<EntryInput, 'events'> & {
  actorId: string
  originalState: Dnd5eHeadlessCombatState
  distanceFeet: number
}) {
  if (!input.isCurrent()) return { ok: false as const, reason: 'temple-entry-authority-changed' }
  const from = input.originalState.combatants[input.actorId]
  const to = input.state.combatants[input.actorId]
  if (!from || !to) return { ok: false as const, reason: 'temple-movement-actor-missing' }
  const settled = await settleDnd5eTempleMovementEntries({ ...input, events: [{
    type: 'moved', actorId: input.actorId, from: { ...from.position }, to: { ...to.position },
    fromElevationFeet: from.elevationFeet ?? from.groundElevationFeet ?? 0,
    toElevationFeet: to.elevationFeet ?? to.groundElevationFeet ?? 0,
    fromMapId: input.map.id, toMapId: input.map.id, movementKind: 'teleport', distance: input.distanceFeet,
  }] })
  if (!settled.ok) return settled
  return { ...settled, allowed: settled.events.some(event => event.type === 'moved' && event.actorId === input.actorId),
    events: settled.events.filter(event => event.type !== 'moved') }
}

