import type { AppChoiceGroupsOptions, AppChoiceGroupsResult } from '../../lib/appDialog'
import { DND5E_DAMAGE_TYPE_LABELS } from '../../rulesets/dnd5e/damageTypes'

export const DND5E_PROTECTION_FROM_ENERGY_DAMAGE_TYPES = [
  'acid',
  'cold',
  'fire',
  'lightning',
  'thunder',
] as const

type ProtectionFromEnergyDamageType = (typeof DND5E_PROTECTION_FROM_ENERGY_DAMAGE_TYPES)[number]

export async function promptDnd5eProtectionFromEnergyDamageType(
  choiceGroups: (input: AppChoiceGroupsOptions) => Promise<AppChoiceGroupsResult | null>,
): Promise<ProtectionFromEnergyDamageType | null> {
  const selected = await choiceGroups({
    title: '防护能量伤害',
    message: '选择目标获得抗性的伤害类型。',
    confirmLabel: '确认',
    groups: [{
      id: 'damage-type',
      label: '伤害类型',
      options: DND5E_PROTECTION_FROM_ENERGY_DAMAGE_TYPES.map((damageType) => ({
        id: damageType,
        label: DND5E_DAMAGE_TYPE_LABELS[damageType],
      })),
    }],
    defaultValues: { 'damage-type': 'fire' },
  })
  if (!selected) return null
  return DND5E_PROTECTION_FROM_ENERGY_DAMAGE_TYPES.find((damageType) =>
    damageType === selected.values['damage-type']) ?? null
}
