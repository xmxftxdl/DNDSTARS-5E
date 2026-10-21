import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { BattleMap } from '../../../store/maps'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../../lib/mapGeometry'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { applyDnd5eActivityMapHandoffsV1 } from './dnd5eActivityMapInteraction'
import { synchronizeDnd5eActivityMapMovement } from './dnd5eActivityMapMovementEvents'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'

// Synthetic local recipe: proves the reusable archive/runtime path, not AI conversion.
it.each(['accepted', 'faster', 'too-far', 'terrain', 'declined', 'map-failed', 'spent-reaction'] as const)(
  'imports and settles half-speed observer movement atomically: %s', async mode => {
    const packageId = 'test.observer-movement'
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'move', name: 'Observer movement', activation: { kind: 'reaction' },
      legacySource: { kind: 'feature', id: 'move' }, automation: automationCapabilityFromLegacyStatus('full'),
      invocation: { kind: 'triggered', event: 'other-turn-end', confirmation: 'actor-choice', retention: 'single-event' },
      target: { kind: 'creature', count: 1, relation: 'enemy', rangeFeet: 5 },
      requirements: [{ kind: 'combat-active' }, { kind: 'action-economy-available', economy: 'reaction' }],
      consumption: [{ kind: 'action-economy', economy: 'reaction', amount: 1, consumeOn: 'resolve' }],
      outcomes: [{ id: 'move', when: { kind: 'always' }, operations: [{ id: 'move', kind: 'move', target: 'actor',
        mode: 'voluntary', distanceFeet: { kind: 'multiply', values: [
          { kind: 'reference', reference: { kind: 'actor-speed' } }, { kind: 'constant', value: 0.5 } ] },
        ignoresOpportunityAttacks: true, provokesOpportunityAttacks: false }] }],
    }
    const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [], manifest: { id: packageId,
      name: 'Observer movement test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, definitions: [{ schemaVersion: 1, id: 'move', namespace: packageId, version: '1.0.0',
      kind: 'feature', name: 'Observer movement', activities: [activity], automation: activity.automation,
      payload: { id: 'move', name: 'Observer movement', summary: 'Synthetic reaction', description: 'Synthetic reaction', automation: 'full' } }] }
    const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      const actors = ['enemy', 'holder'].map((id, i) => createDnd5eCombatant({ id, name: id,
        controller: i ? 'player' : 'dm', initiative: 20 - i,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        proficiencyBonus: 2, armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0,
        speed: mode === 'faster' && i ? 40 : 30, position: { x: i ? 125 : 75, y: 75 },
        concentrating: false, pluginFeatureIds: i ? [`${packageId}:move`] : [] }))
      const initial = startDnd5eHeadlessCombat('observer-movement', actors)
      initial.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('enemy', 'holder')]: 5 }
      const ended = resolveDnd5eHeadlessAction(initial, { type: 'end-turn', actorId: 'enemy' })
      expect(ended.ok).toBe(true)
      ended.state.combatants.holder.turn.reactionAvailable = mode !== 'spent-reaction'
      const original: BattleMap = { id: 'observer-map', name: 'Map', width: 1000, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: actors.map(actor => ({ id: actor.id, label: actor.name, type: 'player', color: '#fff',
          emoji: '', size: 1, ...actor.position })) }
      let map = original, prompts = 0, handoffs = 0
      if (mode === 'terrain') {
        const geometry = createEmptyMapGeometry(original.id)
        geometry.obstacles.push({ id: 'rough', kind: 'obstacle', label: 'Rough ground',
          points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 500 }, { x: 0, y: 500 }],
          blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
          baseHeightFeet: 0, heightFeet: 0, terrainCostMultiplier: 2, traversal: 'ground', createdAt: 1 })
        setMapGeometryRuntime([geometry])
      }
      const result = await settleDnd5eActivityTriggerWindowsV1({ state: ended.state, combatRevision: 1,
        events: [...ended.events], eventBatchId: 'enemy-end', roll: async () => [],
        confirm: async request => { prompts++; expect(request.actorId).toBe('holder');
          expect(request.targetIds).toEqual(['enemy']); return mode !== 'declined' },
        settleMapHandoffs: async request => {
          handoffs++
          if (mode === 'map-failed') return { ok: false, reason: 'synthetic-conflict' }
          const movements = request.committed.activityHandoffs!.movements
          expect(movements).toEqual([expect.objectContaining({ targetId: 'holder',
            distanceFeet: mode === 'faster' ? 20 : 15, ignoresOpportunityAttacks: true })])
          const applied = applyDnd5eActivityMapHandoffsV1({ map, activity: request.activity, packageId,
            actorId: 'holder', actionId: request.receiptId, round: 1, handoffs: request.committed.activityHandoffs!,
            selection: { movementCellsByOperationId: { move: { col: mode === 'faster' || mode === 'too-far' ? 6 : 5, row: 1 } } } })
          if (!applied.ok) return applied
          expect(applied.movementPaths.every(path => !path.provokesOpportunityAttacks)).toBe(true)
          request.committed.events = synchronizeDnd5eActivityMapMovement({ before: map, after: applied.map,
            actorId: 'holder', activityId: 'move', movements, state: request.committed.state, events: request.committed.events })
          map = applied.map
          return { ok: true }
        } })
      const accepted = mode === 'accepted' || mode === 'faster'
      const expectedX = mode === 'faster' ? 325 : accepted ? 275 : 125
      expect(result.state.combatants.holder.position.x, JSON.stringify(result.diagnostics)).toBe(expectedX)
      expect(map.tokens[1].x).toBe(expectedX)
      expect(original.tokens[1].x).toBe(125)
      expect(result.state.combatants.holder.turn.reactionAvailable).toBe(!accepted && mode !== 'spent-reaction')
      expect(prompts).toBe(mode === 'spent-reaction' ? 0 : 1)
      expect(handoffs).toBe(mode === 'declined' || mode === 'spent-reaction' ? 0 : 1)
      if (accepted) {
        expect(result.events.some(event => event.type === 'moved' && event.actorId === 'holder' && event.movementKind === 'voluntary')).toBe(true)
        const restored = JSON.parse(JSON.stringify(result.state)) as typeof result.state
        restored.combatants.holder.turn.reactionAvailable = true
        const replay = await settleDnd5eActivityTriggerWindowsV1({ state: restored, combatRevision: result.combatRevision,
          events: [...ended.events], eventBatchId: 'enemy-end', roll: async () => [],
          confirm: async () => { throw Error('Replayed movement must not prompt') } })
        expect(replay.state.combatants.holder.position.x).toBe(expectedX)
        expect(replay.state.combatants.holder.turn.reactionAvailable).toBe(true)
        expect(replay.events).toEqual([])
      }
    } finally { dispose(); setMapGeometryRuntime([]) }
  })
