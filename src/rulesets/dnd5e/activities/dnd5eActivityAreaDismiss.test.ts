import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { migrateMapsState, type BattleMap } from '../../../store/maps'
import { normalizeCharacter } from '../../../store/characters'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, commitDnd5eActivityExecution } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from '../pluginFeatureAction'
import { reconcileDnd5ePluginAreasAndConcentrationOnMap } from '../pluginAreas'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { applyDnd5eActivityMapHandoffsV1 } from './dnd5eActivityMapInteraction'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'dismiss-aura', name: 'Dismiss aura', activation: { kind: 'bonus-action', cost: 1 },
  target: { kind: 'self' }, consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
  outcomes: [{ id: 'dismiss', when: { kind: 'always' }, operations: [{ id: 'remove', kind: 'dismiss-granting-area', target: 'actor' }] }],
  automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'dismiss-aura' },
}
const actor = { id: 'caster', controller: 'players' as const, level: 10, proficiencyBonus: 4, abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, armorClass: 15, conditions: [], currentHp: 50, maxHp: 50 }

it.each(['native', 'archive'])('authorizes DM monster area controls from the real Token identity via %s', async route => {
  const namespace = 'local.dismiss'
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic area control', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'root', name: 'Root', automation: activity.automation,
      payload: { id: 'root', name: 'Root', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'root', name: 'Root', activation: { kind: 'action' }, automation: activity.automation,
        legacySource: { kind: 'feature', id: 'root' }, target: { kind: 'area', relation: 'any', shape: 'sphere', origin: 'point', radiusFeet: 5, placeRangeFeet: 30 },
        outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'area', kind: 'create-persistent-area', label: 'Area', durationRounds: 10, permanent: true, concentration: false,
          sourceIncapacitatedBehavior: 'remove-area', grantedActivities: [{ activityId: activity.id }] }] }] }, { ...activity, legacySource: { kind: 'feature', id: 'root' } }],
    }] }
  const restored = route === 'archive' ? (await readDnd5eStarMod(await exportDnd5eStarMod(bundle))).bundle : undefined
  if (restored) expect(restored.definitions[0].activities?.[0].outcomes[0].operations[0]).toMatchObject({
    permanent: true, concentration: false, sourceIncapacitatedBehavior: 'remove-area', grantedActivities: [{ activityId: activity.id }],
  })
  const imported = restored ? dnd5eRulesPluginFromUnifiedContentBundleV1(restored) : undefined
  const dispose = registerDnd5eRulesPlugin(imported ?? { manifest: { id: 'local.dismiss', name: 'Dismiss', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
    api.registerFeature({ id: activity.id, name: activity.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
  } })
  try {
    const current = map()
    current.dnd5ePluginAreas![0].sourceIncapacitatedBehavior = 'remove-area'
    current.tokens[0] = { ...current.tokens[0], type: 'enemy', characterId: undefined, hp: 11, maxHp: 11, poolId: 'srd-5.1:bandit' }
    current.dnd5ePluginAreas![0].sourceSpellSaveDc = 17
    current.dnd5ePluginAreas![0].slotLevel = 4
    const request = { id: 'dm-dismiss', mapId: current.id, combatId: 'combat', sourceMode: 'dm' as const, status: 'pending' as const, type: 'dnd5e-plugin-action' as const,
      actorTokenId: 'caster', characterId: 'dm-token:caster', targetTokenId: 'caster', dnd5ePluginAction: { featureId: route === 'archive' ? 'local.dismiss:area-control.dismiss-aura' : 'local.dismiss:dismiss-aura', payload: { persistentAreaId: 'aura' } }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 }
    const input = { action: request, map: current, characters: [], initiativeOrder: [{ tokenId: 'caster', label: 'Bandit', emoji: '', color: '', roll: 20 }] }
    const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [current] }))).maps[0]
    expect(saved.dnd5ePluginAreas![0]).toMatchObject({ permanent: true, sourceIncapacitatedBehavior: 'remove-area' })
    expect(reconcileDnd5ePluginAreasAndConcentrationOnMap(saved, [], 10000).map.dnd5ePluginAreas).toHaveLength(1)
    for (const condition of ['stunned', 'paralyzed', 'unconscious', 'petrified', 'incapacitated', 'restrained']) {
      const changed = structuredClone(saved)
      changed.tokens[0].dnd5eCombatState = { conditions: [condition] }
      changed.dnd5ePluginAreas!.push({ ...changed.dnd5ePluginAreas![0], id: 'independent', anchorMode: 'fixed',
        anchorTokenId: undefined, sourceIncapacitatedBehavior: undefined, grantedActivities: [] })
      const reconciled = reconcileDnd5ePluginAreasAndConcentrationOnMap(changed, [], 10000)
      const removed = condition !== 'restrained'
      expect(reconciled.map.dnd5ePluginAreas?.map(area => area.id)).toEqual(removed ? ['independent'] : ['aura', 'independent'])
      expect(reconciled.map.tokens.some(token => token.id === 'projection')).toBe(!removed)
      expect(prepareDnd5ePluginFeatureAction({ ...input, map: reconciled.map }).ok).toBe(!removed)
      expect(changed.dnd5ePluginAreas).toHaveLength(2)
    }
    const prepared = prepareDnd5ePluginFeatureAction({ ...input, map: saved })
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true); if (!prepared.ok) return
    expect(prepared.prepared.headlessAction.hostEntitlement).toEqual({ kind: 'persistent-area', areaId: 'aura' })
    expect(prepared.prepared.headlessAction.castLevel).toBe(4)
    expect(prepared.prepared.state.combatants.caster.saveDc).toBe(17)
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants.caster.turn.bonusActionAvailable).toBe(false)
    expect(resolved.application?.characters).toEqual([])
    const settled = applyDnd5eActivityMapHandoffsV1({ map: resolved.application!.map, activity, packageId: 'local.dismiss', actionId: request.id, actorId: 'caster', round: 1,
      grantingPersistentAreaId: prepared.prepared.persistentAreaGrant!.areaId, selection: {}, handoffs: resolved.result.activityHandoffs! })
    expect(settled.ok, JSON.stringify(settled)).toBe(true)
    if (settled.ok) {
      expect(settled.map.dnd5ePluginAreas).toEqual([])
      expect(prepareDnd5ePluginFeatureAction({ ...input, map: settled.map }).ok).toBe(false)
    }
    expect(prepareDnd5ePluginFeatureAction({ ...input, action: { ...request, sourceMode: 'player' } })).toMatchObject({ ok: false, reason: 'invalid-actor' })
    for (const mutation of ['character', 'token', 'package', 'grant']) {
      const bad = structuredClone(current), area = bad.dnd5ePluginAreas![0]
      if (mutation === 'character') area.sourceCharacterId = request.characterId
      if (mutation === 'token') area.sourceTokenId = 'another-monster'
      if (mutation === 'package') area.pluginId = 'another-plugin'
      if (mutation === 'grant') area.grantedActivities = []
      expect(prepareDnd5ePluginFeatureAction({ ...input, map: bad })).toMatchObject({ ok: false, reason: 'feature-not-selected' })
    }
  } finally { dispose() }
})
function map(): BattleMap {
  return { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [
      { id: 'caster', characterId: 'caster', label: 'Caster', type: 'player', size: 1, x: 25, y: 25, color: '', emoji: '' },
      { id: 'projection', label: 'Aura', type: 'obstacle', size: 1, x: 75, y: 75, color: '', emoji: '', dnd5eSpellEffect: { schemaVersion: 1, spellId: 'aura', sourceCharacterId: 'caster', sourceTokenId: 'caster', createdRound: 1, expiresAfterRound: 100 } },
    ],
    dnd5ePluginAreas: [{ id: 'aura', pluginId: 'local.dismiss', featureId: 'aura', label: 'Aura', color: '#fff', sourceCharacterId: 'caster', sourceTokenId: 'caster', createdRound: 1, expiresAfterRound: 100, permanent: true,
      cells: [{ col: 1, row: 1 }], anchorMode: 'effect-token', anchorTokenId: 'projection', grantedActivities: [{ activityId: activity.id }] }],
  }
}
function apply(current: BattleMap, actorId = 'caster') {
  return applyDnd5eActivityMapHandoffsV1({ map: current, activity, packageId: 'local.dismiss', actionId: 'dismiss-1', actorId, round: 1, grantingPersistentAreaId: 'aura', selection: {},
    handoffs: { persistentAreas: [], movements: [], summons: [], invocations: [], areaDismissals: [{ kind: 'dismiss-granting-area', operationId: 'remove', actorId }] } })
}

