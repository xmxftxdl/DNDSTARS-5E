import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'

/** Host-owned declaration, persisted before any downstream presentation or roll. */
export type Dnd5eSlowSpellIntent =
  | { kind: 'player'; action: SharedPlayerActionState }
  | { kind: 'monster-core'; spell: NonNullable<import('./monsterTurnPlan').Dnd5eMonsterTurnPlan['spellCast']> }
  | { kind: 'monster-manual'; spellId: string; spellName: string; slotLevel: number }

export interface Dnd5eSlowSpellGate {
  requestId: string
  createdTurnKey: string
  spellId: string
  spellName: string
  slotLevel: number
  d20: number
  delayed: boolean
  intent: Dnd5eSlowSpellIntent
}

export function slowSpellGateAllows(
  gate: Dnd5eSlowSpellGate | undefined,
  turnKey: string,
  spellId: string,
  slotLevel: number,
): boolean {
  return !!gate && gate.spellId === spellId && gate.slotLevel === slotLevel &&
    (gate.delayed ? gate.createdTurnKey !== turnKey : gate.createdTurnKey === turnKey)
}
