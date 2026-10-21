import type { Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import type { Dnd5ePluginDiceRollDeclaration } from '../plugins/pluginHeadlessContracts'
import { consumeDnd5eDisadvantageNegation, stageDnd5eCombatantDisadvantageNegation } from '../disadvantageNegation'

export interface Dnd5eActivityNegationChoice {
  featureId: string
  rollId: string
  transactionId: string
  contextId: string
}

export function dnd5eActivityNegationContext(activityId: string, actionId: string, declarationId: string, rollerId: string) {
  return JSON.stringify(['activity-roll', activityId, actionId, declarationId, rollerId])
}

/** Host recipes only. Never use declarations or ownership supplied by a player command. */
export function prepareDnd5eActivityDisadvantageNegation(input: {
  state: Dnd5eHeadlessCombatState
  activityId: string
  actionId: string
  declarations: readonly Dnd5ePluginDiceRollDeclaration[]
  choices: Readonly<Record<string, Dnd5eActivityNegationChoice>>
}) {
  const state = structuredClone(input.state)
  const declarations = input.declarations.map(row => ({ ...row }))
  const selected = new Set<string>()
  const receipts = new Set<string>()
  if (!input.activityId.trim() || !input.actionId.trim() ||
    new Set(declarations.map(row => row.id)).size !== declarations.length) throw Error('activity-negation-invalid-context')
  for (const declaration of declarations) {
    const choice = input.choices[declaration.id]
    if (!choice) continue
    selected.add(declaration.id)
    const actor = declaration.rollerTokenId ? state.combatants[declaration.rollerTokenId] : undefined
    if (!actor || declaration.sides !== 20 || declaration.count !== 2 || declaration.d20RollMode !== 'disadvantage' ||
      !declaration.d20RollKind || (declaration.rerollValues?.length ?? 0) > 0 || receipts.has(choice.rollId)) {
      throw Error('activity-negation-invalid-roll')
    }
    const contextId = dnd5eActivityNegationContext(input.activityId, input.actionId, declaration.id, actor.id)
    if (choice.contextId !== contextId || choice.transactionId !== input.actionId) throw Error('activity-negation-context-mismatch')
    stageDnd5eCombatantDisadvantageNegation(actor, choice, { kind: declaration.d20RollKind, mode: 'disadvantage', contextId })
    consumeDnd5eDisadvantageNegation(actor, { ...choice, kind: declaration.d20RollKind, mode: 'disadvantage', contextId })
    receipts.add(choice.rollId)
    declaration.count = 1
    declaration.acceptedCounts = [1]
    declaration.d20RollMode = 'normal'
  }
  if (Object.keys(input.choices).some(id => !selected.has(id))) throw Error('activity-negation-unused-choice')
  return { state, declarations, negatedDeclarationIds: [...selected] }
}


/** One parent execution, including deterministic critical-result re-evaluation. */
export function createDnd5eActivityNegationSession(input: {
  state: Dnd5eHeadlessCombatState; activityId: string; actionId: string;
  choices: Readonly<Record<string, Dnd5eActivityNegationChoice>>
}) {
  let state = structuredClone(input.state)
  const resolved = new Map<string, string>()
  const receiptIds = new Set<string>()
  return {
    negate(roll: { rollId: string; rollerId: string; kind: 'attack' | 'ability-check' | 'saving-throw'; mode: 'normal' | 'advantage' | 'disadvantage' }) {
      const choice = input.choices[roll.rollId]
      if (!choice) return false
      const identity = JSON.stringify(roll)
      if (resolved.has(roll.rollId)) {
        if (resolved.get(roll.rollId) !== identity) throw Error('activity-negation-replay-mismatch')
        return true
      }
      if (receiptIds.has(choice.rollId)) throw Error('activity-negation-reused-receipt')
      const prepared = prepareDnd5eActivityDisadvantageNegation({ ...input, state,
        declarations: [{ id: roll.rollId, label: roll.rollId, sides: 20, count: roll.mode === 'normal' ? 1 : 2,
          rollerTokenId: roll.rollerId, d20RollKind: roll.kind, d20RollMode: roll.mode }],
        choices: { [roll.rollId]: choice } })
      state = prepared.state
      resolved.set(roll.rollId, identity)
      receiptIds.add(choice.rollId)
      return true
    },
    complete() { return Object.keys(input.choices).every(id => resolved.has(id)) },
    state() { return state },
  }
}
