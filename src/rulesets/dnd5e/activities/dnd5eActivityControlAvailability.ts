import type { Character } from '../../../types/character'
import { normalizeDnd5eClassLevels } from '../classLevels'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { evaluateDnd5eFormulaV1, type Dnd5eFormulaV1 } from './dnd5eFormula'

/** Local presentation hints only. The Host still validates every requirement. */
export function dnd5eActivityControlUnavailableReason(activity: Dnd5eActivityDefinitionV1, character: Character): string | undefined {
  const classLevels: Record<string, number> = Object.fromEntries(
    Object.entries(normalizeDnd5eClassLevels(character)).filter((entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1])))
  const resources = Object.fromEntries(Object.entries(character.classResources ?? {}).map(([id, pool]) =>
    [id, { current: pool.current, maximum: pool.max }]))
  const actor = { level: character.level, abilities: character.abilities, classLevels, resources,
    proficiencyBonus: 2 + Math.floor((Math.max(1, character.level) - 1) / 4) }
  const amount = (formula: Dnd5eFormulaV1) => {
    try { return evaluateDnd5eFormulaV1(formula, { actor, rolls: {} }) }
    catch { return undefined } // Target, slot and dice-dependent values require Host context.
  }
  for (const requirement of activity.requirements ?? []) {
    if (requirement.kind === 'class-level' && (classLevels[requirement.classId] ?? 0) < requirement.minimum) return '职业等级不足'
    if (requirement.kind === 'resource') {
      const minimum = amount(requirement.minimum)
      if (minimum != null && (resources[requirement.resourceId]?.current ?? 0) < minimum) return '资源不足'
    }
  }
  const costs = new Map<string, number>()
  for (const consumption of activity.consumption ?? []) {
    if (consumption.kind !== 'resource') continue
    const cost = amount(consumption.amount)
    if (cost != null && Number.isFinite(cost) && cost > 0) costs.set(consumption.resourceId, (costs.get(consumption.resourceId) ?? 0) + cost)
  }
  for (const [id, cost] of costs) if ((resources[id]?.current ?? 0) < cost) return '资源不足'
  return undefined
}
