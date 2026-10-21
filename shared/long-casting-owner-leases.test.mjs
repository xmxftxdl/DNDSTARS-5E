import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createLongCastingOwnerLeases} from './long-casting-owner-leases.mjs'
const binding={roomId:'room',mapId:'map',requestId:'cast',spellId:'package:spell',actorTokenId:'token',actorCharacterId:'character'}
function fixture(){let time=0,sequence=0;return {store:createLongCastingOwnerLeases({now:()=>time,createProof:()=>`proof-${++sequence}`,ttlMs:30000}),advance:value=>{time+=value}}}
test('another browser cannot acquire, renew or release a live owner even with the same DM identity',()=>{
 const{store}=fixture(),lease=store.acquire(binding,'member:browser-a')
 assert.ok(lease);assert.equal(store.isActive(binding),true)
 assert.equal(store.acquire(binding,'member:browser-b'),undefined)
 assert.equal(store.acquire(binding,'member:browser-a'),undefined)
 assert.equal(store.renew(binding,'member:browser-b',lease.proof),undefined)
 assert.equal(store.release(binding,'member:browser-b',lease.proof),false)
 assert.equal(store.renew(binding,'member:browser-a','forged-proof'),undefined)
 assert.equal(store.isActive(binding),true)
})
test('only an owner heartbeat extends server time, reads never extend it',()=>{
 const{store,advance}=fixture(),lease=store.acquire(binding,'owner')
 advance(29000);assert.equal(store.isActive(binding),true)
 assert.deepEqual(store.renew(binding,'owner',lease.proof),{expiresAt:59000})
 advance(29999);assert.equal(store.isActive(binding),true)
 advance(1);assert.equal(store.isActive(binding),false)
 assert.equal(store.renew(binding,'owner',lease.proof),undefined)
})
test('an expired lease cannot resurrect or mutate a replacement cast',()=>{
 const{store,advance}=fixture(),old=store.acquire(binding,'old')
 advance(30000);const nextBinding={...binding,requestId:'new-cast'},next=store.acquire(nextBinding,'new')
 assert.ok(next);assert.equal(store.isActive(binding),false);assert.equal(store.isActive(nextBinding),true)
 assert.equal(store.renew(nextBinding,'old',old.proof),undefined)
 assert.equal(store.release(binding,'old',old.proof),false)
 assert.equal(store.isActive(nextBinding),true)
 assert.equal(store.release(nextBinding,'new',next.proof),true)
 assert.equal(store.isActive(nextBinding),false)
})
test('proof is bound to the exact casting identity; callers cannot mutate the stored binding',()=>{
 const{store}=fixture(),input={...binding},lease=store.acquire(input,'owner')
 input.spellId='forged'
 assert.equal(store.isActive(binding),true)
 for(const field of Object.keys(binding)){
  const wrong={...binding,[field]:'other'}
  assert.equal(store.isActive(wrong),false)
  assert.equal(store.renew(wrong,'owner',lease.proof),undefined)
  assert.equal(store.release(wrong,'owner',lease.proof),false)
 }
 assert.equal(store.isActive(binding),true)
})
test('rooms, maps and casters do not share a lease; server restart loses ownership rather than restoring progress',()=>{
 const{store}=fixture();assert.ok(store.acquire(binding,'owner'))
 for(const field of ['roomId','mapId','actorCharacterId'])assert.ok(store.acquire({...binding,[field]:'other'},'owner'))
 assert.equal(fixture().store.isActive(binding),false)
})
test('malformed identities and invalid TTLs cannot create leases',()=>{
 const{store}=fixture()
 for(const field of Object.keys(binding))for(const value of ['',null,1])assert.equal(store.acquire({...binding,[field]:value},'owner'),undefined)
 assert.equal(store.acquire(binding,''),undefined)
 for(const ttlMs of [0,-1,999,120001,NaN,1.5])assert.throws(()=>createLongCastingOwnerLeases({ttlMs}))
})
