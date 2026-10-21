import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import { dnd5eActivityOutcomeAllowsChoicesV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'

export function companionAttackTargetOptions(tokens: readonly Token[], companionIds: readonly string[], characters: readonly Character[]) {
  return tokens.filter(token => {
    if (token.type === 'obstacle' || companionIds.includes(token.id)) return false
    const character = characters.find(candidate => candidate.id === token.characterId)
    return character ? !(character.currentHp <= 0 && (character.deathSaveFailures ?? 0) >= 3)
      : (token.hp ?? token.maxHp ?? 1) > 0
  })
}

export function companionAttackOperationIds(activity: Pick<Dnd5eActivityDefinitionV1, 'outcomes'> | undefined, choices: Readonly<Record<string, string>>) {
  return [...new Set(activity?.outcomes.filter(outcome => dnd5eActivityOutcomeAllowsChoicesV1(outcome, choices))
    .flatMap(outcome => outcome.operations.flatMap(operation => operation.kind === 'command-owned-companion' &&
      operation.requiresAttackTarget ? [operation.id] : [])) ?? [])]
}

export async function requestCompanionAttackSelections(input: {
  operationIds: readonly string[]
  options: readonly Pick<Token, 'id' | 'label'>[]
  choose: (input: { title: string; message: string; options: { id: string; label: string }[] }) => Promise<string | null>
}): Promise<Record<string, string> | null> {
  if (input.operationIds.length && !input.options.length) return null
  const selections: Record<string, string> = {}
  for (const id of input.operationIds) {
    const targetId = await input.choose({ title: '选择亡灵或召唤物要攻击的目标',
      message: '受令者在自己的回合攻击此目标；届时检查距离、命中与伤害。目标失效后不会改攻其他单位。',
      options: input.options.map(option => ({ id: option.id, label: option.label })) })
    if (!targetId || !input.options.some(option => option.id === targetId)) return null
    selections[id] = targetId
  }
  return selections
}
