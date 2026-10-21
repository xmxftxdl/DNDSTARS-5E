import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { dnd5eActivityPerTargetRollDeclarationsV1 } from './dnd5eActivityPerTargetRolls'
import { rollDnd5eActivityTriggerDiceV1 } from './dnd5eActivityTriggerSettlement'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'specific-save', name: 'Specific save', activation: { kind: 'free' },
  automation: automationCapabilityFromLegacyStatus('full'), target: { kind: 'creature', relation: 'any', count: 1 },
  checks: [{ id: 'save', kind: 'saving-throw', rollId: 'save', scope: 'per-target', ability: 'con',
    dc: { kind: 'constant', value: 12 },
    rollModeByStatBlock: { statBlockIds: ['srd-5.1:water-elemental'], mode: 'disadvantage' } }],
  outcomes: [{ id: 'failed', when: { kind: 'check', checkId: 'save', result: 'failure' }, operations: [{
    id: 'damage', kind: 'damage', target: 'target', damageType: 'necrotic', amount: { kind: 'constant', value: 8 },
  }] }],
}

it.each(['matching', 'renamed', 'other-elemental', 'missing-id', 'different-namespace', 'cancelled', 'localized-cancelled', 'plant', 'localized-plant'] as const)(
  'keeps exact stat-block saves aligned across dice and execution (%s)', async scenario => {
    const definition = JSON.parse(JSON.stringify(activity)) as Dnd5eActivityDefinitionV1
    const cancelled = scenario === 'cancelled' || scenario === 'localized-cancelled'
    const plant = scenario === 'plant' || scenario === 'localized-plant'
    definition.checks = definition.checks!.map(check => ({ ...check,
      rollModeByCreatureType: cancelled
        ? { creatureTypes: ['elemental'], mode: 'advantage' }
        : { creatureTypes: ['plant'], mode: 'disadvantage' } }))
    expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
    const make = (id: string) => createDnd5eCombatant({ id, name: id, initiative: 10, controller: 'dm',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
      currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const actor = make('actor'), target = make('target')
    target.name = scenario === 'renamed' ? 'Renamed creature' : 'Water Elemental'
    target.creatureType = scenario === 'localized-plant' ? '植物' : plant ? 'plant' : scenario === 'localized-cancelled' ? '元素生物' : 'elemental'
    target.statBlockId = plant ? 'srd-5.1:awakened-shrub' : scenario === 'missing-id' ? undefined : scenario === 'other-elemental'
      ? 'srd-5.1:fire-elemental' : scenario === 'different-namespace' ? 'homebrew:water-elemental' : 'srd-5.1:water-elemental'
    const state = startDnd5eHeadlessCombat('specific-save', [actor, target])
    const actorSnapshot = dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor)
    const targetSnapshot = dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.target)
    const disadvantaged = scenario === 'matching' || scenario === 'renamed' || plant
    const mode = disadvantaged ? 'disadvantage' : 'normal'
    const recipes = dnd5eActivityPerTargetRollDeclarationsV1({ activity: definition,
      declarations: [{ id: 'save', label: 'Save', count: 2, sides: 20 }],
      actor: { ...actorSnapshot, controller: 'dm' }, targets: [{ ...targetSnapshot, controller: 'dm' }],
      hostSavingThrowMode: () => 'normal', hostAttackRollMode: () => 'normal' })
    expect(recipes).toMatchObject([{ id: 'save:target', count: disadvantaged ? 2 : 1, d20RollMode: mode }])
    const rolled = await rollDnd5eActivityTriggerDiceV1({ state, actorId: actor.id, targetIds: [target.id],
      available: { packageId: 'test.specific-save', packageVersion: '1.0.0', activity: definition, confirmation: 'automatic', retention: 'single-event' },
      triggerContext: { eventId: 'event', event: 'after-damage', source: { kind: 'combat', id: 'damage' }, eligibleActorIds: [actor.id], eligibleTargetIds: [target.id] },
      roll: async request => {
        expect(request.count).toBe(disadvantaged ? 2 : 1)
        return request.count === 2 ? [16, 3] : [16]
      } })
    expect(rolled).not.toHaveProperty('unsupported')
    if ('unsupported' in rolled) throw Error(rolled.unsupported)
    const result = resolveDnd5eActivity({ activity: definition, actor: actorSnapshot, targets: [targetSnapshot],
      rolls: rolled.rolls, checkRollModes: rolled.checkRollModes })
    expect(result).toMatchObject({ ok: true, checks: [{ rollMode: mode, d20: disadvantaged ? 3 : 16, success: !disadvantaged }] })
    if (result.ok) expect(result.proposals.filter(proposal => proposal.kind === 'deal-damage')).toHaveLength(disadvantaged ? 1 : 0)
    const packageId = 'test.specific-save'
    const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [definition] })
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Test', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
      api.registerFeature({ id: definition.id, name: definition.name, description: 'Test', summary: 'Test', automation: 'full',
        action: dnd5ePluginFeatureActionFromActivityV1(definition) })
    } })
    try {
      state.combatants.actor.pluginFeatureIds = [`${packageId}:${definition.id}`]
      const values = disadvantaged ? [16, 3] : [16]
      const committed = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId, actionId: definition.id,
        featureId: `${packageId}:${definition.id}`, actorId: actor.id, targetId: target.id, targetIds: [target.id],
        rolls: { 'save:target': { values, modifier: 0, total: values.reduce((sum, value) => sum + value, 0) } } })
      expect(committed.ok, JSON.stringify(committed)).toBe(true)
      expect(committed.state.combatants.target.currentHp).toBe(disadvantaged ? 22 : 30)
    } finally { dispose(); registration.dispose() }
    expect(state.combatants.target.currentHp).toBe(30)
  },
)

it.each([
  { statBlockIds: [], mode: 'disadvantage' },
  { statBlockIds: ['same', 'same'], mode: 'advantage' },
  { statBlockIds: [' padded '], mode: 'advantage' },
  { statBlockIds: [1], mode: 'advantage' },
  { statBlockIds: ['valid'], mode: 'normal' },
])('rejects malformed stat-block overrides (%j)', override => {
  const malformed = JSON.parse(JSON.stringify(activity))
  malformed.checks[0].rollModeByStatBlock = override
  expect(validateDnd5eActivityDefinitionV1(malformed)).toContain('activity.checks[0].rollModeByStatBlock is invalid')
})
