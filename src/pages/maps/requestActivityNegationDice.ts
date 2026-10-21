import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eHeadlessCombatState } from '../../rulesets/dnd5e/headlessCombatEngine'
import type { Dnd5ePluginDiceRollDeclaration } from '../../rulesets/dnd5e/plugins/pluginHeadlessContracts'
import type { Dnd5ePluginDiceRoller } from '../../rulesets/dnd5e/pluginDice'
import { collectDnd5eActivityNegationDice } from '../../rulesets/dnd5e/activities/dnd5eActivityNegationDice'
import { dnd5eActivityNegationContext, type Dnd5eActivityNegationChoice } from '../../rulesets/dnd5e/activities/dnd5eActivityDisadvantageNegation'
import { requestDisadvantageNegation } from './requestDisadvantageNegation'

export async function requestMapActivityNegation(input: {
  map: BattleMap; characters: readonly Character[]; state: Dnd5eHeadlessCombatState
  activityId: string; actionId: string; declaration: Dnd5ePluginDiceRollDeclaration
  choose: Parameters<typeof requestDisadvantageNegation>[1]['choose']; isCurrent: () => boolean
}) {
  const token = input.map.tokens.find(row => row.id === input.declaration.rollerTokenId)
  const owner = input.characters.find(row => row.id === token?.characterId)
  const actor = input.declaration.rollerTokenId ? input.state.combatants[input.declaration.rollerTokenId] : undefined
  if (!owner || !actor || !input.declaration.d20RollKind) return undefined
  const contextId = dnd5eActivityNegationContext(input.activityId, input.actionId, input.declaration.id, actor.id)
  const rollId = crypto.randomUUID()
  const choice = await requestDisadvantageNegation({ mapId: input.map.id, transactionId: input.actionId,
    character: { ...owner, classResources: structuredClone(actor.classResources) },
    roll: { rollId, characterId: owner.id, kind: input.declaration.d20RollKind, mode: 'disadvantage', phase: 'before-roll', contextId },
  }, { choose: input.choose, isCurrent: input.isCurrent, deferToParentTransaction: true })
  return choice?.used ? { featureId: choice.featureId, rollId, transactionId: input.actionId, contextId } : undefined
}

/** A single map action can collect checks and dependent dice in several phases. */
export function createMapActivityNegationDice(input: {
  map: BattleMap; characters: readonly Character[]; state: Dnd5eHeadlessCombatState
  parent?: Parameters<typeof collectDnd5eActivityNegationDice>[0]['parent']
  activityId: string; actionId: string
  roll: Dnd5ePluginDiceRoller
  choose: Parameters<typeof requestDisadvantageNegation>[1]['choose']
  isCurrent: () => boolean
}) {
  let previous: { declarations: readonly Dnd5ePluginDiceRollDeclaration[]; choices: Readonly<Record<string, Dnd5eActivityNegationChoice>> } | undefined
  return {
    choices: () => ({ ...previous?.choices }),
    async collect(declarations: readonly Dnd5ePluginDiceRollDeclaration[]) {
      const result = await collectDnd5eActivityNegationDice({ ...input, declarations, previous,
        choose: async (declaration, available) => {
          return requestMapActivityNegation({ ...input, declaration, state: available })
        },
      })
      previous = { declarations: result.declarations, choices: result.disadvantageNegationChoices }
      return result.authoritativeRolls
    },
  }
}
