import { dnd5eConcentrationChildConsumptionIssues } from './activities/dnd5eConcentrationChildConsumption'
import type { Dnd5eLocalContentAiDraftV1 } from './localContentAiImport'
import { dnd5eFeatureEligibilityReferenceIssues } from './featureEligibility'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { dnd5eContentPackageActivityProjectionV1 } from './activities/dnd5eContentPackageActivityProjection'
import { validateDnd5eActivityDefinitionV1, validateDnd5eEffectDefinitionV1 } from './activities/dnd5eActivityValidation'
import { dnd5eContentDefinitionsFromPackageV2 } from './activities/dnd5eContentDefinitionProjection'
import type { Dnd5eEffectDefinitionV1 } from './activities/dnd5eEffectContracts'
import { dnd5eActivityAutomationAnalysisV1 } from './plugins/pluginMechanicsRegistry'
import { dnd5eActivityHeadlessCompatibility } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5eSummonChoiceCoverageIssues } from './activities/dnd5eSummonChoiceCoverage'
import { dnd5eSpellActivityEntryAudit, dnd5eSpellActivityReachabilityIssues } from './activities/dnd5eSpellActivityReachability'
import { collectDnd5eFormulaRollDeclarations } from './activities/dnd5eFormula'
import { resolveDnd5eActivityInvocationV1 } from './activities/dnd5eActivityInvocation'
import { dnd5eLocalContentSourceConstraintIssues } from './localContentSourceConstraints'
import { pdfSpellExpectedClasses, pdfSpellMetadataEvidence, type PdfSpellSource } from './pdfSpellImport'

export interface PdfSpellHeadlessPreflight {
  status: 'blocked' | 'ready-for-behavior-tests'
  activityCount: number
  spellEntryAudit?: ReturnType<typeof dnd5eSpellActivityEntryAudit>
  /** Per-activity routing evidence, never source behavior certification. */
  activityMechanismAudit?: {
    activityId: string
    analysis: ReturnType<typeof dnd5eActivityAutomationAnalysisV1>
    validationIssues: readonly string[]
    manualOperations: { outcomeId: string; operationId: string }[]
    compatibility?: ReturnType<typeof dnd5eActivityHeadlessCompatibility>
  }[]
  /** Format/parser result only; does not certify runtime installation or behavior. */
  contentParsed?: boolean
  executionKinds?: readonly ('activity' | 'static-modifiers' | 'passive-effects' | 'advancement' | 'spell-grant' | 'd20-roll-confirmation')[]
  issues: string[]
  checkedAt: string
  behaviorVerified: false
}

