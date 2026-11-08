import{bindBountifulOpportunitySequenceOriginalClock}from'./bountifulOpportunitySequenceOriginalClock'
import{stormFurySequencePostNativeChecked}from'./bountifulOpportunitySequencePostNative'
import{readBountifulOpportunitySequencePostNativeReplay}from'./bountifulOpportunitySequencePostNativeReplay'
import{readMastermindOpportunityMisdirectionChoice,type MastermindOpportunityMisdirectionDecision}from'../../pages/maps/mastermindOpportunityMisdirectionParent'
import{captureDnd5eOpportunitySequenceMovementCheckpoint,readCapturedDnd5eOpportunitySequenceMovementCheckpoint}from'./opportunityMoveSequence'
import{settleBountifulOpportunitySequenceMovement}from'./bountifulOpportunitySequenceMovement'
import{settleDnd5eSequenceMovementConcentration,withIssuedDnd5eMovementHazardsDice,readDnd5eSequenceMovementOriginal,readDnd5eSequenceMovementOriginalReplayFacts,settleDnd5eSequenceMovementOriginalWithMaterials,type Dnd5eMovementOriginalFrame}from'../../pages/maps/movementHazardsProducer'
import{createBountifulOpportunitySequenceMovementDice}from'./bountifulOpportunitySettlementDice'
import{captureDnd5eOpportunitySequencePostNativeCheckpoint,readCapturedDnd5eOpportunitySequencePostNativeCheckpoint}from'./opportunityMoveSequence'
import{settleBountifulOpportunitySequencePostNative}from'./bountifulOpportunitySequencePostNative'
import{issueBountifulOpportunitySequencePostNativeReplay,withBountifulOpportunitySequencePostNativeReplay}from'./bountifulOpportunitySequencePostNativeReplay'
import{createBountifulOpportunitySequencePostNativeDice}from'./bountifulOpportunitySettlementDice'
import{prepareDnd5eStormFuryMoveConcentrationReplay,readDnd5eSequenceConcentrationOriginal,readDnd5eSequenceConcentrationOriginalReplayFacts,readDnd5eSequenceMovementConcentrationOriginal,readDnd5eSequenceConcentrationOriginalResult,type Dnd5eSequenceConcentrationOriginal}from'../../pages/maps/settleDnd5eCombatResult'
import{resolveDnd5ePreparedWithDamageReactions}from'./damageReactionFlow'
import type{BountifulSequenceConcentrationPoolIdentity}from'./bountifulOpportunitySequencePostNativeReplay'
import{getRoomSession}from'../../lib/roomSession'
import{durableD20RollId}from'../../lib/rollConfirmation'
import{encodeSecondChanceParentWire,decodeSecondChanceParentWire,type SecondChanceParentWire}from'../../lib/secondChanceParentWire'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{captureDnd5eOpportunitySequenceCollectorCheckpoint,readCapturedDnd5eOpportunitySequenceCollectorCheckpoint,prepareCapturedDnd5eOpportunitySequenceCollectorRedirect,prepareDnd5eOpportunitySequenceCollectorOriginal,resolveDnd5eOpportunityMoveSequenceOriginal,prepareDnd5eOpportunityMoveSequence}from'./opportunityMoveSequence'
import type{resolvePreparedDnd5eOpportunityAttack}from'./opportunityAttackAction'
import type{BountifulOpportunityCollectorBoundary}from'./bountifulOpportunityCollectorBoundary'
import{issueCapturedBountifulOpportunitySequenceRawSource,readBountifulOpportunitySequenceRawRoute,restoreBountifulOpportunitySequenceOriginalRaw,type BountifulOpportunitySequenceRawRoute}from'./bountifulOpportunitySequenceSource'
import{createBountifulOpportunitySequenceCollectorDice}from'./bountifulOpportunitySettlementDice'
import{appendBountifulOpportunitySequenceOriginal}from'./bountifulOpportunitySequenceContinuation'
import{persistBountifulOriginalParent,bountifulOriginalParentReceiptId}from'./bountifulLuckPersistentHost'
import{driveBountifulOriginalParent,readBountifulOriginalSource}from'./bountifulLuckPersistentRoomDriver'
import{createDnd5eOriginalD20Session,createDnd5ePreparedDamageCommitSession}from'./damageCommitSession'
import{bountifulPreparedReplayFacts,bountifulOriginalDiePhase,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import type{BountifulOpportunitySequencePrivateBook}from'./bountifulOpportunitySequencePrefixWindow'

type AttackInput=Parameters<typeof resolvePreparedDnd5eOpportunityAttack>[0]
export type BountifulOpportunitySequenceCollectedRolls=Omit<AttackInput,'prepared'|'transactionId'|'transactionNow'>
type PreChoices=Pick<AttackInput,'tranquilitySave'|'areaAttackAdvantageReaction'|'disadvantageNegationChoice'|'coverAttackRedirect'>
type Mode='normal'|'advantage'|'disadvantage'
type OriginalState='no-original-required'|'original-confirmed-no-BL'|'bountiful-original-ready'|'reaction-declined'
type Source=Parameters<typeof resolveDnd5eOpportunityMoveSequenceOriginal>[0]&{transactionId:string;hostOriginalOpportunityRolls:readonly{actorId:string;values:readonly number[];hostOriginalRollIssuerMode:'dm'|'player';hostOriginalRollId:string;hostOriginalDiceCursor:number}[]}
type Prepared=Extract<ReturnType<typeof prepareDnd5eOpportunityMoveSequence>,{ok:true}>['prepared']
type Resolved=ReturnType<typeof resolveDnd5eOpportunityMoveSequenceOriginal>
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
type Combat={_sync?:{revision?:number};bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
export type BountifulOpportunitySequenceCollectorBook=BountifulOpportunitySequencePrivateBook&{collectorSource?:SecondChanceParentWire;collectorCheckpointSource?:SecondChanceParentWire;movementSegments?:{segmentIndex:number;registered:boolean;complete:boolean;source:SecondChanceParentWire}[];collectorWindows?:{actorId:string;windowIndex:number;complete:boolean;originalState?:OriginalState;originalChoices?:PreChoices;mode?:Mode;rollCursor?:number;decisionInterruptId?:string;completionSource?:SecondChanceParentWire;postNativeRegistered?:boolean;postNativeComplete?:boolean}[]}
type Loader=()=>Promise<BountifulOpportunitySequenceCollectorBook>
type Ui=Parameters<typeof driveBountifulOriginalParent>[2]
type Fact=ReturnType<typeof readCapturedDnd5eOpportunitySequenceCollectorCheckpoint>
type Journal=ReturnType<typeof createBountifulOpportunitySequenceCollectorDice>
export interface BountifulOpportunitySequenceCollectorHandle{readonly actualOpportunityCollector:unique symbol}
export interface BountifulOpportunitySequenceCompletion{readonly actualOpportunityCompletion:unique symbol}
type PostNativeInput={services:Parameters<typeof settleBountifulOpportunitySequencePostNative>[0]['services'];options:Parameters<typeof settleBountifulOpportunitySequencePostNative>[0]['options'];originalUi?:Ui}
type State={mastermindDecision?:MastermindOpportunityMisdirectionDecision;mastermindUse?:AttackInput['coverAttackRedirect'];postNativeReplay?:object;roomId:string;memberId:string;checkpoint:object;fact:Fact;cursor:number;issuerMode:'dm'|'player';load:Loader;gateway:Gateway;ui:Ui;unchanged:()=>boolean;journal:Journal;choices?:PreChoices;mode?:Mode;rawCheckpoint?:object;route?:BountifulOpportunitySequenceRawRoute;source?:Source;original?:readonly number[];retained?:readonly[number,number|undefined];preview?:AttackInput['prepared']['state'];originalState?:OriginalState}
const sessions=new WeakMap<object,State>(),completions=new WeakMap<object,{roomId:string;memberId:string;action:SharedPlayerActionState;source:Source;postNativeReplay?:object;resolved:Resolved;signature:string;hadBountiful:boolean;replayCheckpoint:(windowIndex:number)=>object;unchanged:()=>boolean}>(),equal=(a:unknown,b:unknown)=>JSON.stringify(encodeSecondChanceParentWire(a))===JSON.stringify(encodeSecondChanceParentWire(b))
const preChoices=(rolls:PreChoices):PreChoices=>({tranquilitySave:rolls.tranquilitySave,areaAttackAdvantageReaction:rolls.areaAttackAdvantageReaction,disadvantageNegationChoice:rolls.disadvantageNegationChoice,...(rolls.coverAttackRedirect!==undefined?{coverAttackRedirect:rolls.coverAttackRedirect}:{})})
function host(){const value=getRoomSession();if(value?.role!=='dm')throw Error('opportunity-collector:actual-host-required');return value}
function assertState(state:State){const current=host();if(current.roomId!==state.roomId||current.memberId!==state.memberId||!state.unchanged())throw Error('opportunity-collector:stale-native-authority')}
function stateFor(handle:object){const state=sessions.get(handle);if(!state)throw Error('opportunity-collector:exact-live-handle-required');assertState(state);return state}
const rowsFor=(combat:Combat|undefined,parentId:string)=>Object.values(combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
function rawBook(book:BountifulOpportunitySequenceCollectorBook,attacks:Source['attacks']){return book.rows.filter(row=>row.confirmed&&Object.hasOwn(attacks,row.actorId)).map(row=>({actorId:row.actorId,values:[...row.confirmed!.values],hostOriginalRollIssuerMode:row.originalIssuer.mode,hostOriginalRollId:row.requestId,hostOriginalDiceCursor:row.originalIssuer.cursor}))}
async function loadSource(state:State){
 assertState(state);const book=await state.load();await recoverCollectorContinuation({action:state.fact.request.originalAction,book,gateway:state.gateway,authorityUnchanged:state.unchanged});const combat=await state.gateway.loadResource<Combat>('combat'),first=rowsFor(combat??undefined,state.fact.request.parentId)[0]
 let source:Source
 if(first){const original=await readBountifulOriginalSource(first,{includeContinuation:true});if((original.resolve as unknown)!==resolveDnd5eOpportunityMoveSequenceOriginal)throw Error('opportunity-collector:actual-sequence-source-required');source=original.source as unknown as Source}
 else if(book.collectorSource||book.prefixSource)source=decodeSecondChanceParentWire((book.collectorSource??book.prefixSource)!)as Source
 else source={...cloneDnd5eHostTransactionInput(state.fact.source),transactionId:state.fact.request.parentId,hostOriginalOpportunityRolls:rawBook(book,state.fact.source.attacks)}
 if(!equal(source.prepared,state.fact.source.prepared)||source.prepared.action.id!==state.fact.request.parentId)throw Error('opportunity-collector:changed-prepared-whole-move')
 assertState(state);return{book,combat,first,source}
}
async function saveContinuation(scope:{parentId:string;windowIndex:number;memberId:string;gateway:Gateway;authorityUnchanged:()=>boolean},source:Source,rollCursor:number){
 const combat=await scope.gateway.loadResource<Combat>('combat'),id=bountifulOriginalParentReceiptId(scope.parentId,0),first=combat?.bountifulOriginalParents?.[id]
 if(!combat||!first)return
 if(first.consumed)throw Error('opportunity-collector:original-already-completed')
 const continuation={...first.continuation,hostMemberId:scope.memberId,source:encodeSecondChanceParentWire(source),rollCursor}
 if(equal(first.continuation,continuation))return
 const data={...combat,bountifulOriginalParents:{...combat.bountifulOriginalParents,[id]:{...first,continuation}}}
 try{await scope.gateway.saveResourcesAtomically([{name:'combat',expectedRevision:combat._sync?.revision??0,data}],{transactionId:'bountiful-opportunity-collector:'+scope.parentId+':'+scope.windowIndex})}catch(error){const current=await scope.gateway.loadResource<Combat>('combat');if(!equal(current?.bountifulOriginalParents?.[id]?.continuation,continuation))throw error}
 if(host().memberId!==scope.memberId||!scope.authorityUnchanged())throw Error('opportunity-collector:stale-native-authority')
}
/** The complete book can survive a lost metadata reply. Only its immutable
 * last complete source may recover the already-authorized continuation. */
async function recoverCollectorContinuation(input:{action:SharedPlayerActionState;book:BountifulOpportunitySequenceCollectorBook;gateway:Gateway;authorityUnchanged:()=>boolean}){
 const window=input.book.collectorWindows?.filter(row=>row.complete).sort((a,b)=>a.windowIndex-b.windowIndex).at(-1)
 if(!window||!input.book.collectorSource)return
 const source=decodeSecondChanceParentWire(input.book.collectorSource)as Source,combat=await input.gateway.loadResource<Combat>('combat'),first=rowsFor(combat??undefined,input.action.id)[0]
 if(!first||equal(first.continuation?.source,input.book.collectorSource))return
 if(first.originalAdapterId!=='opportunity-move-sequence')throw Error('opportunity-collector:actual-sequence-source-required')
 const current=decodeSecondChanceParentWire(first.continuation?.source??first.originalParent)as Source,completedIds=new Set(input.book.collectorWindows?.filter(row=>row.complete).map(row=>row.actorId))
 // A later original may already be appended. Recover only a missing completed
 // prefix, never roll that later authenticated original back to an older book.
 if([...completedIds].every(id=>equal(current.attacks?.[id],source.attacks[id]))&&equal(current.hostOriginalOpportunityRolls?.filter(row=>completedIds.has(row.actorId)),source.hostOriginalOpportunityRolls.filter(row=>completedIds.has(row.actorId))))return
 if(!window.originalState||!Number.isSafeInteger(window.rollCursor)||!equal(source.prepared.action,input.action))throw Error('opportunity-collector:protected-complete-recovery-required')
 await input.gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase:'collector-complete',parentId:input.action.id,mapId:input.action.mapId,combatId:source.prepared.state.combatId,actorId:window.actorId,windowIndex:window.windowIndex,source:input.book.collectorSource,originalState:window.originalState,rollCursor:window.rollCursor,...(window.decisionInterruptId?{decisionInterruptId:window.decisionInterruptId}:{})})
 await saveContinuation({parentId:input.action.id,windowIndex:window.windowIndex,memberId:host().memberId,gateway:input.gateway,authorityUnchanged:input.authorityUnchanged},source,window.rollCursor!)
}
async function completeOriginal(state:State,values:readonly number[]){
 assertState(state);if(!state.route||!state.choices)throw Error('opportunity-collector:actual-issued-original-required')
 const issued=readBountifulOpportunitySequenceRawRoute(state.route),loaded=await loadSource(state),slot=loaded.book.rows.find(row=>row.requestId===issued.requestId)
 if(!slot?.confirmed||slot.actorId!==state.fact.request.actorTokenId||!equal(slot.confirmed.values,values))throw Error('opportunity-collector:actual-Host-confirmed-original-required')
 const actor=state.fact.request.actorTokenId,current:Source={...loaded.source,attacks:{...loaded.source.attacks,[actor]:{...state.choices,d20:values[0]!,...(values.length===2?{d20Second:values[1]}:{}),damageRolls:[]}}};current.hostOriginalOpportunityRolls=rawBook(loaded.book,current.attacks)
 if(loaded.first){if(!Object.hasOwn(loaded.source.attacks,actor))await appendBountifulOpportunitySequenceOriginal({action:state.fact.request.originalAction,source:current,rollCursor:Math.max(state.cursor,loaded.first.continuation?.rollCursor??0)},state.gateway)}
 else{
  const probe=createDnd5eOriginalD20Session(state.postNativeReplay?withBountifulOpportunitySequencePostNativeReplay(current,state.postNativeReplay):current,resolveDnd5eOpportunityMoveSequenceOriginal,actor,'attack');let boundary:ReturnType<typeof probe.run>;try{boundary=probe.run(current.prepared.state)}finally{probe.cancel()}
  if(boundary.status==='pending-ally-natural-one'){
   if(boundary.request.actorId!==actor||boundary.request.kind!=='attack')throw Error('opportunity-collector:pre-original-natural-one-source-required')
   await persistBountifulOriginalParent({parentId:current.transactionId,source:bindBountifulOpportunitySequenceOriginalClock(current,state.route!),resolve:resolveDnd5eOpportunityMoveSequenceOriginal,actorId:actor,kind:'attack',opportunitySequencePostNativeReplay:state.postNativeReplay},state.gateway)
  }else if(boundary.status!=='original-d20-ready')throw Error('opportunity-collector:actual-original-boundary-required')
 }
 const combat=await state.gateway.loadResource<Combat>('combat'),first=rowsFor(combat??undefined,current.transactionId)[0]
 if(first){const ready=await driveBountifulOriginalParent({mapId:current.prepared.map.id,parentId:current.transactionId,originalScope:{actorId:actor,kind:'attack'},opportunitySequencePostNativeReplay:state.postNativeReplay},state.gateway,state.ui);state.retained=[ready.request.values[0]!,ready.request.values[1]];state.preview=cloneDnd5eHostTransactionInput(ready.snapshot);const settled=await state.gateway.loadResource<Combat>('combat');state.originalState=rowsFor(settled??undefined,current.transactionId).some(row=>row.request.actorId===actor)?'bountiful-original-ready':'original-confirmed-no-BL';state.source=ready.source as unknown as Source}
 else{const probe=createDnd5eOriginalD20Session(state.postNativeReplay?withBountifulOpportunitySequencePostNativeReplay(current,state.postNativeReplay):current,resolveDnd5eOpportunityMoveSequenceOriginal,actor,'attack');try{const ready=probe.run(current.prepared.state);if(ready.status!=='original-d20-ready')throw Error('opportunity-collector:ordinary-original-not-ready');state.retained=[ready.request.values[0]!,ready.request.values[1]];state.preview=cloneDnd5eHostTransactionInput(ready.snapshot)}finally{probe.cancel()}state.originalState='original-confirmed-no-BL';state.source=current}
 state.original=[...values];assertState(state);return state.retained
}
function issuedMastermindChoices<T extends PreChoices>(state:State,rolls:T){if(rolls.coverAttackRedirect!==undefined&&(!state.mastermindDecision||!equal(rolls.coverAttackRedirect,state.mastermindUse)))throw Error('opportunity-collector:issued-Misdirection-choice-required');return state.mastermindUse?{...rolls,coverAttackRedirect:cloneDnd5eHostTransactionInput(state.mastermindUse)}:rolls}
/** A true owner choice can bind only the original live collector, before any original or Ward pool. */
export async function bindBountifulOpportunitySequenceMisdirection(handle:BountifulOpportunitySequenceCollectorHandle,decision:MastermindOpportunityMisdirectionDecision){const state=stateFor(handle);if(state.mastermindDecision||state.route||state.original||state.retained||state.originalState||state.choices)throw Error('opportunity-collector:untouched-pre-dice-window-required');const use=await readMastermindOpportunityMisdirectionChoice(state.checkpoint,decision),rows=await state.journal.finish();if(rows.length)throw Error('opportunity-collector:Misdirection-before-Ward-required');assertState(state);state.mastermindDecision=decision;state.mastermindUse=use;return cloneDnd5eHostTransactionInput(use?prepareCapturedDnd5eOpportunitySequenceCollectorRedirect(state.checkpoint,use):state.fact.attack)}

/** Register a real pre-expense native collector before any Ward roll. The
 * lazy original factory is invoked by the existing central collector only if
 * its actual pre-original gate permits an attack d20. */
export async function prepareBountifulOpportunitySequenceCollector(input:{checkpoint:object;cursor:number;issuerMode:'dm'|'player';loadPrivateOriginal:Loader;gateway:Gateway;ui:Ui;authorityUnchanged:()=>boolean;postNativeReplay?:object}){
 const session=host(),fact=readCapturedDnd5eOpportunitySequenceCollectorCheckpoint(input.checkpoint)
 if(!input.authorityUnchanged()||!Number.isSafeInteger(input.cursor)||input.cursor<1||input.issuerMode!==fact.request.originalAction.sourceMode)throw Error('opportunity-collector:actual-queued-source-required')
 await input.gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase:'collector-register',parentId:fact.request.parentId,mapId:fact.request.originalAction.mapId,combatId:fact.source.prepared.state.combatId,source:encodeSecondChanceParentWire({prepared:fact.source.prepared,pending:fact.request,preceding:fact.preceding})})
 const journal=createBountifulOpportunitySequenceCollectorDice(input.checkpoint,input.gateway,input.loadPrivateOriginal),state:State={roomId:session.roomId,memberId:session.memberId,checkpoint:input.checkpoint,fact,cursor:input.cursor,issuerMode:input.issuerMode,load:input.loadPrivateOriginal,gateway:input.gateway,ui:input.ui,unchanged:input.authorityUnchanged,journal,postNativeReplay:input.postNativeReplay},handle=Object.freeze({})as BountifulOpportunitySequenceCollectorHandle;sessions.set(handle,state);assertState(state)
 const boundary:BountifulOpportunityCollectorBoundary={
  getDiceRoute:()=>undefined,
  getSequenceDiceRoute:()=>state.route,
  hasPreparedOriginal:()=>state.choices!==undefined,
  hasCapturedOriginal:()=>state.retained!==undefined,
  readOriginal:()=>{assertState(state);if(!state.choices)throw Error('opportunity-collector:actual-staged-choices-required');return{prepared:{rawMode:state.mode,originalChoices:cloneDnd5eHostTransactionInput(state.choices)}}},
  readRetained:()=>{assertState(state);if(!state.retained)throw Error('opportunity-collector:actual-original-not-ready');return[...state.retained]as const},
  readPreview:()=>{assertState(state);return state.preview&&cloneDnd5eHostTransactionInput(state.preview)},
  createLateJournal:()=>{assertState(state);return state.journal},
  beforeOriginalRequest:async(requestId,count)=>{
   assertState(state);if(state.mastermindDecision)await readMastermindOpportunityMisdirectionChoice(state.checkpoint,state.mastermindDecision);if(!state.rawCheckpoint||!state.mode)throw Error('opportunity-collector:actual-staged-original-required')
   const expected=durableD20RollId({mapId:fact.request.originalAction.mapId,sourceMode:state.issuerMode,transactionId:fact.request.parentId,occurrenceIndex:state.cursor-1})+(state.mode==='normal'?'':':pool:2d20')
   if(requestId!==expected||count!==(state.mode==='normal'?1:2))throw Error('opportunity-collector:exact-original-request-required')
   state.route=await issueCapturedBountifulOpportunitySequenceRawSource(state.rawCheckpoint,{cursor:state.cursor,issuerMode:state.issuerMode},state.gateway)
   const restored=await restoreBountifulOpportunitySequenceOriginalRaw(state.route,state.load);if(restored?.values)await completeOriginal(state,restored.values)
  },
  afterOriginalConfirmed:async(values,requestId)=>{if(!state.route||readBountifulOpportunitySequenceRawRoute(state.route).requestId!==requestId)throw Error('opportunity-collector:actual-issued-original-required');return completeOriginal(state,values)},
 }
 const createOriginal=(facts:{mode:Mode;choices:PreChoices})=>{
  assertState(state);const choices=preChoices(issuedMastermindChoices(state,facts.choices)),staged=prepareDnd5eOpportunitySequenceCollectorOriginal(state.checkpoint,choices)
  if(staged.status!=='raw-required'||staged.mode!==facts.mode||state.choices&&!equal(state.choices,choices))throw Error('opportunity-collector:actual-native-original-mode-required')
  state.choices=cloneDnd5eHostTransactionInput(choices);state.mode=staged.mode;state.rawCheckpoint=staged.rawCheckpoint
  return{requestId:durableD20RollId({mapId:fact.request.originalAction.mapId,sourceMode:state.issuerMode,transactionId:fact.request.parentId,occurrenceIndex:state.cursor-1})+(staged.mode==='normal'?'':':pool:2d20'),boundary}
 }
 const book=await state.load(),window=book.collectorWindows?.find(row=>row.windowIndex===fact.request.windowIndex&&row.actorId===fact.request.actorTokenId)
 if(window?.complete)throw Error('opportunity-collector:window-already-completed')
 const originalInput=window?.originalChoices&&window.mode?createOriginal({mode:window.mode,choices:window.originalChoices}):createOriginal
 return{handle,attack:cloneDnd5eHostTransactionInput(fact.attack),windowIndex:fact.request.windowIndex,originalInput,journal}
}
/** Complete the actual central collector, including a blocked Ward with zero
 * original pools. Only typed native A decides whether original raw is needed. */
