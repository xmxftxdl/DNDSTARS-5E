export type Dnd5eRollDiceKind = 'attack' | 'ability-check' | 'saving-throw' | 'concentration-save'
export interface Dnd5eRollDiceModifier {
  count: number
  sides: 4 | 6 | 8 | 10 | 12 | 20
  direction: 'add' | 'subtract'
  appliesTo: readonly Dnd5eRollDiceKind[]
}
export function normalizeDnd5eRollDiceModifiers(value: unknown): readonly Dnd5eRollDiceModifier[] | undefined
