import { describe, expect, it } from 'vitest'
import {
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterDraft,
  dnd5eCustomMonsterDraftFromStatBlock,
} from './customMonsterWorkshop'
import {
  applyDnd5eMonsterAbilityTemplate,
  DND5E_MONSTER_ABILITY_TEMPLATES,
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

})
