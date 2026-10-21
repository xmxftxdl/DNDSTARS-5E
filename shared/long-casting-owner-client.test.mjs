import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createLongCastingOwnerClient} from './long-casting-owner-client.mjs'
import {createLongCastingOwnerLeases} from './long-casting-owner-leases.mjs'
import {executeLongCastingOwnerCommand} from '../scripts/application/long-casting-owner-service.mjs'

const binding={mapId:'map',requestId:'cast',spellId:'ceremony',actorTokenId:'token',actorCharacterId:'character'}
const drain=async()=>{for(let index=0;index<20;index++)await Promise.resolve()}
function setup(){
  let now=0,nextTimer=0,nextProof=0,current={...binding}
  const timers=new Map(),events=[]
  const store=createLongCastingOwnerLeases({now:()=>now,createProof:()=>`private-${++nextProof}`})
  const send=(command)=>executeLongCastingOwnerCommand({roomId:'ABC123',credential:'host',command},{
    authorize:async()=>({role:'dm',roomId:'ABC123',memberId:'host'}),
    readCurrentBinding:async()=>current,store,
  })
  const client=(instanceId,overrides={})=>createLongCastingOwnerClient({binding,instanceId,send,
    onLost:error=>events.push(['lost',error.message]),onError:error=>events.push(['error',error.message]),
    setTimer:(callback,ms)=>{const id=++nextTimer;timers.set(id,{callback,ms});return id},
    clearTimer:id=>timers.delete(id),...overrides})
  return {store,send,client,events,timers,advance:value=>{now+=value},replace:value=>{current=value},
    fire:ms=>{const [id,timer]=[...timers].find(([,timer])=>timer.ms===ms)??[];assert.ok(timer);timers.delete(id);timer.callback()},
    active:()=>store.isActive({...binding,roomId:'ABC123'})}
}

test('independent browser owners cannot acquire the same live casting; close frees it',async()=>{
  const env=setup(),first=env.client('first'),second=env.client('second')
  assert.equal(await first.start(),true)
  assert.equal(await second.start(),false)
  assert.equal(first.phase,'active');assert.equal(second.phase,'lost')
  assert.equal('proof' in first,false)
  await first.close();assert.equal(env.active(),false)
  const replacement=env.client('replacement')
  assert.equal(await replacement.start(),true)
  await replacement.close();assert.equal(env.timers.size,0)
})

test('heartbeat keeps ownership beyond original expiry, without extending casting state',async()=>{
  const env=setup(),owner=env.client('first')
  assert.equal(await owner.start(),true)
  for(let index=0;index<4;index++){
    env.advance(10000);env.fire(10000);await drain()
    assert.equal(env.active(),true);assert.equal(owner.phase,'active')
  }
  assert.equal(await owner.assertOwned(),true)
  assert.deepEqual(env.events,[])
  await owner.close()
})

test('expired original owner cannot continue or retire replacement ownership',async()=>{
  const env=setup(),owner=env.client('old')
  await owner.start();env.advance(31000)
  const replacement=env.client('new');assert.equal(await replacement.start(),true)
  assert.equal(await owner.assertOwned(),false)
  assert.equal(owner.phase,'lost');assert.equal(env.events.filter(e=>e[0]==='lost').length,1)
  await drain();assert.equal(env.active(),true)
  assert.equal(await owner.assertOwned(),false);assert.equal(env.events.filter(e=>e[0]==='lost').length,1)
  await owner.close();assert.equal(env.active(),true)
  await replacement.close()
})

test('canonical casting replacement invalidates private continuation before loss cleanup finishes',async()=>{
  const env=setup();let privatePrepared=true
  const owner=env.client('first',{onLost:()=>{privatePrepared=false;return new Promise(()=>{})}})
  await owner.start();env.replace({...binding,requestId:'different-cast'})
  assert.equal(await owner.assertOwned(),false)
  assert.equal(privatePrepared,false);assert.equal(owner.phase,'lost')
  await owner.close()
})

test('disposal during acquisition releases its late server proof and never starts heartbeat',async()=>{
  const env=setup();let deliver
  const owner=env.client('first',{send:async command=>{
    const result=await env.send(command)
    if(command.operation==='acquire')await new Promise(resolve=>{deliver=resolve})
    return result
  }})
  const start=owner.start();await drain();assert.equal(env.active(),true)
  const closing=owner.close();assert.equal(owner.phase,'closed')
  deliver();assert.equal(await start,false);await closing
  assert.equal(env.active(),false);assert.equal(env.timers.size,0)
})

test('unresponsive renewal aborts and cannot leave private casting active indefinitely',async()=>{
  const env=setup();let aborted=false,networkStalled=false,prepared=true
  const owner=env.client('first',{requestTimeoutMs:1000,onLost:()=>{prepared=false},send:(command,signal)=>{
    if(!networkStalled)return env.send(command)
    signal.addEventListener('abort',()=>{aborted=true},{once:true})
    return new Promise(()=>{})
  }})
  await owner.start();networkStalled=true
  const renewal=owner.assertOwned();await drain();env.fire(1000)
  assert.equal(await renewal,false);assert.equal(aborted,true);assert.equal(prepared,false);assert.equal(owner.phase,'lost')
  await drain();env.fire(1000);await drain() // best-effort release also has bounded time
  await owner.close();assert.equal(env.timers.size,0)
})

test('closing during renewal cannot be undone by its late successful response',async()=>{
  const env=setup();let deliver
  const owner=env.client('first',{send:async command=>{
    const result=await env.send(command)
    if(command.operation==='renew')await new Promise(resolve=>{deliver=resolve})
    return result
  }})
  await owner.start();const renewal=owner.assertOwned();await drain()
  await owner.close();assert.equal(env.active(),false)
  deliver();assert.equal(await renewal,false);assert.equal(owner.phase,'closed')
  assert.deepEqual(env.events,[]);assert.equal(env.timers.size,0)
})
