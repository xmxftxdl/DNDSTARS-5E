import { getDnd5eSrdMonster, dnd5eMonsterActionUsageId } from './monsters'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { parseDnd5eUnifiedContentBundleV1, dnd5eRulesPluginFromUnifiedContentBundleV1 } from './unifiedContent'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import { previewDnd5eSourceActionInterruptionResolution } from './headlessCombatEngine'
import { expect, it } from 'vitest'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { validateDeclarativeSubclassAbilityV1 } from './declarativeSubclassAbility'
import { createDnd5eCombatant, dnd5eHeadlessTurnKey, dnd5eCombatantPairKey, dnd5eSourceActionInterruptionOptions, previewDnd5eSourceActionInterruption, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eAction, type Dnd5eSourceActionInterruptionReaction } from './headlessCombatEngine'

const ability = {
  schemaVersion: 1, id: 'interrupt', name: 'Interruption', description: 'Synthetic rule', level: 11,
  trigger: { kind: 'before-spell-effect' }, cost: { economy: 'reaction', uses: 1 },
  targeting: { kind: 'self' }, limits: { uses: { kind: 'fixed', value: 1 }, reset: 'short-rest' },
  effects: [], mechanic: { kind: 'source-action-interruption', events: ['spell-cast', 'teleport'], rangeFeet: 60, saveAbility: 'wis', dcAbility: 'wis' },
  automation: 'full',
} as const
const featureId = 'test.source-interrupt:watcher.interrupt'
const usesId = 'test.source-interrupt:decl-watcher-interrupt-uses'
const actor = (id: string, initiative: number, patch: Record<string, unknown> = {}) => createDnd5eCombatant({
  id, name: id, controller: 'player', initiative, abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
  proficiencyBonus: 4, armorClass: 12, currentHp: 40, maxHp: 40, temporaryHp: 0, speed: 30,
  position: { x: 0, y: 0 }, concentrating: false, ...patch,
})

it.each(['add', 'subtract', 'invalid-die', 'spent-reaction'] as const)(
  'recomputes source interruption after a post-roll adjustment: %s', branch => {
    const adjustId = 'test.source-interrupt:shaper.adjust'
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'test.source-interrupt', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'watcher', classId: 'ranger', name: 'Watcher', summary: 'Synthetic', abilities: [ability] })
        api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'shaper', classId: 'sorcerer', name: 'Shaper', summary: 'Synthetic', abilities: [{
          schemaVersion: 1, id: 'adjust', name: 'Adjust', description: 'Synthetic', level: 1,
          trigger: { kind: 'after-d20-roll' },
          cost: { economy: 'reaction', resources: [{ resourceId: 'adjust-uses', amount: 1, scope: 'core' }] },
          targeting: { kind: 'single-creature', relation: 'any', rangeFeet: 30, requiresSight: true },
          mechanic: { kind: 'post-d20-adjustment', rollKinds: ['saving-throw'], dieSides: 6, directions: ['add', 'subtract'] },
          effects: [], automation: 'full',
        }] })
      },
    })
    try {
      const state = startDnd5eHeadlessCombat('source-adjustment', [
        actor('caster', 30, { classId: 'wizard', level: 1, classLevels: { wizard: 1 },
          classSelections: { 'spell-prepared': ['magic-missile'] },
          classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } } }),
        actor('watcher', 20, { controller: 'dm', classId: 'ranger', level: 11, classLevels: { ranger: 11 },
          subclassIds: { ranger: 'test.source-interrupt:watcher' }, pluginFeatureIds: [featureId],
          classResources: { [usesId]: { current: 1, max: 1 } } }),
        actor('shaper', 10, { classId: 'sorcerer', level: 1, classLevels: { sorcerer: 1 },
          subclassIds: { sorcerer: 'test.source-interrupt:shaper' }, pluginFeatureIds: [adjustId],
          classResources: { 'adjust-uses': { current: 1, max: 1 } } }),
      ])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey('caster', 'watcher')]: 10,
        [dnd5eCombatantPairKey('caster', 'shaper')]: 10,
      }
      if (branch === 'spent-reaction') state.combatants.shaper.turn.reactionAvailable = false
      const reaction: Dnd5eSourceActionInterruptionReaction = {
        actorId: 'watcher', featureId, savingThrowD20: branch === 'subtract' ? 13 : 10,
        postD20Adjustment: { sourceId: 'shaper', featureId: adjustId,
          direction: branch === 'subtract' ? 'subtract' : 'add', roll: branch === 'invalid-die' ? 7 : 3 },
      }
      const before = structuredClone(state)
      const preview = previewDnd5eSourceActionInterruptionResolution(state, 'caster', 'spell-cast', reaction)
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'cast-spell', actorId: 'caster', targetId: 'watcher', targetIds: ['watcher'],
        spellId: 'magic-missile', slotLevel: 1, projectileTargetIds: ['watcher', 'watcher', 'watcher'],
        effectRolls: [4, 4, 4], sourceActionInterruptionReaction: reaction,
      })
      expect(state).toEqual(before)
      expect(result.ok, result.ok ? '' : result.reason).toBe(branch === 'add' || branch === 'subtract')
      if (!result.ok) { expect(result.state).toEqual(before); expect(preview).toBeUndefined(); return }
      expect(preview?.interrupted).toBe(branch === 'subtract')
      expect(preview?.savingThrow?.total).toBe(branch === 'subtract' ? 10 : 13)
      expect(result.state.combatants.watcher.currentHp).toBe(branch === 'subtract' ? 40 : 25)
      expect(result.state.combatants.watcher.classResources[usesId].current).toBe(0)
      expect(result.state.combatants.shaper.classResources['adjust-uses'].current).toBe(0)
      expect(result.state.combatants.shaper.turn.reactionAvailable).toBe(false)
      expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(0)
    } finally { dispose() }
  },
)

