import {continueBountifulSpellReady,type BountifulReadySelfRerollRequest} from './bountifulReadyD20Flow'
import {bountifulConfirmedReplayFacts} from './bountifulConfirmedReplay'
import {bountifulOriginalRawForActor} from './bountifulSpellTargetRaw'
import type {SharedCombatState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {OriginalD20Ready} from './allyNaturalOneCheckpoint'
import {captureBountifulOriginalRawIssuer,bountifulOriginalRollIssuerMode} from './bountifulOriginalRawIssuer'
import {beginBountifulSpellOriginalSave,beginBountifulSpellOriginalAttack} from './bountifulLuckSpellOriginal'
import {bountifulOriginalParentReceiptId} from './bountifulLuckPersistentHost'
import {bountifulDeferredD20RequestId} from './bountifulLuckDeferredD20'
import {consumeDnd5eBountifulDeferredD20} from './bountifulDeferredD20Mechanics'
import {bountifulPreparedReplayFacts} from './bountifulLuckReceipt'

type Base=Parameters<typeof beginBountifulSpellOriginalSave>[0]
type Source=Base['source']&ReturnType<typeof captureBountifulOriginalRawIssuer>&{hostOriginalRollActorId:string;hostOriginalRollKind:'saving-throw'}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type ParentScope={parentId:string;sourceOccurrence:number;dieIndex:number;rawRollId:string}
export async function continueBountifulSpellOriginalSave(input:Omit<Base,'source'>&{source:Source},gateway:Gateway,ui:{original:Parameters<typeof beginBountifulSpellOriginalSave>[2];confirmSelfReroll:(request:{rollId:string;originalValue:number;dieIndex:number;ready:OriginalD20Ready;bountifulParent?:ParentScope;bountifulReadyParent?:BountifulReadySelfRerollRequest['bountifulReadyParent']})=>Promise<number>}){
 const targetRow=input.source.targetSavingThrows?.find(row=>row.targetId===input.actorId)
 const raw=targetRow?(targetRow.d20Second===undefined?[targetRow.d20]:[targetRow.d20,targetRow.d20Second]):input.source.savingThrowD20Second===undefined?[input.source.savingThrowD20]:[input.source.savingThrowD20,input.source.savingThrowD20Second]
 if(raw.some(value=>typeof value!=='number'))throw Error('bountiful-save-flow:actual-primary-save-required')
 const faces=raw.filter((value):value is number=>typeof value==='number')
 const actualRaw=bountifulOriginalRawForActor(input.source,input.actorId,'saving-throw',faces)
 const stage=await beginBountifulSpellOriginalSave(input,gateway,ui.original)
 if(!stage){return continueBountifulSpellReady({...input,kind:'saving-throw'},gateway,ui)}
 const read=async()=>{
  const combat=await gateway.loadResource<SharedCombatState>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)]
  if(!first||first.consumed||first.originalAdapterId!=='spell')throw Error('bountiful-save-flow:actual-private-parent-required')
  return {first,receipts:Object.values(combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===input.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)}
 }
 let current=await read()
 const origin=stage.receipts.filter(row=>row.request.kind==='saving-throw'&&row.request.actorId===input.actorId&&JSON.stringify(row.request.originalRolls)===JSON.stringify(stage.originalReady.originalRolls)).at(-1)
 if(!origin)return continueBountifulSpellReady({...input,kind:'saving-throw'},gateway,ui)
 for(let dieIndex=0;dieIndex<stage.originalReady.values.length;dieIndex++){
  current=await read()
  if(stage.originalReady.finalizedDice.includes(dieIndex)||current.first.postOriginalD20?.some(row=>row.readyOrdinal===stage.originalReady.ordinal&&row.dieIndex===dieIndex))continue
  const parent={parentId:input.action.id,sourceOccurrence:origin.identity.occurrence,dieIndex,rawRollId:actualRaw.hostOriginalRollId}
  const adopted=await ui.confirmSelfReroll({rollId:bountifulDeferredD20RequestId(parent.parentId,parent.rawRollId,parent.sourceOccurrence,dieIndex),originalValue:stage.originalReady.values[dieIndex],dieIndex,ready:stage.originalReady,bountifulParent:parent})
  current=await read()
  const fact=current.first.postOriginalD20?.find(row=>row.readyOrdinal===stage.originalReady.ordinal&&row.dieIndex===dieIndex)
  if(fact?fact.selectedValue!==adopted:adopted!==stage.originalReady.values[dieIndex])throw Error('bountiful-save-flow:authenticated-self-reroll-required')
 }
 current=await read()
 const choices=(current.first.postOriginalD20??[]).filter(row=>row.readyOrdinal===stage.originalReady.ordinal)
 const previewState=structuredClone(stage.previewState),actor=previewState.combatants[input.actorId]
 const retainedDice=consumeDnd5eBountifulDeferredD20(actor,'saving-throw',stage.originalReady.values,choices,[],new Set(stage.originalReady.finalizedDice),stage.originalReady.rollMode?{rollMode:stage.originalReady.rollMode}:undefined)
 return {...stage,retainedDice,previewState,originalReady:{...stage.originalReady,values:retainedDice,finalizedDice:[...new Set([...stage.originalReady.finalizedDice,...choices.map(row=>row.dieIndex)])].sort((a,b)=>a-b)},receipts:current.receipts,
  hostOriginalD20Replay:bountifulConfirmedReplayFacts({parentId:input.action.id,source:input.source,receipts:current.receipts})}
}

