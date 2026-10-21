import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createLongCastingOwnerLeases} from '../../shared/long-casting-owner-leases.mjs'
import {executeLongCastingOwnerCommand} from './long-casting-owner-service.mjs'
const binding={mapId:'map',requestId:'cast',spellId:'module:spell',actorTokenId:'token',actorCharacterId:'character'}
function fixture(){
 let role='dm',current={...binding},time=0
 const store=createLongCastingOwnerLeases({now:()=>time})
 const dependencies={store,authorize:async(credential,roomId)=>credential==='valid'?{role,roomId,memberId:'member'}:null,
  readCurrentBinding:async()=>current}
 const run=(command,credential='valid',roomId='room')=>executeLongCastingOwnerCommand({roomId,credential,command},dependencies)
 return {run,dependencies,setRole:value=>{role=value},setCurrent:value=>{current=value},advance:value=>{time+=value}}
}
test('authentication precedes any lease read or write; payload roles cannot grant DM access',async()=>{
 const f=fixture()
 for(const role of ['player','spectator']){
  f.setRole(role)
  assert.equal((await f.run({operation:'acquire',binding,instanceId:'browser',role:'dm'})).status,403)
 }
 f.setRole('dm')
 assert.equal((await f.run({operation:'status',binding},'invalid')).status,403)
 assert.equal(f.dependencies.store.snapshot().records.length,0)
})
test('durable identity authorizes acquisition and renewal, while another context sees only active status',async()=>{
 const f=fixture(),owned=await f.run({operation:'acquire',binding,instanceId:'a'})
 assert.equal(owned.status,200);assert.ok(owned.body.proof)
 assert.deepEqual(await f.run({operation:'status',binding}),{status:200,body:{active:true}})
 assert.equal((await f.run({operation:'acquire',binding,instanceId:'b'})).status,409)
 assert.equal((await f.run({operation:'renew',binding,instanceId:'b',proof:owned.body.proof})).status,409)
 assert.equal((await f.run({operation:'renew',binding,instanceId:'a',proof:owned.body.proof})).status,200)
 f.setCurrent({...binding,spellId:'replacement'})
 assert.equal((await f.run({operation:'renew',binding,instanceId:'a',proof:owned.body.proof})).body.error,'casting-identity-changed')
 assert.deepEqual((await f.run({operation:'status',binding})).body,{active:false})
})
test('forged room, member, owner, expiry or progress fields are rejected rather than trusted',async()=>{
 const f=fixture()
 for(const extra of [{ownerId:'member:b'},{memberId:'other'},{expiresAt:999999},{progress:600},{role:'dm'}])
  assert.equal((await f.run({operation:'acquire',binding,instanceId:'a',...extra})).status,400)
 assert.equal((await f.run({operation:'acquire',binding:{...binding,roomId:'other'},instanceId:'a'})).status,400)
 for(const field of Object.keys(binding)){
  assert.equal((await f.run({operation:'acquire',binding:{...binding,[field]:'other'},instanceId:'a'})).status,409)
 }
 assert.equal(f.dependencies.store.snapshot().records.length,0)
})
test('release after completed cast requires private owner proof and never touches a replacement owner',async()=>{
 const f=fixture(),owned=await f.run({operation:'acquire',binding,instanceId:'a'})
 f.setCurrent(undefined)
 assert.equal((await f.run({operation:'release',binding,instanceId:'b',proof:owned.body.proof})).status,409)
 assert.deepEqual(await f.run({operation:'release',binding,instanceId:'a',proof:owned.body.proof}),{status:200,body:{released:true}})
 f.setCurrent(binding)
 const next=await f.run({operation:'acquire',binding,instanceId:'b'});assert.equal(next.status,200)
 assert.equal((await f.run({operation:'release',binding,instanceId:'a',proof:owned.body.proof})).status,409)
 assert.deepEqual((await f.run({operation:'status',binding})).body,{active:true})
})
test('expired proofs cannot restore progress, and storage failures propagate instead of authorizing cleanup',async()=>{
 const f=fixture(),owned=await f.run({operation:'acquire',binding,instanceId:'a'})
 f.advance(30000)
 assert.equal((await f.run({operation:'renew',binding,instanceId:'a',proof:owned.body.proof})).status,409)
 f.dependencies.store.isActive=async()=>{throw Error('private-store-unavailable')}
 await assert.rejects(()=>f.run({operation:'status',binding}),/private-store-unavailable/)
})