it.each(['use', 'decline', 'empty', 'wrong-context', 'not-disadvantaged'] as const)(
  'atomically negates disadvantage on the source save: %s', branch => {
    const negateId = 'test.source-interrupt:path.negate'
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'test.source-interrupt', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'watcher', classId: 'ranger', name: 'Watcher', summary: 'Synthetic', abilities: [ability] })
        api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'path', classId: 'monk', name: 'Path', summary: 'Synthetic', abilities: [{
          schemaVersion: 1, id: 'negate', name: 'Negate', description: 'Synthetic', level: 1,
          trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
          cost: { economy: 'none', resources: [{ resourceId: 'dnd5e-ki', scope: 'core', amount: 2 }] },
          mechanic: { kind: 'd20-disadvantage-negation', rollKinds: ['saving-throw'] },
        }] })
      },
    })
    try {
      const state = startDnd5eHeadlessCombat('source-negation', [
        actor('caster', 30, { classId: 'wizard', level: 2, classLevels: { wizard: 1, monk: 1 },
          subclassIds: { monk: 'test.source-interrupt:path' }, pluginFeatureIds: [negateId],
          classSelections: { 'spell-prepared': ['magic-missile'] },
          classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 }, 'dnd5e-ki': { current: branch === 'empty' ? 0 : 2, max: 2 } } }),
        actor('watcher', 20, { controller: 'dm', classId: 'ranger', level: 11, classLevels: { ranger: 11 },
          subclassIds: { ranger: 'test.source-interrupt:watcher' }, pluginFeatureIds: [featureId],
          classResources: { [usesId]: { current: 1, max: 1 } } }),
      ])
      state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'watcher')]: 10 }
      if (branch !== 'not-disadvantaged') state.combatants.caster.classState.activeEffects = [
        createDnd5eMechanicalEffect({ definitionId: 'save-mode', label: 'Save mode', source: { kind: 'plugin' },
          targetId: 'caster', modifiers: { savingThrowDisadvantages: ['wis'] } }),
      ]
      const reaction: Dnd5eSourceActionInterruptionReaction = {
        actorId: 'watcher', featureId, savingThrowD20: 15,
        savingThrowD20Second: branch === 'decline' ? 1 : undefined,
        disadvantageNegationChoice: branch === 'decline' ? undefined : {
          featureId: negateId, rollId: 'save-one', transactionId: 'cast-one',
          contextId: branch === 'wrong-context' ? 'other' : `source-interruption:spell-cast:watcher:${featureId}`,
        },
      }
      const before = structuredClone(state)
      const preview = previewDnd5eSourceActionInterruptionResolution(state, 'caster', 'spell-cast', reaction)
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'cast-spell', actorId: 'caster', targetId: 'watcher', targetIds: ['watcher'],
        spellId: 'magic-missile', slotLevel: 1, projectileTargetIds: ['watcher', 'watcher', 'watcher'],
        effectRolls: [4, 4, 4], sourceActionInterruptionReaction: reaction,
      })
      expect(state).toEqual(before)
      expect(result.ok, result.ok ? '' : result.reason).toBe(branch === 'use' || branch === 'decline')
      if (!result.ok) { expect(result.state).toEqual(before); expect(preview).toBeUndefined(); return }
      expect(preview?.interrupted).toBe(branch === 'decline')
      expect(result.state.combatants.watcher.currentHp).toBe(branch === 'use' ? 25 : 40)
      expect(result.state.combatants.caster.classResources['dnd5e-ki'].current).toBe(branch === 'use' ? 0 : 2)
      expect(result.state.combatants.caster.classState.disadvantageNegationReceipts?.['save-one']).toBeUndefined()
      expect(result.state.combatants.watcher.classResources[usesId].current).toBe(0)
    } finally { dispose() }
  },
)

