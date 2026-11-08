import{loadBountifulDeathAreaOriginBook,readBountifulDeathAreaOrigin,type BountifulDeathAreaOrigin}from'./bountifulLuckNormalAck'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{settleDnd5ePersistentAreaTurnTransition,type Dnd5ePersistentAreaTurnBoundary}from'../../pages/maps/persistentAreaTurnBoundary'
import{advanceDnd5ePluginAreasAtTurnBoundary,collectDnd5ePersistentAreaTriggers,collectDnd5eExpiringPersistentAreaDetonationTriggers,expireDnd5ePluginAreasAtTurnBoundary,reconcileDnd5ePluginAreasAndConcentrationOnMap,reconcileDnd5ePluginAreasOnMap}from'./pluginAreas'
import{prepareDnd5ePersistentAreaTrigger,resolvePreparedDnd5ePersistentAreaTrigger,dnd5ePersistentAreaFlightCapableTokenIds,dnd5ePersistentAreaSizeRanks}from'./pluginAreaTransactions'
import{expireDnd5eWebAreaAtTurnBoundary}from'./webAreaRules'
import{createDnd5eParentEffectClock}from'./activeEffects'
import{projectDnd5eCombatApplicationStoreState}from'../../pages/maps/combatApplicationStoreProjection'
import{withAllyNaturalOneCheckpoints,AllyNaturalOneDecisionRequired}from'./allyNaturalOneCheckpoint'
declare const operationBrand:unique symbol
export type BountifulDeathAreaOriginalOperation={readonly[operationBrand]:true}
type Prepared=Extract<ReturnType<typeof prepareDnd5ePersistentAreaTrigger>,{ok:true}>['prepared']
const issued=new WeakMap<object,{origin:BountifulDeathAreaOrigin;originSignature:string;input:Parameters<typeof prepareDnd5ePersistentAreaTrigger>[0];prepared:Prepared;signature:string;boundary:Dnd5ePersistentAreaTurnBoundary}>()
/** Only a genuine deferred Death's next canonical area boundary can produce
 * this mechanical frame. Caller state/prepared/frame/result never enters it.
 * No raw pool or publication permission is issued here. */
