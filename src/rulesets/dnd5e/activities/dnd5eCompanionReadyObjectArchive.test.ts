import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../../lib/mapGeometry'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey } from '../headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

it.each(['registered', 'compiled'] as const)('imports and resolves a group Ready door command through %s authority', async path => {
  const namespace = 'test.companion-ready-object', automation = automationCapabilityFromLegacyStatus('full')
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'ready-object-order', name: 'Door order',
    activation: { kind: 'bonus-action' }, automation, legacySource: { kind: 'feature', id: 'ready-object-order' },
    target: { kind: 'creature', count: 2, relation: 'any', rangeFeet: 60 },
    consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
    outcomes: [{ id: 'order', when: { kind: 'always' }, operations: [{ id: 'order', kind: 'command-owned-companion',
      target: 'target', sourceActivityId: 'summon', command: 'ready', requiresObjectInteraction: true, ready: { trigger: 'signal', actionKind: 'interact-object' } }] }] }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [],
    manifest: { id: namespace, name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only' },
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'ready-object-order', name: 'Door order', automation,
      payload: { id: 'ready-object-order', name: 'Door order', summary: 'Synthetic', description: 'Synthetic', automation: 'full' }, activities: [activity] }] }
  const archive = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  expect(archive.bundle.definitions[0].activities).toEqual([activity])
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(archive.bundle))
  try {
    const state = startDnd5eHeadlessCombat('hide-test', ['owner', 'first', 'second', 'observer'].map(id => createDnd5eCombatant({
      id, name: id, controller: id === 'observer' ? 'dm' : 'player', initiative: id === 'owner' ? 20 : 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      pluginFeatureIds: id === 'owner' ? [namespace + ':ready-object-order'] : [] })))
    for (const id of ['first', 'second']) Object.assign(state.combatants[id], { summonedSourceCombatantId: 'owner',
      summonedSourcePackageId: namespace, summonedSourceActivityId: 'summon', summonedCommandPolicy: 'persistent-order' })
    state.distanceFeetByCombatantPair = Object.fromEntries(['first', 'second'].map(id => [dnd5eCombatantPairKey('owner', id), 30]))
    state.lineOfSightBlockedByCombatantPair = Object.fromEntries(['first', 'second'].map(id => [dnd5eDirectedCombatantPairKey('observer', id), true as const]))
    const geometry = createEmptyMapGeometry('scene')
    geometry.doors.push({id:'door',kind:'door',secret:false,label:'Door',points:[{x:50,y:0},{x:50,y:50}],state:'closed',
      blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:10,createdAt:1})
    state.companionScene={geometry,projectedTokenIds:[],map:{id:'scene',name:'Scene',width:500,height:500,gridSize:50,
      gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:['first','second'].map(id=>({id,label:id,type:'enemy',size:1,x:25,y:25,color:'',emoji:''}))}}
    for(const id of ['first','second'])state.combatants[id].position={x:25,y:25}
    const companionObjectInteractions={order:{mapId:'scene',doorId:'door',operation:'open' as const}}
    const result = path === 'registered' ? resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {},
      command: { schemaVersion: 1, commandId: 'order', actorId: 'owner', packageId: namespace, packageVersion: '1.0.0', activityId: 'ready-object-order', companionObjectInteractions, targetIds: ['first', 'second'], expectedRevision: 1 } }).result
      : resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, featureId: namespace + ':ready-object-order', actionId: 'ready-object-order', actorId: 'owner',
        targetId: 'first', targetIds: ['first', 'second'], distanceFeet: 30, payload:{companionObjectInteractions} })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) throw Error('Command rejected')
    expect(result.state.combatants.owner.turn.bonusActionAvailable).toBe(false)
    expect(result.state.combatants.owner.turn.actionAvailable).toBe(true)
    let saved = JSON.parse(JSON.stringify(result.state)) as typeof state
    for (const id of ['first', 'second']) {
      expect(saved.combatants[id].classState.companionCommand?.command).toBe('ready')
      saved.initiativeIndex = saved.initiativeOrder.indexOf(id)
      const selected = saved.combatants[id].classState.companionCommand!.objectInteraction!
      if(!('doorId' in selected))throw Error('Expected door binding')
      const declaration = { type: 'ready' as const, actorId: id, trigger: 'signal', actionKind: 'interact-object' as const, objectInteraction: selected }
      const forged = resolveDnd5eHeadlessAction(saved, { ...declaration, objectInteraction: { ...selected, operation: 'close' } })
      expect(forged.ok).toBe(false)
      expect(forged.state).toEqual(saved)
      const declared = resolveDnd5eHeadlessAction(saved, declaration)
      expect(declared.ok, JSON.stringify(declared)).toBe(true)
      const ended = resolveDnd5eHeadlessAction(declared.state, { type: 'end-turn', actorId: id })
      expect(ended.ok).toBe(true)
      expect(ended.state.combatants[id].classState.companionCommand?.command).toBe('ready')
      expect(ended.events.some(event=>event.type==='companion-order-completed')).toBe(false)
      const hidden = resolveDnd5eHeadlessAction(ended.state, { type: 'trigger-readied-action', actorId: id, objectExecution: true })
      expect(hidden.ok, JSON.stringify(hidden)).toBe(true)
      expect(hidden.state.companionScene?.geometry?.doors[0].openState).toBe('open')
      expect(hidden.state.combatants[id].turn.objectInteractionAvailable).toBe(true)
      expect(hidden.state.combatants[id].turn.actionAvailable).toBe(false)
      expect(hidden.state.combatants[id].turn.reactionAvailable).toBe(false)
      expect(hidden.state.combatants[id].classState.readiedAction).toBeUndefined()
      expect(hidden.state.combatants[id].classState.companionCommand).toBeUndefined()
      expect(hidden.events.filter(event=>event.type==='companion-order-completed')).toHaveLength(1)
      expect(hidden.events.filter(event => event.type === 'object-action-taken')).toHaveLength(id === 'first' ? 1 : 0)
      saved = JSON.parse(JSON.stringify(hidden.state)) as typeof state
    }
  } finally { dispose() }
})