for (const delivery of ['native', 'monster', 'adjudicated'] as const)
it.each(['source-stops', 'counter-stops', 'invalid-counter'] as const)(`settles source interruption before a subsequent counterspell: ${delivery}/%s`, branch => {
  const dispose = registerDnd5eRulesPlugin({
    manifest: { id: 'test.source-interrupt', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
    setup(api) { api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'watcher', classId: 'ranger', name: 'Watcher', summary: 'Synthetic', abilities: [ability] }) },
  })
  try {
    const caster = actor('caster', 30, { classId: 'wizard', classLevels: { wizard: 1 }, level: 1,
      classSelections: { 'spell-prepared': ['magic-missile'] }, classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 2 } } })
    const watcher = actor('watcher', 20, { classId: 'ranger', level: 11, classLevels: { ranger: 11 },
      subclassIds: { ranger: 'test.source-interrupt:watcher' }, pluginFeatureIds: [featureId],
      classResources: { [usesId]: { current: 1, max: 1 } } })
    const counter = actor('counter', 10, { controller: 'dm', classId: 'wizard', level: 5, classLevels: { wizard: 5 },
      classSelections: { 'spell-prepared': ['counterspell'] }, classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } } })
    const state = startDnd5eHeadlessCombat('reaction-sequence', [caster, watcher, counter])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'watcher')]: 30, [dnd5eCombatantPairKey('caster', 'counter')]: 30 }
    if (delivery === 'monster') {
      state.combatants.caster.statBlockId = 'srd-5.1:mage'
      state.combatants.caster.classState.monsterSpellSlots = { 1: { current: 2, max: 2 } }
    }
    const reactions = {
      sourceActionInterruptionReaction: { actorId: 'watcher', featureId, savingThrowD20: branch === 'source-stops' ? 1 : 20 },
      counterspellReaction: { actorId: branch === 'invalid-counter' ? 'absent' : 'counter', slotLevel: 3 },
    }
    const submitted: Dnd5eAction = delivery === 'native' ? {
      type: 'cast-spell', actorId: 'caster', targetId: 'counter', targetIds: ['counter'], spellId: 'magic-missile', slotLevel: 1,
      projectileTargetIds: ['counter', 'counter', 'counter'], effectRolls: [4, 4, 4], ...reactions,
    } : delivery === 'monster' ? {
      type: 'monster-core-spell', actorId: 'caster', spellId: 'magic-missile', slotLevel: 1,
      resolution: { schemaVersion: 1, targetIds: ['counter'], projectileTargetIds: ['counter', 'counter', 'counter'], effectRolls: [[4], [4], [4]] }, ...reactions,
    } : {
      type: 'adjudicated-spell', actorId: 'caster', spellId: 'magic-missile', spellName: 'Magic missile', spellLevel: 1, slotLevel: 1,
      castingTime: 'action', effects: [{ targetId: 'counter', operation: 'damage', amount: 15 }], ...reactions,
    }
    const before = structuredClone(state), result = resolveDnd5eHeadlessAction(state, submitted)
    expect(state).toEqual(before)
    expect(result.ok, result.ok ? '' : result.reason).toBe(branch !== 'invalid-counter')
    if (!result.ok) { expect(result.state).toEqual(before); return }
    expect(result.state.combatants.counter.currentHp).toBe(40)
    expect(result.state.combatants.watcher.classResources[usesId].current).toBe(0)
    expect(result.state.combatants.watcher.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.counter.classResources['dnd5e-spell-slot-3'].current).toBe(branch === 'source-stops' ? 1 : 0)
    expect(result.state.combatants.counter.turn.reactionAvailable).toBe(branch === 'source-stops')
    expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
    expect(delivery === 'monster' ? result.state.combatants.caster.classState.monsterSpellSlots?.[1]?.current
      : result.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(1)
    expect(result.events.filter(event => event.type === 'source-action-interrupted' || event.type === 'counterspell-resolved').map(event => event.type))
      .toEqual(branch === 'source-stops' ? ['source-action-interrupted'] : ['source-action-interrupted', 'counterspell-resolved'])
  } finally { dispose() }
})