export async function captureBountifulDeathAreaOriginalOperation(origin:BountifulDeathAreaOrigin):Promise<BountifulDeathAreaOriginalOperation>{
 const facts=readBountifulDeathAreaOrigin(origin),originSignature=JSON.stringify(facts),stop=Object.freeze({}),captured:{value?:{input:Parameters<typeof prepareDnd5ePersistentAreaTrigger>[0];prepared:Prepared;boundary:Dnd5ePersistentAreaTurnBoundary}}={}
 try{await settleDnd5ePersistentAreaTurnTransition({transition:facts.transition,worldMinute:facts.worldMinute,initiativeOrder:facts.initiativeOrder,map:facts.map,characters:facts.characters,settleBoundary:async({boundary,map,characters})=>{
  if(JSON.stringify(readBountifulDeathAreaOrigin(origin))!==originSignature)throw Error('death-area-operation:changed-origin')
  const advanced=advanceDnd5ePluginAreasAtTurnBoundary({...boundary,map});if(advanced.movedAreaIds.length)throw Error('death-area-operation:moving-boundary-not-yet-supported')
  const context={map:advanced.map,round:boundary.round,turnKey:boundary.turnKey,flightCapableTokenIds:dnd5ePersistentAreaFlightCapableTokenIds({map:advanced.map,characters,round:boundary.round}),sizeRanksByTokenId:dnd5ePersistentAreaSizeRanks({map:advanced.map,characters,round:boundary.round})},candidates=[...collectDnd5ePersistentAreaTriggers({...context,timing:boundary.timing,targetTokenId:boundary.tokenId}),...(advanced.map.dnd5ePluginAreas??[]).filter(area=>area.sourceTokenId===boundary.tokenId).flatMap(area=>collectDnd5ePersistentAreaTriggers({...context,areaId:area.id,timing:boundary.timing==='turn-start'?'source-turn-start':'source-turn-end'})),...collectDnd5eExpiringPersistentAreaDetonationTriggers({...boundary,map:advanced.map})]
  if(!candidates.length)return{map:advanced.map,characters:[...characters],logs:[]}
  if(candidates.length!==1||candidates[0].trigger.sourceChoosesTargets||candidates[0].trigger.sourceMayDecline||candidates[0].trigger.dmAdjustable)throw Error('death-area-operation:additional-native-frontier-required')
  const input={worldMinute:facts.worldMinute,combatId:facts.combatId,round:boundary.round,map:advanced.map,characters,initiativeOrder:facts.initiativeOrder,candidate:candidates[0]},ready=prepareDnd5ePersistentAreaTrigger(input,facts.state)
  if(!ready.ok||!ready.prepared.save||ready.prepared.save.allowWillingFailure)throw Error('death-area-operation:actual-canonical-saving-frame-required')
  captured.value={input,prepared:ready.prepared,boundary};throw stop
 },expireBoundary:({boundary,map,characters})=>{const web=expireDnd5eWebAreaAtTurnBoundary({...boundary,map,characters}),expired=expireDnd5ePluginAreasAtTurnBoundary({...boundary,map:web.map}),next=reconcileDnd5ePluginAreasAndConcentrationOnMap(web.map,web.characters,boundary.round,reconcileDnd5ePluginAreasOnMap(expired,web.characters,boundary.round),[facts.map]);return{map:next.map,characters:[...next.characters]}}})}catch(error){if(error!==stop)throw error}
 if(!captured.value||JSON.stringify(readBountifulDeathAreaOrigin(origin))!==originSignature)throw Error('death-area-operation:actual-active-frame-not-reached')
 const cap=Object.freeze({})as BountifulDeathAreaOriginalOperation,row=captured.value;issued.set(cap,{origin,originSignature,input:row.input,prepared:row.prepared,signature:JSON.stringify(row.prepared),boundary:row.boundary});return cap
}
export function readBountifulDeathAreaOriginalOperation(cap:BountifulDeathAreaOriginalOperation){const row=issued.get(cap);if(!row)throw Error('death-area-operation:actual-issued-frame-required');const origin=readBountifulDeathAreaOrigin(row.origin);if(JSON.stringify(origin)!==row.originSignature||JSON.stringify(row.prepared)!==row.signature)throw Error('death-area-operation:changed-actual-origin');const current=prepareDnd5ePersistentAreaTrigger(row.input,origin.state);if(!current.ok||JSON.stringify(current.prepared)!==row.signature)throw Error('death-area-operation:current-canonical-source-required');return cloneDnd5eHostTransactionInput({origin,prepared:row.prepared,boundary:row.boundary,signature:row.signature})}
export function cancelBountifulDeathAreaOriginalOperation(cap:BountifulDeathAreaOriginalOperation){return issued.delete(cap)}
/** Mechanical execution only, like the canonical area facade. Dice supplied to
 * this function are not authenticated raw/adoption receipts. This does NOT mint
 * an ACK, local-publication capability, area-boundary witness or world authority;
 * the closed Death stage remains closed until its separate private-book bridge. */
type AreaOwnListener=Parameters<typeof withAllyNaturalOneCheckpoints>[0]
export function resolveBountifulDeathAreaOriginalMechanical(cap:BountifulDeathAreaOriginalOperation,dice:{d20:number;damageRolls:readonly number[]}){return runAreaMechanical(cap,dice,(request,state)=>{throw new AllyNaturalOneDecisionRequired(request,state)})}
function runAreaMechanical(cap:BountifulDeathAreaOriginalOperation,dice:{d20:number;damageRolls:readonly number[]},listener:AreaOwnListener){
 const current=readBountifulDeathAreaOriginalOperation(cap),row=issued.get(cap)!
 if(!dice||Reflect.ownKeys(dice).some(k=>!['d20','damageRolls'].includes(String(k)))||!Number.isInteger(dice.d20)||dice.d20<1||dice.d20>20||!Array.isArray(dice.damageRolls)||dice.damageRolls.length!==0&&dice.damageRolls.length!==current.prepared.candidate.trigger.damage?.count||dice.damageRolls.some(n=>!Number.isInteger(n)||n<1||n>current.prepared.candidate.trigger.damage!.sides))throw Error('death-area-operation:closed-physical-faces-required')
 const clock=createDnd5eParentEffectClock({parentId:current.origin.parentId,sourceKey:current.signature,timestamp:current.origin.effectTimestamp})
 const result=clock.run(()=>withAllyNaturalOneCheckpoints(listener,()=>resolvePreparedDnd5ePersistentAreaTrigger({prepared:row.prepared,d20:dice.d20,damageRolls:dice.damageRolls}),undefined,true))
 readBountifulDeathAreaOriginalOperation(cap)
 return result
}

