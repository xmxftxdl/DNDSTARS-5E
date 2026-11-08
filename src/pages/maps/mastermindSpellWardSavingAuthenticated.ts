import{readMastermindSpellWindowDiceRequest}from'./mastermindSpellWindowDiceTransport'
import{completeDnd5eSpellWardSavingReplayChain}from'../../application/combat/dnd5eCombatRules'
import{readMastermindProtectedSpellWardAdoptedInput,type MastermindProtectedSpellWardOriginal}from'./mastermindSpellWindowParent'
import{beginMastermindSpellWardSavingSession,readMastermindSpellWardSavingSession,readMastermindSpellWardSavingCheckpoint,resumeMastermindSpellWardSavingCheckpoint,readMastermindSpellWardSavingSessionInputs,closeMastermindSpellWardSavingSession,type MastermindSpellWardSavingCheckpoint}from'./mastermindSpellWardSavingSession'
import{captureMastermindSpellWardOwnCheckpoint,closeMastermindSpellWardOwnCheckpoint}from'./mastermindSpellWardOwnQualifier'
import{collectMastermindSpellWardOwnPageInput,type MastermindSpellWardOwnPageServices}from'./mastermindSpellWardOwnPageCollector'
import{readMastermindSpellWardOwnProgress}from'./mastermindSpellWardOwnProgress'
import{captureMastermindSpellWardBountifulCheckpoint,issueMastermindSpellWardBountifulCheckpointInput,readMastermindSpellWardBountifulCheckpointInput,completeMastermindSpellWardBountifulCheckpointInput,readMastermindSpellWardBountifulInputAttestation,closeMastermindSpellWardBountifulCheckpoint,type MastermindSpellWardBountifulInputAttestation}from'./mastermindSpellWardBountifulCheckpoint'

const ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,ordered(x)])):v
const signature=(v:unknown)=>JSON.stringify(ordered(v))
type Trace=Awaited<ReturnType<typeof readMastermindSpellWardSavingSessionInputs>>
type Locked=Awaited<ReturnType<typeof readMastermindProtectedSpellWardAdoptedInput>>
type Identity={parentId:string;windowIndex:number;step:number;requestId:string}
type Witnesses=ReadonlyMap<number,MastermindSpellWardBountifulInputAttestation>
const authenticated=new WeakMap<object,{original:MastermindProtectedSpellWardOriginal;trace:Trace;progress:string;identity:Identity;witnesses:Witnesses}>()
function inputSnapshot(locked:Locked){const{fact,row,saving}=locked;return signature({parentId:fact.current.parent.id,T1:fact.current.parent.issuedAt,index:fact.index,step:fact.step,row,saving,frame:{prepared:fact.view.prepared,state:fact.view.state,events:fact.view.events}})}

/** Every family record must correspond to one visited actual Native pending.
 * Input witnesses never stand in for the sole final mechanical Saving replay. */
async function verify(original:MastermindProtectedSpellWardOriginal,trace:Trace,witnesses:Witnesses){
 const locked=await readMastermindProtectedSpellWardAdoptedInput(original)
 const row=locked.row as typeof locked.row&{own?:{entries?:{occurrence:number}[]};bountifulContinuations?:{occurrence:number;book:unknown}[]},ownTrace=trace.map((entry,occurrence)=>({entry,occurrence})).filter(({entry})=>entry.request.nativeLucky),bTrace=trace.map((entry,occurrence)=>({entry,occurrence})).filter(({entry})=>!entry.request.nativeLucky)
 const bOrdinals=[...(row.bountiful?[0]:[]),...(row.bountifulContinuations??[]).map(entry=>entry.occurrence)]
 if(!trace.length||(row.own?.entries?.length??0)!==ownTrace.length||bOrdinals.length!==bTrace.length||witnesses.size!==bTrace.length||signature(bOrdinals)!==signature(bTrace.map(entry=>entry.occurrence)))throw Error('spell-ward-saving:exact-visited-family-inputs-required')
 for(let i=0;i<ownTrace.length;i++){const{entry,occurrence}=ownTrace[i];if(row.own!.entries![i].occurrence!==occurrence)throw Error('spell-ward-saving:exact-ordered-own-inputs-required');const progress=await readMastermindSpellWardOwnProgress(original,occurrence,entry.request);if(progress.status!=='ready'||signature(progress.choice)!==signature(entry.choice))throw Error('spell-ward-saving:authenticated-native-choice-required')}
 for(const{entry,occurrence}of bTrace){const witness=witnesses.get(occurrence);if(!witness)throw Error('spell-ward-saving:authenticated-native-b-witness-required');const progress=await readMastermindSpellWardBountifulInputAttestation(witness);if(progress.occurrence!==occurrence||signature(progress.request)!==signature(entry.request)||progress.status!=='ready'||signature(progress.choice)!==signature(entry.choice))throw Error('spell-ward-saving:authenticated-native-b-choice-required')}
 const after=await readMastermindProtectedSpellWardAdoptedInput(original);if(inputSnapshot(after)!==inputSnapshot(locked))throw Error('spell-ward-saving:unchanged-protected-progress-required');return locked
}
async function collectB(checkpoint:MastermindSpellWardSavingCheckpoint,services?:MastermindSpellWardOwnPageServices){
 const cap=await captureMastermindSpellWardBountifulCheckpoint(checkpoint)
 try{await issueMastermindSpellWardBountifulCheckpointInput(cap);for(;;){const progress=await readMastermindSpellWardBountifulCheckpointInput(cap);if(progress.status==='ready'){const witness=await completeMastermindSpellWardBountifulCheckpointInput(cap),fresh=await readMastermindSpellWardBountifulInputAttestation(witness);if(signature(fresh.request)!==signature(progress.request)||signature(fresh.choice)!==signature(progress.choice))throw Error('spell-ward-saving:unchanged-authenticated-b-input-required');return{choice:fresh.choice,witness}}
  // Existing unauthenticated later-B callers retain their fail-closed guard.
  // Only ready private input or a real UI collection can advance this family.
  if(!services){if(progress.occurrence>0)throw Error('spell-ward-saving:authenticated-later-b-prefix-required');throw Error('spell-ward-saving:actual-authenticated-b-input-required')}
  if(progress.phase==='awaiting-raw'||progress.phase==='raw'){const pool=await readMastermindSpellWindowDiceRequest('mm-spell-ward-bountiful-pool:'+progress.book.id.split(':')[1],progress.locked.fact.gateway.source);if(!pool)throw Error('spell-ward-saving:actual-b-physical-pool-required');if(!pool.confirmed)await services.physical(pool)}else await services.wait()
 }}finally{closeMastermindSpellWardBountifulCheckpoint(cap)}
}
/** Actual pending Session, controller answer, separate raw and Host adoption
 * precede the existing sole Saving replay; no caller trace or UI choice enters. */
