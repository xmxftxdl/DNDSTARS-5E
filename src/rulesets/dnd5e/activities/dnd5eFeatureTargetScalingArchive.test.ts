import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { registerDnd5eRulesPlugin, registeredDnd5ePluginFeatures } from '../pluginApi'
import { applyDnd5eStandardConditionEffect, createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { dnd5eFeatureActivityControls } from './dnd5eFeatureActivityControls'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { BattleMap } from '../../../store/maps'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import { listDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerWindows'
import { applyDnd5eActivityMapHandoffsV1 } from './dnd5eActivityMapInteraction'
import { synchronizeDnd5eActivityMapMovement } from './dnd5eActivityMapMovementEvents'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'

it.each([{ cha: 6, bard: 3, count: 1, hp: 5 }, { cha: 12, bard: 5, count: 1, hp: 8 }, { cha: 16, bard: 10, count: 3, hp: 11 },
  { cha: 20, bard: 15, count: 5, hp: 14 }])('keeps installed feature control and Host limits aligned: %j', async scenario => {
  const namespace = 'test.scaled-benefit'
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'benefit', name: 'Synthetic benefit',
    activation: { kind: 'bonus-action' }, legacySource: { kind: 'feature', id: 'benefit' },
    automation: automationCapabilityFromLegacyStatus('full'),
    consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' },
      { kind: 'resource', resourceId: 'dnd5e-bardic-inspiration', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
    target: { kind: 'creature', count: 1, relation: 'ally', rangeFeet: 60, requiresLineOfSight: true, requiresTargetSeeActor: true },
    scaling: [{ basis: 'ability-modifier', ability: 'cha', baseLevel: 1,
      adjustments: [{ operationId: 'pool', additionalTargetsPerStep: 1 }] },
      { basis: 'custom-table', classId: 'bard', table: [{ level: 5, value: 1 }, { level: 10, value: 2 }, { level: 15, value: 3 }],
        adjustments: [{ operationId: 'pool', flatAmountPerStep: 3 }] }],
    effects: [{ schemaVersion: 1, id: 'step-grant', name: 'Synthetic step', grants: ['step'], grantsSingleUse: true,
      stacking: 'replace', modifiers: [], duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' } }],
    outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [
      { id: 'grant-step', kind: 'apply-effect', target: 'target', effectId: 'step-grant' }, { id: 'pool', kind: 'temporary-hit-points',
      target: 'target', amount: { kind: 'constant', value: 5 } }] }],
  }
  const step: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'step', name: 'Synthetic reaction movement',
    activation: { kind: 'reaction' }, legacySource: { kind: 'feature', id: 'benefit' },
    automation: activity.automation, requiresEffectGrant: true, target: { kind: 'self' },
    invocation: { kind: 'triggered', event: 'temporary-hit-points-gained', confirmation: 'actor-choice', retention: 'single-event', releaseSingleUseGrantOnDecline: true, effectGrantScope: 'trigger-execution', expireGrantAtWindowEnd: true },
    requirements: [{ kind: 'action-economy-available', economy: 'reaction' },
      { kind: 'event-source', source: 'combat', sourceId: `${namespace}:benefit` }],
    consumption: [{ kind: 'action-economy', economy: 'reaction', amount: 1, consumeOn: 'resolve' }],
    outcomes: [{ id: 'step', when: { kind: 'always' }, operations: [{ id: 'step', kind: 'move', target: 'actor',
      mode: 'voluntary', distanceFeet: { kind: 'reference', reference: { kind: 'actor-speed' } }, ignoresOpportunityAttacks: true }] }],
  }
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic scaling', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'benefit',
      name: 'Synthetic benefit', automation: activity.automation, activities: [activity, step],
      payload: { id: 'benefit', name: 'Synthetic benefit', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }] }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const actors = Array.from({ length: scenario.count + 2 }, (_, i) => createDnd5eCombatant({ id: `actor-${i}`, name: `Actor ${i}`,
      initiative: 30 - i, controller: 'player', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: scenario.cha },
      proficiencyBonus: 6, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0,
      speed: 30, position: { x: 25 + i * 50, y: 75 }, concentrating: false, pluginFeatureIds: i ? [] : [`${namespace}:benefit`] }))
    const state = startDnd5eHeadlessCombat('scaling-check', actors)
    const owner = state.combatants['actor-0']
    owner.level = 20
    owner.classLevels = { bard: scenario.bard, fighter: 20 - scenario.bard }
    owner.classResources['dnd5e-bardic-inspiration'] = { current: 2, max: 2 }
    const feature = registeredDnd5ePluginFeatures().find(entry => entry.id === `${namespace}:benefit`)!
    const control = dnd5eFeatureActivityControls(feature, { actor: owner })[0]
    expect(control.action.targeting).toMatchObject(scenario.count === 1 ? { kind: 'single-creature' } :
      { kind: 'multiple-creatures', maximumTargets: scenario.count })
    state.distanceFeetByCombatantPair = Object.fromEntries(actors.slice(1).map(a => [dnd5eCombatantPairKey(owner.id, a.id), 5]))
    const run = (count: number) => resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace,
      actionId: 'benefit', featureId: feature.id, actorId: owner.id, targetId: actors[1].id, targetIds: actors.slice(1, count + 1).map(a => a.id),
      distanceFeet: 5, rolls: {}, payload: { maximumTargets: 99, charisma: 30 } })
    const runDirect = () => resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
      command: { schemaVersion: 1, commandId: 'direct-benefit', actorId: owner.id, packageId: namespace,
        packageVersion: '1.0.0', activityId: 'benefit', targetIds: actors.slice(1, scenario.count + 1).map(a => a.id), expectedRevision: 1 },
      authoritativeRolls: {}, confirmedBy: 'actor' })
    for (const blindId of [owner.id, actors[1].id]) {
      const prior = state.combatants[blindId].conditions
      const priorEffects = state.combatants[blindId].classState.activeEffects
      applyDnd5eStandardConditionEffect(state.combatants[blindId], owner, { rulesId: 'test-blind', condition: 'blinded', duration: { type: 'permanent' } }, [])
      const rejected = run(scenario.count)
      expect(rejected.ok, `mutual sight ${blindId}`).toBe(false)
      expect(rejected.state.combatants[owner.id].classResources['dnd5e-bardic-inspiration'].current).toBe(2)
      expect(rejected.state.combatants[owner.id].turn.bonusActionAvailable).toBe(true)
      expect(runDirect().result.ok, `direct mutual sight ${blindId}`).toBe(false)
      state.combatants[blindId].conditions = prior
      state.combatants[blindId].classState.activeEffects = priorEffects
    }
    const overflow = run(scenario.count + 1)
    expect(overflow.ok).toBe(false)
    expect(overflow.state.combatants[owner.id].turn.bonusActionAvailable).toBe(true)
    expect(overflow.state.combatants[owner.id].classResources['dnd5e-bardic-inspiration'].current).toBe(2)
    owner.classResources['dnd5e-bardic-inspiration'].current = 0
    const exhausted = run(scenario.count)
    expect(exhausted.ok).toBe(false)
    expect(exhausted.state.combatants[owner.id].turn.bonusActionAvailable).toBe(true)
    expect(exhausted.events).toEqual([])
    expect(runDirect().result.ok).toBe(false)
    owner.classResources['dnd5e-bardic-inspiration'].current = 2
    owner.classLevels = { fighter: 20 }
    const wrongClass = run(scenario.count)
    expect(wrongClass.ok).toBe(false)
    expect(runDirect().result.ok).toBe(false)
    expect(wrongClass.state.combatants[owner.id].classResources['dnd5e-bardic-inspiration'].current).toBe(2)
    owner.classLevels = { bard: scenario.bard, fighter: 20 - scenario.bard }
    const direct = runDirect()
    expect(direct.result.ok).toBe(true)
    if (direct.phase !== 'commit' || !direct.result.ok) throw Error('Direct benefit failed')
    expect(direct.result.state.combatants[owner.id].classResources['dnd5e-bardic-inspiration'].current).toBe(1)
    const directExecution = direct.result.state.combatants[actors[1].id].classState.activeEffects!.find(effect => effect.grantedActivities?.includes('step'))!.source.executionId
    expect(directExecution).toBeTruthy()
    expect(direct.result.events.find(event => event.type === 'temporary-hit-points-gained')).toMatchObject({ source: { executionId: directExecution } })
    const accepted = run(scenario.count)
    expect(accepted.ok, JSON.stringify(accepted)).toBe(true)
    expect(accepted.state.combatants[owner.id].turn.bonusActionAvailable).toBe(false)
    expect(accepted.state.combatants[owner.id].classResources['dnd5e-bardic-inspiration'].current).toBe(1)
    const grantExecution = accepted.state.combatants[actors[1].id].classState.activeEffects!.find(effect => effect.grantedActivities?.includes('step'))!.source.executionId
    expect(grantExecution).toBeTruthy()
    expect(accepted.events.find(event => event.type === 'temporary-hit-points-gained')).toMatchObject({ source: { executionId: grantExecution } })
    const restoredGrant = JSON.parse(JSON.stringify(accepted.state)) as typeof state
    expect(restoredGrant.combatants[actors[1].id].classState.activeEffects!.find(effect => effect.grantedActivities?.includes('step'))!.source.executionId).toBe(grantExecution)
    const nextCast = run(scenario.count)
    expect(nextCast.ok).toBe(true)
    expect(nextCast.state.combatants[actors[1].id].classState.activeEffects!.find(effect => effect.grantedActivities?.includes('step'))!.source.executionId).not.toBe(grantExecution)
    const stale = await settleDnd5eActivityTriggerWindowsV1({ state: nextCast.state, events: [...accepted.events],
      eventBatchId: 'old-event-new-grant', combatRevision: 1, roll: async () => [],
      confirm: async () => { throw Error('Old events cannot use a newer grant') } })
    expect(stale.state).toEqual(nextCast.state)
    const unavailable = structuredClone(accepted.state)
    for (const recipient of actors.slice(1, scenario.count + 1)) unavailable.combatants[recipient.id].turn.reactionAvailable = false
    const closed = await settleDnd5eActivityTriggerWindowsV1({ state: unavailable, events: [...accepted.events],
      eventBatchId: 'no-reaction', combatRevision: 1, roll: async () => [],
      confirm: async () => { throw Error('No reaction is available') } })
    for (const recipient of actors.slice(1, scenario.count + 1)) {
      expect((closed.state.combatants[recipient.id].classState.activeEffects ?? []).some(effect => effect.grantedActivities?.includes('step'))).toBe(false)
      expect(closed.state.combatants[recipient.id].temporaryHp).toBe(scenario.hp)
      expect(unavailable.combatants[recipient.id].classState.activeEffects?.some(effect => effect.grantedActivities?.includes('step'))).toBe(true)
    }
    const later = JSON.parse(JSON.stringify(closed.state)) as typeof state
    later.round += 1
    for (const actor of Object.values(later.combatants)) actor.turn.reactionAvailable = true
    const lateReplay = await settleDnd5eActivityTriggerWindowsV1({ state: later, events: [...accepted.events],
      eventBatchId: 'later-round', combatRevision: closed.combatRevision, roll: async () => [],
      confirm: async () => { throw Error('Expired immediate choices must not return') } })
    expect(lateReplay.state).toEqual(later)
    const capped = await settleDnd5eActivityTriggerWindowsV1({ state: accepted.state, events: [...accepted.events],
      eventBatchId: 'capped', combatRevision: 1, maximumResolutions: 0, roll: async () => [],
      confirm: async () => { throw Error('Budget is exhausted') } })
    expect(capped.state).toEqual(accepted.state)
    for (const preservedKind of ['ongoing', 'shared'] as const) {
      const preserved = structuredClone(unavailable)
      for (const recipient of actors.slice(1, scenario.count + 1)) {
        const effect = preserved.combatants[recipient.id].classState.activeEffects![0]
        if (preservedKind === 'ongoing') delete effect.grantedActivitiesSingleUse
        else effect.grantedActivities = [...effect.grantedActivities!, 'ordinary-follow-up']
      }
      const result = await settleDnd5eActivityTriggerWindowsV1({ state: preserved, events: [...accepted.events],
        eventBatchId: `preserve-${preservedKind}`, combatRevision: 1, roll: async () => [],
        confirm: async () => { throw Error('No reaction is available') } })
      expect(result.state).toEqual(preserved)
    }
    const legacyGrantState = structuredClone(accepted.state)
    for (const actor of Object.values(legacyGrantState.combatants)) {
      for (const effect of actor.classState.activeEffects ?? []) delete effect.source.executionId
    }
    expect(listDnd5eActivityTriggerWindowsV1({ state: legacyGrantState, events: accepted.events,
      eventBatchId: 'legacy-missing-provenance' })).toEqual([])
    const originalWindow = listDnd5eActivityTriggerWindowsV1({ state: accepted.state,
      events: accepted.events, eventBatchId: 'original' }).find(window => window.triggerContext.eligibleActorIds.includes(actors[1].id))!
    expect(originalWindow).toBeTruthy()
    const staleDirect = resolveRegisteredDnd5eActivityInCombatV1({ state: nextCast.state, combatRevision: 1,
      triggerContext: originalWindow.triggerContext, confirmedBy: 'actor', authoritativeRolls: {},
      command: { schemaVersion: 1, commandId: 'stale-step', actorId: actors[1].id, packageId: namespace,
        packageVersion: '1.0.0', activityId: 'step', targetIds: [actors[1].id], expectedRevision: 1,
        triggerEventId: originalWindow.triggerContext.eventId } })
    expect(staleDirect.result.ok).toBe(false)
    const forgedPlugin = resolveDnd5eHeadlessAction(accepted.state, { type: 'plugin', pluginId: namespace,
      actionId: 'step', actorId: actors[1].id, targetId: actors[1].id, rolls: {},
      hostEntitlement: { kind: 'active-effect', effectId: accepted.state.combatants[actors[1].id].classState.activeEffects![0].id } })
    expect(forgedPlugin.ok).toBe(false)
    expect(forgedPlugin.events).toEqual([])
    const simultaneous = structuredClone(accepted.state)
    for (const recipient of actors.slice(1, scenario.count + 1)) {
      const effects = simultaneous.combatants[recipient.id].classState.activeEffects!
      effects.unshift({ ...structuredClone(effects[0]), id: `${effects[0].id}-newer`,
        source: { ...effects[0].source, executionId: 'another-execution' } })
    }
    const declined = await settleDnd5eActivityTriggerWindowsV1({ state: simultaneous, events: [...accepted.events],
      eventBatchId: 'precise-decline', combatRevision: 1, roll: async () => [], confirm: async () => false })
    for (const recipient of actors.slice(1, scenario.count + 1)) {
      const effects = declined.state.combatants[recipient.id].classState.activeEffects!
      expect(effects.filter(effect => effect.grantedActivities?.includes('step')).map(effect => effect.source.executionId)).toEqual(['another-execution'])
      expect(declined.state.combatants[recipient.id].turn.reactionAvailable).toBe(true)
    }
    const exactSuccess = resolveRegisteredDnd5eActivityInCombatV1({ state: simultaneous, combatRevision: 1,
      triggerContext: originalWindow.triggerContext, confirmedBy: 'actor', authoritativeRolls: {},
      command: { schemaVersion: 1, commandId: 'exact-step', actorId: actors[1].id, packageId: namespace,
        packageVersion: '1.0.0', activityId: 'step', targetIds: [actors[1].id], expectedRevision: 1,
        triggerEventId: originalWindow.triggerContext.eventId } })
    expect(exactSuccess.result.ok).toBe(true)
    if (exactSuccess.phase !== 'commit' || !exactSuccess.result.ok) throw Error('Exact grant did not resolve')
    expect(exactSuccess.result.state.combatants[actors[1].id].classState.activeEffects!
      .filter(effect => effect.grantedActivities?.includes('step')).map(effect => effect.source.executionId)).toEqual(['another-execution'])
    for (const actor of actors.slice(1, scenario.count + 1)) expect(accepted.state.combatants[actor.id].temporaryHp).toBe(scenario.hp)
    expect(accepted.state.combatants[actors.at(-1)!.id].temporaryHp).toBe(0)
    expect(state.combatants[owner.id].turn.bonusActionAvailable).toBe(true)
    let map: BattleMap = { id: 'scaled-map', name: 'Map', width: 1000, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: actors.map(actor => ({ id: actor.id, label: actor.name, type: 'player', color: '#fff', emoji: '', size: 1, ...actor.position })) }
    const prompted: string[] = []
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state: accepted.state, events: [...accepted.events],
      eventBatchId: 'scaled-benefit', combatRevision: 1, roll: async () => [], confirm: async request => {
        prompted.push(request.actorId)
        return request.actorId !== 'actor-2'
      }, settleMapHandoffs: async request => {
        // A failed map transaction for one recipient must not prevent later recipients.
        if (request.actorId === 'actor-3') return { ok: false, reason: 'synthetic-map-conflict' }
        const col = Number(request.actorId.split('-')[1])
        const movements = request.committed.activityHandoffs!.movements
        const applied = applyDnd5eActivityMapHandoffsV1({ map, activity: request.activity, packageId: namespace,
          actorId: request.actorId, actionId: request.receiptId, round: 1, handoffs: request.committed.activityHandoffs!,
          selection: { movementCellsByOperationId: { step: { col, row: 2 } } } })
        if (!applied.ok) return applied
        expect(applied.movementPaths.every(path => !path.provokesOpportunityAttacks)).toBe(true)
        request.committed.events = synchronizeDnd5eActivityMapMovement({ before: map, after: applied.map,
          actorId: request.actorId, activityId: 'step', movements, state: request.committed.state, events: request.committed.events })
        map = applied.map
        return { ok: true }
      } })
    expect(prompted.sort()).toEqual(actors.slice(1, scenario.count + 1).map(actor => actor.id).sort())
    expect(settled.state.combatants[owner.id].classResources['dnd5e-bardic-inspiration'].current).toBe(1)
    for (const [index, actor] of actors.entries()) {
      const moved = index >= 1 && index <= scenario.count && index !== 2 && index !== 3
      const final = settled.state.combatants[actor.id]
      expect(final.position.y, JSON.stringify(settled.diagnostics)).toBe(moved ? 125 : 75)
      expect(final.turn.reactionAvailable).toBe(!moved)
      if (index >= 1 && index <= scenario.count) {
        expect(final.temporaryHp).toBe(scenario.hp)
        expect((final.classState.activeEffects ?? []).some(effect => effect.grantedActivities?.includes('step'))).toBe(false)
      }
    }
    const unrelatedEvents = accepted.events.map(event => event.type === 'temporary-hit-points-gained' ?
      { ...event, source: { actorId: owner.id, rulesId: 'other:benefit' } } : event)
    const unrelated = await settleDnd5eActivityTriggerWindowsV1({ state: JSON.parse(JSON.stringify(settled.state)),
      events: unrelatedEvents, eventBatchId: 'unrelated-grant', combatRevision: settled.combatRevision,
      roll: async () => [], confirm: async () => { throw Error('Other temporary HP must not offer this reaction') } })
    expect(unrelated.state.combatants).toEqual(settled.state.combatants)
  } finally { dispose() }
}, 20_000)
