import {expect,it,vi} from 'vitest'
import {CombatLongCastingSessions,prepareCombatLongCastingCompletion,waitForCombatLongCastingTurn,readCombatLongCastingReentry} from './combatLongCastingSessions'
import type {SharedCombatState} from '../../lib/sharedCombatTypes'
import {createCombatTransaction} from '../../lib/combatTransaction'
import type {PreparedDnd5ePluginSpellCast} from '../../rulesets/dnd5e/pluginSpellTransaction'
function publishedTurn():SharedCombatState{return {mapId:'map',combatId:'combat',active:true,round:4,initiativeIndex:0,
  initiativeOrder:[{tokenId:'token',label:'Caster',emoji:'',color:'#fff',roll:10}],
  dnd5eTurnEconomyByToken:{token:{turnKey:'combat:4:token',attacksUsed:0,action:{current:1,max:1},
    bonusAction:{current:1,max:1},reaction:{current:1,max:1},movement:{current:30,max:30}}},updatedAt:1}}
const turnIdentity={mapId:'map',combatId:'combat',round:4,initiativeIndex:0,actorTokenId:'token'}
it('reentry reads the server winner after an old publication conflicts without granting an action',async()=>{
  const state=publishedTurn();state.dnd5eTurnEconomyByToken!.token.action.current=0
  const read=vi.fn(async()=>state)
  expect(await readCombatLongCastingReentry({...turnIdentity,publication:Promise.reject(Error('conflict')),read})).toBe(state)
  expect(read).toHaveBeenCalledOnce();expect(state.dnd5eTurnEconomyByToken!.token.action.current).toBe(0)
})
it.each(['map','combat','round','index','inactive','missing'] as const)('reentry rejects a mismatched server winner: %s',async(kind)=>{
  const state=publishedTurn()
  if(kind==='map')state.mapId='other'
  if(kind==='combat')state.combatId='other'
  if(kind==='round')state.round++
  if(kind==='index')state.initiativeIndex++
  if(kind==='inactive')state.active=false
  expect(await readCombatLongCastingReentry({...turnIdentity,publication:Promise.reject(Error('conflict')),
    read:async()=>kind==='missing'?null:state})).toBeUndefined()
})
it('reentry does not treat a failed authority read as a valid snapshot',async()=>{
  await expect(readCombatLongCastingReentry({...turnIdentity,publication:Promise.resolve(),
    read:async()=>{throw Error('offline')}})).rejects.toThrow('offline')
})
it('does not read or authorize a maintenance turn until the turn publication commits',async()=>{
  let commit!:()=>void
  const publication=new Promise<void>(resolve=>{commit=resolve}),read=vi.fn(async()=>publishedTurn())
  const waiting=waitForCombatLongCastingTurn({...turnIdentity,publication,read})
  await Promise.resolve();expect(read).not.toHaveBeenCalled()
  commit();expect(await waiting).toEqual(publishedTurn());expect(read).toHaveBeenCalledOnce()
})
it.each(['round','actor','spent','combat','inactive'] as const)('refuses a newer authority winner: %s',async(kind)=>{
  const state=publishedTurn()
  if(kind==='round')state.round++
  if(kind==='actor')state.initiativeOrder[0].tokenId='other'
  if(kind==='spent')state.dnd5eTurnEconomyByToken!.token.action.current=0
  if(kind==='combat')state.combatId='new-combat'
  if(kind==='inactive')state.active=false
  expect(await waitForCombatLongCastingTurn({...turnIdentity,publication:Promise.resolve(),read:async()=>state})).toBeUndefined()
})
it('recovers from a failed earlier publication only when the server confirms the exact payable turn',async()=>{
  const read=vi.fn(async()=>publishedTurn())
  expect(await waitForCombatLongCastingTurn({...turnIdentity,publication:Promise.reject(Error('conflict')),read})).toEqual(publishedTurn())
  expect(read).toHaveBeenCalledOnce()
  const spent=publishedTurn();spent.dnd5eTurnEconomyByToken!.token.action.current=0
  expect(await waitForCombatLongCastingTurn({...turnIdentity,publication:Promise.reject(Error('conflict')),read:async()=>spent})).toBeUndefined()
})
function prepared(actorId='actor'):PreparedDnd5ePluginSpellCast{
  return {action:{id:'start-'+actorId,combatId:'combat'},castingTime:'long',map:{id:'map'},actor:{id:actorId},actorToken:{id:'token'},spell:{id:'package:spell'},state:{round:3},
    activityHeadlessAction:{type:'plugin',pluginId:'package',actionId:'spell',actorId:'token',transactionId:'start-'+actorId},
    transaction:createCombatTransaction({id:'start-'+actorId,mapId:'map',combatId:'combat',actorId,actionId:'start-'+actorId,
      actionKind:'plugin-spell',activityDefinitionId:'package:spell'})} as PreparedDnd5ePluginSpellCast
}
it.each(['continueOutsideCombat','continueInsideCombat'] as const)('does not transfer a long cast when the authoritative owner lease is lost: %s',async(method)=>{
  const store=new CombatLongCastingSessions(),assertOwned=vi.fn(async()=>false)
  const session=store.start(prepared(),()=>{}, {request:async()=>{}},{assertOwned,close:async()=>{}} as never)!
  expect(await store[method](session,{} as never,480)).toBe(false)
  expect(assertOwned).toHaveBeenCalledOnce();expect(session.exploration).toBeUndefined()
  store.dispose()
})
it.each(['continueOutsideCombat','continueInsideCombat'] as const)('cannot resurrect a removed session when an earlier ownership check resolves: %s',async(method)=>{
  const store=new CombatLongCastingSessions();let resolve!:(value:boolean)=>void
  const owner={assertOwned:()=>new Promise<boolean>(done=>{resolve=done}),close:async()=>{}}
  const session=store.start(prepared(),()=>{}, {request:async()=>{}},owner as never)!
  const pending=store[method](session,{} as never,480)
  store.remove(session);resolve(true)
  expect(await pending).toBe(false);expect(session.exploration).toBeUndefined();expect(store.all()).toHaveLength(0)
})
it('holds a separate session lease until removal without awaiting it in the start transaction',async()=>{
  const store=new CombatLongCastingSessions(),stop=vi.fn()
  let run!:()=>Promise<void>,done=false
  const request=vi.fn((_name:string,_options:unknown,callback:(lock:unknown)=>Promise<void>)=>{run=()=>callback({});return Promise.resolve()})
  const session=store.start(prepared(),stop,{request})!
  expect(request).toHaveBeenCalledWith('astral-trace:dm-player-action:map:start-actor',{mode:'exclusive'},expect.any(Function))
  const held=run().then(()=>{done=true});await Promise.resolve();expect(done).toBe(false)
  store.remove(session);await held;expect(stop).toHaveBeenCalledTimes(1);expect(store.all()).toHaveLength(0)
  store.remove(session);expect(stop).toHaveBeenCalledTimes(1)
})
it('refuses duplicate owners and disposes every observation and lease',()=>{
  const store=new CombatLongCastingSessions(),stop=vi.fn(),request=vi.fn(async()=>{})
  expect(store.start(prepared(),stop,{request})).toBeTruthy()
  expect(store.start(prepared(),stop,{request})).toBeUndefined()
  expect(store.start(prepared('other'),stop,{request})).toBeTruthy()
  store.dispose();expect(stop).toHaveBeenCalledTimes(2);expect(store.all()).toHaveLength(0)
})
it('drops continuity if acquiring the session lease fails',async()=>{
  const store=new CombatLongCastingSessions(),stop=vi.fn()
  store.start(prepared(),stop,{request:async()=>{throw Error('lease unavailable')}})
  await Promise.resolve();expect(store.all()).toHaveLength(0);expect(stop).toHaveBeenCalledOnce()
})
it('gives completion a new transaction while preserving the original continuity binding',()=>{
  const original=prepared(),store=new CombatLongCastingSessions(),session=store.start(original,()=>{}, {request:async()=>{}})!
  const completion=prepareCombatLongCastingCompletion(session,{...original.action,id:'completion',combatId:'second'} as never,7)
  expect(completion.action).toBe(original.action);expect(completion.transaction).toMatchObject({id:'completion',actionId:'completion',combatId:'second',
    activity:{executionId:'completion',parentExecutionId:'start-actor'}})
  expect(completion.activityHeadlessAction?.transactionId).toBe('completion');expect(original.activityHeadlessAction?.transactionId).toBe('start-actor')
  store.dispose()
})
