import type { Dnd5eCombatant, Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5eHeadlessTurnKey } from './headlessCombatEngine'
import { dnd5eOnHitBonusDamageRequirements } from './inventoryHeadlessRuntime'

export interface Dnd5eOnHitInventoryEffectRollPlan {
  rolls?: Readonly<Record<string, readonly number[]>>
  previewDamageTotal: number
}

export async function planDnd5eOnHitInventoryEffectDice(input: {
  state: Dnd5eHeadlessCombatState
  combatant: Dnd5eCombatant
  weaponId?: string
  critical: boolean
  targetLabel: string
  rollDice(count: number, sides: number, label: string, targetLabel: string): Promise<number[]>
}): Promise<Dnd5eOnHitInventoryEffectRollPlan> {
  const requirements = dnd5eOnHitBonusDamageRequirements({
    combatant: input.combatant,
    weaponId: input.weaponId,
    critical: input.critical,
    turnKey: dnd5eHeadlessTurnKey(input.state, input.combatant.id),
  })
  if (requirements.length === 0) return { previewDamageTotal: 0 }
  const entries = await Promise.all(requirements.map(async (requirement) => {
    const values = await input.rollDice(
      requirement.count,
      requirement.sides,
      `${requirement.itemName} · 命中后额外伤害`,
      input.targetLabel,
    )
    return { requirement, values }
  }))
  return {
    rolls: Object.fromEntries(entries.map(({ requirement, values }) => [requirement.key, values])),
    previewDamageTotal: entries.reduce((total, { requirement, values }) =>
      total + Math.max(0, values.reduce((sum, value) => sum + value, 0) + requirement.bonus), 0),
  }
}

export async function rollDnd5eOnHitInventoryEffectDice(
  input: Parameters<typeof planDnd5eOnHitInventoryEffectDice>[0],
): Promise<Readonly<Record<string, readonly number[]>> | undefined> {
  return (await planDnd5eOnHitInventoryEffectDice(input)).rolls
}
