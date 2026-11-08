import fs from'node:fs/promises'
import path from'node:path'
import os from'node:os'
import{Readable}from'node:stream'
import type{IncomingMessage}from'node:http'
import{createHash,randomBytes}from'node:crypto'
import{afterEach,expect,vi}from'vitest'
import{handleSharedApi,SHARED_PROTOCOL_VERSION}from'../../../scripts/shared-server-core.mjs'
const base=path.resolve(os.tmpdir(),'stars-eldritch-actual-api'),roots:string[]=[]
afterEach(async()=>{for(const root of roots.splice(0)){if(path.dirname(path.resolve(root))!==base||!path.basename(root).startsWith('room-'))throw Error('API fixture cleanup outside its own root');await fs.rm(root,{recursive:true,force:true,maxRetries:4,retryDelay:20})}})
export async function createEldritchApi(docs:Record<string,any>){
 await fs.mkdir(base,{recursive:true});const root=await fs.mkdtemp(path.join(base,'room-')),stateRoot=path.join(root,'rooms','room'),lobbyRoot=path.join(root,'lobby');roots.push(root);await fs.mkdir(stateRoot,{recursive:true});await fs.mkdir(lobbyRoot,{recursive:true})
 const tokens={dm:randomBytes(32).toString('base64url'),player:randomBytes(32).toString('base64url')},hash=(s:string)=>createHash('sha256').update(s).digest('hex')
 await fs.writeFile(path.join(lobbyRoot,'room.json'),JSON.stringify({id:'room',host:{memberId:'dm',roomTokenHash:hash(tokens.dm)},players:[{memberId:'player',role:'player',roomTokenHash:hash(tokens.player)}]}))
 const ctx:any={stateRoot:root,lobbyRoot,imageRoot:root,legacyStateRoot:root,legacyImageRoot:root,quarantineRoot:root,snapshotRoot:root,eventClients:new Map(),eventBacklog:new Map(),eventSequences:new Map(),rateLimits:new Map()}
 for(const[name,value]of Object.entries(docs)){docs[name]={...value,_sync:{schemaVersion:1,revision:value._sync?.revision??1,writerId:'fixture-dm',writtenAt:1}};await fs.writeFile(path.join(stateRoot,name+'.json'),JSON.stringify(docs[name]))}
 const read=async(name:string)=>{try{return JSON.parse(await fs.readFile(path.join(stateRoot,name+'.json'),'utf8'))}catch{return null}}
 async function post(endpoint:string,body:unknown,member:'dm'|'player'='dm'){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;Object.assign(req,{method:'POST',headers:{'x-stars-member':member,'x-stars-room-token':tokens[member],'x-stars-protocol':String(SHARED_PROTOCOL_VERSION),'x-stars-writer':'actual-eldritch-'+member},socket:{remoteAddress:'fixture-local'}})
  const response:any={status:0,body:'',headers:{},setHeader(name:string,value:unknown){this.headers[name]=value},getHeader(name:string){return this.headers[name]},writeHead(status:number,headers:any){this.status=status;Object.assign(this.headers,headers??{})},end(body:unknown){this.body=String(body??'')}}
  expect(await handleSharedApi(req,response,new URL('http://localhost/api/state/'+endpoint+'?room=room'),ctx)).toBe(true)
  return{status:response.status,payload:JSON.parse(response.body)}
 }
 const gateway={loadResource:async<T>(name:string)=>await read(name)as T,saveResourcesAtomically:vi.fn(async(writes:any[],options:any)=>{
  const response=await post('transaction',{writes,transactionId:options.transactionId,readRevisions:options.readRevisions??{}})
  if(response.status!==200||!response.payload.ok)throw Error('actual-api-transaction:'+response.status+':'+JSON.stringify(response.payload))
  for(const write of writes)docs[write.name]=await read(write.name)
  return{status:'committed' as const,transactionId:options.transactionId,revisions:response.payload.revisions??{}}
 })}
 return{read,post,gateway,async persistEquipment(owner:unknown){const characters=await read('characters');await gateway.saveResourcesAtomically([{name:'characters',expectedRevision:characters._sync.revision,data:{...characters,characters:[owner]}}],{transactionId:'real-equip',readRevisions:{}})}}
}