it('removes a saved non-concentration area and its own projection once without detonation', () => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const current = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map()] }))).maps[0]
  current.dnd5ePluginAreas!.push({ ...current.dnd5ePluginAreas![0], id: 'unrelated', anchorMode: 'fixed', anchorTokenId: undefined })
  const before = JSON.stringify(current)
  const result = apply(current)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) return
  expect(result.map.dnd5ePluginAreas?.map(area => area.id)).toEqual(['unrelated'])
  expect(result.map.tokens.map(token => token.id)).toEqual(['caster'])
  expect(result.removedTokenIds).toEqual(['projection'])
  expect(result.endedAreaIds).toEqual(['aura'])
  expect(result.detonatedAreaIds).toEqual([])
  expect(JSON.stringify(current)).toBe(before)
  expect(apply(result.map)).toMatchObject({ ok: false, reason: 'invalid-persistent-area' })
})

it.each(['owner', 'token-owner', 'package', 'grant', 'missing'])('rejects %s violations without altering the map', mode => {
  const current = map(), area = current.dnd5ePluginAreas![0]
  if (mode === 'owner') area.sourceCharacterId = 'other'
  if (mode === 'token-owner') area.sourceTokenId = 'other'
  if (mode === 'package') area.pluginId = 'other'
  if (mode === 'grant') area.grantedActivities = []
  if (mode === 'missing') current.dnd5ePluginAreas = []
  const before = JSON.stringify(current)
  expect(apply(current)).toMatchObject({ ok: false, reason: 'invalid-persistent-area' })
  expect(JSON.stringify(current)).toBe(before)
})

