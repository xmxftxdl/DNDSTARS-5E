import type {
  Dnd5ePluginAbilityGenerationDefinition,
  Dnd5ePluginBackgroundDefinition,
  Dnd5ePluginFeatureDefinition,
  Dnd5ePluginItemDefinition,
  Dnd5ePluginRaceDefinition,
  Dnd5ePluginSpellDefinition,
  Dnd5eRulesPluginManifest,
} from './pluginApi'

export interface Dnd5eCustomRulesPluginDraft {
  manifest: Dnd5eRulesPluginManifest
  races: Dnd5ePluginRaceDefinition[]
  backgrounds: Dnd5ePluginBackgroundDefinition[]
  features: Dnd5ePluginFeatureDefinition[]
  spells: Dnd5ePluginSpellDefinition[]
  items: Dnd5ePluginItemDefinition[]
  abilityGenerationMethods: Dnd5ePluginAbilityGenerationDefinition[]
}

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

export function validateDnd5eCustomRulesPluginDraft(draft: Dnd5eCustomRulesPluginDraft): string[] {
  const errors: string[] = []
  const manifest = draft.manifest
  if (!ID_PATTERN.test(manifest.id)) errors.push('插件 ID 只能使用小写字母、数字、点、下划线和连字符。')
  if (!manifest.name.trim()) errors.push('请填写插件名称。')
  if (!manifest.version.trim()) errors.push('请填写插件版本。')
  if (!manifest.publisher.trim()) errors.push('请填写发布者。')
  if (!manifest.license.trim()) errors.push('请填写许可证。')
  if (
    draft.races.length + draft.backgrounds.length + draft.features.length + draft.spells.length +
    draft.items.length + draft.abilityGenerationMethods.length === 0
  ) errors.push('请至少添加一种规则内容。')

  const localIds = new Set<string>()
  const claimId = (id: string, label: string) => {
    if (!ID_PATTERN.test(id)) errors.push(`${label} ID 无效：${id || '未填写'}`)
    const key = `${label}:${id}`
    if (localIds.has(key)) errors.push(`${label} ID 重复：${id}`)
    localIds.add(key)
  }
  for (const race of draft.races) {
    claimId(race.id, '种族')
    if (!race.name.trim()) errors.push(`种族 ${race.id || '未命名'} 缺少名称。`)
    if (!Number.isInteger(race.speedFeet) || race.speedFeet < 0 || race.speedFeet > 500) {
      errors.push(`种族 ${race.name || race.id} 的速度必须是 0～500 尺的整数。`)
    }
    const flexible = race.flexibleAbilityBonus
    if (flexible && (
      !Number.isInteger(flexible.count) || flexible.count < 1 || flexible.count > 6 ||
      !Number.isInteger(flexible.amount) || flexible.amount === 0 || Math.abs(flexible.amount) > 10
    )) errors.push(`种族 ${race.name || race.id} 的可选属性调整无效。`)
  }
  for (const method of draft.abilityGenerationMethods) {
    claimId(method.id, '属性规则')
    if (!method.name.trim() || !method.summary.trim()) errors.push(`属性规则 ${method.id || '未命名'} 缺少名称或说明。`)
    if (method.kind === 'standard-array' && (
      method.scores.length !== 6 || method.scores.some((score) => !Number.isInteger(score) || score < 1 || score > 30)
    )) errors.push(`标准数组 ${method.name || method.id} 必须包含六个 1～30 的整数。`)
    if (method.kind === 'point-buy') {
      if (
        !Number.isInteger(method.minimum) || !Number.isInteger(method.maximum) || method.minimum < 1 ||
        method.maximum < method.minimum || method.maximum > 30 || !Number.isInteger(method.budget) || method.budget < 0
      ) errors.push(`购点规则 ${method.name || method.id} 的范围或预算无效。`)
      let previous = -1
      for (let score = method.minimum; score <= method.maximum; score += 1) {
        const cost = method.costs[score]
        if (!Number.isInteger(cost) || cost < 0 || cost < previous) {
          errors.push(`购点规则 ${method.name || method.id} 的 ${score} 分成本无效。`)
          break
        }
        previous = cost
      }
    }
    if (method.kind === 'roll' && (
      !Number.isInteger(method.diceCount) || method.diceCount < 1 || method.diceCount > 20 ||
      !Number.isInteger(method.dieSides) || method.dieSides < 2 || method.dieSides > 1_000 ||
      !Number.isInteger(method.dropLowest) || method.dropLowest < 0 || method.dropLowest >= method.diceCount
    )) errors.push(`投骰规则 ${method.name || method.id} 的骰数、骰面或舍弃数量无效。`)
  }
  for (const background of draft.backgrounds) {
    claimId(background.id, '背景')
    if (!background.name.trim()) errors.push(`背景 ${background.id || '未命名'} 缺少名称。`)
    if (background.skillProficiencies.length > 2) errors.push(`背景 ${background.name || background.id} 最多提供两项技能熟练。`)
  }
  for (const feature of draft.features) {
    claimId(feature.id, '特性')
    if (!feature.name.trim() || !feature.summary.trim() || !feature.description.trim()) {
      errors.push(`特性 ${feature.id || '未命名'} 缺少名称、摘要或正文。`)
    }
  }
  for (const spell of draft.spells) {
    claimId(spell.id, '法术')
    if (!spell.name.trim() || !spell.description.trim() || !Number.isInteger(spell.level) || spell.level < 0 || spell.level > 9) {
      errors.push(`法术 ${spell.name || spell.id || '未命名'} 的名称、正文或环级无效。`)
    }
    if (spell.classes.length === 0) errors.push(`法术 ${spell.name || spell.id} 至少需要一个施法职业。`)
    if (spell.castingTime.unit === 'reaction' && !spell.castingTime.reactionTrigger?.trim()) {
      errors.push(`反应法术 ${spell.name || spell.id} 必须填写触发条件。`)
    }
  }
  for (const item of draft.items) {
    claimId(item.id, '物品')
    if (!item.name.trim() || !item.description.trim() || !item.rulesText.trim()) {
      errors.push(`物品 ${item.id || '未命名'} 缺少名称、说明或规则正文。`)
    }
    if (item.category === 'equipment' && !item.equipment) errors.push(`装备 ${item.name || item.id} 缺少装备规则。`)
  }
  return errors
}

