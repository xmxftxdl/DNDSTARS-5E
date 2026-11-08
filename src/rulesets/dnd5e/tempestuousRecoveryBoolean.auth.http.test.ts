import{readDnd5eTempestuousBeforeSpellOriginalOperation}from'./damageCommitSession'
import fsForRecovery from'node:fs'
import*as actualSpellAction from'./spellAction'
import{issueTempestuousBeforePreparedOriginalReplay,withTempestuousBeforePreparedOriginalReplay,tempestuousBeforePreparedOriginalInput}from'./tempestuousBeforePreparedOriginalReplay'
import{restoreTempestuousBeforeAcceptedPreparation}from'./tempestuousBeforeAcceptedPreparation'
const auth=vi.hoisted(()=>({value:{roomId:'room',memberId:'host',role:'dm'}}));vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>auth.value}));
import{expect,it,vi}from'vitest'
import{fixture}from'./stormSorcery.tempestuous.terminal.fixture'
import{prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast}from'./spellAction'
import{createDnd5ePreparedDamageCommitSession,captureDnd5eTempestuousBeforeSpellOriginalOperation}from'./damageCommitSession'
import{captureTempestuousBeforeOriginalPreparation,type TempestuousBeforeOriginalPreparationBook}from'./tempestuousBeforeOriginalPreparation'
import{createTempestuousBeforeRoomChoiceDriver}from'../../lib/tempestuousBeforeRoomChoices'
import{createCombatInterrupt}from'../../lib/combatInterruptQueue'
import{damageZeroNormalAckHttpFixture}from'./damageZeroNormalAck.http.support'
import{clearDnd5eEffectiveRulesContextsForTest}from'./effectiveRulesContext'
async function setup(){const f=await fixture(),http=await damageZeroNormalAckHttpFixture();try{const characters=f.input.characters.map(c=>({...c,roomId:'room',roomMemberId:'first-member'})),action=structuredClone(f.action);delete action.dnd5eSpellCast.tempestuousMovement;action.roomMemberId='first-member';const p=prepareDnd5eSpellCast({...f.input,characters,action});if(!p.ok)throw Error(p.reason);const source={prepared:p.prepared,effectRolls:[],transactionId:action.id},session=createDnd5ePreparedDamageCommitSession(source,resolvePreparedDnd5eSpellCast,()=>false,undefined,undefined,action.id,true,true),pending=session.run(p.prepared.state);if(pending.status!=='pending-tempestuous-before-spell')throw Error(pending.status);const identity={parentId:action.id,mapId:p.prepared.map.id,combatId:p.prepared.state.combatId},data:any={characters:{characters},maps:{maps:[p.prepared.map]},combat:{active:true,...{mapId:identity.mapId,combatId:identity.combatId},round:p.prepared.state.round,initiativeIndex:p.prepared.state.initiativeIndex,initiativeOrder:f.input.initiativeOrder,dnd5eTurnEconomyByToken:{}},'player-action-requests':{requests:[p.prepared.action]},'map-geometry':{},'campaign-time':{elapsedSeconds:0}};for(const doc of Object.values(data)as any[])doc._sync={schemaVersion:1,revision:1,writerId:'host',writtenAt:1};const load=async(id:typeof identity)=>{const r=await http.state('POST','tempestuous-before-preparation/source',id,data,'host');if(r.status!==200)throw Error(JSON.stringify(r.payload));return r.payload as TempestuousBeforeOriginalPreparationBook};await captureTempestuousBeforeOriginalPreparation(captureDnd5eTempestuousBeforeSpellOriginalOperation(pending),{publishEvent:async(c,p)=>{const r=await http.event(c,p,data,'host');if(r.status!==200)throw Error(JSON.stringify(r.payload))}},load);return{f,http,characters,source,session,pending,identity,data,load}}catch(e){await http.close();f.dispose();throw e}}
it.each(['use','decline']as const)('real HTTP %s owner replay keeps current proof semantics while avoiding qualified input copies',async mode=>{const x=await setup();try{const world=structuredClone(x.data);let answers=0;const driver=createTempestuousBeforeRoomChoiceDriver({map:x.source.prepared.map,geometry:null,characters:()=>x.characters,parentTransactionId:()=>x.identity.parentId,authorityUnchanged:()=>true,choose:async request=>{const payload={pluginId:request.pluginId,featureId:request.featureId,featureName:request.featureName,prompt:request.prompt,audience:'actor',options:request.options,defaultOptionId:request.defaultOptionId,movementChoice:request.movementChoice},row=createCombatInterrupt({id:request.id,transactionId:request.transactionId,mapId:request.mapId,kind:'plugin-choice',actorCharId:request.actor.id,payload,expiresAt:Date.now()+120000}),upsert=await x.http.state('PATCH','combat-interrupts/interrupt',{operation:'upsert',mapId:x.identity.mapId,interrupt:row},x.data,'host');expect(upsert.status,JSON.stringify(upsert.payload)).toBe(200);x.data['combat-interrupts']=await x.http.readActualResource('combat-interrupts');const optionId=request.id.endsWith(':use')?(mode==='decline'?'decline':'use'):request.movementChoice?'select-cell':'0',response={optionId,...(request.movementChoice?{movementCell:{col:12,row:10}}:{})},answer={operation:'answer',mapId:x.identity.mapId,id:row.id,response};expect((await x.http.state('PATCH','combat-interrupts/interrupt',answer,x.data,'second-member')).status).toBe(403);const actual=await x.http.state('PATCH','combat-interrupts/interrupt',answer,x.data,'first-member');expect(actual.status,JSON.stringify(actual.payload)).toBe(200);x.data['combat-interrupts']=await x.http.readActualResource('combat-interrupts');const finished=await x.http.state('PATCH','combat-interrupts/interrupt',{operation:'finish',mapId:x.identity.mapId,id:row.id,response},x.data,'host');expect(finished.status,JSON.stringify(finished.payload)).toBe(200);x.data['combat-interrupts']=await x.http.readActualResource('combat-interrupts');if(request.movementChoice)request.onMovementCell?.(response.movementCell!);answers++;return optionId}}),choice=await driver.chooseTempestuousBeforeSpell!({frame:x.pending.frame,state:x.pending.snapshot,eventId:x.pending.frame.id}),p={sourceKind:'tempestuous-before-preparation-v1',phase:'choice',...x.identity};const recorded=await x.http.event('bountiful-native-raw-source-dm-to-host',p,x.data,'host');expect(recorded.status,JSON.stringify(recorded.payload)).toBe(200);const book=await x.load(x.identity) as TempestuousBeforeOriginalPreparationBook&{ownerDecision:any};expect(book.ownerDecision.interruptIds).toHaveLength(mode==='use'?3:1);expect(answers).toBe(mode==='use'?3:1);expect(book.ownerDecision.decision).toEqual(mode==='decline'?{kind:'decline'}:{kind:'use',selection:{frameId:x.pending.frame.id,featureId:x.pending.frame.options[0].featureId,cell:{col:12,row:10},elevationFeet:0}});expect((await x.http.event('bountiful-native-raw-source-dm-to-host',{...p,choice:{forged:true}},x.data,'host')).status).toBe(403);const actualRestore=vi.spyOn(actualSpellAction,'restoreDnd5eTempestuousPreparedRecovery');let restored:Awaited<ReturnType<typeof restoreTempestuousBeforeAcceptedPreparation>>,token:Awaited<ReturnType<typeof issueTempestuousBeforePreparedOriginalReplay>>;let restoreCalls=0;try{restored=await restoreTempestuousBeforeAcceptedPreparation(x.identity,x.load);token=await issueTempestuousBeforePreparedOriginalReplay(x.identity,x.load);restoreCalls=actualRestore.mock.calls.length;expect(restoreCalls).toBeGreaterThanOrEqual(2)}finally{actualRestore.mockRestore()}const base=JSON.parse(JSON.stringify(restored.source));delete base.hostOriginalD20Replay;expect(()=>withTempestuousBeforePreparedOriginalReplay(base,token,()=>true)).toThrow('original-clock-required');const alias=await x.load(x.identity),aliasClock=alias.effectTimestamp,aliasToken=await issueTempestuousBeforePreparedOriginalReplay(x.identity,async()=>alias);alias.effectTimestamp++;const aliasPlain=tempestuousBeforePreparedOriginalInput(base,aliasToken);expect((aliasPlain as typeof base).hostOriginalD20Replay.effectTimestamp).toBe(aliasClock);
// Both real HTTP use/decline branches retain every original Native, permission,
// clock, source, and unchanged-world assertion below. Only clone allocations are observed.
const booleanCandidate=(actualSpellAction as unknown as Record<string,unknown>)['hasDnd5eTempestuousPreparedRecoveryFacts'];
const hasRecovery=(value:unknown)=>typeof booleanCandidate==='function'?(booleanCandidate as(value:unknown)=>boolean)(value):!!actualSpellAction.dnd5eTempestuousPreparedRecoveryFacts(value);
const expectedInput=tempestuousBeforePreparedOriginalInput(base,token);
const actualClone=globalThis.structuredClone;let phase:'direct'|'token'='direct';
const allocations={direct:{input:0,features:0,host:0},token:{input:0,features:0,host:0}};
const clones=vi.spyOn(globalThis,'structuredClone').mockImplementation(function<T>(value:T,options?:StructuredSerializeOptions):T{
 if(value&&typeof value==='object'&&!Array.isArray(value)&&'action'in value&&'map'in value&&'characters'in value)allocations[phase].input++;
 if(Array.isArray(value)&&value.length>0&&value.every(item=>item&&typeof item==='object'&&typeof item.featureId==='string'&&typeof item.definition==='string'))allocations[phase].features++;
 if((new Error().stack??'').includes('cloneDnd5eHostTransactionInput'))allocations[phase].host++;
 return actualClone(value,options);
});
let directWarm3Ms=0,tokenWarm3Ms=0;
try{
 let started=performance.now();for(let repeat=0;repeat<3;repeat++)expect(hasRecovery(restored!.source)).toBe(true);directWarm3Ms=performance.now()-started;
 phase='token';started=performance.now();for(let repeat=0;repeat<3;repeat++)expect(tempestuousBeforePreparedOriginalInput(base,token!)).toEqual(expectedInput);tokenWarm3Ms=performance.now()-started;
}finally{clones.mockRestore()}
// Small warmed observation only. Native/HTTP/world work is not repeated here.
// The measured loops contain only the original calls and boolean collection.
for(let warm=0;warm<10;warm++){hasRecovery(restored!.source);tempestuousBeforePreparedOriginalInput(base,token!)}
const directResults:boolean[]=[],tokenResults:boolean[]=[];
let measuredAt=performance.now();for(let repeat=0;repeat<30;repeat++)directResults.push(hasRecovery(restored!.source));const direct30Ms=performance.now()-measuredAt;
measuredAt=performance.now();for(let repeat=0;repeat<30;repeat++)tokenResults.push(!!tempestuousBeforePreparedOriginalInput(base,token!));const token30Ms=performance.now()-measuredAt;
expect(directResults).toHaveLength(30);expect(directResults.every(Boolean)).toBe(true);expect(tokenResults).toHaveLength(30);expect(tokenResults.every(Boolean)).toBe(true);
if(process.env.C42_PRIVATE_EVIDENCE_ROOT)fsForRecovery.writeFileSync(process.env.C42_PRIVATE_EVIDENCE_ROOT+'/'+mode+'-warm.json',JSON.stringify({mode,restoreCalls,allocations,directWarm3Ms,tokenWarm3Ms,clonesInvokeOriginal:true,nativeResultCached:false,uninstrumented:{warmupCalls:10,timedCalls:30,direct30Ms,token30Ms,directAllTrue:directResults.every(Boolean),tokenAllTrue:tokenResults.every(Boolean),allCloneSpiesRestored:true,timerContainsExpectOrFileIo:false}},null,2),{flag:'wx'});
expect(allocations.direct.features).toBeGreaterThanOrEqual(3);expect(allocations.token.features).toBeGreaterThanOrEqual(3);expect(allocations.token.host).toBeGreaterThanOrEqual(3);
expect(allocations.direct.input).toBe(0);expect(allocations.token.input).toBe(0);

// Genuine accepted preparation exposes its ordinary continuation payload alias;
// mutate that real alias, never a fabricated prepared object or source receipt.
if(mode==='use'){
 if(!('continuationPrepared'in restored!)||!restored!.continuationPrepared)throw Error('Actual accepted continuation required');
 const payload=restored!.continuationPrepared.action.dnd5eSpellCast as unknown as Record<string,unknown>,source=restored!.source;
 const originalSpell=Object.getOwnPropertyDescriptor(payload,'spellId');if(!originalSpell||!('value'in originalSpell))throw Error('Actual spell data descriptor required');
 const errors=(run:()=>unknown)=>{try{return{ok:true as const,value:!!run()}}catch(error){return{ok:false as const,name:(error as Error).name,message:(error as Error).message,error}}};
 const matrix:Array<{name:string;oldOk:boolean;newOk:boolean;oldCalls:number;newCalls:number;inputClones:number}>=[];
 const compare=(name:string,setup:()=>()=>void,expectedOk:boolean,expectedErrorName?:string,reads:()=>number=()=>0,reset:()=>void=()=>{},requireSlow=false)=>{
  const clean=setup();try{
   reset();const old=errors(()=>actualSpellAction.dnd5eTempestuousPreparedRecoveryFacts(source)),oldCalls=reads();
   reset();let inputClones=0;const original=globalThis.structuredClone;
   const count=vi.spyOn(globalThis,'structuredClone').mockImplementation(function<T>(value:T,options?:StructuredSerializeOptions):T{if(value&&typeof value==='object'&&!Array.isArray(value)&&'action'in value&&'map'in value&&'characters'in value)inputClones++;return original(value,options)});
   let current:ReturnType<typeof errors>,newCalls=0;try{current=errors(()=>hasRecovery(source));newCalls=reads()}finally{count.mockRestore()}
   expect(current!.ok,name).toBe(old.ok);expect(old.ok,name).toBe(expectedOk);expect(newCalls,name+' getter order').toBe(oldCalls);
   if(!old.ok&&!current!.ok){expect(current!.name,name).toBe(old.name);expect(current!.message,name).toBe(old.message);if(expectedErrorName)expect(old.name,name).toBe(expectedErrorName)}
   if(requireSlow)expect(inputClones,name+' conservative clone fallback').toBeGreaterThan(0);
   matrix.push({name,oldOk:old.ok,newOk:current!.ok,oldCalls,newCalls,inputClones});
  }finally{clean()}
  expect(hasRecovery(source),name+' original alias restored').toBe(true);
 };
 const restoreSpell=()=>Object.defineProperty(payload,'spellId',originalSpell);
 compare('new same-JSON plain node',()=>{const node={};Object.defineProperty(node,'toJSON',{value:()=>originalSpell.value,enumerable:false});Reflect.set(payload,'spellId',node);return restoreSpell},true,undefined,undefined,undefined,true);
 let prototypeReads=0;
 compare('new same-JSON Proxy',()=>{const target={};Object.defineProperty(target,'toJSON',{value:()=>originalSpell.value,enumerable:false});Reflect.set(payload,'spellId',new Proxy(target,{getPrototypeOf(){prototypeReads++;return Object.prototype}}));return restoreSpell},false,'DataCloneError',()=>prototypeReads,()=>{prototypeReads=0},true);
 compare('enumerable function ignored by JSON',()=>{Reflect.set(payload,'__recoveryProofFunction',()=>1);return()=>{Reflect.deleteProperty(payload,'__recoveryProofFunction')}},false,'DataCloneError',undefined,undefined,true);
 compare('enumerable symbol value ignored by JSON',()=>{Reflect.set(payload,'__recoveryProofSymbol',Symbol('diagnostic'));return()=>{Reflect.deleteProperty(payload,'__recoveryProofSymbol')}},false,'DataCloneError',undefined,undefined,true);
 let getterCalls=0;
 compare('current accessor invocation count',()=>{Object.defineProperty(payload,'spellId',{get(){getterCalls++;return originalSpell.value},enumerable:true,configurable:true});return restoreSpell},true,undefined,()=>getterCalls,()=>{getterCalls=0},true);
 let hiddenReads=0;
 compare('nonenumerable Proxy remains unobserved',()=>{Object.defineProperty(payload,'__hiddenRecoveryProxy',{value:new Proxy({},{getPrototypeOf(){hiddenReads++;throw Error('hidden Proxy must not be inspected')}}),enumerable:false,configurable:true});return()=>{Reflect.deleteProperty(payload,'__hiddenRecoveryProxy')}},true,undefined,()=>hiddenReads,()=>{hiddenReads=0});
 const ignoredSymbol=Symbol('ignored recovery key');
 compare('symbol-keyed Proxy remains unobserved',()=>{Reflect.set(payload,ignoredSymbol,new Proxy({},{getPrototypeOf(){throw Error('symbol Proxy must not be inspected')}}));return()=>{Reflect.deleteProperty(payload,ignoredSymbol)}},true);
 for(const special of [new Date(0),new Map([['value',1]]),new Set([1]),new Uint8Array([1]),...(typeof SharedArrayBuffer==='function'?[new SharedArrayBuffer(4)]:[])]){
  compare('new same-JSON '+Object.prototype.toString.call(special),()=>{Object.defineProperty(special,'toJSON',{value:()=>originalSpell.value,enumerable:false});Reflect.set(payload,'spellId',special);return restoreSpell},true,undefined,undefined,undefined,true);
 }
 if(process.env.C42_PRIVATE_EVIDENCE_ROOT)fsForRecovery.writeFileSync(process.env.C42_PRIVATE_EVIDENCE_ROOT+'/shared-alias-matrix.json',JSON.stringify({actualAcceptedContinuationAlias:true,matrix,noCallerSourceOrReceiptFabricated:true},null,2),{flag:'wx'});
}

const plain=tempestuousBeforePreparedOriginalInput(base,token);expect(()=>withTempestuousBeforePreparedOriginalReplay(plain,{},()=>true)).toThrow('actual-same-original-source-required');const actual=createDnd5ePreparedDamageCommitSession(plain,resolvePreparedDnd5eSpellCast,()=>false,undefined,undefined,x.identity.parentId);const finished=withTempestuousBeforePreparedOriginalReplay(plain,token,()=>actual.run(plain.prepared.state));expect(finished.status).toBe('resolved');if(finished.status!=='resolved')throw Error(finished.status);expect(finished.result.result.ok).toBe(true);expect(finished.result.result.state.combatants[x.pending.frame.actorId].position.x).toBe(mode==='use'?625:525);expect(finished.result.result.state.combatants[x.pending.frame.actorId].turn).toMatchObject({actionAvailable:false,bonusActionAvailable:mode!=='use'});expect(finished.result.result.events.filter(e=>e.type==='spell-cast')).toHaveLength(1);expect(()=>withTempestuousBeforePreparedOriginalReplay({...plain,prepared:{...plain.prepared,state:{...plain.prepared.state,round:9}}},token,()=>true)).toThrow('actual-same-original-source-required');expect(restored.result.status).toBe(mode==='use'?'pending-tempestuous-before-cast':'resolved');if(restored.result.status==='pending-tempestuous-before-cast'){expect(mode).toBe('use');expect(restored.continuationPrepared?.map.tokens.find(t=>t.id===x.pending.frame.actorId)).toMatchObject({x:625,y:525});expect(restored.result.snapshot.combatants[x.pending.frame.actorId].turn.bonusActionAvailable).toBe(false);expect(restored.result.snapshot.combatants[x.pending.frame.actorId].turn.actionAvailable).toBe(true)}const resumed=x.session.resumeTempestuousBeforeSpell(x.source.prepared.state,x.pending.frame,choice);expect(resumed.status).toBe(mode==='use'?'pending-tempestuous-before-cast':'resolved');for(const[name,value]of Object.entries(world))expect(await x.http.readActualResource(name)).toEqual(value);await expect(x.http.readActualResource('player-action-ack')).rejects.toMatchObject({code:'ENOENT'});await expect(x.http.readActualResource('player-action-processed')).rejects.toMatchObject({code:'ENOENT'})}finally{await x.http.close();x.f.dispose();clearDnd5eEffectiveRulesContextsForTest()}},60000)

