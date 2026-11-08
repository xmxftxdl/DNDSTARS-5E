import{expect,it}from'vitest';import fs from'node:fs/promises';import path from'node:path';import{createHash,randomBytes,randomUUID}from'node:crypto';import{Readable}from'node:stream';import{handleSharedApi,SHARED_PROTOCOL_VERSION}from'../../../../scripts/shared-server-core.mjs';import{createCombatInterrupt}from'../../../lib/combatInterruptQueue';import{normalizeCharacter}from'../../../store/characters';
const artifactRoot=path.resolve('.codex-temp/runtime-temp/panache-world-fact-authority-'+randomUUID());await fs.mkdir(path.join(artifactRoot,'results'),{recursive:true})
export async function worldFactRoom(){
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
