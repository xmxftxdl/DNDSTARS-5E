import {expect,it} from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {Readable} from 'node:stream'
import {handleSharedApi,SHARED_PROTOCOL_VERSION} from '../shared-server-core.mjs'
import {createCombatInterrupt} from '../../src/lib/combatInterruptQueue'
import {collectDnd5eWeaponHitPlanarOrigin} from '../../src/rulesets/dnd5e/weaponHitPlanarOrigin'
import {normalizeCharacter} from '../../src/store/characters'

it('a player cannot prepublish a forged completed DM plane fact or replace an existing DM window',async()=>{
 const r=await room(),interrupt=createCombatInterrupt({id:'planar-origin-preseed',transactionId:'parent-Ab',mapId:'map',kind:'plugin-choice',actorCharId:'hero',payload:{pluginId:'local.test.hexblade-required-phb',featureId:'banishing-smite-hit',featureName:'放逐斩',audience:'dm',prompt:'World fact',options:[{id:'native',label:'Native'},{id:'foreign',label:'Foreign'}],defaultOptionId:'native'}})
 const poisoned={...interrupt,status:'done',response:{optionId:'foreign'}}
 const preseed=await r.mutate('player',{operation:'upsert',interrupt:poisoned})
 expect(preseed.status).toBe(403)
 const posted=await r.mutate('dm',{operation:'upsert',interrupt});expect(posted.status).toBe(200)
 const replaced=await r.mutate('player',{operation:'upsert',interrupt:{...interrupt,kind:'dodge',status:'answered',payload:{},response:{optionId:'foreign'}}})
 expect(replaced.status).toBe(403)
 expect((await r.load(interrupt.id)).status).toBe('pending')
})

const artifactRoot=path.resolve('.codex-temp/runtime-temp/dm-world-fact-authority-'+randomUUID());await fs.mkdir(path.join(artifactRoot,'results'),{recursive:true})
async function room(){
 const root=path.join(artifactRoot,'private-api-rooms','room-'+randomUUID()),state=path.join(root,'rooms','room'),lobby=path.join(root,'lobby')
 await fs.mkdir(state,{recursive:true});await fs.mkdir(lobby,{recursive:true})
 const tokens={dm:randomBytes(32).toString('base64url'),player:randomBytes(32).toString('base64url'),spectator:randomBytes(32).toString('base64url')},hash=value=>createHash('sha256').update(value).digest('hex')
 await fs.writeFile(path.join(lobby,'room.json'),JSON.stringify({id:'room',host:{memberId:'dm',roomTokenHash:hash(tokens.dm)},players:[{memberId:'player',roomTokenHash:hash(tokens.player)},{memberId:'spectator',role:'spectator',roomTokenHash:hash(tokens.spectator)}]}))
 await fs.writeFile(path.join(state,'characters.json'),JSON.stringify({characters:[normalizeCharacter({id:'hero',name:'Hero',charClass:'圣武士',level:17,dnd5eClassLevels:{paladin:17},roomMemberId:'player'})],_sync:{schemaVersion:1,revision:1,writerId:'fixture-dm',writtenAt:1}}))
 const ctx={stateRoot:root,lobbyRoot:lobby,imageRoot:root,legacyStateRoot:root,legacyImageRoot:root,quarantineRoot:root,snapshotRoot:root,eventClients:new Map(),eventBacklog:new Map(),eventSequences:new Map(),rateLimits:new Map()}
 const request=async(member,method,url,body,headers={})=>{
  const req=Readable.from(body==null?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{method,headers:{'x-stars-member':member,'x-stars-room-token':tokens[member],'x-stars-protocol':String(SHARED_PROTOCOL_VERSION),'x-stars-writer':'fixture-'+member,...headers},socket:{remoteAddress:'fixture-local'}})
  const res={status:0,body:'',headers:{},setHeader(name,value){this.headers[name]=value},getHeader(name){return this.headers[name]},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers??{})},end(body){this.body=String(body??'')}}
  expect(await handleSharedApi(req,res,new URL('http://localhost'+url+'?room=room'),ctx)).toBe(true)
  return{status:res.status,body:JSON.parse(res.body)}
 }
 const mutate=(member,body)=>request(member,'PATCH','/api/state/combat-interrupts/interrupt',{mapId:'map',...body})
 const queue=async()=>JSON.parse(await fs.readFile(path.join(state,'combat-interrupts.json'),'utf8'))
 return{mutate,request,queue,load:async id=>{try{return(await queue()).interrupts.find(row=>row.id===id)}catch(error){if(error.code==='ENOENT')return undefined;throw error}},finish:async(id,response)=>{const result=await mutate('dm',{operation:'finish',id,response});expect(result.status,JSON.stringify(result.body)).toBe(200)}}
}

