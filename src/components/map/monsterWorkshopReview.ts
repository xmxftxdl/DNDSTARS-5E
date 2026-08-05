import { DND5E_DAMAGE_TYPE_LABELS } from '../../rulesets/dnd5e/damageTypes'
import {
  validateDnd5eCustomMonsterAreaActionDraft,
  validateDnd5eCustomMonsterSummonActionDraft,
  type Dnd5eCustomMonsterActionDraft,
  type Dnd5eCustomMonsterDraft,
  type Dnd5eCustomMonsterTraitDraft,
} from '../../rulesets/dnd5e/customMonsterWorkshop'

export interface Dnd5eMonsterWorkshopAiReview {
  sourceText?: string
  assumptions?: readonly string[]
  unsupported?: readonly string[]
}

export interface Dnd5eMonsterWorkshopReviewIssue {
  id: string
  severity: 'blocking' | 'review'
  label: string
  detail: string
  targetId: string
}

export interface Dnd5eMonsterWorkshopReviewSummary {
  blocking: number
  review: number
  headless: number
  partial: number
  manual: number
}

const HEADLESS_TRAIT_RULES = new Set<Dnd5eCustomMonsterTraitDraft['ruleKind']>([
  'regeneration',
  'undead-fortitude',
  'nimble-escape',
  'swarm',
  'magic-resistance',
  'limited-magic-immunity',
  'magic-weapons',
  'conditional-target-bonus',
])

const DICE_PATTERN = /^\d+d\d+(?:[+-]\d+)?$/i

export function dnd5eMonsterActionReviewTarget(action: Pick<Dnd5eCustomMonsterActionDraft, 'id'>): string {
  return `monster-workshop-action-${action.id}`
}

export function dnd5eMonsterTraitReviewTarget(index: number): string {
  return `monster-workshop-trait-${index}`
}

export function dnd5eMonsterActionReviewSummary(action: Dnd5eCustomMonsterActionDraft): string {
  const economy = action.category === 'action'
    ? '动作'
    : action.category === 'bonus-action'
      ? '附赠动作'
      : action.category === 'reaction'
        ? '反应'
        : action.category === 'legendary'
          ? '传奇动作'
          : '巢穴动作'
  if (action.kind === 'area-saving-throw') {
    const shape = action.areaShape === 'cone' ? '锥形' : action.areaShape === 'line' ? '线形' : '自身圆形'
    const damageType = action.areaDamageType ? DND5E_DAMAGE_TYPE_LABELS[action.areaDamageType] : '待选伤害类型'
    return `${economy} · ${shape} ${action.areaSizeFeet} 尺 · DC ${action.areaSaveDc} · ${action.areaDamageDice} ${damageType}`
  }
  if (action.kind === 'weapon-attack') {
    const mode = action.mode === 'melee' ? '近战' : action.mode === 'ranged' ? '远程' : '近战或远程'
    return `${economy} · ${mode}攻击 · ${action.toHit >= 0 ? '+' : ''}${action.toHit} · ${action.damageDice} ${DND5E_DAMAGE_TYPE_LABELS[action.damageType]}`
  }
  if (action.kind === 'summon') {
    const count = action.summonCountMode === 'fixed' ? action.summonCount : action.summonCountDice
    const timing = action.summonTiming === 'source-next-turn-start' ? '下回合出现' : '立即出现'
    return `${economy} · 召唤 ${count} 个 · ${timing} · ${action.summonMonsterId || '待选怪物'}`
  }
  if (action.kind === 'movement') return `${economy} · 定向移动 · DM 选择目标与落点`
  return `${economy} · 其他动作 · DM 裁定`
}

function normalizedFeatureName(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
}

export function dnd5eMonsterTraitCoveredByFullMechanic(
  draft: Pick<Dnd5eCustomMonsterDraft, 'headlessMechanics'>,
  trait: Pick<Dnd5eCustomMonsterTraitDraft, 'name' | 'ruleKind'>,
): boolean {
  const name = normalizedFeatureName(trait.name)
  return trait.ruleKind === 'none' && !!name && draft.headlessMechanics.some((mechanic) =>
    mechanic.automation === 'full' && normalizedFeatureName(mechanic.name) === name)
}

export function dnd5eMonsterTraitReviewSummary(
  trait: Dnd5eCustomMonsterTraitDraft,
  coveredByFullMechanic = false,
): string {
  if (coveredByFullMechanic) return '同名自定义机制已接管 · 完全 Headless'
  if (HEADLESS_TRAIT_RULES.has(trait.ruleKind) && trait.automation === 'headless') {
    return 'Headless 预设已接入'
  }
  if (trait.ruleKind === 'charge-damage' || trait.ruleKind === 'ambusher' || trait.ruleKind === 'keen-sense') {
    return '结构化保存 · 部分效果由 DM 确认'
  }
  return '完整描述保留 · DM 裁定'
}

