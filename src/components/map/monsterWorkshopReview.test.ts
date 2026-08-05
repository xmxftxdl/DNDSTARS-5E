import { describe, expect, it } from 'vitest'
import {
  createDnd5eCustomMonsterMechanicDraft,
  createDnd5eCustomMonsterAreaActionDraftFromTrait,
  createDnd5eCustomMonsterDraft,
  createDnd5eCustomMonsterTraitDraft,
} from '../../rulesets/dnd5e/customMonsterWorkshop'
import {
  collectDnd5eMonsterWorkshopReviewIssues,
  dnd5eMonsterActionReviewSummary,
  dnd5eMonsterTraitCoveredByFullMechanic,
  dnd5eMonsterTraitReviewSummary,
  summarizeDnd5eMonsterWorkshopReview,
} from './monsterWorkshopReview'

describe('monster workshop review model', () => {
  it('turns missing area damage type into a navigable blocking issue', () => {
    const draft = createDnd5eCustomMonsterDraft()
    const breath = createDnd5eCustomMonsterAreaActionDraftFromTrait({
      name: '吐息武器',
      description: '15尺锥形，DC14敏捷豁免，失败受到2d6伤害，成功减半。',
    })
    draft.actions = [breath]

    const issues = collectDnd5eMonsterWorkshopReviewIssues(draft)
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'blocking',
      label: '吐息武器',
      detail: '请选择伤害类型',
      targetId: `monster-workshop-action-${breath.id}`,
    }))
    expect(dnd5eMonsterActionReviewSummary(breath)).toContain('待选伤害类型')

    breath.areaDamageType = 'fire'
    const repairedIssues = collectDnd5eMonsterWorkshopReviewIssues(draft)
    expect(repairedIssues.some((issue) => issue.label === '吐息武器' && issue.severity === 'blocking')).toBe(false)
    expect(summarizeDnd5eMonsterWorkshopReview(draft, repairedIssues)).toMatchObject({ headless: 1 })
  })

  it('keeps AI assumptions as review items without blocking save', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.englishName = ''
    const issues = collectDnd5eMonsterWorkshopReviewIssues(draft, {
      assumptions: ['未提供伤害类型。'],
      unsupported: ['召唤目标需要 DM 选择。'],
    })
    expect(issues.filter((issue) => issue.targetId === 'monster-workshop-ai-review')).toEqual([
      expect.objectContaining({ severity: 'review', label: 'AI 假设' }),
      expect.objectContaining({ severity: 'review', label: 'AI 未支持' }),
    ])
    expect(issues.some((issue) => issue.severity === 'blocking')).toBe(false)
  })

  it('does not report a descriptive trait as manual when a same-name full Headless mechanic owns it', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.actions = []
    draft.traits = [{
      ...createDnd5eCustomMonsterTraitDraft(),
      name: '不退斗志',
      description: '当前生命值低于 10 时，造成伤害后额外造成 1d6 同类型伤害。',
    }]
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'desperate-damage',
      name: '不退斗志',
      trigger: 'after-dealt-damage',
      hpBelow: 10,
      effectKind: 'damage',
      effectTarget: 'trigger-target',
      healingDice: '1d6',
      damageType: 'inherit-trigger',
      automation: 'full',
    }]

    expect(dnd5eMonsterTraitCoveredByFullMechanic(draft, draft.traits[0])).toBe(true)
    expect(dnd5eMonsterTraitReviewSummary(draft.traits[0], true)).toBe('同名自定义机制已接管 · 完全 Headless')
    const issues = collectDnd5eMonsterWorkshopReviewIssues(draft)
    expect(issues.some((issue) => issue.label === '不退斗志')).toBe(false)
    expect(summarizeDnd5eMonsterWorkshopReview(draft, issues)).toMatchObject({ headless: 1, manual: 0 })
  })
})
