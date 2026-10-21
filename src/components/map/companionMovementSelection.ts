import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import { dnd5eActivityOutcomeAllowsChoicesV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'
import { dnd5eCompanionDestinationFitsMap, type Dnd5eCompanionMovementDestination } from '../../rulesets/dnd5e/companionMovementDestination'
import type { BattleMap, Token } from '../../store/maps'

export function companionMovementOperationIds(activity: Pick<Dnd5eActivityDefinitionV1, 'outcomes'> | undefined, choices: Readonly<Record<string, string>>) {
  return [...new Set(activity?.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, choices))
    .flatMap(outcome => outcome.operations.flatMap(operation => operation.kind === 'command-owned-companion' &&
      operation.allowsMovementDestination ? [operation.id] : [])) ?? [])]
}

export async function requestCompanionMovementSelections(input: {
  operationIds: readonly string[]
  map: BattleMap
  recipientIds: readonly string[]
  isCurrent: () => boolean
  choose: (input: { title: string; message: string; options: { id: string; label: string }[] }) => Promise<string | null>
  chooseDestination: (token: Token) => Promise<{ x: number; y: number } | undefined>
}): Promise<Record<string, Record<string, Dnd5eCompanionMovementDestination>> | null> {
  const recipients = [...new Set(input.recipientIds)].map(id => input.map.tokens.find(token => token.id === id))
  if (!recipients.length || recipients.some(token => !token)) return null
  const selections: Record<string, Record<string, Dnd5eCompanionMovementDestination>> = {}
  for (const operationId of input.operationIds) {
    selections[operationId] = {}
    for (const recipient of recipients) {
      if (!recipient || !input.isCurrent()) return null
      const choice = await input.choose({ title: `${recipient.label} · 移动指令`,
        message: '选择其目的地。该生物在自己的回合按移动力前往，未到达时保留指令；下令不会立即移动。',
        options: [{ id: 'hold', label: '保持当前位置' }, { id: 'move', label: '在地图选择目的地' }] })
      if (!input.isCurrent() || (choice !== 'hold' && choice !== 'move')) return null
      const point = choice === 'hold' ? { x: recipient.x, y: recipient.y } : await input.chooseDestination(recipient)
      if (!input.isCurrent() || !point) return null
      const destination = { mapId: input.map.id, x: point.x, y: point.y }
      if (!dnd5eCompanionDestinationFitsMap(input.map, recipient.id, destination)) return null
      selections[operationId][recipient.id] = destination
    }
  }
  return selections
}
