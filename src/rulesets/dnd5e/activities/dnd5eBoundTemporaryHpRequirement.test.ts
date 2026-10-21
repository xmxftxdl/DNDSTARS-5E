import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { prepareDnd5eLocalContentJson } from '../localContentCollection'
import { dnd5eRulesPluginFromContentPackageV2 } from '../contentPackageV2'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eConditionEffect } from '../activeEffects'
import { dnd5eActivityTriggerContextsFromCombatEventV1 } from './dnd5eActivityTriggerWindows'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const automation = automationCapabilityFromLegacyStatus('full')
const retaliation: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'retaliate', name: 'Synthetic cold ward', automation,
  legacySource: { kind: 'feature', id: 'retaliate' }, activation: { kind: 'special', timing: 'hit' },
  invocation: { kind: 'triggered', event: 'reaction-window', confirmation: 'automatic', retention: 'single-event' },
  usableWhileIncapacitated: true, requiresEffectGrant: true,
  target: { kind: 'creature', relation: 'any', count: 1 },
  requirements: [{ kind: 'effect-bound-temporary-hit-points', subject: 'actor', effectId: 'ward' },
    { kind: 'attack-delivery', delivery: 'melee' }],
  outcomes: [{ id: 'cold', when: { kind: 'always' }, operations: [{ id: 'cold', kind: 'damage', target: 'target',
    damageType: 'cold', amount: { kind: 'constant', value: 7 } }] }],
}

