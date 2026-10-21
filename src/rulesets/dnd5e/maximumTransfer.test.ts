import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap } from '../../store/maps'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { commitDnd5eActivityExecution, resolveDnd5eHeadlessAction, replaceDnd5eCombatantActiveEffects, reconcileDnd5eSummonSourceDeathState } from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { dnd5eActiveHitPointMaximumBonus } from './activeEffects'
import { advanceDnd5eCampaignTimedActiveEffects, reconcileDnd5eSourceEffectLifecycles } from './campaignTimeRules'

it.each([
  ['direct', true, false], ['compiled', true, false], ['direct', false, false], ['compiled', false, false],
  ['direct', true, true], ['compiled', true, true], ['direct', false, true], ['compiled', false, true],
] as const)('transfers the actual maximum debit atomically through %s (current HP: %s, mixed pools: %s)', (route, increaseCurrentHp, mixedPools) => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'transfer', name: 'Transfer',
    activation: { kind: 'free' }, target: { kind: 'creature', relation: 'ally', count: 1 },
    legacySource: { kind: 'feature', id: 'transfer' }, automation: automationCapabilityFromLegacyStatus('full'),
    consumption: (mixedPools ? [6, 10] : [6]).map(sides => ({ kind: 'hit-die', resourceId: `hit-die:d${sides}`, amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve', maximumTotalFraction: 0.5 })),
    effects: ['debit', 'credit'].map(id => ({ schemaVersion: 1, id, name: id, stacking: 'replace', duration: { kind: 'rounds', rounds: 20, expiresAt: 'target-turn-end' } })),
    outcomes: [{ id: 'transfer', when: { kind: 'always' }, operations: [
      { id: 'attach-debit', kind: 'apply-effect', target: 'actor', effectId: 'debit' },
      { id: 'attach-credit', kind: 'apply-effect', target: 'target', effectId: 'credit' },
      ...(mixedPools ? [{ id: 'first-pool', kind: 'transfer-hit-point-maximum' as const, target: 'target' as const, owningEffectId: 'debit', beneficiaryEffectId: 'credit',
        amount: { kind: 'constant' as const, value: 10 }, minimumMaximum: 1, linkLifetimes: true, ...(increaseCurrentHp ? { increaseCurrentHp: true } : {}) }] : []),
      { id: 'transfer', kind: 'transfer-hit-point-maximum', target: 'target', owningEffectId: 'debit', beneficiaryEffectId: 'credit',
        amount: { kind: 'constant', value: 100 }, minimumMaximum: 1, linkLifetimes: true, ...(increaseCurrentHp ? { increaseCurrentHp: true } : {}) },
    ] }],
  }
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.transfer', name: 'Transfer', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
    api.registerFeature({ id: activity.id, name: activity.name, summary: 'Synthetic', description: 'Synthetic', automation: 'full',
      action: dnd5ePluginFeatureActionFromActivityV1(activity) })
  } })
  try {
    const owner = normalizeCharacter({ id: 'owner', name: 'Owner', charClass: '法师', level: 5, maxHp: 30, currentHp: 30,
      hitPointDice: mixedPools ? [{ sides: 6, current: 3, max: 3 }, { sides: 10, current: 2, max: 2 }] : [{ sides: 6, current: 3, max: 5 }] })
    const receiver = normalizeCharacter({ id: 'receiver', name: 'Receiver', maxHp: 10, currentHp: 3 })
    const characters = [owner, receiver]
    const map: BattleMap = { id: 'transfer', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: characters.map((character, index) => ({ id: character.id, characterId: character.id, type: 'player', label: character.name, x: 25 + index * 50, y: 25, size: 1, color: '', emoji: '' })) }
    const order = map.tokens.map((token, index) => ({ tokenId: token.id, label: token.label, roll: 20 - index, color: '', emoji: '' }))
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'transfer', map, characters, initiativeOrder: order })
    snapshot.state.combatants.owner.pluginFeatureIds = ['test.transfer:transfer']
    const run = (state: typeof snapshot.state) => route === 'compiled'
      ? resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: 'test.transfer', actionId: activity.id, featureId: 'test.transfer:transfer', actorId: 'owner', targetId: 'receiver', rolls: {} })
      : commitDnd5eActivityExecution(state, { actorId: 'owner', activityId: activity.id, targetIds: ['receiver'],
        resolution: resolveDnd5eActivity({ activity, actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.owner),
          targets: [dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.receiver)], rolls: {} }),
        source: { kind: 'feature', id: activity.id, packageId: 'test.transfer' } })
    const before = structuredClone(snapshot.state)
    const result = run(snapshot.state)
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(snapshot.state).toEqual(before)
    expect(result.state.combatants.owner.maxHp).toBe(1)
    expect(result.state.combatants.owner.hitPointDice?.[0].current).toBe(2)
    if (mixedPools) {
      expect(result.state.combatants.owner.hitPointDice?.[1].current).toBe(1)
      expect(result.state.combatants.owner.classState.hitPointMaximumReductionLedger?.entries.map(entry => entry.amount)).toEqual([10, 19])
      const overBudget = structuredClone(snapshot.state)
      overBudget.combatants.owner.hitPointDice = [{ sides: 6, current: 2, max: 2 }, { sides: 10, current: 1, max: 1 }]
      const denied = run(overBudget)
      expect(denied.ok).toBe(false)
      expect(denied.state).toEqual(overBudget)
    }
    expect(dnd5eActiveHitPointMaximumBonus(result.state.combatants.receiver.classState.activeEffects)).toBe(29)
    expect(result.state.combatants.receiver.currentHp).toBe(increaseCurrentHp ? 32 : 3)
    const duplicate = run(result.state)
    expect(duplicate.ok).toBe(false)
    expect(duplicate.state).toEqual(result.state)
    for (const failure of ['immune-source', 'dead-recipient'] as const) {
      const input = structuredClone(snapshot.state)
      if (failure === 'immune-source') input.combatants.owner.hitPointMaximumReductionImmunity = true
      else input.combatants.receiver.deathSaves.dead = true
      const failed = run(input)
      expect(failed.ok).toBe(false)
      expect(failed.state).toEqual(input)
    }
    const saved = planDnd5eMapResultApplication({ state: result.state, map, characters, characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...result.events] })
    const reloaded = saved.characters.map(character => normalizeCharacter(JSON.parse(JSON.stringify(character))))
    expect(reloaded.every(character => character.dnd5eCombatState?.activeEffects?.some(effect => effect.linkedLifetime))).toBe(true)
    const donorOnly = reconcileDnd5eSourceEffectLifecycles(reloaded.filter(character => character.id === 'owner'))
    expect(donorOnly[0].maxHp).toBe(1)
    const deceased = reloaded.map(character => character.id === 'receiver'
      ? normalizeCharacter({ ...character, currentHp: 0, deathSaveFailures: 3 }) : character)
    for (const roster of [deceased, [...deceased].reverse()]) {
      const cleaned = reconcileDnd5eSourceEffectLifecycles(roster)
      expect(cleaned.find(character => character.id === 'owner')?.maxHp).toBe(30)
      expect(cleaned.find(character => character.id === 'owner')?.currentHp).toBe(1)
      expect(cleaned.every(character => !character.dnd5eCombatState?.activeEffects?.some(effect => effect.linkedLifetime))).toBe(true)
      expect(reconcileDnd5eSourceEffectLifecycles(cleaned)).toEqual(cleaned)
    }
    for (const cause of ['death', 'effect-ended'] as const) {
      const changed = structuredClone(result.state)
      if (cause === 'death') {
        changed.combatants.receiver.currentHp = 0
        changed.combatants.receiver.deathSaves.dead = true
      } else replaceDnd5eCombatantActiveEffects(changed.combatants.receiver, [])
      const tick = resolveDnd5eHeadlessAction(changed, { type: 'end-turn', actorId: 'owner' })
      expect(tick.ok, tick.ok ? undefined : tick.reason).toBe(true)
      expect(tick.state.combatants.owner.maxHp).toBe(30)
      expect(tick.state.combatants.owner.currentHp).toBe(1)
      expect(dnd5eActiveHitPointMaximumBonus(tick.state.combatants.receiver.classState.activeEffects)).toBe(0)
      const passive = reconcileDnd5eSummonSourceDeathState(changed)
      expect(passive.state.combatants.owner.maxHp).toBe(30)
      expect(dnd5eActiveHitPointMaximumBonus(passive.state.combatants.receiver.classState.activeEffects)).toBe(0)
      expect(reconcileDnd5eSummonSourceDeathState(passive.state).state).toBe(passive.state)
    }
    expect(reloaded.find(character => character.id === 'receiver')?.currentHp).toBe(increaseCurrentHp ? 32 : 3)
    const ended = reloaded.map(character => advanceDnd5eCampaignTimedActiveEffects(character, 2))
    expect(ended.find(character => character.id === 'owner')?.maxHp).toBe(30)
    expect(ended.find(character => character.id === 'owner')?.currentHp).toBe(1)
    expect(ended.find(character => character.id === 'receiver')?.currentHp).toBe(increaseCurrentHp ? 10 : 3)
    expect(ended.find(character => character.id === 'receiver')?.maxHp).toBe(10)
  } finally { dispose() }
})
