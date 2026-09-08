import { describe, expect, it } from 'vitest'
import {
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterDraft,
  dnd5eCustomMonsterDraftFromStatBlock,
} from './customMonsterWorkshop'
import {
  applyDnd5eMonsterAbilityTemplate,
  DND5E_MONSTER_ABILITY_TEMPLATES,
  dnd5eMonsterWorkshopDefaultSaveDc,
} from './monsterWorkshopAbilityTemplates'
import { DND5E_SRD_MONSTERS } from './monsters'
import { parseDnd5eMonsterStatBlock } from './monsterSchema'

describe('D&D 5e monster workshop ability templates', () => {
  it('indexes only reusable structured Headless traits and actions', () => {
    expect(DND5E_MONSTER_ABILITY_TEMPLATES.length).toBeGreaterThan(500)
    expect(DND5E_MONSTER_ABILITY_TEMPLATES.some((template) => template.section === 'trait')).toBe(true)
    expect(DND5E_MONSTER_ABILITY_TEMPLATES.some((template) => template.ruleKind === 'multiattack')).toBe(true)
    expect(DND5E_MONSTER_ABILITY_TEMPLATES.some((template) => template.ruleKind === 'area-saving-throw')).toBe(true)
    expect(DND5E_MONSTER_ABILITY_TEMPLATES.every((template) => template.searchText.length > 0)).toBe(true)
  })

  it('collapses identical monster-specific traits into one generic placeholder template', () => {
    const templates = DND5E_MONSTER_ABILITY_TEMPLATES.filter((template) =>
      template.section === 'trait' && template.ruleKind === 'magic-resistance')
    expect(templates).toHaveLength(1)
    expect(templates[0]?.sourceCount).toBeGreaterThan(5)
    expect(templates[0]?.description).toBe('【名称】对抗法术和其他魔法效应时进行的豁免检定具有优势。')
    expect(templates[0]?.searchText).toContain('独角兽')

    const initial = createDnd5eCustomMonsterDraft()
    initial.name = '星痕守卫'
    const applied = applyDnd5eMonsterAbilityTemplate(initial, templates[0]!.id)
    const imported = applied.draft.traits.at(-1)
    expect(imported?.description).toBe('星痕守卫对抗法术和其他魔法效应时进行的豁免检定具有优势。')
    expect(imported?.description).not.toContain('【名称】')
    expect(imported?.preservedTrait?.description).toBe(imported?.description)
    expect(imported?.templateSource?.monsterName).toContain('通用模板')
  })

  it('keeps complex parameterized actions distinct while common traits use editors', () => {
    const regeneration = DND5E_MONSTER_ABILITY_TEMPLATES.filter((template) =>
      template.section === 'trait' && template.ruleKind === 'regeneration')
    const areaSaves = DND5E_MONSTER_ABILITY_TEMPLATES.filter((template) =>
      template.section === 'action' && template.ruleKind === 'area-saving-throw')
    expect(regeneration).toHaveLength(1)
    expect(regeneration[0]?.parameterEditor).toBe('regeneration')
    expect(areaSaves.length).toBeGreaterThan(5)
  })

  it('collapses Charge into one editable template with an automatically calculated default DC', () => {
    const templates = DND5E_MONSTER_ABILITY_TEMPLATES.filter((template) =>
      template.parameterEditor === 'charge')
    expect(templates).toHaveLength(1)
    expect(templates[0]).toMatchObject({
      name: '冲锋',
      dependencyCount: 0,
    })
    expect(templates[0]?.sourceCount).toBeGreaterThan(5)
    expect(templates[0]?.description).toContain('DM 填写的额外伤害')
    expect(DND5E_MONSTER_ABILITY_TEMPLATES.some((template) =>
      template.ruleKind === 'charge-damage' && template.name === '猛扑')).toBe(true)
    expect(DND5E_MONSTER_ABILITY_TEMPLATES.some((template) =>
      template.ruleKind === 'charge-damage' && template.name === '践踏冲锋')).toBe(true)

    const initial = createDnd5eCustomMonsterDraft()
    initial.name = '铁角兽'
    initial.challengeRating = '5'
    initial.abilities.str = 18
    const applied = applyDnd5eMonsterAbilityTemplate(initial, templates[0]!.id)
    const imported = applied.draft.traits.at(-1)

    expect(applied.addedActionIds).toEqual([])
    expect(imported).toMatchObject({
      name: '冲锋',
      ruleKind: 'charge-damage',
      chargeMinimumFeet: 20,
      chargeActionId: initial.actions[0].id,
      chargeDamageDice: '2d6',
      chargeSaveEnabled: true,
      chargeSaveAbility: 'str',
      chargeSaveDc: 15,
      chargeSaveCondition: 'prone',
    })
    expect(imported?.preservedTrait).toBeUndefined()
    expect(dnd5eMonsterWorkshopDefaultSaveDc(initial, 'str')).toBe(15)

    imported!.chargeDamageDice = '4d8+3'
    const built = buildDnd5eCustomMonster(applied.draft)
    const charge = built.traits.find((trait) => trait.rule?.kind === 'charge-damage')
    expect(charge?.rule).toMatchObject({
      kind: 'charge-damage',
      minimumStraightMovementFeet: 20,
      extraDamage: { count: 4, sides: 8, bonus: 3 },
      savingThrowOnHit: { ability: 'str', dc: 15, conditionOnFailedSave: 'prone' },
    })
  })

  it('collapses common traits into editable templates and round-trips their Headless rules', () => {
    const expectedSourceCounts = new Map([
      ['regeneration', 7],
      ['magic-weapons', 16],
      ['relentless', 5],
      ['sneak-attack', 2],
      ['surprise-attack', 2],
      ['stench', 2],
    ] as const)
    for (const [editor, sourceCount] of expectedSourceCounts) {
      const matches = DND5E_MONSTER_ABILITY_TEMPLATES.filter((template) =>
        template.parameterEditor === editor)
      expect(matches).toHaveLength(1)
      expect(matches[0]?.sourceCount).toBe(sourceCount)
      expect(matches[0]?.dependencyCount).toBe(0)
    }

    let draft = createDnd5eCustomMonsterDraft()
    draft.name = '常见特性测试怪物'
    draft.challengeRating = '5'
    draft.abilities.con = 16
    for (const editor of expectedSourceCounts.keys()) {
      const template = DND5E_MONSTER_ABILITY_TEMPLATES.find((candidate) =>
        candidate.parameterEditor === editor)!
      draft = applyDnd5eMonsterAbilityTemplate(draft, template.id).draft
    }

    const regeneration = draft.traits.find((trait) => trait.ruleKind === 'regeneration')!
    regeneration.amount = 12
    regeneration.damageTypes = ['fire']
    regeneration.requiresPositiveHp = false
    regeneration.diesAtZeroWhenSuppressed = true
    draft.traits.find((trait) => trait.ruleKind === 'relentless')!.relentlessMaximumDamage = 17
    draft.traits.find((trait) => trait.ruleKind === 'sneak-attack')!.sneakAttackDamageDice = '3d6+1'
    draft.traits.find((trait) => trait.ruleKind === 'surprise-attack')!.surpriseAttackDamageDice = '4d6'
    const stench = draft.traits.find((trait) => trait.ruleKind === 'stench')!
    stench.stenchRangeFeet = 15
    expect(stench.stenchSaveDc).toBe(14)

    const built = buildDnd5eCustomMonster(draft)
    expect(parseDnd5eMonsterStatBlock(built).ok).toBe(true)
    expect(built.traits).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: expect.objectContaining({
        kind: 'regeneration', amount: 12, requiresPositiveHp: false,
        suppressedByDamageTypes: ['fire'], diesAtZeroWhenSuppressed: true,
      }) }),
      expect.objectContaining({ rule: { kind: 'magic-weapons', weaponAttacksMagical: true } }),
      expect.objectContaining({ rule: { kind: 'relentless', maximumDamage: 17 } }),
      expect.objectContaining({ rule: expect.objectContaining({
        kind: 'sneak-attack', extraDamage: expect.objectContaining({ count: 3, sides: 6, bonus: 1 }),
      }) }),
      expect.objectContaining({ rule: expect.objectContaining({
        kind: 'surprise-attack', extraDamage: expect.objectContaining({ count: 4, sides: 6, bonus: 0 }),
      }) }),
      expect.objectContaining({ rule: expect.objectContaining({
        kind: 'turn-start-saving-throw-aura', ruleId: 'stench', rangeFeet: 15, dc: 14,
      }) }),
    ]))

    const restored = dnd5eCustomMonsterDraftFromStatBlock(built)
    expect(restored.traits).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleKind: 'relentless', relentlessMaximumDamage: 17 }),
      expect.objectContaining({ ruleKind: 'sneak-attack', sneakAttackDamageDice: '3d6+1' }),
      expect.objectContaining({ ruleKind: 'surprise-attack', surpriseAttackDamageDice: '4d6' }),
      expect.objectContaining({ ruleKind: 'stench', stenchRangeFeet: 15, stenchSaveDc: 14 }),
    ]))
  })

  it('keeps a complex trait rule that the basic editor cannot represent', () => {
    const template = DND5E_MONSTER_ABILITY_TEMPLATES.find((candidate) =>
      candidate.section === 'trait' && candidate.ruleKind === 'flyby')
    expect(template).toBeDefined()

    const initial = createDnd5eCustomMonsterDraft()
    const applied = applyDnd5eMonsterAbilityTemplate(initial, template!.id)
    const importedTrait = applied.draft.traits.at(-1)
    expect(importedTrait?.templateSource?.templateId).toBe(template!.id)
    expect(importedTrait?.preservedTrait?.rule?.kind).toBe('flyby')

    const restored = JSON.parse(JSON.stringify(applied.draft)) as typeof applied.draft
    const built = buildDnd5eCustomMonster(restored)
    expect(parseDnd5eMonsterStatBlock(built).ok).toBe(true)
    expect(built.traits.some((trait) => trait.rule?.kind === 'flyby' && trait.automation === 'headless')).toBe(true)
  })

  it('imports a multiattack with its child actions and rebases every id on a second copy', () => {
    const template = DND5E_MONSTER_ABILITY_TEMPLATES.find((candidate) =>
      candidate.ruleKind === 'multiattack' && candidate.dependencyCount > 0)
    expect(template).toBeDefined()

    const initial = createDnd5eCustomMonsterDraft()
    initial.actions = []
    const first = applyDnd5eMonsterAbilityTemplate(initial, template!.id)
    const second = applyDnd5eMonsterAbilityTemplate(first.draft, template!.id)
    expect(first.addedActionIds.length).toBeGreaterThan(0)
    expect(first.addedMultiattackIds).toHaveLength(1)
    expect(second.addedMultiattackIds).toHaveLength(1)
    expect(second.addedMultiattackIds[0]).not.toBe(first.addedMultiattackIds[0])
    expect(new Set(second.draft.actions.map((action) => action.id)).size).toBe(second.draft.actions.length)

    const built = buildDnd5eCustomMonster(second.draft)
    expect(parseDnd5eMonsterStatBlock(built).ok).toBe(true)
    const actionIds = new Set(built.actions.map((action) => action.id))
    const multiattacks = built.actions.filter((action) => action.kind === 'multiattack')
    expect(multiattacks).toHaveLength(2)
    for (const multiattack of multiattacks) {
      expect(multiattack.sequence?.every((id) => actionIds.has(id)) ||
        (!!multiattack.randomRepeat && actionIds.has(multiattack.randomRepeat.actionId))).toBe(true)
    }
  })

  it('avoids multiattack id collisions in drafts saved before the template field existed', () => {
    const template = DND5E_MONSTER_ABILITY_TEMPLATES.find((candidate) =>
      candidate.ruleKind === 'multiattack' && candidate.dependencyCount > 0)
    const source = DND5E_SRD_MONSTERS.find((monster) => monster.id === template?.sourceMonsterId)
    expect(template).toBeDefined()
    expect(source).toBeDefined()

    const legacyDraft = dnd5eCustomMonsterDraftFromStatBlock(source!)
    legacyDraft.id = undefined
    legacyDraft.slug = undefined
    legacyDraft.preservedMultiattacks = undefined
    const applied = applyDnd5eMonsterAbilityTemplate(legacyDraft, template!.id)
    expect(applied.addedMultiattackIds[0]).not.toBe(source!.actions.find((action) => action.kind === 'multiattack')?.id)
    const built = buildDnd5eCustomMonster(applied.draft)
    expect(built.actions.filter((action) => action.kind === 'multiattack')).toHaveLength(2)
  })

  it('preserves a complex action rule after workshop save and supports duplicate composition', () => {
    const template = DND5E_MONSTER_ABILITY_TEMPLATES.find((candidate) =>
      candidate.section === 'action' &&
      !['weapon-attack', 'multiattack', 'area-saving-throw', 'summon'].includes(candidate.ruleKind))
    expect(template).toBeDefined()

    const initial = createDnd5eCustomMonsterDraft()
    initial.actions = []
    const first = applyDnd5eMonsterAbilityTemplate(initial, template!.id)
    const second = applyDnd5eMonsterAbilityTemplate(first.draft, template!.id)
    expect(second.addedActionIds[0]).not.toBe(first.addedActionIds[0])

    const built = buildDnd5eCustomMonster(second.draft)
    expect(parseDnd5eMonsterStatBlock(built).ok).toBe(true)
    expect(built.actions.filter((action) => action.rule?.kind === template!.ruleKind)).toHaveLength(2)
  })

  it('imports a legendary action together with its referenced ordinary action', () => {
    const template = DND5E_MONSTER_ABILITY_TEMPLATES.find((candidate) =>
      candidate.section === 'legendary' && candidate.dependencyCount > 0)
    expect(template).toBeDefined()

    const initial = createDnd5eCustomMonsterDraft()
    initial.actions = []
    const applied = applyDnd5eMonsterAbilityTemplate(initial, template!.id)
    const built = buildDnd5eCustomMonster(applied.draft)
    expect(parseDnd5eMonsterStatBlock(built).ok).toBe(true)
    expect(built.legendaryActions).toHaveLength(1)
    const legendary = built.legendaryActions![0]
    expect(legendary.referencedActionId).toBeTruthy()
    expect(built.actions.some((action) => action.id === legendary.referencedActionId)).toBe(true)
  })

  it('keeps advanced area riders while exposing the basic save and damage fields', () => {
    const template = DND5E_MONSTER_ABILITY_TEMPLATES.find((candidate) => {
      if (candidate.section !== 'action' || candidate.ruleKind !== 'area-saving-throw') return false
      const monster = DND5E_SRD_MONSTERS.find((entry) => entry.id === candidate.sourceMonsterId)
      const action = monster?.actions[candidate.sourceIndex]
      return action?.rule?.kind === 'area-saving-throw' &&
        !action.rule.variants &&
        !!action.rule.damage &&
        (!!action.rule.conditionOnFailedSave || !!action.rule.forcedMovementOnFailedSave)
    })
    expect(template).toBeDefined()

    const initial = createDnd5eCustomMonsterDraft()
    initial.actions = []
    const applied = applyDnd5eMonsterAbilityTemplate(initial, template!.id)
    const imported = applied.draft.actions.find((action) => action.id === applied.addedActionIds[0])
    const preservedRule = imported?.preservedAction?.rule
    expect(preservedRule?.kind).toBe('area-saving-throw')

    const built = buildDnd5eCustomMonster(applied.draft)
    const builtRule = built.actions.find((action) => action.id === imported?.id)?.rule
    expect(builtRule?.kind).toBe('area-saving-throw')
    if (preservedRule?.kind === 'area-saving-throw' && !preservedRule.variants && builtRule?.kind === 'area-saving-throw' && !builtRule.variants) {
      expect(builtRule.conditionOnFailedSave).toEqual(preservedRule.conditionOnFailedSave)
      expect(builtRule.forcedMovementOnFailedSave).toEqual(preservedRule.forcedMovementOnFailedSave)
    }
  })

  it('keeps condition-only area saves as complete locked template rules', () => {
    const template = DND5E_MONSTER_ABILITY_TEMPLATES.find((candidate) => {
      if (candidate.section !== 'action' || candidate.ruleKind !== 'area-saving-throw') return false
      const monster = DND5E_SRD_MONSTERS.find((entry) => entry.id === candidate.sourceMonsterId)
      const action = monster?.actions[candidate.sourceIndex]
      return action?.rule?.kind === 'area-saving-throw' &&
        !action.rule.variants &&
        !action.rule.damage &&
        !!action.rule.conditionOnFailedSave
    })
    expect(template).toBeDefined()

    const initial = createDnd5eCustomMonsterDraft()
    initial.actions = []
    const applied = applyDnd5eMonsterAbilityTemplate(initial, template!.id)
    expect(applied.draft.actions[0].kind).toBe('other')
    const built = buildDnd5eCustomMonster(applied.draft)
    expect(parseDnd5eMonsterStatBlock(built).ok).toBe(true)
    expect(built.actions[0].rule?.kind).toBe('area-saving-throw')
  })

  it('exposes carried shared-space relations as searchable composable templates', () => {
    const template = DND5E_MONSTER_ABILITY_TEMPLATES.find((candidate) =>
      candidate.section === 'action' && candidate.ruleKind === 'source-linked-engulf')
    expect(template).toBeDefined()
    expect(template?.mechanicTags).toEqual(expect.arrayContaining([
      '共享空间', '吞没', '携带', '逃脱', '持续伤害',
    ]))
    expect(template?.searchText).toContain('共享空间')

    const initial = createDnd5eCustomMonsterDraft()
    initial.actions = []
    const applied = applyDnd5eMonsterAbilityTemplate(initial, template!.id)
    const built = buildDnd5eCustomMonster(applied.draft)
    const imported = built.actions.find((action) =>
      action.id === applied.addedActionIds[0])
    expect(imported?.automation).toBe('headless')
    expect(imported?.rule?.kind).toBe('source-linked-engulf')
    if (imported?.rule?.kind === 'source-linked-engulf') {
      expect(imported.rule.effect.relation.movement).toBe('carry-target')
      expect(imported.rule.effect.escapeDc).toBeGreaterThan(0)
      expect(imported.rule.effect.periodicDamage).toBeDefined()
    }
  })

})