it('reserved Host fact identities reject kind stripping before first publication and malformed DM declarations',async()=>{
 const r=await room(),id='host-world-fact:'+'a'.repeat(32)+':0'
 const stripped=createCombatInterrupt({id,transactionId:'parent-Ab',mapId:'map',kind:'dodge',payload:{}})
 for(const member of['player','spectator'])expect((await r.mutate(member,{operation:'upsert',interrupt:stripped})).status).toBe(403)
 expect((await r.mutate('dm',{operation:'upsert',interrupt:stripped})).status).toBe(400)
})
it.each(['player','spectator'])('authenticated %s cannot delete the whole Host fact resource',async member=>{
 const r=await room(),interrupt=createCombatInterrupt({id:'dm-delete-proof',transactionId:'parent-Ab',mapId:'map',kind:'plugin-choice',payload:{pluginId:'test.fact',featureId:'fact',featureName:'Fact',audience:'dm',prompt:'Fact',options:[{id:'native',label:'Native'}],defaultOptionId:'native'}})
 expect((await r.mutate('dm',{operation:'upsert',interrupt})).status).toBe(200)
 const before=await r.queue(),revision=before._sync?.revision??before.revision??0
 const removed=await r.request(member,'DELETE','/api/state/combat-interrupts',undefined,{'x-stars-expected-revision':String(revision)})
 expect(removed.status).toBe(403);expect((await r.load(interrupt.id)).status).toBe('pending')
})
it('spectator cannot answer DM fact; whole queue PUT cannot remove/retag/remap it, but ordinary actor rows remain writable',async()=>{
 const r=await room(),interrupt=createCombatInterrupt({id:'dm-queue-proof',transactionId:'parent-Ab',mapId:'map',kind:'plugin-choice',payload:{pluginId:'test.fact',featureId:'fact',featureName:'Fact',audience:'dm',prompt:'Fact',options:[{id:'native',label:'Native'}],defaultOptionId:'native'}})
 expect((await r.mutate('dm',{operation:'upsert',interrupt})).status).toBe(200)
 expect((await r.mutate('spectator',{operation:'answer',id:interrupt.id,response:{optionId:'native'}})).status).toBe(403)
 const before=await r.queue(),revision=before._sync?.revision??before.revision??0,headers={'x-stars-expected-revision':String(revision)}
 const mutations=[{...before,interrupts:[]},{...before,interrupts:[{...interrupt,kind:'dodge',payload:{}}]},{...before,mapId:'other-map',interrupts:[{...interrupt,mapId:'other-map'}]}]
 for(const member of['player','spectator'])for(const incoming of mutations)expect((await r.request(member,'PUT','/api/state/combat-interrupts',incoming,headers)).status).toBe(403)
 const ordinary=createCombatInterrupt({id:'ordinary-player-choice',transactionId:'other-parent',mapId:'map',kind:'plugin-choice',actorCharId:'hero',payload:{pluginId:'test.ordinary',featureId:'ordinary',featureName:'Ordinary',audience:'actor',prompt:'Choice',options:[{id:'yes',label:'Yes'}],defaultOptionId:'yes'}})
 expect((await r.request('player','PUT','/api/state/combat-interrupts',{...before,interrupts:[...before.interrupts,ordinary]},headers)).status).toBe(200)
 expect((await r.load(interrupt.id)).status).toBe('pending')
})

