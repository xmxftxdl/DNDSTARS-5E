import {settleDnd5eConcentrationChecks} from '../../pages/maps/settleDnd5eCombatResult'
import {createDnd5eMechanicalEffect} from './activeEffects'
import type {BattleMap} from '../../store/maps'
import {resolveDnd5eHeadlessAction,dnd5eCombatantPairKey} from './headlessCombatEngine'
import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,type Dnd5eAction} from './headlessCombatEngine'
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
it('bare synchronous actual damage returns a typed uncommitted requirement and cannot stash a future grant',()=>{
 const f=fixture();try{const before=structuredClone(f.state);const result=resolveDnd5eHeadlessAction(f.state,f.action);expect(result).toMatchObject({ok:false,reason:'relentless-reaction-decision-required'});expect(result.state).toEqual(before);expect(result.events).toEqual([]);expect(f.state).toEqual(before);if(result.ok)throw Error('pending expected');expect(result.relentlessReactionRequirement?.snapshot.combatants.owner.currentHp).toBe(1)}finally{f.dispose()}
})
it('a reaction triggering a second genuine Relentless pauses both owners in the original atomic replay',async()=>{
 const f=fixture();try{
  const second=f.state.combatants.chosen;second.currentHp=2;second.pluginFeatureIds=[f.featureId];second.racialRules={halflingLucky:false,halfOrcSavageAttacks:false,halfOrcRelentlessEndurance:true,innateSpells:[]};second.classResources['dnd5e-racial-half-orc-relentless-endurance']={current:1,max:1};
  const owners:string[]=[];const before=structuredClone(f.state);
  const result=await resolveDnd5eActionWithDamageReactions({state:f.state,action:f.action,combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[],chooseRelentlessReaction:async({request,state})=>{owners.push(request.actorId);expect(f.state).toEqual(before);expect(state.combatants[request.actorId].currentHp).toBe(1);return request.actorId==='owner'?{attack:f.reaction(request.grantId)}:{}}});
  expect(result.ok,JSON.stringify(result)).toBe(true);expect(owners).toEqual(['owner','chosen']);expect(result.state.combatants.owner.currentHp).toBe(1);expect(result.state.combatants.chosen.currentHp).toBe(1);expect(result.state.combatants.chosen.turn.reactionAvailable).toBe(true);expect(result.state.combatants.chosen.classState.activityWeaponAttackGrants).toEqual({});expect(f.state).toEqual(before)
 }finally{f.dispose()}
})
it('actual airborne fall damage enters the same owner-choice driver and decline preserves the original damage',async()=>{
 const f=fixture();try{
  f.state.combatants.next.position={x:20,y:0};f.state.combatants.chosen.position={x:30,y:0};const flyer=f.state.combatants.owner;flyer.position={x:5,y:0};flyer.elevationFeet=30;flyer.groundElevationFeet=0;flyer.airborne=true;flyer.movementSpeeds={walk:30,fly:60};f.state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('enemy','owner')]:5};
  const action:Dnd5eAction={type:'shove',actorId:'enemy',targetId:'owner',actorD20:20,targetD20:1,targetDefense:'acrobatics',outcome:'prone',airborneFallDamageRollsByCombatantId:{owner:[2,3,4]}};
  const before=structuredClone(f.state),owners:string[]=[];
  const bare=resolveDnd5eHeadlessAction(f.state,action);expect(bare).toMatchObject({ok:false,reason:'relentless-reaction-decision-required'});expect(bare.state).toEqual(before);
  const result=await resolveDnd5eActionWithDamageReactions({state:f.state,action,combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[],chooseRelentlessReaction:async({request})=>{owners.push(request.actorId);expect(f.state).toEqual(before);return {}}});
  expect(result.ok,JSON.stringify(result)).toBe(true);expect(owners).toEqual(['owner']);expect(result.state.combatants.owner).toMatchObject({currentHp:1,elevationFeet:0,airborne:false});expect(result.state.combatants.owner.classResources['dnd5e-racial-half-orc-relentless-endurance'].current).toBe(0);expect(result.state.combatants.owner.turn.reactionAvailable).toBe(true);expect(result.state.combatants.owner.classState.activityWeaponAttackGrants).toEqual({});expect(result.events.filter(e=>e.type==='relentless-endurance-triggered')).toHaveLength(1);expect(f.state).toEqual(before)
 }finally{f.dispose()}
})

it('actual non-action environmental support loss settles via the production followup facade with a genuine owner choice',async()=>{
 const f=fixture();try{
  const hero=f.state.combatants.owner;hero.position={x:5,y:0};hero.airborne=true;hero.elevationFeet=30;hero.groundElevationFeet=0;
  hero.classState.activeEffects=[createDnd5eMechanicalEffect({id:'support',definitionId:'srd-5.1:spell:gaseous-form',label:'Support',targetId:hero.id,source:{kind:'spell',actorId:hero.id,rulesId:'gaseous-form'},duration:{type:'rounds',remainingRounds:10,tickOn:'target-turn-end'},modifiers:{flySpeedFeet:10,hoverWhileFlying:true}})];
  f.state.combatants.enemy.position={x:0,y:0};f.state.combatants.next.position={x:20,y:0};f.state.combatants.chosen.position={x:30,y:0};
  const before=structuredClone(f.state),after=structuredClone(before);after.combatants.owner.classState.activeEffects=[];
  const map:BattleMap={id:'map',name:'Map',width:1000,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:Object.values(after.combatants).map(c=>({id:c.id,type:'enemy',poolId:'srd-5.1:goblin',label:c.id,hp:c.currentHp,maxHp:c.maxHp,x:c.position.x*10+25,y:25,size:1,color:'',emoji:''}))};
  const calls:string[]=[];const result=await settleDnd5eConcentrationChecks({result:{ok:true,state:after,events:[]},priorState:before,map,characters:[],characterIdByCombatantId:{},rollD20:async()=>20,rollD4:async()=>1,rollDice:async()=>[2,3,4],damageReactions:{combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[],chooseRelentlessReaction:async({request,state})=>{calls.push(request.actorId);expect(after.combatants.owner.currentHp).toBe(2);expect(state.combatants.owner.currentHp).toBe(1);return {}}}});
  expect(calls).toEqual(['owner']);expect(result.result.state.combatants.owner).toMatchObject({currentHp:1,elevationFeet:0,airborne:false});expect(result.result.state.combatants.owner.turn.reactionAvailable).toBe(true);expect(result.result.state.combatants.owner.classResources['dnd5e-racial-half-orc-relentless-endurance'].current).toBe(0);expect(result.result.events.filter(e=>e.type==='relentless-endurance-triggered')).toHaveLength(1);expect(result.application.map.tokens.find(t=>t.id==='owner')?.hp).toBe(1);expect(after.combatants.owner.currentHp).toBe(2)
 }finally{f.dispose()}
})
