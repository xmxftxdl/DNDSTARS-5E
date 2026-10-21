import {describe,it,expect,afterEach} from 'vitest'
import {commitDnd5eActivityExecution} from '../headlessCombatEngine'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eCombatantPairKey,dnd5eDirectedCombatantPairKey} from '../headlessCombatEngine'
import {createDnd5eMechanicalEffect} from '../activeEffects'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {compileDnd5eActivityHeadlessAction} from './dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './dnd5eActivityFeatureActionAdapter'
import {registerDnd5eActivityPackage,clearDnd5eActivityRegistryForTests} from './dnd5eActivityRegistry'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'

const base:Omit<Dnd5eActivityDefinitionV1,'outcomes'>={schemaVersion:1,id:'root',name:'Root',activation:{kind:'action'},target:{kind:'self'},legacySource:{kind:'feature',id:'root'},automation:automationCapabilityFromLegacyStatus('full')}
function state(){
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},proficiencyBonus:3,armorClass:12,currentHp:40,maxHp:40,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,pluginFeatureIds:['test.routes:root']})
  const holder=createDnd5eCombatant({...actor,id:'holder',initiative:10,position:{x:100,y:0},pluginFeatureIds:[]})
  const target=createDnd5eCombatant({...holder,id:'target',controller:'dm',initiative:5,position:{x:105,y:0}})
  const result=startDnd5eHeadlessCombat('routes',[actor,holder,target])
  result.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','holder')]:100,[dnd5eCombatantPairKey('actor','target')]:105,[dnd5eCombatantPairKey('holder','target')]:5}
  return result
}
function register(activity:Dnd5eActivityDefinitionV1, outerSpellTransaction=false){
  registerDnd5eActivityPackage({packageId:'test.routes',packageVersion:'1.0.0',activities:[activity]})
  return registerDnd5eRulesPlugin({manifest:{id:'test.routes',name:'Tests',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity,{outerSpellTransaction}))
    api.registerFeature({id:'root',name:'Root',summary:'Test',description:'Test',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(activity)})
  }})
}
afterEach(clearDnd5eActivityRegistryForTests)
const action={type:'plugin' as const,pluginId:'test.routes',actionId:'root',featureId:'test.routes:root',actorId:'actor',targetId:'actor',targetIds:['actor'],rolls:{}}

