import type { Character } from '../types/character'
import type { EquipmentItem } from '../types/equipment'
import { dnd5eArmorClass } from '../rulesets/dnd5e/equipment'
import { dnd5eActiveArmorClassBonus, normalizeDnd5eActiveEffects } from '../rulesets/dnd5e/activeEffects'
import { dnd5e2014Adapter as rules } from '../rulesets/dnd5e/dnd5e2014Adapter'

export const DEFAULT_ENEMY_AC = 10

export function getAc(character: Character): number {
  return dnd5eArmorClass(character)
}

/** Current combat AC, including active spell effects that do not alter equipment. */
export function getEffectiveAc(character: Character): number {
  const effects = normalizeDnd5eActiveEffects(character.dnd5eCombatState?.activeEffects)
  const base = dnd5eArmorClass(character)
  const wearingBodyArmor = character.equipment?.armor?.dnd5e?.kind === 'armor' ||
    character.equipment?.armor?.ac != null
  const hasMageArmor = !wearingBodyArmor && effects.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:mage-armor')
  const hasBarkskin = effects.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:barkskin')
  const mageArmor = hasMageArmor
    ? 13 + rules.abilityModifier(character.abilities.dex) +
      (character.equipment?.offHand?.dnd5e?.kind === 'shield'
        ? character.equipment.offHand.dnd5e.armorClassBonus
        : 0)
    : 0
  return Math.max(base, hasBarkskin ? 16 : 0, mageArmor) +
    dnd5eActiveArmorClassBonus(effects) +
    (character.dnd5eCombatState?.shieldSpellActive ? 5 : 0)
}

export function formatEquipmentStatLine(item: EquipmentItem): string {
  const rules = item.dnd5e
  if (!rules) return item.effects ? `声明式装备效果${effectSummary(item)}` : '旧装备数据不可用于 D&D 5e 结算'
  if (rules.kind === 'weapon') {
    const range = rules.mode === 'ranged' && rules.rangeFeet
      ? ` · 射程 ${rules.rangeFeet.normal}/${rules.rangeFeet.long} 尺`
      : rules.reachFeet ? ` · 触及 ${rules.reachFeet} 尺` : ''
    const properties = rules.properties?.length ? ` · ${rules.properties.join('、')}` : ''
    return `${rules.damage.count}d${rules.damage.sides} ${damageTypeLabel(rules.damage.type)}${range}${properties}${effectSummary(item)}`
  }
  if (rules.kind === 'shield') return `AC +${rules.armorClassBonus}${effectSummary(item)}`
  const dexterity = rules.dexterityBonus === 'full'
    ? ' + 敏捷调整值'
    : rules.dexterityBonus === 'max-2' ? ' + 敏捷调整值（最高 +2）' : ''
  const extras = [
    rules.strengthRequirement ? `力量 ${rules.strengthRequirement}` : '',
    rules.stealthDisadvantage ? '隐匿劣势' : '',
  ].filter(Boolean)
  return `AC ${rules.baseArmorClass}${dexterity}${extras.length ? ` · ${extras.join(' · ')}` : ''}${effectSummary(item)}`
}

function effectSummary(item: EquipmentItem): string {
  const effects = item.effects
  if (!effects) return ''
  const signed = (value: number) => value >= 0 ? `+${value}` : String(value)
  const labels = [
    effects.weaponAttackBonus ? `命中${signed(effects.weaponAttackBonus)}` : '',
    effects.weaponDamageBonus ? `伤害${signed(effects.weaponDamageBonus)}` : '',
    effects.armorClassBonus ? `AC${signed(effects.armorClassBonus)}` : '',
    effects.savingThrowBonus ? `豁免${signed(effects.savingThrowBonus)}` : '',
    effects.speedBonusFeet ? `速度${signed(effects.speedBonusFeet)}尺` : '',
  ].filter(Boolean)
  return labels.length ? ` · ${labels.join(' · ')}` : ''
}

function damageTypeLabel(type: 'slashing' | 'piercing' | 'bludgeoning'): string {
  if (type === 'slashing') return '挥砍伤害'
  if (type === 'piercing') return '穿刺伤害'
  return '钝击伤害'
}
