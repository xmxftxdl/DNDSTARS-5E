export interface MapFreeDiceResolution {
  keep?: 'highest' | 'lowest'
  dc?: number
}

export interface MapFreeDiceSelection {
  count: number
  sides: number
}

export function addMapFreeDie(
  selection: MapFreeDiceSelection,
  sides: number,
): MapFreeDiceSelection {
  const safeSides = Math.max(2, Math.min(100, Math.round(sides)))
  return selection.sides === safeSides && selection.count > 0
    ? { sides: safeSides, count: Math.min(12, selection.count + 1) }
    : { sides: safeSides, count: 1 }
}

export function removeMapFreeDie(
  selection: MapFreeDiceSelection,
  sides: number,
): MapFreeDiceSelection {
  if (selection.sides !== sides || selection.count < 1) return selection
  return { ...selection, count: Math.max(0, selection.count - 1) }
}

export function mapFreeDiceSelectionFormula(selection: MapFreeDiceSelection): string {
  return selection.count > 0 ? `${selection.count}d${selection.sides}` : '尚未添加骰子'
}

export interface ResolvedMapFreeDiceRoll {
  subtotal: number
  total: number
  keptValue?: number
  outcome?: 'success' | 'failure'
}

export function resolveMapFreeDiceRoll(
  values: readonly number[],
  bonus: number,
  resolution?: MapFreeDiceResolution,
): ResolvedMapFreeDiceRoll {
  const keptValue = resolution?.keep === 'highest'
    ? (values.length > 0 ? Math.max(...values) : 0)
    : resolution?.keep === 'lowest'
      ? (values.length > 0 ? Math.min(...values) : 0)
      : undefined
  const subtotal = keptValue ?? values.reduce((sum, value) => sum + value, 0)
  const total = subtotal + bonus
  const outcome = Number.isFinite(resolution?.dc)
    ? (total >= Number(resolution?.dc) ? 'success' : 'failure')
    : undefined
  return { subtotal, total, keptValue, outcome }
}

export function mapFreeDiceKeepSuffix(keep?: MapFreeDiceResolution['keep']): string {
  return keep === 'highest' ? 'kh1' : keep === 'lowest' ? 'kl1' : ''
}

export function buildMapFreeDiceRollPresentation(input: {
  rollerName: string
  values: readonly number[]
  count: number
  sides: number
  bonus: number
  privateRoll: boolean
  resolution?: MapFreeDiceResolution
}): {
  total: number
  formula: string
  targetName: string
  logMessage: string
  logDetails: string[]
} {
  const resolved = resolveMapFreeDiceRoll(input.values, input.bonus, input.resolution)
  const formula = `${input.count}d${input.sides}${mapFreeDiceKeepSuffix(input.resolution?.keep)}${input.bonus === 0 ? '' : input.bonus > 0 ? ` + ${input.bonus}` : ` - ${Math.abs(input.bonus)}`}`
  const outcome = resolved.outcome === 'success' ? '通过' : resolved.outcome === 'failure' ? '未通过' : undefined
  const keptDetail = input.resolution?.keep && resolved.keptValue != null
    ? `，${input.resolution.keep === 'highest' ? '取高' : '取低'} ${resolved.keptValue}`
    : ''
  const checkDetail = input.resolution?.dc != null && outcome
    ? `，对抗 DC ${input.resolution.dc}：${outcome}`
    : ''
  return {
    total: resolved.total,
    formula,
    targetName: input.privateRoll
      ? '暗骰（仅 DM 可见）'
      : input.resolution?.dc != null && outcome
        ? `DC ${input.resolution.dc} · ${outcome}`
        : '明骰',
    logMessage: `${input.rollerName} 明骰 ${formula}：${input.values.join('、')}${keptDetail}${input.bonus === 0 ? '' : input.bonus > 0 ? ` + ${input.bonus}` : ` - ${Math.abs(input.bonus)}`} = ${resolved.total}${checkDetail}。`,
    logDetails: [
      `骰式：${formula}`,
      `骰面：${input.values.join('、')}${keptDetail}｜最终结果 ${resolved.total}｜公开明骰${input.resolution?.dc != null && outcome ? `｜DC ${input.resolution.dc} ${outcome}` : ''}`,
    ],
  }
}
