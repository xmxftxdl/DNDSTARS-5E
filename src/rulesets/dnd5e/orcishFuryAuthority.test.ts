import {createDnd5eDamageCommitSession} from './damageCommitSession'
import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'
const hero=(id:string,initiative:number,patch:Record<string,unknown>={})=>createDnd5eCombatant({id,name:id,controller:'player',initiative,abilities:{str:16,dex:14,con:14,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,...patch})
function setup(){
 const reaction='test.orcish-authority:feat-reaction'
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.orcish-authority',name:'Synthetic',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
 api.registerFeat({id:'reaction',name:'Reaction',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{schemaVersion:1,id:'reaction',name:'Reaction',description:'Synthetic',level:1,trigger:{kind:'passive'},cost:{economy:'reaction'},targeting:{kind:'single-creature',relation:'enemy'},effects:[],mechanic:{kind:'reaction-weapon-attack',event:'relentless-endurance'},automation:'full'}})
 }})
 return {reaction,dispose}
}
const context={mode:'melee' as const,weaponId:'greatsword',weaponCategory:'martial' as const,weaponDamageSides:6,damageType:'slashing' as const,weaponAbility:'str' as const,distanceFeet:5,finesse:false,strengthBased:true,adjacentEnemyOfTarget:false}
describe('Host inherited weapon die and Relentless Endurance attack window',()=>{
 it('opens only on actual Relentless Endurance, allows another ranged target, consumes reaction and prevents replay',()=>{
 const {reaction,dispose}=setup();try{
 const actor=hero('actor',10,{currentHp:2,pluginFeatureIds:[reaction],racialRules:{halfOrcRelentlessEndurance:true},classResources:{'dnd5e-racial-half-orc-relentless-endurance':{current:1,max:1}}}),enemy=hero('enemy',20,{controller:'dm'}),other=hero('other',5,{controller:'dm'})
 const state=startDnd5eHeadlessCombat('reaction',[enemy,actor,other]);const session=createDnd5eDamageCommitSession(state,{type:'attack',actorId:'enemy',targetId:'actor',attackModifier:10,d20:15,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'slashing'},classDamageContext:context},()=>false);const pending=session.run(state);expect(pending.status).toBe('pending-relentless');if(pending.status!=='pending-relentless')throw Error(JSON.stringify(pending))
 const grantId=`relentless-endurance:${reaction}`;expect(pending.snapshot.combatants.actor.classState.activityWeaponAttackGrants?.[grantId]).toBeTruthy()
 const attack={type:'attack' as const,actorId:'actor',targetId:'other',attackModifier:10,d20:15,spendAction:false,activityWeaponAttackGrantId:grantId,damage:{count:1,sides:8,bonus:0,rolls:[3],type:'piercing' as const},classDamageContext:{...context,mode:'ranged' as const,strengthBased:false,weaponAbility:'dex' as const,weaponId:'longbow',weaponDamageSides:8,damageType:'piercing' as const,distanceFeet:30}}
 const done=session.resumeRelentless(state,pending.occurrence,pending.request,{attack});if(done.status!=='resolved')throw Error(JSON.stringify(done));const result=done.result;expect(result.events.some(e=>e.type==='relentless-endurance-triggered')).toBe(true);expect(result.ok,JSON.stringify(result)).toBe(true);expect(result.state.combatants.actor.turn.reactionAvailable).toBe(false);expect(result.state.combatants.other.currentHp).toBe(27);expect(resolveDnd5eHeadlessAction(result.state,attack).ok).toBe(false)
 }finally{dispose()}})
})
