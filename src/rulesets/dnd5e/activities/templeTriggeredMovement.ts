import { dnd5eActivityMapMovementEvents, synchronizeDnd5eActivityMapMovement } from './dnd5eActivityMapMovementEvents'
import { settleDnd5eTempleMovementEntries } from '../templeMovementSettlement'

/** Validate staged trigger movement before publishing it or discovering arrival triggers. */
export async function settleDnd5eTempleTriggeredMovement(
  input: Parameters<typeof synchronizeDnd5eActivityMapMovement>[0] &
    Pick<Parameters<typeof settleDnd5eTempleMovementEntries>[0], 'roll' | 'rollEffectDice' | 'isCurrent'>,
) {
  if (!input.movements.length && !input.carriedTargetIds?.length) {
    return { ok: true as const, map: input.after, state: input.state, events: [...input.events] }
  }
  const movements = dnd5eActivityMapMovementEvents(input)
  const entry = await settleDnd5eTempleMovementEntries({
    state: input.state, map: input.after, events: movements,
    roll: input.roll, rollEffectDice: input.rollEffectDice, isCurrent: input.isCurrent,
  })
  if (!entry.ok) return entry
  const allowed = new Set(entry.events.flatMap(event => event.type === 'moved' ? [event.actorId] : []))
  const denied = new Set(movements.flatMap(event => event.type === 'moved' && !allowed.has(event.actorId) ? [event.actorId] : []))
  const map = { ...input.after, tokens: input.after.tokens.map(token => {
    if (!denied.has(token.id)) return token
    const original = input.before.tokens.find(candidate => candidate.id === token.id)!
    return { ...token, x: original.x, y: original.y, elevationFeet: original.elevationFeet,
      dnd5eTraversalMode: original.dnd5eTraversalMode }
  }) }
  const events = synchronizeDnd5eActivityMapMovement({
    ...input, after: map, state: entry.state,
    movements: input.movements.filter(movement => allowed.has(movement.targetId)),
    carriedTargetIds: input.carriedTargetIds?.filter(id => allowed.has(id)),
    harmfulMovementTargetIds: input.harmfulMovementTargetIds?.filter(id => allowed.has(id)),
    events: [...input.events, ...entry.events.filter(event => event.type !== 'moved')],
  })
  return { ok: true as const, map, state: entry.state, events }
}
