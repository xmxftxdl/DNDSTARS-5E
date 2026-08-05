import {
  DND5E_STANDARD_CONDITIONS,
  type Dnd5eStandardConditionId,
} from '../../rulesets/dnd5e/conditions'
import { getDnd5eSrdSpellCatalogEntry } from '../../rulesets/dnd5e/spellCatalog'
import { getDnd5eSrdCombatSpell } from '../../rulesets/dnd5e/spells'

export const MAP_SPELL_STATUS_IDS = [
  'guidance',
  'resistance',
  'sanctuary',
  'bless',
  'bane',
  'shield-of-faith',
  'mage-armor',
  'jump',
  'darkvision',
  'see-invisibility',
  'warding-bond',
  'fly',
  'heroism',
  'enlarge-reduce',
  'enhance-ability',
  'divine-favor',
  'hunters-mark',
  'magic-weapon',
  'flame-blade',
  'invisibility',
  'blur',
  'barkskin',
  'protection-from-poison',
  'longstrider',
  'protection-from-energy',
  'death-ward',
  'greater-invisibility',
  'charm-person',
  'hideous-laughter',
  'hold-person',
  'blindness-deafness',
  'monster-damage-aversion',
] as const

export type MapSpellStatusId = typeof MAP_SPELL_STATUS_IDS[number]

export interface TokenStatusTooltipContent {
  title: string
  description: string
}

export interface TokenStatusTooltipPoint {
  clientX: number
  clientY: number
}

const STANDARD_CONDITION_DESCRIPTIONS: Readonly<Record<Dnd5eStandardConditionId, string>> = {
  blinded: '无法看见；自身攻击检定具有劣势，针对自身的攻击检定具有优势。',
  charmed: '无法攻击魅惑者，也不能以有害能力或魔法效应指定魅惑者；魅惑者对其社交检定具有优势。',
  deafened: '无法听见，并自动失败任何依赖听觉的属性检定。',
  frightened: '看见恐惧源时，属性检定和攻击检定具有劣势，且无法自愿靠近恐惧源。',
  grappled: '速度变为 0，且无法从速度加值中获益；擒抱者失能或超出触及时状态结束。',
  incapacitated: '无法执行动作或反应。',
  invisible: '在没有魔法或特殊感官帮助时无法被看见；自身攻击具有优势，针对自身的攻击具有劣势。',
  paralyzed: '失能且无法移动或说话；力量和敏捷豁免自动失败，针对自身的攻击具有优势，5 尺内命中为重击。',
  petrified: '失能且无法移动或说话；力量和敏捷豁免自动失败，针对自身的攻击具有优势。',
  poisoned: '攻击检定和属性检定具有劣势。',
  prone: '只能爬行或起身；自身攻击具有劣势，5 尺内针对自身的攻击具有优势，其他距离则具有劣势。',
  restrained: '速度变为 0；自身攻击和敏捷豁免具有劣势，针对自身的攻击具有优势。',
  stunned: '失能且无法移动；力量和敏捷豁免自动失败，针对自身的攻击具有优势。',
  unconscious: '失能且无法移动、说话或感知周围；力量和敏捷豁免自动失败，针对自身的攻击具有优势，5 尺内命中为重击。',
}

const CUSTOM_SPELL_STATUS_TOOLTIPS: Partial<Record<MapSpellStatusId, TokenStatusTooltipContent>> = {
  'monster-damage-aversion': {
    title: '伤害畏避',
    description: '受到火焰伤害后，攻击检定和属性检定具有劣势，直到该生物的下个回合结束。',
  },
}

function compactDescription(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 220) return normalized
  return `${normalized.slice(0, 217).trimEnd()}…`
}

export function standardConditionTokenTooltip(
  condition: Dnd5eStandardConditionId,
): TokenStatusTooltipContent {
  return {
    title: DND5E_STANDARD_CONDITIONS[condition].label,
    description: STANDARD_CONDITION_DESCRIPTIONS[condition],
  }
}

export function spellStatusTokenTooltip(statusId: MapSpellStatusId): TokenStatusTooltipContent {
  const custom = CUSTOM_SPELL_STATUS_TOOLTIPS[statusId]
  if (custom) return custom

  const spell = getDnd5eSrdCombatSpell(statusId)
  const catalog = getDnd5eSrdSpellCatalogEntry(statusId)
  const name = spell?.name ?? catalog?.name ?? statusId
  const englishName = spell?.englishName ?? catalog?.englishName
  return {
    title: englishName ? `${name} · ${englishName}` : name,
    description: spell?.description
      ? compactDescription(spell.description)
      : '该 Token 当前受到此法术效果影响。',
  }
}

export function concentrationTokenTooltip(spellId: string): TokenStatusTooltipContent {
  const spell = getDnd5eSrdCombatSpell(spellId)
  const catalog = getDnd5eSrdSpellCatalogEntry(spellId)
  const name = spell?.name ?? catalog?.name ?? spellId
  return {
    title: `专注：${name}`,
    description: '该角色正在维持专注。受到伤害时需进行体质豁免；失能、死亡或开始专注另一项效果时会结束。',
  }
}

export function overflowConditionTokenTooltip(
  conditions: readonly Dnd5eStandardConditionId[],
): TokenStatusTooltipContent {
  return {
    title: `另有 ${conditions.length} 个状态`,
    description: conditions.map((condition) => DND5E_STANDARD_CONDITIONS[condition].label).join('、'),
  }
}

export const FLIGHT_TOKEN_TOOLTIP: TokenStatusTooltipContent = {
  title: '飞行中',
  description: '该 Token 当前高度高于脚下地形；移动与坠落会按空中单位处理。',
}

export const SHILLELAGH_TOKEN_TOOLTIP: TokenStatusTooltipContent = {
  title: '橡棍术 · Shillelagh',
  description: '所持短棒或长棍已被强化：伤害骰变为 d8，并可使用施法关键属性进行攻击和伤害掷骰。',
}

