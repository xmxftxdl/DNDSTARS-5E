import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

export function dnd5eActivityMakesAttackAttempt(activity: Dnd5eActivityDefinitionV1 | undefined, choices?: unknown): boolean {
  const selected = choices && typeof choices === 'object' && !Array.isArray(choices) ? choices as Record<string, unknown> : {}
  return activity?.checks?.some(check => check.kind === 'attack-roll' &&
    (!check.appliesWhenChoice || check.appliesWhenChoice.optionIds.some(id => id === selected[check.appliesWhenChoice!.choiceId]))) === true
}

/** The bearer imposes this save on a creature attempting to attack it. */
export interface Dnd5eAttackAttemptWard {
  ability: AbilityKey
  dc: number
  frequency: 'once-per-turn'
  onFailure: 'cannot-target-this-turn'
  onSuccess?: 'source-next-turn-spell-save-disadvantage'
}

/** Host-authored receipts belong to one exact ward instance, never to its content definition. */
export interface Dnd5eAttackAttemptWardReceipt {
  attackerId: string
  turnKey: string
  success: boolean
}

/** A consequence waiting for, or active during, exactly the source's next turn. */
export interface Dnd5eSourceTurnSpellSaveDisadvantage {
  afterTurnKey: string
  activeTurnKey?: string
}

export function normalizeDnd5eSourceTurnSpellSaveDisadvantage(value: unknown): Dnd5eSourceTurnSpellSaveDisadvantage | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (typeof raw.afterTurnKey !== 'string' || !raw.afterTurnKey ||
    (raw.activeTurnKey != null && (typeof raw.activeTurnKey !== 'string' || !raw.activeTurnKey || raw.activeTurnKey === raw.afterTurnKey)) ||
    Object.keys(raw).some(key => !['afterTurnKey', 'activeTurnKey'].includes(key))) return undefined
  return {afterTurnKey: raw.afterTurnKey, ...(typeof raw.activeTurnKey === 'string' ? {activeTurnKey: raw.activeTurnKey} : {})}
}

export function normalizeDnd5eAttackAttemptWardReceipts(value: unknown): Dnd5eAttackAttemptWardReceipt[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const result: Dnd5eAttackAttemptWardReceipt[] = []
  const seen = new Set<string>()
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      typeof raw.attackerId !== 'string' || !raw.attackerId ||
      typeof raw.turnKey !== 'string' || !raw.turnKey || typeof raw.success !== 'boolean' ||
      Object.keys(raw).some(key => !['attackerId', 'turnKey', 'success'].includes(key)) ||
      seen.has(raw.attackerId)) return undefined
    seen.add(raw.attackerId)
    result.push({attackerId: raw.attackerId, turnKey: raw.turnKey, success: raw.success})
  }
  return result
}

export function normalizeDnd5eAttackAttemptWard(value: unknown): Dnd5eAttackAttemptWard | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (!['str','dex','con','int','wis','cha'].includes(String(raw.ability)) ||
    !Number.isSafeInteger(raw.dc) || Number(raw.dc) < 1 || Number(raw.dc) > 40 ||
    raw.frequency !== 'once-per-turn' || raw.onFailure !== 'cannot-target-this-turn' ||
    (raw.onSuccess != null && raw.onSuccess !== 'source-next-turn-spell-save-disadvantage') ||
    Object.keys(raw).some(key => !['ability','dc','frequency','onFailure','onSuccess'].includes(key))) return undefined
  return { ability: raw.ability as AbilityKey, dc: Number(raw.dc), frequency: 'once-per-turn',
    onFailure: 'cannot-target-this-turn',
    ...(raw.onSuccess ? { onSuccess: 'source-next-turn-spell-save-disadvantage' as const } : {}) }
}
