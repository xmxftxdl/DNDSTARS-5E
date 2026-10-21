import { expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../../lib/mapGeometry'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { BattleMap } from '../../../store/maps'
import type { SharedPlayerActionState } from '../../../lib/sharedCombatTypes'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from '../pluginFeatureAction'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { applyDnd5eActivityMapHandoffsV1, resolveDnd5eActivityAreaMapSelectionV1 } from './dnd5eActivityMapInteraction'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const packageId = 'local.monster-area-test'
const base = { schemaVersion: 1 as const, activation: { kind: 'bonus-action' as const }, consumption: [{ kind: 'action-economy' as const, economy: 'bonus-action' as const, amount: 1 as const, consumeOn: 'resolve' as const }], automation: automationCapabilityFromLegacyStatus('full') }
const activities: Dnd5eActivityDefinitionV1[] = [{
  ...base, id: 'strike', name: 'Area strike', target: { kind: 'creature', relation: 'any', rangeFeet: 10, count: 1 },
  outcomes: [{ id: 'hit', when: { kind: 'always' }, operations: [{ id: 'hurt', kind: 'damage', target: 'target', damageType: 'force', amount: { kind: 'constant', value: 3 } }] }],
}, {
  ...base, id: 'reshape', name: 'Area reshape', target: { kind: 'area', relation: 'any', origin: 'point', shape: 'sphere', radiusFeet: 5, placeRangeFeet: 30, rangeOrigin: 'granting-area', maximumTargets: 16 },
  outcomes: [{ id: 'reshape', when: { kind: 'always' }, operations: [{ id: 'move-area', kind: 'reshape-granting-area', target: 'actor', maximumFeet: { kind: 'constant', value: 30 } }] }],
}]
for (const rangeOrigin of [undefined, 'actor'] as const) {
  const declared = activities[1]
  if (declared.target.kind !== 'area') throw Error('Expected area fixture')
  activities.push({ ...declared, id: rangeOrigin ? 'actor-reshape' : 'default-reshape', target: { ...declared.target, rangeOrigin } })
}
function fixture() {
  const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [
      { id: 'caster', label: 'Caster', type: 'enemy', size: 1, x: 25, y: 25, hp: 11, maxHp: 11, poolId: 'srd-5.1:bandit', color: '', emoji: '' },
      { id: 'target', label: 'Target', type: 'enemy', size: 1, x: 375, y: 75, hp: 11, maxHp: 11, poolId: 'srd-5.1:bandit', color: '', emoji: '' },
      { id: 'projection', label: 'Area', type: 'obstacle', size: 1, x: 325, y: 75, color: '', emoji: '', dnd5eSpellEffect: { schemaVersion: 1, spellId: 'area', sourceCharacterId: 'caster', sourceTokenId: 'caster', createdRound: 1, expiresAfterRound: 100 } },
    ], dnd5ePluginAreas: [{ id: 'area', pluginId: packageId, featureId: 'area', label: 'Area', color: '#fff', sourceCharacterId: 'caster', sourceTokenId: 'caster', createdRound: 1, expiresAfterRound: 100,
      cells: [{ col: 6, row: 1 }], anchorCell: { col: 6, row: 1 }, anchorMode: 'effect-token', anchorTokenId: 'projection', sourceSpellSaveDc: 17, slotLevel: 4,
      grantedActivities: activities.map(activity => ({ activityId: activity.id })) }],
  }
  const initiativeOrder = [{ tokenId: 'caster', label: 'Caster', emoji: '', color: '', roll: 20 }, { tokenId: 'target', label: 'Target', emoji: '', color: '', roll: 10 }]
  const action: SharedPlayerActionState = { id: 'request', mapId: map.id, combatId: 'combat', sourceMode: 'dm', status: 'pending', type: 'dnd5e-plugin-action', actorTokenId: 'caster', characterId: 'dm-token:caster', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 }
  return { map, initiativeOrder, action, characters: [] }
}

