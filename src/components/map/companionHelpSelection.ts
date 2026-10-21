import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import { dnd5eActivityOutcomeAllowsChoicesV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'
import type { Token } from '../../store/maps'

export type CompanionHelpSelection = { targetId: string; helpKind: 'attack' | 'ability-check' }

export function companionHelpOperationIds(activity: Pick<Dnd5eActivityDefinitionV1, 'outcomes'> | undefined, choices: Readonly<Record<string, string>>) {
  return [...new Set(activity?.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, choices))
    .flatMap(outcome => outcome.operations.flatMap(operation => operation.kind === 'command-owned-companion' &&
      operation.requiresHelpTarget ? [operation.id] : [])) ?? [])]
}

/** Recomputed on each render; stale selections never silently change to another creature. */
export function companionHelpTargetOptions(tokens: readonly Token[], companionIds: readonly string[]) {
  return tokens.filter(token => token.type !== 'obstacle' && !companionIds.includes(token.id) &&
    (token.hp ?? token.maxHp ?? 1) > 0)
}

export function companionHelpSelectionPayload(operationIds: readonly string[], options: readonly Pick<Token, 'id'>[],
  selections: Readonly<Record<string, CompanionHelpSelection>>) {
  const payload: Record<string, CompanionHelpSelection> = {}
  for (const id of operationIds) {
    const value = selections[id]
    if (!value || !options.some(option => option.id === value.targetId) ||
      !['attack', 'ability-check'].includes(value.helpKind)) return undefined
    payload[id] = { ...value }
  }
  return payload
}

export async function requestCompanionHelpSelections(input: {
  operationIds: readonly string[]
  options: readonly Pick<Token, 'id' | 'label'>[]
  choose: (input: { title: string; message: string; options: { id: string; label: string }[] }) => Promise<string | null>
}): Promise<Record<string, CompanionHelpSelection> | null> {
  if (input.operationIds.length && !input.options.length) return null
  const selections: Record<string, CompanionHelpSelection> = {}
  for (const id of input.operationIds) {
    const helpKind = await input.choose({ title: '选择协助方式', message: '选择召唤物在自己的回合执行的协助动作。', options: [
      { id: 'attack', label: '干扰敌人，协助攻击' }, { id: 'ability-check', label: '协助角色检定' },
    ] })
    if (helpKind !== 'attack' && helpKind !== 'ability-check') return null
    const targetId = await input.choose({ title: helpKind === 'attack' ? '选择要干扰的敌人' : '选择接受协助的角色',
      message: '召唤物在自己的回合执行，届时检查距离并消耗动作。', options: input.options.map(option => ({ id: option.id, label: option.label })) })
    if (!targetId || !input.options.some(option => option.id === targetId)) return null
    selections[id] = { targetId, helpKind }
  }
  return selections
}
