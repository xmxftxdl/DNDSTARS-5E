import type { Character } from '../../types/character'
import type { DisadvantageNegationRoll } from '../../rulesets/dnd5e/disadvantageNegation'
import { dnd5eDisadvantageNegationOptions } from '../../rulesets/dnd5e/disadvantageNegation'
import { commitDisadvantageNegation } from './commitDisadvantageNegation'

export interface DisadvantageNegationChoice {
  id: string
  transactionId: string
  mapId: string
  actor: Pick<Character, 'id'>
  pluginId: string
  featureId: string
  featureName: string
  prompt: string
  audience: 'actor'
  options: Array<{ id: string; label: string }>
  defaultOptionId: 'decline'
  phase: 'before-action'
  context: { disadvantageNegation: DisadvantageNegationRoll }
}

/** Keep the d20 unrolled until the owning player answers and the Host seals the debit. */
export async function requestDisadvantageNegation(input: {
  mapId: string
  transactionId: string
  character: Character
  roll: DisadvantageNegationRoll
}, ports: {
  choose: (choice: DisadvantageNegationChoice) => Promise<string | undefined>
  commit?: typeof commitDisadvantageNegation
  /** Private replayable movement: the owning transaction must validate and debit the choice. */
  deferToParentTransaction?: boolean
  isCurrent: () => boolean
}) {
  const options = dnd5eDisadvantageNegationOptions(input.character, input.roll)
  for (const option of options) {
    if (!ports.isCurrent()) throw Error('negation-roll-context-changed')
    const id = `negation:${input.roll.rollId}:${option.featureId}`
    const selected = await ports.choose({
      id, transactionId: input.transactionId, mapId: input.mapId, actor: input.character,
      pluginId: option.pluginId, featureId: option.featureId, featureName: option.label,
      prompt: `是否使用「${option.label}」取消本次劣势？选择后再投掷本次检定。`,
      audience: 'actor', options: [{ id: 'use', label: `使用（消耗 ${option.resourceCosts.map(cost => `${cost.amount} ${cost.resourceKey === 'dnd5e-ki' ? '点气' : cost.resourceKey}`).join('、')}）` },
        { id: 'decline', label: '不使用，保留劣势' }],
      defaultOptionId: 'decline', phase: 'before-action', context: { disadvantageNegation: { ...input.roll } },
    })
    if (!ports.isCurrent()) throw Error('negation-roll-context-changed')
    // Cancelled/rolled-back prompts cannot authorize a debit or a normal roll.
    if (selected !== 'use' && selected !== 'decline') continue
    if (ports.deferToParentTransaction) {
      if (selected === 'use') return { rollId: input.roll.rollId, characterId: input.character.id,
        featureId: option.featureId, mode: 'normal' as const, used: true }
      continue
    }
    const settlement = await (ports.commit ?? commitDisadvantageNegation)({ mapId: input.mapId, interruptId: id })
    if (settlement.rollId !== input.roll.rollId || settlement.characterId !== input.character.id ||
      settlement.featureId !== option.featureId || settlement.used !== (selected === 'use') ||
      settlement.mode !== (selected === 'use' ? 'normal' : 'disadvantage')) throw Error('negation-settlement-mismatch')
    if (settlement.used) return settlement
  }
  return undefined
}
