/** Shared D&D 5e damage vocabulary kept independent from the large SRD monster catalog. */
export const DND5E_DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const

export type Dnd5eDamageType = (typeof DND5E_DAMAGE_TYPES)[number]

/** 中文界面统一使用的 SRD 5.1 伤害类型术语；协议与存档仍保存英文枚举值。 */
export const DND5E_DAMAGE_TYPE_LABELS: Readonly<Record<Dnd5eDamageType, string>> = {
  acid: '强酸',
  bludgeoning: '钝击',
  cold: '寒冷',
  fire: '火焰',
  force: '力场',
  lightning: '闪电',
  necrotic: '黯蚀',
  piercing: '穿刺',
  poison: '毒素',
  psychic: '心灵',
  radiant: '光耀',
  slashing: '挥砍',
  thunder: '雷鸣',
}
