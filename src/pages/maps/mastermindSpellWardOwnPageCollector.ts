import{readMastermindSpellWardOwnCheckpoint,type MastermindSpellWardOwnCheckpoint}from'./mastermindSpellWardOwnQualifier'
import{issueMastermindSpellWardOwnCheckpointInput,collectMastermindSpellWardOwnAuthenticatedChoice,readMastermindSpellWardOwnCheckpointInput}from'./mastermindSpellWardOwnInput'
import{readMastermindSpellWardOwnDiceRequest}from'./mastermindSpellWardOwnDiceTransport'
import type{MastermindSpellWindowDiceRequest}from'./mastermindSpellWindowDiceTransport'
export interface MastermindSpellWardOwnChoiceRequest{
 id:string;transactionId:string;mapId:string;actorCharId:string;pluginId:string;featureId:string;featureName:string;prompt:string;audience:'actor';options:{id:string;label:string}[];defaultOptionId:string;phase:'after-save';context:{wardOwnBinding:{parentId:string;wardRequestId:string;ownRequestId:string;occurrence:number;effectTimestamp:number;sourceSignature:string;prefixSignature:string}}
}
export interface MastermindSpellWardOwnPageServices{
 choice:(request:MastermindSpellWardOwnChoiceRequest)=>Promise<unknown>;
 physical:(request:Readonly<Omit<MastermindSpellWindowDiceRequest,'raw'|'confirmed'>>&{readonly raw?:readonly number[];readonly confirmed?:readonly number[]})=>Promise<void>;
 wait:()=>Promise<void>;
}
/** Returned UI values never become saving inputs. Only the current family's
 * authenticated choice and independent adopted original are reread. */
export async function collectMastermindSpellWardOwnPageInput(cap:MastermindSpellWardOwnCheckpoint,services:MastermindSpellWardOwnPageServices){
 for(;;){
  const issued=await issueMastermindSpellWardOwnCheckpointInput(cap),bound=await readMastermindSpellWardOwnCheckpoint(cap),{fact}=bound.fact
  if(!issued.decision){
   await services.choice({id:issued.choiceId,transactionId:issued.parentId,mapId:fact.current.p.map.id,actorCharId:issued.characterId,pluginId:'dnd5e-2014-srd-5.1',featureId:'dnd5e-racial-halfling-lucky',featureName:'幸运',prompt:'是否使用幸运重掷这枚豁免骰？',audience:'actor',options:[{id:'pending',label:'继续等待'},{id:'decline',label:'保留原骰'},{id:'use',label:'使用幸运'}],defaultOptionId:'pending',phase:'after-save',context:{wardOwnBinding:{parentId:issued.parentId,wardRequestId:issued.wardRequestId,ownRequestId:issued.ownRequestId,occurrence:issued.occurrence,effectTimestamp:issued.effectTimestamp,sourceSignature:issued.sourceSignature,prefixSignature:issued.prefixSignature}}})
   const choice=await collectMastermindSpellWardOwnAuthenticatedChoice(cap);if(choice.status==='ready')return choice
   if(!choice.choice){await services.wait();continue}
  }
  const progress=await readMastermindSpellWardOwnCheckpointInput(cap);if(progress.status==='ready')return progress
  const fresh=await issueMastermindSpellWardOwnCheckpointInput(cap)
  if(fresh.decision?.decision!=='use'){await services.wait();continue}
  let request=await readMastermindSpellWardOwnDiceRequest(fresh.ownRequestId,fact.gateway.source)
  if(!request||request.parentId!==issued.parentId||request.windowIndex!==issued.windowIndex||request.rollerTokenId!==issued.actorId||request.rollerCharacterId!==issued.characterId)throw Error('spell-ward-own-page:actual-same-checkpoint-pool-required')
  if(!request.confirmed)await services.physical(Object.freeze({...request,...(request.raw?{raw:Object.freeze([...request.raw])}:{}),...(request.confirmed?{confirmed:Object.freeze([...request.confirmed])}:{})}))
  request=await readMastermindSpellWardOwnDiceRequest(fresh.ownRequestId,fact.gateway.source)
  if(!request?.confirmed)throw Error('spell-ward-own-page:independent-host-adoption-required')
  const complete=await readMastermindSpellWardOwnCheckpointInput(cap);if(complete.status!=='ready')throw Error('spell-ward-own-page:completed-authenticated-input-required');return complete
 }
}
