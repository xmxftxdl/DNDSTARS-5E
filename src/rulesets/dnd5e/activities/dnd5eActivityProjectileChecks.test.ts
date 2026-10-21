import { dnd5eActivityProjectileFormulaOptionsV1, dnd5eActivityTargetOutcomeGateV1, dnd5eActivitySaveGateResultV1 } from './dnd5eActivitySaveGate'
import { collectScaledDnd5eActivityFormulaRollDeclarationsV1, dnd5eActivitySubmittedAttackCheckSuccessKeysV1, dnd5eActivitySubmittedAttackRollIsCriticalV1 } from './dnd5eActivityRollRecipe'
import {dnd5eActivityPerTargetRollDeclarationsV1,filterDnd5eConditionalActivityRollDeclarationsV1} from './dnd5eActivityPerTargetRolls'
import {it,expect} from 'vitest'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import {previewDnd5eActivityAttackV1,previewDnd5eActivitySavingThrowV1,resolveDnd5eActivity,type Dnd5eActivityActorSnapshot} from './dnd5eActivityExecutor'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
const actor:Dnd5eActivityActorSnapshot & {controller:'players'}={id:'caster',controller:'players',level:5,proficiencyBonus:3,
 abilities:{str:10,dex:10,con:10,int:16,wis:10,cha:10},armorClass:12,conditions:[],currentHp:30,maxHp:30}
const target:Dnd5eActivityActorSnapshot & {controller:'dm'}={...actor,id:'target',controller:'dm',armorClass:15}
it.each(['attack-roll','saving-throw'] as const)('requires two independent %s results for two projectiles against the same creature',kind=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'projectile-audit',name:'Synthetic projectile audit',
 activation:{kind:'action'},target:{kind:'creature',relation:'any',count:2,allowDuplicateTargets:true},
 automation:automationCapabilityFromLegacyStatus('full'),
 checks:[kind==='attack-roll'?{id:'check',kind,perProjectile:true,rollId:'d20',scope:'per-target',rollMode:'normal',attackBonus:{kind:'constant',value:5}}:
 {id:'check',kind,perProjectile:true,rollId:'d20',scope:'per-target',rollMode:'normal',ability:'dex',dc:{kind:'constant',value:15}}],
 outcomes:[{id:'damage',when:{kind:'check',checkId:'check',result:kind==='attack-roll'?'success':'failure'},
 operations:[{id:'damage',kind:'damage',target:'target',damageType:'force',amount:{kind:'constant',value:5}}]}]}
 const declarations=dnd5eActivityPerTargetRollDeclarationsV1({activity,actor,targets:[target],projectileTargetIds:['target','target'],
 declarations:[{id:'d20',label:'Check',count:1,sides:20,modifier:0,visibility:'public'}],hostSavingThrowMode:()=> 'normal',hostAttackRollMode:()=> 'normal'})
 expect(declarations.map(d=>d.id)).toEqual(['d20:projectile:0:target','d20:projectile:1:target'])
 expect(declarations.map(d=>d.rollerTokenId)).toEqual(kind==='attack-roll'?['caster','caster']:['target','target'])
 const rolls=Object.fromEntries(declarations.map((d,index)=>[d.id,{values:[index===0?19:1],modifier:0,total:index===0?19:1}]))
 const result=resolveDnd5eActivity({activity,actor,targets:[target],projectileTargetIds:['target','target'],
 rolls})
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 expect(result.ok,JSON.stringify(result)).toBe(true)
 if(!result.ok)throw Error(result.reason)
 // Two independently resolved projectiles must not share one target-keyed check.
 expect(result.checks).toHaveLength(2)
 expect(new Set(result.checks.map(check=>check.key)).size).toBe(2)
 expect(result.checks.map(check=>check.success)).toEqual([true,false])
 if(kind==='attack-roll')expect(dnd5eActivitySubmittedAttackCheckSuccessKeysV1(activity,{actor,targets:[target],projectileTargetIds:['target','target'],rolls,hostRollMode:()=> 'normal'})).toEqual(new Set(['check:projectile:0:target']))
 expect(dnd5eActivityTargetOutcomeGateV1({activity,actor,targets:[target],projectileTargetIds:['target','target'],rolls},declarations,activity.outcomes[0].when,0)).toBe(kind==='attack-roll')
 expect(dnd5eActivityTargetOutcomeGateV1({activity,actor,targets:[target],projectileTargetIds:['target','target'],rolls},declarations,activity.outcomes[0].when,1)).toBe(kind!=='attack-roll')

 const previewInput={activity,actor,targets:[target],projectileTargetIds:['target','target'],rolls}
 const preview=(id:string,input=previewInput)=>kind==='attack-roll'?previewDnd5eActivityAttackV1(input,id):previewDnd5eActivitySavingThrowV1(input,id,'target')
 expect(declarations.map(d=>preview(d.id))).toEqual(result.checks)
 expect(preview('d20:projectile:2:target')).toBeUndefined()
 expect(preview('d20:target')).toBeUndefined()
 expect(preview(declarations[0].id,{...previewInput,projectileTargetIds:[]})).toBeUndefined()
 if(kind==='saving-throw')expect(previewDnd5eActivitySavingThrowV1(previewInput,declarations[0].id,'caster')).toBeUndefined()

 expect(result.proposals.filter(p=>p.kind==='deal-damage')).toHaveLength(1)
 expect(resolveDnd5eActivity({activity,actor,targets:[target],projectileTargetIds:['target','target'],rolls:{'d20:target':{values:[19]}}}).ok).toBe(false)
 const shared=structuredClone(activity)
 for(const check of shared.checks??[])if('perProjectile' in check)delete check.perProjectile
 const legacy=resolveDnd5eActivity({activity:shared,actor,targets:[target],projectileTargetIds:['target','target'],rolls:{'d20:target':{values:[kind==='attack-roll'?19:1]}}})
 expect(legacy.ok).toBe(true)
 if(legacy.ok){expect(legacy.checks).toHaveLength(1);expect(legacy.proposals.filter(p=>p.kind==='deal-damage')).toHaveLength(2)}
})

