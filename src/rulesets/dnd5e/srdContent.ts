import { DND5E_SRD_SPELL_NAMES_ZH } from './spellNamesZh'

export const DND5E_SRD_5_1_SOURCE_URL = 'https://dnd.wizards.com/resources/systems-reference-document'
export const DND5E_SRD_5_1_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/legalcode'

export const DND5E_SRD_5_1_ATTRIBUTION =
  'This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.'

export const DND5E_SRD_5_1_TRANSLATION_NOTICE =
  '发布用中文内容将以英文 SRD 5.1 为唯一规则源，按 D&D 5e 2014 规则语境逐条翻译与审校；中文译文不是威世智官方中文版。当前旧版运行正文仍在迁移中，不能视为已完成商业发布审查。'

/**
 * 早期机翻物品数据中对法术名的常见错译。
 * 这里只做确定性的专名替换，不尝试“修复”规则正文。
 */
const LEGACY_MAGIC_ITEM_SPELL_ALIASES: Readonly<Record<string, string>> = {
  '位面移动法术': 'plane-shift',
  '平面移动咒语': 'plane-shift',
  '位面转移法术': 'plane-shift',
  '门咒语': 'gate',
  '识别咒语': 'identify',
  '移除诅咒法术': 'remove-curse',
  '愿望咒语': 'wish',
  '愿望法术': 'wish',
  '祈愿咒语': 'wish',
  '召唤元素法术': 'conjure-elemental',
  '魅惑人物法术': 'charm-person',
  '次元门法术': 'dimension-door',
  '探知咒语': 'scrying',
  '探测思想法术': 'detect-thoughts',
  '检测思想法术': 'detect-thoughts',
  '检测魔法咒语': 'detect-magic',
  '检测邪恶和善良咒语': 'detect-evil-and-good',
  '理解语言法术': 'comprehend-languages',
  '伪装自我法术': 'disguise-self',
  '动物友谊咒语': 'animal-friendship',
  '心灵传动法术': 'telekinesis',
  '气态法术': 'gaseous-form',
  '急速法术': 'haste',
  '千里眼法术': 'clairvoyance',
  '行动自由法术': 'freedom-of-movement',
  '空灵法术': 'etherealness',
  '油脂咒语': 'grease',
  '魔法导弹法术': 'magic-missile',
  '较小的恢复法术': 'lesser-restoration',
  '高等恢复法术': 'greater-restoration',
  '传送法术': 'teleport',
  '放大或缩小法术': 'enlarge-reduce',
  '阵风法术': 'gust-of-wind',
  '日光法术': 'daylight',
  '跳跃法术': 'jump',
  '瓦解法术': 'disintegrate',
  '隐形法术': 'invisibility',
  '魔法导弹': 'magic-missile',
}

export const DND5E_SRD_LEGACY_MAGIC_ITEM_SPELL_ALIASES = LEGACY_MAGIC_ITEM_SPELL_ALIASES

export function normalizeDnd5eSrdSpellNamesInText(value: string): string {
  let normalized = value
  for (const [alias, spellId] of Object.entries(LEGACY_MAGIC_ITEM_SPELL_ALIASES)) {
    const canonicalName = DND5E_SRD_SPELL_NAMES_ZH[spellId]
    if (canonicalName) normalized = normalized.replaceAll(alias, canonicalName)
  }
  return normalized
}
