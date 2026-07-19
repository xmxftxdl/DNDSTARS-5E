import type {
  Dnd5ePluginDiceRollDeclaration,
  Dnd5ePluginDiceRollResult,
  Dnd5ePluginHeadlessActionDefinition,
} from './pluginApi'

export type Dnd5ePluginDiceRoller = (
  declaration: Dnd5ePluginDiceRollDeclaration,
) => Promise<readonly number[]>

export function validateDnd5ePluginDiceRollResult(
  declaration: Dnd5ePluginDiceRollDeclaration,
  result: Dnd5ePluginDiceRollResult | undefined,
): result is Dnd5ePluginDiceRollResult {
  if (!result || !Array.isArray(result.values) || result.values.length !== declaration.count) return false
  if (!result.values.every((value) => Number.isInteger(value) && value >= 1 && value <= declaration.sides)) return false
  const modifier = declaration.modifier ?? 0
  return result.modifier === modifier && result.total === result.values.reduce((sum, value) => sum + value, modifier)
}

export function validateDnd5ePluginDiceRolls(
  definition: Pick<Dnd5ePluginHeadlessActionDefinition, 'rolls'>,
  results: Readonly<Record<string, Dnd5ePluginDiceRollResult>> | undefined,
): boolean {
  const declarations = definition.rolls ?? []
  const keys = Object.keys(results ?? {})
  if (keys.length !== declarations.length) return false
  const ids = new Set(declarations.map((declaration) => declaration.id))
  if (keys.some((key) => !ids.has(key))) return false
  return declarations.every((declaration) => validateDnd5ePluginDiceRollResult(declaration, results?.[declaration.id]))
}

export async function executeDnd5ePluginDiceRolls(
  definition: Pick<Dnd5ePluginHeadlessActionDefinition, 'rolls'>,
  roll: Dnd5ePluginDiceRoller,
): Promise<Record<string, Dnd5ePluginDiceRollResult>> {
  const results: Record<string, Dnd5ePluginDiceRollResult> = {}
  for (const declaration of definition.rolls ?? []) {
    const values = [...await roll(declaration)]
    const modifier = declaration.modifier ?? 0
    const result = { values, modifier, total: values.reduce((sum, value) => sum + value, modifier) }
    if (!validateDnd5ePluginDiceRollResult(declaration, result)) {
      throw new Error(`插件骰子结果无效：${declaration.id}`)
    }
    results[declaration.id] = result
  }
  return results
}
