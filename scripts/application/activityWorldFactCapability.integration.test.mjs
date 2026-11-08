import{validateDnd5eActivityDefinitionV1 as validate}from'../../src/rulesets/dnd5e/activities/dnd5eActivityValidation';
import{registerDnd5eActivityPackage,getRegisteredDnd5eActivity}from'../../src/rulesets/dnd5e/activities/dnd5eActivityRegistry';import{automationCapabilityFromLegacyStatus as capability}from'../../src/domain/automation/automationCapability';
import{expect,it,beforeAll,afterAll}from'vitest';import fs from'node:fs/promises';import path from'node:path';import{createHash,randomBytes,randomUUID}from'node:crypto';import{Readable}from'node:stream';import{handleSharedApi,SHARED_PROTOCOL_VERSION}from'../shared-server-core.mjs';import{createCombatInterrupt}from'../../src/lib/combatInterruptQueue';import{normalizeCharacter}from'../../src/store/characters';import{collectDnd5eActivityWorldFact as collect,authorizeDnd5eActivityWorldFactAction as authorizeAction,authorizeDnd5eActivityWorldFactCommand as authorizeCommand,dnd5eActivityWorldFactActionAuthorized as actionAuthorized,dnd5eActivityWorldFactCommandAuthorized as commandAuthorized}from'../../src/rulesets/dnd5e/activities/dnd5eActivityWorldFacts';import{cloneDnd5eHostTransactionInput as hostClone}from'../../src/rulesets/dnd5e/hostTransactionClone';
const artifactRoot=path.resolve('.codex-temp/runtime-temp/panache-world-fact-authority-'+randomUUID());await fs.mkdir(path.join(artifactRoot,'results'),{recursive:true})
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



