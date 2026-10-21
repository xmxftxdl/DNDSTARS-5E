import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {compileDnd5eActivityHeadlessAction} from './activities/dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './activities/dnd5eActivityFeatureActionAdapter'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {dnd5eCombatantPairKey} from './headlessCombatPrimitives'
import {registerDnd5eActivityPackage} from './activities/dnd5eActivityRegistry'
import {resolveRegisteredDnd5eActivityInCombatV1} from './activities/dnd5eActivityCombatAuthority'

it.each([0,1])('limits compiled spell healing maximum to qualifying caster and zero HP (HP %s)',hp=>{
 for(const path of ['compiled','registered'] as const)for(const count of [1,2])for(const owned of [true,false])for(const kind of ['spell','feature'] as const){
  const pluginId='test.zero-hp-healing'
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'heal',name:'Synthetic healing',activation:{kind:'free'},target:{kind:'creature',relation:'any',count:1,rangeFeet:30},legacySource:{kind,id:'heal'},automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'heal',when:{kind:'always'},operations:[{id:'heal',kind:'healing',target:'target',amount:{kind:'add',values:[{kind:'dice',rollId:'heal',count:2,sides:8},{kind:'constant',value:3}]}}]}]}
  if(count===2){
   activity.target={kind:'creature',relation:'any',count:2,rangeFeet:30}
   activity.outcomes=[{id:'heal',when:{kind:'always'},operations:[{id:'heal',kind:'healing',target:'all-targets',amount:{kind:'add',values:[{kind:'dice',rollId:'heal',count:2,sides:8},{kind:'constant',value:3}]}}]}]
  }
  const dispose=registerDnd5eRulesPlugin({manifest:{id:pluginId,name:'Synthetic',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
   api.registerFeature({id:'maximum',name:'Maximum',summary:'Test',description:'Test',automation:'full',declarativeAbility:{schemaVersion:1,id:'maximum',name:'Maximum',description:'Test',level:1,trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],automation:'full',mechanic:{kind:'spell-healing-dice-maximum',targetHp:'zero'}}})
   api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
   api.registerFeature({id:'heal',name:'Heal',summary:'Test',description:'Test',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(activity)})
  }})
  const registration=registerDnd5eActivityPackage({packageId:pluginId,packageVersion:'1.0.0',activities:[activity]})
  try{
   const make=(id:string,currentHp:number)=>createDnd5eCombatant({id,name:id,controller:'player',initiative:id==='caster'?20:1,abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10},proficiencyBonus:2,armorClass:10,currentHp,maxHp:50,temporaryHp:0,speed:30,position:{x:id==='caster'?0:5,y:0},concentrating:false})
   const caster=make('caster',50),target=make('target',50)
   caster.pluginFeatureIds=[`${pluginId}:heal`,...(owned?[`${pluginId}:maximum`]:[])]
   caster.classSelections={'spell-prepared':kind==='spell'?[`${pluginId}:heal`]:[]}
   const state=startDnd5eHeadlessCombat('maximum',[caster,target,...(count===2?[make('other',1)]:[])])
   state.combatants.target.currentHp=hp
   state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('caster','target')]:5}
   if(count===2)state.distanceFeetByCombatantPair[dnd5eCombatantPairKey('caster','other')]=5
   const before=structuredClone(state)
   const action={type:'plugin' as const,pluginId,actionId:'heal',featureId:`${pluginId}:heal`,actorId:'caster',targetId:'target',...(count===2?{targetIds:['target','other']}:{}),distanceFeet:5,rolls:{heal:{values:[1,2],modifier:0,total:3}}}
   const run=(snapshot:typeof state)=>path==='compiled'?resolveDnd5eHeadlessAction(snapshot,action):resolveRegisteredDnd5eActivityInCombatV1({
    state:snapshot,combatRevision:1,confirmedBy:'actor',authoritativeRolls:{heal:{values:[1,2]}},
    command:{schemaVersion:1,commandId:'healing-maximum',actorId:'caster',packageId:pluginId,packageVersion:'1.0.0',activityId:'heal',targetIds:count===2?['target','other']:['target'],expectedRevision:1},
   }).result
   const result=run(state)
   expect(result.ok,JSON.stringify(result)).toBe(true)
   if(!result.ok)throw Error(JSON.stringify(result))
   expect(result.state.combatants.target.currentHp).toBe(hp+(owned&&kind==='spell'&&hp===0?19:6))
   expect(state).toEqual(before)
   if(path==='registered'&&kind==='spell'){
    const unlearned=structuredClone(state)
    unlearned.combatants.caster.classSelections={}
    expect(run(unlearned)).toMatchObject({ok:false,reason:'unauthorized-actor'})
    expect(unlearned.combatants.target.currentHp).toBe(hp)
   }
   if(count===2)expect(result.state.combatants.other.currentHp).toBe(7)
   const second=run(JSON.parse(JSON.stringify(result.state)))
   expect(second.ok,JSON.stringify(second)).toBe(true)
   if(!second.ok)throw Error(JSON.stringify(second))
   expect(second.state.combatants.target.currentHp).toBe(result.state.combatants.target.currentHp+6)
   if(count===2)expect(second.state.combatants.other.currentHp).toBe(13)
   const dead=structuredClone(state)
   dead.combatants.target.currentHp=0
   dead.combatants.target.deathSaves.dead=true
   const rejected=run(dead)
   expect(rejected.ok).toBe(false)
   if('state' in rejected)expect(rejected.state.combatants.target.currentHp).toBe(0)
   expect(dead.combatants.target.currentHp).toBe(0)
  }finally{registration.dispose();dispose()}
 }
})
