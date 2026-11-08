import{it,expect}from'vitest'
import{createServer,type IncomingMessage,type ServerResponse}from'node:http'
import{mkdtemp,readFile,writeFile,rm}from'node:fs/promises'
import{tmpdir}from'node:os'
import path from'node:path'
import{createHash}from'node:crypto'
import{installStormFurySource}from'./stormSorcery.fury.native.fixture'
import{growStorm}from'./stormSorcery.growth.native.fixture'
import{getDnd5eSrdMonster}from'./monsters'
import{prepareDnd5eMonsterAttack,resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
import{createDnd5ePreparedDamageCommitSession,captureDnd5eStormFuryOriginalOperation,readDnd5eStormFuryOriginalOperation}from'./damageCommitSession'
import{captureStormFuryOriginalPreparation}from'./stormFuryOriginalPreparation'
import{recordStormFuryOriginal,readStormFuryOwnerWindow,recordStormFuryOwnerAnswer,readStormFuryOwnerDecision}from'../../../scripts/application/storm-fury-original-authority.mjs'
import{dispatchStormFuryOwnerAuthority}from'../../../scripts/application/storm-fury-owner-storage.mjs'
import{damageZeroNormalAckHttpFixture}from'./damageZeroNormalAck.http.support'
import{restoreClassResources}from'../../lib/classResources'
import{growWizard}from'../../pages/maps/mastermindMagicFamilies.fixture'
import{prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast}from'./spellAction'

async function fixture(roomId='fury-room',memberId='owner'){
 const dispose=await installStormFurySource(),storm={...growStorm(14),roomId,roomMemberId:memberId},monster=getDnd5eSrdMonster('srd-5.1:giant-ape')!
 const map={id:'fury-room-map',name:'Actual Fury owner',width:1500,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'attacker',poolId:monster.id,label:'Giant Ape',type:'enemy' as const,x:425,y:225,size:3,hp:monster.hitPoints.average,maxHp:monster.hitPoints.average,color:'',emoji:''},{id:'storm-token',characterId:storm.id,label:'Storm',type:'player' as const,x:575,y:225,size:1,color:'',emoji:''}]}
 const p=prepareDnd5eMonsterAttack({combatId:'fury-room-combat',round:1,map,characters:[storm],initiativeOrder:map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,color:'',emoji:'',roll:20-i})),actorTokenId:'attacker',targetTokenId:'storm-token',actionIndex:monster.actions.findIndex(a=>a.id==='fist')});if(!p.ok)throw Error(p.reason)
 const input={prepared:p.prepared,transactionId:'actual-fury-original',rolls:[{d20:18,mode:'normal' as const,damageRolls:[[1,1,1]]}]},session=createDnd5ePreparedDamageCommitSession(input,resolvePreparedDnd5eMonsterAttack,()=>false,undefined,undefined,input.transactionId,false,false,false,true),pending=session.run(p.prepared.state)
 if(pending.status!=='pending-storm-fury-owner')throw Error(pending.status)
 const operation=captureDnd5eStormFuryOriginalOperation(pending),source=captureStormFuryOriginalPreparation(operation),id={parentId:source.parentId,mapId:source.mapId,combatId:source.combatId,frameIndex:source.frameIndex}
 const d:any={maps:{maps:[map]},characters:{characters:[storm]},requests:{requests:[]},combat:{mapId:map.id,combatId:p.prepared.state.combatId,active:true,round:p.prepared.state.round,initiativeIndex:p.prepared.state.initiativeIndex,initiativeOrder:p.prepared.state.initiativeOrder}}
 return{dispose,input,session,pending,operation,source,id,d}
}
async function http(f:Awaited<ReturnType<typeof fixture>>,durable=false,existingRoot?:string){
 const root=existingRoot??await mkdtemp(path.join(tmpdir(),'xge-fury-owner-')),ctx={roomId:'fury-room',stateRoot:root},docs:any={'map-geometry':{_sync:{revision:1}},'campaign-time':{minutes:0},'player-action-processed':{actionIds:[]},'player-action-ack':null}
 const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b),file=(key:string)=>path.join(root,createHash('sha256').update(key).digest('hex')+'.json')
 const api={equal,context:async()=>structuredClone(f.d),doc:async(_:unknown,name:string)=>structuredClone(docs[name]),load:async(_:unknown,key:string)=>{try{return JSON.parse(await readFile(file(key),'utf8'))}catch{return null}},save:async(_:unknown,key:string,value:unknown)=>writeFile(file(key),JSON.stringify(value)),controller:(d:any,mapId:string,tokenId:string)=>{const token=d.maps.maps.find((m:any)=>m.id===mapId)?.tokens.find((t:any)=>t.id===tokenId),character=d.characters.characters.find((c:any)=>c.id===token?.characterId);return character?{character}:null}}
 const handlers:any={prepare:recordStormFuryOriginal,window:readStormFuryOwnerWindow,answer:recordStormFuryOwnerAnswer,decision:readStormFuryOwnerDecision},principals:any={host:{role:'dm',memberId:'host'},owner:{role:'player',memberId:'owner'},other:{role:'player',memberId:'other'}}
 const server=createServer(async(req:IncomingMessage,res:ServerResponse)=>{try{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const p=JSON.parse(Buffer.concat(chunks).toString()),principal=principals[req.headers.authorization as string],operation=req.url!.slice(1),handler=handlers[operation];if(!principal||!handler){res.writeHead(401).end();return}const result=durable?await dispatchStormFuryOwnerAuthority(ctx,operation,p,principal):await handler(ctx,p,principal,api);res.writeHead(result.ok?200:result.status??403,{'content-type':'application/json'}).end(JSON.stringify(result))}catch(error){res.writeHead(500).end(String(error))}})
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('address')
 const post=async(route:string,p:unknown,principal='host')=>{if(durable)for(const[name,value]of Object.entries({...docs,maps:f.d.maps,characters:f.d.characters,combat:f.d.combat,'player-action-requests':f.d.requests}))await writeFile(path.join(root,name+'.json'),JSON.stringify(value));const response=await fetch('http://127.0.0.1:'+address.port+'/'+route,{method:'POST',headers:{authorization:principal,'content-type':'application/json'},body:JSON.stringify(p)});return{status:response.status,body:await response.json()}}
 const stop=()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))
 return{post,docs,root,stop,close:async()=>{await stop();await rm(root,{recursive:true,force:true})}}
}
it('captures only the actual current canonical owner boundary, never its copied DTO or another parent',async()=>{const f=await fixture();try{
 expect(f.source.frame.options[0]).toMatchObject({ownerId:'storm-token',attackerId:'attacker',damage:14,saveAbility:'str',maximumPushFeet:20});expect(()=>captureStormFuryOriginalPreparation(structuredClone(f.operation))).toThrow();expect(()=>captureDnd5eStormFuryOriginalOperation(structuredClone(f.pending))).toThrow();
 const mismatched=createDnd5ePreparedDamageCommitSession(f.input,resolvePreparedDnd5eMonsterAttack,()=>false,undefined,undefined,'other-parent',false,false,false,true),wrong=mismatched.run(f.input.prepared.state);expect(wrong.status).toBe('pending-storm-fury-owner');expect(()=>captureStormFuryOriginalPreparation(captureDnd5eStormFuryOriginalOperation(wrong))).toThrow('exact-original-transaction');mismatched.cancel()
 f.session.cancel();expect(()=>captureStormFuryOriginalPreparation(f.operation)).toThrow('actual-live-unchanged-boundary')
 }finally{f.dispose()}})
