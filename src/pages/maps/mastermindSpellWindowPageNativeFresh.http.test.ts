import{it,expect,vi}from'vitest'
import fs from'node:fs'
import{scene}from'./mastermindSpellAttackWindow.fixture'
import{install,createNativeEnvelopeApi}from'./mastermindMagicFamilies.fixture'
import*as parent from'./mastermindSpellWindowParent'
import{beginMastermindSpellWindowCollector,readMastermindSpellWindowCollector,collectMastermindSpellWindowTarget,issueMastermindSpellWindowTargetPool,completeMastermindSpellWindowTarget,resolveMastermindSpellWindowCollector}from'./mastermindSpellWindowCollector'
import{settleDnd5eConcentrationChecks}from'./settleDnd5eCombatResult'
import{publishMastermindSpellWindowPageCompleted}from'./mastermindSpellWindowPagePublication'
import{prepareMastermindSpellWindowNativePublication,publishMastermindSpellWindowNative}from'./mastermindSpellWindowNativePublication'

async function genuineCompleted(){
 const dispose=install();try{
  const f=await scene(),action={...f.action,sourceMode:'dm' as const},api=await createNativeEnvelopeApi({maps:{maps:[f.map],selectedId:'map'},characters:{characters:f.characters.map(c=>c.id===f.mage.id?{...c,roomMemberId:'dm'}:c),selectedId:f.mage.id},combat:{active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0,initiativeOrder:f.order,dnd5eTurnEconomyByToken:f.economies},'player-action-requests':{requests:[]}});
  const host={roomId:'room',memberId:'dm',role:'dm' as const},sourceOperations:string[]=[];
  const g:parent.MastermindSpellWindowGateway={session:()=>({...host}),loadResource:api.read,source:async<T>(op:Parameters<parent.MastermindSpellWindowGateway['source']>[0],input:unknown)=>{sourceOperations.push(op);const response=await api.post('mastermind-spell-window/'+op,input,'dm');if(response.status!==200)throw Error(response.payload.error);return response.payload as T},owner:async<T>(op:Parameters<parent.MastermindSpellWindowGateway['owner']>[0],input:unknown)=>{const response=await api.post('mastermind-misdirection/'+op,input,'dm');if(response.status!==200)throw Error(response.payload.error);return response.payload as T}};
  const collector=await beginMastermindSpellWindowCollector({parentTransactionId:action.id,mapId:'map',actorTokenId:'mage-token',spellCast:action.dnd5eSpellCast},g),original=await readMastermindSpellWindowCollector(collector),rolls:import('../../rulesets/dnd5e/headlessCombatEngine').Dnd5eSpellTargetAttackRoll[]=[];
  for(let index=0;index<3;index++){
   const target=await collectMastermindSpellWindowTarget(collector,index,async()=>{const journal=await api.read('mastermind-misdirections'),row=Object.values(journal.parents).find((r:any)=>r.phase==='waiting'&&r.spellWindowOriginal?.windowIndex===index)as{id:string;revision:number;ownerMemberId:'player'};if(!row)throw Error('Actual waiting owner required');expect((await api.post('mastermind-misdirection/answer',{id:row.id,expectedRecordRevision:row.revision,choice:'decline'},row.ownerMemberId)).status).toBe(200)});
   if(!target.view.raw)throw Error('Real raw target required');
   for(const[kind,count,sides,values]of[['attack',target.view.raw.count,20,Array(target.view.raw.count).fill(18)],['damage',2,6,[1,1]]]as const){const issued=await issueMastermindSpellWindowTargetPool(target.handle,kind,count,sides),body={parentId:original.parentId,windowIndex:index,requestId:issued.durableRollRequestId,rollerTokenId:'mage-token',values};expect((await api.post('mastermind-spell-window/raw',body,'dm')).status).toBe(200);expect((await api.post('mastermind-spell-window/confirm',body,'dm')).status).toBe(200)}
   rolls.push(await completeMastermindSpellWindowTarget(target.handle,{targetId:target.view.raw.targetId,...(target.coverAttackRedirect?{coverAttackRedirect:target.coverAttackRedirect}:{}),d20:18,...(target.view.raw.count===2?{d20Second:18}:{}),mode:target.view.raw.mode,effectRolls:[1,1]}));
  }
  const no=()=>{throw Error('No unissued physical dice')},native=await resolveMastermindSpellWindowCollector(collector,{prepared:original.prepared,effectRolls:[],targetAttacks:rolls},{authorityUnchanged:()=>true,confirm:no,roll:no});if(!native.result.ok||!native.application)throw Error('Real original Native required');
  const base=await settleDnd5eConcentrationChecks({result:native.result,priorState:original.prepared.state,map:native.application.map,characters:native.application.characters,priorApplication:native.application,characterIdByCombatantId:original.prepared.characterIdByCombatantId,rollD20:no,rollD4:no,rollDice:no}),completed=await parent.completeMastermindSpellWindowBase(native,base);
  const before=await Promise.all(['characters','maps','combat','mastermind-misdirections','player-action-requests'].map(api.read));return{dispose,f,api,g,host,action,parentId:original.parentId,completed,sourceOperations,before};
 }catch(error){dispose();throw error}
}

