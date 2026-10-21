import { expect, it } from 'vitest'
import type { BattleMap, Token } from '../../../store/maps'
import { migrateMapsState } from '../../../store/maps'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from '../mapBridge'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { removeCharacterConcentrationEffectsFromMaps } from '../../../../scripts/shared-server-core.mjs'
import { expireDnd5eSummonLingerAtWorldMinute } from '../../../../shared/summon-linger.mjs'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { dnd5eActivityPerTargetRollDeclarationsV1 } from './dnd5eActivityPerTargetRolls'
import { rollDnd5eActivityTriggerDiceV1 } from './dnd5eActivityTriggerSettlement'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

it.each(['deception', 'intimidation', 'persuasion'].flatMap(sourceSkill => [false, true].map(becomesHostile => ({ sourceSkill, becomesHostile }))))(
  'persists opposed command failure through an exported module, $sourceSkill hostile=$becomesHostile', async ({ sourceSkill, becomesHostile }) => {
  const namespace = 'test.companion-control'
  const automation = automationCapabilityFromLegacyStatus('full')
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic control module', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'order', name: 'Order', automation,
      payload: { id: 'order', name: 'Order', summary: 'Synthetic', description: 'Synthetic fixture', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'order', name: 'Order', activation: { kind: 'free' },
        target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 }, automation,
        requirements: [{ kind: 'owned-companion', subject: 'target' }], legacySource: { kind: 'feature', id: 'order' },
        checks: [{ id: 'contest', kind: 'opposed-ability-check', rollId: 'source', opposedRollId: 'defense', scope: 'per-target',
          sourceAbility: 'cha', ...(becomesHostile ? { sourceSkill } : {}), sourceModifier: { kind: 'reference', reference: { kind: 'actor-skill-check-modifier', skill: sourceSkill } }, sourceRollMode: 'host-derived', targetRollMode: 'host-derived', targetOptions: [{ ability: 'str' }, { ability: 'wis', skill: 'insight' }] }],
        outcomes: [
          { id: 'obey', when: { kind: 'check', checkId: 'contest', result: 'success' }, operations: [
            { id: 'obey', kind: 'command-owned-companion', target: 'target', command: 'dodge', sourceActivityId: 'summon', requiresSpeech: true }] },
          { id: 'refuse', when: { kind: 'check', checkId: 'contest', result: 'failure' }, operations: [
            { id: 'refuse', kind: 'end-owned-companion-control', target: 'target', sourceActivityId: 'summon', requiresSpeech: true, becomesHostile }] },
        ],
      }],
    }],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const token = (id: string): Token => ({ id, label: id, type: 'enemy', x: 0, y: 0, hp: 20, maxHp: 20, color: '', emoji: '', size: 1 })
    const companion: Token = { ...token('helper'), dnd5eSummon: { schemaVersion: 1, pluginId: namespace, featureId: 'summon',
      sourceCharacterId: 'owner-char', sourceTokenId: 'owner', createdRound: 1, expiresAfterRound: 100,
      side: 'player', concentrationId: 'summon-concentration', commandPolicy: 'persistent-order',
      ...(!becomesHostile ? { uncontrolledLinger: { count: 3, sides: 6, unit: 'minute' as const } } : {}) } }
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0,
      showGrid: true, tokens: [token('owner'), companion] }
    const initiativeOrder = [{ tokenId: 'owner', label: 'Owner', emoji: '', color: '', roll: 20 }, { tokenId: 'helper', label: 'Helper', emoji: '', color: '', roll: 10 }]
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'control', map, characters: [], initiativeOrder })
    const state = snapshot.state
    state.combatants.owner.pluginFeatureIds = [`${namespace}:order`]
    state.combatants.owner.skillProficiencies = [sourceSkill]
    state.combatants.helper.abilities.wis = 10
    state.combatants.helper.abilities.str = 8
    const original = structuredClone(state)
    const roll = (value: number | number[]) => ({ values: typeof value === 'number' ? [value] : value, modifier: 0, total: typeof value === 'number' ? value : value.reduce((sum, n) => sum + n, 0) })
    const rolls = (source: number | number[], defense: number | number[]) => ({ 'source:helper': roll(source), 'defense:helper': roll(defense) })
    const run = (current = state, source: number | number[] = 1, defense: number | number[] = 20) => resolveDnd5eHeadlessAction(current, { type: 'plugin', pluginId: namespace,
      actionId: 'order', featureId: `${namespace}:order`, actorId: 'owner', targetId: 'helper', targetIds: ['helper'], distanceFeet: 0, rolls: rolls(source, defense) })
    const success = run(state, 20, 1)
    expect(success.ok, JSON.stringify(success)).toBe(true)
    expect(success.state.combatants.helper.classState.companionCommand?.command).toBe('dodge')
    expect(run(state, 9, 10).state.combatants.helper.classState.companionCommand?.command).toBe('dodge')
    expect(run(state, 8, 10).state.combatants.helper.summonedSourceCombatantId).toBeUndefined()
    const advantaged = structuredClone(state)
    advantaged.combatants.owner.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'source-skill', label: 'Source',
      targetId: 'owner', source: { kind: 'feature', actorId: 'owner' }, duration: { type: 'permanent' },
      modifiers: { skillCheckAdvantages: [sourceSkill] } })]
    advantaged.combatants.helper.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'defender-skill', label: 'Defender',
      targetId: 'helper', source: { kind: 'feature', actorId: 'helper' }, duration: { type: 'permanent' },
      modifiers: { abilityCheckAdvantages: ['str'], skillCheckDisadvantages: ['insight'] } })]
    const activity = decoded.bundle.definitions[0].activities![0]
    const declarations = dnd5eActivityPerTargetRollDeclarationsV1({ activity,
      declarations: [{ id: 'source', label: 'Source', count: 2, sides: 20 }, { id: 'defense', label: 'Defense', count: 2, sides: 20 }],
      actor: advantaged.combatants.owner, targets: [advantaged.combatants.helper], combatants: advantaged.combatants,
      hostSavingThrowMode: () => 'normal', hostAttackRollMode: () => 'normal' })
    expect(declarations.find(d => d.id === 'source:helper')).toMatchObject({ count: 2, d20RollMode: 'advantage' })
    expect(declarations.find(d => d.id === 'defense:helper')).toMatchObject({ count: 2, d20RollMode: 'disadvantage' })
    for (const sourceSkill of ['unknown-skill', 'insight']) {
      const invalid = structuredClone(activity)
      invalid.checks = [{ ...invalid.checks![0], sourceSkill } as NonNullable<typeof invalid.checks>[number]]
      expect(validateDnd5eActivityDefinitionV1(invalid).some(error => error.includes('sourceSkill'))).toBe(true)
    }
    const requested: { id: string; count: number }[] = []
    const triggered = await rollDnd5eActivityTriggerDiceV1({ state: advantaged, actorId: 'owner', targetIds: ['helper'],
      available: { packageId: namespace, packageVersion: '1.0.0', activity, confirmation: 'automatic', retention: 'single-event' },
      triggerContext: { eventId: 'synthetic-hit', event: 'attack-hit', source: { kind: 'attack', id: 'attack', activityId: 'attack', mode: 'melee', result: 'hit' }, eligibleActorIds: ['owner'], eligibleTargetIds: ['helper'] },
      roll: async request => { requested.push({ id: request.id, count: request.count }); return [1, 20] },
    })
    expect(requested).toEqual([{ id: 'source:helper', count: 2 }, { id: 'defense:helper', count: 2 }])
    expect(triggered).toMatchObject({ checkRollModes: { 'contest:helper:source': 'advantage', 'contest:helper:target': 'disadvantage' } })
    const opposed = run(advantaged, [1, 20], [1, 20])
    expect(opposed.ok, JSON.stringify(opposed)).toBe(true)
    expect(opposed.events).toContainEqual(expect.objectContaining({ type: 'opposed-ability-check-resolved', sourceSkill,
      sourceD20: 20, targetSkill: 'insight', targetD20: 1, success: true }))
    const publicOpposed = resolveRegisteredDnd5eActivityInCombatV1({ state: advantaged, combatRevision: 1, confirmedBy: 'actor',
      authoritativeRolls: rolls([1, 20], [1, 20]), checkRollModes: { 'contest:helper:source': 'disadvantage', 'contest:helper:target': 'advantage' },
      command: { schemaVersion: 1, commandId: 'host-modes', actorId: 'owner', packageId: namespace, packageVersion: '1.0.0', activityId: 'order', targetIds: ['helper'], expectedRevision: 1 } })
    expect(publicOpposed.result.ok, JSON.stringify(publicOpposed)).toBe(true)
    if (publicOpposed.phase !== 'commit' || !publicOpposed.result.ok) throw Error('Opposed check did not commit')
    expect(publicOpposed.result.events).toContainEqual(expect.objectContaining({ type: 'opposed-ability-check-resolved', sourceD20: 20, targetD20: 1 }))
    for (const patch of [{ summonedSourceCombatantId: 'other' }, { summonedSourceActivityId: 'other' }, { summonedSourcePackageId: 'other.module' }, { summonedSourcePackageId: undefined }, { currentHp: 0 }]) {
      const illegal = structuredClone(state)
      Object.assign(illegal.combatants.helper, patch)
      const before = structuredClone(illegal)
      for (const [source, defense] of [[1, 20], [20, 1]]) {
        expect(run(illegal, source, defense).ok).toBe(false)
        const publicRejected = resolveRegisteredDnd5eActivityInCombatV1({ state: illegal, combatRevision: 1,
          confirmedBy: 'actor', authoritativeRolls: rolls(source, defense), command: {
            schemaVersion: 1, commandId: 'invalid-source', actorId: 'owner', packageId: namespace,
            packageVersion: '1.0.0', activityId: 'order', targetIds: ['helper'], expectedRevision: 1,
          } })
        expect(publicRejected.result.ok).toBe(false)
      }
      expect(illegal).toEqual(before)
    }
    const failed = run(success.state)
    expect(failed.ok, JSON.stringify(failed)).toBe(true)
    expect(failed.state.combatants.helper.summonedSourceCombatantId).toBeUndefined()
    expect(failed.state.combatants.helper.classState.companionCommand).toBeUndefined()
    expect(failed.state.combatants.helper.controller).toBe('dm')
    expect(run(failed.state, 20, 1).ok).toBe(false)
    const publicResult = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: rolls(1, 20),
      command: { schemaVersion: 1, commandId: 'refuse', actorId: 'owner', packageId: namespace, packageVersion: '1.0.0', activityId: 'order', targetIds: ['helper'], expectedRevision: 1 } })
    expect(publicResult.result.ok, JSON.stringify(publicResult)).toBe(true)
    if (publicResult.phase !== 'commit' || !publicResult.result.ok) throw Error('Control loss did not commit')
    expect(publicResult.result.state.combatants.helper.summonedSourceCombatantId).toBeUndefined()
    const plan = planDnd5eMapResultApplication({ ...snapshot, state: failed.state, events: [...failed.events], map, characters: [] })
    const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [plan.map] }))).maps[0]
    expect(restored.tokens.find(t => t.id === 'helper')?.dnd5eSummon).toMatchObject({ controlEnded: true, concentrationId: 'summon-concentration', side: becomesHostile ? 'enemy' : 'player' })
    const reload = createDnd5eMapCombatSnapshot({ combatId: 'control', map: restored, characters: [], initiativeOrder })
    reload.state.combatants.owner.pluginFeatureIds = [`${namespace}:order`]
    expect(run(reload.state, 20, 1).ok).toBe(false)
    const ended = removeCharacterConcentrationEffectsFromMaps({ maps: [restored] }, 'owner-char', '', [], {
      round: 2, worldMinute: 480, lingerRollsByTokenId: { helper: [2, 3, 4] },
    })
    if (!becomesHostile) {
      expect(ended.next.maps[0].tokens.find(t => t.id === 'helper')?.dnd5eSummon)
        .toMatchObject({ concentrationId: undefined, lingerRolls: [2, 3, 4], dismissAtWorldMinute: 489 })
      expect(expireDnd5eSummonLingerAtWorldMinute(ended.next.maps[0], 488).tokens).toHaveLength(2)
      expect(expireDnd5eSummonLingerAtWorldMinute(ended.next.maps[0], 489).tokens).toHaveLength(1)
    } else expect(ended.next.maps[0].tokens).toHaveLength(1)
    expect(state).toEqual(original)
  } finally { dispose() }
})