it('asks for a dependent projectile save only for the matching successful projectile attack',()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'followup',name:'Followup',activation:{kind:'action'},
 target:{kind:'creature',relation:'any',count:2,allowDuplicateTargets:true},automation:automationCapabilityFromLegacyStatus('full'),
 checks:[{id:'hit',kind:'attack-roll',perProjectile:true,rollId:'hit-d20',scope:'per-target',attackBonus:{kind:'constant',value:5},rollMode:'normal'},
 {id:'save',kind:'saving-throw',perProjectile:true,rollId:'save-d20',scope:'per-target',ability:'dex',dc:{kind:'constant',value:15},appliesWhenCheck:{checkId:'hit',result:'success'}}],
 outcomes:[{id:'nothing',when:{kind:'always'},operations:[]}]}
 const declarations=dnd5eActivityPerTargetRollDeclarationsV1({activity,actor,targets:[target],projectileTargetIds:['target','target'],
 declarations:[{id:'save-d20',label:'Save',count:1,sides:20,modifier:0,visibility:'public'}],hostSavingThrowMode:()=> 'normal',hostAttackRollMode:()=> 'normal'})
 const filtered=filterDnd5eConditionalActivityRollDeclarationsV1({activity,declarations,successfulCheckKeys:new Set(['hit:projectile:1:target'])})
 expect(filtered.map(d=>d.id)).toEqual(['save-d20:projectile:1:target'])
})


