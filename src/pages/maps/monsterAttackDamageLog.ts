import type { Dnd5eDamageType } from '../../rulesets/dnd5e/damageTypes'
import { DND5E_DAMAGE_TYPE_LABELS } from '../../rulesets/dnd5e/damageTypes'

export interface Dnd5eMonsterDamageRollLogInput {
  actionName: string
  componentLabel: string
  damageType?: Dnd5eDamageType
  sides: number
  rolls: readonly number[]
  bonus: number
}

/** Formats Host-owned monster damage dice without collapsing them into HP loss. */
export function dnd5eMonsterDamageRollLogDetail(
  input: Dnd5eMonsterDamageRollLogInput,
): string | undefined {
  if (
    !Number.isInteger(input.sides) || input.sides < 2 ||
    input.rolls.length < 1 ||
    input.rolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > input.sides) ||
    !Number.isFinite(input.bonus)
  ) return undefined
  const diceTotal = input.rolls.reduce((sum, roll) => sum + roll, 0)
  const damageType = input.damageType
    ? `·${DND5E_DAMAGE_TYPE_LABELS[input.damageType]}`
    : ''
  const signedBonus = input.bonus >= 0 ? `+${input.bonus}` : `${input.bonus}`
  return `伤害骰 · ${input.actionName}（${input.componentLabel}${damageType}）｜${input.rolls.length}d${input.sides} 骰面：${input.rolls.join(' + ')} = ${diceTotal}｜固定加值 ${signedBonus}｜小计 ${Math.max(0, diceTotal + input.bonus)}`
}
