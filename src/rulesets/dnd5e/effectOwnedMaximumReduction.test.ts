import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap } from '../../store/maps'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { commitDnd5eActivityExecution, resolveDnd5eHeadlessAction, replaceDnd5eCombatantActiveEffects } from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { recoverDnd5eHitPointMaximumReductions } from './hitPointMaximumReductions'
import { advanceDnd5eCampaignTimedActiveEffects } from './campaignTimeRules'

it.each(['direct', 'compiled'] as const)('persists and restores only an owning effect reduction via %s', route => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'lower-maximum', name: 'Lower maximum',
    activation: { kind: 'free' }, target: { kind: 'self' }, legacySource: { kind: 'feature', id: 'lower-maximum' },
    automation: automationCapabilityFromLegacyStatus('full'),
    consumption: [{ kind: 'hit-die', resourceId: 'hit-die:d6', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
    effects: [{ schemaVersion: 1, id: 'anchor', name: 'Anchor', stacking: 'replace', duration: { kind: 'rounds', rounds: 2, expiresAt: 'target-turn-end' } }],
    outcomes: [{ id: 'lower', when: { kind: 'always' }, operations: [
      { id: 'apply', kind: 'apply-effect', effectId: 'anchor', target: 'actor' },
      { id: 'lower', kind: 'reduce-hit-point-maximum', target: 'actor', owningEffectId: 'anchor', amount: { kind: 'constant', value: 100 }, minimumMaximum: 1 },
    ] }],
  }
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.maximum', name: 'Maximum', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
      api.registerFeature({ id: activity.id, name: activity.name, summary: 'Synthetic', description: 'Synthetic', automation: 'full',
        action: dnd5ePluginFeatureActionFromActivityV1(activity) })
    } })
  try {
    const owner = normalizeCharacter({ id: 'owner', name: 'Owner', charClass: '法师', level: 5, maxHp: 30, currentHp: 30,
      hitPointDice: [{ sides: 6, current: 3, max: 5 }] })
    const map: BattleMap = { id: 'maximum', name: 'Map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [
        { id: 'caster', characterId: owner.id, type: 'player', label: owner.name, x: 25, y: 25, size: 1, color: '', emoji: '' },
      ] }
    const order = [{ tokenId: 'caster', label: owner.name, roll: 20, color: '', emoji: '' }]
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'maximum', map, characters: [owner], initiativeOrder: order })
    snapshot.state.combatants.caster.pluginFeatureIds = ['test.maximum:lower-maximum']
    const before = structuredClone(snapshot.state)
    const command = { type: 'plugin' as const, pluginId: 'test.maximum', actionId: activity.id,
      featureId: 'test.maximum:lower-maximum', actorId: 'caster', targetId: 'caster', rolls: {} }
    const run = (state: typeof snapshot.state) => {
      const actor = dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.caster)
      return route === 'compiled' ? resolveDnd5eHeadlessAction(state, command)
        : commitDnd5eActivityExecution(state, { actorId: 'caster', activityId: activity.id, targetIds: ['caster'],
          resolution: resolveDnd5eActivity({ activity, actor, targets: [actor], rolls: {} }), source: { kind: 'feature', id: activity.id, packageId: 'test.maximum' } })
    }
    const result = run(snapshot.state)
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(snapshot.state).toEqual(before)
    const combatant = result.state.combatants.caster
    expect(combatant.maxHp).toBe(1)
    expect(combatant.currentHp).toBe(1)
    expect(combatant.classState.hitPointMaximumReductionLedger?.entries).toHaveLength(1)
    expect(combatant.hitPointDice?.[0].current).toBe(2)
    const duplicate = run(result.state)
    expect(duplicate.ok).toBe(false)
    expect(duplicate.state).toEqual(result.state)
    const immune = structuredClone(snapshot.state)
    immune.combatants.caster.hitPointMaximumReductionImmunity = true
    const rejected = run(immune)
    expect(rejected.ok).toBe(false)
    expect(rejected.state).toEqual(immune)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'hit-point-maximum-reduced', appliedAmount: 29, recovery: 'effect-removal' }))
    for (const recovery of ['long-rest', 'greater-restoration-or-other-magic'] as const) {
      expect(recoverDnd5eHitPointMaximumReductions(combatant.classState.hitPointMaximumReductionLedger, recovery).recoveredAmount).toBe(0)
    }
    const saved = planDnd5eMapResultApplication({ state: result.state, map, characters: [owner],
      characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...result.events] })
    const restoredOwner = normalizeCharacter(JSON.parse(JSON.stringify(saved.characters[0])))
    const mixed = structuredClone(restoredOwner)
    const mixedState = mixed.dnd5eCombatState!
    const otherOwner = { ...mixedState.activeEffects![0], id: 'other-owner', duration: { type: 'permanent' as const } }
    mixedState.activeEffects = [...mixedState.activeEffects!, otherOwner]
    mixedState.hitPointMaximumReductionLedger = { schemaVersion: 1, baseMaximum: 40, entries: [
      ...mixedState.hitPointMaximumReductionLedger!.entries,
      { id: 'rest-recovery', amount: 4, recovery: 'long-rest' },
      { id: 'other-effect', amount: 3, recovery: 'effect-removal', sourceEffectId: otherOwner.id },
    ] }
    mixed.maxHp = 4
    const mixedBefore = structuredClone(mixed)
    const partlyExpired = advanceDnd5eCampaignTimedActiveEffects(mixed, 1)
    expect(mixed).toEqual(mixedBefore)
    expect(partlyExpired.maxHp).toBe(33)
    expect(partlyExpired.currentHp).toBe(1)
    expect(partlyExpired.dnd5eCombatState?.hitPointMaximumReductionLedger?.entries.map(entry => entry.id)).toEqual(['rest-recovery', 'other-effect'])
    expect(advanceDnd5eCampaignTimedActiveEffects(partlyExpired, 0)).toEqual(partlyExpired)
    const expired = advanceDnd5eCampaignTimedActiveEffects(restoredOwner, 1)
    expect(expired.maxHp).toBe(30)
    expect(expired.currentHp).toBe(1)
    expect(expired.dnd5eCombatState?.hitPointMaximumReductionLedger).toBeUndefined()
    const restored = createDnd5eMapCombatSnapshot({ combatId: 'maximum', map: saved.map, characters: [restoredOwner], initiativeOrder: order })
    expect(restored.state.combatants.caster.maxHp).toBe(1)
    replaceDnd5eCombatantActiveEffects(restored.state.combatants.caster, [])
    expect(restored.state.combatants.caster.maxHp).toBe(30)
    expect(restored.state.combatants.caster.currentHp).toBe(1)
    expect(restored.state.combatants.caster.classState.hitPointMaximumReductionLedger).toBeUndefined()
  } finally { dispose() }
})