it('does not delete a foreign projection or one still referenced by another area', () => {
  for (const shared of [true, false]) {
    const current = map()
    if (shared) current.dnd5ePluginAreas!.push({ ...current.dnd5ePluginAreas![0], id: 'other' })
    else current.tokens[1].dnd5eSpellEffect!.sourceTokenId = 'other'
    const result = apply(current)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.map.tokens).toHaveLength(2)
  }
})

it('clears only matching concentration when its final area is dismissed', () => {
  const current = map()
  current.dnd5ePluginAreas![0].concentrationId = 'aura-spell'
  const result = apply(current); expect(result.ok).toBe(true); if (!result.ok) return
  for (const spell of ['aura-spell', 'another-spell']) {
    const character = normalizeCharacter({ id: 'caster', concentrating: true, dnd5eCombatState: { concentrationSpellId: spell } })
    const reconciled = reconcileDnd5ePluginAreasAndConcentrationOnMap(current, [character], 1, result.map)
    expect(reconciled.characters[0].concentrating).toBe(spell !== 'aura-spell')
  }
})

it('preserves dismissal and its bonus-action cost through installed and direct Headless paths', () => {
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'local.dismiss', name: 'Dismiss', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
    api.registerFeature({ id: activity.id, name: activity.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
  } })
  try {
    const current = map()
    const character = normalizeCharacter({ id: 'caster', name: 'Caster', currentHp: 50, maxHp: 50 })
    const request = { id: 'dismiss-request', mapId: current.id, combatId: 'dismiss', sourceMode: 'player' as const, status: 'pending' as const,
      type: 'dnd5e-plugin-action' as const, actorTokenId: 'caster', characterId: 'caster', targetTokenId: 'caster',
      dnd5ePluginAction: { featureId: 'local.dismiss:dismiss-aura', payload: { persistentAreaId: 'aura' } }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 }
    const prepare = (candidate: BattleMap) => prepareDnd5ePluginFeatureAction({ action: request, map: candidate, characters: [character], initiativeOrder: [{ tokenId: 'caster', label: 'Caster', emoji: '', color: '', roll: 20 }] })
    const prepared = prepare(current)
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (prepared.ok) expect(prepared.prepared.headlessAction.hostEntitlement).toEqual({ kind: 'persistent-area', areaId: 'aura' })
    const dismissed = apply(current)
    expect(dismissed.ok).toBe(true)
    if (dismissed.ok) expect(prepare(dismissed.map)).toMatchObject({ ok: false, reason: 'feature-not-selected' })
    const combatant = createDnd5eCombatant({ ...actor, name: 'Caster', controller: 'player', initiative: 20, temporaryHp: 0, speed: 30, saveDc: 16, position: { x: 0, y: 0 }, concentrating: false })
    combatant.pluginFeatureIds = ['local.dismiss:dismiss-aura']
    const state = startDnd5eHeadlessCombat('dismiss', [combatant, createDnd5eCombatant({ ...combatant, id: 'opponent', controller: 'dm', initiative: 1 })])
    const command = { type: 'plugin' as const, pluginId: 'local.dismiss', actionId: activity.id, featureId: 'local.dismiss:dismiss-aura', actorId: actor.id, targetId: actor.id, rolls: {} }
    const installed = resolveDnd5eHeadlessAction(state, command)
    expect(installed.ok, JSON.stringify(installed)).toBe(true); if (!installed.ok) return
    expect(installed.activityHandoffs?.areaDismissals).toMatchObject([{ kind: 'dismiss-granting-area', operationId: 'remove', actorId: actor.id }])
    expect(installed.state.combatants.caster.turn.bonusActionAvailable).toBe(false)
    expect(installed.state.combatants.caster.turn.actionAvailable).toBe(true)
    expect(state.combatants.caster.turn.bonusActionAvailable).toBe(true)
    expect(resolveDnd5eHeadlessAction(installed.state, command).ok).toBe(false)
    const resolution = resolveDnd5eActivity({ activity, actor, targets: [actor], rolls: {} })
    const direct = commitDnd5eActivityExecution(state, { actorId: actor.id, activityId: activity.id, targetIds: [actor.id], resolution, source: { kind: 'feature', id: activity.id } })
    expect(direct.ok, JSON.stringify(direct)).toBe(true)
    expect(direct.activityHandoffs?.areaDismissals).toEqual(installed.activityHandoffs?.areaDismissals)
    expect(direct.state.combatants.caster.turn.bonusActionAvailable).toBe(false)
  } finally { dispose() }
})

it('dismisses a fixed source-limited effect after its owner receives a new map token',()=>{
 const current=map()
 const area=current.dnd5ePluginAreas![0]
 area.anchorMode='fixed';area.anchorTokenId=undefined;area.sourceLimit={groupId:'terrain',maximum:2}
 current.tokens[0].id='new-caster-token'
 expect(apply(current,'new-caster-token')).toMatchObject({ok:true,endedAreaIds:['aura']})
 current.tokens[0].characterId='another-character'
 expect(apply(current,'new-caster-token')).toMatchObject({ok:false})
})