async function runAuthenticatedOwn(original:MastermindProtectedSpellWardOriginal,services?:MastermindSpellWardOwnPageServices){
 const session=await beginMastermindSpellWardSavingSession(original),witnesses=new Map<number,MastermindSpellWardBountifulInputAttestation>()
 try{for(let count=0;count<=64;count++){
  const stage=await readMastermindSpellWardSavingSession(session)
  if(stage.status==='resolved'){const trace=await readMastermindSpellWardSavingSessionInputs(session),locked=await verify(original,trace,witnesses),progress=inputSnapshot(locked),cap=await completeDnd5eSpellWardSavingReplayChain(locked.fact.frame,locked.saving,trace),after=await verify(original,trace,witnesses);if(inputSnapshot(after)!==progress)throw Error('spell-ward-saving:unchanged-protected-progress-required');authenticated.set(cap,{original,trace,progress,witnesses:new Map(witnesses),identity:{parentId:locked.fact.current.parent.id,windowIndex:locked.fact.index,step:locked.fact.step??0,requestId:locked.row.id}});return cap}
  const actual=await readMastermindSpellWardSavingCheckpoint(stage.checkpoint)
  if(!actual.request.nativeLucky){const progress=await collectB(stage.checkpoint,services);witnesses.set(actual.occurrence,progress.witness);await resumeMastermindSpellWardSavingCheckpoint(stage.checkpoint,progress.choice);continue}
  let progress=await readMastermindSpellWardOwnProgress(original,actual.occurrence,actual.request)
  if(progress.status!=='ready'){if(!services)throw Error('spell-ward-saving:actual-authenticated-own-input-required');const own=await captureMastermindSpellWardOwnCheckpoint(original,actual.pending);try{await collectMastermindSpellWardOwnPageInput(own,services);progress=await readMastermindSpellWardOwnProgress(original,actual.occurrence,actual.request)}finally{closeMastermindSpellWardOwnCheckpoint(own)}}
  if(progress.status!=='ready')throw Error('spell-ward-saving:actual-authenticated-own-input-required');await resumeMastermindSpellWardSavingCheckpoint(stage.checkpoint,progress.choice)
 }throw Error('spell-ward-saving:bounded-native-occurrences-required')}finally{closeMastermindSpellWardSavingSession(session)}
}
/** Fresh private-book and authored-Full reads remain mandatory after replay. */
export async function readMastermindAuthenticatedSpellWardOwn(cap:object){const issued=authenticated.get(cap);if(!issued)throw Error('spell-ward-saving:actual-authenticated-own-replay-required');const locked=await verify(issued.original,issued.trace,issued.witnesses);if(inputSnapshot(locked)!==issued.progress)throw Error('spell-ward-saving:unchanged-protected-progress-required');return Object.freeze({...issued.identity})}
export function collectMastermindAuthenticatedSpellWardOwn(original:MastermindProtectedSpellWardOriginal,services:MastermindSpellWardOwnPageServices){return runAuthenticatedOwn(original,services)}
export function completeMastermindAuthenticatedSpellWardOwn(original:MastermindProtectedSpellWardOriginal){return runAuthenticatedOwn(original)}
export function hasMastermindAuthenticatedSpellWardOwn(cap:object){return authenticated.has(cap)}

