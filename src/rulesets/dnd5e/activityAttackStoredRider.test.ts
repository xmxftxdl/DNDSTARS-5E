import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eCombatant, dnd5eCombatantPairKey, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { resolveDnd5eActionWithDamageReactions, resolveDnd5ePreparedWithDamageReactions } from './damageReactionFlow'
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

it.each(['registered', 'compiled', 'native', 'monk'].flatMap(entry => (['native','monk'].includes(entry) ? ['melee'] : ['melee', 'ranged']).flatMap(delivery => [1, 15, 20].map(d20 => ({ entry, delivery, d20 })))))
('roundtrips and atomically settles an imported attack with its stored rider: %j', async ({ entry, delivery, d20 }) => {
  const namespace = 'test.imported-hit'
  const automation = automationCapabilityFromLegacyStatus('full')
  const strike: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'strike', name: 'Synthetic strike',
    activation: { kind: 'action' }, legacySource: { kind: 'feature', id: 'strike' }, automation,
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
    checks: [{ id: 'hit', kind: 'attack-roll', rollId: 'hit', attackBonus: { kind: 'constant', value: 0 },
      rollMode: 'normal', delivery: delivery as 'melee' | 'ranged', scope: 'per-target' }],
    outcomes: [{ id: 'hit', when: { kind: 'check', checkId: 'hit', result: 'success' }, operations: [
      { id: 'base', kind: 'damage', target: 'target', damageType: 'cold', amount: { kind: 'constant', value: 2 } },
      { id: 'drain', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 0 }, damageResult: { operationId: 'base', subject: 'target', multiplier: 0.5 } },
    ] }],
  }
  const rider: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'rider', name: 'Stored fire',
    activation: { kind: 'free' }, legacySource: { kind: 'feature', id: 'strike' }, automation,
    requiresEffectGrant: true, invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'automatic' },
    target: { kind: 'creature', relation: 'any', count: 1 }, requirements: [{ kind: 'attack-delivery', delivery: 'melee' }],
    scaling: [{ basis: 'slot-level', baseLevel: 1, adjustments: [{ operationId: 'extra', diceCountPerStep: 1 }] }],
    outcomes: [{ id: 'extra', when: { kind: 'always' }, operations: [
      { id: 'extra', kind: 'damage', target: 'target', damageType: 'fire', critical: 'double-dice', amount: { kind: 'dice', rollId: 'extra', count: 1, sides: 6 } },
    ] }],
  }
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'strike', name: 'Synthetic', automation,
      activities: [strike, rider], payload: { id: 'strike', name: 'Synthetic', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }],
  }
  const imported = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(imported.bundle))
  try {
    const actor = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: id === 'actor' ? 'player' : 'dm', classId: 'wizard', classLevels: { wizard: 5 }, level: 5,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
      currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: id === 'target' })
    const state = startDnd5eHeadlessCombat('imported', [actor('actor', 20), actor('target', 10)])
    state.combatants.actor.pluginFeatureIds = [namespace + ':strike']
    state.combatants.actor.currentHp = 10
    state.combatants.actor.classSelections = { 'spell-prepared': ['vampiric-touch'] }
    state.combatants.actor.classResources['dnd5e-spell-slot-3'] = { current: 1, max: 1 }
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
    state.combatants.actor.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'stored', definitionId: 'stored', label: 'Stored',
      targetId: 'actor', source: { kind: 'spell', actorId: 'actor', pluginId: namespace, spellLevel: 3, magical: true },
      grantedActivities: ['rider'], grantedActivitiesSingleUse: true })]
    if(entry === 'monk'){
      Object.assign(state.combatants.actor,{classId:'monk',classLevels:{monk:3},level:3})
      state.combatants.actor.classResources['dnd5e-ki']={current:2,max:2}
      state.combatants.actor.classState.monkAttackActionTurnKey='imported:1:actor'
    }
    const before = structuredClone(state), rolled: number[] = []
    const options = { combatRevision: 1, authorityUnchanged: () => true,
      confirm: async () => { throw Error('Automatic rider') }, roll: async (request: { count: number }) => { rolled.push(request.count); return Array(request.count).fill(2) } }
    const rolls = { 'hit:target': { values: [d20], total: d20, modifier: 0 } }
    const result = entry === 'monk' ? await resolveDnd5eActionWithDamageReactions({...options,state,action:{type:'monk-unarmed-bonus',actorId:'actor',mode:'flurry',attackModifier:5,reachFeet:5,damageType:'bludgeoning',damage:{count:1,sides:4,bonus:0},attacks:[{targetId:'target',d20,damageRolls:d20===1?[]:d20===20?[2,2]:[2]},{targetId:'target',d20:d20===1?1:15,damageRolls:d20===1?[]:[2]}]}})
      : entry === 'native' ? await resolveDnd5eActionWithDamageReactions({ ...options, state,
      action: { type: 'cast-spell', actorId: 'actor', targetId: 'target', targetIds: ['target'], spellId: 'vampiric-touch', slotLevel: 3, d20, effectRolls: d20 === 1 ? [] : Array(d20 === 20 ? 6 : 3).fill(2) } })
      : entry === 'compiled' ? await resolveDnd5eActionWithDamageReactions({ ...options, state,
      action: { type: 'plugin', actorId: 'actor', targetId: 'target', targetIds: ['target'], pluginId: namespace, actionId: 'strike', featureId: namespace + ':strike', distanceFeet: 5, rolls, payload: {} } })
      : (await resolveDnd5ePreparedWithDamageReactions(options, { prepared: { state } }, ({ prepared }) => ({
        result: resolveRegisteredDnd5eActivityInCombatV1({ state: prepared.state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: rolls,
          command: { schemaVersion: 1, commandId: 'attack', actorId: 'actor', targetIds: ['target'], packageId: namespace, packageVersion: '1.0.0', activityId: 'strike', expectedRevision: 1 } }).result,
      }))).result
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) throw Error(JSON.stringify(result))
    const triggered = delivery === 'melee' && d20 !== 1, count = d20 === 20 ? 6 : 3
    expect(rolled).toEqual(triggered ? [count] : [])
    const baseDamage = entry === 'monk' ? (d20 === 20 ? 6 : 4) : entry === 'native' ? (d20 === 20 ? 12 : 6) : 2
    expect(result.state.combatants.target.currentHp).toBe(30 - (d20 === 1 ? 0 : baseDamage) - (triggered ? count * 2 : 0))
    expect(result.state.combatants.actor.currentHp).toBe(d20 === 1 || entry === 'monk' ? 10 : 10 + baseDamage / 2)
    expect(result.events.filter(event => event.type === 'concentration-check-required')).toHaveLength(d20 === 1 ? 0 : entry === 'monk' ? 2 : 1)
    expect(result.state.combatants.actor.classState.activeEffects?.some(effect => effect.id === 'stored') ?? false).toBe(!triggered)
    const post = await settleDnd5eActivityTriggerWindowsV1({ state: result.state, events: result.events, eventBatchId: 'imported-post', combatRevision: 2,
      confirm: async () => { throw Error('Duplicate') }, roll: async () => { throw Error('Duplicate') } })
    expect(post.events).toEqual([])
    expect(state).toEqual(before)
  } finally { dispose() }
})

