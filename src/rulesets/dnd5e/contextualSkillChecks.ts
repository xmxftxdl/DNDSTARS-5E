import { SKILLS, type AbilityKey } from '../../lib/dnd'

/** A Host-established purpose, never inferred from a skill or free-form player text. */
export type Dnd5eAbilityCheckPurpose = 'detect-lies'

export interface Dnd5eMinimumSkillCheckD20Rule {
  ability: AbilityKey
  skill: string
  purpose: Dnd5eAbilityCheckPurpose
  minimum: number
}

export interface Dnd5eHalfSpeedSkillCheckRule {
  ability: AbilityKey
  skill: string
}

export interface Dnd5eContextualSkillCheckContext {
  ability?: AbilityKey
  skill?: string
  purpose?: Dnd5eAbilityCheckPurpose
  /** Distance travelled during the current creature's turn, including reaction movement.
   * This is not the movement budget spent (difficult terrain and standing cost extra).
   * Missing accounting is unknown, rather than an assertion that no movement occurred.
   */
  movementThisTurnFeet?: number
  currentSpeedFeet?: number
}

function validSkillRule(value: unknown): value is Dnd5eHalfSpeedSkillCheckRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const rule = value as Dnd5eHalfSpeedSkillCheckRule
  return SKILLS.some(skill => skill.key === rule.skill && skill.ability === rule.ability)
}

export function normalizeDnd5eMinimumSkillCheckD20(value: unknown): Dnd5eMinimumSkillCheckD20Rule[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || !value.every(rule => validSkillRule(rule) &&
    Object.keys(rule).every(key => ['ability', 'skill', 'purpose', 'minimum'].includes(key)) &&
    (rule as Dnd5eMinimumSkillCheckD20Rule).purpose === 'detect-lies' &&
    Number.isInteger((rule as Dnd5eMinimumSkillCheckD20Rule).minimum) &&
    (rule as Dnd5eMinimumSkillCheckD20Rule).minimum >= 1 &&
    (rule as Dnd5eMinimumSkillCheckD20Rule).minimum <= 20)) return undefined
  return value.map(rule => ({ ...rule }))
}

export function normalizeDnd5eHalfSpeedSkillChecks(value: unknown): Dnd5eHalfSpeedSkillCheckRule[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || !value.every(rule => validSkillRule(rule) &&
    Object.keys(rule).every(key => ['ability', 'skill'].includes(key)))) return undefined
  return value.map(rule => ({ ...rule }))
}

export function dnd5eContextualMinimumSkillCheckD20(
  rules: readonly Dnd5eMinimumSkillCheckD20Rule[] | undefined,
  context: Dnd5eContextualSkillCheckContext,
): number {
  return (rules ?? []).filter(rule => rule.ability === context.ability && rule.skill === context.skill &&
    rule.purpose === context.purpose).reduce((minimum, rule) => Math.max(minimum, rule.minimum), 1)
}

export function dnd5eHalfSpeedSkillCheckAdvantage(
  rules: readonly Dnd5eHalfSpeedSkillCheckRule[] | undefined,
  context: Dnd5eContextualSkillCheckContext,
): boolean {
  const { movementThisTurnFeet: moved, currentSpeedFeet: speed } = context
  return moved != null && speed != null && Number.isFinite(moved) && Number.isFinite(speed) &&
    moved >= 0 && speed >= 0 && moved <= speed / 2 &&
    (rules ?? []).some(rule => rule.ability === context.ability && rule.skill === context.skill)
}

/** Durable Host map accounting; reject malformed ledgers rather than assuming zero distance. */
export function normalizeDnd5eSkillCheckMovement(value: unknown): { turnKey: string; distanceByActor: Record<string, number> } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as { turnKey?: unknown; distanceByActor?: unknown }
  if (typeof raw.turnKey !== 'string' || raw.turnKey.length === 0 || raw.turnKey.length > 1024 ||
    !raw.distanceByActor || typeof raw.distanceByActor !== 'object' || Array.isArray(raw.distanceByActor)) return undefined
  const entries = Object.entries(raw.distanceByActor)
  if (entries.length > 10000 || entries.some(([id, distance]) => id.length === 0 || id.length > 320 ||
    typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0)) return undefined
  return { turnKey: raw.turnKey, distanceByActor: Object.fromEntries(entries) }
}