describe('actual registered B3/B4 Activity routes',()=>{
  it.each(['srd-5.1:vrock','srd-5.1:wolf','missing:demon'])('rejects an ineligible direct summon before spending an action: %s',monsterId=>{
    const current=state(),before=structuredClone(current)
    const result=commitDnd5eActivityExecution(current,{actorId:'actor',activityId:'summon',targetIds:[],
      resolution:{ok:true,status:'resolved',checks:[],consumptions:[{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'}],
        proposals:[{kind:'summon',operationId:'summon',monsterId,count:1,timing:'immediate',durationRounds:600,concentration:true,side:'ally',maximumChallengeRating:5,requiredCreatureSubtype:'demon'}]}})
    expect(result).toMatchObject({ok:false,reason:'invalid-target'})
    expect(result.state.combatants.actor.turn).toEqual(before.combatants.actor.turn)
    expect(current).toEqual(before)
  })
  it('routes selected object animation through the registered Headless compiler', () => {
    const activity: Dnd5eActivityDefinitionV1 = { ...base,
      target: { kind: 'creature', relation: 'any', count: 2, rangeFeet: 120 },
      outcomes: [{ id: 'animate', when: { kind: 'always' }, operations: [{
        id: 'animate', kind: 'summon', animatedObjectSize: 'tiny', monsterId: 'srd-5.1:owl',
        count: { kind: 'constant', value: 1 }, timing: 'immediate', durationRounds: 4800,
        concentration: false, side: 'ally',
      }] }],
    }
    const dispose = register(activity)
    try {
      const current = state()
      current.combatants.holder.objectDamageThreshold = 0
      current.combatants.target.objectDamageThreshold = 0
      const request = { ...action, targetId: 'holder', targetIds: ['holder', 'target'] }
      const result = resolveDnd5eHeadlessAction(current, request)
      expect(result.ok, JSON.stringify(result.events)).toBe(true)
      if (!result.ok) throw Error('registered object animation failed')
      expect(result.activityHandoffs?.summons).toMatchObject([
        { objectTokenId: 'holder', animatedObjectSize: 'tiny', count: 1 },
        { objectTokenId: 'target', animatedObjectSize: 'tiny', count: 1 },
      ])
      delete current.combatants.target.objectDamageThreshold
      expect(resolveDnd5eHeadlessAction(current, request).ok).toBe(false)
    } finally { dispose() }
  })
  it('rejects an absent persistent creature dependency before creating its bond or spending the action', () => {
    const activity: Dnd5eActivityDefinitionV1 = { ...base, outcomes: [{ id: 'call', when: { kind: 'always' }, operations: [{
      id: 'call', kind: 'summon', monsterId: 'test.missing:creature', count: { kind: 'constant', value: 1 },
      timing: 'immediate', persistent: true, concentration: false, side: 'ally', bondKey: 'mount',
    }] }] }
    const dispose = register(activity)
    try {
      const current = state(), before = structuredClone(current)
      const result = resolveDnd5eHeadlessAction(current, action)
      expect(result.ok).toBe(false)
      expect(result.state).toEqual(before)
      expect(current).toEqual(before)
      expect(result.events).toEqual([])
    } finally { dispose() }
  })
  it.each(['new-exclusive', 'existing-exclusive', 'dismissed-exclusive', 'ordinary-isolated', 'different-key', 'own-recall'] as const)(
    'enforces explicit cross-package bond exclusivity: %s', mode => {
      const activity: Dnd5eActivityDefinitionV1 = { ...base, outcomes: [{ id: 'call', when: { kind: 'always' }, operations: [{
        id: 'call', kind: 'summon', monsterId: 'srd-5.1:dire-wolf', count: { kind: 'constant', value: 1 },
        timing: 'immediate', persistent: true, concentration: false, side: 'ally', bondKey: 'mount',
        ...(mode === 'new-exclusive' || mode === 'own-recall' ? { exclusiveBondKeys: ['mount'] } : {}),
      }] }] }
      const dispose = register(activity)
      try {
        const current = state()
        const bond = createDnd5eMechanicalEffect({ definitionId: `summon-bond:${mode === 'different-key' ? 'other' : 'mount'}`,
          label: 'Bound creature', targetId: 'actor', duration: { type: 'permanent' },
          source: { kind: 'spell', actorId: 'actor', pluginId: mode === 'own-recall' ? 'test.routes' : 'other.package' },
        })
        bond.tags = ['bond-monster:srd-5.1:dire-wolf',
          ...mode === 'existing-exclusive' || mode === 'dismissed-exclusive' ? ['exclusive-bond-key:mount'] : [],
          ...mode === 'dismissed-exclusive' ? ['bond-dismissed'] : [],
        ]
        current.combatants.actor.classState.activeEffects = [bond]
        const before = structuredClone(current)
        const result = resolveDnd5eHeadlessAction(current, action)
        const allowed = ['ordinary-isolated', 'different-key', 'own-recall'].includes(mode)
        expect(result.ok, result.ok ? undefined : result.reason).toBe(allowed)
        expect(current).toEqual(before)
        if (!allowed) {
          expect(result.state.combatants.actor.turn.actionAvailable).toBe(true)
          expect(result.state.combatants.actor.classState.activeEffects).toEqual([bond])
          expect(result.ok ? result.activityHandoffs?.summons ?? [] : []).toHaveLength(0)
        } else if (mode === 'own-recall') {
          if (!result.ok) throw Error(result.reason)
          expect(result.state.combatants.actor.classState.activeEffects).toHaveLength(1)
          expect(result.state.combatants.actor.classState.activeEffects![0].tags).toContain('exclusive-bond-key:mount')
          expect(result.activityHandoffs?.summons[0].exclusiveBondKeys).toEqual(['mount'])
        }
      } finally { dispose() }
    })

  it('exports and reimports a map-remains ward into actual compiled Headless handoffs', async () => {
    const activity: Dnd5eActivityDefinitionV1 = { ...base,
      target: { kind: 'area', relation: 'any', origin: 'point', shape: 'rect', placeRangeFeet: 5,
        widthFeet: 5, lengthFeet: 5, heightFeet: 5, gridAligned: true },
      outcomes: [{ id: 'protect', when: { kind: 'always' }, operations: [{ id: 'protect', kind: 'protect-map-remains',
        durationMinutes: 10080, minimumPower: 'wish' }] }] }
    const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
      manifest: { id: 'test.routes', name: 'Synthetic remains ward', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
      assets: [], definitions: [{ schemaVersion: 1, namespace: 'test.routes', version: '1.0.0', kind: 'feature', id: 'root',
        name: 'Root', automation: base.automation, payload: { id: 'root', name: 'Root', summary: 'Synthetic',
          description: 'Synthetic', automation: 'full' }, activities: [activity] }] }
    const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      const current = state()
      const result = resolveDnd5eHeadlessAction(current, { ...action, targetIds: [], targetId: undefined, castLevel: 1,
        targetCell: { col: 1, row: 0 },
        activityAreaPlacement: { x: 5, y: 0, widthFeet: 5, lengthFeet: 5, heightFeet: 5 },
        activityAreaPlacementDistanceFeet: 5 })
      expect(result.ok, JSON.stringify(result)).toBe(true)
      if (!result.ok) throw Error('Map ward Headless compilation failed')
      expect(result.activityHandoffs?.mapRemainsProtections).toEqual([expect.objectContaining({ kind: 'protect-map-remains', operationId: 'protect',
        durationMinutes: 10080, minimumPower: 'wish', spellLevel: 1 })])
    } finally { dispose() }
  })
  it('admits confirmed corpses only for the selected protective Activity branch', () => {
    const activity: Dnd5eActivityDefinitionV1 = { ...base,
      target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 5 },
      choices: [{ id: 'rite', label: 'Rite', options: [{ id: 'funeral', label: 'Funeral' }, { id: 'other', label: 'Other' }] }],
      effects: [{ schemaVersion: 1, id: 'funeral', name: 'Funeral', stacking: 'replace',
        duration: { kind: 'rounds', rounds: 100800, expiresAt: 'source-turn-end' },
        undeadCreationProtection: { minimumPower: 'wish' } }],
      outcomes: [{ id: 'protect', when: { kind: 'choice', choiceId: 'rite', optionId: 'funeral' },
        operations: [{ id: 'protect', kind: 'apply-effect', effectId: 'funeral', target: 'target' }] }] }
    const dispose = register(activity)
    try {
      const current = state()
      current.combatants.holder.currentHp = 0
      current.combatants.holder.deathSaves.dead = true
      current.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor', 'holder')] = 5
      const request = { ...action, targetId: 'holder', targetIds: ['holder'], distanceFeet: 5,
        payload: { activityChoices: { rite: 'funeral' } } }
      const before = structuredClone(current)
      const protectedResult = resolveDnd5eHeadlessAction(current, request)
      expect(protectedResult.ok, JSON.stringify(protectedResult)).toBe(true)
      if (!protectedResult.ok) throw Error('Funeral registered route failed')
      expect(protectedResult.state.combatants.holder.classState.activeEffects?.some(effect =>
        effect.undeadCreationProtection?.minimumPower === 'wish')).toBe(true)
      expect(resolveDnd5eHeadlessAction(current, { ...request,
        payload: { activityChoices: { rite: 'other' } } }).ok).toBe(false)
      current.combatants.holder.deathSaves.dead = false
      expect(resolveDnd5eHeadlessAction(current, request).ok).toBe(false)
      current.combatants.holder.deathSaves.dead = true
      expect(current).toEqual(before)
    } finally { dispose() }
  })
  it.each(['attack-nearest-visible','attack-nearest-other-subtype'] as const)('passes %s targeting through a native archive into the Host summon handoff',async autonomousBehavior=>{
    const operation={id:'spawn',kind:'summon' as const,monsterId:autonomousBehavior==='attack-nearest-visible'?'srd-5.1:zombie':'srd-5.1:dretch',count:{kind:'constant' as const,value:1},timing:'immediate' as const,durationRounds:600,concentration:false,side:'enemy' as const,autonomousBehavior,requiredCreatureSubtype:autonomousBehavior==='attack-nearest-other-subtype'?'demon':undefined}
    const activity:Dnd5eActivityDefinitionV1={...base,outcomes:[{id:'spawn',when:{kind:'always'},operations:[operation]}]}
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,
      manifest:{id:'test.routes',name:'Synthetic autonomous summon',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only',contentCategory:'mixed'},
      assets:[],definitions:[{schemaVersion:1,namespace:'test.routes',version:'1.0.0',kind:'feature',id:'root',name:'Root',automation:base.automation,
        payload:{id:'root',name:'Root',summary:'Synthetic',description:'Synthetic fixture',automation:'full'},activities:[activity]}]}
    const decoded=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
    expect(decoded.bundle.definitions[0].activities).toEqual([activity])
    const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try{
      const result=resolveDnd5eHeadlessAction(state(),action)
      expect(result.ok,result.ok?'':result.reason).toBe(true)
      if(result.ok)expect(result.activityHandoffs?.summons[0]).toMatchObject({autonomousBehavior,monsterId:operation.monsterId})
    }finally{dispose()}
    for(const patch of [{commandPolicy:'turn-order'},{controlSave:{ability:'cha',dc:{kind:'constant',value:15}}},{cannotAttack:true},{autonomousBehavior:'unknown'}]){
      const invalid={...activity,outcomes:[{id:'spawn',when:{kind:'always'},operations:[{...operation,...patch}]}]}
      expect(validateDnd5eActivityDefinitionV1(invalid as unknown as Dnd5eActivityDefinitionV1).length).toBeGreaterThan(0)
    }
  })
  it.each([5, 6, 7, 8, 9])('restores corpse choices and scaled target limits from an archive at slot level %s', async castLevel => {
    const activity: Dnd5eActivityDefinitionV1 = { ...base,
      target: { kind: 'creature', relation: 'any', count: 5, rangeFeet: 60, requiresLineOfSight: true },
      choices: [{ id: 'form', label: 'Form', options: [
        { id: 'srd-5.1:skeleton', label: 'Skeleton' }, { id: 'srd-5.1:zombie', label: 'Zombie' },
      ] }],
      scaling: [{ basis: 'slot-level', baseLevel: 5, maximumSteps: 4,
        adjustments: [{ operationId: 'animate', additionalTargetsPerStep: 2 }] }],
      outcomes: [{ id: 'animate', when: { kind: 'always' }, operations: [{ id: 'animate', kind: 'summon',
        corpseFormChoiceId: 'form', monsterId: 'srd-5.1:skeleton', count: { kind: 'constant', value: 1 },
        timing: 'immediate', durationRounds: 600, concentration: true, side: 'ally', groupInitiative: true,
        weaponAttackBonus: { kind: 'reference', reference: { kind: 'actor-spellcasting-ability-modifier' } },
        weaponDamageBonus: { kind: 'reference', reference: { kind: 'actor-spellcasting-ability-modifier' } },
        commandPolicy: 'persistent-order' }] }],
    }
    const bundle: Dnd5eUnifiedContentBundleV1 = {
      format: 'dndstars5e-unified-content', schemaVersion: 1,
      manifest: { id: 'test.routes', name: 'Synthetic corpse module', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
      assets: [], definitions: [{ schemaVersion: 1, namespace: 'test.routes', version: '1.0.0',
        kind: 'feature', id: 'root', name: 'Root', automation: base.automation,
        payload: { id: 'root', name: 'Root', summary: 'Synthetic', description: 'Synthetic test fixture', automation: 'full' },
        activities: [activity] }],
    }
    const originalBundle = structuredClone(bundle)
    const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      const current = state()
      current.combatants.actor.saveDc = 15
      for (const [index, id] of ['holder', 'target'].entries()) {
        Object.assign(current.combatants[id], { currentHp: 0, sizeRank: index + 1 })
        current.combatants[id].deathSaves.dead = true
        current.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor', id)] = index ? 60 : 5
      }
      const request = { ...action, castLevel, targetId: 'holder', targetIds: ['holder', 'target'], distanceFeet: 5,
        payload: { activityChoices: { form: 'srd-5.1:skeleton' },
          activityTargetFormIds: { holder: 'srd-5.1:skeleton', target: 'srd-5.1:zombie' } } }
      const before = structuredClone(current)
      const protectedState = structuredClone(current)
      protectedState.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({
        definitionId: 'funeral', label: 'Funeral', targetId: 'target',
        source: { kind: 'spell', actorId: 'actor', rulesId: 'ceremony' },
        undeadCreationProtection: { minimumPower: 'wish' },
        duration: { type: 'rounds', remainingRounds: 100800, tickOn: 'source-turn-end' } })]
      const protectedBefore = structuredClone(protectedState)
      expect(resolveDnd5eHeadlessAction(protectedState, request).ok).toBe(false)
      expect(protectedState).toEqual(protectedBefore)
      const result = resolveDnd5eHeadlessAction(current, request)
      expect(result.ok, JSON.stringify(result)).toBe(true)
      if (!result.ok) return
      expect(result.activityHandoffs?.summons).toEqual([
        expect.objectContaining({ corpseTokenId: 'holder', monsterId: 'srd-5.1:skeleton', count: 1, weaponAttackBonus: 4, weaponDamageBonus: 4 }),
        expect.objectContaining({ corpseTokenId: 'target', monsterId: 'srd-5.1:zombie', count: 1, weaponAttackBonus: 4, weaponDamageBonus: 4 }),
      ])
      expect(current).toEqual(before)
      // The registered feature must preserve the declared group limit rather
      // than silently truncating a request or producing duplicate summons.
      const crowded = structuredClone(current)
      const maximumTargets = 5 + 2 * (castLevel - 5)
      for (let index = 3; index <= maximumTargets + 1; index++) {
        const id = `corpse-${index}`
        crowded.combatants[id] = { ...structuredClone(current.combatants.holder), id }
        crowded.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor', id)] = 30
      }
      const maximumIds = ['holder', 'target', ...Array.from({ length: maximumTargets - 2 }, (_, index) => `corpse-${index + 3}`)]
      const maximum = resolveDnd5eHeadlessAction(crowded, { ...request, targetIds: maximumIds })
      expect(maximum.ok, JSON.stringify(maximum)).toBe(true)
      if (maximum.ok) expect(maximum.activityHandoffs?.summons.map(summon => summon.corpseTokenId)).toEqual(maximumIds)
      const crowdedBefore = structuredClone(crowded)
      expect(resolveDnd5eHeadlessAction(crowded, { ...request, targetIds: [...maximumIds, `corpse-${maximumTargets + 1}`] }).ok).toBe(false)
      expect(crowded).toEqual(crowdedBefore)
      const repeated = resolveDnd5eHeadlessAction(current, { ...request, targetIds: ['holder', 'holder', 'target'] })
      expect(repeated.ok, JSON.stringify(repeated)).toBe(true)
      if (repeated.ok) expect(repeated.activityHandoffs?.summons).toHaveLength(2)
      for (const invalid of ['living', 'unconscious', 'large', 'absent-body', 'far', 'undeclared-form', 'occluded', 'darkness']) {
        const state = structuredClone(current), candidate = structuredClone(request)
        if (invalid === 'living') state.combatants.target.currentHp = 1
        if (invalid === 'unconscious') state.combatants.target.deathSaves.dead = false
        if (invalid === 'large') state.combatants.target.sizeRank = 3
        if (invalid === 'absent-body') state.combatants.target.classState.bodyPresent = false
        if (invalid === 'far') state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor', 'target')] = 65
        if (invalid === 'undeclared-form') candidate.payload.activityTargetFormIds.target = 'srd-5.1:balor'
        if (invalid === 'occluded') state.physicalLineOfSightBlockedByCombatantPair = { [dnd5eDirectedCombatantPairKey('actor', 'target')]: true }
        if (invalid === 'darkness') state.ordinaryDarknessByCombatantPair = { [dnd5eDirectedCombatantPairKey('actor', 'target')]: true }
        const original = structuredClone(state)
        expect(resolveDnd5eHeadlessAction(state, candidate).ok, invalid).toBe(false)
        expect(state).toEqual(original)
      }
      expect(bundle).toEqual(originalBundle)
    } finally { dispose() }
  })
  it.each([1, 2])('does not extend corpse targeting to ordinary %s-target features', count => {
    const activity: Dnd5eActivityDefinitionV1 = { ...base,
      target: { kind: 'creature', relation: 'any', count, rangeFeet: 120 },
      outcomes: [{ id: 'benefit', when: { kind: 'always' }, operations: [
        { id: 'benefit', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 8 } },
      ] }],
    }
    const dispose = register(activity)
    try {
      const current = state()
      const request = { ...action, targetId: 'holder', targetIds: count === 1 ? ['holder'] : ['holder', 'target'], distanceFeet: 100 }
      expect(resolveDnd5eHeadlessAction(current, request).ok).toBe(true)
      current.combatants[count === 1 ? 'holder' : 'target'].currentHp = 0
      const before = structuredClone(current)
      expect(resolveDnd5eHeadlessAction(current, request).ok).toBe(false)
      expect(current).toEqual(before)
    } finally { dispose() }
  })
  it.each(['persistent-order', 'turn-order'] as const)('executes a %s Help order and grants a single allied attack advantage', policy => {
    const activity: Dnd5eActivityDefinitionV1 = { ...base, activation: { kind: 'bonus-action' },
      consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
      target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 120 },
      outcomes: [{ id: 'order', when: { kind: 'always' }, operations: [{ id: 'order', kind: 'command-owned-companion',
        target: 'target', sourceActivityId: 'animate', command: 'help', requiresHelpTarget: true }] }],
    }
    const dispose = register(activity)
    try {
      const initial = state()
      Object.assign(initial.combatants.holder, { summonedSourceCombatantId: 'actor',
        summonedSourcePackageId: 'test.routes', summonedSourceActivityId: 'animate', summonedCommandPolicy: policy })
      const request = { ...action, targetId: 'holder', targetIds: ['holder'], distanceFeet: 100,
        payload: { companionHelpTargets: { order: { targetId: 'target', helpKind: 'attack' } } } }
      for (const selection of [undefined, null, {}, { targetId: 'missing', helpKind: 'attack' },
        { targetId: 'holder', helpKind: 'attack' }, { targetId: 'target', helpKind: 'unknown' }]) {
        expect(resolveDnd5eHeadlessAction(initial, { ...request,
          payload: JSON.parse(JSON.stringify({ companionHelpTargets: { order: selection } })) }).ok).toBe(false)
        expect(initial.combatants.actor.turn.bonusActionAvailable).toBe(true)
      }
      const ordered = resolveDnd5eHeadlessAction(initial, request)
      expect(ordered.ok, JSON.stringify(ordered)).toBe(true)
      if (!ordered.ok) return
      let current = JSON.parse(JSON.stringify(ordered.state)) as typeof initial
      function endTurn(actorId: string) {
        const ended = resolveDnd5eHeadlessAction(current, { type: 'end-turn', actorId })
        expect(ended.ok, JSON.stringify(ended)).toBe(true)
        if (!ended.ok) throw new Error('Cannot advance fixture turn')
        current = ended.state
      }
      endTurn('actor')
      const help = { type: 'help' as const, actorId: 'holder', targetId: 'target', helpKind: 'attack' as const }
      expect(current.combatants.holder.classState.companionCommand).toMatchObject({ helpTargetId: 'target', helpKind: 'attack' })
      expect(resolveDnd5eHeadlessAction(current, { ...help, targetId: 'actor' }).ok).toBe(false)
      expect(resolveDnd5eHeadlessAction(current, { ...help, helpKind: 'ability-check' }).ok).toBe(false)
      const tooFar = structuredClone(current)
      tooFar.distanceFeetByCombatantPair![dnd5eCombatantPairKey('holder', 'target')] = 10
      expect(resolveDnd5eHeadlessAction(tooFar, help).ok).toBe(false)
      expect(tooFar.combatants.holder.turn.actionAvailable).toBe(true)
      const helped = resolveDnd5eHeadlessAction(current, help)
      expect(helped.ok, JSON.stringify(helped)).toBe(true)
      if (!helped.ok) return
      expect(helped.state.combatants.holder.turn.actionAvailable).toBe(false)
      expect(resolveDnd5eHeadlessAction(helped.state, help).ok).toBe(false)
      current = helped.state
      endTurn('holder')
      endTurn('target')
      const attacked = resolveDnd5eHeadlessAction(current, { type: 'attack', actorId: 'actor', targetId: 'target',
        attackModifier: 0, d20: 2, d20Second: 18, damage: { count: 1, sides: 4, bonus: 0, rolls: [2], type: 'piercing' } })
      expect(attacked.ok, JSON.stringify(attacked)).toBe(true)
      if (!attacked.ok) return
      expect(attacked.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))
      expect(attacked.state.combatants.target.classState.helpedAttackSourceId).toBeUndefined()
      expect(initial.combatants.target.classState.helpedAttackSourceId).toBeUndefined()
    } finally { dispose() }
  })
  it.each(['persistent-order', 'turn-order'] as const)('executes a restored %s group order once and clears completed actions', policy => {
    const activity: Dnd5eActivityDefinitionV1 = { ...base, activation: { kind: 'bonus-action' },
      consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
      target: { kind: 'creature', relation: 'any', count: 2, rangeFeet: 120 },
      outcomes: [{ id: 'order', when: { kind: 'always' }, operations: [{ id: 'order', kind: 'command-owned-companion',
        target: 'target', sourceActivityId: 'animate', command: 'dash' }] }],
    }
    const dispose = register(activity)
    try {
      const initial = state()
      for (const id of ['holder', 'target']) Object.assign(initial.combatants[id], {
        summonedSourceCombatantId: 'actor', summonedSourcePackageId: 'test.routes', summonedSourceActivityId: 'animate', summonedCommandPolicy: policy,
      })
      const request = { ...action, targetId: 'holder', targetIds: ['holder', 'target'], distanceFeet: 100 }
      const ordered = resolveDnd5eHeadlessAction(initial, request)
      expect(ordered.ok, JSON.stringify(ordered)).toBe(true)
      if (!ordered.ok) return
      let current = JSON.parse(JSON.stringify(ordered.state)) as typeof initial
      // Replaying the request must not issue a second group order for free.
      expect(resolveDnd5eHeadlessAction(current, request).ok).toBe(false)
      function endTurn(actorId: string) {
        const ended = resolveDnd5eHeadlessAction(current, { type: 'end-turn', actorId })
        expect(ended.ok, JSON.stringify(ended)).toBe(true)
        if (!ended.ok) throw new Error('Could not advance fixture turn')
        current = JSON.parse(JSON.stringify(ended.state)) as typeof initial
      }
      endTurn('actor')
      for (const id of ['holder', 'target']) {
        const before = structuredClone(current)
        // An order authorizes its own action, not another action of the creature's choice.
        expect(resolveDnd5eHeadlessAction(current, { type: 'disengage', actorId: id }).ok).toBe(false)
        expect(current).toEqual(before)
        const dashed = resolveDnd5eHeadlessAction(current, { type: 'dash', actorId: id })
        expect(dashed.ok, JSON.stringify(dashed)).toBe(true)
        if (!dashed.ok) return
        expect(dashed.state.combatants[id].turn.actionAvailable).toBe(false)
        expect(resolveDnd5eHeadlessAction(dashed.state, { type: 'dash', actorId: id }).ok).toBe(false)
        current = dashed.state
        endTurn(id)
        // A persistent order survives waiting for its task, not completion of
        // this one Dash without any remaining movement destination.
        expect(current.combatants[id].classState.companionCommand).toBeUndefined()
      }
      endTurn('actor')
      const nextDash = resolveDnd5eHeadlessAction(current, { type: 'dash', actorId: 'holder' })
      expect(nextDash.ok, JSON.stringify(nextDash)).toBe(false)
      expect(initial.combatants.actor.turn.bonusActionAvailable).toBe(true)
      expect(initial.combatants.holder.classState.companionCommand).toBeUndefined()
    } finally { dispose() }
  })
  it('commands several owned summons with one bonus action and rolls back the whole group on an invalid member', () => {
    const activity: Dnd5eActivityDefinitionV1 = { ...base, activation: { kind: 'bonus-action' },
      consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
      target: { kind: 'creature', relation: 'any', count: 2, rangeFeet: 120 },
      outcomes: [{ id: 'order', when: { kind: 'always' }, operations: [{ id: 'order', kind: 'command-owned-companion',
        target: 'target', sourceActivityId: 'animate', command: 'attack' }] }],
    }
    const dispose = register(activity)
    try {
      const current = state()
      for (const id of ['holder', 'target']) Object.assign(current.combatants[id], {
        summonedSourceCombatantId: 'actor', summonedSourcePackageId: 'test.routes', summonedSourceActivityId: 'animate', summonedCommandPolicy: 'persistent-order',
      })
      const request = { ...action, targetId: 'holder', targetIds: ['holder', 'target'], distanceFeet: 100 }
      const result = resolveDnd5eHeadlessAction(current, request)
      expect(result.ok, JSON.stringify(result)).toBe(true)
      if (!result.ok) return
      for (const id of ['holder', 'target']) expect(result.state.combatants[id].classState.companionCommand).toMatchObject({ command: 'attack', persistentOrder: true })
      expect(result.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
      expect(current.combatants.actor.turn.bonusActionAvailable).toBe(true)
      for (const invalid of ['owner', 'source', 'range']) {
        const rejected = structuredClone(current)
        if (invalid === 'owner') rejected.combatants.target.summonedSourceCombatantId = 'other'
        if (invalid === 'source') rejected.combatants.target.summonedSourceActivityId = 'other'
        if (invalid === 'range') rejected.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor', 'target')] = 125
        const before = structuredClone(rejected)
        expect(resolveDnd5eHeadlessAction(rejected, request).ok, invalid).toBe(false)
        expect(rejected).toEqual(before)
        expect(rejected.combatants.holder.classState.companionCommand).toBeUndefined()
      }
    } finally { dispose() }
  })
  it('applies spoken-name disadvantage to one control save and clears it after the summoned turn', () => {
    const activity: Dnd5eActivityDefinitionV1 = { ...base, activation: { kind: 'free' },
      target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 120 },
      choices: [{ id: 'speech', label: 'Speech', options: [{ id: 'ordinary', label: 'Ordinary' }, { id: 'name', label: 'Known name spoken' }] }],
      outcomes: [false, true].map(named => ({ id: named ? 'named' : 'ordinary',
        when: { kind: 'choice' as const, choiceId: 'speech', optionId: named ? 'name' : 'ordinary' },
        operations: [{ id: named ? 'named-order' : 'ordinary-order', kind: 'command-owned-companion' as const,
          target: 'target' as const, command: 'attack' as const, sourceActivityId: 'summon', requiresSpeech: true,
          controlSaveDisadvantage: named }] })),
    }
    const dispose = register(activity)
    try {
      const current = state(), companion = current.combatants.holder
      Object.assign(companion, { summonedSourceCombatantId: 'actor', summonedSourcePackageId: 'test.routes', summonedSourceActivityId: 'summon', summonedCommandPolicy: 'turn-order' })
      const control = createDnd5eMechanicalEffect({ id: 'control', definitionId: 'summon-control', label: 'Control',
        targetId: 'holder', source: { kind: 'spell', actorId: 'actor' }, duration: { type: 'permanent' } })
      control.repeatSave = { ability: 'cha', dc: 15, timing: 'target-turn-end', onSuccess: 'remove' }
      companion.classState.activeEffects = [control]
      const request = { ...action, targetId: 'holder', targetIds: ['holder'], distanceFeet: 100,
        payload: { activityChoices: { speech: 'name' } } }
      for (const voice of [{ conditions: ['silenced'] }, { soundSuppressed: true }, { languages: ['understands Common but cannot speak'] }]) {
        const silent = structuredClone(current)
        Object.assign(silent.combatants.actor, voice)
        if ('conditions' in voice) silent.combatants.actor.classState.activeEffects = [createDnd5eMechanicalEffect({
          definitionId: 'silenced', label: 'Silenced', legacyCondition: 'silenced', targetId: 'actor',
          source: { kind: 'spell', actorId: 'target' }, duration: { type: 'permanent' },
        })]
        expect(resolveDnd5eHeadlessAction(silent, request).ok, JSON.stringify(voice)).toBe(false)
        expect(silent.combatants.holder.classState.companionCommand).toBeUndefined()
      }
      const named = resolveDnd5eHeadlessAction(current, request)
      expect(named.ok, JSON.stringify(named)).toBe(true)
      if (!named.ok) return
      expect(named.state.combatants.actor.turn.actionAvailable).toBe(true)
      expect(named.state.combatants.holder.classState.activeEffects![0].repeatSave?.disadvantage).toBe(true)
      const advanced = resolveDnd5eHeadlessAction(named.state, { type: 'end-turn', actorId: 'actor' })
      expect(advanced.ok).toBe(true)
      if (!advanced.ok) return
      expect(resolveDnd5eHeadlessAction(advanced.state, request).ok).toBe(false)
      const saved = resolveDnd5eHeadlessAction(advanced.state, { type: 'end-turn', actorId: 'holder',
        activeEffectSavingThrows: [{ effectId: 'control', d20: 20, d20Second: 1 }] })
      expect(saved.ok, JSON.stringify(saved)).toBe(true)
      if (!saved.ok) return
      expect(saved.state.combatants.holder.classState.companionCommand).toBeUndefined()
      expect(saved.state.combatants.holder.classState.activeEffects?.find(effect => effect.id === 'control')?.repeatSave)
        .toMatchObject({ dc: 15, disadvantage: undefined })
      const ordinary = resolveDnd5eHeadlessAction(current, { ...request, payload: { activityChoices: { speech: 'ordinary' } } })
      expect(ordinary.ok).toBe(true)
      if (ordinary.ok) expect(ordinary.state.combatants.holder.classState.activeEffects![0].repeatSave?.disadvantage).toBe(false)
    } finally { dispose() }
  })
  it('routes the selected declared summon profile and rejects undeclared choices', () => {
    const activity: Dnd5eActivityDefinitionV1 = { ...base,
      choices: [{ id: 'summon-profile', label: 'Profile', optionsFrom: 'srd-monsters', options: [],
        monsterFilter: { creatureTypes: ['fiend'], subtype: 'demon', maximumChallengeRating: 30 } }],
      outcomes: [{ id: 'summon', when: { kind: 'always' }, operations: [{
        id: 'summon', kind: 'summon', monsterId: 'srd-5.1:dretch', monsterChoiceId: 'summon-profile',
        count: { kind: 'constant', value: 1 }, timing: 'immediate', durationRounds: 10,
        concentration: true, side: 'ally', maximumChallengeRating: { kind: 'constant', value: 1 }, requiredCreatureSubtype: 'demon',
      }] }],
    }
    const dispose = register(activity)
    try {
      for (const monsterId of ['srd-5.1:dretch', 'srd-5.1:quasit']) {
        const result = resolveDnd5eHeadlessAction(state(), { ...action, payload: { activityChoices: { 'summon-profile': monsterId } } })
        expect(result.ok, JSON.stringify(result)).toBe(true)
        if (result.ok) expect(result.activityHandoffs?.summons[0]).toMatchObject({ monsterId, maximumChallengeRating: 1, requiredCreatureSubtype: 'demon' })
      }
      // A catalog option may be visible but still exceed this casting's limit.
      for (const monsterId of ['srd-5.1:vrock', 'srd-5.1:balor']) {
        const before = state(), snapshot = structuredClone(before)
        const invalid = resolveDnd5eHeadlessAction(before, { ...action, payload: { activityChoices: { 'summon-profile': monsterId } } })
        expect(invalid.ok).toBe(false)
        expect(before).toEqual(snapshot)
        expect(invalid.state.combatants.actor.turn).toEqual(snapshot.combatants.actor.turn)
      }
    } finally { dispose() }
  })
  it('combines different weapon and ammunition spells without stacking duplicate copies of the same spell',()=>{
    const current=state(), actor=current.combatants.actor
    actor.classState.activeEffects=[['holy','holy',2,8,'radiant'],['holy-copy','holy',2,8,'radiant'],['flames','flames',1,6,'fire']].map(([id,definitionId,count,sides,type])=>createDnd5eMechanicalEffect({id:String(id),definitionId:String(definitionId),label:String(id),source:{kind:'spell',actorId:'actor'},targetId:'actor',duration:{type:'permanent'},modifiers:{weaponEnchantment:{weaponId:'bow',attackAndDamageBonus:0,bonusDamage:{count:Number(count),sides:Number(sides),type:type as 'radiant'|'fire'}}}}))
    const result=resolveDnd5eHeadlessAction(current,{type:'attack',actorId:'actor',targetId:'holder',attackModifier:10,d20:12,damage:{count:1,sides:8,bonus:0,rolls:[2],type:'piercing'},classDamageContext:{weaponId:'bow',mode:'ranged',finesse:false,strengthBased:false,weaponDamageSides:8,damageType:'piercing',adjacentEnemyOfTarget:false},classDamageRolls:[{source:'activity-effect-rider',rollId:'activity-effect-rider:holy',rolls:[3,4]},{source:'activity-effect-rider',rollId:'activity-effect-rider:flames',rolls:[5]}]})
    expect(result.ok,JSON.stringify(result)).toBe(true)
    if(result.ok)expect(result.state.combatants.holder.currentHp).toBe(26)
  })
  it('restricts uncontrolled attacks to the nearest non-demon and excludes warded occupants',()=>{
    const current=state()
    current.combatants.actor.summonedUncontrolledSubtype='demon'
    const attack={type:'attack' as const,actorId:'actor',targetId:'holder',attackModifier:4,d20:10,damage:{count:1,sides:6,bonus:2,rolls:[3],type:'slashing' as const}}
    expect(resolveDnd5eHeadlessAction(current,{...attack,targetId:'target'})).toMatchObject({ok:false,reason:'invalid-target'})
    expect(resolveDnd5eHeadlessAction(current,attack).ok).toBe(true)
    current.combatants.holder.statBlockId='srd-5.1:dretch'
    expect(resolveDnd5eHeadlessAction(current,attack)).toMatchObject({ok:false,reason:'invalid-target'})
    expect(resolveDnd5eHeadlessAction(current,{...attack,targetId:'target'}).ok).toBe(true)
    current.combatants.target.protectedFromActorIds=['actor']
    expect(resolveDnd5eHeadlessAction(current,{...attack,targetId:'target'})).toMatchObject({ok:false,reason:'invalid-target'})
  })
  it.each(['persistent-order', 'turn-order'] as const)('permits an uncommanded %s summon to retaliate only against a previous attacker',policy=>{
    const current=state()
    Object.assign(current.combatants.actor,{summonedSourceCombatantId:'holder',summonedSourcePackageId: 'test.routes', summonedSourceActivityId:'summon',summonedCommandPolicy:policy})
    const attack={type:'attack' as const,actorId:'actor',targetId:'target',attackModifier:4,d20:10,damage:{count:1,sides:6,bonus:2,rolls:[3],type:'slashing' as const}}
    expect(resolveDnd5eHeadlessAction(current,attack).ok).toBe(false)
    current.combatants.actor.classState.summonAttackerIds=['target']
    expect(resolveDnd5eHeadlessAction(current,attack).ok).toBe(true)
    expect(resolveDnd5eHeadlessAction(current,{...attack,targetId:'holder'}).ok).toBe(false)
    current.combatants.actor.classState.companionCommand = { schemaVersion: 1, sourceOwnerId: 'holder',
      sourceFeatureId: 'summon', command: 'dodge', issuedRound: current.round, persistentOrder: policy === 'persistent-order' }
    expect(resolveDnd5eHeadlessAction(current,attack).ok).toBe(false)
  })
  it('shares an imported self spell only with the mount actually being ridden, without another action cost',()=>{
    const activity:Dnd5eActivityDefinitionV1={...base,consumption:[{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'}],outcomes:[{id:'benefit',when:{kind:'always'},operations:[{id:'benefit',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:8}}]}]}
    const dispose=register(activity,true)
    try {
      const current=state(), mount=current.combatants.holder
      Object.assign(mount,{summonedSourceCombatantId:'actor',summonedShareSelfSpellsRangeFeet:5,summonedShareSelfSpellsRequiresMounted:true})
      current.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor','holder')]=0
      const unmounted=resolveDnd5eHeadlessAction(current,action)
      expect(unmounted.ok,JSON.stringify(unmounted)).toBe(true)
      if(unmounted.ok)expect(unmounted.state.combatants.holder.temporaryHp).toBe(0)
      mount.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'riding',label:'Riding',source:{kind:'feature',actorId:'actor',rulesId:'basic-action:mount'},targetId:'holder',legacyCondition:'attached',relation:{schemaVersion:1,kind:'attachment',sourceActorId:'actor',sourceActionId:'basic-action:mount',slotGroup:'riding',maxDistanceFeet:5,movement:'source-rides-target',endsOnSourceIncapacitated:true}})]
      const mounted=resolveDnd5eHeadlessAction(current,action)
      expect(mounted.ok,JSON.stringify(mounted)).toBe(true)
      if(mounted.ok){expect(mounted.state.combatants.holder.temporaryHp).toBe(8);expect(mounted.state.combatants.actor.temporaryHp).toBe(8);expect(mounted.state.combatants.actor.turn.actionAvailable).toBe(false)}
    }finally{dispose()}
  })
  it.each([false,true])('dismisses an owned companion through the registered route, release=%s',releaseBond=>{
    const activity:Dnd5eActivityDefinitionV1={...base,outcomes:[{id:'dismiss',when:{kind:'always'},operations:[{id:'dismiss',kind:'dismiss-owned-summon',bondKey:'steed',releaseBond}]}]}
    const dispose=register(activity)
    try {
      const current=state()
      current.combatants.actor.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'summon-bond:steed',label:'Bond',targetId:'actor',source:{kind:'spell',actorId:'actor',pluginId:'test.routes'},duration:{type:'permanent'}})]
      const result=resolveDnd5eHeadlessAction(current,action)
      expect(result.ok,JSON.stringify(result)).toBe(true)
      if(result.ok){expect(result.events).toContainEqual({type:'summon-dismissed',actorId:'actor',bondKey:'steed',packageId:'test.routes',releaseBond});expect(result.state.combatants.actor.classState.activeEffects?.some(effect=>effect.definitionId==='summon-bond:steed')).toBe(!releaseBond)}
      expect(resolveDnd5eHeadlessAction(state(),action).ok).toBe(false)
    }finally{dispose()}
  })
  it.each(['weapon-light','activity:test.routes:spell:weapon-light:modifiers:0'])('measures a bound weapon burst from its current holder with definition %s',definitionId=>{
    const activity:Dnd5eActivityDefinitionV1={...base,target:{kind:'creature',relation:'any',count:1,rangeFeet:100000,requiresLineOfEffect:true,effectOrigin:{effectId:'weapon-light',rangeFeet:30}},outcomes:[{id:'burst',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',amount:{kind:'constant',value:7},damageType:'radiant'}]}]}
    const dispose=register(activity)
    try{
      const current=state()
      const effect=createDnd5eMechanicalEffect({definitionId,label:'Light',targetId:'holder',source:{kind:'spell',actorId:'actor'},duration:{type:'permanent'},modifiers:{weaponEnchantment:{weaponId:'sword',inventoryInstanceId:'bound-sword',attackAndDamageBonus:0}}})
      current.combatants.holder.classState.activeEffects=[effect]
      current.lineOfEffectBlockedByCombatantPair = { [dnd5eDirectedCombatantPairKey('actor', 'target')]: true }
      const cast=resolveDnd5eHeadlessAction(current,{...action,targetId:'target',targetIds:['target'],distanceFeet:105})
      expect(cast.ok,JSON.stringify(cast)).toBe(true)
      if(cast.ok)expect(cast.state.combatants.target.currentHp).toBe(33)
      current.lineOfEffectBlockedByCombatantPair[dnd5eDirectedCombatantPairKey('holder', 'target')] = true
      const beforeBlocked = structuredClone(current)
      expect(resolveDnd5eHeadlessAction(current,{...action,targetId:'target',targetIds:['target'],distanceFeet:105}).ok).toBe(false)
      expect(current).toEqual(beforeBlocked)
      delete current.lineOfEffectBlockedByCombatantPair[dnd5eDirectedCombatantPairKey('holder', 'target')]
      current.distanceFeetByCombatantPair![dnd5eCombatantPairKey('holder','target')]=35
      expect(resolveDnd5eHeadlessAction(current,{...action,targetId:'target',targetIds:['target'],distanceFeet:105}).ok).toBe(false)
      effect.source.actorId='other-caster'
      expect(resolveDnd5eHeadlessAction(current,{...action,targetId:'target',targetIds:['target'],distanceFeet:105}).ok).toBe(false)
    }finally{dispose()}
  })
  it('commits a persistent corpse order through the plugin compiler, not only the direct authority API',()=>{
    const activity:Dnd5eActivityDefinitionV1={...base,activation:{kind:'bonus-action'},consumption:[{kind:'action-economy',economy:'bonus-action',amount:1,consumeOn:'resolve'}],target:{kind:'creature',relation:'any',count:1,rangeFeet:120},outcomes:[{id:'order',when:{kind:'always'},operations:[{id:'order',kind:'command-owned-companion',target:'target',sourceActivityId:'animate',command:'attack'}]}]}
    const dispose=register(activity)
    try{
      const current=state()
      Object.assign(current.combatants.holder,{summonedSourceCombatantId:'actor',summonedSourcePackageId: 'test.routes', summonedSourceActivityId:'animate',summonedCommandPolicy:'persistent-order'})
      const result=resolveDnd5eHeadlessAction(current,{...action,targetId:'holder',targetIds:['holder'],distanceFeet:100})
      expect(result.ok,JSON.stringify(result)).toBe(true)
      if(result.ok){expect(result.state.combatants.holder.classState.companionCommand).toMatchObject({command:'attack',persistentOrder:true});expect(result.state.combatants.actor.turn.bonusActionAvailable).toBe(false)}
      current.combatants.holder.summonedSourceCombatantId='other'
      expect(resolveDnd5eHeadlessAction(current,{...action,targetId:'holder',targetIds:['holder'],distanceFeet:100}).ok).toBe(false)
    }finally{dispose()}
  })
  it('persists a bond and its control activities when a companion is created through the compiler',()=>{
    const activity:Dnd5eActivityDefinitionV1={...base,outcomes:[{id:'summon',when:{kind:'always'},operations:[{id:'summon',kind:'summon',monsterId:'srd-5.1:dire-wolf',count:{kind:'constant',value:1},timing:'immediate',concentration:false,persistent:true,side:'ally',bondKey:'steed',bondDismissActivityId:'dismiss',bondActivityIds:['telepathy']}]}]}
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const temporary = structuredClone(activity)
    const operation = temporary.outcomes[0].operations[0]
    if (operation.kind !== 'summon') throw new Error('expected summon fixture')
    operation.persistent = false
    expect(validateDnd5eActivityDefinitionV1(temporary)).toContain('activity.outcomes[0].operations[0].durationRounds is invalid')
    const dispose=register(activity)
    try{
      const result=resolveDnd5eHeadlessAction(state(),action)
      expect(result.ok,JSON.stringify(result)).toBe(true)
      if(result.ok){expect(result.state.combatants.actor.classState.activeEffects).toEqual(expect.arrayContaining([expect.objectContaining({definitionId:'summon-bond:steed',duration:{type:'permanent'},grantedActivities:['dismiss','telepathy']})]));expect(result.activityHandoffs?.summons[0]).toMatchObject({bondKey:'steed',persistent:true})}
    }finally{dispose()}
  })
})