it.each(['legendary', 'legendary-empty', 'legendary-on-success', 'reroll', 'reroll-empty', 'reroll-on-success', 'inspiration', 'invalid-inspiration'] as const)(
  'applies authoritative saving throw corrections to source interruption: %s', branch => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'test.source-interrupt', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) { api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'watcher', classId: 'ranger', name: 'Watcher', summary: 'Synthetic', abilities: [ability] }) },
    })
    try {
      const caster = actor('caster', 30, { classId: 'wizard', level: 10, classLevels: { wizard: 1, fighter: 9 },
        classSelections: { 'spell-prepared': ['magic-missile'] },
        classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 }, fighterIndomitable: { current: branch === 'reroll-empty' ? 0 : 1, max: 1 } },
        classState: { legendaryResistanceUses: branch === 'legendary-empty' ? 0 : 1,
          bardicInspirationDie: 6, bardicInspirationSourceId: 'watcher', bardicInspirationRoundsRemaining: 100 } })
      const watcher = actor('watcher', 20, { classId: 'ranger', level: 11, classLevels: { ranger: 11 },
        subclassIds: { ranger: 'test.source-interrupt:watcher' }, pluginFeatureIds: [featureId],
        classResources: { [usesId]: { current: 1, max: 1 } } })
      const target = actor('target', 10, { controller: 'dm' })
      const state = startDnd5eHeadlessCombat('save-corrections', [caster, watcher, target])
      state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'watcher')]: 30, [dnd5eCombatantPairKey('caster', 'target')]: 30 }
      const reaction: Dnd5eSourceActionInterruptionReaction = { actorId: 'watcher', featureId,
        savingThrowD20: branch.endsWith('on-success') ? 20 : branch.includes('inspiration') ? 8 : 1,
        ...(branch.startsWith('legendary') ? { legendaryResistance: true } : {}),
        ...(branch.startsWith('reroll') ? { rerollResourceKey: 'fighterIndomitable', rerollD20: 20 } : {}),
        ...(branch.includes('inspiration') ? { bardicInspirationRoll: branch === 'invalid-inspiration' ? 7 : 4 } : {}),
      }
      const invalid = branch.includes('empty') || branch.endsWith('on-success') || branch === 'invalid-inspiration'
      const before = structuredClone(state)
      expect(previewDnd5eSourceActionInterruption(state, 'caster', 'spell-cast', reaction)).toBe(invalid ? undefined : false)
      const checkpoint = previewDnd5eSourceActionInterruptionResolution(state, 'caster', 'spell-cast', reaction)
      expect(checkpoint == null).toBe(invalid)
      expect(state).toEqual(before)
      const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'caster', targetId: 'target', targetIds: ['target'],
        spellId: 'magic-missile', slotLevel: 1, projectileTargetIds: ['target', 'target', 'target'], effectRolls: [4, 4, 4],
        sourceActionInterruptionReaction: reaction })
      expect(result.ok, result.ok ? '' : result.reason).toBe(!invalid)
      expect(state).toEqual(before)
      if (!result.ok) { expect(result.state).toEqual(before); return }
      expect(checkpoint?.savingThrow).toEqual(result.events.find(event => event.type === 'saving-throw-resolved'))
      expect(checkpoint?.state.combatants.watcher.classResources[usesId].current).toBe(0)
      expect(checkpoint?.state.combatants.watcher.turn.reactionAvailable).toBe(false)
      expect(result.state.combatants.target.currentHp).toBe(25)
      expect(result.state.combatants.watcher.classResources[usesId].current).toBe(0)
      expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(0)
      expect(result.state.combatants.caster.classState.legendaryResistanceUses).toBe(branch === 'legendary' ? 0 : 1)
      expect(result.state.combatants.caster.classResources.fighterIndomitable.current).toBe(branch === 'reroll' ? 0 : 1)
      expect(result.state.combatants.caster.classState.bardicInspirationDie).toBe(branch === 'inspiration' ? undefined : 6)
      expect(result.events).toContainEqual(expect.objectContaining({ type: 'source-action-interrupted', interrupted: false }))
    } finally { dispose() }
  })