/** A fresh local preflight, not an AI-issued certificate or a substitute for behavior fixtures. */
export async function preflightPdfSpellDraft(draft: Dnd5eLocalContentAiDraftV1, kind: 'spell' | 'feature' | 'feat' | 'subclass' = 'spell', evidence: { source?: PdfSpellSource; classReference?: string } = {}): Promise<PdfSpellHeadlessPreflight> {
  const issues = [...draft.unsupported]
  if (evidence.source) {
    if ((evidence.source.kind ?? 'spell') !== kind) issues.push('草稿类型与 PDF 来源条目类型不一致。')
    issues.push(...dnd5eLocalContentSourceConstraintIssues(evidence.source.text, draft.contentJson, kind))
  }
  let activityCount = 0
  let spellEntryAudit: PdfSpellHeadlessPreflight['spellEntryAudit']
  const activityMechanismAudit: NonNullable<PdfSpellHeadlessPreflight['activityMechanismAudit']> = []
  let contentParsed = false
  const executionKinds: NonNullable<PdfSpellHeadlessPreflight['executionKinds']>[number][] = []
  try {
    const collection = { spell: 'spells', feature: 'features', feat: 'feats', subclass: 'subclasses' } as const
    const prepared = await prepareDnd5eLocalContentJson(draft.contentJson, 'pdf-spell-preflight.json', { targetCollection: collection[kind] })
    contentParsed = true
    if (prepared.package.content.activities?.some(activity => activity.invocation?.kind === 'triggered' && activity.invocation.event === 'before-death-save')) {
      issues.push('死亡豁免替代已有 Host 暂停与受限 Activity 结算；玩家选择、回合开始时点与房间原子同步尚未完成验收，不能认证完整自动化。')
    }
    issues.push(...dnd5eFeatureEligibilityReferenceIssues(prepared.package.manifest.id,
      [...prepared.package.content.features, ...prepared.package.content.feats]))
    if (prepared.package.content[collection[kind]].length !== 1) issues.push('单条草稿必须包含且仅包含一个对应类型的条目。')
    if (kind === 'spell' && evidence.source && prepared.package.content.spells[0]) {
      const spell = prepared.package.content.spells[0]
      const metadata = pdfSpellMetadataEvidence(evidence.source)
      if (metadata.level !== undefined && metadata.level !== spell.level) issues.push(`法术环级与原文不一致：应为 ${metadata.level}。`)
      if (metadata.concentration !== undefined && metadata.concentration !== spell.duration.concentration) issues.push(`法术专注要求与原文不一致：应为 ${metadata.concentration}。`)
      for (const component of ['verbal', 'somatic', 'material'] as const) {
        if (metadata.components && metadata.components[component] !== spell.components[component]) {
          issues.push(`法术成分与原文不一致：${component} 应为 ${metadata.components[component]}。`)
        }
      }
      const durationUnits: Record<string, number> = { round: 1, minute: 10, hour: 600, day: 14400 }
      if (metadata.durationRounds !== undefined && (spell.duration.type !== 'timed' ||
        (spell.duration.value ?? 0) * (durationUnits[spell.duration.unit ?? ''] ?? 0) !== metadata.durationRounds)) {
        issues.push(`法术持续时间与原文不一致：应为 ${metadata.durationRounds} 轮（每轮六秒）。`)
      }
      if (metadata.materialCostGp !== undefined && spell.components.materialCostGp !== metadata.materialCostGp) issues.push(`法术材料价值与原文不一致：materialCostGp 应为 ${metadata.materialCostGp}；还需可执行 materialRequirement，不能仅写 materialText。`)
      const expectedClasses = pdfSpellExpectedClasses(evidence.source, evidence.classReference ?? '')
      if (expectedClasses?.some(classId => !spell.classes.includes(classId as typeof spell.classes[number]))) issues.push(`法术职业遗漏 PDF 目录中的明确条目；classes 至少应包含 ${expectedClasses.join(', ')}。`)
    }
    const projection = dnd5eContentPackageActivityProjectionV1(prepared.package)
    for (const spell of prepared.package.content.spells) {
      const components = spell.components
      if (components.material && ((components.materialCostGp ?? 0) > 0 || components.materialConsumed)) {
        const hasFallback = components.materialRequirement != null
        const choices = components.materialRequirementByChoice?.options
        if (!hasFallback && !(choices?.length && choices.every(option => option.requirement != null))) {
          issues.push(`法术 ${spell.id} 的昂贵或消耗材料缺少可执行 materialRequirement；Host 不能用材料描述或法器替代库存配方。`)
        }
      }
    }
    for (const definition of dnd5eContentDefinitionsFromPackageV2(prepared.package)) {
      for (const effect of definition.effects ?? []) {
        issues.push(...validateDnd5eEffectDefinitionV1(effect as Dnd5eEffectDefinitionV1)
          .map(issue => `统一效果 ${(effect as Dnd5eEffectDefinitionV1).id}: ${issue}`))
      }
    }
    const entry = prepared.package.content[collection[kind]][0]
    const bound = projection.activities.filter((activity) => kind === 'subclass'
      ? activity.legacySource?.kind === 'subclass-ability'
      : activity.legacySource?.kind === kind && activity.legacySource.id === entry?.id)
    issues.push(...dnd5eConcentrationChildConsumptionIssues(bound))
    activityCount = bound.length
    if (kind === 'spell' && entry) {
      spellEntryAudit = dnd5eSpellActivityEntryAudit(projection.activities, entry.id, prepared.package.content.spells[0])
      issues.push(...dnd5eSpellActivityReachabilityIssues(projection.activities, entry.id, prepared.package.content.spells[0]))
    }
    if (bound.length) executionKinds.push('activity')
    const passiveEntry = kind === 'feature' ? prepared.package.content.features[0] : kind === 'feat' ? prepared.package.content.feats[0] : undefined
    if (passiveEntry) {
      issues.push(...passiveEntry.automationReasons ?? [])
      if (passiveEntry.automation !== 'full') issues.push('特性或专长仍声明部分自动化或手动结算。')
      // A passive declaration is a real Host execution path, not an Activity.
      // Never let passive fields conceal an unverified declarative ability.
      const verifiedPassiveDefense = passiveEntry.declarativeAbility?.mechanic?.kind === 'passive-defense' &&
        passiveEntry.declarativeAbility.trigger.kind === 'passive' && passiveEntry.declarativeAbility.automation === 'full'
      const declaration = passiveEntry.declarativeAbility
      // Advantage rerolls use the persisted roll-confirmation transaction, not
      // an Activity. This only queues behavioral testing; it is not certification.
      const verifiedAdvantageReroll = declaration?.mechanic?.kind === 'd20-choice-reroll' &&
        declaration.mechanic.requiresAdvantage === true && declaration.trigger.kind === 'after-d20-roll' &&
        declaration.automation === 'full' && declaration.effects.length === 0
      if (passiveEntry.automation === 'full' && (!declaration || verifiedPassiveDefense || verifiedAdvantageReroll)) {
        if (verifiedPassiveDefense) executionKinds.push('passive-effects')
        if (verifiedAdvantageReroll) executionKinds.push('d20-roll-confirmation')
        if (passiveEntry.staticModifiers && Object.keys(passiveEntry.staticModifiers).length) executionKinds.push('static-modifiers')
        if (passiveEntry.passiveEffects?.length) executionKinds.push('passive-effects')
        if (passiveEntry.spellGrants?.length) executionKinds.push('spell-grant')
        if (kind === 'feat' && prepared.package.content.feats[0]?.advancements?.length) executionKinds.push('advancement')
      }
      if (declaration && !bound.length && !verifiedPassiveDefense && !verifiedAdvantageReroll) issues.push('声明式能力尚需独立执行路径与行为验证。')
    }
    if (!executionKinds.length) issues.push('没有绑定到条目的可执行 Activity 或已验证结构的被动执行声明。')
    for (const activity of bound) {
      const audit: NonNullable<PdfSpellHeadlessPreflight['activityMechanismAudit']>[number] = {
        activityId: activity.id,
        analysis: dnd5eActivityAutomationAnalysisV1(activity),
        validationIssues: validateDnd5eActivityDefinitionV1(activity),
        manualOperations: activity.outcomes.flatMap(outcome => outcome.operations
          .filter(operation => operation.kind === 'manual-adjudication')
          .map(operation => ({ outcomeId: outcome.id, operationId: operation.id }))),
      }
      activityMechanismAudit.push(audit)
      issues.push(...audit.validationIssues)
      if (kind === 'spell') {
        const attacks = new Set(activity.checks?.filter(check => check.kind === 'attack-roll').map(check => check.id))
        const normalHitPools = new Map<string, Set<string>>()
        for (const outcome of activity.outcomes) {
          if (outcome.when.kind !== 'check' || !attacks.has(outcome.when.checkId) || outcome.when.result !== 'success') continue
          const pools = normalHitPools.get(outcome.when.checkId) ?? new Set<string>()
          for (const operation of outcome.operations) {
            if (operation.kind !== 'damage') continue
            const rolls = collectDnd5eFormulaRollDeclarations([operation.amount])
            rolls.forEach(roll => pools.add(roll.id))
            if (rolls.length && operation.critical !== 'double-dice') issues.push(`Activity ${activity.id} 攻击命中伤害 ${operation.id} 含骰池但未声明 critical:double-dice；需核对重击规则，不得仅凭 full 标记通过。`)
          }
          normalHitPools.set(outcome.when.checkId, pools)
        }
        for (const outcome of activity.outcomes) {
          if (outcome.when.kind !== 'check' || outcome.when.result !== 'critical-success') continue
          const pools = normalHitPools.get(outcome.when.checkId)
          if (pools && outcome.operations.some(operation => operation.kind === 'damage' &&
            collectDnd5eFormulaRollDeclarations([operation.amount]).some(roll => pools.has(roll.id)))) {
            issues.push(`Activity ${activity.id} 重击分支 ${outcome.id} 与 success 分支复用伤害骰池；success 已包含重击，需核对重复伤害。`)
          }
        }
      }
      if (kind === 'spell') issues.push(...dnd5eSummonChoiceCoverageIssues(activity, prepared.package.content.spells[0]?.level ?? 0))
      const capability = audit.analysis.capability
      if (capability.level !== 'full') issues.push(`Activity ${activity.id} 尚需手动结算或仅供展示。`)
      issues.push(...capability.limitations)
      const invocation = resolveDnd5eActivityInvocationV1(activity)
      if (invocation.kind === 'triggered' && ['long-rest-complete','short-rest-complete'].includes(invocation.event)) {
        issues.push(`Activity ${activity.id} 的休息记录、Host一次性授权、特性选择和收据原子提交已接入；已验证自动导出子职包的DM长休→玩家护甲选择→Host结算→刷新防重用。仍需逐项验证本能力的房间事件调度、目标/选项、短休、跳过与结束清理，不能仅凭数据校验认证完整休息触发自动化。`)
      }
      if (activity.invocation?.kind === 'triggered' && activity.invocation.event === 'before-damage') {
        issues.push(`Activity ${activity.id} 声明 before-damage，现有伤害提交前暂停/恢复入口仅支持已接入路径中的个人临时生命与类型防御；尚未验证本条目的全部伤害来源、效果时序与生命周期，不能仅凭数据校验认证自动化。`)
      }
      const binding = activity.authorityBinding
      const verifiedPassiveDefense = binding?.kind === 'declarative-subclass-mechanic' &&
        binding.execution === 'headless-event-engine' && binding.mechanicKind === 'passive-defense' &&
        prepared.package.content.subclasses.some(subclass => subclass.id === binding.subclassId &&
          subclass.abilities.some(ability => ability.id === binding.abilityId && ability.mechanic?.kind === 'passive-defense'))
      if (verifiedPassiveDefense && !executionKinds.includes('passive-effects')) executionKinds.push('passive-effects')
      if (activity.invocation?.kind !== 'triggered' && !verifiedPassiveDefense) {
        const compatibility = dnd5eActivityHeadlessCompatibility(activity, { outerSpellTransaction: kind === 'spell' })
        audit.compatibility = compatibility
        if (!compatibility.supported) issues.push(...compatibility.reasons.map((reason) => `Headless 编译：${reason}`))
      }
    }
    for (const entry of projection.entries) issues.push(...entry.issues)
    if (projection.counts.legacyFallback > 0) issues.push('仍包含旧结算兼容回退，需进一步行为验收。')
  } catch (error) { issues.push(error instanceof Error ? error.message : String(error)) }
  return { status: issues.length ? 'blocked' : 'ready-for-behavior-tests', contentParsed, activityCount, spellEntryAudit, activityMechanismAudit, executionKinds, issues: [...new Set(issues)], checkedAt: new Date().toISOString(), behaviorVerified: false }
}
