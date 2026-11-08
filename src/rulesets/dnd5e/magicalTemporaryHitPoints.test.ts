import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,resolveDnd5eDmHitPointAdjustment,dnd5eEffectiveTemporaryHitPoints} from './headlessCombatEngine'
import {createDnd5eMechanicalEffect} from './activeEffects'
import {registerDnd5eActivityPackage} from './activities/dnd5eActivityRegistry'
import {resolveDnd5eActionWithDamageReactions} from './damageReactionFlow'
import {dnd5eDamageCheckpointActivitySupported} from './damageCommitReaction'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {resolveRegisteredDnd5eActivityInCombatV1} from './activities/dnd5eActivityCombatAuthority'
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'personal-ward',name:'Personal magical ward',legacySource:{kind:'feature',id:'personal-ward',magical:true},automation:automationCapabilityFromLegacyStatus('full'),activation:{kind:'reaction'},target:{kind:'self'},invocation:{kind:'triggered',event:'before-damage',confirmation:'actor-choice',retention:'single-event'},consumption:[{kind:'resource',resourceId:'ward-use',amount:{kind:'constant',value:1},consumeOn:'confirm'}],effects:[{schemaVersion:1,id:'pool',name:'Pool lifetime',magical:true,stacking:'replace',duration:{kind:'rounds',rounds:1,expiresAt:'target-turn-end',includeCreationTurn:false},modifiers:[]}],outcomes:[{id:'protect',when:{kind:'always'},operations:[{id:'lifetime',kind:'apply-effect',target:'actor',effectId:'pool'},{id:'grant',kind:'temporary-hit-points',target:'actor',sourceEffectId:'pool',amount:{kind:'constant',value:30}}]}]}
function fixture(){
 const actor=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,initiative,controller:'player',classId:'fighter',level:1,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const state=startDnd5eHeadlessCombat('generic-magical-ward',[actor('enemy',20),actor('target',10)])
 state.combatants.target.pluginFeatureIds=['personal-ward'];state.combatants.target.classResources['ward-use']={current:1,max:1}
 return state
}
it('accepts schema-validated magical lifetime metadata at a personal damage checkpoint',()=>{
 expect(dnd5eDamageCheckpointActivitySupported(activity,{occurrence:0,targetId:'target',sourceId:'enemy',amount:20,damageTypes:['fire'],phase:'raw-typed-damage-before-defenses'})).toBe(true)
})
it('pauses actual core Heroism temporary HP in AMF and restores only its unspent amount on exit',()=>{
 const state=fixture(),ally=state.combatants.enemy
 Object.assign(ally,{classId:'paladin',level:5,classLevels:{paladin:5},abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:20},classSelections:{'spell-prepared':['heroism']},classResources:{'dnd5e-spell-slot-1':{current:1,max:1}}})
 const cast=resolveDnd5eHeadlessAction(state,{type:'cast-spell',actorId:'enemy',targetId:'target',spellId:'heroism',slotLevel:1,castingClassId:'paladin',effectRolls:[]})
 expect(cast.ok,JSON.stringify(cast)).toBe(true)
 const next=resolveDnd5eHeadlessAction(cast.state,{type:'end-turn',actorId:'enemy'});expect(next.ok).toBe(true)
 const target=next.state.combatants.target
 expect(target.temporaryHp).toBe(5);expect(target.classState.temporaryHitPointsSource).toMatchObject({actorId:'enemy',rulesId:'heroism'})
 expect(target.classState.activeEffects?.some(effect=>effect.definitionId==='srd-5.1:spell:heroism'&&effect.source.kind==='spell')).toBe(true)
 target.magicSuppressed=true
 const suppressed=resolveDnd5eDmHitPointAdjustment(next.state,'target','damage',5);expect(suppressed.ok).toBe(true)
 expect(suppressed.state.combatants.target.currentHp).toBe(95);expect(suppressed.state.combatants.target.temporaryHp).toBe(5)
 suppressed.state.combatants.target.magicSuppressed=false
 expect(dnd5eEffectiveTemporaryHitPoints(suppressed.state.combatants.target)).toBe(5)
 const resumed=resolveDnd5eDmHitPointAdjustment(suppressed.state,'target','damage',3);expect(resumed.ok).toBe(true)
 expect(resumed.state.combatants.target.temporaryHp).toBe(2);expect(resumed.state.combatants.target.currentHp).toBe(95)
})
it('preserves ordinary provenance-free temporary HP absorption while magic is suppressed',()=>{
 const state=fixture();state.combatants.target.magicSuppressed=true
 const granted=resolveDnd5eDmHitPointAdjustment(state,'target','temporary-hit-points',75);expect(granted.ok).toBe(true)
 const hit=resolveDnd5eDmHitPointAdjustment(granted.state,'target','damage',20)
 expect(hit.ok).toBe(true);expect(hit.state.combatants.target.temporaryHp).toBe(55);expect(hit.state.combatants.target.currentHp).toBe(100)
})
it('preserves an explicitly nonmagical spell-classified source under the existing source classification contract',()=>{
 const state=fixture(),target=state.combatants.target
 target.magicSuppressed=true;target.temporaryHp=30;target.classState.temporaryHitPointsSource={actorId:'target',rulesId:'mundane-source',effectDefinitionId:'mundane-pool'}
 target.classState.activeEffects=[createDnd5eMechanicalEffect({id:'mundane-instance',definitionId:'mundane-pool',label:'Explicitly nonmagical pool',targetId:'target',source:{kind:'spell',actorId:'target',rulesId:'mundane-source',magical:false},duration:{type:'permanent'},modifiers:{}})]
 expect(dnd5eEffectiveTemporaryHitPoints(target)).toBe(30)
 const hit=resolveDnd5eDmHitPointAdjustment(state,'target','damage',20)
 expect(hit.ok).toBe(true);expect(hit.state.combatants.target.temporaryHp).toBe(10);expect(hit.state.combatants.target.currentHp).toBe(100)
})
it.each([false,true])('offers an explicitly magical nonspell reaction only outside suppression (%s)',async suppressed=>{
 const registration=registerDnd5eActivityPackage({packageId:'test.magical-ward',packageVersion:'1.0.0',activities:[activity]})
 try{
  const state=fixture();state.combatants.target.magicSuppressed=suppressed;let prompts=0
  const result=await resolveDnd5eActionWithDamageReactions({state,combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>{prompts++;return{accepted:true}},roll:async()=>{throw Error('No dice')},action:{type:'attack',actorId:'enemy',targetId:'target',d20:18,attackModifier:10,damage:{count:1,sides:20,rolls:[20],bonus:0,type:'fire'}}})
  expect(result.ok,JSON.stringify(result)).toBe(true);expect(prompts).toBe(suppressed?0:1)
  expect(result.state.combatants.target.currentHp).toBe(suppressed?80:100);expect(result.state.combatants.target.temporaryHp).toBe(suppressed?0:10)
  expect(result.state.combatants.target.classResources['ward-use'].current).toBe(suppressed?1:0)
 }finally{registration.dispose()}
})
it('rejects a directly submitted suppressed magical nonspell Activity at Host authority without spending its resource',()=>{
 const registration=registerDnd5eActivityPackage({packageId:'test.magical-ward',packageVersion:'1.0.0',activities:[activity]})
 try{
  const state=fixture();state.combatants.target.magicSuppressed=true;const before=structuredClone(state)
  const result=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,authoritativeRolls:{},confirmedBy:'actor',triggerContext:{eventId:'host-damage-boundary',event:'before-damage',eligibleActorIds:['target'],eligibleTargetIds:['target'],source:{kind:'combat',id:'damage-taken',damage:{amount:20,damageTypes:['fire'],temporaryHitPointsBefore:0,temporaryHitPointsAfter:0}},actionEconomyAvailable:{action:true,'bonus-action':true,reaction:true}},command:{schemaVersion:1,commandId:'forged-suppressed-request',packageId:'test.magical-ward',packageVersion:'1.0.0',actorId:'target',activityId:'personal-ward',targetIds:['target'],expectedRevision:1,triggerEventId:'host-damage-boundary'}})
  expect(result,JSON.stringify(result)).toMatchObject({phase:'resolve',result:{ok:false,reason:'invalid-command',details:['magical-feature-suppressed']}})
  expect(result.result.ok).toBe(false);expect(state).toEqual(before)
 }finally{registration.dispose()}
})
it.each(['resume','expire','replace']as const)('pauses only its magical source-bound pool, retaining the original lifetime: %s',mode=>{
 const state=fixture(),target=state.combatants.target
 target.temporaryHp=30;target.magicSuppressed=true;target.classState.temporaryHitPointsSource={actorId:'target',rulesId:'personal-ward',effectDefinitionId:'ward-pool'}
 target.classState.activeEffects=[{...createDnd5eMechanicalEffect({id:'pool-instance',definitionId:'ward-pool',label:'Ward pool',targetId:'target',source:{kind:'feature',actorId:'target',rulesId:'personal-ward',magical:true},duration:{type:'rounds',remainingRounds:1,tickOn:'target-turn-end'},modifiers:{}}),suspendedBy:['persistent-area:antimagic']}]
 expect(dnd5eEffectiveTemporaryHitPoints(target)).toBe(0)
 const hit=resolveDnd5eDmHitPointAdjustment(state,'target','damage',20);expect(hit.ok).toBe(true)
 expect(hit.state.combatants.target.currentHp).toBe(80);expect(hit.state.combatants.target.temporaryHp).toBe(30)
 if(mode==='replace'){
  const changed=resolveDnd5eDmHitPointAdjustment(hit.state,'target','temporary-hit-points',75);expect(changed.ok).toBe(true);hit.state=changed.state
  expect(hit.state.combatants.target.classState.temporaryHitPointsSource).toBeUndefined()
 }
 if(mode!=='resume'){
  const next=resolveDnd5eHeadlessAction(hit.state,{type:'end-turn',actorId:'enemy'}),ended=resolveDnd5eHeadlessAction(next.state,{type:'end-turn',actorId:'target'})
  expect(next.ok).toBe(true);expect(ended.ok).toBe(true);hit.state=ended.state
 }
 const after=hit.state.combatants.target;after.magicSuppressed=false;after.classState.activeEffects=after.classState.activeEffects?.map(effect=>({...effect,suspendedBy:undefined}))
 expect(dnd5eEffectiveTemporaryHitPoints(after)).toBe(mode==='resume'?30:mode==='replace'?75:0)
 if(mode!=='resume')expect(after.classState.activeEffects??[]).toHaveLength(0)
})
