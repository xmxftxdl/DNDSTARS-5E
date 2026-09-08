import type {
  Dnd5ePluginDiceRollDeclaration,
  Dnd5ePluginDiceRollResult,
  Dnd5ePluginHeadlessActionDefinition,
} from './pluginApi'

export type Dnd5ePluginDiceRoller = (
  declaration: Dnd5ePluginDiceRollDeclaration,
) => Promise<readonly number[]>

export function dnd5ePluginDiceRollDeclarationsForTargets(
  definition: Pick<Dnd5ePluginHeadlessActionDefinition, 'rolls' | 'perTargetRolls'>,
  targets: readonly { id: string; name?: string }[],
): Dnd5ePluginDiceRollDeclaration[] {
  return [
    ...(definition.rolls ?? []).map((declaration) => ({ ...declaration })),
    ...(definition.perTargetRolls ?? []).flatMap((declaration) => targets.map((target) => ({
      ...declaration,
      id: `${declaration.id}:${target.id}`,
      label: `${target.name?.trim() || target.id} · ${declaration.label}`,
    }))),
  ]
}

export function validateDnd5ePluginDiceRollResult(
  declaration: Dnd5ePluginDiceRollDeclaration,
  result: Dnd5ePluginDiceRollResult | undefined,
): result is Dnd5ePluginDiceRollResult {
  const acceptedCounts = declaration.acceptedCounts ?? [declaration.count]
  if (!result || !Array.isArray(result.values) || !acceptedCounts.includes(result.values.length)) return false
  if (!result.values.every((value) => Number.isInteger(value) && value >= 1 && value <= declaration.sides)) return false
  const rerollValues = new Set(declaration.rerollValues ?? [])
  if (result.values.some((value) => rerollValues.has(value))) return false
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
    const rerollValues = new Set(declaration.rerollValues ?? [])
    if (rerollValues.size >= declaration.sides) {
      throw new Error(`插件骰子重掷规则无效：${declaration.id}`)
    }
    let values: number[]
    if (rerollValues.size === 0) {
      values = [...await roll(declaration)]
    } else {
      values = []
      let remaining = declaration.count
      let attempts = 0
      while (remaining > 0) {
        attempts += 1
        if (attempts > 100) throw new Error(`插件骰子重掷次数过多：${declaration.id}`)
        const rolled = [...await roll({
          ...declaration,
          count: remaining,
          acceptedCounts: undefined,
          label: attempts === 1 ? declaration.label : `${declaration.label} · 重掷`,
        })]
        if (
          rolled.length !== remaining ||
          rolled.some((value) => !Number.isInteger(value) || value < 1 || value > declaration.sides)
        ) throw new Error(`插件骰子结果无效：${declaration.id}`)
        for (const value of rolled) {
          if (!rerollValues.has(value)) values.push(value)
        }
        remaining = declaration.count - values.length
      }
    }
    const modifier = declaration.modifier ?? 0
    const result = { values, modifier, total: values.reduce((sum, value) => sum + value, modifier) }
    if (!validateDnd5ePluginDiceRollResult(declaration, result)) {
      throw new Error(`插件骰子结果无效：${declaration.id}`)
    }
    results[declaration.id] = result
  }
  return results
}
