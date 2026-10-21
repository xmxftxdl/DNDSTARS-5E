import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { registerDnd5eActivityPackage, clearDnd5eActivityRegistryForTests } from './dnd5eActivityRegistry'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import { applyDnd5eActivityMapHandoffsV1 } from './dnd5eActivityMapInteraction'
import { synchronizeDnd5eActivityMapMovement } from './dnd5eActivityMapMovementEvents'
import type { BattleMap } from '../../../store/maps'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

it.each((['accepted', 'declined', 'no-reaction', 'wrong-source', 'handoff-failed', 'removed'] as const)
  .flatMap(mode => (['owned', 'effect'] as const).map(entitlement => ({ mode, entitlement }))))(
  'settles a temporary-HP recipient reaction atomically (%j)', async ({ mode, entitlement }) => {
    const packageId = 'test.recipient-reaction'
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: packageId, name: 'Synthetic recipient reaction', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0' },
      setup(api) { api.registerFeature({ id: 'move', name: 'Move', summary: 'Test', description: 'Test', automation: 'full' }) },
    })
    registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [{
      schemaVersion: 1, id: 'move', name: 'Move', activation: { kind: 'reaction' },
      requiresEffectGrant: entitlement === 'effect' ? true : undefined,
      legacySource: { kind: 'feature', id: 'move' }, automation: automationCapabilityFromLegacyStatus('full'),
      invocation: { kind: 'triggered', event: 'temporary-hit-points-gained', confirmation: 'actor-choice', retention: 'single-event' },
      target: { kind: 'self' }, requirements: [{ kind: 'event-source', source: 'combat', sourceId: 'test:grant' },
        { kind: 'action-economy-available', economy: 'reaction' }],
      consumption: [{ kind: 'action-economy', economy: 'reaction', amount: 1, consumeOn: 'resolve' }],
      outcomes: [{ id: 'move', when: { kind: 'always' }, operations: [{ id: 'move', kind: 'move', target: 'actor',
        mode: 'forced', distanceFeet: { kind: 'reference', reference: { kind: 'actor-speed' } },
        ignoresOpportunityAttacks: true, provokesOpportunityAttacks: false }] }],
    }] })
    try {
      const actors = ['caster', 'recipient'].map((id, index) => createDnd5eCombatant({ id, name: id,
        controller: 'player', initiative: 20 - index, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
        proficiencyBonus: 3, armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0,
        speed: 30, position: { x: index ? 275 : 75, y: 75 }, concentrating: false,
        pluginFeatureIds: index && entitlement === 'owned' && mode !== 'removed' ? [`${packageId}:move`] : [] }))
      const initial = startDnd5eHeadlessCombat('recipient-move', actors)
      initial.combatants.recipient.turn.reactionAvailable = mode !== 'no-reaction'
      const hasGrant = entitlement === 'effect' && mode !== 'removed'
      const grantActivity: Dnd5eActivityDefinitionV1 = {
        schemaVersion: 1, id: 'test:grant', name: 'Synthetic grant', activation: { kind: 'free' },
        automation: automationCapabilityFromLegacyStatus('full'),
        target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 },
        effects: hasGrant ? [{ schemaVersion: 1, id: 'reaction-grant', name: 'One-use grant',
          grants: ['move'], grantsSingleUse: true, stacking: 'replace', modifiers: [],
          duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' } }] : [],
        outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [
          ...(hasGrant ? [{ id: 'effect', kind: 'apply-effect' as const, target: 'target' as const, effectId: 'reaction-grant' }] : []),
          { id: 'pool', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 5 } },
        ] }],
      }
      // Exercise wire serialization and canonical validation, not an engine-created effect.
      const imported = JSON.parse(JSON.stringify(grantActivity)) as Dnd5eActivityDefinitionV1
      expect(validateDnd5eActivityDefinitionV1(imported)).toEqual([])
      if (hasGrant) {
        for (const invalid of [{ grantsSingleUse: false }, { grants: undefined }, { grants: [] }]) {
          const malformed = structuredClone(imported)
          Object.assign(malformed.effects![0], invalid)
          expect(validateDnd5eActivityDefinitionV1(malformed).some(error => error.includes('grantsSingleUse'))).toBe(true)
        }
      }
      const resolution = resolveDnd5eActivity({ activity: imported,
        actor: dnd5eActivityActorSnapshotFromCombatantV1(initial.combatants.caster),
        targets: [dnd5eActivityActorSnapshotFromCombatantV1(initial.combatants.recipient)],
        rolls: {}, distanceFeetByTargetId: { recipient: 20 } })
      const grant = commitDnd5eActivityExecution(initial, { actorId: 'caster', targetIds: ['recipient'],
        activityId: mode === 'wrong-source' ? 'test:other' : 'test:grant',
        source: { kind: 'feature', id: 'test:grant', packageId }, resolution })
      expect(grant.ok).toBe(true)
      const original: BattleMap = { id: 'reaction-map', name: 'Map', width: 1000, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
        tokens: actors.map(actor => ({ id: actor.id, label: actor.id, type: 'player', color: '#fff', emoji: '', size: 1,
          x: actor.position.x, y: actor.position.y })) }
      let workingMap = original, prompts = 0, handoffs = 0
      const result = await settleDnd5eActivityTriggerWindowsV1({ state: grant.state, combatRevision: 1,
        events: grant.events, eventBatchId: 'grant-1', roll: async () => [], confirm: async request => {
          prompts++
          expect(request.actorId).toBe('recipient')
          expect(request.targetIds).toEqual(['recipient'])
          return mode !== 'declined'
        }, settleMapHandoffs: async request => {
          handoffs++
          expect(request.committed.state.combatants.recipient.turn.reactionAvailable).toBe(false)
          if (mode === 'handoff-failed') return { ok: false, reason: 'test-revision-conflict' }
          const movements = request.committed.activityHandoffs!.movements
          expect(movements).toEqual([expect.objectContaining({ targetId: 'recipient', distanceFeet: 30,
            ignoresOpportunityAttacks: true, provokesOpportunityAttacks: false })])
          const applied = applyDnd5eActivityMapHandoffsV1({ map: workingMap, activity: request.activity,
            packageId, actionId: request.receiptId, actorId: 'recipient', round: 1,
            handoffs: request.committed.activityHandoffs!, selection: { movementCellsByOperationId: { move: { col: 7, row: 1 } } } })
          if (!applied.ok) return applied
          expect(applied.movementPaths.every(path => !path.provokesOpportunityAttacks)).toBe(true)
          request.committed.events = synchronizeDnd5eActivityMapMovement({ before: workingMap, after: applied.map,
            actorId: 'recipient', activityId: 'move', movements, state: request.committed.state, events: request.committed.events })
          workingMap = applied.map
          return { ok: true }
        } })
      const accepted = mode === 'accepted'
      expect(result.state.combatants.recipient.position.x, JSON.stringify(result.diagnostics)).toBe(accepted ? 375 : 275)
      expect(workingMap.tokens[1].x).toBe(accepted ? 375 : 275)
      expect(result.state.combatants.recipient.turn.reactionAvailable).toBe(!accepted && mode !== 'no-reaction')
      expect(result.state.combatants.caster.turn.reactionAvailable).toBe(true)
      expect(result.state.combatants.recipient.temporaryHp).toBe(5)
      expect(prompts).toBe(mode === 'wrong-source' || mode === 'no-reaction' || mode === 'removed' ? 0 : 1)
      expect(handoffs).toBe(accepted || mode === 'handoff-failed' ? 1 : 0)
      expect(initial.combatants.recipient.temporaryHp).toBe(0)
      expect(original.tokens[1].x).toBe(275)
      if (mode === 'declined') {
        const replay = await settleDnd5eActivityTriggerWindowsV1({ state: JSON.parse(JSON.stringify(result.state)),
          combatRevision: result.combatRevision, events: grant.events, eventBatchId: 'grant-1', roll: async () => [],
          confirm: async () => { throw Error('An explicitly declined event must not ask again after reload') },
          settleMapHandoffs: async () => { throw Error('A declined event must not move on replay') } })
        expect(replay.state.combatants.recipient.position.x).toBe(275)
        expect(replay.state.combatants.recipient.turn.reactionAvailable).toBe(true)
        expect(replay.state.combatants.recipient.temporaryHp).toBe(5)
        expect(replay.combatRevision).toBe(result.combatRevision)
        expect(replay.events).toEqual([])
        expect(grant.state.combatants.recipient.classState.activityTriggerReceipts).toBeUndefined()
      }
      if (entitlement === 'effect') {
        expect((result.state.combatants.recipient.classState.activeEffects ?? []).some(effect => effect.definitionId.includes(':reaction-grant:')))
          .toBe(!accepted && mode !== 'removed')
        if (mode === 'declined') {
          const casterEnd = resolveDnd5eHeadlessAction(result.state, { type: 'end-turn', actorId: 'caster' })
          expect(casterEnd.ok).toBe(true)
          const recipientEnd = resolveDnd5eHeadlessAction(casterEnd.state, { type: 'end-turn', actorId: 'recipient' })
          expect(recipientEnd.ok).toBe(true)
          expect((recipientEnd.state.combatants.recipient.classState.activeEffects ?? [])
            .some(effect => effect.definitionId.includes(':reaction-grant:'))).toBe(false)
          expect(recipientEnd.state.combatants.recipient.temporaryHp).toBe(5)
          const expired = await settleDnd5eActivityTriggerWindowsV1({ state: recipientEnd.state, combatRevision: 3,
            events: grant.events, eventBatchId: 'new-event-after-expiry', roll: async () => [],
            confirm: async () => { throw Error('Expired grant must not offer movement') },
          })
          expect(expired.diagnostics).toEqual([])
        }
      }
      if (accepted) {
        const persisted = JSON.parse(JSON.stringify(result.state)) as typeof result.state
        // Renew the reaction so the event receipt or consumed grant must prevent a replay.
        persisted.combatants.recipient.turn.reactionAvailable = true
        const replay = await settleDnd5eActivityTriggerWindowsV1({ state: persisted, combatRevision: result.combatRevision,
          events: grant.events, eventBatchId: 'grant-1', roll: async () => [],
          confirm: async () => { throw Error('Settled event must not prompt twice') },
          settleMapHandoffs: async () => { throw Error('Settled event must not move twice') },
        })
        expect(replay.state.combatants.recipient.position.x).toBe(375)
        expect(replay.state.combatants.recipient.turn.reactionAvailable).toBe(true)
        expect(replay.events).toEqual([])
      }
    } finally { clearDnd5eActivityRegistryForTests(); dispose() }
  })