it('keeps projectile damage and critical dice independent against one repeated target',()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'independent-damage',name:'Independent damage',activation:{kind:'action'},
 target:{kind:'creature',relation:'any',count:2,allowDuplicateTargets:true},automation:automationCapabilityFromLegacyStatus('full'),
 checks:[{id:'hit',kind:'attack-roll',perProjectile:true,rollId:'hit-d20',scope:'per-target',attackBonus:{kind:'constant',value:5},rollMode:'normal'}],
 outcomes:[{id:'hit-damage',when:{kind:'check',checkId:'hit',result:'success'},operations:[{id:'damage',kind:'damage',target:'target',perProjectile:true,
 damageType:'force',critical:'double-dice',amount:{kind:'dice',rollId:'damage',count:1,sides:6}}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const recipe=collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity,{projectileTargetIds:['target','target'],criticalProjectileIndices:new Set([0])})
 expect(recipe).toEqual([{id:'damage:projectile:0:target',count:2,sides:6},{id:'damage:projectile:1:target',count:1,sides:6}])
 const input={activity,actor,targets:[target],projectileTargetIds:['target','target'],rolls:{
 'hit-d20:projectile:0:target':{values:[20]},'hit-d20:projectile:1:target':{values:[19]},
 'damage:projectile:0:target':{values:[2,3]},'damage:projectile:1:target':{values:[6]},
 'damage:target':{values:[1]},damage:{values:[1]}}}

 const criticalInput={targetIds:['target'],projectileTargetIds:input.projectileTargetIds,rolls:input.rolls,hostRollMode:()=> 'normal' as const}
 expect(dnd5eActivitySubmittedAttackRollIsCriticalV1(activity,{...criticalInput,projectileOccurrenceIndex:0})).toBe(true)
 expect(dnd5eActivitySubmittedAttackRollIsCriticalV1(activity,{...criticalInput,projectileOccurrenceIndex:1})).toBe(false)
 expect(dnd5eActivitySubmittedAttackRollIsCriticalV1(activity,{...criticalInput,projectileOccurrenceIndex:2})).toBe(false)

 const automaticOptions=dnd5eActivityProjectileFormulaOptionsV1(input,[])
 expect(automaticOptions.criticalProjectileIndices).toEqual(new Set([0]))
 expect(collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity,automaticOptions)).toEqual(recipe)
 const missInput=structuredClone(input)
 missInput.rolls['hit-d20:projectile:0:target'].values=[1]
 expect(collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity,dnd5eActivityProjectileFormulaOptionsV1(missInput,[]))).toEqual([{id:'damage:projectile:1:target',count:1,sides:6}])
 const result=resolveDnd5eActivity(input)
 expect(result.ok,JSON.stringify(result)).toBe(true)
 if(!result.ok)throw Error(result.reason)
 expect(result.proposals.filter(p=>p.kind==='deal-damage').map(p=>p.amount)).toEqual([5,6])
 const missing=structuredClone(input)
 delete (missing.rolls as Record<string,unknown>)['damage:projectile:1:target']
 expect(resolveDnd5eActivity(missing).ok).toBe(false)
 const excess=structuredClone(input)
 excess.rolls['damage:projectile:1:target'].values=[5,6]
 expect(resolveDnd5eActivity({...excess,allowCriticalDiceSuperset:true}).ok).toBe(false)
 expect(()=>collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity)).toThrow('activity-projectile-order-missing')
 expect(collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity,{projectileTargetIds:['target','target'],projectileOutcomeGate:(_when,index)=>index===1})).toEqual([{id:'damage:projectile:1:target',count:1,sides:6}])
})

it('does not use another projectile hit to open a dependent save gate',()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'dependent-gate',name:'Dependent gate',activation:{kind:'action'},
 target:{kind:'creature',relation:'any',count:2,allowDuplicateTargets:true},automation:automationCapabilityFromLegacyStatus('full'),
 checks:[{id:'hit',kind:'attack-roll',perProjectile:true,rollId:'hit-d20',scope:'per-target',attackBonus:{kind:'constant',value:5},rollMode:'normal'},
 {id:'save',kind:'saving-throw',perProjectile:true,rollId:'save-d20',scope:'per-target',ability:'dex',dc:{kind:'constant',value:15},appliesWhenCheck:{checkId:'hit',result:'success'}}],outcomes:[]}
 const input={activity,actor,targets:[target],projectileTargetIds:['target','target'],rolls:{'hit-d20:projectile:0:target':{values:[1]},'hit-d20:projectile:1:target':{values:[19]},'save-d20:projectile:0:target':{values:[1]},'save-d20:projectile:1:target':{values:[19]}}}
 expect(dnd5eActivitySaveGateResultV1(input,[],'save','target',0)).toBeUndefined()
 expect(dnd5eActivitySaveGateResultV1(input,[],'save','target',1)).toBe(true)
 expect(dnd5eActivitySaveGateResultV1(input,[],'save','target')).toBeUndefined()
 const save=activity.checks![1]
 if(save.kind!=='saving-throw')throw Error('test fixture')
 delete save.appliesWhenCheck
 save.stopAfterFirstFailure=true
 expect(dnd5eActivitySaveGateResultV1(input,[],'save','target',1)).toBeUndefined()
 const filtered=filterDnd5eConditionalActivityRollDeclarationsV1({activity,declarations:[{id:'save-d20:projectile:1:target',label:'Save',count:1,sides:20,modifier:0,visibility:'public'}],successfulCheckKeys:new Set(),orderedProjectileTargetIds:['target','target'],savingThrowResult:(check,id,index)=>dnd5eActivitySaveGateResultV1(input,[],check,id,index)})
 expect(filtered).toEqual([])
})
