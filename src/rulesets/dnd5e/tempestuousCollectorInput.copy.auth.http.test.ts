import*as actualSpellAction from'./spellAction'
import fs from'node:fs'
import{issueTempestuousBeforePreparedOriginalReplay,tempestuousBeforePreparedOriginalInput}from'./tempestuousBeforePreparedOriginalReplay'
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
import*as replayApi from'./tempestuousBeforePreparedOriginalReplay'
import{cloneDnd5eHostTransactionInput,dnd5eHostTransactionHasCapabilities,registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot}from'./hostTransactionClone'
// IO draft: the candidate is bound to the separately reviewed core export.
const factoryExport='tempestuousBeforeCollectorOriginalInput'
const oldConvert=(source:Parameters<typeof resolvePreparedDnd5eSpellCast>[0],token:object)=>{const plain=cloneDnd5eHostTransactionInput(source);if(!actualSpellAction.stripDnd5eTempestuousPreparedContinuity(plain))throw Error('tempestuous-before-collector:actual-plain-original-required');return tempestuousBeforePreparedOriginalInput(plain,token)}
function convert(source:Parameters<typeof resolvePreparedDnd5eSpellCast>[0],token:object){const candidate=(replayApi as unknown as Record<string,unknown>)[factoryExport];return typeof candidate==='function'?(candidate as typeof oldConvert)(source,token):oldConvert(source,token)}
it.each(['use','decline']as const)('actual HTTP %s collector conversion keeps independent writable data while using one private full-source copy',async mode=>{
 const x=await setup();try{
  const world=structuredClone(x.data);
  const driver=createTempestuousBeforeRoomChoiceDriver({map:x.source.prepared.map,geometry:null,characters:()=>x.characters,parentTransactionId:()=>x.identity.parentId,authorityUnchanged:()=>true,choose:async request=>{
   const payload={pluginId:request.pluginId,featureId:request.featureId,featureName:request.featureName,prompt:request.prompt,audience:'actor',options:request.options,defaultOptionId:request.defaultOptionId,movementChoice:request.movementChoice};
   const row=createCombatInterrupt({id:request.id,transactionId:request.transactionId,mapId:request.mapId,kind:'plugin-choice',actorCharId:request.actor.id,payload,expiresAt:Date.now()+120000});
   expect((await x.http.state('PATCH','combat-interrupts/interrupt',{operation:'upsert',mapId:x.identity.mapId,interrupt:row},x.data,'host')).status).toBe(200);x.data['combat-interrupts']=await x.http.readActualResource('combat-interrupts');
   const optionId=request.id.endsWith(':use')?(mode==='decline'?'decline':'use'):request.movementChoice?'select-cell':'0',response={optionId,...(request.movementChoice?{movementCell:{col:12,row:10}}:{})};
   expect((await x.http.state('PATCH','combat-interrupts/interrupt',{operation:'answer',mapId:x.identity.mapId,id:row.id,response},x.data,'first-member')).status).toBe(200);x.data['combat-interrupts']=await x.http.readActualResource('combat-interrupts');
   expect((await x.http.state('PATCH','combat-interrupts/interrupt',{operation:'finish',mapId:x.identity.mapId,id:row.id,response},x.data,'host')).status).toBe(200);x.data['combat-interrupts']=await x.http.readActualResource('combat-interrupts');
   if(request.movementChoice)request.onMovementCell?.(response.movementCell!);return optionId;
  }});
  await driver.chooseTempestuousBeforeSpell!({frame:x.pending.frame,state:x.pending.snapshot,eventId:x.pending.frame.id});
  expect((await x.http.event('bountiful-native-raw-source-dm-to-host',{sourceKind:'tempestuous-before-preparation-v1',phase:'choice',...x.identity},x.data,'host')).status).toBe(200);
  const accepted=await restoreTempestuousBeforeAcceptedPreparation(x.identity,x.load),token=await issueTempestuousBeforePreparedOriginalReplay(x.identity,x.load);
  const sourceBefore=JSON.stringify(accepted.source),continuationBefore='continuationPrepared'in accepted?JSON.stringify(accepted.continuationPrepared):undefined;
  const reference=oldConvert(accepted.source,token);let sourceCopies=0;const original=globalThis.structuredClone;
  const counter=vi.spyOn(globalThis,'structuredClone').mockImplementation(function<T>(value:T,options?:StructuredSerializeOptions):T{if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(value,'prepared')&&Object.hasOwn(value,'effectRolls'))sourceCopies++;return original(value,options)});
  let result:ReturnType<typeof convert>;try{result=convert(accepted.source,token)}finally{counter.mockRestore()}
  expect(result!).toEqual(reference);expect(dnd5eHostTransactionHasCapabilities(result!)).toBe(false);
  expect(result!).not.toBe(accepted.source);expect(result!.prepared).not.toBe(accepted.source.prepared);expect(result!.prepared.action).not.toBe(accepted.source.prepared.action);
  const independent=convert(accepted.source,token),independentBefore=JSON.stringify(independent);
  result!.prepared.map.tokens[0].x+=1;(result!.effectRolls as number[]).push(1);result!.prepared.action.id+=' caller-edit';
  const clock=(result! as typeof result&{hostOriginalD20Replay?:{facts:unknown[]}}).hostOriginalD20Replay;if(clock)clock.facts.push({caller:'edit'});
  expect(JSON.stringify(accepted.source)).toBe(sourceBefore);expect(JSON.stringify(independent)).toBe(independentBefore);if('continuationPrepared'in accepted)expect(JSON.stringify(accepted.continuationPrepared)).toBe(continuationBefore);
  const originalX=accepted.source.prepared.map.tokens[0].x;try{accepted.source.prepared.map.tokens[0].x+=2;expect(JSON.stringify(independent)).toBe(independentBefore)}finally{accepted.source.prepared.map.tokens[0].x=originalX}
  if('continuationPrepared'in accepted&&accepted.continuationPrepared){const originalId=accepted.continuationPrepared.action.id;try{accepted.continuationPrepared.action.id+=' temporary caller edit';expect(JSON.stringify(independent)).toBe(independentBefore);expect(JSON.stringify(accepted.source)).toBe(sourceBefore)}finally{accepted.continuationPrepared.action.id=originalId}}
  expect(()=>convert(accepted.source,{})).toThrow('actual-same-original-source-required');expect(JSON.stringify(accepted.source)).toBe(sourceBefore);
  if(mode==='use'){
   // A new returned root is intentional when a clock must be added: cyclic
   // references point at the private data copy, just as the original spread.
   for(const undefinedClock of [false,true]){
    const cyclic={...accepted.source} as typeof accepted.source&{cycle?:unknown;hostOriginalD20Replay?:unknown};
    if(undefinedClock)Reflect.set(cyclic,'hostOriginalD20Replay',undefined);else Reflect.deleteProperty(cyclic,'hostOriginalD20Replay');cyclic.cycle=cyclic;
    const old=oldConvert(cyclic,token) as typeof cyclic,current=convert(cyclic,token) as typeof cyclic;
    expect(current).toEqual(old);expect(current.cycle).not.toBe(current);expect((current.cycle as typeof cyclic).cycle).toBe(current.cycle);expect(cyclic.cycle).toBe(cyclic);
   }
   const wrong={...accepted.source,hostOriginalD20Replay:{...(accepted.source as typeof accepted.source&{hostOriginalD20Replay:object}).hostOriginalD20Replay,effectTimestamp:1}};
   expect(()=>convert(wrong,token)).toThrow('original-clock-required');
   // An opaque receipt can survive cloneHost by identity. The second copy
   // remains observable; private-allocation metadata must reject this graph.
   let reads=0,throwOnSecond=false;
   const receipt=registerDnd5eHostReceipt({get value(){reads++;if(throwOnSecond&&reads===2)throw Error('opaque-copy-second-read');return 1}});
   const opaque={...accepted.source,opaqueReceipt:receipt};
   reads=0;const old=oldConvert(opaque,token),oldReads=reads;reads=0;const current=convert(opaque,token);expect(reads).toBe(oldReads);expect(oldReads).toBeGreaterThan(0);expect((current as typeof opaque).opaqueReceipt).toBe(receipt);expect(current).toEqual(old);
   throwOnSecond=true;reads=0;expect(()=>oldConvert(opaque,token)).toThrow('opaque-copy-second-read');const oldThrowReads=reads;reads=0;expect(()=>convert(opaque,token)).toThrow('opaque-copy-second-read');expect(reads).toBe(oldThrowReads);
   const slot=Symbol('collector-test-opaque-receipt');registerDnd5eHostReceiptSlot(slot);const symbolReceipt=registerDnd5eHostReceipt(Object.freeze({kind:'collector-copy-test'}));
   const symbolic={...accepted.source};Object.defineProperty(symbolic.prepared=cloneDnd5eHostTransactionInput(accepted.source.prepared),slot,{value:symbolReceipt,configurable:true});
   const symbolicResult=convert(symbolic,token);expect(Object.getOwnPropertyDescriptor(symbolicResult.prepared,slot)?.value).toBe(symbolReceipt);expect(Object.getOwnPropertyDescriptor(symbolic.prepared,slot)?.value).toBe(symbolReceipt);
   for(const extra of [new Date(0),new Map([['data',1]]),new Set([1]),new Uint8Array([1]),...(typeof SharedArrayBuffer==='function'?[new SharedArrayBuffer(4)]:[])]){
    const special={...accepted.source,opaqueExtra:extra};const expected=oldConvert(special,token);let copies=0;const clone=globalThis.structuredClone;
    const spy=vi.spyOn(globalThis,'structuredClone').mockImplementation(function<T>(value:T,options?:StructuredSerializeOptions):T{if(value&&typeof value==='object'&&Object.hasOwn(value,'prepared')&&Object.hasOwn(value,'effectRolls'))copies++;return clone(value,options)});
    try{expect(convert(special,token)).toEqual(expected);expect(copies,Object.prototype.toString.call(extra)+' conservative second copy').toBe(2)}finally{spy.mockRestore()}
   }
   let prototypeReads=0;const proxy=new Proxy({},{getPrototypeOf(){prototypeReads++;return Object.prototype}});
   const fail=(run:()=>unknown)=>{try{run();throw Error('Expected actual cloning to reject Proxy')}catch(error){return{name:(error as Error).name,message:(error as Error).message}}};
   const proxySource={...accepted.source,opaqueExtra:proxy};prototypeReads=0;const oldProxy=fail(()=>oldConvert(proxySource,token)),oldProxyReads=prototypeReads;prototypeReads=0;expect(fail(()=>convert(proxySource,token))).toEqual(oldProxy);expect(prototypeReads).toBe(oldProxyReads);
   // Add an unknown Proxy only after clone allocation, during the original
   // proof's room role read. The qualification check must occur afterwards.
   const roleDescriptor=Object.getOwnPropertyDescriptor(auth.value,'role')!;
   const inject=(run:()=>unknown)=>{let allocated:Record<string,unknown>|undefined,copies=0,traps=0;const clone=globalThis.structuredClone;
    const spy=vi.spyOn(globalThis,'structuredClone').mockImplementation(function<T>(value:T,options?:StructuredSerializeOptions):T{const result=clone(value,options);if(value&&typeof value==='object'&&Object.hasOwn(value,'prepared')&&Object.hasOwn(value,'effectRolls')){copies++;if(!allocated)allocated=result as Record<string,unknown>}return result});
    Object.defineProperty(auth.value,'role',{configurable:true,get(){if(allocated&&!Object.hasOwn(allocated,'afterProofProxy'))allocated.afterProofProxy=new Proxy({},{getPrototypeOf(){traps++;return Object.prototype}});return'dm'}});
    try{return{error:fail(run),get copies(){return copies},get traps(){return traps}}}finally{Object.defineProperty(auth.value,'role',roleDescriptor);spy.mockRestore()}
   };
   const oldInjected=inject(()=>oldConvert(accepted.source,token)),injected=inject(()=>convert(accepted.source,token));expect(injected.error).toEqual(oldInjected.error);expect(injected.error.name).toBe('DataCloneError');expect(injected.traps).toBe(oldInjected.traps);
   const afterProof=(run:(source:typeof accepted.source,token:object)=>ReturnType<typeof convert>,mutate:(copy:Record<string|symbol,unknown>)=>void)=>{
    let allocated:Record<string|symbol,unknown>|undefined,mutated=false,copies=0;const clone=globalThis.structuredClone;
    const spy=vi.spyOn(globalThis,'structuredClone').mockImplementation(function<T>(value:T,options?:StructuredSerializeOptions):T{const result=clone(value,options);if(value&&typeof value==='object'&&Object.hasOwn(value,'prepared')&&Object.hasOwn(value,'effectRolls')){copies++;if(!allocated)allocated=result as Record<string|symbol,unknown>}return result});
    Object.defineProperty(auth.value,'role',{configurable:true,get(){if(allocated&&!mutated){mutated=true;mutate(allocated)}return'dm'}});
    try{return{value:run(accepted.source,token),get copies(){return copies}}}finally{Object.defineProperty(auth.value,'role',roleDescriptor);spy.mockRestore()}
   };
   let hiddenReads=0;const hiddenKey='__privateHiddenProbe',hiddenSymbol=Symbol('unregistered copy probe');
   for(const key of [hiddenKey,hiddenSymbol]){
    const mutate=(copy:Record<string|symbol,unknown>)=>Object.defineProperty(copy,key,{get(){hiddenReads++;return 1},enumerable:false,configurable:false});
    const old=afterProof(oldConvert,mutate),current=afterProof(convert,mutate);expect(current.value).toEqual(old.value);expect(Object.hasOwn(current.value,key)).toBe(false);expect(hiddenReads).toBe(0);expect(current.copies).toBe(2);
   }
   const descriptorMutation=(copy:Record<string|symbol,unknown>)=>Object.defineProperty(copy,'transactionId',{value:copy.transactionId,writable:false,configurable:false,enumerable:true});
   const oldDescriptor=afterProof(oldConvert,descriptorMutation),currentDescriptor=afterProof(convert,descriptorMutation);expect(currentDescriptor.value).toEqual(oldDescriptor.value);expect(Object.getOwnPropertyDescriptor(currentDescriptor.value,'transactionId')).toEqual(Object.getOwnPropertyDescriptor(oldDescriptor.value,'transactionId'));expect(currentDescriptor.copies).toBe(2);
   const oldPrototype=afterProof(oldConvert,copy=>Object.setPrototypeOf(copy,null)),currentPrototype=afterProof(convert,copy=>Object.setPrototypeOf(copy,null));expect(currentPrototype.value).toEqual(oldPrototype.value);expect(Object.getPrototypeOf(currentPrototype.value)).toBe(Object.getPrototypeOf(oldPrototype.value));expect(currentPrototype.copies).toBe(2);
   const receiptMutation=(copy:Record<string|symbol,unknown>)=>Object.defineProperty(copy,slot,{value:symbolReceipt,writable:false,enumerable:false,configurable:false});
   const oldSymbol=afterProof(oldConvert,receiptMutation),currentSymbol=afterProof(convert,receiptMutation);expect(Object.getOwnPropertyDescriptor(currentSymbol.value,slot)).toEqual(Object.getOwnPropertyDescriptor(oldSymbol.value,slot));expect(Object.getOwnPropertyDescriptor(currentSymbol.value,slot)?.value).toBe(symbolReceipt);
   // Native structuredClone snapshots keys before invoking getters, whereas
   // cloneHost's receipt restoration enumerates the source afterwards.
   // A newly added key can therefore observe an inherited external target.
   const lateKey='__collectorLateTarget',priorLate=Object.getOwnPropertyDescriptor(Object.prototype,lateKey);
   const dynamicSource=()=>{const source={...accepted.source} as typeof accepted.source&Record<string,unknown>;Object.defineProperty(source,'trigger',{enumerable:true,get(){Reflect.set(source,lateKey,{});return 1}});return source};
   try{
    const external={external:true};Object.defineProperty(Object.prototype,lateKey,{value:external,writable:true,configurable:true});
    const old=oldConvert(dynamicSource(),token) as Record<string,unknown>,current=convert(dynamicSource(),token) as Record<string,unknown>;expect(current).toEqual(old);expect(current[lateKey]).not.toBe(external);expect(old[lateKey]).not.toBe(external);
    let traps=0;const externalProxy=new Proxy({},{getPrototypeOf(){traps++;throw Error('extra-metadata-prototype-probe')}});Object.defineProperty(Object.prototype,lateKey,{value:externalProxy,writable:true,configurable:true});
    traps=0;const oldError=fail(()=>oldConvert(dynamicSource(),token)),oldTraps=traps;traps=0;expect(fail(()=>convert(dynamicSource(),token))).toEqual(oldError);expect(traps).toBe(oldTraps);expect(oldTraps).toBe(0);
    // An inherited setter can leak the first native output even though no
    // own key remains on that output. The final DTO must still be detached.
    let captured:unknown;
    Object.defineProperty(Object.prototype,lateKey,{set(this:unknown){captured=this},configurable:true});
    const setterSource=()=>{const source={...accepted.source};Object.defineProperty(source,'trigger',{enumerable:true,get(){Object.defineProperty(source,lateKey,{value:1,enumerable:true,configurable:true,writable:true});return 1}});return source};
    captured=undefined;const oldSetter=oldConvert(setterSource(),token);expect(captured).toBeDefined();expect(oldSetter).not.toBe(captured);
    captured=undefined;const currentSetter=convert(setterSource(),token);expect(captured).toBeDefined();expect(currentSetter).not.toBe(captured);expect(currentSetter).toEqual(oldSetter);
    for(const undefinedClock of [false,true]){
     const make=()=>{const source=setterSource();if(undefinedClock)Reflect.set(source,'hostOriginalD20Replay',undefined);else Reflect.deleteProperty(source,'hostOriginalD20Replay');Reflect.set(source,'cycle',source);return source};
     captured=undefined;const oldCycle=oldConvert(make(),token) as ReturnType<typeof oldConvert>&{cycle:unknown};expect(captured).toBeDefined();expect(oldCycle.cycle).not.toBe(captured);
     captured=undefined;const currentCycle=convert(make(),token) as ReturnType<typeof convert>&{cycle:unknown};expect(captured).toBeDefined();expect(currentCycle.cycle).not.toBe(captured);expect(currentCycle).toEqual(oldCycle);
    }
   }finally{if(priorLate)Object.defineProperty(Object.prototype,lateKey,priorLate);else Reflect.deleteProperty(Object.prototype,lateKey)}
  }
  for(let warm=0;warm<10;warm++){oldConvert(accepted.source,token);convert(accepted.source,token)}
  const oldResults:boolean[]=[],currentResults:boolean[]=[];
  let started=performance.now();for(let n=0;n<30;n++)oldResults.push(!!oldConvert(accepted.source,token));const old30Ms=performance.now()-started;
  started=performance.now();for(let n=0;n<30;n++)currentResults.push(!!convert(accepted.source,token));const current30Ms=performance.now()-started;
  expect(oldResults.every(Boolean)).toBe(true);expect(currentResults.every(Boolean)).toBe(true);expect(JSON.stringify(accepted.source)).toBe(sourceBefore);
  if(process.env.C44_PRIVATE_EVIDENCE_ROOT)fs.writeFileSync(process.env.C44_PRIVATE_EVIDENCE_ROOT+'/'+mode+'-copy-observation.json',JSON.stringify({mode,sourceCopies,uninstrumented:{warmCallsEach:10,timedCallsEach:30,old30Ms,current30Ms,allCloneSpiesRestored:true,noAbsoluteThreshold:true},scope:'genuine small HTTP fixture, not actual 135KB browser payload',sourceUnchanged:true},null,2),{flag:'wx'});
  for(const[name,value]of Object.entries(world))expect(await x.http.readActualResource(name)).toEqual(value);
  // Draft allocation target intentionally remains a true baseline red.
  expect(sourceCopies).toBe(1);
 }finally{await x.http.close();x.f.dispose();clearDnd5eEffectiveRulesContextsForTest()}
},60000)
