const EFFECT_NAMES: Readonly<Record<string, string>> = {
  'spell:shapechange:stat-transform': '形体变化·形态属性',
  'spell:shapechange:form-catalog': '形体变化·可用形态',
  'spell:shapechange:dm-equipment-fit': '形体变化·装备适配',
}

/** Localize existing saved effects without changing their mechanical identifiers. */
export function activeEffectDisplayName(label: string): string {
  return EFFECT_NAMES[label] ?? label
}
