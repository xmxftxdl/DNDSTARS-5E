export interface ResourceRestRecoveryRule {
  /** set replaces the balance (and can reduce it); restore adds up to the maximum. */
  mode: 'set' | 'restore'
  amount: number
  onlyWhenEmpty?: boolean
}

/** A declared entry overrides ordinary full recovery for that rest only. */
export type ResourceRestRecovery = Partial<Record<'short-rest' | 'long-rest', ResourceRestRecoveryRule>>

/** Applied by the Host only when the owner rolls initiative for a new combat. */
export interface CombatStartResourceRecovery extends ResourceRestRecoveryRule {
  minimumClassLevel?: { classId: string; level: number }
}

export function validateCombatStartResourceRecovery(value: unknown): asserts value is CombatStartResourceRecovery | undefined {
  if (value === undefined) return
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid combat resource recovery')
  const { minimumClassLevel, ...rule } = value as Record<string, unknown>
  validateResourceRestRecovery({ 'short-rest': rule })
  if (minimumClassLevel !== undefined) {
    const requirement = minimumClassLevel as Record<string, unknown>
    if (!requirement || typeof requirement !== 'object' || Array.isArray(requirement) ||
      Object.keys(requirement).some(key => key !== 'classId' && key !== 'level') ||
      typeof requirement.classId !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(requirement.classId) ||
      !Number.isInteger(requirement.level) || Number(requirement.level) < 1 || Number(requirement.level) > 20) {
      throw new Error('Invalid combat recovery class level')
    }
  }
}

export function validateResourceRestRecovery(value: unknown): asserts value is ResourceRestRecovery | undefined {
  if (value === undefined) return
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid resource rest recovery')
  const entries = Object.entries(value)
  if (!entries.length || entries.some(([rest]) => rest !== 'short-rest' && rest !== 'long-rest')) throw new Error('Invalid resource rest recovery timing')
  for (const [, rule] of entries) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule) ||
      Object.keys(rule).some(key => !['mode', 'amount', 'onlyWhenEmpty'].includes(key)) ||
      !['set', 'restore'].includes(rule.mode) || !Number.isSafeInteger(rule.amount) || rule.amount < 0 || rule.amount > 1_000_000 ||
      (rule.onlyWhenEmpty !== undefined && typeof rule.onlyWhenEmpty !== 'boolean')) throw new Error('Invalid resource rest recovery rule')
  }
}

export function resourceBalanceAfterRest(current: number, maximum: number, rule: ResourceRestRecoveryRule): number {
  if (rule.onlyWhenEmpty && current !== 0) return current
  return Math.min(maximum, rule.mode === 'set' ? rule.amount : current + rule.amount)
}
