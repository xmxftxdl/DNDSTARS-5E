export const DND5E_PLUGIN_CONTENT_CATEGORIES = Object.freeze([
  Object.freeze({
    id: 'adventure',
    label: '模组与冒险',
    shortLabel: '模组',
    description: '可直接开团的短模组、长篇战役与剧情内容。',
  }),
  Object.freeze({
    id: 'monsters',
    label: '怪物与 NPC',
    shortLabel: '怪物',
    description: '怪物数据、NPC、遭遇与相关自动化。',
  }),
  Object.freeze({
    id: 'items',
    label: '装备与道具',
    shortLabel: '道具',
    description: '武器、防具、消耗品、魔法物品与战利品。',
  }),
  Object.freeze({
    id: 'classes',
    label: '职业',
    shortLabel: '职业',
    description: '完整职业、等级能力与成长规则。',
  }),
  Object.freeze({
    id: 'subclasses',
    label: '子职',
    shortLabel: '子职',
    description: '职业分支、子职能力与配套资源。',
  }),
  Object.freeze({
    id: 'spells',
    label: '法术',
    shortLabel: '法术',
    description: '法术、施法活动、效果与自动化。',
  }),
  Object.freeze({
    id: 'feats',
    label: '专长',
    shortLabel: '专长',
    description: '专长、被动能力与可选角色能力。',
  }),
  Object.freeze({
    id: 'races',
    label: '种族',
    shortLabel: '种族',
    description: '种族、族裔及其角色创建规则。',
  }),
  Object.freeze({
    id: 'backgrounds',
    label: '背景',
    shortLabel: '背景',
    description: '人物背景、熟练项、语言与背景特性。',
  }),
  Object.freeze({
    id: 'rules',
    label: '规则与自动化',
    shortLabel: '规则',
    description: '房规、掷骰、战斗流程与功能增强。',
  }),
  Object.freeze({
    id: 'assets',
    label: '美术与素材',
    shortLabel: '素材',
    description: '图标、立绘、地图素材及其他媒体资源。',
  }),
  Object.freeze({
    id: 'mixed',
    label: '综合内容包',
    shortLabel: '综合',
    description: '同时包含多个主要内容类别的整合扩展。',
  }),
])

const DND5E_PLUGIN_CONTENT_CATEGORY_BY_ID = new Map(
  DND5E_PLUGIN_CONTENT_CATEGORIES.map((category) => [category.id, category]),
)

export const DND5E_PLUGIN_CONTENT_CATEGORY_IDS = Object.freeze(
  DND5E_PLUGIN_CONTENT_CATEGORIES.map((category) => category.id),
)

export function isDnd5ePluginContentCategory(value) {
  return typeof value === 'string' && DND5E_PLUGIN_CONTENT_CATEGORY_BY_ID.has(value)
}

export function dnd5ePluginContentCategoryDefinition(value) {
  return DND5E_PLUGIN_CONTENT_CATEGORY_BY_ID.get(value) ?? DND5E_PLUGIN_CONTENT_CATEGORY_BY_ID.get('mixed')
}

export function dnd5ePluginContentCategoryLabel(value) {
  return dnd5ePluginContentCategoryDefinition(value).label
}