export async function recordBountifulOpportunitySequenceCollectedRolls(handle:BountifulOpportunitySequenceCollectorHandle,rolls:BountifulOpportunitySequenceCollectedRolls){
 const state=stateFor(handle),actor=state.fact.request.actorTokenId,issuedRolls=issuedMastermindChoices(state,rolls),choices=preChoices(issuedRolls)
 await state.journal.finish()
 if(!state.originalState){const staged=prepareDnd5eOpportunitySequenceCollectorOriginal(state.checkpoint,choices);if(staged.status!=='no-original-required')throw Error('opportunity-collector:unconfirmed-original-required');state.originalState='no-original-required';state.choices=choices}
 if(!equal(state.choices,choices))throw Error('opportunity-collector:changed-pre-original-choices')
 if(state.originalState!=='no-original-required'&&(!state.original||!state.retained||rolls.d20!==state.retained[0]||rolls.d20Second!==state.retained[1]))throw Error('opportunity-collector:changed-native-retained-original')
 const loaded=await loadSource(state),current={...cloneDnd5eHostTransactionInput(issuedRolls),...(state.original?{d20:state.original[0]!,d20Second:state.original[1]}:{})},source:Source={...loaded.source,attacks:{...loaded.source.attacks,[actor]:current}};source.hostOriginalOpportunityRolls=rawBook(loaded.book,source.attacks)
 const rollCursor=Math.max(state.cursor,loaded.first?.continuation?.rollCursor??0,...source.hostOriginalOpportunityRolls.map(row=>row.hostOriginalDiceCursor))
 await state.gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase:'collector-complete',parentId:state.fact.request.parentId,mapId:state.fact.request.originalAction.mapId,combatId:state.fact.source.prepared.state.combatId,actorId:actor,windowIndex:state.fact.request.windowIndex,source:encodeSecondChanceParentWire(source),originalState:state.originalState,rollCursor})
 await saveContinuation({parentId:state.fact.request.parentId,windowIndex:state.fact.request.windowIndex,memberId:state.memberId,gateway:state.gateway,authorityUnchanged:state.unchanged},source,rollCursor)
 const book=await state.load(),completed=book.collectorWindows?.find(row=>row.windowIndex===state.fact.request.windowIndex&&row.actorId===actor)
 if(!completed?.complete||!book.collectorSource||!equal(decodeSecondChanceParentWire(book.collectorSource),source))throw Error('opportunity-collector:server-completed-source-required')
 assertState(state);sessions.delete(handle);return source
}
/** A real persisted owner decision closes this optional reaction window
 * without issuing an attack pool or spending the reaction. The server binds
 * decisionInterruptId to its authenticated current-window PATCH witness. */