let activity={schemaVersion:1,id:'panache',name:'潇洒气质',activation:{kind:'action'},target:{kind:'creature',relation:'any',count:1,includeSelf:false},choices:[{id:'attitude',label:'该目标目前是否敌对？',dmWorldFact:{factId:'target-attitude'},options:[{id:'hostile',label:'敌对'},{id:'nonhostile',label:'非敌对'}]}]};
let dispose;beforeAll(()=>{activity={...activity,automation:capability('full'),outcomes:[{id:'result',when:{kind:'always'},operations:[{id:'notice',kind:'narrative-prompt',prompt:'Completed.'}]}]};dispose=registerDnd5eActivityPackage({packageId:'local.research.panache',packageVersion:'1.0.0',activities:[activity]}).dispose;activity=getRegisteredDnd5eActivity('local.research.panache','panache')});afterAll(()=>dispose?.());
const scope={roomId:'room',mapId:'map',combatId:'combat',parentId:'parent',actorId:'hero',targetId:'target',packageId:'local.research.panache',activityId:'panache'};
const frame={mapId:'map',combatId:'combat',actorId:'hero',targetIds:['target']};
const action=()=>({actorId:'hero',pluginId:scope.packageId,actionId:'panache',transactionId:'parent',targetIds:['target'],payload:{activityChoices:{attitude:'hostile'}}});
const command=()=>({schemaVersion:1,commandId:'parent',actorId:'hero',packageId:scope.packageId,packageVersion:'1.0.0',activityId:'panache',targetIds:['target'],choices:{attitude:'hostile'},expectedRevision:0});
async function ports(mode='hostile'){
 const r=await room();let questions=0,denials=0,stable=true;
 const input={principal:'dm',scope,activity,choiceId:'attitude',targetName:'Target',authorityUnchanged:()=>stable,load:r.load,finish:r.finish,choose:async prompt=>{
  questions++;if(mode==='hint-only')return'hostile';
  const payload={pluginId:prompt.pluginId,featureId:prompt.featureId,featureName:prompt.featureName,audience:prompt.audience,prompt:prompt.prompt,options:prompt.options,defaultOptionId:prompt.defaultOptionId,...prompt.context};
  if(mode==='binding-tamper')payload.hostWorldFactBinding={...payload.hostWorldFactBinding,targetId:'other'};
  const interrupt=createCombatInterrupt({id:prompt.id,transactionId:prompt.transactionId,mapId:prompt.mapId,kind:'plugin-choice',phase:prompt.phase,actorCharId:'hero',payload});
  expect((await r.mutate('dm',{operation:'upsert',interrupt})).status).toBe(200);
  for(const member of['player','spectator']){expect((await r.mutate(member,{operation:'answer',id:prompt.id,response:{optionId:'hostile'}})).status).toBe(403);denials++}
  if(mode==='pending-hint')return'hostile';
  const value=mode==='unknown-first'&&questions===1?'unknown':'hostile';
  expect((await r.mutate('dm',{operation:'answer',id:prompt.id,response:{optionId:value}})).status).toBe(200);
  if(mode==='authority-changed')stable=false;
  return'nonhostile';
 }};
 return{input,r,get questions(){return questions},get denials(){return denials}};
}
it.each(['hostile','unknown-first'])('real authenticated fact and opaque native capabilities: %s',async mode=>{
 const p=await ports(mode),receipt=await collect(p.input);expect(receipt.value).toBe('hostile');expect(p.questions).toBe(mode==='unknown-first'?2:1);expect(p.denials).toBe(p.questions*2);
 const a=action(),c=command();expect(actionAuthorized(a,activity,frame)).toBe(false);expect(commandAuthorized(c,activity,frame)).toBe(false);
 authorizeAction(a,activity,scope,[receipt]);authorizeCommand(c,activity,scope,[receipt]);expect(actionAuthorized(a,activity,frame)).toBe(true);expect(commandAuthorized(c,activity,frame)).toBe(true);
 expect(actionAuthorized(hostClone(a),activity,frame)).toBe(true);expect(commandAuthorized(hostClone(c),activity,frame)).toBe(true);
 expect(actionAuthorized(JSON.parse(JSON.stringify(a)),activity,frame)).toBe(false);expect(commandAuthorized(JSON.parse(JSON.stringify(c)),activity,frame)).toBe(false);
 const again=await collect({...p.input,choose:async()=>{throw Error('must reuse real persisted answer')}});expect(again.value).toBe('hostile');
});
it.each(['hint-only','pending-hint','binding-tamper','authority-changed'])('does not authorize %s',async mode=>{const p=await ports(mode);await expect(collect(p.input)).rejects.toThrow(mode==='pending-hint'?'pending':mode==='authority-changed'?'stale':'binding-mismatch')});
it('rejects JSON receipt, changed parent, selected option, map, combat, target and recipe',async()=>{
 const p=await ports(),receipt=await collect(p.input);expect(()=>authorizeAction(action(),activity,scope,[JSON.parse(JSON.stringify(receipt))])).toThrow('receipt-required');
 expect(()=>authorizeAction(action(),activity,{...scope,roomId:'other'},[receipt])).toThrow('receipt-required');
 const a=action();authorizeAction(a,activity,scope,[receipt]);
 for(const context of[{...frame,mapId:'other'},{...frame,combatId:'other'},{...frame,actorId:'other'},{...frame,targetIds:['other']}])expect(actionAuthorized(a,activity,context)).toBe(false);
 for(const mutate of[a=>a.transactionId='new-parent',a=>a.payload.activityChoices.attitude='nonhostile',a=>a.targetIds=['other']]){const changed=hostClone(a);mutate(changed);expect(actionAuthorized(changed,activity,frame)).toBe(false)}
 expect(actionAuthorized(a,{...activity,name:'Changed registered recipe'},frame)).toBe(false);
 await expect(collect({...p.input,principal:'player'})).rejects.toThrow('authority-required');
});
it('recovers a persisted answer after a lost finish response without asking twice',async()=>{
 const p=await ports();let lost=true;const input={...p.input,finish:async(id,response)=>{await p.r.finish(id,response);if(lost){lost=false;throw Error('lost finish reply')}}};
 await expect(collect(input)).rejects.toThrow('lost finish reply');const receipt=await collect({...input,choose:async()=>{throw Error('duplicate prompt')}});expect(receipt.value).toBe('hostile');expect(p.questions).toBe(1);
});

it.each(['default','dynamic','many-targets','self','unknown-option','extra-metadata'])('rejects invalid world fact contract: %s',mode=>{
 const value=structuredClone(activity),choice=value.choices[0];
 if(mode==='default')choice.defaultOptionId='hostile';if(mode==='dynamic')choice.optionsFrom='combat-creatures';if(mode==='many-targets')value.target.count=2;if(mode==='self')value.target.includeSelf=true;if(mode==='unknown-option')choice.options.push({id:'unknown',label:'Unknown'});if(mode==='extra-metadata')choice.dmWorldFact.extra=true;
 expect(validate(value).some(error=>error.includes('dmWorldFact'))).toBe(true);
});
it('current registration loss invalidates an already obtained fact capability',async()=>{
 const p=await ports(),receipt=await collect(p.input),a=action();authorizeAction(a,activity,scope,[receipt]);expect(actionAuthorized(a,activity,frame)).toBe(true);dispose();
 try{expect(actionAuthorized(a,activity,frame)).toBe(false);await expect(collect(p.input)).rejects.toThrow('authority-required')}finally{dispose=registerDnd5eActivityPackage({packageId:scope.packageId,packageVersion:'1.0.0',activities:[activity]}).dispose}
});
