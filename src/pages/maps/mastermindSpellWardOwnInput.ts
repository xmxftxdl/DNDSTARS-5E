import{readMastermindSpellWardOwnCheckpoint,type MastermindSpellWardOwnCheckpoint}from'./mastermindSpellWardOwnQualifier'
import{readMastermindSpellWardOwnProgress}from'./mastermindSpellWardOwnProgress'
type OwnResponse={ok:true;pending?:boolean;firstHostNow:number;own?:{sourceSignature:string;entries:readonly {id:string;occurrence:number;request:unknown;attempt:number;sourceSignature:string;prefixSignature:string;decision?:{decision:'use'|'decline';memberId:string};raw?:{values:number[];memberId:string};confirmed?:{values:number[];rawValues:number[];memberId:string}}[]}}
const signature=(v:unknown)=>JSON.stringify(v)
async function context(cap:MastermindSpellWardOwnCheckpoint){const bound=await readMastermindSpellWardOwnCheckpoint(cap),{fact,row}=bound.fact;return{bound,fact,row,identity:{parentId:fact.current.parent.id,windowIndex:fact.index,requestId:row.id},send:fact.gateway.source as unknown as<T>(operation:string,input:unknown)=>Promise<T>}}
export async function issueMastermindSpellWardOwnCheckpointInput(cap:MastermindSpellWardOwnCheckpoint){
 const{bound,fact,identity,send}=await context(cap),before=signature([bound.occurrence,bound.request,fact.current.parent.issuedAt]),issued=await send<OwnResponse>('ward-own-register',{...identity,occurrence:bound.occurrence,request:bound.request}),fresh=await readMastermindSpellWardOwnCheckpoint(cap),entry=issued.own?.entries.find(e=>e.occurrence===bound.occurrence)
 if(!issued.ok||issued.firstHostNow!==fact.current.parent.issuedAt||!entry||signature(entry.request)!==signature(bound.request)||before!==signature([fresh.occurrence,fresh.request,fresh.fact.fact.current.parent.issuedAt]))throw Error('spell-ward-own:actual-issued-checkpoint-required')
 return Object.freeze({parentId:identity.parentId,windowIndex:identity.windowIndex,wardRequestId:identity.requestId,ownRequestId:entry.id,occurrence:bound.occurrence,effectTimestamp:issued.firstHostNow,sourceSignature:entry.sourceSignature,prefixSignature:entry.prefixSignature,choiceId:'mm-spell-ward-own-choice:'+entry.id.split(':')[1]+':'+entry.attempt,actorId:bound.request.actorId,characterId:fact.current.p.actor.id,memberId:fresh.fact.row.rollerMemberId,...(entry.decision?{decision:Object.freeze({...entry.decision})}:{}),...(entry.raw?{raw:Object.freeze([...entry.raw.values])}:{}),...(entry.confirmed?{confirmed:Object.freeze([...entry.confirmed.values])}: {})})
}
export async function readMastermindSpellWardOwnCheckpointInput(cap:MastermindSpellWardOwnCheckpoint){const{bound}=await context(cap);return readMastermindSpellWardOwnProgress(bound.original,bound.occurrence,bound.request)}
export async function collectMastermindSpellWardOwnAuthenticatedChoice(cap:MastermindSpellWardOwnCheckpoint){
 const issued=await issueMastermindSpellWardOwnCheckpointInput(cap),{bound,identity,send}=await context(cap);await send<OwnResponse>('ward-own-choice',{...identity,ownRequestId:issued.ownRequestId});return readMastermindSpellWardOwnProgress(bound.original,bound.occurrence,bound.request)
}
export async function recordMastermindSpellWardOwnHostAdoption(cap:MastermindSpellWardOwnCheckpoint,values:readonly number[]){
 const issued=await issueMastermindSpellWardOwnCheckpointInput(cap),{bound,identity,send}=await context(cap)
 if(!Array.isArray(values)||values.length!==1||!Number.isSafeInteger(values[0])||values[0]<1||values[0]>20)throw Error('spell-ward-own:single-d20-adoption-required')
 await send<OwnResponse>('ward-own-confirm',{...identity,ownRequestId:issued.ownRequestId,values:[...values]});return readMastermindSpellWardOwnProgress(bound.original,bound.occurrence,bound.request)
}
