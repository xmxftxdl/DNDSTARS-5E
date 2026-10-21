import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eCombatEvent } from '../headlessCombatEngine'
import { registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

it.each(['valid', 'missing-source'].flatMap(mode => [false, true].map(rolled => ({ mode, rolled }))))('preserves grant attribution through a compiled native action ($mode, rolled=$rolled)', ({ mode, rolled }) => {
  const packageId = 'test.compiled-grant-damage'
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'strike', name: 'Strike', activation: { kind: 'free' },
    target: { kind: 'self' }, requiresEffectGrant: true, automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'feature', id: 'strike' }, outcomes: [{ id: 'hit', when: { kind: 'always' }, operations: [{
      id: 'damage', kind: 'damage', target: 'actor', damageSource: 'grant-source', damageType: 'fire', amount: rolled ? { kind: 'damage-roll', rollId: 'primary', value: { kind: 'dice', rollId: 'damage', count: 2, sides: 6 } } : { kind: 'constant', value: 7 } }] }] }
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Test', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
      api.registerFeature({ id: activity.id, name: activity.name, description: 'Test', summary: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
    } })
  try {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'player',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
      currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const bearer = make('bearer', 20), caster = make('caster', 10)
    const grant = createDnd5eMechanicalEffect({ definitionId: 'test:grant', label: 'Grant', targetId: bearer.id,
      source: { kind: 'spell', actorId: mode === 'valid' ? caster.id : 'absent', pluginId: packageId, rulesId: 'source-spell', spellLevel: 4 },
      duration: { type: 'permanent' }, grantedActivities: ['strike'] })
    bearer.classState.activeEffects = [grant, createDnd5eMechanicalEffect({ definitionId: 'bonus', label: 'Bonus', targetId: bearer.id,
      source: { kind: 'feature', actorId: caster.id }, modifiers: { damageRollsBySourceBonus: 2 } })]
    const state = startDnd5eHeadlessCombat('compiled-source', [bearer, caster])
    const result = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId, actionId: 'strike',
      featureId: packageId + ':strike', actorId: bearer.id, targetId: bearer.id, rolls: rolled ? { damage: { values: [3, 4], modifier: 0, total: 7 } } : {}, hostEntitlement: { kind: 'active-effect', effectId: grant.id } })
    expect(result.ok, JSON.stringify(result)).toBe(mode === 'valid')
    if (mode === 'valid') expect(result.events).toContainEqual(expect.objectContaining({ type: 'damage-applied', sourceId: caster.id,
      targetId: bearer.id, amount: rolled ? 9 : 7, origin: expect.objectContaining({ kind: 'spell', id: 'source-spell', spellLevel: 4 }) }))
    const diceEvents = result.events.filter(event => event.type === 'activity-formula-roll-resolved')
    expect(diceEvents).toHaveLength(mode === 'valid' && rolled ? 1 : 0)
    if (mode === 'valid' && rolled) expect(diceEvents[0]).toMatchObject({ actorId: caster.id, executorId: bearer.id,
      targetId: bearer.id, kind: 'damage', castLevel: 4, total: 9, formulaAdjustment: 2, dice: [{ rawValues: [3, 4], values: [3, 4] }] })
    expect(state.combatants.bearer.currentHp).toBe(30)
  } finally { dispose(); registration.dispose() }
})