export async function recordBountifulOpportunitySequenceDeclinedReaction(handle:BountifulOpportunitySequenceCollectorHandle,decisionInterruptId:string){
 const state=stateFor(handle),actor=state.fact.request.actorTokenId
 if(!decisionInterruptId||state.fact.attack.mandatory||state.route||state.original||state.retained||state.originalState)throw Error('opportunity-collector:untouched-optional-reaction-required')
 const rows=await state.journal.finish();if(rows.length)throw Error('opportunity-collector:declined-window-has-dice')
 const loaded=await loadSource(state)
 if(loaded.book.rows.some(row=>row.actorId===actor))throw Error('opportunity-collector:declined-window-has-original')
 const source:Source={...loaded.source,attacks:{...loaded.source.attacks,[actor]:{reactionDecision:'decline'}}}
 source.hostOriginalOpportunityRolls=rawBook(loaded.book,source.attacks)
 const rollCursor=Math.max(0,loaded.first?.continuation?.rollCursor??0,...source.hostOriginalOpportunityRolls.map(row=>row.hostOriginalDiceCursor))
 await state.gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase:'collector-complete',parentId:state.fact.request.parentId,mapId:state.fact.request.originalAction.mapId,combatId:state.fact.source.prepared.state.combatId,actorId:actor,windowIndex:state.fact.request.windowIndex,source:encodeSecondChanceParentWire(source),originalState:'reaction-declined',decisionInterruptId,rollCursor})
 await saveContinuation({parentId:state.fact.request.parentId,windowIndex:state.fact.request.windowIndex,memberId:state.memberId,gateway:state.gateway,authorityUnchanged:state.unchanged},source,rollCursor)
 const book=await state.load(),completed=book.collectorWindows?.find(row=>row.windowIndex===state.fact.request.windowIndex&&row.actorId===actor)
 if(!completed?.complete||completed.originalState!=='reaction-declined'||!book.collectorSource||!equal(decodeSecondChanceParentWire(book.collectorSource),source))throw Error('opportunity-collector:server-declined-source-required')
 assertState(state);sessions.delete(handle);return source
}
/** Reads only protected completion IDs and uses a synchronous actual native
 * replay to identify the next pre-expense collector. */
