import type { DiceCheckPresentation } from './diceCheckPresentation'
/** Display history only: never restores callbacks, reroll permissions or commits. */
export interface DiceTrayHistoryRecord {
  check?: DiceCheckPresentation
  settlement?: { label: string; details: string[] }
  dieSides?: number[]
  id: string
  label: string
  targetName: string
  sides: number
  values: number[]
  total?: number
  formula?: string
}

export interface DiceTrayHistory {
  record: DiceTrayHistoryRecord
  open: boolean
}

const prefix = 'astraltrace:dice-tray-history:v1:'

function sanitize(value: unknown): DiceTrayHistoryRecord | null {
  if (!value || typeof value !== 'object') return null
  const record = value as DiceTrayHistoryRecord
  if (typeof record.id !== 'string' || typeof record.label !== 'string' || typeof record.targetName !== 'string'
    || ![4, 6, 8, 10, 12, 20, 100].includes(record.sides)
    || !Array.isArray(record.values) || record.values.length === 0 || record.values.length > 100
    || !record.values.every(v => Number.isInteger(v) && v >= 1 && v <= record.sides)) return null
  return {
    check: record.check && ['normal', 'advantage', 'disadvantage'].includes(record.check.mode)
      ? { mode: record.check.mode, kind: record.check.kind, success: typeof record.check.success === 'boolean' ? record.check.success : undefined } : undefined,
    settlement: record.settlement && typeof record.settlement.label === 'string' &&
      Array.isArray(record.settlement.details) && record.settlement.details.every(detail => typeof detail === 'string')
      ? { label: record.settlement.label, details: [...record.settlement.details] } : undefined,
    dieSides: Array.isArray(record.dieSides) && record.dieSides.length === record.values.length
      && record.dieSides.every((sides, index) => [4, 6, 8, 10, 12, 20, 100].includes(sides) && record.values[index]! <= sides) ? [...record.dieSides] : undefined,
    id: record.id, label: record.label, targetName: record.targetName,
    sides: record.sides, values: [...record.values],
    total: Number.isFinite(record.total) ? record.total : undefined,
    formula: typeof record.formula === 'string' ? record.formula : undefined,
  }
}

export function readDiceTrayHistory(scope?: string): DiceTrayHistory | null {
  if (!scope) return null
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(prefix + scope) ?? 'null') as DiceTrayHistory | null
    const record = sanitize(saved?.record)
    return record ? { record, open: saved?.open === true } : null
  } catch { return null }
}

export function writeDiceTrayHistory(scope: string | undefined, record: DiceTrayHistoryRecord, open: boolean): void {
  if (!scope) return
  const safe = sanitize(record)
  if (!safe) return
  try { window.sessionStorage.setItem(prefix + scope, JSON.stringify({ record: safe, open })) } catch { /* Optional display cache. */ }
}

export function clearDiceTrayHistory(scope: string): void {
  try { window.sessionStorage.removeItem(prefix + scope) } catch { /* Optional display cache. */ }
}