declare const completedBrand:unique symbol
export type BountifulDeathAreaCompletedOriginal={readonly[completedBrand]:true}
type Native=ReturnType<typeof resolveBountifulDeathAreaOriginalMechanical>
type Base=Awaited<ReturnType<typeof import('../../pages/maps/settleDnd5eCombatResult').settleDnd5eConcentrationChecks>>
const completed=new WeakMap<object,{operation:BountifulDeathAreaOriginalOperation;bookSignature:string;native:Native;base:Base;signature:string}>()
/** Actual Native executes the independently adopted save without effect dice.
 * A failed save reaches its real missing-damage validation; a success that
 * negates damage finishes without generating an unnecessary physical pool. */
export async function inspectBountifulDeathAreaOriginalDamageFrontier(operation:BountifulDeathAreaOriginalOperation){
 const current=readBountifulDeathAreaOriginalOperation(operation),row=issued.get(operation)!,book=await loadBountifulDeathAreaOriginBook(row.origin),input=book.pools.saving,spec=book.saving,save=current.prepared.save
 if(book.round!==current.prepared.state.round||book.turnKey!==current.boundary.turnKey)throw Error('death-area-frontier:exact-native-turn-key-required')
 if(!save||spec.actorId!==current.prepared.candidate.targetToken.id||spec.characterId!==current.origin.characterIdByCombatantId[spec.actorId]||spec.dc!==save.dc||spec.ability!==save.ability||spec.mode!=='normal'||save.mode!=='normal'||save.blessed||save.baned||spec.count!==1||spec.sides!==20||!input?.raw||!input.confirmed||input.raw.memberId!==spec.memberId||input.confirmed.memberId!==book.hostMemberId||![input.raw.values,input.confirmed.values].every(v=>v.length===1&&Number.isInteger(v[0])&&v[0]>=1&&v[0]<=20))throw Error('death-area-frontier:actual-adopted-original-required')
 const result=resolveAreaAuthenticatedOwn(operation,book,{d20:input.confirmed.values[0],damageRolls:[]}),event=result.result.events.find(e=>e.type==='saving-throw-resolved'&&e.targetId===spec.actorId&&e.ability===spec.ability&&e.dc===spec.dc)
 if(event?.type!=='saving-throw-resolved')throw Error('death-area-frontier:additional-actual-native-frontier-required')
 if(event.success?(!result.result.ok||!result.application):result.result.ok||result.result.reason!=='invalid-dice')throw Error('death-area-frontier:additional-actual-native-frontier-required')
 if(JSON.stringify(await loadBountifulDeathAreaOriginBook(row.origin))!==JSON.stringify(book))throw Error('death-area-frontier:changed-current-adopted-pool')
 return{damageRequired:!event.success,saving:event}
}
/** Only the actual original resolver's gateway can load this family's private
 * adopted pools. Caller dice/results/Base objects cannot enter this producer. */