it('genuine ordinary Native preparation aliases retain the original slow clone and unchanged errors',async()=>{
 const f=await fixture();let session:ReturnType<typeof createDnd5ePreparedDamageCommitSession>|undefined;
 try{
  const action=structuredClone(f.action);delete action.dnd5eSpellCast.tempestuousMovement;
  const input={...f.input,action},prepared=prepareDnd5eSpellCast(input);if(!prepared.ok)throw Error(prepared.reason);
  session=createDnd5ePreparedDamageCommitSession({prepared:prepared.prepared,effectRolls:[],transactionId:action.id},resolvePreparedDnd5eSpellCast,()=>false,undefined,undefined,action.id,true,true);
  const pending=session.run(prepared.prepared.state);if(pending.status!=='pending-tempestuous-before-spell')throw Error('Actual ordinary Native source required');
  const operation=captureDnd5eTempestuousBeforeSpellOriginalOperation(pending),source=readDnd5eTempestuousBeforeSpellOriginalOperation(operation).input;
  const candidate=(actualSpellAction as unknown as Record<string,unknown>)['hasDnd5eTempestuousPreparedRecoveryFacts'],has=(value:unknown)=>typeof candidate==='function'?(candidate as(value:unknown)=>boolean)(value):!!actualSpellAction.dnd5eTempestuousPreparedRecoveryFacts(value);
  let copies=0;const originalClone=globalThis.structuredClone;
  const counter=vi.spyOn(globalThis,'structuredClone').mockImplementation(function<T>(value:T,options?:StructuredSerializeOptions):T{if(value&&typeof value==='object'&&!Array.isArray(value)&&'action'in value&&'map'in value&&'characters'in value)copies++;return originalClone(value,options)});
  try{expect(has(source)).toBe(true);expect(copies).toBeGreaterThan(0)}finally{counter.mockRestore()}
  const alias=action.dnd5eSpellCast;Reflect.set(alias,'__ordinaryFunction',()=>1);
  try{expect(()=>actualSpellAction.dnd5eTempestuousPreparedRecoveryFacts(source)).toThrow();expect(()=>has(source)).toThrow()}finally{Reflect.deleteProperty(alias,'__ordinaryFunction')}
  expect(has(source)).toBe(true);expect(has(JSON.parse(JSON.stringify(source)))).toBe(false);
 }finally{session?.cancel();f.dispose();clearDnd5eEffectiveRulesContextsForTest()}
},60000)
