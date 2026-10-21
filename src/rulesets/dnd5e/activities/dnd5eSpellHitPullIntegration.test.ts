import { synchronizeDnd5eActivityMapMovement } from './dnd5eActivityMapMovementEvents'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { afterEach, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../../store/characters'
import type { BattleMap } from '../../../store/maps'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../../lib/mapGeometry'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from '../mapBridge'
import { clearDnd5eActivityRegistryForTests } from './dnd5eActivityRegistry'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import { applyDnd5eActivityMapHandoffsV1, dnd5eActivityAutomaticDirectionalMovementCellV1 } from './dnd5eActivityMapInteraction'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const disposers: Array<() => void> = []
afterEach(() => { for (const dispose of disposers.splice(0).reverse()) dispose(); clearDnd5eActivityRegistryForTests(); setMapGeometryRuntime([]) })

it.each([{ accept: true, blocked: false, owned: true, failHandoff: false }, { accept: false, blocked: false, owned: true, failHandoff: false }, { accept: true, blocked: true, owned: true, failHandoff: false }, { accept: true, blocked: false, owned: false, failHandoff: false }, { accept: true, blocked: false, owned: true, failHandoff: true }].flatMap(row => (['feature', 'feat'] as const).map(kind => ({ ...row, kind }))))('settles a spell-hit pull through the Host map handoff (%j)', async ({ accept, blocked, owned, kind, failHandoff }) => {
  const packageId = 'test.spell-hit-pull'
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'pull', name: 'Synthetic pull', activation: { kind: 'free' },
    automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind, id: 'pull' },
    invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'actor-choice', retention: 'single-event' },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 120 },
    requirements: [{ kind: 'event-source', source: 'attack', sourceId: 'eldritch-blast' },
      { kind: 'turn-owner', owner: 'actor' }, { kind: 'once-per-turn', key: 'pull' }],
    outcomes: [{ id: 'pull', when: { kind: 'always' }, operations: [{ id: 'pull', kind: 'move', target: 'target',
      mode: 'pull', distanceFeet: { kind: 'constant', value: 10 }, placement: 'host-automatic-maximum' }] }],
  }
  const { exportDnd5eStarMod, readDnd5eStarMod } = await import('../starModAdapter')
  const { dnd5eRulesPluginFromUnifiedContentBundleV1 } = await import('../unifiedContent')
  const { registerDnd5eRulesPlugin, dnd5ePluginFeatureDefinition, dnd5ePluginFeatDefinition } = await import('../pluginApi')
  const bundle: import('../unifiedContent').Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: packageId, name: 'Synthetic triggered module', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace: packageId, version: '1.0.0',
      kind, id: 'pull', name: 'Pull', automation: automationCapabilityFromLegacyStatus('full'),
      payload: { id: 'pull', name: 'Pull', summary: 'Synthetic', description: 'Synthetic event feature', automation: 'full' },
      activities: [activity] }],
  }
  const before = structuredClone(bundle)
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  disposers.push(registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle)))
  expect(bundle).toEqual(before)
  const featureId = kind === 'feat' ? dnd5ePluginFeatDefinition(`${packageId}:pull`)!.featureId : `${packageId}:pull`
  expect(dnd5ePluginFeatureDefinition(featureId)?.action).toBeUndefined()
  const characters = ['actor', 'target'].map(id => normalizeCharacter({ id, name: id,
    maxHp: 20, currentHp: 20, dnd5ePluginFeatureIds: id === 'actor' && owned && kind === 'feature' ? [featureId] : [],
    dnd5eFeatIds: id === 'actor' && owned && kind === 'feat' ? [`${packageId}:pull`] : [] }))
  const original: BattleMap = { id: 'pull-map', name: 'Pull map', width: 1000, height: 500,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: ['actor', 'target'].map((id, index) => ({ id, characterId: id, label: id, type: 'player',
      color: '#fff', emoji: '', size: 1, x: index ? 275 : 75, y: 75 })) }
  if (blocked) {
    const geometry = createEmptyMapGeometry(original.id, 1)
    geometry.doors.push({ id: 'door', kind: 'door', label: 'Closed door',
      points: [{ x: 250, y: 0 }, { x: 250, y: 500 }], state: 'closed', openState: 'closed',
      lockState: 'unlocked', physicalState: 'intact', secret: false, blocksVision: true,
      blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 })
    setMapGeometryRuntime([geometry])
  }
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'pull-combat', round: 1, map: original, characters,
    initiativeOrder: original.tokens.map((token, index) => ({ tokenId: token.id, label: token.id, emoji: '', color: '', roll: 20 - index })) })
  expect(snapshot.state.combatants.actor.pluginFeatureIds.includes(featureId)).toBe(owned)
  for (const mode of ['other-turn', 'wrong-spell', 'miss'] as const) {
    const rejected = await settleDnd5eActivityTriggerWindowsV1({
      state: { ...snapshot.state, initiativeIndex: mode === 'other-turn' ? 1 : 0 }, combatRevision: 1,
      charactersByCombatantId: Object.fromEntries(characters.map(character => [character.id, character])),
      eventBatchId: mode, events: [{ type: 'attack-resolved', actorId: 'actor', targetId: 'target',
        spellId: mode === 'wrong-spell' ? 'fire-bolt' : 'eldritch-blast', attackMode: 'spell', d20: 15, total: 20,
        armorClass: 10, hit: mode !== 'miss', critical: false }],
      confirm: async () => { throw Error('ineligible event opened a choice') }, roll: async () => [],
      settleMapHandoffs: async () => { throw Error('ineligible event attempted movement') },
    })
    expect(rejected.diagnostics).toEqual(mode === 'other-turn' && owned
      ? [expect.objectContaining({ activityId: 'pull', status: 'rejected', reason: 'requirements-not-met' })] : [])
    expect(rejected.events).toEqual([])
    expect(rejected.combatRevision).toBe(1)
  }
  let workingMap = original, handoffCalls = 0
  const result = await settleDnd5eActivityTriggerWindowsV1({ state: snapshot.state, combatRevision: 1,
    charactersByCombatantId: Object.fromEntries(characters.map(character => [character.id, character])),
    eventBatchId: 'beam-1', events: [{ type: 'attack-resolved', actorId: 'actor', targetId: 'target',
      spellId: 'eldritch-blast', attackMode: 'spell', d20: 15, total: 20, armorClass: 10, hit: true, critical: false }],
    confirm: async () => accept, roll: async () => [],
    settleMapHandoffs: async request => {
      handoffCalls++
      if (failHandoff) return { ok: false, reason: 'test-map-revision-conflict' }
      const handoffs = request.committed.activityHandoffs!
      expect(handoffs.movements).toEqual([expect.objectContaining({ targetId: 'target', mode: 'pull', distanceFeet: 10 })])
      const destination = dnd5eActivityAutomaticDirectionalMovementCellV1({ map: workingMap,
        actorToken: workingMap.tokens[0], targetToken: workingMap.tokens[1], mode: 'pull', distanceFeet: 10 })
      const applied = applyDnd5eActivityMapHandoffsV1({ map: workingMap, activity: request.activity,
        packageId, actionId: request.receiptId, actorId: 'actor', round: 1, handoffs,
        selection: { movementCellsByOperationId: { pull: destination } } })
      if (!applied.ok) return applied
      const priorEvents = Object.freeze([...request.committed.events])
      request.committed.events = synchronizeDnd5eActivityMapMovement({ before: workingMap, after: applied.map, actorId: request.actorId,
        activityId: request.activity.id, movements: handoffs.movements,
        state: request.committed.state, events: priorEvents })
      expect(priorEvents.some(event => event.type === 'moved')).toBe(false)
      workingMap = applied.map
      return { ok: true }
    },
  })
  if (owned) expect(result.diagnostics).toContainEqual(expect.objectContaining({ activityId: 'pull', status: !accept ? 'declined' : failHandoff ? 'unsupported' : 'resolved' }))
  else expect(result.diagnostics).toEqual([])
  expect(handoffCalls).toBe(accept && owned ? 1 : 0)
  expect(workingMap.tokens[1].x).toBe(accept && owned && !failHandoff && !blocked ? 175 : 275)
  expect(result.state.combatants.target.position.x).toBe(workingMap.tokens[1].x)
  expect(result.state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey('actor', 'target')]).toBe(accept && owned && !failHandoff && !blocked ? 10 : 20)
  expect(result.events.filter(event => event.type === 'moved')).toHaveLength(accept && owned && !failHandoff ? 1 : 0)
  expect(workingMap.tokens[0].x).toBe(75)
  expect(original.tokens[1].x).toBe(275)
  if (failHandoff) {
    expect(result.combatRevision).toBe(1)
    expect(result.state).toEqual(snapshot.state)
    expect(result.events).toEqual([])
  }
  if (owned && !failHandoff) {
    const planned = planDnd5eMapResultApplication({ ...snapshot, state: result.state,
      map: workingMap, characters, events: [...result.events] })
    const saved = JSON.parse(JSON.stringify({ map: planned.map, characters: planned.characters })) as typeof planned
    const rebuilt = createDnd5eMapCombatSnapshot({ combatId: 'pull-combat', round: 2,
      map: saved.map, characters: saved.characters,
      initiativeOrder: saved.map.tokens.map((token, index) => ({ tokenId: token.id, label: token.id, emoji: '', color: '', roll: 20 - index })) })
    expect(rebuilt.state.combatants.actor.classState.activityTriggerReceipts)
      .toEqual(result.state.combatants.actor.classState.activityTriggerReceipts)
    const replay = await settleDnd5eActivityTriggerWindowsV1({
      state: rebuilt.state, combatRevision: result.combatRevision,
      charactersByCombatantId: Object.fromEntries(saved.characters.map(character => [character.id, character])),
      eventBatchId: 'beam-1', events: [{ type: 'attack-resolved', actorId: 'actor', targetId: 'target',
        spellId: 'eldritch-blast', attackMode: 'spell', d20: 15, total: 20, armorClass: 10, hit: true, critical: false }],
      confirm: async () => { throw Error('duplicate confirmation') }, roll: async () => [],
      settleMapHandoffs: async () => { throw Error('duplicate map write') },
    })
    expect(replay.events).toEqual([])
    expect(replay.combatRevision).toBe(result.combatRevision)
    expect(replay.state.combatants.target.position).toEqual(result.state.combatants.target.position)
  }
  expect(Boolean(result.state.combatants.actor.classState.declarativeUsedTurnKeys?.pull)).toBe(accept && owned && !failHandoff)
  // Declining consumes only this event's prompt, not the once-per-turn use.
  expect(Boolean(result.state.combatants.actor.classState.activityTriggerReceipts?.ids.length)).toBe(owned && !failHandoff)
})