export async function completeBountifulDeathAreaOriginal(operation:BountifulDeathAreaOriginalOperation):Promise<BountifulDeathAreaCompletedOriginal>{
 const current=readBountifulDeathAreaOriginalOperation(operation),row=issued.get(operation)!,book=await loadBountifulDeathAreaOriginBook(row.origin),save=current.prepared.save!,target=current.prepared.candidate.targetToken,area=current.prepared.candidate.area
 readBountifulDeathAreaOriginalOperation(operation)
 if(book.round!==current.prepared.state.round||book.turnKey!==current.boundary.turnKey)throw Error('death-area-completion:exact-native-turn-key-required')
 if(JSON.stringify(book.area)!==JSON.stringify(area)||JSON.stringify(book.trigger)!==JSON.stringify(current.prepared.candidate.trigger)||JSON.stringify(book.target)!==JSON.stringify(target)||book.saving.actorId!==target.id||book.saving.characterId!==current.origin.characterIdByCombatantId[target.id]||book.saving.ability!==save.ability||book.saving.dc!==save.dc||book.saving.mode!==save.mode||save.mode!=='normal'||save.blessed||save.baned||book.saving.count!==1||book.saving.sides!==20||book.damage.actorId!==area.sourceTokenId||book.damage.characterId!==area.sourceCharacterId||book.damage.count!==4||book.damage.sides!==10||book.damage.type!=='radiant')throw Error('death-area-completion:exact-native-pool-specification-required')
 if(!book.pools.saving?.raw||!book.pools.saving.confirmed)throw Error('death-area-completion:independent-authenticated-pools-required')
 const frontier=await inspectBountifulDeathAreaOriginalDamageFrontier(operation)
 for(const pool of ['saving',...(frontier.damageRequired||book.pools.damage?['damage']as const:[])]as const){const spec=book[pool],input=book.pools[pool];if(!input?.raw||!input.confirmed||input.raw.memberId!==spec.memberId||input.confirmed.memberId!==book.hostMemberId||![input.raw.values,input.confirmed.values].every(values=>Array.isArray(values)&&values.length===spec.count&&values.every(n=>Number.isInteger(n)&&n>=1&&n<=spec.sides)))throw Error('death-area-completion:independent-authenticated-pools-required')}
 const native=resolveAreaAuthenticatedOwn(operation,book,{d20:book.pools.saving!.confirmed!.values[0],damageRolls:book.pools.damage?.confirmed?.values??[]});if(!native.result.ok||!native.application)throw Error('death-area-completion:actual-native-resolution-required')
 const {settleDnd5eConcentrationChecks,readDnd5eCompletedCombatBase}=await import('../../pages/maps/settleDnd5eCombatResult'),unexpected=async():Promise<never>=>{throw Error('death-area-completion:additional-original-frontier-required')},base=await settleDnd5eConcentrationChecks({result:native.result,priorState:current.prepared.state,map:native.application.map,characters:native.application.characters,characterIdByCombatantId:current.origin.characterIdByCombatantId,priorApplication:native.application,hostParentTransactionId:current.origin.parentId,followupTransactionNow:()=>current.origin.effectTimestamp,rollD20:unexpected,rollD4:unexpected,rollDice:unexpected})
 readDnd5eCompletedCombatBase(native.result,base);readBountifulDeathAreaOriginalOperation(operation);if(!base.result.ok||JSON.stringify(await loadBountifulDeathAreaOriginBook(row.origin))!==JSON.stringify(book))throw Error('death-area-completion:unchanged-authenticated-native-required')
 const cap=Object.freeze({})as BountifulDeathAreaCompletedOriginal;completed.set(cap,{operation,bookSignature:JSON.stringify(book),native,base,signature:JSON.stringify({native,base})});return cap
}
export async function readBountifulDeathAreaCompletedOriginal(cap:BountifulDeathAreaCompletedOriginal){const row=completed.get(cap);if(!row)throw Error('death-area-completion:actual-completed-original-required');const operation=readBountifulDeathAreaOriginalOperation(row.operation),origin=issued.get(row.operation)!.origin,book=await loadBountifulDeathAreaOriginBook(origin);if(JSON.stringify(book)!==row.bookSignature||JSON.stringify({native:row.native,base:row.base})!==row.signature)throw Error('death-area-completion:changed-actual-completed-original');return cloneDnd5eHostTransactionInput({operation,book,native:row.native,base:row.base})}
export function cancelBountifulDeathAreaCompletedOriginal(cap:BountifulDeathAreaCompletedOriginal){return completed.delete(cap)}

