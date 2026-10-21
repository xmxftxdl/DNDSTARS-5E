import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { migrateMapsState, type BattleMap } from '../../store/maps'
import { normalizeSharedCampaignTime } from '../../lib/campaignTime'
import { mutateCampaignTimeState } from '../../../scripts/shared-server-core.mjs'
import { expireRestBoundAreas } from '../../../shared/rest-bound-areas.mjs'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { settleDnd5eRestActivityV1 } from './activities/dnd5eRestActivitySettlement'
import { applyDnd5eActivityMapHandoffsV1, resolveDnd5eActivityAreaMapSelectionV1 } from './activities/dnd5eActivityMapInteraction'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { reconcileDnd5ePluginAreasOnMap } from './pluginAreas'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from './pluginFeatureAction'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { dnd5eRulesPluginFromUnifiedContentBundleV1 } from './unifiedContent'
import { dnd5eSpellAuthorityResolutionContext } from '../../pages/maps/spellSettlementCoordinator'

it.each(['short-rest', 'long-rest'] as const)('composes %s authorization, area handoff, checks, reload and termination', async kind => {
  const host = { role: 'dm', memberId: 'host' }, context = { host, restCharacterIds: ['hero'] }
  const started = mutateCampaignTimeState(null, { operation: 'start-rest-session', id: 'rest-1', kind, characterIds: ['hero'], expectedWorldMinute: 480 }, 1, host, context)
  if (!started.ok) throw Error(started.error)
  const clock = normalizeSharedCampaignTime(started.next)
  const owner = normalizeCharacter({ id: 'hero', name: 'Hero', currentHp: 20, maxHp: 20, dnd5eWorldTimeAppliedMinute: 480,
    dnd5ePluginFeatureIds: ['test.rest-zone:rest-zone'] })
  const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 1000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [{ id: 'hero', characterId: 'hero', type: 'player', label: 'Hero', x: 325, y: 325, size: 1, color: '#fff', emoji: '' }] }
  const definition: Dnd5eActivityDefinitionV1 = JSON.parse(JSON.stringify({ schemaVersion: 1, id: 'rest-zone', name: 'Synthetic rest zone',
    activation: { kind: 'free' }, legacySource: { kind: 'feature', id: 'rest-zone' },
    invocation: { kind: 'triggered', event: `${kind}-started`, confirmation: 'actor-choice', retention: 'single-event' },
    target: { kind: 'area', relation: 'ally', origin: 'self', shape: 'sphere', radiusFeet: 30, includeSelf: true },
    outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'area', kind: 'create-persistent-area', label: 'Rest zone',
      durationRounds: 4800, permanent: true, concentration: false, bindToRestSession: true, sourceExitBehavior: 'remove-area',
      concealsFlameLightFromOutside: true, hiddenFromPlayers: true, anchorMode: 'fixed',
      occupantModifiers: { skillCheckBonuses: { stealth: 5, perception: 5 }, requiresLineOfEffectFromAnchor: true } }] }],
    automation: automationCapabilityFromLegacyStatus('full') }))
  const registration = { dispose: registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1({
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: 'test.rest-zone', name: 'Rest test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, id: 'rest-zone', name: 'Rest zone', namespace: 'test.rest-zone', version: '1.0.0', kind: 'feature',
      automation: definition.automation, payload: { id: 'rest-zone', name: 'Rest zone', summary: 'Synthetic', description: 'Synthetic', automation: 'full' }, activities: [definition] }],
  })) }
  try {
    const authority = dnd5eSpellAuthorityResolutionContext({ combatActive: false, map, actorTokenId: 'hero', initiativeOrder: [] })
    const prepared = prepareDnd5ePluginFeatureAction({ map, characters: [owner], initiativeOrder: authority.initiativeOrder,
      action: { id: 'player-rest', mapId: map.id, sourceMode: 'player', status: 'pending', type: 'dnd5e-plugin-action',
        actorTokenId: 'hero', characterId: owner.id, targetTokenIds: ['hero'], targetCell: { col: 6, row: 6 },
        round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
        dnd5ePluginAction: { featureId: 'test.rest-zone:rest-zone', payload: { selectedActivityId: definition.id, restEventId: 'rest-start:rest-1' } } } })
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) throw Error('player rest preparation failed')
    const playerResult = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared, restAuthority: { clock, combatRevision: 1 } })
    expect(playerResult.result.ok, JSON.stringify(playerResult.result)).toBe(true)
    if (!playerResult.result.ok) throw Error('player rest settlement failed')
    expect(playerResult.result.activityHandoffs?.persistentAreas).toHaveLength(1)
    expect(playerResult.result.activityDefinition?.id).toBe(definition.id)
    expect(playerResult.result.activityAreaInstance).toEqual({ ...prepared.prepared.headlessAction.activityAreaPlacement,
      origin: 'self', shape: 'sphere', instances: undefined })
    const playerArea = applyDnd5eActivityMapHandoffsV1({ map, activity: playerResult.result.activityDefinition!, actorId: 'hero',
      packageId: 'test.rest-zone', actionId: 'player-rest', round: 1, worldMinute: 480,
      restAuthority: { clock, eventId: 'rest-start:rest-1' }, handoffs: playerResult.result.activityHandoffs!,
      areaSelection: { anchorCell: prepared.prepared.targetCell!, cells: prepared.prepared.targetCells, targetIds: ['hero'],
        areaPlacement: playerResult.result.activityAreaInstance!, areaPlacementDistanceFeet: 0 }, selection: {} })
    expect(playerArea.ok, JSON.stringify(playerArea)).toBe(true)
    if (!playerArea.ok) throw Error('player rest map application failed')
    expect(playerArea.map.dnd5ePluginAreas?.[0].restSessionId).toBe('rest-1')
    const snapshot = (scene = map) => createDnd5eMapCombatSnapshot({ map: scene, characters: [owner], combatId: 'rest-area', initiativeOrder: scene.tokens.map(token => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 20 })) })
    const state = snapshot().state
    state.active = false
    state.combatants.hero.pluginFeatureIds = ['rest-zone']
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map, actorToken: map.tokens[0], anchorCell: { col: 6, row: 6 } })!
    const input = { state, actorCharacter: owner, clock, combatRevision: 1, restEventId: 'rest-start:rest-1', decision: 'use' as const,
      confirmedBy: 'actor' as const, authoritativeRolls: {}, areaTargetIds: areaSelection.targetIds, areaPlacementDistanceFeet: 0,
      command: { schemaVersion: 1 as const, commandId: 'rest-zone', packageId: 'test.rest-zone', packageVersion: '1.0.0', activityId: 'rest-zone',
        actorId: 'hero', targetIds: areaSelection.targetIds, areaPlacement: areaSelection.areaPlacement, expectedRevision: 1 } }
    const used = settleDnd5eRestActivityV1(input)
    expect(used.ok, JSON.stringify(used)).toBe(true)
    if (!used.ok || used.outcome !== 'used' || !used.resolution.result.ok) throw Error('rest settlement failed')
    const handoffs = used.resolution.result.activityHandoffs!
    expect(handoffs.persistentAreas).toHaveLength(1)
    const applied = applyDnd5eActivityMapHandoffsV1({ map, activity: definition, actorId: 'hero', packageId: 'test.rest-zone', actionId: 'rest-zone',
      round: 1, worldMinute: 480, restAuthority: { clock, eventId: input.restEventId }, handoffs, areaSelection, selection: {} })
    expect(applied.ok, JSON.stringify(applied)).toBe(true)
    if (!applied.ok) throw Error('area handoff failed')
    const savedMap = migrateMapsState(JSON.parse(JSON.stringify({ maps: [applied.map] }))).maps[0]
    const savedOwner = normalizeCharacter(JSON.parse(JSON.stringify({ ...owner, ...used.receiptPatch })))
    expect(settleDnd5eRestActivityV1({ ...input, actorCharacter: savedOwner }).ok).toBe(false)
    expect(savedMap.dnd5ePluginAreas?.[0]).toMatchObject({ restSessionId: 'rest-1', concealsFlameLightFromOutside: true, hiddenFromPlayers: true })
    const invalidVisibility = JSON.parse(JSON.stringify(definition))
    invalidVisibility.outcomes[0].operations[0].hiddenFromPlayers = 'true'
    expect(validateDnd5eActivityDefinitionV1(invalidVisibility)).toEqual([
      expect.stringMatching(/\.hiddenFromPlayers is invalid$/),
    ])
    const base = snapshot().state, active = snapshot(savedMap).state
    const check = (current: typeof active) => {
      const result = resolveDnd5eHeadlessAction(current, { type: 'ability-check', actorId: 'hero', ability: 'wis', skill: 'perception', d20: 10, dc: 0 })
      expect(result.ok).toBe(true)
      const event = result.events.find(event => event.type === 'ability-check-resolved')
      if (!event || event.type !== 'ability-check-resolved') throw Error('missing check')
      return event.total
    }
    expect(check(active) - check(base)).toBe(5)
    const activityBonus = (current: typeof active) => dnd5eActivityActorSnapshotFromCombatantV1(current.combatants.hero, undefined, current).skillCheckModifiers!.perception!
    expect(activityBonus(active) - activityBonus(base)).toBe(5)
    const skillActivity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'observe', name: 'Observe', activation: { kind: 'free' },
      target: { kind: 'self' }, checks: [{ id: 'check', kind: 'skill-check', rollId: 'check', ability: 'wis', skill: 'perception',
        dc: { kind: 'constant', value: 15 }, rollMode: 'normal' }], outcomes: [{ id: 'done', when: { kind: 'always' }, operations: [{ id: 'done', kind: 'mechanic', target: 'actor', handlerId: 'core.resolve-only' }] }], automation: automationCapabilityFromLegacyStatus('full') }
    const runActivityCheck = (current: typeof active) => {
      const actor = dnd5eActivityActorSnapshotFromCombatantV1(current.combatants.hero, undefined, current)
      const result = resolveDnd5eActivity({ activity: skillActivity, actor, targets: [actor], rolls: { check: { values: [10] } } })
      expect(result.ok, JSON.stringify(result)).toBe(true)
      if (!result.ok) throw Error('activity check failed')
      return result.checks[0].total
    }
    expect(runActivityCheck(active) - runActivityCheck(base)).toBe(5)
    for (const operation of ['complete-rest-session', 'interrupt-rest-session']) {
      const end = mutateCampaignTimeState(clock, { operation, id: 'rest-1', expectedWorldMinute: 480 }, 2, host, context)
      if (!end.ok) throw Error(end.error)
      const endedMap = expireRestBoundAreas(savedMap, normalizeSharedCampaignTime(end.next))
      expect(endedMap.dnd5ePluginAreas).toEqual([])
      expect(check(snapshot(endedMap).state)).toBe(check(base))
      expect(settleDnd5eRestActivityV1({ ...input, clock: normalizeSharedCampaignTime(end.next) }).ok).toBe(false)
    }
    const movedMap = { ...savedMap, tokens: savedMap.tokens.map(token => ({ ...token, x: 975, y: 975 })) }
    expect(reconcileDnd5ePluginAreasOnMap(movedMap, [savedOwner], 1).dnd5ePluginAreas).toEqual([])
  } finally { registration.dispose() }
})
