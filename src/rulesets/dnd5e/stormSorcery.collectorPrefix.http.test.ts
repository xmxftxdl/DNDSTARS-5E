import {it,expect,vi} from 'vitest'
import {fixture} from './stormSorcery.castRoom.native.fixture'
import {prepareDnd5eSpellCast} from './spellAction'
import {prepareStormCastCollectorPrefix} from './stormCastCollectorPrefix'
import {damageZeroNormalAckHttpFixture} from './damageZeroNormalAck.http.support'
import {createStormCastRoomChoiceDriver} from '../../lib/stormCastRoomChoices'
import {createCombatInterrupt} from '../../lib/combatInterruptQueue'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import type {StormCastOriginalPreparationBook} from './stormCastOriginalPreparation'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it.each(['use','decline','cancel','zero'] as const)('actual missing-roll collector freezes %s before any new physical save and cold-restores without another owner decision',async mode=>{
 const f=await fixture(),http=await damageZeroNormalAckHttpFixture()
 try{
  const characters=f.input.characters.map(c=>c.id==='storm'?{...c,roomId:'room',roomMemberId:'first-member'}:c),action={...f.input.action,roomMemberId:'first-member'},p=prepareDnd5eSpellCast({...f.input,characters,action});if(!p.ok)throw Error(p.reason)
  const source={prepared:p.prepared,effectRolls:[] as number[],opportunityAttackSpell:false,spellcastingSavingThrows:[]},identity={parentId:action.id,mapId:p.prepared.map.id,combatId:p.prepared.state.combatId},data:any={characters:{characters},maps:{maps:[p.prepared.map]},combat:{active:true,mapId:identity.mapId,combatId:identity.combatId,round:p.prepared.state.round,initiativeIndex:p.prepared.state.initiativeIndex,initiativeOrder:f.input.initiativeOrder,dnd5eTurnEconomyByToken:{}},'player-action-requests':{requests:[action]},'map-geometry':{},'campaign-time':{elapsedSeconds:0}}
  for(const doc of Object.values(data) as any[])doc._sync={schemaVersion:1,revision:1,writerId:'host',writtenAt:1}
  const world=structuredClone(data),wire=encodeSecondChanceParentWire(source);let prompts=0,events=0
  const driver=createStormCastRoomChoiceDriver({map:p.prepared.map,characters:()=>characters,parentTransactionId:()=>action.id,authorityUnchanged:()=>true,choose:async request=>{
   prompts++;const row=createCombatInterrupt({id:request.id,transactionId:request.transactionId,mapId:request.mapId,kind:'plugin-choice',actorCharId:request.actor.id,payload:{pluginId:request.pluginId,featureId:request.featureId,featureName:request.featureName,prompt:request.prompt,audience:'actor',options:request.options,defaultOptionId:request.defaultOptionId},expiresAt:Date.now()+60000})
   const upsert=await http.state('PATCH','combat-interrupts/interrupt',{operation:'upsert',mapId:identity.mapId,interrupt:row},data,'host');expect(upsert.status,JSON.stringify(upsert.payload)).toBe(200);data['combat-interrupts']=await http.readActualResource('combat-interrupts')
   const optionId=request.id.endsWith(':use')?(mode==='decline'?'decline':'use'):request.id.endsWith(':damage-type')?(mode==='cancel'?'cancel':'lightning'):mode==='use'&&request.id.endsWith(':target:foe-token')?'select':'skip'
   const wrong=await http.state('PATCH','combat-interrupts/interrupt',{operation:'answer',mapId:identity.mapId,id:row.id,response:{optionId}},data,'second-member');expect(wrong.status).toBe(403)
   const answer=await http.state('PATCH','combat-interrupts/interrupt',{operation:'answer',mapId:identity.mapId,id:row.id,response:{optionId}},data,'first-member');expect(answer.status,JSON.stringify(answer.payload)).toBe(200);data['combat-interrupts']=await http.readActualResource('combat-interrupts')
   const finish=await http.state('PATCH','combat-interrupts/interrupt',{operation:'finish',mapId:identity.mapId,id:row.id,response:{optionId}},data,'host');expect(finish.status,JSON.stringify(finish.payload)).toBe(200);data['combat-interrupts']=await http.readActualResource('combat-interrupts');return optionId
  }})
  const load=async(id:typeof identity)=>{const r=await http.state('POST','storm-cast-preparation/probe',id,data,'host');expect(r.status,JSON.stringify(r.payload)).toBe(200);return r.payload.present===false?undefined:r.payload as StormCastOriginalPreparationBook},gateway={publishEvent:async(channel:string,payload:unknown)=>{const r=await http.event(channel,payload,data,'host');expect(r.status,JSON.stringify(r.payload)).toBe(200);events++}},actual=await prepareStormCastCollectorPrefix({source,gateway,load,authorityUnchanged:()=>true,choose:driver.chooseStormCast!})
  expect(actual).toBeDefined();expect(actual!.next.status).toBe('original-d20-ready');if(actual!.next.status!=='original-d20-ready')throw Error('Actual missing-original native boundary required');expect(actual!.next.request.originalRolls).toEqual([0]);expect(actual!.next.snapshot.combatants['foe-token'].currentHp).toBe(mode==='use'?7:10);expect(actual!.source.effectRolls).toEqual([]);expect(actual!.source).not.toHaveProperty('savingThrowD20');expect(actual!.source).not.toHaveProperty('d20');expect(actual!.source.hostOriginalD20Replay?.facts).toEqual([]);expect(events).toBe(2);expect(prompts).toBeGreaterThan(0);expect(encodeSecondChanceParentWire(source)).toEqual(wire)
  const beforePrompts=prompts,beforeEvents=events,cold=await prepareStormCastCollectorPrefix({source:structuredClone(source),gateway,load,authorityUnchanged:()=>true,choose:async()=>{throw Error('Protected owner decision must not be asked again')}});expect(cold!.book.effectTimestamp).toBe(actual!.book.effectTimestamp);expect(cold!.next.status).toBe('original-d20-ready');expect(prompts).toBe(beforePrompts);expect(events).toBe(beforeEvents);expect(cold!.book).toEqual(actual!.book)
  await expect(prepareStormCastCollectorPrefix({source,gateway,load,authorityUnchanged:()=>false,choose:driver.chooseStormCast!})).rejects.toThrow('authority-changed')
  for(const [name,value] of Object.entries(world))expect(await http.readActualResource(name)).toEqual(value)
  await expect(http.readActualResource('player-action-ack')).rejects.toMatchObject({code:'ENOENT'});await expect(http.readActualResource('player-action-processed')).rejects.toMatchObject({code:'ENOENT'})
 }finally{await http.close();f.dispose()}
},60000)