declare const boundaryBrand:unique symbol
export type BountifulDeathAreaCompletedBoundary={readonly[boundaryBrand]:true}
const boundaries=new WeakMap<object,{completion:BountifulDeathAreaCompletedOriginal;result:Awaited<ReturnType<typeof settleDnd5ePersistentAreaTurnTransition>>;signature:string}>()
export async function settleBountifulDeathAreaCompletedBoundary(completion:BountifulDeathAreaCompletedOriginal):Promise<BountifulDeathAreaCompletedBoundary>{
 const facts=await readBountifulDeathAreaCompletedOriginal(completion),origin=facts.operation.origin,prepared=facts.operation.prepared;let visited=false
 const result=await settleDnd5ePersistentAreaTurnTransition({transition:origin.transition,worldMinute:origin.worldMinute,initiativeOrder:origin.initiativeOrder,map:origin.map,characters:origin.characters,settleBoundary:async value=>{
  const advanced=advanceDnd5ePluginAreasAtTurnBoundary({...value.boundary,map:value.map});if(advanced.movedAreaIds.length)throw Error('death-area-boundary:moving-area-frontier-required')
  if(JSON.stringify(value.boundary)!==JSON.stringify(facts.operation.boundary)){
   const context={map:advanced.map,round:value.boundary.round,turnKey:value.boundary.turnKey,flightCapableTokenIds:dnd5ePersistentAreaFlightCapableTokenIds({map:advanced.map,characters:value.characters,round:value.boundary.round}),sizeRanksByTokenId:dnd5ePersistentAreaSizeRanks({map:advanced.map,characters:value.characters,round:value.boundary.round})}
   const pending=[...collectDnd5ePersistentAreaTriggers({...context,timing:value.boundary.timing,targetTokenId:value.boundary.tokenId}),...(advanced.map.dnd5ePluginAreas??[]).filter(a=>a.sourceTokenId===value.boundary.tokenId).flatMap(a=>collectDnd5ePersistentAreaTriggers({...context,areaId:a.id,timing:value.boundary.timing==='turn-start'?'source-turn-start':'source-turn-end'})),...collectDnd5eExpiringPersistentAreaDetonationTriggers({...value.boundary,map:advanced.map})];if(pending.length)throw Error('death-area-boundary:additional-native-original-required')
   return{map:advanced.map,characters:[...value.characters],logs:[]}
  }
  if(visited||JSON.stringify(advanced.map)!==JSON.stringify(prepared.map)||JSON.stringify(value.characters)!==JSON.stringify(prepared.characters)||!facts.native.result.ok||!facts.native.application)throw Error('death-area-boundary:exact-completed-native-frontier-required')
  visited=true;const native=projectDnd5eCombatApplicationStoreState({map:advanced.map,characters:value.characters,application:facts.native.application}),base=projectDnd5eCombatApplicationStoreState({map:native.map,characters:native.characters,application:facts.base.application})
  return{map:base.map,characters:[...base.characters],events:facts.base.result.events,logs:[]}
 },expireBoundary:({boundary,map,characters})=>{const web=expireDnd5eWebAreaAtTurnBoundary({...boundary,map,characters}),expired=expireDnd5ePluginAreasAtTurnBoundary({...boundary,map:web.map}),next=reconcileDnd5ePluginAreasAndConcentrationOnMap(web.map,web.characters,boundary.round,reconcileDnd5ePluginAreasOnMap(expired,web.characters,boundary.round),[origin.map]);return{map:next.map,characters:[...next.characters]}}})
 if(!visited||result.initiativeEntries.length)throw Error('death-area-boundary:actual-single-native-completion-required');await readBountifulDeathAreaCompletedOriginal(completion)
 const cap=Object.freeze({})as BountifulDeathAreaCompletedBoundary;boundaries.set(cap,{completion,result,signature:JSON.stringify(result)});return cap
}
export async function readBountifulDeathAreaCompletedBoundary(cap:BountifulDeathAreaCompletedBoundary){const row=boundaries.get(cap);if(!row)throw Error('death-area-boundary:actual-completed-boundary-required');const completion=await readBountifulDeathAreaCompletedOriginal(row.completion);if(JSON.stringify(row.result)!==row.signature)throw Error('death-area-boundary:changed-completed-boundary');return cloneDnd5eHostTransactionInput({...completion,boundary:row.result})}

