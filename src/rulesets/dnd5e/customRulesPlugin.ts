import type {
  Dnd5ePluginAbilityGenerationDefinition,
  Dnd5ePluginBackgroundDefinition,
  Dnd5ePluginFeatureDefinition,
  Dnd5ePluginItemDefinition,
  Dnd5ePluginRaceDefinition,
  Dnd5ePluginSpellDefinition,
  Dnd5eRulesPluginManifest,
} from './pluginApi'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from './conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './monsters'
import type { Dnd5ePluginEffectDuration } from './persistentAreaTypes'

export interface Dnd5eCustomHeadlessDiceFormula {
  count: number
  sides: number
  modifier?: number
}

export type Dnd5eCustomHeadlessEffectDraft =
  | {
      kind: 'damage'
      dice: Dnd5eCustomHeadlessDiceFormula
      damageType: Dnd5eDamageType
    }
  | {
      kind: 'healing'
      dice: Dnd5eCustomHeadlessDiceFormula
    }
  | {
      kind: 'condition'
      condition: Dnd5eStandardConditionId
      duration: Dnd5ePluginEffectDuration
    }

/**
 * 规则包工作室使用的声明式行动配方。生成器会把它编译为 Worker resolver；
 * 编辑器和规则包数据本身都不能取得 DOM、网络或内部 Store。
 */
export interface Dnd5eCustomHeadlessActionDraft {
  id: string
  label: string
  effects: Dnd5eCustomHeadlessEffectDraft[]
  requiredInterruptOptionId?: string
}

