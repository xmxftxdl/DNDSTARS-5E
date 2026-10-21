import { settleDnd5eConcentrationChecks } from './settleDnd5eCombatResult'
import { resolveDnd5eObjectFlightArrival, planDnd5eResolvedObjectFlightArrivalTransaction,
  type Dnd5eObjectFlightArrivalTransactionInput } from '../../rulesets/dnd5e/mapObjectFlightArrivalSettlement'

type Followups = Omit<Parameters<typeof settleDnd5eConcentrationChecks>[0],
  'result' | 'priorState' | 'map' | 'characters' | 'characterIdByCombatantId' | 'preserveOffMapParticipants' | 'priorApplication'>

/** Prepare a complete Host transaction, including concentration and damage
 * reactions. Dice cancellation/errors leave both maps and the pending receipt intact. */
export async function settleDnd5eObjectFlightArrival(input: Dnd5eObjectFlightArrivalTransactionInput,
  followups: Followups) {
  const staged = resolveDnd5eObjectFlightArrival(input)
  if (!staged.ok) return staged
  const settled = await settleDnd5eConcentrationChecks({ ...followups,
    result: staged.committed, priorState: input.state, map: staged.arrival.map,
    characters: input.characters, characterIdByCombatantId: input.characterIdByCombatantId,
    preserveOffMapParticipants: true,
  })
  return planDnd5eResolvedObjectFlightArrivalTransaction({ ...input, characters: settled.application.characters }, {
    ...staged, committed: { ...settled.result, events: [...settled.result.events] },
    arrival: { ...staged.arrival, map: settled.application.map },
  })
}