it.each(['active', 'upcast', 'exhausted', 'higher-other', 'equal-other', 'lower-other', 'choose-keep', 'choose-replace', 'suspended', 'removed', 'expired', 'wrong-owner', 'ranged', 'incapacitated', 'no-grant', 'incapacitated-no-grant'])(
  'requires the remaining pool to belong to the declared live effect: %s', async mode => {
    const base: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'guard', name: 'Guard', automation, legacySource: { kind: 'feature', id: 'guard' },
      activation: { kind: 'free' }, target: { kind: 'self' },
      effects: [{ schemaVersion: 1, id: 'ward', name: 'Ward', stacking: 'replace', modifiers: [], grants: ['retaliate'],
        duration: { kind: 'rounds', rounds: 2, expiresAt: 'source-turn-start' } }],
      outcomes: [{ id: 'guard', when: { kind: 'always' }, operations: [
        { id: 'effect', kind: 'apply-effect', target: 'actor', effectId: 'ward' },
        { id: 'hp', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 7 }, sourceEffectId: 'ward' },
      ] }],
    }
    const other: Dnd5eActivityDefinitionV1 = { ...base, id: 'other', legacySource: { kind: 'feature', id: 'other' },
      outcomes: [{ id: 'hp', when: { kind: 'always' }, operations: [{ id: 'hp', kind: 'temporary-hit-points', target: 'actor',
        amount: { kind: 'constant', value: mode === 'higher-other' ? 10 : mode === 'equal-other' ? 7 : 3 } }] }] }
    const reactive = structuredClone(retaliation)
    if (mode.startsWith('choose-')) {
      other.choices = [{ id: 'pool', label: '临时生命值来源', defaultOptionId: 'keep', options: [
        { id: 'keep', label: '保留当前' }, { id: 'replace', label: '采用新来源' },
      ] }]
      other.outcomes = [{ id: 'hp', when: { kind: 'choice', choiceId: 'pool', optionId: 'replace' },
        operations: [{ id: 'hp', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 3 }, replacement: 'replace' }] }]
    }
    if (mode === 'upcast' && reactive.outcomes[0].operations[0].kind === 'damage') {
      reactive.outcomes[0].operations[0].amount = { kind: 'multiply', values: [
        { kind: 'constant', value: 7 }, { kind: 'reference', reference: { kind: 'cast-level' } },
      ] }
    }
    const { package: pkg } = await prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Bound ward',
      features: ['guard', 'other', 'retaliate'].map(id => ({ id, name: id, summary: 'Synthetic', description: 'Synthetic', automation: 'full' })),
      activities: [base, other, reactive],
    }))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
    try {
      const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: id === 'owner' ? 'player' : 'dm',
        initiative: id === 'owner' ? 20 : 10, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        proficiencyBonus: 2, armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
        position: { x: 0, y: 0 }, concentrating: false })
      const owner = make('owner')
      owner.pluginFeatureIds = ['guard', 'other', 'retaliate'].map(id => `${pkg.manifest.id}:${id}`)
      let state = startDnd5eHeadlessCombat('bound-ward', [owner, make('enemy')])
      const cast = (activityId: string) => {
        const result = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, authoritativeRolls: {},
          command: { schemaVersion: 1, commandId: activityId, actorId: 'owner', targetIds: ['owner'], expectedRevision: 1,
            castLevel: mode === 'upcast' ? 3 : undefined,
            choices: activityId === 'other' && mode.startsWith('choose-') ? { pool: mode === 'choose-keep' ? 'keep' : 'replace' } : undefined,
            packageId: pkg.manifest.id, packageVersion: pkg.manifest.version, activityId } })
        expect(result.result.ok, JSON.stringify(result)).toBe(true)
        if (result.phase !== 'commit' || !result.result.ok) throw Error('Expected commit')
        state = JSON.parse(JSON.stringify(result.result.state))
      }
      cast('guard')
      // This synthetic root is a feature. Restore the spell-level provenance
      // that a spell-backed grant carries to isolate inherited-level handling.
      if (mode === 'upcast') state.combatants.owner.classState.activeEffects!.forEach(effect => { effect.source.spellLevel = 3 })
      expect(state.combatants.owner.temporaryHp).toBe(7)
      expect(state.combatants.owner.classState.temporaryHitPointsSource).toMatchObject({
        effectDefinitionId: 'activity:guard:ward',
      })
      if (mode.endsWith('other') || mode.startsWith('choose-')) cast('other')
      if (mode.startsWith('choose-')) {
        expect(state.combatants.owner.temporaryHp).toBe(mode === 'choose-keep' ? 7 : 3)
        expect(state.combatants.owner.classState.temporaryHitPointsSource != null).toBe(mode === 'choose-keep')
      }
      if (mode === 'suspended') state.combatants.owner.classState.activeEffects![0].suspendedBy = ['antimagic']
      if (mode === 'removed') state.combatants.owner.classState.activeEffects = []
      if (mode === 'wrong-owner') state.combatants.owner.classState.temporaryHitPointsSource!.actorId = 'enemy'
      if (mode.endsWith('no-grant')) state.combatants.owner.classState.activeEffects!.forEach(effect => { effect.grantedActivities = [] })
      if (mode.startsWith('incapacitated')) {
        state.combatants.owner.conditions = ['incapacitated']
        state.combatants.owner.classState.activeEffects!.push(createDnd5eConditionEffect({ condition: 'incapacitated',
          targetId: 'owner', source: { kind: 'dm' }, duration: { type: 'permanent' } }))
        // An owned feature is insufficient to invoke this autonomous effect directly.
        const trigger = dnd5eActivityTriggerContextsFromCombatEventV1(state, { type: 'attack-resolved', actorId: 'enemy',
          targetId: 'owner', d20: 15, total: 20, armorClass: 10, hit: true, critical: false, attackMode: 'melee' }, 0, 'forged')
          .find(context => context.event === 'reaction-window')!
        const forged = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, authoritativeRolls: {}, confirmedBy: 'system', triggerContext: trigger,
          command: { schemaVersion: 1, commandId: 'forged', actorId: 'owner', targetIds: ['enemy'], expectedRevision: 1,
            packageId: pkg.manifest.id, packageVersion: pkg.manifest.version, activityId: 'retaliate', triggerEventId: trigger.eventId } })
        expect(forged.result.ok).toBe(false)
      }
      if (mode === 'expired') {
        for (let i = 0; i < 4; i++) {
          const next = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: state.initiativeOrder[state.initiativeIndex] })
          expect(next.ok).toBe(true)
          state = JSON.parse(JSON.stringify(next.state))
        }
        expect(state.combatants.owner.temporaryHp).toBe(0)
      }
      const attack = (ranged: boolean, amount: number) => {
        state.initiativeIndex = 1
        const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'enemy', targetId: 'owner',
          spendAction: false, attackModifier: 5, d20: 15, damage: { count: 1, sides: 6, rolls: [1], bonus: amount - 1, type: 'slashing' },
          classDamageContext: { mode: ranged ? 'ranged' : 'melee', finesse: false, strengthBased: true, weaponId: 'test',
            weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false } })
        expect(result.ok, result.ok ? '' : result.reason).toBe(true)
        state = JSON.parse(JSON.stringify(result.state))
      }
      if (mode === 'exhausted') attack(true, 7)
      attack(mode === 'ranged', 9)
      expect(state.combatants.enemy.currentHp).toBe(mode === 'upcast' ? 9 : ['active', 'lower-other', 'choose-keep', 'incapacitated'].includes(mode) ? 23 : 30)
      // Depleting the owning pool on this hit still retaliates; later hits cannot.
      attack(false, 1)
      expect(state.combatants.enemy.currentHp).toBe(mode === 'upcast' ? 9 : ['active', 'lower-other', 'choose-keep', 'incapacitated'].includes(mode) ? 23 : 30)
    } finally { dispose() }
  }, 15000,
)

it.each([{ subject: 'other', effectId: 'ward' }, { subject: 'actor', effectId: '' }])('rejects invalid pool selectors', value => {
  expect(validateDnd5eActivityDefinitionV1({ ...retaliation, requirements: [
    { kind: 'effect-bound-temporary-hit-points', ...value } as never,
  ] }).length).toBeGreaterThan(0)
})

it.each([
  { requiresEffectGrant: undefined }, { consumption: [{ kind: 'action-economy', economy: 'reaction', amount: 1, consumeOn: 'resolve' }] },
  { requirements: [] }, { activation: { kind: 'reaction' } },
])('rejects autonomous authorizations without a maintained no-cost effect', patch => {
  expect(validateDnd5eActivityDefinitionV1({ ...retaliation, ...patch } as Dnd5eActivityDefinitionV1).length).toBeGreaterThan(0)
})
