import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import { dnd5eActivityOutcomeAllowsChoicesV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'
import { dnd5eCompanionGuardAreaFitsMap, type Dnd5eCompanionGuardArea } from '../../rulesets/dnd5e/companionGuardArea'
import type { BattleMap, Token } from '../../store/maps'

export function companionGuardOperationIds(activity: Pick<Dnd5eActivityDefinitionV1, 'outcomes'> | undefined, choices: Readonly<Record<string, string>>) {
  return [...new Set(activity?.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, choices))
    .flatMap(outcome => outcome.operations.flatMap(operation => operation.kind === 'command-owned-companion' &&
      operation.requiresGuardArea ? [operation.id] : [])) ?? [])]
}

/** Two selected cell centers define an inclusive rectangle, shared by all recipients. */
export async function requestCompanionGuardSelections(input: {
  operationIds: readonly string[]; map: BattleMap; recipientIds: readonly string[]; isCurrent: () => boolean
  chooseCorner: (token: Token, corner: 1 | 2) => Promise<{ x: number; y: number } | undefined>
}): Promise<Record<string, Dnd5eCompanionGuardArea> | null> {
  const recipients = [...new Set(input.recipientIds)].map(id => input.map.tokens.find(token => token.id === id))
  if (!recipients.length || recipients.some(token => !token)) return null
  const result: Record<string, Dnd5eCompanionGuardArea> = {}
  for (const id of input.operationIds) {
    if (!input.isCurrent()) return null
    const first = await input.chooseCorner(recipients[0]!, 1)
    if (!first || !input.isCurrent()) return null
    const last = await input.chooseCorner(recipients[0]!, 2)
    if (!last || !input.isCurrent()) return null
    const half = input.map.gridSize / 2
    const area = { mapId: input.map.id, minX: Math.min(first.x,last.x)-half, minY: Math.min(first.y,last.y)-half,
      maxX: Math.max(first.x,last.x)+half, maxY: Math.max(first.y,last.y)+half }
    if (!dnd5eCompanionGuardAreaFitsMap(input.map,area) || recipients.some(token =>
      Math.max(1,token!.size ?? 1)*input.map.gridSize > Math.min(area.maxX-area.minX,area.maxY-area.minY))) return null
    result[id]=area
  }
  return result
}