for (const event of ['spell-cast', 'teleport'] as const)
it.each(['second-stops', 'both-pass', 'first-stops', 'duplicate', 'invalid-second', 'nested', 'too-many'] as const)(
  `settles multiple source interrupters atomically: ${event}/%s`, branch => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'test.source-interrupt', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) { api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'watcher', classId: 'ranger', name: 'Watcher', summary: 'Synthetic', abilities: [ability] }) },
    })
    try {
      const caster = actor('caster', 30, { classId: 'wizard', level: 1, classLevels: { wizard: 1 },
        statBlockId: event === 'teleport' ? 'srd-5.1:blink-dog' : undefined,
        classSelections: { 'spell-prepared': ['magic-missile'] }, classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } } })
      const watchers = ['first', 'second'].map((id, i) => actor(id, 20 - i, {
        classId: 'ranger', level: 11, classLevels: { ranger: 11 }, subclassIds: { ranger: 'test.source-interrupt:watcher' },
        pluginFeatureIds: [featureId], classResources: { [usesId]: { current: 1, max: 1 } },
      }))
      const state = startDnd5eHeadlessCombat('multiple-interruptions', [caster, ...watchers, actor('target', 10, { controller: 'dm' })])
      state.distanceFeetByCombatantPair = Object.fromEntries(['first', 'second', 'target'].map(id => [dnd5eCombatantPairKey('caster', id), 30]))
      const next: Dnd5eSourceActionInterruptionReaction = { actorId: branch === 'duplicate' ? 'first' : 'second', featureId,
        savingThrowD20: branch === 'invalid-second' ? 21 : branch === 'both-pass' ? 20 : 1 }
      if (branch === 'nested') next.subsequentReactions = []
      const reaction: Dnd5eSourceActionInterruptionReaction = { actorId: 'first', featureId,
        savingThrowD20: branch === 'first-stops' ? 1 : 20,
        subsequentReactions: branch === 'too-many' ? Array.from({ length: 32 }, () => next) : [next] }
      const before = structuredClone(state)
      const invalid = ['duplicate', 'invalid-second', 'nested', 'too-many'].includes(branch)
      const interrupted = branch === 'first-stops' || branch === 'second-stops'
      expect(previewDnd5eSourceActionInterruption(state, 'caster', event, reaction)).toBe(invalid ? undefined : interrupted)
      const checkpoint = previewDnd5eSourceActionInterruptionResolution(state, 'caster', event, reaction)
      if (!invalid) expect(checkpoint?.savingThrow?.sourceId).toBe(branch === 'first-stops' ? 'first' : 'second')
      const action: Dnd5eAction = event === 'spell-cast' ? {
        type: 'cast-spell', actorId: 'caster', spellId: 'magic-missile', slotLevel: 1, targetId: 'target', targetIds: ['target'],
        projectileTargetIds: ['target', 'target', 'target'], effectRolls: [4, 4, 4], sourceActionInterruptionReaction: reaction,
      } : {
        type: 'monster-special-action', actorId: 'caster',
        actionId: getDnd5eSrdMonster('srd-5.1:blink-dog')!.actions.find(action => action.rule?.kind === 'teleport')!.id,
        teleportDestination: { to: { x: 25, y: 0 }, distanceFeet: 25, toElevationFeet: 0, toGroundElevationFeet: 0 },
        sourceActionInterruptionReaction: reaction,
      }
      const result = resolveDnd5eHeadlessAction(state, action)
      expect(state).toEqual(before)
      expect(result.ok, result.ok ? '' : result.reason).toBe(!invalid)
      if (!result.ok) { expect(result.state).toEqual(before); return }
      expect(result.state.combatants.first.classResources[usesId].current).toBe(0)
      expect(result.state.combatants.second.classResources[usesId].current).toBe(branch === 'first-stops' ? 1 : 0)
      expect(result.state.combatants.second.turn.reactionAvailable).toBe(branch === 'first-stops')
      expect(result.events.filter(e => e.type === 'source-action-interrupted').map(e => e.actorId))
        .toEqual(branch === 'first-stops' ? ['first'] : ['first', 'second'])
      if (event === 'spell-cast') {
        expect(result.state.combatants.target.currentHp).toBe(interrupted ? 40 : 25)
        expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(0)
      } else expect(result.state.combatants.caster.position.x).toBe(interrupted ? 0 : 25)
    } finally { dispose() }
  })

it('validates the interruption contract without conflating it with spell theft', () => {
  expect(() => validateDeclarativeSubclassAbilityV1(ability)).not.toThrow()
  for (const mechanic of [{ events: [] }, { events: ['spell-cast', 'spell-cast'] }, { events: ['attack'] }, { rangeFeet: 0 }, { saveAbility: 'luck' }]) {
    expect(() => validateDeclarativeSubclassAbilityV1({ ...ability, mechanic: { ...ability.mechanic, ...mechanic } })).toThrow()
  }
})

