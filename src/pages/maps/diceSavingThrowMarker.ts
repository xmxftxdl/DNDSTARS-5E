import { savingThrowAbilityFromRollLabel } from './playerDiceRoll'

export interface DiceSavingThrowMarker {
  id: symbol
  targetTokenId: string
  ability: ReturnType<typeof savingThrowAbilityFromRollLabel>
}

/** Keep the map marker alive through dice animation and DM confirmation,
 * including repeat saves which have no spell-cast presentation event. */
export async function withDiceSavingThrowMarker<T>(input: {
  label: string
  rollKind?: string
  rollerTokenId?: string
  freeRoll?: boolean
  update: (change: (current: DiceSavingThrowMarker[]) => DiceSavingThrowMarker[]) => void
  roll: () => Promise<T>
}): Promise<T> {
  if (input.freeRoll || input.rollKind !== 'saving-throw' || !input.rollerTokenId) return input.roll()
  const marker = { id: Symbol('saving-throw'), targetTokenId: input.rollerTokenId,
    ability: savingThrowAbilityFromRollLabel(input.label) }
  input.update(current => [...current, marker])
  try { return await input.roll() }
  finally { input.update(current => current.filter(entry => entry.id !== marker.id)) }
}
