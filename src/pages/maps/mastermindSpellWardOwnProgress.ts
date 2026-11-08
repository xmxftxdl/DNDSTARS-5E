import{readMastermindProtectedSpellWardAdoptedInput,type MastermindProtectedSpellWardOriginal}from'./mastermindSpellWindowParent'
import{validSpellWardOwn,spellWardOwnInputChoice,spellWardOwnOrderedSignature}from'../../../shared/mastermind-spell-ward-own.mjs'
const signature=spellWardOwnOrderedSignature as(value:unknown)=>string
export type MastermindSpellWardOwnProgress={status:'absent'|'waiting'|'ready';choice?:Readonly<{ownerId:string;featureId:string;replacement:number}>;progressSignature:string}
/** Decodes authenticated input evidence only. The shared genuine Session must
 * compare this full request at the actual occurrence before using the choice. */
export async function readMastermindSpellWardOwnProgress(original:MastermindProtectedSpellWardOriginal,occurrence:number,actualRequest:unknown):Promise<MastermindSpellWardOwnProgress>{
 const{fact,row}=await readMastermindProtectedSpellWardAdoptedInput(original),own=(row as unknown as{own?:unknown}).own
 if(!Number.isSafeInteger(occurrence)||occurrence<0||!validSpellWardOwn(own,row,fact.current.parent))throw Error('spell-ward-own:actual-protected-input-required')
 const progressSignature=signature({parentId:fact.current.parent.id,clock:fact.current.parent.issuedAt,windowIndex:fact.index,step:fact.step,requestId:row.id,raw:row.raw,confirmed:row.confirmed,own})
 if(!own)return{status:'absent',progressSignature}
 const entry=(own as{entries:Record<string,unknown>[]}).entries.find(e=>e.occurrence===occurrence)
 if(!entry)return{status:'absent',progressSignature}
 if(signature(entry.request)!==signature(actualRequest))throw Error('spell-ward-own:exact-native-occurrence-required')
 const result=spellWardOwnInputChoice(entry)as{ready:boolean;choice?:{ownerId:string;featureId:string;replacement:number}}|undefined
 return result?.ready?Object.freeze({status:'ready' as const,...(result.choice?{choice:Object.freeze({...result.choice})}:{}),progressSignature}):{status:'waiting',progressSignature}
}
