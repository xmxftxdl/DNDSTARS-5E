import {DND5E_UNARMED_ATTACK_ID} from './equipment'
import {buildPreparedDnd5eEquipmentAttackAction} from './equipmentAttackAction'
import {normalizeCharacter} from '../../store/characters'
import {DND5E_LONGBOW,DND5E_GREATSWORD,DND5E_JAVELIN} from './equipment'
import {applyDnd5eInventoryMutation} from './items'
import {applyDnd5eCounterattackInventoryCosts} from './counterattackInventory'
import {createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication} from './mapBridge'
import {prepareDnd5eRelentlessReactionAttacks} from './relentlessReactionAttackPreparation'
import type {BattleMap} from '../../store/maps'
import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,type Dnd5eAction} from './headlessCombatEngine'
import {createDnd5eDamageCommitSession} from './damageCommitSession'
import {registerDnd5eRulesPlugin} from './pluginApi'
const make=(id:string,initiative:number,patch:Record<string,unknown>={})=>createDnd5eCombatant({id,name:id,controller:'player',initiative,abilities:{str:16,dex:14,con:14,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,...patch})
function fixture(multi=false){
 const featureId='test.relentless-staged:feat-fury'
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.relentless-staged',name:'Synthetic registered reaction',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerFeature({id:'claws',name:'Claws',summary:'Synthetic',description:'Synthetic',automation:'full',staticModifiers:{naturalWeapons:[{id:'claw',name:'Claw',damageDieSides:4,damageType:'slashing'}]}});api.registerFeat({id:'fury',name:'Fury',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{schemaVersion:1,id:'reaction',name:'Fury',description:'Synthetic',level:1,trigger:{kind:'passive'},cost:{economy:'reaction'},targeting:{kind:'single-creature',relation:'enemy'},effects:[],mechanic:{kind:'reaction-weapon-attack',event:'relentless-endurance'},automation:'full'}})}})
 const actor=make('owner',10,{currentHp:2,pluginFeatureIds:[featureId],racialRules:{halfOrcRelentlessEndurance:true},classResources:{'dnd5e-racial-half-orc-relentless-endurance':{current:1,max:1}}})
 const enemy=make('enemy',20,{controller:'dm',...(multi?{statBlockId:'srd-5.1:owlbear'}:{})}),next=make('next',5),chosen=make('chosen',1,{controller:'dm'})
 const state=startDnd5eHeadlessCombat('staged-real',[enemy,actor,next,chosen])
 const action:Dnd5eAction=multi?{type:'monster-action',actorId:'enemy',actionId:'multiattack',rolls:[{targetId:'owner',d20:18,damageRolls:[[1]]},{targetId:'next',d20:18,damageRolls:[[1,1]]}]}:{type:'attack',actorId:'enemy',targetId:'owner',attackModifier:10,d20:15,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'slashing'}}
 const reaction=(grantId:string):Extract<Dnd5eAction,{type:'attack'}>=>({type:'attack',actorId:'owner',targetId:'chosen',attackModifier:10,d20:18,spendAction:false,activityWeaponAttackGrantId:grantId,damage:{count:1,sides:8,bonus:0,rolls:[3],type:'piercing'},classDamageContext:{mode:'ranged',weaponId:'dnd5e-longbow',weaponCategory:'martial',weaponDamageSides:8,damageType:'piercing',finesse:false,strengthBased:false,adjacentEnemyOfTarget:false}})
 return {dispose,state,action,reaction,featureId}
}