export async function readNextBountifulOpportunitySequenceCollector(input:{action:SharedPlayerActionState;initialPrepared:Prepared;loadPrivateOriginal:Loader;gateway:Gateway;authorityUnchanged:()=>boolean;postNative?:PostNativeInput;movementHazards?:{producer:Parameters<typeof settleBountifulOpportunitySequenceMovement>[0]['producer'];beforePersistentAreaSettlement?:Parameters<typeof settleBountifulOpportunitySequenceMovement>[0]['beforePersistentAreaSettlement']}}){
 const session=host();if(input.movementHazards&&!input.postNative)throw Error('opportunity-collector:actual-base-services-required');if(!input.authorityUnchanged())throw Error('opportunity-collector:stale-native-authority')
 let book:BountifulOpportunitySequenceCollectorBook|undefined;try{book=await input.loadPrivateOriginal()}catch(error){if(!String(error).includes('issued-original-required'))throw error}
 if(book)await recoverCollectorContinuation({action:input.action,book,gateway:input.gateway,authorityUnchanged:input.authorityUnchanged})
 const combat=await input.gateway.loadResource<Combat>('combat');let receipts=rowsFor(combat??undefined,input.action.id);const first=receipts[0]
 let source:Source
 if(first){const stored=await readBountifulOriginalSource(first,{includeContinuation:true});if((stored.resolve as unknown)!==resolveDnd5eOpportunityMoveSequenceOriginal)throw Error('opportunity-collector:actual-sequence-source-required');source=stored.source as unknown as Source}
 else if(book?.collectorSource||book?.prefixSource)source=decodeSecondChanceParentWire((book.collectorSource??book.prefixSource)!)as Source
 else if(book){const stored=decodeSecondChanceParentWire(book.source)as{prepared:Prepared};source={prepared:stored.prepared,transactionId:input.action.id,attacks:{},hostOriginalOpportunityRolls:[]}}
 else source={prepared:input.initialPrepared,transactionId:input.action.id,attacks:{},hostOriginalOpportunityRolls:[]}
 if(!equal(input.action,source.prepared.action))throw Error('opportunity-collector:actual-whole-command-required')
 const completed=(book?.collectorWindows??[]).filter(row=>row.complete).map(row=>row.actorId)
 const pendingIndex=receipts.findIndex(row=>!['ready','declined'].includes(bountifulOriginalDiePhase(row)));let pendingReceipt=pendingIndex<0?undefined:receipts[pendingIndex],replayReceipts=pendingIndex<0?receipts:receipts.slice(0,pendingIndex)
 if(pendingReceipt&&(!['attack','saving-throw'].includes(pendingReceipt.request.kind)||receipts.slice(pendingIndex).some(row=>completed.includes(row.request.actorId))))throw Error('opportunity-collector:completed-window-has-pending-original')
 const run=()=>captureDnd5eOpportunitySequenceCollectorCheckpoint(input.action.id,completed,()=>{
  if(!replayReceipts.length)return resolveDnd5eOpportunityMoveSequenceOriginal(source)
  const replaySource={...source,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts:replayReceipts})},replay=createDnd5ePreparedDamageCommitSession(replaySource,resolveDnd5eOpportunityMoveSequenceOriginal,()=>false)
   try{const result=replay.run(source.prepared.state);if(result.status!=='resolved')throw Error('opportunity-collector:pending-native-original:'+result.status+(result.status==='rejected'?':'+result.reason:''));return result.result}finally{replay.cancel()}
 })
 let observed:ReturnType<typeof run>,postNativeReplay:object|undefined
 if(input.postNative){
  const caps:object[]=[],movementCaps:object[]=[],concentrationOriginals:Dnd5eSequenceConcentrationOriginal[]=[],concentrationPools:BountifulSequenceConcentrationPoolIdentity[]=[],movementOriginals:Dnd5eMovementOriginalFrame[]=[],movementPools:BountifulSequenceConcentrationPoolIdentity[]=[],movementConcentrationOriginals:Dnd5eSequenceConcentrationOriginal[]=[],movementConcentrationPools:BountifulSequenceConcentrationPoolIdentity[]=[]
  for(let index=0;;index++){
   if(index>(input.movementHazards?completed.length*2+2:completed.length))throw Error('opportunity-collector:post-native-window-limit')
   const execute=()=>captureDnd5eOpportunitySequencePostNativeCheckpoint(input.action.id,run,caps,concentrationOriginals),movement=input.movementHazards?captureDnd5eOpportunitySequenceMovementCheckpoint(input.action.id,execute,movementCaps,movementOriginals,movementConcentrationOriginals):{status:'complete'as const,result:execute()}
   if(movement.status==='movement'){
    const fact=readCapturedDnd5eOpportunitySequenceMovementCheckpoint(movement.checkpoint),segmentIndex=fact.request.segmentIndex,ids=new Set(fact.preceding.map(row=>row.actorTokenId)),prefixSource:Source={prepared:source.prepared,transactionId:input.action.id,attacks:Object.fromEntries(fact.preceding.map(row=>[row.actorTokenId,row.rolls])),hostOriginalOpportunityRolls:source.hostOriginalOpportunityRolls.filter(row=>ids.has(row.actorId))}
    let current:BountifulOpportunitySequenceCollectorBook|undefined;try{current=await input.loadPrivateOriginal()}catch(error){if(!String(error).includes('issued-original-required'))throw error}
    const registered=current?.movementSegments?.find(row=>row.segmentIndex===segmentIndex),protectedSource=segmentIndex===0?registered?.source:current?.collectorWindows?.find(row=>row.windowIndex===segmentIndex-1&&row.complete)?.completionSource
    if(segmentIndex>0&&!protectedSource)throw Error('opportunity-collector:actual-completed-movement-prefix-required')
    const payload={sourceKind:'opportunity-sequence-v1',parentId:input.action.id,mapId:input.action.mapId,combatId:source.prepared.state.combatId,segmentIndex,source:protectedSource??encodeSecondChanceParentWire(prefixSource)}
    if(!registered?.registered)await input.gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{...payload,phase:'movement-segment-register'})
    const journal=createBountifulOpportunitySequenceMovementDice(movement.checkpoint,input.gateway,input.loadPrivateOriginal),producer=withIssuedDnd5eMovementHazardsDice(input.movementHazards!.producer,ports=>({
     rollDiceBoxD20:async(label,target,context)=>(await journal.roll(1,20,label,target,context,async actual=>[await ports.rollDiceBoxD20(label,target,actual)]))[0]!,
     rollDiceBoxValues:(count,sides,label,target,context)=>journal.roll(count,sides,label,target,context,actual=>ports.rollDiceBoxValues(count,sides,label,target,actual)),
     rollDiceBoxD20Pair:async(label,target,mode,context,boundary)=>{const values=await journal.roll(mode==='normal'?1:2,20,label,target,{...context,rollKind:context?.rollKind??'saving-throw'},async actual=>{const pair=await ports.rollDiceBoxD20Pair(label,target,mode,actual,boundary);return pair[1]===undefined?[pair[0]]:[pair[0],pair[1]]});return[values[0]!,values[1]]},
    }))
    const cap=await settleBountifulOpportunitySequenceMovement({checkpoint:movement.checkpoint,producer,authorityUnchanged:input.authorityUnchanged,resolveOriginal:async frame=>{
      const original=readDnd5eSequenceMovementOriginal(frame,movement.checkpoint),consumed=await journal.readConsumedPools(),pools:typeof consumed=[];let count=0
      for(let i=consumed.length-1;i>=0&&count<original.raw.length;i--){const row=consumed[i]!;if(row.spec.actorId!==original.actorId||row.spec.rollKind!=='saving-throw'||row.spec.sides!==20)continue;pools.unshift(row);count+=row.spec.count}
      if(count!==original.raw.length||!equal(pools.flatMap(row=>row.values??[]),original.raw))throw Error('opportunity-collector:actual-movement-original-pools-required')
      const identity={frame,rawRequestIds:pools.map(row=>row.requestId),ordinal:pools[0]!.spec.ordinal,values:original.raw};movementOriginals.push(frame);movementPools.push(identity)
      await input.gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{...payload,phase:'movement-original-register',actorId:original.actorId,operationId:original.operationId,rawRequestIds:identity.rawRequestIds,mode:original.mode})
      const bundle=issueBountifulOpportunitySequencePostNativeReplay(source.prepared,caps,movementCaps,concentrationOriginals,concentrationPools,{movementOriginals,movementPools,movementConcentrationOriginals,movementConcentrationPools}),plain=withBountifulOpportunitySequencePostNativeReplay(source,bundle),replayed=replayReceipts.length?{...plain,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts:replayReceipts})}:plain,probe=createDnd5eOriginalD20Session(replayed,resolveDnd5eOpportunityMoveSequenceOriginal,original.actorId,'saving-throw')
      let boundary:ReturnType<typeof probe.run>;try{boundary=probe.run(source.prepared.state)}finally{probe.cancel()}
      if(boundary.status==='original-d20-ready')return boundary
      if(boundary.status!=='pending-ally-natural-one'||boundary.request.actorId!==original.actorId||boundary.request.kind!=='saving-throw')throw Error('opportunity-collector:actual-movement-original-boundary-required')
      if(!input.postNative?.originalUi)throw Error('opportunity-collector:actual-movement-original-ui-required')
      if(!receipts.length)await persistBountifulOriginalParent({parentId:input.action.id,source,resolve:resolveDnd5eOpportunityMoveSequenceOriginal,actorId:original.actorId,kind:'saving-throw',opportunitySequencePostNativeReplay:bundle},input.gateway)
      const ready=await driveBountifulOriginalParent({mapId:input.action.mapId,parentId:input.action.id,originalScope:{actorId:original.actorId,kind:'saving-throw'},opportunitySequencePostNativeReplay:bundle},input.gateway,input.postNative.originalUi)
      source=ready.source as unknown as Source;receipts=rowsFor((await input.gateway.loadResource<Combat>('combat'))??undefined,input.action.id);replayReceipts=receipts
      if(pendingReceipt?.request.kind==='saving-throw'&&pendingReceipt.rawIssuer?.rollId===identity.rawRequestIds[0])pendingReceipt=undefined
      const readySource=withBountifulOpportunitySequencePostNativeReplay(source,bundle),readyReplay={...readySource,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts})},session=createDnd5eOriginalD20Session(readyReplay,resolveDnd5eOpportunityMoveSequenceOriginal,original.actorId,'saving-throw')
      try{const confirmed=session.run(source.prepared.state);if(confirmed.status!=='original-d20-ready'||!equal(confirmed.request.values,ready.request.values))throw Error('opportunity-collector:actual-confirmed-movement-ready-boundary-required');return confirmed}finally{session.cancel()}
     },resolveFinal:async frame=>{
      const operation=readDnd5eSequenceMovementOriginal(frame,movement.checkpoint),original=movementOriginals.at(-1),pool=movementPools.at(-1)
      if(!original||!pool||pool.frame!==original||readDnd5eSequenceMovementOriginalReplayFacts(original).operationId!==operation.operationId||!equal(operation.raw,pool.values))throw Error('opportunity-collector:actual-final-movement-operation-required')
      if(!input.postNative)throw Error('opportunity-collector:actual-movement-material-options-required')
      const frames=[...movementOriginals.slice(0,-1),frame],pools=[...movementPools.slice(0,-1),{...pool,frame}],bundle=issueBountifulOpportunitySequencePostNativeReplay(source.prepared,caps,movementCaps,concentrationOriginals,concentrationPools,{movementOriginals:frames,movementPools:pools,movementConcentrationOriginals,movementConcentrationPools}),current=rowsFor((await input.gateway.loadResource<Combat>('combat'))??undefined,input.action.id),pending=current.findIndex(row=>!['ready','declined'].includes(bountifulOriginalDiePhase(row))),confirmed=pending<0?current:current.slice(0,pending)
      if(pending>=0&&(!current[pending]!.rawIssuer||current[pending]!.rawIssuer!.rollId===pool.rawRequestIds[0]))throw Error('opportunity-collector:actual-ready-movement-original-required')
      const replay=confirmed.length?{...source,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts:confirmed})}:source,options=input.postNative.options,services=input.postNative.services
      return settleDnd5eSequenceMovementOriginalWithMaterials({frame,source:replay,replay:bundle,options:{...options,authorityUnchanged:()=>input.authorityUnchanged()&&options.authorityUnchanged(),roll:request=>journal.roll(request.count,request.sides,request.label,request.targetName,{rollerTokenId:request.rollerTokenId,rollKind:request.kind==='attack-roll'?'attack':request.kind==='saving-throw'?'saving-throw':request.kind==='ability-check'?'ability-check':'other'},actual=>services.rollDice(request.count,request.sides,request.label,request.targetName,actual))}})
     },resolveConcentration:async concentrationCheckpoint=>{
      if(!input.postNative)throw Error('opportunity-collector:actual-movement-CON-services-required')
      const services=input.postNative.services,options=input.postNative.options
      return settleDnd5eSequenceMovementConcentration({checkpoint:concentrationCheckpoint,options:{...options,authorityUnchanged:()=>input.authorityUnchanged()&&options.authorityUnchanged(),roll:request=>journal.roll(request.count,request.sides,request.label,request.targetName,{rollerTokenId:request.rollerTokenId,rollKind:request.kind==='attack-roll'?'attack':request.kind==='saving-throw'?'saving-throw':request.kind==='ability-check'?'ability-check':'other'},actual=>services.rollDice(request.count,request.sides,request.label,request.targetName,actual))},services:{...services,
       rollD20:async(label,name,owner)=>(await journal.roll(1,20,label,name,{...owner,rollKind:owner?.rollKind??'saving-throw'},async actual=>[await services.rollD20(label,name,actual)]))[0]!,
       rollD4:async(label,name,owner)=>(await journal.roll(1,4,label,name,owner,async actual=>[await services.rollD4(label,name,actual)]))[0]!,rollDice:(count,sides,label,name,owner)=>journal.roll(count,sides,label,name,owner,actual=>services.rollDice(count,sides,label,name,actual)),
      },resolveOriginal:async frame=>{
       const original=readDnd5eSequenceMovementConcentrationOriginal(frame,concentrationCheckpoint),consumed=await journal.readConsumedPools(),pools=consumed.slice(-original.raw.length)
       if(pools.length!==original.raw.length||pools.some(row=>row.spec.actorId!==original.actorId||row.spec.rollKind!=='saving-throw'||row.spec.sides!==20||row.spec.count!==1)||!equal(pools.flatMap(row=>row.values??[]),original.raw))throw Error('opportunity-collector:actual-movement-CON-original-pools-required')
       const identity={frame,rawRequestIds:pools.map(row=>row.requestId),ordinal:pools[0]!.spec.ordinal,values:original.raw};movementConcentrationOriginals.push(frame);movementConcentrationPools.push(identity)
       await input.gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{...payload,phase:'movement-concentration-original-register',actorId:original.actorId,operationId:original.operationId,rawRequestIds:identity.rawRequestIds,mode:original.mode})
       const bundle=issueBountifulOpportunitySequencePostNativeReplay(source.prepared,caps,movementCaps,concentrationOriginals,concentrationPools,{movementOriginals,movementPools,movementConcentrationOriginals,movementConcentrationPools}),plain=withBountifulOpportunitySequencePostNativeReplay(source,bundle),replayed=replayReceipts.length?{...plain,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts:replayReceipts})}:plain,session=createDnd5eOriginalD20Session(replayed,resolveDnd5eOpportunityMoveSequenceOriginal,original.actorId,'saving-throw')
       let boundary:ReturnType<typeof session.run>;try{boundary=session.run(source.prepared.state)}finally{session.cancel()}
       if(boundary.status==='original-d20-ready')return boundary
       if(boundary.status!=='pending-ally-natural-one'||boundary.request.actorId!==original.actorId||boundary.request.kind!=='saving-throw')throw Error('opportunity-collector:actual-movement-CON-original-boundary-required')
       if(!input.postNative!.originalUi)throw Error('opportunity-collector:actual-movement-CON-original-ui-required')
       if(!receipts.length)await persistBountifulOriginalParent({parentId:input.action.id,source,resolve:resolveDnd5eOpportunityMoveSequenceOriginal,actorId:original.actorId,kind:'saving-throw',opportunitySequencePostNativeReplay:bundle},input.gateway)
       const ready=await driveBountifulOriginalParent({mapId:input.action.mapId,parentId:input.action.id,originalScope:{actorId:original.actorId,kind:'saving-throw'},opportunitySequencePostNativeReplay:bundle},input.gateway,input.postNative!.originalUi)
       source=ready.source as unknown as Source;receipts=rowsFor((await input.gateway.loadResource<Combat>('combat'))??undefined,input.action.id);replayReceipts=receipts;if(pendingReceipt?.rawIssuer?.rollId===identity.rawRequestIds[0])pendingReceipt=undefined
       const restored=withBountifulOpportunitySequencePostNativeReplay(source,bundle),confirmedSource={...restored,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts})},probe=createDnd5eOriginalD20Session(confirmedSource,resolveDnd5eOpportunityMoveSequenceOriginal,original.actorId,'saving-throw')
       try{const confirmed=probe.run(source.prepared.state);if(confirmed.status!=='original-d20-ready'||!equal(confirmed.request.values,ready.request.values))throw Error('opportunity-collector:actual-confirmed-movement-CON-boundary-required');return confirmed}finally{probe.cancel()}
      },resolveResult:async frame=>{
       const original=movementConcentrationOriginals.at(-1),pool=movementConcentrationPools.at(-1),operation=readDnd5eSequenceMovementConcentrationOriginal(frame,concentrationCheckpoint)
       if(!original||!pool||pool.frame!==original||readDnd5eSequenceMovementConcentrationOriginal(original,concentrationCheckpoint).operationId!==operation.operationId||!equal(operation.raw,pool.values))throw Error('opportunity-collector:actual-final-movement-CON-operation-required')
       const frames=[...movementConcentrationOriginals.slice(0,-1),frame],pools=[...movementConcentrationPools.slice(0,-1),{...pool,frame}],bundle=issueBountifulOpportunitySequencePostNativeReplay(source.prepared,caps,movementCaps,concentrationOriginals,concentrationPools,{movementOriginals,movementPools,movementConcentrationOriginals:frames,movementConcentrationPools:pools}),plain=withBountifulOpportunitySequencePostNativeReplay(source,bundle),current=rowsFor((await input.gateway.loadResource<Combat>('combat'))??undefined,input.action.id),pending=current.findIndex(row=>!['ready','declined'].includes(bountifulOriginalDiePhase(row))),confirmed=pending<0?current:current.slice(0,pending)
       if(pending>=0&&(!current[pending]!.rawIssuer||current[pending]!.rawIssuer!.rollId===pool.rawRequestIds[0]))throw Error('opportunity-collector:actual-ready-movement-CON-original-required')
       const replay=confirmed.length?{...plain,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts:confirmed})}:plain
       try{await resolveDnd5ePreparedWithDamageReactions({...options,authorityUnchanged:()=>input.authorityUnchanged()&&options.authorityUnchanged(),roll:request=>journal.roll(request.count,request.sides,request.label,request.targetName,{rollerTokenId:request.rollerTokenId,rollKind:request.kind==='attack-roll'?'attack':request.kind==='saving-throw'?'saving-throw':request.kind==='ability-check'?'ability-check':'other'},actual=>services.rollDice(request.count,request.sides,request.label,request.targetName,actual))},replay,resolveDnd5eOpportunityMoveSequenceOriginal)}catch(error){if(!error||typeof error!=='object')throw error;try{readDnd5eSequenceConcentrationOriginalResult(error,frame,concentrationCheckpoint)}catch{throw error}return error}throw Error('opportunity-collector:actual-native-movement-CON-result-not-reached')
      }})
     },beforePersistentAreaSettlement:input.movementHazards!.beforePersistentAreaSettlement});await journal.finish()
    if(!registered?.complete)await input.gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{...payload,phase:'movement-segment-complete'})
    movementCaps.push(cap);continue
   }
   const next=movement.result
   if(next.status==='complete'){observed=next.result;postNativeReplay=caps.length||movementCaps.length||concentrationOriginals.length||movementOriginals.length||movementConcentrationOriginals.length?issueBountifulOpportunitySequencePostNativeReplay(source.prepared,caps,movementCaps,concentrationOriginals,concentrationPools,{movementOriginals,movementPools,movementConcentrationOriginals,movementConcentrationPools}):undefined;break}
   const fact=readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(next.checkpoint),current=await input.loadPrivateOriginal(),window=current.collectorWindows?.find(row=>row.windowIndex===fact.request.windowIndex&&row.actorId===fact.request.actorTokenId)
   if(!window?.complete||!window.completionSource||window.originalState==='reaction-declined')throw Error('opportunity-collector:actual-completed-post-native-window-required')
   const payload={sourceKind:'opportunity-sequence-v1',parentId:input.action.id,mapId:input.action.mapId,combatId:source.prepared.state.combatId,actorId:window.actorId,windowIndex:window.windowIndex,source:window.completionSource}
   if(!window.postNativeRegistered)await input.gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{...payload,phase:'post-native-register'})
   const journal=createBountifulOpportunitySequencePostNativeDice(next.checkpoint,input.gateway,input.loadPrivateOriginal),services=input.postNative.services,options=input.postNative.options
   const cap=await settleBountifulOpportunitySequencePostNative({checkpoint:next.checkpoint,resolveConcentrationOriginal:async frame=>{
    const original=readDnd5eSequenceConcentrationOriginal(frame,next.checkpoint),consumed=await journal.readConsumedPools(),pools=consumed.slice(-original.raw.length)
    if(pools.length!==original.raw.length||pools.some(row=>row.spec.actorId!==original.actorId||row.spec.rollKind!=='saving-throw'||row.spec.sides!==20||row.spec.count!==1)||!equal(pools.flatMap(row=>row.values??[]),original.raw))throw Error('opportunity-collector:actual-CON-original-pools-required')
    const identity={frame,rawRequestIds:pools.map(row=>row.requestId),ordinal:pools[0]!.spec.ordinal,values:original.raw};concentrationOriginals.push(frame);concentrationPools.push(identity)
    await input.gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase:'post-native-original-register',parentId:input.action.id,mapId:input.action.mapId,combatId:source.prepared.state.combatId,windowIndex:original.windowIndex,actorId:original.actorId,operationId:original.operationId,rawRequestIds:identity.rawRequestIds,mode:original.mode,source:window.completionSource})
    const bundle=issueBountifulOpportunitySequencePostNativeReplay(source.prepared,caps,movementCaps,concentrationOriginals,concentrationPools,{movementOriginals,movementPools,movementConcentrationOriginals,movementConcentrationPools}),probeSource=withBountifulOpportunitySequencePostNativeReplay(source,bundle),replayed=replayReceipts.length?{...probeSource,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts:replayReceipts})}:probeSource,probe=createDnd5eOriginalD20Session(replayed,resolveDnd5eOpportunityMoveSequenceOriginal,original.actorId,'saving-throw')
    let boundary:ReturnType<typeof probe.run>;try{boundary=probe.run(source.prepared.state)}finally{probe.cancel()}
    if(boundary.status==='original-d20-ready')return boundary
    if(boundary.status!=='pending-ally-natural-one'||boundary.request.actorId!==original.actorId||boundary.request.kind!=='saving-throw')throw Error('opportunity-collector:actual-CON-original-boundary-required')
    if(!input.postNative!.originalUi)throw Error('opportunity-collector:actual-CON-original-ui-required')
    if(!receipts.length)await persistBountifulOriginalParent({parentId:input.action.id,source,resolve:resolveDnd5eOpportunityMoveSequenceOriginal,actorId:original.actorId,kind:'saving-throw',opportunitySequencePostNativeReplay:bundle},input.gateway)
    const ready=await driveBountifulOriginalParent({mapId:input.action.mapId,parentId:input.action.id,originalScope:{actorId:original.actorId,kind:'saving-throw'},opportunitySequencePostNativeReplay:bundle},input.gateway,input.postNative!.originalUi)
    source=ready.source as unknown as Source;receipts=rowsFor((await input.gateway.loadResource<Combat>('combat'))??undefined,input.action.id);replayReceipts=receipts
    if(pendingReceipt?.request.kind==='saving-throw'&&pendingReceipt.request.actorId===original.actorId)pendingReceipt=undefined
    const readySource=withBountifulOpportunitySequencePostNativeReplay(source,bundle),readyReplay={...readySource,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts})},readySession=createDnd5eOriginalD20Session(readyReplay,resolveDnd5eOpportunityMoveSequenceOriginal,original.actorId,'saving-throw')
    try{const confirmed=readySession.run(source.prepared.state);if(confirmed.status!=='original-d20-ready'||!equal(confirmed.request.values,ready.request.values))throw Error('opportunity-collector:actual-confirmed-CON-ready-boundary-required');return confirmed}finally{readySession.cancel()}
   },resolveConcentrationResult:async frame=>{
    const operation=readDnd5eSequenceConcentrationOriginal(frame,next.checkpoint),original=concentrationOriginals.at(-1),pool=concentrationPools.at(-1)
    if(!original||!pool||pool.frame!==original||readDnd5eSequenceConcentrationOriginalReplayFacts(original).operationId!==operation.operationId||!equal(operation.raw,pool.values))throw Error('opportunity-collector:actual-final-CON-operation-required')
    const frames=[...concentrationOriginals.slice(0,-1),frame],pools=[...concentrationPools.slice(0,-1),{...pool,frame}],bundle=issueBountifulOpportunitySequencePostNativeReplay(source.prepared,caps,movementCaps,frames,pools,{movementOriginals,movementPools,movementConcentrationOriginals,movementConcentrationPools}),plain=withBountifulOpportunitySequencePostNativeReplay(source,bundle),current=rowsFor((await input.gateway.loadResource<Combat>('combat'))??undefined,input.action.id)
     const pending=current.findIndex(row=>!['ready','declined'].includes(bountifulOriginalDiePhase(row))),confirmed=pending<0?current:current.slice(0,pending)
     // Rebuild only earlier completed operations while a later original awaits its owner.
     // The current operation must itself have a real ready boundary before finalizing.
     if(pending>=0&&(!current[pending]!.rawIssuer||current[pending]!.rawIssuer!.rollId===pool.rawRequestIds[0]))throw Error('opportunity-collector:actual-ready-CON-original-required')
     const replay=confirmed.length?{...plain,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts:confirmed})}:plain
    const furyConReplay=prepareDnd5eStormFuryMoveConcentrationReplay(frame,next.checkpoint,replay)
     try{await resolveDnd5ePreparedWithDamageReactions({...options,...(furyConReplay?{enableStormFuryHit:false}:{}),authorityUnchanged:()=>input.authorityUnchanged()&&options.authorityUnchanged(),roll:request=>journal.roll(request.count,request.sides,request.label,request.targetName,{rollerTokenId:request.rollerTokenId,rollKind:request.kind==='attack-roll'?'attack':request.kind==='saving-throw'?'saving-throw':request.kind==='ability-check'?'ability-check':'other'},actual=>services.rollDice(request.count,request.sides,request.label,request.targetName,actual))},furyConReplay??replay,resolveDnd5eOpportunityMoveSequenceOriginal)}catch(error){
     if(!error||typeof error!=='object')throw error
     try{readDnd5eSequenceConcentrationOriginalResult(error,frame,next.checkpoint)}catch{throw error}
     return error
    }
    throw Error('opportunity-collector:actual-native-CON-result-not-reached')
   },options:{...options,authorityUnchanged:()=>input.authorityUnchanged()&&options.authorityUnchanged(),roll:request=>journal.roll(request.count,request.sides,request.label,request.targetName,{rollerTokenId:request.rollerTokenId,rollKind:request.kind==='attack-roll'?'attack':request.kind==='saving-throw'?'saving-throw':request.kind==='ability-check'?'ability-check':'other'},actual=>services.rollDice(request.count,request.sides,request.label,request.targetName,actual))},services:{...services,
    rollD20:async(label,target,context)=>(await journal.roll(1,20,label,target,{...context,rollKind:context?.rollKind??'saving-throw'},async actual=>[await services.rollD20(label,target,actual)]))[0]!,
    rollD4:async(label,target,context)=>(await journal.roll(1,4,label,target,context,async actual=>[await services.rollD4(label,target,actual)]))[0]!,
    rollDice:(count,sides,label,target,context)=>journal.roll(count,sides,label,target,context,actual=>services.rollDice(count,sides,label,target,actual)),
   }})
   await journal.finish()
   if(!window.postNativeComplete)await input.gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{...payload,phase:'post-native-complete'})
   caps.push(cap)
  }
 }else observed=run()
 if(observed.status==='collector'){const current=readCapturedDnd5eOpportunitySequenceCollectorCheckpoint(observed.checkpoint);if(pendingReceipt&&current.request.actorTokenId!==pendingReceipt.request.actorId)throw Error('opportunity-collector:pending-original-is-not-next-window');const issued=book?.rows.find(row=>row.actorId===current.request.actorTokenId);return{status:'collector'as const,checkpoint:observed.checkpoint,source,postNativeReplay,cursor:issued?.originalIssuer.cursor??Math.max(0,...(book?.rows??[]).map(row=>row.originalIssuer.cursor))+1}}
 if(pendingReceipt)throw Error('opportunity-collector:pending-original-not-reached')
 if(!observed.result.result.ok||!observed.result.application||!input.authorityUnchanged())throw Error('opportunity-collector:actual-complete-native-result-required')
 const replayCheckpoint=(windowIndex:number)=>{
  if(!Number.isSafeInteger(windowIndex)||windowIndex<0||windowIndex>=completed.length)throw Error('opportunity-collector:completed-window-index-required')
  const done:string[]=[],plain=postNativeReplay?withBountifulOpportunitySequencePostNativeReplay(source,postNativeReplay):source
  for(let i=0;i<=windowIndex;i++){
   const captured=captureDnd5eOpportunitySequenceCollectorCheckpoint(input.action.id,done,()=>{
    if(!replayReceipts.length)return resolveDnd5eOpportunityMoveSequenceOriginal(plain)
    const replaySource={...plain,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts:replayReceipts})},session=createDnd5ePreparedDamageCommitSession(replaySource,resolveDnd5eOpportunityMoveSequenceOriginal,()=>false)
    try{const result=session.run(source.prepared.state);if(result.status!=='resolved')throw Error('opportunity-collector:completed-checkpoint-native-required');return result.result}finally{session.cancel()}
   })
   if(captured.status!=='collector')throw Error('opportunity-collector:completed-checkpoint-not-reached')
   const fact=readCapturedDnd5eOpportunitySequenceCollectorCheckpoint(captured.checkpoint);if(fact.request.windowIndex!==i||fact.request.actorTokenId!==completed[i])throw Error('opportunity-collector:completed-window-order-changed');if(i===windowIndex)return captured.checkpoint;done.push(fact.request.actorTokenId)
  }
  throw Error('opportunity-collector:completed-checkpoint-not-reached')
 }
 const completion=Object.freeze({})as BountifulOpportunitySequenceCompletion;completions.set(completion,{roomId:session.roomId,memberId:session.memberId,action:input.action,source,postNativeReplay,resolved:observed.result,signature:JSON.stringify(observed.result),hadBountiful:receipts.length>0,replayCheckpoint,unchanged:input.authorityUnchanged});return{status:'complete'as const,completion}
}
export function readBountifulOpportunitySequenceCompletion(action:SharedPlayerActionState,completion:BountifulOpportunitySequenceCompletion){
 const proof=completions.get(completion),current=host();if(!proof||proof.action!==action||proof.roomId!==current.roomId||proof.memberId!==current.memberId||!proof.unchanged()||JSON.stringify(proof.resolved)!==proof.signature)throw Error('opportunity-collector:exact-live-completion-required')
 return{source:proof.postNativeReplay?withBountifulOpportunitySequencePostNativeReplay(proof.source,proof.postNativeReplay):cloneDnd5eHostTransactionInput(proof.source),resolved:cloneDnd5eHostTransactionInput(proof.resolved),hadBountiful:proof.hadBountiful,authorityUnchanged:proof.unchanged}
}

