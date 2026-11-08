vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'dm',role:'dm'})}))
import {it,expect,vi}from'vitest'
import {buildWardTempestuous557Scene}from'./testFixtures/bountifulWardTempestuous.scene.fixture'
import {growActualWardStorm}from'../../pages/maps/spellWardTempestuousGrowth.fixture'
import {genuineSpellWardTempestuousBeforeRoom}from'../../pages/maps/spellWardTempestuousBeforeRoom.fixture'
import {beginMastermindSpellWindowCollector,collectMastermindSpellWindowOutcome,closeMastermindSpellWindowCollector}from'../../pages/maps/mastermindSpellWindowCollector'
import {collectMastermindSpellWardPage}from'../../pages/maps/mastermindSpellWardPageDriver'
import type {MastermindSpellWindowGateway}from'../../pages/maps/mastermindSpellWindowParent'
import {readMastermindSpellWindowOwnerDecision}from'../../pages/maps/mastermindSpellWindowParent'
const captureTrace=vi.hoisted(()=>({active:false,calls:[]as unknown[]}))
vi.mock('./spellAction',async importOriginal=>{
 const actual=await importOriginal<typeof import('./spellAction')>()
 return{...actual,captureDnd5ePreparedSpellAttackWindow:(input:Parameters<typeof actual.captureDnd5ePreparedSpellAttackWindow>[0])=>{
  try{if(captureTrace.active)captureTrace.calls.push({attackIndex:input.attackIndex,stage:input.stage??'target',retargetStep:input.retargetStep??0})}catch{}
  return actual.captureDnd5ePreparedSpellAttackWindow(input)
 }}
})
function recordNativeCaptures(name:string){
 captureTrace.calls=[];captureTrace.active=true
 return()=>{try{console.info('[c37-actual-native-capture-calls]',JSON.stringify({name,count:captureTrace.calls.length,calls:captureTrace.calls}))}catch{}captureTrace.active=false}
}

