import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eDispelMagicEffectsOnTarget, type Dnd5eCombatEvent, type Dnd5eCombatant } from '../headlessCombatEngine'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { registerDnd5eActivityPackage, clearDnd5eActivityRegistryForTests } from './dnd5eActivityRegistry'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import { dnd5eActivityTriggerContextsFromCombatEventV1 } from './dnd5eActivityTriggerWindows'

it.each([
  ['acid-arrow', 0], ['animate-dead', 0], ['feeblemind', 0], ['awaken', 0],
  ['mage-armor', 1], ['haste', 1], ['bestow-curse', 1],
] as const)('uses reviewed SRD duration for Dispel Magic candidates: %s', (spellId, expected) => {
  const actor = createDnd5eCombatant({ id: 'target', name: 'Target', controller: 'player', initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, maxHp: 20, currentHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
    classState: { activeEffects: [createDnd5eMechanicalEffect({ id: 'result', definitionId: spellId, label: 'Result', targetId: 'target',
      source: { kind: 'spell', actorId: 'source', rulesId: spellId }, duration: { type: 'permanent' } })] } })
  const state = startDnd5eHeadlessCombat('duration', [actor])
  expect(dnd5eDispelMagicEffectsOnTarget(state, actor.id)).toHaveLength(expected)
  expect(state.combatants.target.classState.activeEffects).toHaveLength(1)
})

it.each(['absent-source', 'last-target', 'multiple-targets', 'instantaneous-source'] as const)('checks an installed non-SRD spell duration before ending its target lifecycle (%s)', mode => {
  const packageId = 'test.imported-dispel'
  const spellId = `${packageId}:ward`
  const dispose = registerDnd5eRulesPlugin({
    manifest: { id: packageId, name: 'Synthetic ward', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0' },
    setup(api) {
      api.registerHeadlessAction({ id: 'ward', execution: 'worker' })
      api.registerSpell({ id: 'ward', name: 'Ward', level: 1, school: 'abjuration', ritual: false,
        castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 30 },
        components: { verbal: true, somatic: true, material: false },
        duration: mode === 'instantaneous-source' ? { type: 'instantaneous', concentration: false }
          : { type: 'timed', value: 1, unit: 'minute', concentration: mode !== 'absent-source' },
        classes: ['wizard'], description: 'Synthetic test ward', automation: { mode: 'headless-action', actionId: 'ward' },
      })
    },
  })
  try {
    const actor = createDnd5eCombatant({ id: 'mage', name: 'Mage', controller: 'player', initiative: 15,
      classId: 'wizard', level: 7, classSelections: { 'spell-prepared': ['dispel-magic'] },
      abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, proficiencyBonus: 3, armorClass: 12,
      maxHp: 20, currentHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const sourceId = mode === 'absent-source' ? 'absent-caster' : 'origin'
    const target: Dnd5eCombatant = { ...actor, id: 'target', initiative: 5, classState: { activeEffects: ['primary', 'secondary'].map(id =>
      createDnd5eMechanicalEffect({ id, definitionId: spellId, label: 'Ward', kind: 'buff', targetId: 'target',
        source: { kind: 'spell', actorId: sourceId, rulesId: spellId, spellLevel: 6 },
        grantedActivities: [`${packageId}:follow-up`],
        duration: mode === 'absent-source' ? { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' }
          : { type: 'concentration', sourceActorId: sourceId, concentrationId: spellId, remainingRounds: 10 },
      })) } }
    const participants = [actor, target]
    if (mode !== 'absent-source') {
      target.classState.concentrationEffectsBySource = { [sourceId]: spellId }
      participants.push({ ...actor, id: sourceId, concentrating: true, classState: {
        concentrationSpellId: spellId, concentrationSpellLevel: 6,
        concentrationTargetIds: mode === 'multiple-targets' ? ['target', 'other'] : ['target'],
      } })
      if (mode === 'multiple-targets') {
        const other = structuredClone(target)
        other.id = 'other'
        other.classState.activeEffects = other.classState.activeEffects?.map(effect => ({ ...effect, id: `other-${effect.id}`, targetId: 'other' }))
        participants.push(other)
      }
    }
    const state = startDnd5eHeadlessCombat('imported-dispel', participants)
    if (mode === 'instantaneous-source') {
      // Even a stale concentration back-reference cannot turn an instantaneous
      // source into an ongoing spell. Casting Dispel Magic still spends its slot.
      expect(dnd5eDispelMagicEffectsOnTarget(state, 'target')).toEqual([])
      const before = structuredClone(state.combatants.target.classState.activeEffects)
      const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'mage', targetId: 'target',
        spellId: 'dispel-magic', slotLevel: 3, dispelMagicChecks: [], effectRolls: [] })
      expect(result.ok).toBe(true)
      expect(result.state.combatants.target.classState.activeEffects).toEqual(before)
      expect(result.events.some(event => event.type === 'spell-dispelled')).toBe(false)
      expect(result.state.combatants.mage.classResources['dnd5e-spell-slot-3'].current).toBe(0)
      return
    }
    expect(dnd5eDispelMagicEffectsOnTarget(state, 'target')).toEqual([
      { effectId: 'primary', spellId, spellLevel: 6, sourceActorId: sourceId },
    ])
    const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'mage', targetId: 'target',
      spellId: 'dispel-magic', slotLevel: 3, dispelMagicChecks: [{ effectId: 'primary', d20: 20 }], effectRolls: [],
    })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.target.classState.activeEffects ?? []).toEqual([])
    expect(result.state.combatants.target.classState.concentrationEffectsBySource?.[sourceId]).toBeUndefined()
    if (mode !== 'absent-source') {
      expect(result.state.combatants[sourceId].concentrating).toBe(mode === 'multiple-targets')
      expect(result.state.combatants[sourceId].classState.concentrationTargetIds ?? []).toEqual(mode === 'multiple-targets' ? ['other'] : [])
    }
    if (mode === 'multiple-targets') {
      expect(result.state.combatants.other.classState.activeEffects).toHaveLength(2)
      expect(result.state.combatants.other.classState.activeEffects?.[0].grantedActivities).toEqual([`${packageId}:follow-up`])
    }
    const contexts = result.events.flatMap((event, index) => dnd5eActivityTriggerContextsFromCombatEventV1(result.state, event, index, 'imported-dispel'))
      .filter(context => context.event === 'spell-dispelled')
    expect(contexts).toHaveLength(1)
    expect(contexts[0].source).toMatchObject({ kind: 'spell', id: spellId, level: 6 })
  } finally { dispose() }
})