for (const delivery of ['native', 'monster', 'adjudicated'] as const) for (const branch of ['fail', 'pass', 'decline', 'cantrip', 'out-of-range', 'blind', 'spent', 'no-reaction', 'low-level', 'unowned', 'invalid-die'] as const) {
  it(`resolves source interruption atomically: ${delivery}/${branch}`, () => {
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.source-interrupt', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'watcher', classId: 'ranger', name: 'Watcher', summary: 'Synthetic', abilities: [ability] })
    } })
    try {
      const caster = actor('caster', 30, { classId: 'wizard', classLevels: { wizard: 1 }, level: 1,
        classSelections: { 'spell-prepared': ['magic-missile'], 'spell-cantrips': ['ray-of-frost'] },
        classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 2 } } })
      const watcher = actor('watcher', 20, { classId: 'ranger', classLevels: { ranger: branch === 'low-level' ? 10 : 11 }, level: branch === 'low-level' ? 10 : 11,
        subclassIds: { ranger: 'test.source-interrupt:watcher' }, pluginFeatureIds: branch === 'unowned' ? [] : [featureId],
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
        classResources: { [usesId]: { current: branch === 'spent' ? 0 : 1, max: 1 } },
        position: { x: branch === 'out-of-range' ? 100 : 5, y: 0 },
        conditions: branch === 'blind' ? ['blinded'] : [],
      })
      const target = actor('target', 10, { controller: 'dm' })
      const state = startDnd5eHeadlessCombat('interrupt', [caster, watcher, target])
      state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'target')]: 30, [dnd5eCombatantPairKey('watcher', 'caster')]: branch === 'out-of-range' ? 65 : 60 }
      if (branch === 'blind') state.combatants.watcher.classState.activeEffects = [createDnd5eConditionEffect({ id: 'blind', condition: 'blinded', targetId: 'watcher', source: {kind: 'feature', actorId: 'caster'} })]
      if (branch === 'no-reaction') state.combatants.watcher.turn.reactionAvailable = false
      const invalid = ['out-of-range', 'blind', 'spent', 'no-reaction', 'low-level', 'unowned', 'invalid-die'].includes(branch)
      expect(dnd5eSourceActionInterruptionOptions(state, 'caster', 'spell-cast').length).toBe(invalid && branch !== 'invalid-die' ? 0 : 1)
      if (delivery === 'monster') { state.combatants.caster.statBlockId = 'srd-5.1:mage'; state.combatants.caster.classState.monsterSpellSlots = { 1: { current: 2, max: 2 } } }
      const before = structuredClone(state)
      const action: Dnd5eAction = { type: 'cast-spell', actorId: 'caster', targetId: 'target', targetIds: ['target'],
        ...(branch === 'cantrip' ? { spellId: 'ray-of-frost', slotLevel: 0, d20: 15, effectRolls: [4] } :
          { spellId: 'magic-missile', slotLevel: 1, projectileTargetIds: ['target', 'target', 'target'], effectRolls: [4, 4, 4] }),
        ...(branch === 'decline' ? {} : { sourceActionInterruptionReaction: { actorId: 'watcher', featureId, savingThrowD20: branch === 'invalid-die' ? 21 : branch === 'pass' ? 20 : 1 } }),
      }
      expect(previewDnd5eSourceActionInterruption(state, 'caster', 'spell-cast', action.sourceActionInterruptionReaction)).toBe(invalid ? undefined : branch === 'fail' || branch === 'cantrip')
      expect(state).toEqual(before)
      const submitted: Dnd5eAction = delivery === 'monster' ? {
        type: 'monster-core-spell', actorId: 'caster', spellId: branch === 'cantrip' ? 'fire-bolt' : action.spellId, slotLevel: action.slotLevel,
        sourceActionInterruptionReaction: action.sourceActionInterruptionReaction,
        resolution: { schemaVersion: 1, targetIds: ['target'],
          ...(branch === 'cantrip' ? { d20: 15, effectRolls: [[4, 4]] } : { projectileTargetIds: ['target', 'target', 'target'], effectRolls: [[4], [4], [4]] }) },
      } : delivery === 'adjudicated' ? {
        type: 'adjudicated-spell', actorId: 'caster', spellId: action.spellId, spellName: action.spellId,
        spellLevel: action.slotLevel, slotLevel: action.slotLevel, castingTime: 'action',
        sourceActionInterruptionReaction: action.sourceActionInterruptionReaction,
        effects: [{ targetId: 'target', operation: 'damage', amount: 15 }],
      } : action
      const result = resolveDnd5eHeadlessAction(state, submitted)
      expect(state).toEqual(before)
      expect(result.ok, result.ok ? undefined : result.reason).toBe(!invalid)
      if (!result.ok) { expect(result.state).toEqual(before); return }
      const interrupted = branch === 'fail' || branch === 'cantrip'
      expect(result.state.combatants.target.currentHp).toBe(interrupted ? 40 : 25)
      expect(result.state.combatants.watcher.turn.reactionAvailable).toBe(branch === 'decline')
      expect(result.state.combatants.watcher.classResources[usesId].current).toBe(branch === 'decline' ? 1 : 0)
      expect(delivery === 'monster' ? result.state.combatants.caster.classState.monsterSpellSlots?.[1]?.current : result.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(branch === 'cantrip' ? 2 : 1)
      expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
      if (branch !== 'decline') expect(result.events).toContainEqual(expect.objectContaining({ type: 'source-action-interrupted', interrupted }))
      expect(result.state.combatants.watcher.classState.declarativeSpellInterceptionGrants).toBeUndefined()
    } finally { dispose() }
  })
}


