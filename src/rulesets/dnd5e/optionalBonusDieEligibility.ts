import type { Dnd5eClassId } from './classes'
/** Source is supplied by the Host resolving a save or an actual grapple escape. */
export interface Dnd5eOptionalBonusDieSourceConstraint {
  classId: Dnd5eClassId
  minimumLevel: number
}

export function validDnd5eOptionalBonusDieSourceConstraint(value: unknown): value is Dnd5eOptionalBonusDieSourceConstraint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const rule = value as Record<string, unknown>
  return Object.keys(rule).every(key => key === 'classId' || key === 'minimumLevel') &&
    typeof rule.classId === 'string' &&
    ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'].includes(rule.classId) &&
    Number.isInteger(rule.minimumLevel) && Number(rule.minimumLevel) >= 1 && Number(rule.minimumLevel) <= 20
}

export function dnd5eOptionalBonusDieSourceEligible(input: {
  constraint?: Dnd5eOptionalBonusDieSourceConstraint
  boundTargetId?: string
  classLevel: number
  rollKind: 'ability-check' | 'saving-throw'
  source?: { actorId: string; kind: 'saving-throw' | 'grapple-escape' }
}): boolean {
  if (!input.constraint) return true
  return validDnd5eOptionalBonusDieSourceConstraint(input.constraint) &&
    input.classLevel >= input.constraint.minimumLevel &&
    !!input.boundTargetId && input.source?.actorId === input.boundTargetId &&
    (input.rollKind === 'saving-throw'
      ? input.source.kind === 'saving-throw'
      : input.source.kind === 'grapple-escape')
}