type AttackSource=Base['source']&ReturnType<typeof captureBountifulOriginalRawIssuer>&{hostOriginalRollActorId:string;hostOriginalRollKind:'attack'}
export async function continueBountifulSpellOriginalAttack(input:Omit<Base,'source'>&{source:AttackSource},gateway:Gateway,ui:{original:Parameters<typeof beginBountifulSpellOriginalAttack>[2];confirmSelfReroll:(request:{rollId:string;originalValue:number;dieIndex:number;ready:OriginalD20Ready;bountifulParent?:ParentScope;bountifulReadyParent?:BountifulReadySelfRerollRequest['bountifulReadyParent']})=>Promise<number>}){
 if(input.source.hostOriginalRollActorId!==input.actorId||input.source.hostOriginalRollKind!=='attack')throw Error('bountiful-save-flow:foreign-original-roller')
 const raw=input.source.d20Second===undefined?[input.source.d20]:[input.source.d20,input.source.d20Second]
 if(raw.some(value=>typeof value!=='number'))throw Error('bountiful-save-flow:actual-primary-save-required')
 const faces=raw.filter((value):value is number=>typeof value==='number')
 captureBountifulOriginalRawIssuer({mapId:input.action.mapId,parentId:input.action.id,mode:bountifulOriginalRollIssuerMode(input.source),rollId:input.source.hostOriginalRollId,cursor:input.source.hostOriginalDiceCursor,raw:faces})
 const stage=await beginBountifulSpellOriginalAttack(input,gateway,ui.original)
 if(!stage){return continueBountifulSpellReady({...input,kind:'attack'},gateway,ui)}
 const read=async()=>{
  const combat=await gateway.loadResource<SharedCombatState>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)]
  if(!first||first.consumed||first.originalAdapterId!=='spell')throw Error('bountiful-save-flow:actual-private-parent-required')
  return {first,receipts:Object.values(combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===input.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)}
 }
 let current=await read()
 const origin=stage.receipts.filter(row=>row.request.kind==='attack'&&row.request.actorId===input.actorId&&JSON.stringify(row.request.originalRolls)===JSON.stringify(stage.originalReady.originalRolls)).at(-1)
 if(!origin)return continueBountifulSpellReady({...input,kind:'attack'},gateway,ui)
 for(let dieIndex=0;dieIndex<stage.originalReady.values.length;dieIndex++){
  current=await read()
  if(stage.originalReady.finalizedDice.includes(dieIndex)||current.first.postOriginalD20?.some(row=>row.readyOrdinal===stage.originalReady.ordinal&&row.dieIndex===dieIndex))continue
  const parent={parentId:input.action.id,sourceOccurrence:origin.identity.occurrence,dieIndex,rawRollId:input.source.hostOriginalRollId}
  const adopted=await ui.confirmSelfReroll({rollId:bountifulDeferredD20RequestId(parent.parentId,parent.rawRollId,parent.sourceOccurrence,dieIndex),originalValue:stage.originalReady.values[dieIndex],dieIndex,ready:stage.originalReady,bountifulParent:parent})
  current=await read()
  const fact=current.first.postOriginalD20?.find(row=>row.readyOrdinal===stage.originalReady.ordinal&&row.dieIndex===dieIndex)
  if(fact?fact.selectedValue!==adopted:adopted!==stage.originalReady.values[dieIndex])throw Error('bountiful-save-flow:authenticated-self-reroll-required')
 }
 current=await read()
 const choices=(current.first.postOriginalD20??[]).filter(row=>row.readyOrdinal===stage.originalReady.ordinal)
 const previewState=structuredClone(stage.previewState),actor=previewState.combatants[input.actorId]
 const retainedDice=consumeDnd5eBountifulDeferredD20(actor,'attack',stage.originalReady.values,choices,[],new Set(stage.originalReady.finalizedDice),stage.originalReady.rollMode?{rollMode:stage.originalReady.rollMode}:undefined)
 return {...stage,retainedDice,previewState,originalReady:{...stage.originalReady,values:retainedDice,finalizedDice:[...new Set([...stage.originalReady.finalizedDice,...choices.map(row=>row.dieIndex)])].sort((a,b)=>a-b)},receipts:current.receipts,
  hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source:input.source,receipts:current.receipts})}
}