it('real Page Native publication shares only its one fresh preparatory view and retains final fresh/CAS/sole native4',async()=>{
 const x=await genuineCompleted();try{
  const gateway={...x.g,saveResourcesAtomically:x.api.gateway.saveResourcesAtomically,publishAck:vi.fn(async()=>{})};
  await expect(publishMastermindSpellWindowPageCompleted({},x.action,gateway)).rejects.toThrow('actual-completed-original-required');
  let fakeActionIdReads=0;const fakeAction={...x.action};Object.defineProperty(fakeAction,'id',{enumerable:true,get(){fakeActionIdReads++;throw Error('fake completed must fail before action id getter')}});await expect(publishMastermindSpellWindowPageCompleted({},fakeAction,gateway)).rejects.toThrow('actual-completed-original-required');expect(fakeActionIdReads).toBe(0);
  await expect(publishMastermindSpellWindowPageCompleted(x.completed,{...x.action,id:x.action.id+':foreign'},gateway)).rejects.toThrow('same-actual-original-required');
  expect(x.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled();expect(await Promise.all(['characters','maps','combat','mastermind-misdirections','player-action-requests'].map(x.api.read))).toEqual(x.before);
  const read=vi.spyOn(parent,'readMastermindSpellWindowCompleted');try{await prepareMastermindSpellWindowNativePublication(x.completed,gateway);expect(read).toHaveBeenCalledTimes(1);await prepareMastermindSpellWindowNativePublication(x.completed,gateway);expect(read).toHaveBeenCalledTimes(2)}finally{read.mockRestore()}
  const pageRead=vi.spyOn(parent,'readMastermindSpellWindowCompleted'),operationStart=x.sourceOperations.length,started=performance.now();let elapsedMs=0,count=0;
  try{expect(await publishMastermindSpellWindowPageCompleted(x.completed,x.action,gateway)).toBe(true);elapsedMs=performance.now()-started;count=pageRead.mock.calls.length}finally{pageRead.mockRestore()}
  expect(x.api.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1);const[writes,options]=x.api.gateway.saveResourcesAtomically.mock.calls[0];expect(writes.map(w=>w.name).sort()).toEqual(['characters','maps','combat','mastermind-misdirections'].sort());expect(options.transactionId).toBe('mastermind-native-spell-window:'+x.parentId);expect(options.readRevisions).toMatchObject({'map-geometry':0,'campaign-time':0,'player-action-requests':expect.any(Number)});
  const journal=await x.api.read('mastermind-misdirections');expect(Object.values(journal.parents).every((r:any)=>r.phase==='consumed'&&r.nativePublication.transactionId===options.transactionId)).toBe(true);expect((await x.api.read('combat')).dnd5eTurnEconomyByToken['mage-token'].action.current).toBe(0);expect(await x.api.read('player-action-ack')).toBeNull();expect(await x.api.read('player-action-processed')).toBeNull();
  // A cold read sees the already consumed journal; it cannot republish or mint
  // another completed handle from its plain projection.
  await expect(parent.readMastermindSpellWindowCompleted(JSON.parse(JSON.stringify(x.completed)))).rejects.toThrow('actual-completed-original-required');expect(x.api.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1);
  if(process.env.C45_PRIVATE_EVIDENCE_ROOT)fs.writeFileSync(process.env.C45_PRIVATE_EVIDENCE_ROOT+'/page-native-observation.json',JSON.stringify({readCompletedCalls:count,sourceOperations:x.sourceOperations.slice(operationStart),wholePageNativePhaseMs:elapsedMs,soleNativeWrites:4,finalFreshStillRequired:true,smallFixtureOnly:true,noAbsoluteThreshold:true},null,2),{flag:'wx'});
  expect(count).toBe(2);
 }finally{x.dispose()}
},60000)

it('fresh publication preparation and final publication both reject changed Host/source/world/queue/owners without writes',async()=>{
 const x=await genuineCompleted();try{
  const gateway={...x.g,saveResourcesAtomically:x.api.gateway.saveResourcesAtomically,publishAck:vi.fn(async()=>{})},load=x.g.loadResource.bind(x.g);
  const actualJournal=await load<any>('mastermind-misdirections'),actualOwner=Object.values(actualJournal.parents).find((r:any)=>r.spellWindowOriginal?.sourceParentId===x.parentId)as{id:string;revision:number;spellWindowOriginal:{sourceParentId:string}}|undefined;expect(actualOwner).toBeDefined();if(!actualOwner)throw Error('Actual same-parent owner row required before negative probes');expect(actualOwner.spellWindowOriginal.sourceParentId).toBe(x.parentId);const ownerRowId=actualOwner.id;
  for(const name of ['characters','maps','combat','map-geometry','campaign-time','player-action-requests','mastermind-misdirections']){
   const plan=await prepareMastermindSpellWindowNativePublication(x.completed,gateway);
   let mutationHits=0;x.g.loadResource=async<T>(key:string)=>{const value=await load<any>(key);if(key!==name)return value as T;if(name==='mastermind-misdirections'){const copy=structuredClone(value);copy.parents[ownerRowId].revision++;mutationHits++;return copy as T}mutationHits++;return{...value,_sync:{...value?._sync,revision:(value?._sync?.revision??0)+1}}as T};
   try{for(const[phase,run]of[['old prepare',()=>prepareMastermindSpellWindowNativePublication(x.completed,gateway)],['Page publication',()=>publishMastermindSpellWindowPageCompleted(x.completed,x.action,gateway)],['final publication',()=>publishMastermindSpellWindowNative(plan)]]as const){const priorHits=mutationHits;await expect(run()).rejects.toThrow();expect(mutationHits,name+' '+phase+' real projection mutation reached').toBeGreaterThan(priorHits)}expect(x.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled()}finally{x.g.loadResource=load}
  }
  const plan=await prepareMastermindSpellWindowNativePublication(x.completed,gateway);x.host.memberId='changed-host';try{await expect(publishMastermindSpellWindowPageCompleted(x.completed,x.action,{...gateway,session:x.g.session})).rejects.toThrow();await expect(publishMastermindSpellWindowNative(plan)).rejects.toThrow();expect(x.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled()}finally{x.host.memberId='dm'}
  expect(await Promise.all(['characters','maps','combat','mastermind-misdirections','player-action-requests'].map(x.api.read))).toEqual(x.before);
  const actualSave=x.api.gateway.saveResourcesAtomically.getMockImplementation()!;
  x.api.gateway.saveResourcesAtomically.mockImplementationOnce(async(writes,options)=>{await expect(actualSave(writes,{...options,readRevisions:{...options?.readRevisions,'player-action-requests':(options?.readRevisions?.['player-action-requests']??0)+1}})).rejects.toThrow();throw Error('actual-publication-CAS-conflict')});
  await expect(publishMastermindSpellWindowPageCompleted(x.completed,x.action,gateway)).rejects.toThrow('actual-publication-CAS-conflict');expect(await Promise.all(['characters','maps','combat','mastermind-misdirections','player-action-requests'].map(x.api.read))).toEqual(x.before);x.api.gateway.saveResourcesAtomically.mockClear();
  x.dispose();await expect(publishMastermindSpellWindowPageCompleted(x.completed,x.action,gateway)).rejects.toThrow();expect(x.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled();
 }finally{x.dispose()}
},60000)

it.each(['Host','registry']as const)('Page action id getter changes current %s after first fresh view and cannot publish',async change=>{
 const x=await genuineCompleted();try{
  const gateway={...x.g,saveResourcesAtomically:x.api.gateway.saveResourcesAtomically,publishAck:vi.fn(async()=>{})},action={...x.action},originalId=x.action.id;let reads=0;
  Object.defineProperty(action,'id',{enumerable:true,get(){reads++;if(change==='Host')x.host.memberId='changed-by-action-getter';else x.dispose();return originalId}});
  await expect(publishMastermindSpellWindowPageCompleted(x.completed,action,gateway)).rejects.toThrow();expect(reads).toBeGreaterThan(0);expect(x.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled();expect(await Promise.all(['characters','maps','combat','mastermind-misdirections','player-action-requests'].map(x.api.read))).toEqual(x.before);
 }finally{x.dispose()}
},60000)