it('authenticated actual SharedChoice rejects owner/player plane forgery; lost unknown reply/reload keeps same parent and restores final DM fact once',async()=>{
 const r=await room(),request={eventId:'actual-weapon-event-Ab',occurrence:0,actorId:'hero-token',targetId:'enemy',packageId:'local.test.hexblade-required-phb',activityId:'banishing-smite-hit',targetName:'Enemy'}
 const writes=[],forgeries=[]
 const choose=async(choice,answer,loseReply=false)=>{
  writes.push(choice.id)
  const interrupt=createCombatInterrupt({id:choice.id,transactionId:choice.transactionId,mapId:choice.mapId,kind:'plugin-choice',phase:choice.phase,actorCharId:'hero',payload:{pluginId:choice.pluginId,featureId:choice.featureId,featureName:choice.featureName,audience:choice.audience,prompt:choice.prompt,options:choice.options,defaultOptionId:choice.defaultOptionId,...choice.context},expiresAt:Date.now()+60_000})
  const posted=await r.mutate('dm',{operation:'upsert',interrupt});expect(posted.status,JSON.stringify(posted.body)).toBe(200)
  const forged=await r.mutate('player',{operation:'answer',id:choice.id,response:{optionId:'foreign'}});expect(forged.status).toBe(403);forgeries.push(forged.body.error)
  const playerView=await r.request('player','GET','/api/state/combat-interrupts');expect(playerView.status).toBe(200);expect(playerView.body.interrupts.some(row=>row.id===choice.id)).toBe(false)
  const answered=await r.mutate('dm',{operation:'answer',id:choice.id,response:{optionId:answer}});expect(answered.status).toBe(200)
  if(loseReply)throw Error('simulated-lost-dm-fact-reply')
  return answer
 }
 const ports={principal:'dm',parentId:'real-parent-Ab',mapId:'map',request,authorityUnchanged:()=>true,load:r.load,finish:r.finish}
 await expect(collectDnd5eWeaponHitPlanarOrigin({...ports,choose:choice=>choose(choice,'unknown',true)})).rejects.toThrow('simulated-lost-dm-fact-reply')
 expect((await r.queue()).interrupts[0].status).toBe('answered')
 expect(await collectDnd5eWeaponHitPlanarOrigin({...ports,choose:choice=>choose(choice,'native')})).toBe('native')
 expect(writes).toHaveLength(2);expect(writes[0]).not.toBe(writes[1])
 expect(await collectDnd5eWeaponHitPlanarOrigin({...ports,choose:async()=>{throw Error('Replayed final fact must not reprompt')}})).toBe('native')
 expect((await r.queue()).interrupts.every(row=>row.status==='done')).toBe(true)
 expect(forgeries).toEqual(['character-ownership-required','character-ownership-required'])
 const altered=await r.mutate('dm',{operation:'answer',id:writes[1],response:{optionId:'foreign'}});expect(altered.status).toBe(409)
 await expect(collectDnd5eWeaponHitPlanarOrigin({...ports,principal:'player',choose:async()=> 'foreign'})).rejects.toThrow('dm-parent-required')
 const saved=await r.load(writes[1]);const bad={...saved,payload:{...saved.payload,hostWorldFactBinding:{...saved.payload.hostWorldFactBinding,targetId:'other'}}}
 await expect(collectDnd5eWeaponHitPlanarOrigin({...ports,load:async id=>id===writes[1]?bad:r.load(id),choose:async()=> 'foreign'})).rejects.toThrow('binding-mismatch')
 await expect(collectDnd5eWeaponHitPlanarOrigin({...ports,load:async id=>id===writes[1]?{...saved,id:'another-window'}:r.load(id),choose:async()=> 'foreign'})).rejects.toThrow('binding-mismatch')
})

