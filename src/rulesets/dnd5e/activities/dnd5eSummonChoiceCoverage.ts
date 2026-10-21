import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { evaluateDnd5eFormulaV1, type Dnd5eFormulaV1 } from './dnd5eFormula'
import { dnd5eActivityLanguageChoicesV1 } from './dnd5eActivityChoices'
import { getDnd5eSrdMonster } from '../monsters'
import { dnd5eChallengeRatingValue } from '../wildShape'

function dependsOnlyOnSlot(formula: Dnd5eFormulaV1): boolean {
  if (formula.kind === 'constant') return true
  if (formula.kind === 'reference') return ['cast-level', 'slot-delta'].includes(formula.reference.kind)
  if (formula.kind === 'dice') return false
  if ('values' in formula) return formula.values.every(dependsOnlyOnSlot)
  return dependsOnlyOnSlot(formula.value)
}

/** Detects demonstrably unreachable installed choices; does not certify source fidelity. */
export function dnd5eSummonChoiceCoverageIssues(activity: Dnd5eActivityDefinitionV1, minimumCastLevel: number): string[] {
  const issues: string[] = []
  for (const outcome of activity.outcomes) {
    const predicates = outcome.when.kind === 'all' ? outcome.when.conditions : [outcome.when]
    // Other predicates may intentionally restrict the legal casting levels.
    if (predicates.some(predicate => !['always', 'choice'].includes(predicate.kind))) continue
    for (const operation of outcome.operations) {
      if (operation.kind !== 'summon' || !operation.monsterChoiceId || !operation.maximumChallengeRating ||
        !dependsOnlyOnSlot(operation.maximumChallengeRating)) continue
      const choice = activity.choices?.find(entry => entry.id === operation.monsterChoiceId)
      const ceiling = choice?.monsterFilter?.maximumChallengeRating
      if (!choice || !['srd-monsters', 'installed-monsters'].includes(choice.optionsFrom ?? '') || ceiling == null) continue
      const expanded = dnd5eActivityLanguageChoicesV1({ ...activity, choices: [{ ...choice,
        monsterFilter: { ...choice.monsterFilter, maximumChallengeRating: undefined } }] }).choices![0]
      for (let castLevel = Math.max(0, minimumCastLevel); castLevel <= 9; castLevel++) {
        const allowedCr = evaluateDnd5eFormulaV1(operation.maximumChallengeRating, {
          castLevel, rolls: {}, actor: { level: 1, proficiencyBonus: 2,
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
        })
        const missing = expanded.options.find(option => {
          const monster = getDnd5eSrdMonster(option.id)
          if (!monster) return false
          const cr = dnd5eChallengeRatingValue(monster.challenge.rating)
          return cr > ceiling && cr <= allowedCr
        })
        if (!missing) continue
        issues.push(`Activity ${activity.id} 的召唤选择 ${choice.id} 固定 CR 上限 ${ceiling}，屏蔽 ${castLevel} 环召唤公式允许的已安装候选 ${missing.id}；请扩大或移除静态候选 CR 过滤，并保留操作的权威 CR 公式。`)
        break
      }
    }
  }
  return [...new Set(issues)]
}