it('actual declined owner without Ward preserves Native capture path for baseline/candidate comparison',async()=>{
 const joint=await buildWardTempestuous557Scene();let close:(()=>Promise<unknown>)|undefined,finish:(()=>void)|undefined
 try{const helper=joint.proof.characters.find(character=>character.id==='helper')!,f=await genuineSpellWardTempestuousBeforeRoom(true,helper,await growActualWardStorm(),'use');close=f.tempPrefix.close
  expect((await f.api.post('mastermind-misdirection/answer',{id:f.row.id,expectedRecordRevision:1,choice:'decline'},'player')).status).toBe(200)
  finish=recordNativeCaptures('no-Ward-decline');const actual=await readMastermindSpellWindowOwnerDecision(f.owner);expect(actual).toBeDefined();expect(actual?.raw.targetId).toBe('owner-token');expect(captureTrace.calls.length).toBeGreaterThan(0)
 }finally{finish?.();await close?.();joint.dispose()}
},60000)

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return{promise,resolve}}
it('actual Temp owner answer arriving after pending Ward read still collects genuine Ward before Native raw',async()=>{
 const joint=await buildWardTempestuous557Scene();let close:(()=>Promise<unknown>)|undefined,collector:Awaited<ReturnType<typeof beginMastermindSpellWindowCollector>>|undefined,finish:(()=>void)|undefined
 const reached=deferred<{id:string;phase:string}>(),release=deferred<void>();let armed=true,barriers=0,wardCalls=0
 try{
  const helper=joint.proof.characters.find(character=>character.id==='helper')!,f=await genuineSpellWardTempestuousBeforeRoom(true,helper,await growActualWardStorm(),'use');close=f.tempPrefix.close
  const before=await Promise.all(['characters','maps','combat','player-action-requests'].map(f.api.read));finish=recordNativeCaptures('accepted-owner-Ward-barrier')
  // Delay an actual gateway response, without altering its value or fabricating a state.
  const g:MastermindSpellWindowGateway={...f.g,source:async<T>(operation:Parameters<MastermindSpellWindowGateway['source']>[0],input:unknown)=>{
   if(operation!=='request')return f.g.source<T>(operation,input)
   const requestId=input&&typeof input==='object'&&'requestId'in input&&typeof input.requestId==='string'?input.requestId:''
   const reply=await f.api.post('mastermind-spell-window/request?requestId='+encodeURIComponent(requestId),{},'dm','GET')
   expect(reply.status,JSON.stringify(reply.payload)).toBe(200);return reply.payload as T
  },loadResource:async<T>(name:string)=>{
   const stack=new Error().stack??'',value=await f.g.loadResource<T>(name)
   if(armed&&name==='mastermind-misdirections'&&stack.includes('prepareMastermindSpellWindowWardOriginal')){
    const journal=value as {parents?:Record<string,{id:string;phase:string}>}|null,row=journal?.parents?.[f.row.id]
    if(row?.phase==='waiting'){armed=false;barriers++;reached.resolve({id:row.id,phase:row.phase});await release.promise;expect(row.phase).toBe('waiting')}
   }
   return value
  }}
  collector=await beginMastermindSpellWindowCollector({parentTransactionId:f.action.id,mapId:f.map.id,actorTokenId:'mage-token',spellCast:f.action.dnd5eSpellCast},g)
  const actual=collectMastermindSpellWindowOutcome(collector,0,async()=>{},async original=>{
   wardCalls++;return collectMastermindSpellWardPage(original,{wait:async()=>{},physical:async request=>{
    expect(request.kind).toBe('saving');expect(request.count).toBe(1);expect(request.sides).toBe(20);expect(request.rollerTokenId).toBe('mage-token')
    const scope={parentId:f.parentId,windowIndex:0,requestId:request.id,rollerTokenId:request.rollerTokenId}
    expect((await f.api.post('mastermind-spell-window/raw',{...scope,values:[13]},'dm')).status).toBe(200)
    expect((await f.api.post('mastermind-spell-window/confirm',{...scope,values:[20]},'dm')).status).toBe(200)
   }})
  }).then(value=>({value,error:undefined}),error=>({value:undefined,error}))
  const barrier=await Promise.race([reached.promise,actual.then(outcome=>{throw outcome.error??Error('Collector ended before actual Ward response barrier')})]);expect(barrier).toEqual({id:f.row.id,phase:'waiting'})
  // The actor's real owner answers through the existing authenticated API while the old response is in flight.
  expect((await f.api.post('mastermind-misdirection/answer',{id:f.row.id,expectedRecordRevision:1,choice:'second-owner-token'},'player')).status).toBe(200)
  expect((await f.api.read('mastermind-misdirections')).parents[f.row.id].phase).toBe('answered');release.resolve()
  const outcome=await actual;expect(captureTrace.calls.length).toBeGreaterThan(0);if(outcome.error)throw outcome.error
  expect(barriers).toBe(1);expect(wardCalls).toBe(1);expect(outcome.value?.status).toBe('raw')
  if(outcome.value?.status!=='raw')throw Error('Actual Native raw after real Ward required')
  expect(outcome.value.view.stage).toBe('raw');expect(outcome.value.view.raw?.targetId).toBe('second-owner-token')
  const book=(await g.source<{parent:{windows:{wardRequests?:{raw?:{values:number[]};confirmed?:{values:number[]};complete:boolean}[];requests:unknown[]}[]}}>('source',{parentId:f.parentId})).parent
  expect(book.windows[0].wardRequests).toHaveLength(1);expect(book.windows[0].wardRequests![0]).toMatchObject({raw:{values:[13]},confirmed:{values:[20]},complete:true});expect(book.windows[0].requests).toEqual([])
  expect(await Promise.all(['characters','maps','combat','player-action-requests'].map(f.api.read))).toEqual(before);expect(f.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
 }finally{release.resolve();finish?.();if(collector)closeMastermindSpellWindowCollector(collector);await close?.();joint.dispose()}
},180000)