it.each(['use','decline'] as const)('real HTTP owner %s remains private and resumes the genuine same original Native session',async(kind)=>{const f=await fixture(),h=await http(f);try{
 const before=structuredClone(f.input.prepared.state);expect((await h.post('prepare',f.source,'owner')).status).toBe(403);const issued=await h.post('prepare',f.source);expect(issued.status).toBe(200)
 expect((await h.post('window',f.id,'host')).status).toBe(403);expect((await h.post('window',f.id,'other')).status).toBe(403);const window=await h.post('window',f.id,'owner');expect(window.status).toBe(200);expect(window.body).not.toHaveProperty('source');expect((await h.post('decision',f.id)).status).toBe(403)
 const decision=kind==='use'?{kind,featureId:f.pending.frame.options[0].featureId}:{kind},answer={...f.id,windowId:issued.body.windowId,decision}
 expect((await h.post('answer',answer)).status).toBe(403);expect((await h.post('answer',{...answer,done:true},'owner')).status).toBe(403);expect((await h.post('answer',answer,'other')).status).toBe(403);expect((await h.post('answer',answer,'owner')).status).toBe(200);expect((await h.post('answer',answer,'owner')).status).toBe(200)
 const other=kind==='use'?{kind:'decline'}:{kind:'use',featureId:f.pending.frame.options[0].featureId};expect((await h.post('answer',{...answer,decision:other},'owner')).status).toBe(409)
 const actual=await h.post('decision',f.id);expect(actual.status).toBe(200);expect(actual.body.decision).toEqual(decision);expect(f.input.prepared.state).toEqual(before)
 const native=readDnd5eStormFuryOriginalOperation(f.operation);expect(native.result).toEqual(f.pending);const next=f.session.resumeStormFuryOwner(f.input.prepared.state,f.pending.frame,kind==='use'?{frameIndex:f.id.frameIndex,featureId:actual.body.decision.featureId}:undefined)
 expect(next.status).toBe(kind==='use'?'pending-storm-fury-saving':'resolved');expect(()=>readDnd5eStormFuryOriginalOperation(f.operation)).toThrow();expect(f.input.prepared.state).toEqual(before)
 if(next.status==='pending-storm-fury-saving'){expect(next.snapshot.combatants['storm-token'].turn.reactionAvailable).toBe(false);expect(next.snapshot.combatants.attacker.currentHp).toBe(before.combatants.attacker.currentHp-14);expect(()=>captureStormFuryOriginalPreparation(captureDnd5eStormFuryOriginalOperation(next))).toThrow('actual-owner-phase')}
 }finally{await h.close();f.session.cancel();f.dispose()}})
