import type { Dnd5eCurrency } from '../../types/inventory'

/** Untrusted selection only. Values, output templates and eligibility are Host-owned. */
export interface Dnd5eInventoryExchangeSelection {
  expectedInventoryRevision: number
  outputTemplateId?: string
  inputs: readonly { instanceId: string; quantity: number }[]
  coins?: readonly { currency: Dnd5eCurrency; amount: number }[]
  originalInstanceId?: string
  targetCell?: { col: number; row: number }
}
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{0,159}$/.test(value)
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const quantity = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 1_000_000
export function validDnd5eInventoryExchangeSelection(value: unknown): value is Dnd5eInventoryExchangeSelection {
  if (!record(value) || Object.keys(value).some(key => !['expectedInventoryRevision', 'inputs', 'coins', 'originalInstanceId', 'targetCell', 'outputTemplateId'].includes(key)) ||
    value.outputTemplateId != null && !id(value.outputTemplateId) ||
    !Number.isSafeInteger(value.expectedInventoryRevision) || Number(value.expectedInventoryRevision) < 0 ||
    !Array.isArray(value.inputs) || value.inputs.length > 100 ||
    value.originalInstanceId != null && !id(value.originalInstanceId)) return false
  if (value.targetCell != null && (!record(value.targetCell) ||
    Object.keys(value.targetCell).some(key => !['col', 'row'].includes(key)) ||
    !Number.isSafeInteger(value.targetCell.col) || Number(value.targetCell.col) < 0 ||
    !Number.isSafeInteger(value.targetCell.row) || Number(value.targetCell.row) < 0)) return false
  const ids = new Set<string>()
  for (const input of value.inputs) {
    if (!record(input) || Object.keys(input).some(key => !['instanceId', 'quantity'].includes(key)) ||
      !id(input.instanceId) || !quantity(input.quantity) || ids.has(input.instanceId) || input.instanceId === value.originalInstanceId) return false
    ids.add(input.instanceId)
  }
  if (value.coins != null && (!Array.isArray(value.coins) || value.coins.length > 5)) return false
  const currencies = new Set<string>()
  for (const coin of (value.coins ?? []) as unknown[]) {
    if (!record(coin) || Object.keys(coin).some(key => !['currency', 'amount'].includes(key)) ||
      typeof coin.currency !== 'string' || !['cp', 'sp', 'ep', 'gp', 'pp'].includes(coin.currency) ||
      !quantity(coin.amount) || currencies.has(coin.currency)) return false
    currencies.add(coin.currency)
  }
  return ids.size + currencies.size > 0
}