it('normal unknown completion finishes the persisted answer before the next request on the same original parent',async()=>{
 const r=await room(),ids=[],request={eventId:'normal-unknown-event',occurrence:0,actorId:'hero-token',targetId:'enemy',packageId:'test.fact',activityId:'banishing-smite-hit',targetName:'Enemy'}
 const result=await collectDnd5eWeaponHitPlanarOrigin({principal:'dm',parentId:'normal-unknown-parent',mapId:'map',request,authorityUnchanged:()=>true,load:r.load,finish:r.finish,choose:async choice=>{
  ids.push(choice.id)
  const interrupt=createCombatInterrupt({id:choice.id,transactionId:choice.transactionId,mapId:'map',kind:'plugin-choice',payload:{pluginId:choice.pluginId,featureId:choice.featureId,audience:'dm',options:choice.options,defaultOptionId:choice.defaultOptionId,...choice.context}})
  const posted=await r.mutate('dm',{operation:'upsert',interrupt});expect(posted.status,JSON.stringify(posted.body)).toBe(200)
  const optionId=ids.length===1?'unknown':'native';expect((await r.mutate('dm',{operation:'answer',id:choice.id,response:{optionId}})).status).toBe(200)
  return optionId
 }})
 expect(result).toBe('native');expect(ids).toHaveLength(2)
 expect((await r.queue()).interrupts.every(row=>row.status==='done')).toBe(true)
})

it('choose hints cannot become a fact: pending stays on the same id and only persisted DM native wins over foreign hints',async()=>{
 const r=await room(),ids=[],request={eventId:'pending-fact-event',occurrence:0,actorId:'hero-token',targetId:'enemy',packageId:'test.fact',activityId:'banishing-smite-hit',targetName:'Enemy'}
 let release,completed=false
 const pending=collectDnd5eWeaponHitPlanarOrigin({principal:'dm',parentId:'pending-fact-parent',mapId:'map',request,authorityUnchanged:()=>true,load:r.load,finish:r.finish,choose:async choice=>{
  ids.push(choice.id)
  if(ids.length===1){const interrupt=createCombatInterrupt({id:choice.id,transactionId:choice.transactionId,mapId:'map',kind:'plugin-choice',payload:{pluginId:choice.pluginId,featureId:choice.featureId,audience:'dm',options:choice.options,defaultOptionId:choice.defaultOptionId,...choice.context}});expect((await r.mutate('dm',{operation:'upsert',interrupt})).status).toBe(200);return 'foreign'}
  return await new Promise(resolve=>{release=resolve})
 }})
 pending.then(()=>{completed=true})
 await expect.poll(()=>ids.length).toBe(2)
 expect(completed).toBe(false);expect(ids[0]).toBe(ids[1]);expect((await r.load(ids[0])).status).toBe('pending')
 expect((await r.mutate('dm',{operation:'answer',id:ids[0],response:{optionId:'native'}})).status).toBe(200)
 release('foreign');expect(await pending).toBe('native')
 expect((await r.load(ids[0])).status).toBe('done')
})

it('a controller hint without any published Host fact fails closed',async()=>{
 const r=await room(),request={eventId:'missing-event',occurrence:0,actorId:'hero-token',targetId:'enemy',packageId:'test.fact',activityId:'banishing-smite-hit',targetName:'Enemy'}
 await expect(collectDnd5eWeaponHitPlanarOrigin({principal:'dm',parentId:'missing-parent',mapId:'map',request,authorityUnchanged:()=>true,load:r.load,finish:r.finish,choose:async()=> 'native'})).rejects.toThrow('not-published')
})

it('a persisted DM fact cannot survive a changed original Host authority snapshot',async()=>{
 const r=await room(),request={eventId:'stale-event',occurrence:0,actorId:'hero-token',targetId:'enemy',packageId:'test.fact',activityId:'banishing-smite-hit',targetName:'Enemy'}
 let current=true
 await expect(collectDnd5eWeaponHitPlanarOrigin({principal:'dm',parentId:'stale-parent',mapId:'map',request,authorityUnchanged:()=>current,load:r.load,finish:r.finish,choose:async choice=>{
  const interrupt=createCombatInterrupt({id:choice.id,transactionId:choice.transactionId,mapId:'map',kind:'plugin-choice',payload:{pluginId:choice.pluginId,featureId:choice.featureId,audience:'dm',options:choice.options,defaultOptionId:choice.defaultOptionId,...choice.context}})
  expect((await r.mutate('dm',{operation:'upsert',interrupt})).status).toBe(200)
  expect((await r.mutate('dm',{operation:'answer',id:choice.id,response:{optionId:'native'}})).status).toBe(200)
  current=false;return 'native'
 }})).rejects.toThrow('planar-origin-stale')
})
