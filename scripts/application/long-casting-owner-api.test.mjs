import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {createHash,timingSafeEqual} from 'node:crypto'
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {handleLongCastingOwnerApi,readDurableLongCastingOwnerBinding} from './long-casting-owner-api.mjs'
const binding={requestId:'cast',spellId:'module:spell',mapId:'map',actorTokenId:'token',actorCharacterId:'character'}
const marker='casting:'+JSON.stringify(Object.values(binding))
const characters=()=>({characters:[{id:'character',concentrating:true,dnd5eCombatState:{concentrationSpellId:marker}}]})
const maps=()=>({maps:[{id:'map',tokens:[{id:'token',characterId:'character'}]}]})
test('durable identity rejects malformed or ambiguous actors/maps/tokens and never infers progress',()=>{
 assert.deepEqual(readDurableLongCastingOwnerBinding(characters(),maps(),'character'),binding)
 for(const mutate of [c=>c.characters[0].concentrating=false,c=>c.characters.push(c.characters[0]),
  c=>c.characters[0].dnd5eCombatState.concentrationSpellId='casting:[]',c=>c.characters[0].dnd5eCombatState.concentrationSpellId='casting:{']){
  const c=characters();mutate(c);assert.equal(readDurableLongCastingOwnerBinding(c,maps(),'character'),undefined)
 }
 for(const mutate of [m=>m.maps.push(m.maps[0]),m=>m.maps[0].tokens.push(m.maps[0].tokens[0]),
  m=>m.maps[0].tokens[0].characterId='other',m=>m.maps[0].tokens=[]]){
  const m=maps();mutate(m);assert.equal(readDurableLongCastingOwnerBinding(characters(),m,'character'),undefined)
 }
})
test('actual HTTP handler authenticates membership, protects owner proof and reads durable cast identity',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'stars-casting-owner-http-')),roomId='ABC123',hostToken='h'.repeat(40),playerToken='p'.repeat(40)
 const hash=value=>createHash('sha256').update(value).digest('hex')
 const room={host:{memberId:'host',roomTokenHash:hash(hostToken)},players:[{memberId:'player',roomTokenHash:hash(playerToken)}]}
 await mkdir(path.join(root,'lobby'),{recursive:true});await mkdir(path.join(root,'state/rooms',roomId),{recursive:true})
 await writeFile(path.join(root,'lobby',roomId+'.json'),JSON.stringify(room))
 for(const [name,value]of [['characters',characters()],['maps',maps()]])await writeFile(path.join(root,'state/rooms',roomId,name+'.json'),JSON.stringify(value))
 class ProtocolError extends Error{constructor(statusCode,code){super(code);this.statusCode=statusCode}}
 const writeJson=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body))}
 // Representative room credential helpers; production dispatch will inject its existing helpers.
 const dependencies={normalizeLobbyRoomCode:value=>value.replace(/[^A-Z0-9]/g,''),roomLobbyFile:(_ctx,id)=>path.join(root,'lobby',id+'.json'),
  lobbyRoomMember:(room,id)=>room.host.memberId===id?room.host:room.players.find(p=>p.memberId===id),
  roomMemberSessionAuthorized:(member,token)=>typeof token==='string'&&token.length>=32&&timingSafeEqual(Buffer.from(member.roomTokenHash),Buffer.from(hash(token))),
  RoomProtocolError:ProtocolError,writeJson,readBody:async(req,max)=>{const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>max)throw new ProtocolError(413,'too-large');chunks.push(chunk)}return Buffer.concat(chunks)},
  scopedContext:(_ctx,id)=>({stateRoot:path.join(root,'state/rooms',id)}),
  readSharedStateFile:async(ctx,name)=>({value:JSON.parse(await readFile(path.join(ctx.stateRoot,name+'.json'),'utf8'))})}
 const server=createServer(async(req,res)=>{
  try{if(!await handleLongCastingOwnerApi(req,res,new URL(req.url,'http://127.0.0.1'),{sharedRoot:root},dependencies))writeJson(res,404,{error:'not-found'})}
  catch(error){writeJson(res,error.statusCode??500,{error:error.message})}
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)))
 const url=`http://127.0.0.1:${server.address().port}/api/rooms/${roomId}/long-casting-owner`
 const send=async(command,member='host',token=hostToken)=>{const res=await fetch(url,{method:'POST',headers:{'x-stars-member':member,'x-stars-room-token':token},body:JSON.stringify(command)});return {status:res.status,body:await res.json()}}
 assert.equal((await send({operation:'status',binding},'player',playerToken)).status,403)
 assert.equal((await send({operation:'status',binding},'host','invalid')).status,403)
 assert.equal((await fetch(url)).status,405)
 const acquired=await send({operation:'acquire',binding,instanceId:'browser-a'});assert.equal(acquired.status,200);assert.ok(acquired.body.proof)
 assert.deepEqual(await send({operation:'status',binding}),{status:200,body:{active:true}})
 assert.equal((await send({operation:'acquire',binding,instanceId:'browser-b'})).status,409)
 assert.equal((await send({operation:'renew',binding,instanceId:'browser-b',proof:acquired.body.proof})).status,409)
  assert.equal((await send({operation:'renew',binding,instanceId:'browser-a',proof:acquired.body.proof})).status,200)
 const mapFile=path.join(root,'state/rooms',roomId,'maps.json')
 await writeFile(mapFile,JSON.stringify({maps:'invalid'}))
 assert.equal((await send({operation:'status',binding})).status,503)
 assert.equal((await send({operation:'renew',binding,instanceId:'browser-a',proof:acquired.body.proof})).status,503)
 await writeFile(mapFile,JSON.stringify(maps()))
 assert.deepEqual((await send({operation:'status',binding})).body,{active:true})
 const changed=characters();changed.characters[0].dnd5eCombatState.concentrationSpellId='replacement'
 await writeFile(path.join(root,'state/rooms',roomId,'characters.json'),JSON.stringify(changed))
 assert.deepEqual(await send({operation:'status',binding}),{status:200,body:{active:false}})
 assert.equal((await send({operation:'renew',binding,instanceId:'browser-a',proof:acquired.body.proof})).status,409)
 assert.equal((await send({operation:'release',binding,instanceId:'browser-a',proof:acquired.body.proof})).status,200)
 assert.equal(await handleLongCastingOwnerApi({},null,{pathname:'/unrelated'},{},dependencies),false)
 const privateData=JSON.parse(await readFile(path.join(root,'private/casting-owners',roomId,'owners.json'),'utf8'))
 assert.equal(privateData.records.length,0)
})
