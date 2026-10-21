import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

// Portable synthetic mechanism composition, not a repaired source conversion.
it.each(['hit','save','miss','short','corner','curved','split','mounted-other-turn','dragged-other-turn','expired','low-level'] as const)(
  'uses committed movement immediately preceding the attack after archive import: %s',async mode=>{
  const namespace='test.attack-movement'
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'impact',name:'Impact',activation:{kind:'free'},
    legacySource:{kind:'feature',id:'charge'},automation:automationCapabilityFromLegacyStatus('full'),
    target:{kind:'creature',count:1,relation:'any'},invocation:{kind:'triggered',event:'attack-hit',confirmation:'automatic'},
    requirements:[{kind:'turn-owner',owner:'actor'},{kind:'class-level',classId:'fighter',minimum:15},
      {kind:'movement-distance',basis:'before-attack-straight-streak',minimumFeet:10},
      {kind:'active-effect',subject:'actor',effectId:'used',source:'self',present:false}],
    checks:[{id:'save',kind:'saving-throw',rollId:'save',ability:'str',scope:'per-target',rollMode:'host-derived',dc:{kind:'add',values:[
      {kind:'constant',value:8},{kind:'reference',reference:{kind:'actor-proficiency-bonus'}},
      {kind:'reference',reference:{kind:'actor-ability-modifier',ability:'str'}}]}}],
    effects:[{schemaVersion:1,id:'used',name:'Used',stacking:'replace',duration:{kind:'rounds',rounds:1,expiresAt:'target-turn-end'},modifiers:[]}],
    outcomes:[{id:'used',when:{kind:'always'},operations:[{id:'used',kind:'apply-effect',target:'actor',effectId:'used'}]},
      {id:'fall',when:{kind:'check',checkId:'save',result:'failure'},operations:[{id:'fall',kind:'apply-standard-condition',target:'target',condition:'prone',duration:{kind:'permanent'}}]}]}
  const cleanup:Dnd5eActivityDefinitionV1={...activity,id:'cleanup',target:{kind:'self'},requirements:[],checks:[],effects:[],
    invocation:{kind:'triggered',event:'turn-end',confirmation:'automatic'},
    outcomes:[{id:'clear',when:{kind:'always'},operations:[{id:'clear',kind:'remove-effect',target:'actor',effectId:'used',source:'self'}]}]}
  const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,assets:[],
    manifest:{id:namespace,name:'Movement snapshot',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0',distributionPolicy:'local-only'},
    definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:'charge',name:'Charge',automation:automationCapabilityFromLegacyStatus('full'),
      payload:{id:'charge',name:'Charge',summary:'Test',description:'Test',automation:'full'},activities:[activity,cleanup]}]}
  const archive=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(archive.bundle))
  try{
    const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,initiative,controller:id==='target'?'dm':'player',
      abilities:{str:id==='actor'?18:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:5,
      armorClass:10,currentHp:50,maxHp:50,temporaryHp:0,speed:40,position:{x:0,y:0},concentrating:false,
      classLevels:id==='actor'?{fighter:mode==='low-level'?14:15}:undefined,pluginFeatureIds:id==='actor'?[`${namespace}:charge`]:[]})
    let state=startDnd5eHeadlessCombat('snapshot',[make('actor',30),make('mount',mode==='mounted-other-turn'||mode==='dragged-other-turn'?40:20),make('target',10)])
    state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','mount')]:0}
    let saves=0
    const settle=async(events:Parameters<typeof settleDnd5eActivityTriggerWindowsV1>[0]['events'],batch:string)=>{
      const result=await settleDnd5eActivityTriggerWindowsV1({state,events,eventBatchId:batch,combatRevision:1,confirm:async()=>true,
        roll:async request=>{saves++;expect(request.rollerTokenId).toBe('target');return [mode==='save'?17:16]}})
      state=result.state
      return result
    }
    if(mode==='mounted-other-turn'||mode==='dragged-other-turn'){
      state.combatants.mount.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'ride',label:'Ride',
        source:{kind:'feature',actorId:'actor',rulesId:'basic-action:mount'},targetId:'mount',legacyCondition:'attached',
        relation:{schemaVersion:1,kind:'attachment',sourceActorId:'actor',sourceActionId:'basic-action:mount',slotGroup:'riding',
          maxDistanceFeet:5,movement:'source-rides-target',endsOnSourceIncapacitated:true}})]
      if(mode==='dragged-other-turn'){
        state.combatants.mount.classState.activeEffects=[]
        state.combatants.actor.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'drag',label:'Drag',legacyCondition:'grappled',
          source:{kind:'feature',actorId:'mount'},targetId:'actor',relation:{schemaVersion:1,kind:'grapple',sourceActorId:'mount',sourceActionId:'basic-action:grapple',
            slotGroup:'free-hand',maxDistanceFeet:5,movement:'drag-target',endsOnSourceIncapacitated:true}})]
      }
    }
    const mover=mode==='mounted-other-turn'||mode==='dragged-other-turn'?'mount':'actor'
    const move=(x:number,y:number,distance:number,straightLine=true)=>{
      const result=resolveDnd5eHeadlessAction(state,{type:'move',actorId:mover,to:{x,y},distance,straightLine})
      expect(result.ok,JSON.stringify(result)).toBe(true)
      state=JSON.parse(JSON.stringify(result.state))
    }
    if(mode==='split')move(5,0,5)
    move(mode==='short'?5:10,0,mode==='short'||mode==='split'?5:10,mode!=='curved')
    if(mode==='corner')move(10,5,5)
    if(mode==='mounted-other-turn'||mode==='dragged-other-turn'){
      expect(state.combatants.actor.classState.straightMovementStreak?.distanceFeet).toBe(mode==='mounted-other-turn'?10:undefined)
      const ended=resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:'mount'});expect(ended.ok).toBe(true);state=ended.state
      await settle(ended.events,'mount-end')
    }
    if(mode==='expired'){
      for(const id of ['actor','mount','target']){
        const ended=resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:id});expect(ended.ok).toBe(true);state=ended.state
        await settle(ended.events,`end-${id}`)
      }
    }
    const attack=(again=false)=>resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'actor',targetId:'target',attackModifier:9,d20:mode==='miss'&&!again?1:15,spendAction:!again,
      damage:{count:1,sides:4,bonus:0,rolls:[1]}})
    const result=attack();expect(result.ok,JSON.stringify(result)).toBe(true);state=result.state
    const settled=await settle(result.events,'first-hit')
    const eligible=['hit','save','split'].includes(mode)
    expect(saves,JSON.stringify(settled.diagnostics)).toBe(eligible?1:0)
    expect(state.combatants.target.conditions.includes('prone')).toBe(eligible&&mode!=='save')
    const prior=JSON.parse(JSON.stringify(state))
    await settle(result.events,'first-hit');expect(state.combatants).toEqual(prior.combatants);expect(saves).toBe(eligible?1:0)
    expect(state.combatants.actor.classState.straightMovementStreak).toBeUndefined()
    if(mode==='miss'){
      const second=attack(true);expect(second.ok).toBe(true);state=second.state
      await settle(second.events,'second-hit');expect(saves).toBe(0)
      move(20,0,10)
      const third=attack(true);expect(third.ok).toBe(true);state=third.state
      await settle(third.events,'third-hit');expect(saves).toBe(1)
      expect(state.combatants.target.conditions).toContain('prone')
    }
  }finally{dispose()}
})