export interface Dnd5eCustomRulesPluginDraft {
  manifest: Dnd5eRulesPluginManifest
  races: Dnd5ePluginRaceDefinition[]
  backgrounds: Dnd5ePluginBackgroundDefinition[]
  features: Dnd5ePluginFeatureDefinition[]
  spells: Dnd5ePluginSpellDefinition[]
  items: Dnd5ePluginItemDefinition[]
  abilityGenerationMethods: Dnd5ePluginAbilityGenerationDefinition[]
  headlessActions?: Dnd5eCustomHeadlessActionDraft[]
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
    if (feature.automation !== 'manual' && !feature.action) {
      errors.push(`自动化特性 ${feature.name || feature.id} 缺少战斗行动。`)
    }
    if (feature.action && (
      !ID_PATTERN.test(feature.action.id) || !feature.action.label.trim() ||
      (feature.action.interrupt && (
        !feature.action.interrupt.prompt.trim() ||
        !Number.isInteger(feature.action.interrupt.timeoutMs ?? 30_000) ||
        (feature.action.interrupt.timeoutMs ?? 30_000) < 5_000 ||
        (feature.action.interrupt.timeoutMs ?? 30_000) > 300_000
      ))
    )) errors.push(`特性 ${feature.name || feature.id} 的战斗行动或 Interrupt 无效。`)
  }
  const headlessActionIds = new Set<string>()
  const summonActionIds = new Set(
    draft.features.flatMap((feature) => feature.action?.summon ? [feature.action.id] : []),
  )
  for (const action of draft.headlessActions ?? []) {
    if (!ID_PATTERN.test(action.id)) errors.push(`Headless 行动 ID 无效：${action.id || '未填写'}`)
    if (headlessActionIds.has(action.id)) errors.push(`Headless 行动 ID 重复：${action.id}`)
    headlessActionIds.add(action.id)
    if (!action.label.trim()) errors.push(`Headless 行动 ${action.id || '未命名'} 缺少名称。`)
    if ((!summonActionIds.has(action.id) && action.effects.length < 1) || action.effects.length > 16) {
      errors.push(`Headless 行动 ${action.label || action.id} 必须包含 1～16 个效果，纯召唤行动可不含目标效果。`)
    }
    action.effects.forEach((effect, index) => {
      const effectLabel = `${action.label || action.id} 的第 ${index + 1} 个效果`
      if (effect.kind === 'damage' || effect.kind === 'healing') {
        if (
          !Number.isInteger(effect.dice.count) || effect.dice.count < 1 || effect.dice.count > 12 ||
          !Number.isInteger(effect.dice.sides) || effect.dice.sides < 2 || effect.dice.sides > 100 ||
          !Number.isInteger(effect.dice.modifier ?? 0) || Math.abs(effect.dice.modifier ?? 0) > 1_000_000
        ) errors.push(`${effectLabel}的骰子公式无效。`)
      }
      if (effect.kind === 'damage' && !(DND5E_DAMAGE_TYPES as readonly string[]).includes(effect.damageType)) {
        errors.push(`${effectLabel}的伤害类型无效。`)
      }
      if (effect.kind === 'condition') {
        if (!(DND5E_STANDARD_CONDITION_IDS as readonly string[]).includes(effect.condition)) {
          errors.push(`${effectLabel}的标准状态无效。`)
        }
        const duration = effect.duration
        const expirations: readonly Dnd5ePluginEffectDuration['expiresAt'][] = [
          'source-next-turn-start', 'target-next-turn-start', 'target-turn-end', 'target-turn-end-save',
        ]
        if (
          !expirations.includes(duration.expiresAt) ||
          (duration.remainingRounds != null && (
            !Number.isInteger(duration.remainingRounds) || duration.remainingRounds < 1 || duration.remainingRounds > 14_400
          )) ||
          (duration.expiresAt === 'target-turn-end-save' && (
            !duration.saveAbility || !Number.isInteger(duration.saveDc) || (duration.saveDc ?? 0) < 1 || (duration.saveDc ?? 0) > 40
          ))
        ) errors.push(`${effectLabel}的持续时间或重复豁免无效。`)
      }
    })
  }
  const referencedHeadlessActions = new Set<string>()
  for (const feature of draft.features) {
    if (feature.action) referencedHeadlessActions.add(feature.action.id)
  }
  for (const spell of draft.spells) {
    if (spell.automation?.mode === 'headless-action') referencedHeadlessActions.add(spell.automation.actionId)
  }
  for (const actionId of referencedHeadlessActions) {
    if (!headlessActionIds.has(actionId)) errors.push(`自动化行动 ${actionId} 缺少 Headless 效果配方。`)
  }
  for (const action of draft.headlessActions ?? []) {
    if (!referencedHeadlessActions.has(action.id)) errors.push(`Headless 效果配方 ${action.id} 没有关联特性或法术。`)
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
  const headlessActions = JSON.stringify(draft.headlessActions ?? [], null, 2)
  return `/* DNDSTARS 5E custom rules package. Generated locally by the DM. */
const manifest = ${manifest};
const races = ${races};
const backgrounds = ${backgrounds};
const features = ${features};
const spells = ${spells};
const items = ${items};
const abilityGenerationMethods = ${methods};
const headlessActions = ${headlessActions};

function compileHeadlessAction(definition) {
  const rolls = definition.effects.flatMap((effect, index) => {
    if (effect.kind !== 'damage' && effect.kind !== 'healing') return [];
    return [{
      id: \`effect-\${index}\`,
      label: \`\${definition.label} · \${effect.kind === 'damage' ? '伤害' : '治疗'}\`,
      count: effect.dice.count,
      sides: effect.dice.sides,
      modifier: effect.dice.modifier ?? 0,
      visibility: 'public',
    }];
  });
  return {
    id: definition.id,
    rolls,
    resolve(context) {
      if (
        definition.requiredInterruptOptionId &&
        context.action.interruptChoiceId !== definition.requiredInterruptOptionId
      ) return context.fail('invalid-plugin-action');
      const targets = context.targets.length > 0
        ? context.targets
        : context.target
          ? [context.target]
          : [context.actor];
      if (targets.length < 1) return context.fail('invalid-target');
      for (let index = 0; index < definition.effects.length; index += 1) {
        const effect = definition.effects[index];
        const roll = context.rolls[\`effect-\${index}\`];
        if ((effect.kind === 'damage' || effect.kind === 'healing') && !roll) {
          return context.fail('invalid-dice');
        }
        for (const target of targets) {
          if (effect.kind === 'damage') context.dealDamage(target.id, roll.total, effect.damageType);
          if (effect.kind === 'healing') context.heal(target.id, roll.total);
          if (effect.kind === 'condition') {
            context.applyStandardCondition(target.id, effect.condition, effect.duration);
          }
        }
      }
      return context.succeed();
    },
  };
}

const plugin = {
  manifest,
  setup(api) {
    for (const action of headlessActions) api.registerHeadlessAction(compileHeadlessAction(action));
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