it.each(['melee','ranged','natural'] as const)('prepares only actual equipped legal %s targets from the live post-damage snapshot',mode=>{
 const f=fixture();try{
 let character=normalizeCharacter({id:'owner-character',name:'Owner',race:'半兽人',dnd5eRaceId:'half-orc',charClass:'战士',level:4,currentHp:2,maxHp:30,abilities:{str:16,dex:16,con:14,int:10,wis:10,cha:10},dnd5eFeatIds:['test.relentless-staged:fury'],dnd5ePluginFeatureIds:['test.relentless-staged:claws'],equipment:{mainWeapon:mode==='ranged'?DND5E_LONGBOW:DND5E_GREATSWORD}})
 character=applyDnd5eInventoryMutation([character],{type:'grant',characterId:character.id,templateId:'srd-5.1:item:arrows',quantity:2}).characters[0]
 character.classResources={...character.classResources,'dnd5e-racial-half-orc-relentless-endurance':{current:1,max:1}}
 const map:BattleMap={id:'map',name:'Map',width:1000,height:700,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'owner',characterId:character.id,type:'player',label:'Owner',x:25,y:25,size:1,color:'',emoji:''},{id:'enemy',poolId:'srd-5.1:goblin',type:'enemy',label:'Incoming enemy',hp:30,maxHp:30,x:75,y:25,size:1,color:'',emoji:''},{id:'near',poolId:'srd-5.1:goblin',type:'enemy',label:'Near other',hp:30,maxHp:30,x:25,y:75,size:1,color:'',emoji:''},{id:'far',poolId:'srd-5.1:goblin',type:'enemy',label:'Far other',hp:30,maxHp:30,x:325,y:25,size:1,color:'',emoji:''}]}
 const order=map.tokens.map((token,index)=>({tokenId:token.id,slotId:token.id,label:token.label,roll:token.id==='enemy'?20:10-index,emoji:'',color:''})).sort((a,b)=>b.roll-a.roll)
 const snap=createDnd5eMapCombatSnapshot({combatId:'prep',round:1,turnSlotId:'enemy',map,characters:[character],initiativeOrder:order})
 const incoming:Dnd5eAction={type:'attack',actorId:'enemy',targetId:'owner',attackModifier:10,d20:18,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'slashing'}}
 const session=createDnd5eDamageCommitSession(snap.state,incoming,()=>false),pending=session.run(snap.state)
 expect(pending.status).toBe('pending-relentless');if(pending.status!=='pending-relentless')throw Error(JSON.stringify(pending))
 const options=prepareDnd5eRelentlessReactionAttacks({request:pending.request,state:pending.snapshot,map,characters:[character],initiativeOrder:order,transactionId:'test-real-preparation'})
 expect(options.some(option=>option.prepared.targetToken.id==='near')).toBe(true)
 expect(options.some(option=>option.prepared.profile.weaponId==='test.relentless-staged:claws:natural:claw')).toBe(true)
 const unarmed=options.find(option=>option.prepared.profile.weaponId===(mode==='natural'?'test.relentless-staged:claws:natural:claw':DND5E_UNARMED_ATTACK_ID) && option.prepared.targetToken.id==='near');expect(unarmed).toBeDefined();if(!unarmed)throw Error('missing normal unarmed');
 const strike=buildPreparedDnd5eEquipmentAttackAction({prepared:unarmed.prepared,d20:18,damageRolls:mode==='natural'?[3]:[]});const done=session.resumeRelentless(snap.state,pending.occurrence,pending.request,{attack:strike});expect(done.status).toBe('resolved');if(done.status!=='resolved')throw Error(JSON.stringify(done));expect(done.result.ok,JSON.stringify(done.result)).toBe(true);expect(done.result.state.combatants.near.currentHp).toBeLessThan(pending.snapshot.combatants.near.currentHp);expect(done.result.state.combatants.owner.turn.reactionAvailable).toBe(false)
 expect(options.some(option=>option.prepared.targetToken.id==='far')).toBe(mode==='ranged')
 expect(options.every(option=>option.prepared.actor.currentHp===1)).toBe(true)
 expect(options.every(option=>option.prepared.action.dnd5eWeaponAttackOptions?.activityWeaponAttackGrantId===pending.request.grantId)).toBe(true)
 expect(character.currentHp).toBe(2)
 }finally{f.dispose()}
})
it.each([false,true])('projects true accepted Relentless bow attack ammunition once, hit=%s',hit=>{
 const f=fixture();try{
 const session=createDnd5eDamageCommitSession(f.state,f.action,()=>false),pending=session.run(f.state)
 if(pending.status!=='pending-relentless')throw Error(JSON.stringify(pending))
 const reaction=f.reaction(pending.request.grantId);reaction.d20=hit?18:1;if(!hit)reaction.damage.rolls=[]
 const finished=session.resumeRelentless(f.state,pending.occurrence,pending.request,{attack:reaction})
 if(finished.status!=='resolved'||!finished.result.ok)throw Error(JSON.stringify(finished))
 const markers=finished.result.events.filter(event=>event.type==='relentless-weapon-reaction-resolved')
 expect(markers).toHaveLength(1);expect(markers[0]).toMatchObject({actorId:'owner',attackMade:true,weaponId:'dnd5e-longbow'})
 let character=normalizeCharacter({id:'owner-character',name:'Owner',equipment:{mainWeapon:DND5E_LONGBOW}})
 character=applyDnd5eInventoryMutation([character],{type:'grant',characterId:character.id,templateId:'srd-5.1:item:arrows',quantity:2}).characters[0]
 const count=(c:typeof character)=>c.dnd5eInventory?.entries.filter(e=>e.item.ammunitionKind==='arrow').reduce((sum,e)=>sum+e.quantity,0)
 const projected=applyDnd5eCounterattackInventoryCosts(character,finished.result.events,{owner:character.id})
 expect(count(projected)).toBe(1);expect(count(character)).toBe(2)
 const map:BattleMap={id:'same-parent',name:'Same parent',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'owner',characterId:character.id,type:'player',label:'Owner',x:25,y:25,size:1,color:'',emoji:''},...['enemy','next','chosen'].map((id,index)=>({id,type:'enemy' as const,poolId:'srd-5.1:goblin',label:id,hp:30,maxHp:30,x:75+index*50,y:25,size:1,color:'',emoji:''}))]}
 const plan=planDnd5eMapResultApplication({state:finished.result.state,map,characters:[character],characterIdByCombatantId:{owner:character.id},events:[...finished.result.events]})
 expect(count(plan.characters[0])).toBe(1)
 expect(plan.characters[0].currentHp).toBe(1)
 expect(plan.changedCharacterIds).toContain(character.id)
 const patch=plan.characterPatches?.[character.id]
 expect(patch).toBeDefined()
 if(!patch)throw Error('expected same-parent inventory patch')
 expect(patch.dnd5eInventory).toEqual(plan.characters[0].dnd5eInventory)
 expect(count(character)).toBe(2)

 expect(()=>applyDnd5eCounterattackInventoryCosts(character,[...finished.result.events,...markers],{owner:character.id})).toThrow('duplicate-counterattack')
 }finally{f.dispose()}
})
it('ordinary thrown javelin leaves the hand and preserves one recoverable object in the same parent projection',()=>{
 const f=fixture();try{
 const character=normalizeCharacter({id:'owner-character',name:'Owner',equipment:{mainWeapon:DND5E_JAVELIN}})
 const weapon=character.equipment!.mainWeapon!
 const session=createDnd5eDamageCommitSession(f.state,f.action,()=>false),pending=session.run(f.state)
 if(pending.status!=='pending-relentless')throw Error(JSON.stringify(pending))
 const attack=f.reaction(pending.request.grantId);attack.classDamageContext={...attack.classDamageContext!,weaponId:weapon.id,weaponDamageSides:6,weaponProperties:['thrown'],damageType:'piercing'};attack.damage={count:1,sides:6,bonus:0,rolls:[3],type:'piercing'}
 const finished=session.resumeRelentless(f.state,pending.occurrence,pending.request,{attack})
 if(finished.status!=='resolved'||!finished.result.ok)throw Error(JSON.stringify(finished))
 const projected=applyDnd5eCounterattackInventoryCosts(character,finished.result.events,{owner:character.id})
 expect(projected.equipment?.mainWeapon).toBeUndefined()
 expect(projected.dnd5eInventory?.entries.some(entry=>entry.item.equipment?.id===weapon.id)).toBe(false)
 expect(projected.dnd5eInventory?.releasedObjects).toHaveLength(1)
 expect(projected.dnd5eInventory?.releasedObjects![0]).toMatchObject({quantity:1,templateId:character.dnd5eInventory!.entries.find(entry=>entry.item.equipment?.id===weapon.id)!.templateId})
 expect(character.equipment?.mainWeapon?.id).toBe(weapon.id)
 }finally{f.dispose()}
})
