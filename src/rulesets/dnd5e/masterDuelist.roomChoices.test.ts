import {it,expect} from 'vitest'
import {fixture} from './masterDuelist.native.scene.fixture'
import {createSecondChanceRoomChoiceDriver} from '../../lib/secondChanceRoomChoices'
import {resolveDnd5eActionWithDamageReactions} from './damageReactionFlow'
import type {Dnd5eAction} from './headlessCombatEngine'
const action=():Extract<Dnd5eAction,{type:'attack'}>=>({type:'attack',actorId:'rogue-token',targetId:'target-token',attackModifier:5,d20:2,damage:{count:1,sides:8,bonus:0,rolls:[],type:'slashing'},classDamageContext:{mode:'melee',finesse:false,strengthBased:true,weaponDamageSides:8,damageType:'slashing',adjacentEnemyOfTarget:false}})
const unused=async():Promise<never>=>{throw Error('Unrelated operation')}
for(const scenario of ['use','decline','bad-pool','stale']as const)it('real native parent uses canonical room adapter: '+scenario,async()=>{
 const f=await fixture();try{
 const original=structuredClone(f.state),calls:Array<{count:number;sides:number;owner:unknown}>=[];let current=true;
 const driver=createSecondChanceRoomChoiceDriver({map:f.map,characters:()=>f.characters,parentTransactionId:()=> 'room-original-master',rollD20:unused,
 choose:async request=>{if(!request.actor)throw Error('Actual canonical actor required');expect(request.actor.id).toBe('rogue');expect(request.transactionId).toBe('room-original-master');expect(request.audience).toBe('actor');expect(request.defaultOptionId).toBe('pending');expect(f.state).toEqual(original);if(scenario==='stale')current=false;return scenario==='decline'?'decline':request.options.at(-1)!.id},
 rollDice:async(count,sides,_label,_name,owner)=>{if(!owner.durableRollRequestId)throw Error('Actual durable pool required');calls.push({count,sides,owner});expect(owner.rollerTokenId).toBe('rogue-token');expect(owner.rollerCharacterId).toBe('rogue');expect(owner.skipChoiceReroll).toBe(true);expect(owner.durableRollRequestId.startsWith('master-duelist:')).toBe(true);expect(f.state).toEqual(original);if(sides===20){expect(owner.d20RollKind).toBe('attack');expect(owner.d20RollMode).toBe('advantage');return scenario==='bad-pool'?[20]:[12,15]}return[6]},masterDuelist:{authorityUnchanged:()=>current,shield:unused}});
 const promise=resolveDnd5eActionWithDamageReactions({...driver,state:f.state,action:action(),combatRevision:0,replayEventBatchId:'room-original-master',authorityUnchanged:()=>current,confirm:unused,roll:unused});
 if(scenario==='stale'){await expect(promise).rejects.toThrow('stale-parent');expect(calls).toHaveLength(0)}
 else if(scenario==='bad-pool'){await expect(promise).rejects.toThrow('invalid-whole-pool');expect(calls).toHaveLength(1)}
 else{const result=await promise;expect(result.ok).toBe(true);expect(result.state.combatants['rogue-token'].classResources[f.ns+':master-duelist'].current).toBe(scenario==='use'?0:1);expect(result.state.combatants['target-token'].currentHp).toBe(original.combatants['target-token'].currentHp-(scenario==='use'?6:0));expect(calls.map(x=>[x.count,x.sides])).toEqual(scenario==='use'?[[2,20],[1,8]]:[])}
 expect(f.state).toEqual(original);
 }finally{f.dispose()}
})