it.each(['fail', 'pass', 'decline', 'invalid-die'] as const)('interrupts a concentration Activity before applying nested effects: %s', branch => {
  const automation = automationCapabilityFromLegacyStatus('full')
  const bundle = parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: 'test.interrupt-spell', name: 'Synthetic spell', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace: 'test.interrupt-spell', version: '1.0.0', id: 'veil', kind: 'spell', name: 'Veil', automation,
      activities: [{ schemaVersion: 1, id: 'veil', name: 'Veil', activation: { kind: 'action' }, target: { kind: 'self' }, legacySource: { kind: 'spell', id: 'veil' }, automation,
        effects: [{ schemaVersion: 1, id: 'veil', name: 'Veil', stacking: 'replace', duration: { kind: 'concentration', maximumRounds: 10 }, modifiers: [] }],
        outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'veil', kind: 'apply-effect', target: 'actor', effectId: 'veil' }] }] }],
      payload: { id: 'veil', name: 'Veil', level: 2, school: 'illusion', ritual: false, castingTime: { value: 1, unit: 'action' }, range: { type: 'self' },
        targeting: { relation: 'ally', includeSelf: true, maximumTargets: 1 }, components: { verbal: false, somatic: false, material: false },
        duration: { type: 'timed', unit: 'minute', value: 1, concentration: true }, classes: ['wizard'], description: 'Synthetic interruption test', automation: { mode: 'reference-only' } } }],
  }))!
  const disposeSpell = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.source-interrupt', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'watcher', classId: 'ranger', name: 'Watcher', summary: 'Synthetic', abilities: [ability] })
  } })
  try {
    const caster = actor('caster', 30, { classId: 'wizard', level: 3, classLevels: { wizard: 3 },
      classSelections: { 'spell-prepared': ['test.interrupt-spell:veil'] }, classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } } })
    const watcher = actor('watcher', 20, { classId: 'ranger', level: 11, classLevels: { ranger: 11 },
      subclassIds: { ranger: 'test.source-interrupt:watcher' }, pluginFeatureIds: [featureId],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 }, classResources: { [usesId]: { current: 1, max: 1 } } })
    const state = startDnd5eHeadlessCombat('activity-interruption', [caster, watcher])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'watcher')]: 30 }
    const before = structuredClone(state)
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'plugin-spell-activity', actorId: 'caster',
      ...(branch === 'decline' ? {} : { sourceActionInterruptionReaction: { actorId: 'watcher', featureId, savingThrowD20: branch === 'invalid-die' ? 21 : branch === 'pass' ? 20 : 1 } }),
      pluginAction: { type: 'plugin', pluginId: 'test.interrupt-spell', actionId: 'veil', transactionId: 'blur-interruption', distanceFeet: 0, actorId: 'caster', targetId: 'caster', targetIds: ['caster'], castLevel: 2, rolls: {} },
      spell: { castingClassId: 'wizard', spellId: 'test.interrupt-spell:veil', spellName: 'Blur', spellLevel: 2, slotLevel: 2,
        castingTime: 'action', declaredTargetIds: ['caster'], concentrationRounds: 10, concentrationTargetIds: ['caster'], spellSchool: 'illusion' },
    })
    expect(result.ok, result.ok ? '' : result.reason).toBe(branch !== 'invalid-die')
    expect(state).toEqual(before)
    if (!result.ok) { expect(result.state).toEqual(before); return }
    expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-2'].current).toBe(0)
    expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
    expect(result.state.combatants.watcher.classResources[usesId].current).toBe(branch === 'decline' ? 1 : 0)
    expect(result.state.combatants.caster.concentrating).toBe(branch !== 'fail')
    if (branch === 'fail') {
      expect(result.events.some(e => e.type === 'active-effect-applied')).toBe(false)
      expect(result.activityHandoffs).toBeUndefined()
      expect(result.activityAreaInstance).toBeUndefined()
    } else expect(result.events.some(e => e.type === 'active-effect-applied')).toBe(true)
  } finally { dispose(); disposeSpell() }
})