it('rechecks original scope and canonical owner; source, frame, clock and parent changes cannot authenticate consent',async()=>{const f=await fixture(),h=await http(f);try{
 expect((await h.post('prepare',f.source)).status).toBe(200)
 for(const patch of[{prefixSignature:'changed'},{effectTimestamp:f.source.effectTimestamp+1},{frame:{...f.source.frame,index:f.source.frame.index+1}},{parentId:'other'},{source:{}}])expect((await h.post('prepare',{...f.source,...patch})).status).toBe(403)
 const answer={...f.id,windowId:'storm-fury-owner:'+JSON.stringify([f.id.parentId,f.id.frameIndex]),decision:{kind:'use',featureId:f.pending.frame.options[0].featureId}}
 expect((await h.post('answer',{...answer,decision:{...answer.decision,savingThrow:{d20:18}}},'owner')).status).toBe(403)
 f.d.characters.characters[0].roomMemberId='other';expect((await h.post('answer',answer,'owner')).status).toBe(403);f.d.characters.characters[0].roomMemberId='owner'
 h.docs['campaign-time']={minutes:1};expect((await h.post('answer',answer,'owner')).status).toBe(403);h.docs['campaign-time']={minutes:0}
 f.d.requests.requests.push({id:'another-original'});expect((await h.post('answer',answer,'owner')).status).toBe(403);f.d.requests.requests=[]
 h.docs['player-action-processed'].actionIds.push(f.id.parentId);expect((await h.post('answer',answer,'owner')).status).toBe(403)
 }finally{await h.close();f.session.cancel();f.dispose()}})
it('dedicated application storage survives an actual HTTP server restart; public done and other family books confer no consent',async()=>{const f=await fixture(),first=await http(f,true);let second:Awaited<ReturnType<typeof http>>|undefined;try{
 const issued=await first.post('prepare',f.source);expect(issued.status).toBe(200);expect((await first.post('decision',f.id)).status).toBe(403)
 const answer={...f.id,windowId:issued.body.windowId,decision:{kind:'use',featureId:f.pending.frame.options[0].featureId}}
 expect((await first.post('answer',answer)).status).toBe(403);expect((await first.post('answer',answer,'owner')).status).toBe(200);await first.stop();second=await http(f,true,first.root)
 const restored=await second.post('decision',f.id);expect(restored.status).toBe(200);expect(restored.body.decision).toEqual(answer.decision);expect((await second.post('prepare',{...f.source,sourceKind:'storm-cast-preparation-v1'})).status).toBe(403)
 second.docs['combat-interrupts']={interrupts:[{id:issued.body.windowId,status:'done',response:{decision:'decline'}}]};expect((await second.post('decision',f.id)).body.decision).toEqual(answer.decision)
 f.d.combat.round++;expect((await second.post('decision',f.id)).status).toBe(403)
 }finally{if(second)await second.close();else await first.close();f.session.cancel();f.dispose()}})