it.each(['matching', 'wrong-type', 'ungranted', 'suspended', 'missing-source', 'ambiguous-source'] as const)('limits recipient damage riders per turn without recursion (%s)', async mode => {
  const packageId = 'test.received-damage'
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'rider', name: 'Synthetic damage rider', activation: { kind: 'free' },
    automation: automationCapabilityFromLegacyStatus('full'), requiresEffectGrant: true,
    legacySource: { kind: 'spell', id: 'synthetic-rider' },
    invocation: { kind: 'triggered', event: 'after-damage', confirmation: 'automatic' },
    target: { kind: 'self' }, requirements: [{ kind: 'damage-type', damageTypes: ['fire'] }, { kind: 'once-per-turn', key: 'received-fire' }],
    outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'actor',
      damageType: 'fire', damageSource: 'grant-source', magical: true, amount: { kind: 'dice', rollId: 'bonus', count: 2, sides: 6 } }] }],
  }] })
  try {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
      currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const source = make('source', 30), first = make('first', 20), second = make('second', 10)
    for (const target of [first, second]) {
      target.damageResistances = ['fire']
      if (mode === 'ungranted') continue
      target.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'test:rider', label: 'Rider', targetId: target.id,
        source: { kind: 'spell', actorId: mode === 'missing-source' ? 'absent' : source.id, pluginId: packageId, rulesId: 'synthetic-rider', spellLevel: 4 }, duration: { type: 'permanent' },
        grantedActivities: ['rider'], modifiers: { suppressDamageResistance: 'fire' },
        suspendedBy: mode === 'suspended' ? ['suppressed'] : undefined })]
      if (mode === 'ambiguous-source') target.classState.activeEffects.push(createDnd5eMechanicalEffect({ definitionId: 'test:other-source', label: 'Other', targetId: target.id,
        source: { kind: 'spell', actorId: second.id, pluginId: packageId, rulesId: 'synthetic-rider', spellLevel: 4 },
        duration: { type: 'permanent' }, grantedActivities: ['rider'] }))
    }
    let state = startDnd5eHeadlessCombat('received-rider', [source, first, second])
    let rolls = 0
    const settle = async (events: readonly Dnd5eCombatEvent[], batch: string) => {
      const result = await settleDnd5eActivityTriggerWindowsV1({ state, events, eventBatchId: batch, combatRevision: 1,
        confirm: async () => { throw Error('Automatic trigger must not prompt') }, roll: async request => {
          rolls++
          expect(request.count).toBe(2)
          expect(request.sides).toBe(6)
          return [3, 4]
        } })
      if (mode !== 'missing-source' && mode !== 'ambiguous-source') expect(result.diagnostics.filter(item => item.status === 'rejected' || item.status === 'unsupported')).toEqual([])
      state = JSON.parse(JSON.stringify(result.state))
      return result
    }
    const attack = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: source.id, targetId: first.id,
      attackModifier: 10, d20: 15, damage: { count: 1, sides: 8, rolls: [8], bonus: 0, type: mode === 'wrong-type' ? 'cold' : 'fire' } })
    expect(attack.ok).toBe(true)
    state = attack.state
    const event = attack.events.find((event): event is Extract<Dnd5eCombatEvent, { type: 'damage-applied' }> => event.type === 'damage-applied')!
    expect(event).toBeDefined()
    const eligible = mode === 'matching'
    const firstSettlement = await settle(attack.events, 'native-hit')
    if (mode === 'missing-source' || mode === 'ambiguous-source') {
      expect(firstSettlement.diagnostics).toContainEqual(expect.objectContaining({ status: 'rejected' }))
      expect(state.combatants.first.currentHp).toBe(92)
      expect(state.combatants.first.classState.declarativeUsedTurnKeys).toBeUndefined()
      expect(firstSettlement.events.some(event => event.type === 'damage-applied')).toBe(false)
      return
    }
    if (eligible) expect(firstSettlement.events).toContainEqual(expect.objectContaining({ type: 'damage-applied', sourceId: source.id,
      targetId: first.id, amount: 7, origin: expect.objectContaining({ kind: 'spell', id: 'synthetic-rider', spellLevel: 4, activityId: 'rider' }) }))
    if (eligible) expect(firstSettlement.events).toContainEqual(expect.objectContaining({
      type: 'activity-formula-roll-resolved', actorId: source.id, executorId: first.id, targetId: first.id,
      kind: 'damage', operationId: 'damage', castLevel: 4, total: 7,
    }))
    const remainingHp = mode === 'ungranted' || mode === 'suspended' ? 96 : 92
    expect(state.combatants.first.currentHp).toBe(eligible ? 85 : remainingHp)
    expect(rolls).toBe(eligible ? 1 : 0)
    // Replay and a distinct committed event share the same per-recipient turn limit.
    await settle(attack.events, 'native-hit')
    await settle([event], 'same-turn-other-hit')
    expect(rolls).toBe(eligible ? 1 : 0)
    // A second recipient has its own limit. This event is a synthetic committed checkpoint.
    await settle([{ ...event, targetId: second.id }], 'second-recipient')
    expect(state.combatants.second.currentHp).toBe(eligible ? 93 : 100)
    expect(rolls).toBe(eligible ? 2 : 0)
    const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: source.id })
    expect(ended.ok).toBe(true)
    state = ended.state
    await settle(attack.events, 'native-hit')
    expect(rolls).toBe(eligible ? 2 : 0)
    await settle([event], 'new-turn-hit')
    expect(state.combatants.first.currentHp).toBe(eligible ? 78 : remainingHp)
    expect(rolls).toBe(eligible ? 3 : 0)
  } finally { registration.dispose() }
})
