export interface DiceCheckPresentation {
  mode: 'normal' | 'advantage' | 'disadvantage'
  kind?: 'attack' | 'save' | 'check'
  success?: boolean
}

export function adoptedD20Index(values: readonly number[], check?: DiceCheckPresentation): number | undefined {
  if (!check || check.mode === 'normal' || !values.length) return undefined
  if (values.length === 1) return 0
  const chosen = check.mode === 'advantage' ? Math.max(...values) : Math.min(...values)
  return values.indexOf(chosen)
}

export function diceCheckModeLabel(check: DiceCheckPresentation): string {
  return check.mode === 'advantage' ? '优势 · 两枚 D20 取高' : check.mode === 'disadvantage' ? '劣势 · 两枚 D20 取低' : '普通投掷'
}

export function diceCheckResultLabel(check: DiceCheckPresentation): string | undefined {
  if (check.success == null) return undefined
  return check.kind === 'attack' ? check.success ? '命中' : '未命中' : check.kind === 'save' ? check.success ? '豁免成功' : '豁免失败' : check.success ? '检定成功' : '检定失败'
}
