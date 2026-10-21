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

it.each(['registered', 'compiled'].flatMap(path => ['custom', 'missing', 'blank', 'too-long', 'wrong-type', 'fixed'].map(scenario => ({ path, scenario }))))('checks $scenario oral task input through $path authority after archive import', async ({ path, scenario }) => {
  const namespace = 'test.companion-object', automation = automationCapabilityFromLegacyStatus('full')
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'object-order', name: 'Door order',
    activation: { kind: 'bonus-action' }, automation, legacySource: { kind: 'feature', id: 'object-order' },
    target: { kind: 'creature', count: 2, relation: 'any', rangeFeet: 60 },
    consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
    outcomes: [{ id: 'order', when: { kind: 'always' }, operations: [{ id: 'order', kind: 'command-owned-companion',
      target: 'target', sourceActivityId: 'summon', command: 'task', ...(scenario === 'fixed' ? {} : { allowsTaskDescription: true as const }), task: { description: 'Carry a message' } }] }] }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [],
    manifest: { id: namespace, name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only' },
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'object-order', name: 'Door order', automation,
      payload: { id: 'object-order', name: 'Door order', summary: 'Synthetic', description: 'Synthetic', automation: 'full' }, activities: [activity] }] }
  const archive = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  expect(archive.bundle.definitions[0].activities).toEqual([activity])
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(archive.bundle))
  try {
    const state = startDnd5eHeadlessCombat('hide-test', ['owner', 'first', 'second', 'observer'].map(id => createDnd5eCombatant({
      id, name: id, controller: id === 'observer' ? 'dm' : 'player', initiative: id === 'owner' ? 20 : 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      pluginFeatureIds: id === 'owner' ? [namespace + ':object-order'] : [] })))
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
    const companionTaskDescriptions = (scenario === 'missing' ? {} : { order: scenario === 'blank' ? '   ' : scenario === 'too-long' ? 'x'.repeat(1001) : scenario === 'wrong-type' ? { trigger: 'bell', actionKind: 'attack' } : '将这封信交给女王，然后返回报告。' }) as Record<string, string>
    const result = path === 'registered' ? resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {},
      command: { schemaVersion: 1, commandId: 'order', actorId: 'owner', packageId: namespace, packageVersion: '1.0.0', activityId: 'object-order', companionTaskDescriptions, targetIds: ['first', 'second'], expectedRevision: 1 } }).result
      : resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, featureId: namespace + ':object-order', actionId: 'object-order', actorId: 'owner',
        targetId: 'first', targetIds: ['first', 'second'], distanceFeet: 30, payload:{companionTaskDescriptions} })
    if (['missing', 'blank', 'too-long', 'wrong-type'].includes(scenario)) {
      expect(result.ok, JSON.stringify(result)).toBe(false)
      expect(state.combatants.owner.turn.bonusActionAvailable).toBe(true)
      expect(state.combatants.first.classState.companionCommand).toBeUndefined()
      return
    }
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) throw Error('Command rejected')
    expect(result.state.combatants.owner.turn.bonusActionAvailable).toBe(false)
    expect(result.state.combatants.owner.turn.actionAvailable).toBe(true)
    const saved = JSON.parse(JSON.stringify(result.state)) as typeof state
    for (const id of ['first', 'second']) {
      expect(saved.combatants[id].classState.companionCommand?.command).toBe('task')
      expect(saved.combatants[id].classState.companionCommand?.task).toEqual({description:scenario === 'fixed' ? 'Carry a message' : companionTaskDescriptions.order})
      expect(saved.combatants[id].classState.companionCommand?.objectInteraction).toBeUndefined()
    }
  } finally { dispose() }
})