it.each((['spell-countered', 'spell-dispelled'] as const).flatMap(trigger =>
  [true, false].flatMap(success => [true, false].map(owned => ({ trigger, success, owned }))),
))('restores owned resources only after a successful spell termination (%j)', async ({ trigger, success, owned }) => {
  const packageId = 'test.spell-termination'
  const resourceId = `${packageId}:charges`
  const dispose = registerDnd5eRulesPlugin({
    manifest: { id: packageId, name: 'Termination fixture', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0' },
    setup(api) { api.registerFeature({ id: 'reward', name: 'Reward', summary: 'Test', description: 'Test', automation: 'full',
      resources: [{ id: 'charges', label: 'Charges', maximum: 3, resetOn: 'long-rest', initialCurrent: 0 }],
    }) },
  })
  registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'reward', name: 'Reward', activation: { kind: 'free' },
    legacySource: { kind: 'feature', id: 'reward' }, automation: automationCapabilityFromLegacyStatus('full'),
    invocation: { kind: 'triggered', event: trigger, confirmation: 'automatic', retention: 'single-event' },
    target: { kind: 'self' }, outcomes: [{ id: 'reward', when: { kind: 'always' }, operations: [{
      id: 'restore', kind: 'resource', subject: 'actor', resourceId, mode: 'restore', amount: { kind: 'constant', value: 1 },
    }] }],
  }] })
  try {
    const actor = createDnd5eCombatant({ id: 'hero', name: 'Hero', controller: 'player', initiative: 12,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 12,
      maxHp: 20, currentHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      pluginFeatureIds: owned ? [`${packageId}:reward`] : [], classResources: { [resourceId]: { current: 0, max: 3 } },
    })
    const state = startDnd5eHeadlessCombat('termination', [actor, { ...actor, id: 'enemy', pluginFeatureIds: [] }])
    const event: Dnd5eCombatEvent = trigger === 'spell-countered'
      ? { type: 'counterspell-resolved', actorId: 'hero', casterId: 'enemy', spellId: 'fireball', spellLevel: 3, slotLevel: 3, success }
      : { type: 'spell-dispelled', actorId: 'hero', targetId: 'enemy', spellId: 'haste', spellLevel: 3, effectId: 'haste-instance', success }
    const contexts = dnd5eActivityTriggerContextsFromCombatEventV1(state, event, 0, 'termination-event')
    expect(contexts).toHaveLength(success ? 1 : 0)
    if (success) expect(contexts[0]).toMatchObject({ event: trigger, eligibleActorIds: ['hero'],
      source: { kind: 'spell', id: event.spellId, level: 3 } })
    const result = await settleDnd5eActivityTriggerWindowsV1({ state, combatRevision: 1, events: [event],
      eventBatchId: 'termination-event', confirm: async () => { throw Error('Automatic reward must not prompt') }, roll: async () => [],
    })
    expect(result.state.combatants.hero.classResources[resourceId].current).toBe(success && owned ? 1 : 0)
    expect(result.state.combatants.enemy.classResources[resourceId].current).toBe(0)
    expect(state.combatants.hero.classResources[resourceId].current).toBe(0)
  } finally { clearDnd5eActivityRegistryForTests(); dispose() }
})