// This is an actual Native missing boundary, not an externally constructible DTO issuer.
type AreaBook=Awaited<ReturnType<typeof loadBountifulDeathAreaOriginBook>>
const actualAreaOwnPending=new WeakMap<object,{operation:BountifulDeathAreaOriginalOperation;signature:string;request:AllyNaturalOneDecisionRequired['request'];snapshotSignature:string;book:AreaBook}>()
export function readBountifulDeathAreaOwnPending(error:unknown){if(!error||typeof error!=='object')return undefined;const row=actualAreaOwnPending.get(error);if(!row)return undefined;const current=readBountifulDeathAreaOriginalOperation(row.operation);if(current.signature!==row.signature)throw Error('death-area-own:changed-actual-native-frontier');return cloneDnd5eHostTransactionInput({actorId:row.request.actorId,characterId:row.book.saving.characterId,memberId:row.book.saving.memberId,hostMemberId:row.book.hostMemberId,parentId:row.book.parentId,mapId:row.book.mapId,effectTimestamp:row.book.effectTimestamp,originalRequest:row.request})}
function resolveAreaAuthenticatedOwn(operation:BountifulDeathAreaOriginalOperation,book:AreaBook,dice:{d20:number;damageRolls:readonly number[]}){
 try{return resolveBountifulDeathAreaOriginalMechanical(operation,dice)}catch(error){
  if(!(error instanceof AllyNaturalOneDecisionRequired)||!error.request.nativeLucky)throw error
  const request=error.request,expected={actorId:book.saving.actorId,kind:'saving-throw',originalRolls:[1],dieIndex:0,nativeLucky:true,options:[{ownerId:book.saving.actorId,featureId:'dnd5e-racial-halfling-lucky'}]},current=readBountifulDeathAreaOriginalOperation(operation)
  if(JSON.stringify(request)!==JSON.stringify(expected)||dice.d20!==1||book.pools.saving?.confirmed?.values[0]!==1||error.snapshot.combatants[request.actorId]?.racialRules?.halflingLucky!==true)throw Error('death-area-own:exact-actual-native-frontier-required')
  const suspend=(message:string):never=>{const pending=new Error(message);actualAreaOwnPending.set(pending,{operation,signature:current.signature,request,snapshotSignature:JSON.stringify(error.snapshot),book});throw pending},own=book.own,decision=own?.decision
  if(!own||!decision)suspend('death-area-own:actual-owner-choice-required')
  if(own!.parentId!==book.parentId||own!.mapId!==book.mapId||own!.combatId!==book.combatId||own!.areaRequestId!==book.requestId||own!.effectTimestamp!==book.effectTimestamp||own!.hostMemberId!==book.hostMemberId||own!.spec.actorId!==book.saving.actorId||own!.spec.characterId!==book.saving.characterId||own!.spec.memberId!==book.saving.memberId||own!.spec.count!==1||own!.spec.sides!==20||decision!.memberId!==book.saving.memberId||decision!.choiceId!==own!.choiceId||!['use','decline'].includes(decision!.decision))throw Error('death-area-own:exact-authenticated-decision-required')
  const pool=own!.pool;if(decision!.decision==='use'&&(!pool?.raw||!pool.confirmed))suspend('death-area-own:independent-adopted-original-required');if(decision!.decision==='use'&&(!pool?.raw||!pool.confirmed||pool.raw.memberId!==own!.spec.memberId||pool.confirmed.memberId!==book.hostMemberId||![pool.raw.values,pool.confirmed.values].every(v=>v.length===1&&Number.isInteger(v[0])&&v[0]>=1&&v[0]<=20)))throw Error('death-area-own:independent-adopted-original-required')
  if(decision!.decision==='decline'&&pool)throw Error('death-area-own:decline-without-extra-pool-required')
  let visited=0;const snapshotSignature=JSON.stringify(error.snapshot),native=runAreaMechanical(operation,dice,(next,state)=>{if(visited++!==0||JSON.stringify(next)!==JSON.stringify(request)||JSON.stringify(state)!==snapshotSignature)throw Error('death-area-own:exact-native-replay-required');return decision!.decision==='decline'?undefined:{ownerId:request.actorId,featureId:'dnd5e-racial-halfling-lucky',replacement:pool!.confirmed!.values[0]}})
  if(visited!==1)throw Error('death-area-own:actual-native-replay-not-reached');return native
 }
}
