import {expect,it} from 'vitest'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {dnd5eActivityTargetOutcomeGateV1} from './dnd5eActivitySaveGate'
import {collectScaledDnd5eActivityFormulaRollDeclarationsV1} from './dnd5eActivityRollRecipe'
import {resolveDnd5eActivity,type Dnd5eActivityExecutionInput} from './dnd5eActivityExecutor'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from '../headlessCombatEngine'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {registerDnd5eActivityPackage} from './dnd5eActivityRegistry'
import {compileDnd5eActivityHeadlessAction} from './dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './dnd5eActivityFeatureActionAdapter'
import {dnd5eCombatantPairKey} from '../headlessCombatPrimitives'

const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'conditional-crush',name:'Conditional crush',activation:{kind:'free'},
 target:{kind:'creature',relation:'any',count:2},automation:automationCapabilityFromLegacyStatus('full'),
 checks:[{id:'save',kind:'saving-throw',rollId:'save',ability:'dex',dc:{kind:'constant',value:15},scope:'per-target',allowWillingFailure:true}],
 outcomes:[{id:'crush',when:{kind:'all',conditions:[{kind:'check',checkId:'save',result:'failure'},
  {kind:'predicate',predicate:{kind:'upward-clearance',subject:'target',distanceFeet:'area-height',blocked:true}}]},
 operations:[{id:'crush',kind:'damage',target:'target',damageType:'bludgeoning',amount:{kind:'dice',rollId:'crush',count:6,sides:6}}]}]}
const actor={id:'caster',controller:'dm' as const,level:11,proficiencyBonus:4,abilities:{str:10,dex:10,con:10,int:10,wis:18,cha:10},armorClass:10,currentHp:60,maxHp:60,conditions:[]}
function input(clearance:number|undefined,save:number|undefined):Dnd5eActivityExecutionInput{return {activity,actor,
 targets:[{...actor,id:'target',upwardClearanceFeet:clearance}],areaPlacement:{x:0,y:0,heightFeet:30},
 rolls:save==null?{}:{'save:target':{values:[save]}}}}
function recipe(value:Dnd5eActivityExecutionInput){return collectScaledDnd5eActivityFormulaRollDeclarationsV1(value.activity,{
 targetOutcomeGate:when=>dnd5eActivityTargetOutcomeGateV1(value,[],when),targetCount:value.targets.length})}
it.each([[10,1,true],[100,1,false],[10,20,false],[undefined,1,true],[10,undefined,true]] as const)(
 'requests crush dice only when needed or unresolved (clearance %s, save %s)',(clearance,save,needed)=>{
  expect(recipe(input(clearance,save)).length>0).toBe(needed)
 })
it('accepts an omitted damage roll when the authoritative outcome cannot damage',()=>{
 for(const value of [input(100,1),input(10,20)]){
  const result=resolveDnd5eActivity(value)
  expect(result.ok,JSON.stringify(result)).toBe(true)
  if(result.ok)expect(result.proposals.some(p=>p.kind==='deal-damage')).toBe(false)
 }
})
it('preserves damage for willing failures and mixed targets',()=>{
 const willing={...input(10,20),willingTargetIds:['target']}
 expect(recipe(willing)).toHaveLength(1)
 const mixed=input(100,1)
 mixed.targets=[...mixed.targets,{...actor,id:'second',upwardClearanceFeet:10}]
 mixed.rolls={...mixed.rolls,'save:second':{values:[1]}}
 expect(recipe(mixed)).toHaveLength(1)
})
it('preserves actor damage and shared dice still used by another operation',()=>{
 const value=input(100,1),definition=structuredClone(activity)
 definition.outcomes=[...definition.outcomes,{id:'other',when:{kind:'always'},operations:[
  {id:'self',kind:'damage',target:'actor',damageType:'force',amount:{kind:'dice',rollId:'self',count:1,sides:4}},
  {id:'heal',kind:'healing',target:'actor',amount:{kind:'dice',rollId:'crush',count:6,sides:6}},
 ]}]
 expect(recipe({...value,activity:definition}).map(r=>r.id).sort()).toEqual(['crush','self'])
})

it('Headless accepts absent inactive pools and valid legacy extras, but rejects missing active or malformed pools',()=>{
 const definition=structuredClone(activity)
 definition.target={kind:'creature',relation:'any',count:1,rangeFeet:60}
 definition.legacySource={kind:'feature',id:definition.id}
 if(definition.outcomes[0].when.kind==='all'){
  const predicate=definition.outcomes[0].when.conditions[1]
  if(predicate.kind==='predicate'&&predicate.predicate.kind==='upward-clearance')predicate.predicate.distanceFeet=30
 }
 const packageId='test.conditional-crush'
 const registration=registerDnd5eActivityPackage({packageId,packageVersion:'1.0.0',activities:[definition]})
 const dispose=registerDnd5eRulesPlugin({manifest:{id:packageId,name:'Conditional crush',version:'1.0.0',apiVersion:2,
  rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
  api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
  api.registerFeature({id:definition.id,name:definition.name,summary:'Synthetic',description:'Synthetic',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(definition)})
 }})
 try{
  const make=(id:string)=>createDnd5eCombatant({...actor,id,name:id,initiative:10,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const state=startDnd5eHeadlessCombat('damage-gate',[make('caster'),make('target')])
  state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('caster','target')]:5}
  state.combatants.caster.pluginFeatureIds=[`${packageId}:${definition.id}`]
  state.combatants.target.upwardClearanceFeet=10
  const run=(save:number,damage?:number[])=>resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:packageId,
   actionId:definition.id,featureId:`${packageId}:${definition.id}`,actorId:'caster',targetId:'target',distanceFeet:5,
   rolls:{'save:target':{values:[save],modifier:0,total:save},...(damage?{crush:{values:damage,modifier:0,total:damage.reduce((a,b)=>a+b,0)}}:{})}})
  const saved=run(20);expect(saved.ok,JSON.stringify(saved)).toBe(true)
  const legacy=run(20,[1,2,3,4,5,6]);expect(legacy.ok).toBe(true)
  if(legacy.ok)expect(legacy.state.combatants.target.currentHp).toBe(60)
  expect(run(1).ok).toBe(false)
  expect(run(20,[7,7,7,7,7,7]).ok).toBe(false)
  const hit=run(1,[1,2,3,4,5,6]);expect(hit.ok).toBe(true)
  if(hit.ok)expect(hit.state.combatants.target.currentHp).toBe(39)
 }finally{dispose();registration.dispose()}
})
