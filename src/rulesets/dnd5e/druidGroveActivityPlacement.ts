import type { GridCell } from '../../lib/gridCombat'
import { normalizeDnd5eDruidGroveExtraEffect } from './druidGroveAreaBundle'
import type { Dnd5eDruidGrovePlacement } from './druidGrovePlacement'

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const keys = (v: Record<string, unknown>, names: readonly string[]) => Object.keys(v).every(k => names.includes(k))
const cell = (v: unknown): v is GridCell => record(v) && keys(v, ['col', 'row']) && Number.isSafeInteger(v.col) && Number.isSafeInteger(v.row)
const cells = (v: unknown): v is GridCell[] => Array.isArray(v) && v.length <= 324 && v.every(cell)
const ids = (v: unknown, maximum: number): v is string[] => Array.isArray(v) && v.length <= maximum &&
  v.every(id => typeof id === 'string' && id.length > 0 && id.length <= 256) && new Set(v).size === v.length

/** Selection only. Source identity, geometry, classifications and clock come separately from Host. */
export function normalizeDnd5eGroveActivitySelection(value: unknown) {
  if (!record(value) || !keys(value, ['placement', 'baseElevationFeet', 'extra', 'exemptTokenIds', 'secretPhrase'])) return undefined
  if (value.secretPhrase != null && (typeof value.secretPhrase !== 'string' || !value.secretPhrase.trim() || value.secretPhrase.length > 120)) return undefined
  const p = value.placement
  if (!record(p) || !keys(p, ['origin', 'sideFeet', 'fogCells', 'undergrowthCells', 'guardianTreeIds']) ||
    !cell(p.origin) || typeof p.sideFeet !== 'number' || p.sideFeet < 30 || p.sideFeet > 90 || p.sideFeet % 5 !== 0 ||
    !cells(p.fogCells) || !cells(p.undergrowthCells) || !ids(p.guardianTreeIds, 4) ||
    typeof value.baseElevationFeet !== 'number' || !Number.isFinite(value.baseElevationFeet) ||
    !ids(value.exemptTokenIds, 512)) return undefined
  const extra = normalizeDnd5eDruidGroveExtraEffect(value.extra)
  if (!extra) return undefined
  const placement: Dnd5eDruidGrovePlacement = { origin: { ...p.origin }, sideFeet: p.sideFeet,
    fogCells: p.fogCells.map(c => ({ ...c })), undergrowthCells: p.undergrowthCells.map(c => ({ ...c })), guardianTreeIds: [...p.guardianTreeIds] }
  return { placement, baseElevationFeet: value.baseElevationFeet, extra, exemptTokenIds: [...value.exemptTokenIds],
    ...(typeof value.secretPhrase === 'string' ? { secretPhrase: value.secretPhrase } : {}) }
}