/** Re-observe the genuine final native recipe at a completed pre-dice window.
 * No caller source/result enters; Base/material continuations remain real brands. */
export function readBountifulOpportunitySequenceCompletedCheckpoint(action:SharedPlayerActionState,completion:BountifulOpportunitySequenceCompletion,windowIndex:number){readBountifulOpportunitySequenceCompletion(action,completion);return completions.get(completion)!.replayCheckpoint(windowIndex)}

/** Reprepare solely from this actual live canonical collector completion. A
 * caller source/clone cannot register an origin, and no fields are dropped.
 * This is mechanical continuity only, never raw, Room or publication authority. */
export function readStormFuryOpportunitySequenceCompletion(action:SharedPlayerActionState,completion:BountifulOpportunitySequenceCompletion){
 const complete=readBountifulOpportunitySequenceCompletion(action,completion),proof=completions.get(completion)!
 const prepared=prepareDnd5eOpportunityMoveSequence(proof.source.prepared.input)
 if(!prepared.ok||!equal(prepared.prepared,proof.source.prepared))throw Error('storm-fury-move:exact-native-completion-repreparation-required')
 const plain={...cloneDnd5eHostTransactionInput(proof.source),prepared:prepared.prepared}
 if(!equal(plain,proof.source)||!proof.unchanged())throw Error('storm-fury-move:unchanged-native-completion-required')
 const source=proof.postNativeReplay?withBountifulOpportunitySequencePostNativeReplay(plain,proof.postNativeReplay):plain
 const postfixes=proof.postNativeReplay?readBountifulOpportunitySequencePostNativeReplay(source)??[]:[],attacks=Object.values(proof.source.attacks).filter(row=>!('reactionDecision'in row))
 return{...complete,source,stormFuryPostfixesComplete:postfixes.length===attacks.length&&postfixes.length>0&&postfixes.every(stormFurySequencePostNativeChecked)}
}
