import { dnd5eActivityFromDeclarativeSubclassAbility } from './activities/legacyContentActivityAdapters'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { dnd5ePluginFeatureDefinition, registerDnd5eRulesPlugin } from './pluginApi'
import { declarativeAbilityCompatibilityV1, validateDeclarativeSubclassAbilityV1, type DeclarativeSubclassAbilityV1 } from './declarativeSubclassAbility'
import { dnd5eDisadvantageNegationOptions, planDnd5eDisadvantageNegation, type DisadvantageNegationRoll } from './disadvantageNegation'

const ability: DeclarativeSubclassAbilityV1 = {
  schemaVersion: 1, id: 'negate', name: 'Negate disadvantage', description: 'Synthetic', level: 11,
  trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
  cost: { economy: 'none', resources: [{ resourceId: 'dnd5e-ki', scope: 'core', amount: 2 }] },
  mechanic: { kind: 'd20-disadvantage-negation', rollKinds: ['attack', 'ability-check', 'saving-throw'] },
}

it('requires a paid self choice without a reroll or action cost, and exposes the supported pre-roll mechanic', () => {
  expect(() => validateDeclarativeSubclassAbilityV1(ability)).not.toThrow()
  for (const cost of [{ economy: 'action' }, { economy: 'none' }, { ...ability.cost, movementFeet: 5 }]) {
    expect(() => validateDeclarativeSubclassAbilityV1({ ...ability, cost })).toThrow()
  }
  expect(() => validateDeclarativeSubclassAbilityV1({ ...ability, mechanic: { kind: 'd20-disadvantage-negation', rollKinds: ['attack', 'attack'] } })).toThrow()
  expect(declarativeAbilityCompatibilityV1(ability).effective).toBe('full')
})

it('plans one normal roll for the qualified owner using two Ki, before dice only', () => {
  const featureId = 'test.negation:path.negate'
  const dispose = registerDnd5eRulesPlugin({
    manifest: { id: 'test.negation', name: 'Negation', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
    setup(api) {
      api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'path', name: 'Path', summary: 'Synthetic', classId: 'monk', abilities: [ability] })

    },
  })
  try {
    expect(dnd5ePluginFeatureDefinition(featureId)?.automation).toBe('full')
    expect(dnd5ePluginFeatureDefinition(featureId)?.action).toBeUndefined()
    for (const kind of ['attack', 'ability-check', 'saving-throw'] as const) {
      const character = normalizeCharacter({ id: 'monk', charClass: '武僧', level: 11, dnd5eClassLevels: { monk: 11 },
        dnd5eClassChoices: { classes: { monk: { subclass: 'test.negation:path' } } }, classResources: { 'dnd5e-ki': { current: 3, max: 11 } } })
      const roll: DisadvantageNegationRoll = { rollId: `host-${kind}`, characterId: character.id, kind, mode: 'disadvantage', phase: 'before-roll' }
      const before = JSON.stringify(character)
      const plan = planDnd5eDisadvantageNegation(character, roll, featureId)
      expect(plan?.character.classResources?.['dnd5e-ki'].current).toBe(1)
      expect(plan?.roll).toEqual({ ...roll, mode: 'normal' })
      expect(JSON.stringify(character)).toBe(before)
      expect(planDnd5eDisadvantageNegation(plan!.character, plan!.roll, featureId)).toBeUndefined()
      for (const patch of [{ phase: 'rolled' as const }, { mode: 'normal' as const }, { mode: 'advantage' as const }, { characterId: 'other' }, { rollId: '' }]) {
        expect(dnd5eDisadvantageNegationOptions(character, { ...roll, ...patch })).toEqual([])
      }
      expect(planDnd5eDisadvantageNegation(character, roll, 'forged')).toBeUndefined()
      for (const actor of [
        { ...character, classResources: { 'dnd5e-ki': { current: 1, max: 11 } } },
        { ...character, level: 10, dnd5eClassLevels: { monk: 10 } },
        { ...character, dnd5eClassChoices: { classes: { monk: { subclass: 'open-hand' } } } },
      ]) expect(dnd5eDisadvantageNegationOptions(actor, roll)).toEqual([])
    }
  } finally { dispose() }
})

it('routes imported negation through the roll owner rather than an empty paid action', () => {
  const activity = dnd5eActivityFromDeclarativeSubclassAbility(ability, { subclassId: 'path' })
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(activity.authorityBinding).toMatchObject({ mechanicKind: 'd20-disadvantage-negation', execution: 'headless-event-engine' })
  expect(activity.authorityBinding).not.toHaveProperty('actionId')
})