export function collectDnd5eMonsterWorkshopReviewIssues(
  draft: Dnd5eCustomMonsterDraft,
  aiReview?: Dnd5eMonsterWorkshopAiReview,
): Dnd5eMonsterWorkshopReviewIssue[] {
  const issues: Dnd5eMonsterWorkshopReviewIssue[] = []
  const blocking = (id: string, label: string, detail: string, targetId = 'monster-workshop-basic') => {
    issues.push({ id, severity: 'blocking', label, detail, targetId })
  }
  const review = (id: string, label: string, detail: string, targetId: string) => {
    issues.push({ id, severity: 'review', label, detail, targetId })
  }

  if (!draft.name.trim()) blocking('basic-name', '名称', '请填写怪物名称。')
  if (!draft.creatureType.trim()) blocking('basic-creature-type', '生物类型', '请选择或填写生物类型。')
  if (!draft.alignment.trim()) blocking('basic-alignment', '阵营', '请填写阵营；无阵营生物可填写“无阵营”。')
  if (!Number.isInteger(draft.armorClass) || draft.armorClass < 1) blocking('basic-ac', '护甲等级', 'AC 必须是大于 0 的整数。')
  if (!Number.isInteger(draft.hitPointsAverage) || draft.hitPointsAverage < 1) blocking('basic-hp', '生命值', '平均 HP 必须是大于 0 的整数。')
  if (!DICE_PATTERN.test(draft.hitPointsDice.replaceAll(' ', ''))) blocking('basic-hit-dice', '生命骰', '请输入例如 5d8+10 的生命骰。')
  if (!/^\d+(?:\/\d+)?$/.test(draft.challengeRating.trim())) blocking('basic-cr', '挑战等级', 'CR 必须是整数或分数，例如 3 或 1/4。')

  draft.traits.forEach((trait, index) => {
    const targetId = dnd5eMonsterTraitReviewTarget(index)
    if (!trait.name.trim()) blocking(`trait-${index}-name`, `特性 ${index + 1}`, '请填写特性名称。', targetId)
    if (!trait.description.trim()) blocking(`trait-${index}-description`, trait.name || `特性 ${index + 1}`, '请保留完整规则描述。', targetId)
    if (dnd5eMonsterTraitCoveredByFullMechanic(draft, trait)) {
      return
    }
    if (trait.ruleKind === 'none') {
      review(`trait-${index}-manual`, trait.name || `特性 ${index + 1}`, '尚未选择 Headless 预设，将在战斗中交给 DM 裁定。', targetId)
    } else if (!HEADLESS_TRAIT_RULES.has(trait.ruleKind)) {
      review(`trait-${index}-partial`, trait.name || `特性 ${index + 1}`, '已结构化保存，但仍有部分条件需要 DM 确认。', targetId)
    }
  })

  draft.actions.forEach((action, index) => {
    const targetId = dnd5eMonsterActionReviewTarget(action)
    if (!action.name.trim()) blocking(`action-${index}-name`, `动作 ${index + 1}`, '请填写动作名称。', targetId)
    if (action.kind === 'area-saving-throw') {
      validateDnd5eCustomMonsterAreaActionDraft(action).forEach((detail, issueIndex) => {
        blocking(`action-${index}-area-${issueIndex}`, action.name || `动作 ${index + 1}`, detail, targetId)
      })
      return
    }
    if (action.kind === 'summon') {
      validateDnd5eCustomMonsterSummonActionDraft(action).forEach((detail, issueIndex) => {
        blocking(`action-${index}-summon-${issueIndex}`, action.name || `动作 ${index + 1}`, detail, targetId)
      })
      return
    }
    if (
      action.kind === 'weapon-attack' &&
      action.automation === 'headless' &&
      (action.category !== 'reaction' || !!action.reactionTriggerActionId.trim())
    ) {
      if (!DICE_PATTERN.test(action.damageDice.replaceAll(' ', ''))) {
        blocking(`action-${index}-damage`, action.name || `动作 ${index + 1}`, '伤害骰格式无效，例如 1d6+4。', targetId)
      }
      return
    }
    review(`action-${index}-manual`, action.name || `动作 ${index + 1}`, '此动作不会自动结算，使用时会交给 DM 裁定。', targetId)
  })

  if (draft.spellcastingEnabled && draft.spellcastingAutomation === 'dm-adjudication') {
    review('spellcasting-manual', '施法', '法术列表会保留，但怪物施法目前按 DM 裁定处理。', 'monster-workshop-spellcasting')
  }

  aiReview?.assumptions?.forEach((detail, index) => {
    review(`ai-assumption-${index}`, 'AI 假设', detail, 'monster-workshop-ai-review')
  })
  aiReview?.unsupported?.forEach((detail, index) => {
    review(`ai-unsupported-${index}`, 'AI 未支持', detail, 'monster-workshop-ai-review')
  })

  return issues
}

export function summarizeDnd5eMonsterWorkshopReview(
  draft: Dnd5eCustomMonsterDraft,
  issues: readonly Dnd5eMonsterWorkshopReviewIssue[],
): Dnd5eMonsterWorkshopReviewSummary {
  let headless = 0
  let partial = 0
  let manual = 0
  for (const action of draft.actions) {
    if (action.kind === 'area-saving-throw') {
      if (validateDnd5eCustomMonsterAreaActionDraft(action).length === 0) headless += 1
      else partial += 1
    } else if (action.kind === 'summon') {
      if (validateDnd5eCustomMonsterSummonActionDraft(action).length === 0) headless += 1
      else partial += 1
    } else if (
      action.kind === 'weapon-attack' &&
      action.automation === 'headless' &&
      (action.category !== 'reaction' || !!action.reactionTriggerActionId.trim())
    ) headless += 1
    else manual += 1
  }
  for (const trait of draft.traits) {
    if (dnd5eMonsterTraitCoveredByFullMechanic(draft, trait)) continue
    if (HEADLESS_TRAIT_RULES.has(trait.ruleKind) && trait.automation === 'headless') headless += 1
    else if (trait.ruleKind === 'none') manual += 1
    else partial += 1
  }
  for (const mechanic of draft.headlessMechanics) {
    if (mechanic.automation === 'full') headless += 1
    else if (mechanic.automation === 'partial') partial += 1
    else manual += 1
  }
  return {
    blocking: issues.filter((issue) => issue.severity === 'blocking').length,
    review: issues.filter((issue) => issue.severity === 'review').length,
    headless,
    partial,
    manual,
  }
}
