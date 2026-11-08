import type{Dnd5eDamageCommitSessionResult}from'../../application/combat/dnd5eSpellWardOwn'
import{readMastermindProtectedSpellWardAdoptedInput,type MastermindProtectedSpellWardOriginal}from'./mastermindSpellWindowParent'
import{readDnd5eActualOriginalAllyBoundary,readDnd5eActualSpellWardSavingProbe,resolveDnd5eSpellWardSavingProbe,readCapturedDnd5ePreparedSpellAttackWindow,dnd5eRulesPluginRegistrySnapshot}from'../../application/combat/dnd5eSpellWardOwn'
export interface MastermindSpellWardOwnCheckpoint{readonly mastermindSpellWardOwnCheckpoint:unique symbol}
type Fact=Awaited<ReturnType<typeof readMastermindProtectedSpellWardAdoptedInput>>
type Stage=Extract<Dnd5eDamageCommitSessionResult<unknown>,{status:'pending-ally-natural-one'}>
const checkpoints=new WeakMap<object,{original:MastermindProtectedSpellWardOriginal;stage:Stage;registry:number;signature:string;request:string;occurrence:number;closed:boolean}>()
const signature=(v:unknown)=>JSON.stringify(v)
function frameSignature(fact:Fact){const{fact:f,row,saving}=fact;return signature([f.current.parent.id,f.current.parent.issuedAt,f.index,f.step,row.id,(row as typeof row&{sourceSignature:string}).sourceSignature,row.raw,row.confirmed,saving,f.view.prepared,f.view.state,f.view.events])}
async function inspect(original:MastermindProtectedSpellWardOriginal,stage:Stage){
 const locked=await readMastermindProtectedSpellWardAdoptedInput(original),{fact,row,saving}=locked
 if(!stage||typeof stage!=='object'||stage.status!=='pending-ally-natural-one'||!stage.request||!stage.request.nativeLucky||stage.request.actorId!==fact.current.p.actorToken.id||stage.request.kind!=='saving-throw'||stage.request.options.length!==1||stage.request.options[0].ownerId!==stage.request.actorId||stage.request.options[0].featureId!=='dnd5e-racial-halfling-lucky'||stage.request.originalRolls.length!==row.count||stage.request.originalRolls[stage.request.dieIndex]!==1)throw Error('spell-ward-own:actual-native-own-checkpoint-required')
 const actual=readDnd5eActualOriginalAllyBoundary(stage),source=readDnd5eActualSpellWardSavingProbe(actual.input),view=readCapturedDnd5ePreparedSpellAttackWindow(source.frame)
 if(actual.resolve!==resolveDnd5eSpellWardSavingProbe||source.clock!==fact.current.parent.issuedAt||source.parentId!==fact.view.parentId||source.attackIndex!==fact.index||source.step!==fact.step||source.actorId!==stage.request.actorId||source.effectId!==saving.effectId||signature(source.saving)!==signature({...saving,targetId:stage.request.actorId})||signature([view.prepared,view.state,view.events])!==signature([fact.view.prepared,fact.view.state,fact.view.events]))throw Error('spell-ward-own:same-protected-saving-source-required')
 return locked
}
/** Mechanical checkpoint provenance only. A separate authenticated Own input
 * row, actual controller and physical/adopted pool are required before use.
 * The real coordinator must close this lease when its pending Session ends. */
export async function captureMastermindSpellWardOwnCheckpoint(original:MastermindProtectedSpellWardOriginal,pending:unknown):Promise<MastermindSpellWardOwnCheckpoint>{
 const stage=pending as Stage,fact=await inspect(original,stage),cap=Object.freeze({})as MastermindSpellWardOwnCheckpoint
 checkpoints.set(cap,{original,stage,registry:dnd5eRulesPluginRegistrySnapshot(),signature:frameSignature(fact),request:signature(stage.request),occurrence:stage.occurrence,closed:false});return cap
}
export async function readMastermindSpellWardOwnCheckpoint(cap:MastermindSpellWardOwnCheckpoint){
 const bound=checkpoints.get(cap);if(!bound||bound.closed||bound.registry!==dnd5eRulesPluginRegistrySnapshot())throw Error('spell-ward-own:actual-current-checkpoint-required')
 const fact=await inspect(bound.original,bound.stage);if(bound.signature!==frameSignature(fact)||bound.request!==signature(bound.stage.request)||bound.occurrence!==bound.stage.occurrence)throw Error('spell-ward-own:changed-native-checkpoint')
 return Object.freeze({original:bound.original,occurrence:bound.occurrence,request:structuredClone(bound.stage.request),fact})
}
export function closeMastermindSpellWardOwnCheckpoint(cap:MastermindSpellWardOwnCheckpoint){const bound=checkpoints.get(cap);if(!bound)throw Error('spell-ward-own:actual-current-checkpoint-required');bound.closed=true}
