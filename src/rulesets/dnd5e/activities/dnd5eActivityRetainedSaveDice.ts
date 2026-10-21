import { dnd5eActiveOptionalBonusDice } from '../activeEffects'
import { dnd5eCombatantClassLevel } from '../headlessCombatPrimitives'
import { dnd5eOptionalBonusDieSourceEligible } from '../optionalBonusDieEligibility'
import type { Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import type { Dnd5eActivityExecutionInput } from './dnd5eActivityExecutor'

/** One owner-selected retained die per exact Activity check key. No totals or source facts. */
export type Dnd5eActivityRetainedSaveDice = Readonly<Record<string, {
  effectId: string
  targetId: string
  roll: number
}>>

/** Pure Host adapter: replaying an Activity preview cannot consume or alter an effect. */
export function dnd5eActivityRetainedSaveDiceHooks(
  state: Dnd5eHeadlessCombatState, sourceId: string, supplied: unknown,
): Pick<Dnd5eActivityExecutionInput, 'optionalSavingThrowBonus' | 'validateOptionalSavingThrowUses'> {
  if (supplied === undefined) return {}
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) throw new RangeError('roll-dice-invalid-optional-save')
  const entries = Object.entries(supplied)
  if (entries.length > 100) throw new RangeError('roll-dice-invalid-optional-save')
  const selections = new Map<string, { targetId: string; bonus: number }>()
  for (const [key, raw] of entries) {
    if (!key || !raw || typeof raw !== 'object' || Array.isArray(raw) ||
      Object.keys(raw).some(field => !['effectId', 'targetId', 'roll'].includes(field))) throw new RangeError('roll-dice-invalid-optional-save')
    const use = raw as Dnd5eActivityRetainedSaveDice[string]
    const target = typeof use.targetId === 'string' ? state.combatants[use.targetId] : undefined
    const effect = target && dnd5eActiveOptionalBonusDice(target.classState.activeEffects, 'saving-throw')
      .find(candidate => candidate.id === use.effectId)
    const die = effect?.modifiers?.optionalBonusDie
    if (!target || !effect || !die || die.consumeOnUse !== false ||
      !Number.isInteger(use.roll) || use.roll < 1 || use.roll > die.sides ||
      !dnd5eOptionalBonusDieSourceEligible({
        constraint: die.boundTargetSource, boundTargetId: effect.modifiers?.onHitBonusDamage?.boundTargetId,
        classLevel: die.boundTargetSource ? dnd5eCombatantClassLevel(target, die.boundTargetSource.classId) : 0,
        rollKind: 'saving-throw', source: { actorId: sourceId, kind: 'saving-throw' },
      })) throw new RangeError('roll-dice-invalid-optional-save')
    selections.set(key, { targetId: target.id, bonus: use.roll })
  }
  return {
    optionalSavingThrowBonus: (key, targetId) => {
      const selected = selections.get(key)
      if (selected && selected.targetId !== targetId) throw new RangeError('roll-dice-invalid-optional-save')
      return selected?.bonus ?? 0
    },
    validateOptionalSavingThrowUses: checks => {
      for (const [key, selected] of selections) {
        if (!checks.some(check => check.key === key && check.kind === 'saving-throw' &&
          check.targetId === selected.targetId && !check.automaticOutcome)) {
          throw new RangeError('roll-dice-unused-optional-save')
        }
      }
    },
  }
}