export function buildDnd5eCustomRulesPluginSource(draft: Dnd5eCustomRulesPluginDraft): string {
  const errors = validateDnd5eCustomRulesPluginDraft(draft)
  if (errors.length > 0) throw new Error(errors.join('\n'))
  const manifest = JSON.stringify(draft.manifest, null, 2)
  const races = JSON.stringify(draft.races, null, 2)
  const backgrounds = JSON.stringify(draft.backgrounds, null, 2)
  const features = JSON.stringify(draft.features, null, 2)
  const spells = JSON.stringify(draft.spells, null, 2)
  const items = JSON.stringify(draft.items, null, 2)
  const methods = JSON.stringify(draft.abilityGenerationMethods, null, 2)
  return `/* DNDSTARS 5E custom rules package. Generated locally by the DM. */
const manifest = ${manifest};
const races = ${races};
const backgrounds = ${backgrounds};
const features = ${features};
const spells = ${spells};
const items = ${items};
const abilityGenerationMethods = ${methods};

const plugin = {
  manifest,
  setup(api) {
    for (const race of races) api.registerRace(race);
    for (const background of backgrounds) api.registerBackground(background);
    for (const feature of features) api.registerFeature(feature);
    for (const spell of spells) api.registerSpell(spell);
    for (const item of items) api.registerItem(item);
    for (const method of abilityGenerationMethods) api.registerAbilityGenerationMethod(method);
  },
};

export default plugin;
`
}

export function dnd5eCustomRulesPluginFileName(pluginId: string): string {
  const safe = pluginId.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'custom-character-rules'
  return `${safe}.dndstars5e`
}