it('actual application HTTP router authenticates the room member, locks private owner records and leaves world documents unchanged',async()=>{const f=await fixture('room','first-member'),app=await damageZeroNormalAckHttpFixture();try{
 const docs:any={maps:f.d.maps,characters:f.d.characters,combat:f.d.combat,'player-action-requests':f.d.requests,'map-geometry':{_sync:{revision:1}},'campaign-time':{minutes:0},'player-action-processed':{actionIds:[]},'player-action-ack':null}
 const request=(operation:string,payload:unknown,member:string)=>app.state('POST','storm-fury-owner/'+operation,payload,docs,member)
 expect((await request('prepare',f.source,'first-member')).status).toBe(403);const prepared=await request('prepare',f.source,'host');expect(prepared.status,JSON.stringify(prepared.payload)).toBe(200)
 expect((await request('window',f.id,'second-member')).status).toBe(403);expect((await request('window',f.id,'host')).status).toBe(403);expect((await request('window',f.id,'spectator')).status).toBe(403);expect((await request('window',f.id,'first-member')).status).toBe(200)
 const answer={...f.id,windowId:prepared.payload.windowId,decision:{kind:'use',featureId:f.pending.frame.options[0].featureId}}
 expect((await request('answer',answer,'second-member')).status).toBe(403);expect((await request('answer',answer,'host')).status).toBe(403);expect((await request('decision',f.id,'host')).status).toBe(403);expect((await request('answer',answer,'first-member')).status).toBe(200)
 const actual=await request('decision',f.id,'host');expect(actual.status).toBe(200);expect(actual.payload.decision).toEqual(answer.decision)
 for(const name of['maps','characters','combat','player-action-requests','player-action-processed','campaign-time'])expect(await app.readActualResource(name)).toEqual(docs[name])
 expect(f.session.resumeStormFuryOwner(f.input.prepared.state,f.pending.frame,{frameIndex:f.id.frameIndex,featureId:actual.payload.decision.featureId}).status).toBe('pending-storm-fury-saving')
 }finally{await app.close();f.session.cancel();f.dispose()}})
it('actual learned melee Spell source keeps its real queued parent and canonical enemy-side PC owner',async()=>{const dispose=await installStormFurySource(),app=await damageZeroNormalAckHttpFixture();try{
 const storm={...growStorm(14),roomId:'room',roomMemberId:'first-member'},wizard={...restoreClassResources(growWizard(16,'evocation',5,undefined,'vampiric-touch'),'long-rest'),roomId:'room',roomMemberId:'second-member'},map={id:'actual-fury-spell-owner',name:'Actual learned melee source',width:1000,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'wizard-token',characterId:wizard.id,label:'Wizard',type:'player' as const,x:25,y:25,size:1,color:'',emoji:''},{id:'storm-token',characterId:storm.id,label:'Storm',type:'enemy' as const,x:75,y:25,size:1,color:'',emoji:''}]}
 const action={id:'actual-vampiric-parent',mapId:map.id,combatId:'actual-fury-spell-combat',sourceMode:'player' as const,status:'pending' as const,type:'dnd5e-spell-cast' as const,actorTokenId:'wizard-token',characterId:wizard.id,targetTokenId:'storm-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5eSpellCast:{spellId:'vampiric-touch',slotLevel:3,castingClassId:'wizard' as const,targetTokenId:'storm-token'}},p=prepareDnd5eSpellCast({map,characters:[wizard,storm],action,initiativeOrder:map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,color:'',emoji:'',roll:20-i}))});if(!p.ok)throw Error(p.reason)
 const input={prepared:p.prepared,transactionId:action.id,d20:18,effectRolls:[1,1,1]},session=createDnd5ePreparedDamageCommitSession(input,resolvePreparedDnd5eSpellCast,()=>false,undefined,undefined,action.id,false,false,false,true)
 try{const pending=session.run(p.prepared.state);expect(pending.status).toBe('pending-storm-fury-owner');if(pending.status!=='pending-storm-fury-owner')throw Error(pending.status);const operation=captureDnd5eStormFuryOriginalOperation(pending),source=captureStormFuryOriginalPreparation(operation),id={parentId:source.parentId,mapId:source.mapId,combatId:source.combatId,frameIndex:source.frameIndex},docs:any={maps:{maps:[map]},characters:{characters:[wizard,storm]},combat:{mapId:map.id,combatId:action.combatId,active:true,round:1,initiativeIndex:0,initiativeOrder:p.prepared.state.initiativeOrder},'player-action-requests':{requests:[action]},'map-geometry':null,'campaign-time':{minutes:0},'player-action-processed':{actionIds:[]},'player-action-ack':null}
 const request=(route:string,payload:unknown,member='host')=>app.state('POST','storm-fury-owner/'+route,payload,docs,member)
 expect(source.family).toBe('spell');const issued=await request('prepare',source);expect(issued.status,JSON.stringify(issued.payload)).toBe(200);expect((await request('window',id,'second-member')).status).toBe(403);expect((await request('window',id,'first-member')).status).toBe(200)
 const answer={...id,windowId:issued.payload.windowId,decision:{kind:'decline'}};expect((await request('answer',answer,'second-member')).status).toBe(403);expect((await request('answer',answer,'first-member')).status).toBe(200);const actual=await request('decision',id);expect(actual.payload.decision).toEqual(answer.decision)
 docs['player-action-requests']={requests:[]};expect((await request('decision',id)).status).toBe(403);docs['player-action-requests']={requests:[action]};expect((await request('decision',id)).status).toBe(200)
 expect(session.resumeStormFuryOwner(p.prepared.state,pending.frame,undefined).status).toBe('resolved')
 }finally{session.cancel()}
 }finally{await app.close();dispose()}})
