import type { Dnd5ePluginDeclaredCapability } from './pluginApi'

export const DND5E_PLUGIN_CAPABILITY_LABELS: Readonly<
  Record<Dnd5ePluginDeclaredCapability, string>
> = {
  damage: '伤害',
  healing: '治疗',
  'temporary-hit-points': '临时生命值',
  'standard-condition': '标准状态',
  movement: '移动',
  resource: '资源',
  summon: '召唤',
  'persistent-area': '持续区域',
  'spell-transaction': '法术事务',
  interrupt: '中断',
}

export function dnd5ePluginCapabilityLabel(
  capability: Dnd5ePluginDeclaredCapability,
): string {
  return DND5E_PLUGIN_CAPABILITY_LABELS[capability]
}