it.each(['strike', 'reshape', 'actor-reshape', 'default-reshape'])('settles monster %s controls through registered content and Host map requests', async activityId => {
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities })
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Area', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    for (const definition of activities) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
      api.registerFeature({ id: `area-control.${definition.id}`, name: definition.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
    }
  } })
  try {
    const input = fixture(), activity = activities.find(entry => entry.id === activityId)!
    const anchorCell = { col: 8, row: 4 }
    input.action.dnd5ePluginAction = { featureId: `${packageId}:area-control.${activityId}`, payload: { persistentAreaId: 'area' } }
    if (activityId === 'strike') input.action.targetTokenId = 'target'
    else { input.action.targetCell = anchorCell; input.action.targetTokenIds = []; input.action.targetOrientation = 1 }
    const original = JSON.stringify(input)
    const prepared = prepareDnd5ePluginFeatureAction(input)
    if (activityId.endsWith('-reshape')) {
      // The destination is near the area but beyond the caster's 30 feet.
      // An explicit actor origin and the default must both reject it.
      expect(prepared).toMatchObject({ ok: false, reason: 'target-out-of-range' })
      expect(resolveDnd5eActivityAreaMapSelectionV1({ activity, map: input.map, actorToken: input.map.tokens[0], anchorCell, grantingPersistentAreaId: 'area' })).toBeUndefined()
      expect(JSON.stringify(input)).toBe(original)
      return
    }
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true); if (!prepared.ok) return
    expect(prepared.prepared.headlessAction.hostEntitlement).toEqual({ kind: 'persistent-area', areaId: 'area' })
    expect(prepared.prepared.headlessAction.castLevel).toBe(4)
    expect(prepared.prepared.state.combatants.caster.saveDc).toBe(17)
    if (activityId === 'strike') expect(prepared.prepared.distanceFeet).toBe(5)
    else expect(prepared.prepared.headlessAction.targetIds).toEqual([])
    const settled = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
    expect(settled.result.ok, JSON.stringify(settled.result)).toBe(true); if (!settled.result.ok) return
    expect(settled.result.state.combatants.caster.turn.bonusActionAvailable).toBe(false)
    expect(settled.application?.characters).toEqual([])
    expect(JSON.stringify(input)).toBe(original)
    if (activityId === 'strike') {
      expect(settled.application!.map.tokens.find(token => token.id === 'target')?.hp).toBe(8)
      expect(settled.application!.map.tokens.find(token => token.id === 'caster')?.hp).toBe(11)
      const far = structuredClone(input)
      far.map.tokens[1].x = 925
      expect(prepareDnd5ePluginFeatureAction(far)).toMatchObject({ ok: false, reason: 'target-out-of-range' })
    } else {
      const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity, map: input.map, actorToken: input.map.tokens[0], anchorCell, grantingPersistentAreaId: 'area' })!
      expect(areaSelection).toBeDefined()
      const applied = applyDnd5eActivityMapHandoffsV1({ map: settled.application!.map, activity, packageId, actionId: input.action.id, actorId: 'caster', round: 1,
        grantingPersistentAreaId: 'area', handoffs: settled.result.activityHandoffs!, areaSelection, selection: {} })
      expect(applied.ok, JSON.stringify(applied)).toBe(true); if (!applied.ok) return
      expect(applied.map.dnd5ePluginAreas![0].anchorCell).toEqual(anchorCell)
      expect(applied.map.tokens.find(token => token.id === 'caster')).toMatchObject({ x: 25, y: 25 })
      expect(applied.map.tokens.find(token => token.id === 'projection')).toMatchObject({ x: 425, y: 225 })
    }
  } finally { dispose(); registration.dispose() }
})

it.each(['all', 'choose-any'] as const)('uses the same wall mask for monster feature settlement and map selection (%s)', async selection => {
  for (const wallMode of ['blocking', 'nonblocking', 'ignore'] as const) {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...activities[0], id: 'pulse', name: 'Pulse',
      target: { kind: 'area', relation: 'any', origin: 'point', shape: 'sphere', radiusFeet: 10,
        placeRangeFeet: 90, selection: selection === 'choose-any' ? selection : undefined,
        requiresLineOfEffect: wallMode === 'ignore' ? false : undefined },
    }
    const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Area', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
      api.registerFeature({ id: 'area-control.pulse', name: 'Pulse', summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
    } })
    try {
      const input = fixture(), anchorCell = { col: 6, row: 1 }
      input.map.dnd5ePluginAreas![0].grantedActivities = [{ activityId: activity.id }]
      input.map.tokens.push({ ...input.map.tokens[1], id: 'near', x: 325, y: 125 })
      input.initiativeOrder.push({ tokenId: 'near', label: 'Near', emoji: '', color: '', roll: 5 })
      input.action.dnd5ePluginAction = { featureId: `${packageId}:area-control.pulse`, payload: { persistentAreaId: 'area' } }
      input.action.targetCell = anchorCell
      const geometry = createEmptyMapGeometry(input.map.id, 1)
      geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 350, y: 0 }, { x: 350, y: 500 }],
        blocksVision: false, blocksMovement: false, blocksLineOfEffect: wallMode !== 'nonblocking', baseHeightFeet: 0, heightFeet: 100, createdAt: 1 })
      setMapGeometryRuntime([geometry])
      const expected = wallMode === 'blocking' ? ['near'] : ['target', 'near']
      const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity, map: input.map, actorToken: input.map.tokens[0], anchorCell })!
      expect(areaSelection.targetIds).toEqual(expected)
      input.action.targetTokenIds = expected
      const before = JSON.stringify(input)
      const prepared = prepareDnd5ePluginFeatureAction(input)
      expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
      if (!prepared.ok) continue
      expect(prepared.prepared.headlessAction.targetIds).toEqual(expected)
      expect(prepared.prepared.targetCells).toEqual(areaSelection.cells)
      const settled = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
      expect(settled.result.ok, JSON.stringify(settled.result)).toBe(true)
      if (!settled.result.ok) continue
      expect(settled.application!.map.tokens.find(token => token.id === 'near')?.hp).toBe(8)
      expect(settled.application!.map.tokens.find(token => token.id === 'target')?.hp).toBe(wallMode === 'blocking' ? 11 : 8)
      expect(settled.result.state.combatants.caster.turn.bonusActionAvailable).toBe(false)
      expect(JSON.stringify(input)).toBe(before)
      if (selection === 'choose-any' && wallMode === 'blocking') {
        input.action.targetTokenIds = ['target']
        expect(prepareDnd5ePluginFeatureAction(input)).toEqual({ ok: false, reason: 'invalid-target' })
      }
    } finally { setMapGeometryRuntime([]); dispose(); registration.dispose() }
  }
}, 20_000)