for (const legendary of [false, true]) it.each(['fail', 'pass', 'decline', 'invalid-die', 'distant'] as const)('interrupts nonspell monster teleport (legendary=' + legendary + '): %s', branch => {
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.source-interrupt', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'watcher', classId: 'ranger', name: 'Watcher', summary: 'Synthetic', abilities: [ability] })
  } })
  try {
    const statBlockId = legendary ? 'srd-5.1:gynosphinx' : 'srd-5.1:blink-dog'
    const monster = getDnd5eSrdMonster(statBlockId)!
    const definition = (legendary ? monster.legendaryActions! : monster.actions).find(action => action.rule?.kind === 'teleport')!
    expect(definition).toBeTruthy()
    const source = actor('source', legendary ? 10 : 30, { controller: 'dm', statBlockId, classState: { monsterLegendaryActionPoints: 3 } })
    const watcher = actor('watcher', 20, { classId: 'ranger', level: 11, classLevels: { ranger: 11 },
      subclassIds: { ranger: 'test.source-interrupt:watcher' }, pluginFeatureIds: [featureId],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 }, classResources: { [usesId]: { current: 1, max: 1 } } })
    const state = startDnd5eHeadlessCombat('teleport-interruption', [source, watcher])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('source', 'watcher')]: branch === 'distant' ? 65 : 30 }
    const before = structuredClone(state)
    const result = resolveDnd5eHeadlessAction(state, {
      type: legendary ? 'monster-legendary-special-action' : 'monster-special-action', actorId: 'source', actionId: definition.id,
      teleportDestination: { to: { x: 25, y: 0 }, distanceFeet: 25, toElevationFeet: 0, toGroundElevationFeet: 0 },
      ...(branch === 'decline' ? {} : { sourceActionInterruptionReaction: { actorId: 'watcher', featureId, savingThrowD20: branch === 'invalid-die' ? 21 : branch === 'pass' ? 20 : 1 } }),
    })
    expect(state).toEqual(before)
    expect(result.ok, result.ok ? '' : result.reason).toBe(!['invalid-die', 'distant'].includes(branch))
    if (!result.ok) { expect(result.state).toEqual(before); return }
    expect(result.state.combatants.source.position).toEqual({ x: branch === 'fail' ? 0 : 25, y: 0 })
    expect(result.events.some(e => e.type === 'teleported')).toBe(branch !== 'fail')
    expect(result.state.combatants.watcher.classResources[usesId].current).toBe(branch === 'decline' ? 1 : 0)
    expect(result.state.combatants.watcher.turn.reactionAvailable).toBe(branch === 'decline')
    if (legendary) expect(result.state.combatants.source.classState.monsterLegendaryActionPoints).toBe(3 - (definition.legendaryCost ?? 1))
    else {
      expect(result.state.combatants.source.turn[definition.economy === 'bonus-action' ? 'bonusActionAvailable' : 'actionAvailable']).toBe(false)
      expect(result.state.combatants.source.classState.monsterRechargeReadyByActionId?.[dnd5eMonsterActionUsageId(definition)]).toBe(false)
    }
  } finally { dispose() }
})


it.each([1, 20])('uses a granted feature teleport window even when interrupted (save=%s)', savingThrowD20 => {
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.source-interrupt', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'watcher', classId: 'ranger', name: 'Watcher', summary: 'Synthetic', abilities: [ability] })
    api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'mover', classId: 'fighter', name: 'Mover', summary: 'Synthetic', abilities: [{
      schemaVersion: 1, id: 'move', name: 'Move', description: 'Synthetic', level: 3, trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
      mechanic: { kind: 'martial-spell-synergy', operation: 'extra-action-teleport', teleportRangeFeet: 30 }, automation: 'full',
    }] })
  } })
  try {
    const source = actor('source', 30, { controller: 'dm', classId: 'fighter', level: 3, classLevels: { fighter: 3 },
      subclassIds: { fighter: 'test.source-interrupt:mover' }, pluginFeatureIds: ['test.source-interrupt:mover.move'] })
    const watcher = actor('watcher', 20, { classId: 'ranger', level: 11, classLevels: { ranger: 11 },
      subclassIds: { ranger: 'test.source-interrupt:watcher' }, pluginFeatureIds: [featureId],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 }, classResources: { [usesId]: { current: 1, max: 1 } } })
    const state = startDnd5eHeadlessCombat('feature-teleport-interruption', [source, watcher])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('source', 'watcher')]: 30 }
    // The separate ability has already granted this window; only its use is under test.
    state.combatants.source.classState.extraActionTeleportTurnKey = dnd5eHeadlessTurnKey(state, 'source')
    const move = { type: 'feature-extra-action-teleport' as const, actorId: 'source', to: { x: 20, y: 0 }, distanceFeet: 20 }
    const result = resolveDnd5eHeadlessAction(state, { ...move, sourceActionInterruptionReaction: { actorId: 'watcher', featureId, savingThrowD20 } })
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.source.position.x).toBe(savingThrowD20 === 1 ? 0 : 20)
    expect(result.state.combatants.watcher.classResources[usesId].current).toBe(0)
    expect(result.state.combatants.source.classState.extraActionTeleportUsedTurnKey).toBe(dnd5eHeadlessTurnKey(state, 'source'))
    expect(resolveDnd5eHeadlessAction(result.state, move)).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  } finally { dispose() }
})
