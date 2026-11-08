import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,type Dnd5eAction} from './headlessCombatEngine'
import {createDnd5eDamageCommitSession} from './damageCommitSession'
import {resolveDnd5eActionWithDamageReactions} from './damageReactionFlow'
import {registerDnd5eRulesPlugin} from './pluginApi'
const make=(id:string,initiative:number,patch:Record<string,unknown>={})=>createDnd5eCombatant({id,name:id,controller:'player',initiative,abilities:{str:16,dex:14,con:14,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,...patch})
function fixture(multi=false){
 const featureId='test.relentless-staged:feat-fury'
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.relentless-staged',name:'Synthetic registered reaction',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerFeat({id:'fury',name:'Fury',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{schemaVersion:1,id:'reaction',name:'Fury',description:'Synthetic',level:1,trigger:{kind:'passive'},cost:{economy:'reaction'},targeting:{kind:'single-creature',relation:'enemy'},effects:[],mechanic:{kind:'reaction-weapon-attack',event:'relentless-endurance'},automation:'full'}})}})
 const actor=make('owner',10,{currentHp:2,pluginFeatureIds:[featureId],racialRules:{halfOrcRelentlessEndurance:true},classResources:{'dnd5e-racial-half-orc-relentless-endurance':{current:1,max:1}}})
 const enemy=make('enemy',20,{controller:'dm',...(multi?{statBlockId:'srd-5.1:owlbear'}:{})}),next=make('next',5),chosen=make('chosen',1,{controller:'dm'})
 const state=startDnd5eHeadlessCombat('staged-real',[enemy,actor,next,chosen])
 const action:Dnd5eAction=multi?{type:'monster-action',actorId:'enemy',actionId:'multiattack',rolls:[{targetId:'owner',d20:18,damageRolls:[[1]]},{targetId:'next',d20:18,damageRolls:[[1,1]]}]}:{type:'attack',actorId:'enemy',targetId:'owner',attackModifier:10,d20:15,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'slashing'}}
 const reaction=(grantId:string):Extract<Dnd5eAction,{type:'attack'}>=>({type:'attack',actorId:'owner',targetId:'chosen',attackModifier:10,d20:18,spendAction:false,activityWeaponAttackGrantId:grantId,damage:{count:1,sides:8,bonus:0,rolls:[3],type:'piercing'},classDamageContext:{mode:'ranged',weaponId:'bow',weaponCategory:'martial',weaponDamageSides:8,damageType:'piercing',finesse:false,strengthBased:false,adjacentEnemyOfTarget:false}})
 return {dispose,state,action,reaction,featureId}
}
it.each([false,true])('Host replay pauses for genuine Relentless, resolves actual attack or decline, use=%s',use=>{
 const f=fixture();try{
 const baseline=structuredClone(f.state),session=createDnd5eDamageCommitSession(f.state,f.action,()=>false)
 const pending=session.run(f.state);expect(pending.status).toBe('pending-relentless');if(pending.status!=='pending-relentless')throw Error(JSON.stringify(pending))
 expect(pending.snapshot.combatants.owner.currentHp).toBe(1)
 expect(pending.snapshot.combatants.owner.classResources['dnd5e-racial-half-orc-relentless-endurance'].current).toBe(0)
 expect(pending.snapshot.combatants.chosen.currentHp).toBe(30)
 expect(f.state).toEqual(baseline)
 const result=session.resumeRelentless(f.state,pending.occurrence,pending.request,use?{attack:f.reaction(pending.request.grantId)}:{})
 expect(result.status).toBe('resolved');if(result.status!=='resolved')throw Error(JSON.stringify(result))
 expect(result.result.ok,JSON.stringify(result.result)).toBe(true)
 expect(result.result.state.combatants.owner.currentHp).toBe(1)
 expect(result.result.state.combatants.owner.turn.reactionAvailable).toBe(!use)
 expect(result.result.state.combatants.chosen.currentHp).toBe(use?27:30)
 expect(result.result.state.combatants.owner.classState.activityWeaponAttackGrants?.[pending.request.grantId]).toBeUndefined()
 expect(session.resumeRelentless(f.state,pending.occurrence,pending.request,{})).toMatchObject({status:'rejected',reason:'session-ended'})
 expect(f.state).toEqual(baseline)
 }finally{f.dispose()}
})
it('rejects forged choice and stale state without publishing staged damage',()=>{
 const f=fixture();try{
 const session=createDnd5eDamageCommitSession(f.state,f.action,()=>false),pending=session.run(f.state)
 if(pending.status!=='pending-relentless')throw Error(JSON.stringify(pending))
 expect(session.resumeRelentless(f.state,pending.occurrence,pending.request,{attack:{...f.reaction(pending.request.grantId),actorId:'enemy'}})).toMatchObject({status:'rejected',reason:'unsupported-reaction'})
 const changed=structuredClone(f.state);changed.combatants.owner.currentHp=3
 expect(session.resumeRelentless(changed,pending.occurrence,pending.request,{})).toMatchObject({status:'rejected',reason:'stale-state'})
 expect(f.state.combatants.owner.currentHp).toBe(2)
 }finally{f.dispose()}
})
it.each([false,true])('real monster multiattack pauses before its second attack, use=%s',use=>{
 const f=fixture(true);try{
 const session=createDnd5eDamageCommitSession(f.state,f.action,()=>false),pending=session.run(f.state)
 expect(pending.status).toBe('pending-relentless');if(pending.status!=='pending-relentless')throw Error(JSON.stringify(pending))
 expect(pending.snapshot.combatants.next.currentHp).toBe(30)
 const result=session.resumeRelentless(f.state,pending.occurrence,pending.request,use?{attack:f.reaction(pending.request.grantId)}:{})
 if(result.status!=='resolved')throw Error(JSON.stringify(result))
 expect(result.result.ok,JSON.stringify(result.result)).toBe(true)
 expect(result.result.state.combatants.next.currentHp).toBe(23)
 const events=result.result.events
 const second=events.findIndex(event=>event.type==='attack-resolved'&&event.actorId==='enemy'&&event.targetId==='next')
 const reaction=events.findIndex(event=>event.type==='attack-resolved'&&event.actorId==='owner'&&event.targetId==='chosen')
 expect(second).toBeGreaterThan(-1)
 if(use){expect(reaction).toBeGreaterThan(-1);expect(reaction).toBeLessThan(second)}
 else expect(reaction).toBe(-1)
 }finally{f.dispose()}
})
it('existing async damage reaction driver awaits real owner choice before continuing',async()=>{
 const f=fixture(true);try{
 let calls=0
 const result=await resolveDnd5eActionWithDamageReactions({state:f.state,action:f.action,combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[],chooseRelentlessReaction:async({request,state})=>{calls++;expect(state.combatants.next.currentHp).toBe(30);return {attack:f.reaction(request.grantId)}}})
 expect(result.ok,JSON.stringify(result)).toBe(true)
 expect(calls).toBe(1)
 expect(result.state.combatants.chosen.currentHp).toBe(27)
 expect(result.state.combatants.next.currentHp).toBe(23)
 }finally{f.dispose()}
})
it('a real reaction killing the multiattacker prevents its remaining attack',()=>{
 const f=fixture(true);try{
 f.state.combatants.enemy.currentHp=1
 const session=createDnd5eDamageCommitSession(f.state,f.action,()=>false),pending=session.run(f.state)
 if(pending.status!=='pending-relentless')throw Error(JSON.stringify(pending))
 const attack={...f.reaction(pending.request.grantId),targetId:'enemy'}
 const result=session.resumeRelentless(f.state,pending.occurrence,pending.request,{attack})
 if(result.status!=='resolved')throw Error(JSON.stringify(result))
 expect(result.result.ok,JSON.stringify(result.result)).toBe(true)
 expect(result.result.state.combatants.enemy.currentHp).toBe(0)
 expect(result.result.state.combatants.next.currentHp).toBe(30)
 expect(result.result.events.some(event=>event.type==='attack-resolved'&&event.actorId==='enemy'&&event.targetId==='next')).toBe(false)
 }finally{f.dispose()}
})
