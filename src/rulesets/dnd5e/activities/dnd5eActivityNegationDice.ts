import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { evaluateDnd5eFormulaV1 } from './dnd5eFormula'
import type { Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import { executeDnd5ePluginDiceRolls, type Dnd5ePluginDiceRoller } from '../pluginDice'
import type { Dnd5ePluginDiceRollDeclaration, Dnd5ePluginDiceRollResult } from '../plugins/pluginHeadlessContracts'
import { prepareDnd5eActivityDisadvantageNegation, type Dnd5eActivityNegationChoice } from './dnd5eActivityDisadvantageNegation'

/** Collect on the Host from its declarations. Resource changes remain private until parent commit. */
export async function collectDnd5eActivityNegationDice(input: {
  state: Dnd5eHeadlessCombatState
  activityId: string
  actionId: string
  parent?: { activity: Dnd5eActivityDefinitionV1; actorId: string; castLevel?: number }
  declarations: readonly Dnd5ePluginDiceRollDeclaration[]
  previous?: { declarations: readonly Dnd5ePluginDiceRollDeclaration[]; choices: Readonly<Record<string, Dnd5eActivityNegationChoice>> }
  choose: (declaration: Dnd5ePluginDiceRollDeclaration, availableState: Dnd5eHeadlessCombatState) => Promise<Dnd5eActivityNegationChoice | undefined>
  roll: Dnd5ePluginDiceRoller
  isCurrent: () => boolean
}) {
  // Validate identities before opening any UI or rolling dice.
  const state = structuredClone(input.state)
  if (input.parent) {
    const actor = state.combatants[input.parent.actorId]
    if (!actor) throw Error('activity-negation-parent-actor-missing')
    const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(actor)
    const costs = new Map<string, number>()
    for (const cost of input.parent.activity.consumption ?? []) {
      if (cost.kind !== 'resource') continue
      let amount: number
      try { amount = evaluateDnd5eFormulaV1(cost.amount, { actor: snapshot, rolls: {},
        castLevel: input.parent.castLevel }) }
      catch { continue } // Dice/target-dependent costs are revalidated by the parent commit.
      if (!Number.isFinite(amount) || amount < 0) throw Error('activity-negation-invalid-parent-cost')
      costs.set(cost.resourceId, (costs.get(cost.resourceId) ?? 0) + amount)
    }
    for (const [key, amount] of costs) {
      if (!amount) continue
      const resource = actor.classResources[key]
      if (!resource || resource.current < amount) throw Error('activity-negation-parent-cost-unavailable')
      resource.current -= amount
    }
  }
  const declarations = [...(input.previous?.declarations ?? []), ...input.declarations]
  const choices: Record<string, Dnd5eActivityNegationChoice> = { ...input.previous?.choices }
  let available = prepareDnd5eActivityDisadvantageNegation({ ...input, state, declarations, choices }).state
  const rolls: Record<string, Dnd5ePluginDiceRollResult> = {}
  const assertCurrent = () => { if (!input.isCurrent()) throw Error('activity-negation-stale') }
  for (const declaration of input.declarations) {
    assertCurrent()
    const eligible = declaration.sides === 20 && declaration.count === 2 &&
      declaration.d20RollMode === 'disadvantage' && !!declaration.d20RollKind &&
      !!declaration.rollerTokenId && !(declaration.rerollValues?.length)
    const choice = eligible ? await input.choose({ ...declaration }, structuredClone(available)) : undefined
    assertCurrent()
    if (choice) choices[declaration.id] = choice
    // Revalidate the whole selection to prevent reused receipts and to reserve prior costs.
    const prepared = prepareDnd5eActivityDisadvantageNegation({ ...input, state, declarations, choices })
    available = prepared.state
    const recipe = prepared.declarations.find(row => row.id === declaration.id)!
    Object.assign(rolls, await executeDnd5ePluginDiceRolls({ rolls: [recipe] }, input.roll))
    assertCurrent()
  }
  return { authoritativeRolls: rolls, disadvantageNegationChoices: choices, declarations }
}
