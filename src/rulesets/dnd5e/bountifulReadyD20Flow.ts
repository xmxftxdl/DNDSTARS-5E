import type {BountifulSpellOriginalInput} from './bountifulSpellTargetRaw'
import {attachBountifulReadySource} from './bountifulReadySource'
import {captureBountifulSpellOriginalReadyFrame,inspectBountifulSpellOriginalReadyFrame,persistBountifulSpellOriginalReadyFrame,readBountifulSpellOriginalReadyFrame,type BountifulReadyParentData} from './bountifulOriginalReadyFrame'
import {bountifulReadyFollowupRollId,readBountifulReadyGenericReplay} from './bountifulReadyGenericReplay'
import {bountifulOriginalRawForActor} from './bountifulSpellTargetRaw'
import {consumeDnd5eBountifulDeferredD20} from './bountifulDeferredD20Mechanics'
import type {OriginalD20Ready} from './allyNaturalOneCheckpoint'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedCombatState,SharedPlayerActionState} from '../../lib/sharedCombatTypes'

type Source=BountifulSpellOriginalInput
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
export interface BountifulReadySelfRerollRequest{
 rollId:string;originalValue:number;dieIndex:number;ready:OriginalD20Ready
 bountifulReadyParent:{frameId:string;rawRollId:string;dieIndex:number}
}
/** A real original-ready frame covers a qualified source before any natural-one
 * receipt exists. It neither manufactures a natural-one request nor lets a
 * generic replacement result enter the original-die stream again. */
export async function continueBountifulSpellReady(input:{action:SharedPlayerActionState;source:Source;actorId:string;kind:'attack'|'saving-throw';authorityUnchanged:()=>boolean},gateway:Gateway,ui:{confirmSelfReroll:(request:BountifulReadySelfRerollRequest)=>Promise<number>}){
 if(!input.authorityUnchanged())throw Error('bountiful-ready-flow:stale-authority')
 input={...input,source:await attachBountifulReadySource(input,gateway)}
 let frame=await captureBountifulSpellOriginalReadyFrame(input,gateway)
 if(!frame)return undefined
 const id=frame.id,combat=await gateway.loadResource<SharedCombatState&{bountifulReadyParents?:Record<string,BountifulReadyParentData>}>('combat')
 if(combat?.bountifulReadyParents?.[id])frame=await readBountifulSpellOriginalReadyFrame({mapId:input.action.mapId,id},gateway)
 else await persistBountifulSpellOriginalReadyFrame(frame,gateway)
 frame=await readBountifulSpellOriginalReadyFrame({mapId:input.action.mapId,id},gateway)
 const facts=await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 const raw=bountifulOriginalRawForActor(facts.source,input.actorId,input.kind,facts.request.originalRolls)
 for(let dieIndex=0;dieIndex<facts.request.originalRolls.length;dieIndex++){
  const current=await readBountifulReadyGenericReplay({mapId:input.action.mapId,frameId:id},gateway)
  if(current.binding.readyFrames?.[0].choices.some(row=>row.dieIndex===dieIndex))continue
  const retained=await ui.confirmSelfReroll({rollId:bountifulReadyFollowupRollId(frame,raw.hostOriginalRollId,dieIndex),originalValue:facts.request.originalRolls[dieIndex],dieIndex,ready:facts.request,bountifulReadyParent:{frameId:id,rawRollId:raw.hostOriginalRollId,dieIndex}})
  const next=await readBountifulReadyGenericReplay({mapId:input.action.mapId,frameId:id},gateway),choice=next.binding.readyFrames?.[0].choices.find(row=>row.dieIndex===dieIndex)
  if(retained!==(choice?.selectedValue??facts.request.originalRolls[dieIndex]))throw Error('bountiful-ready-flow:authenticated-self-choice-required')
 }
 if(!input.authorityUnchanged())throw Error('bountiful-ready-flow:stale-authority')
 const current=await readBountifulReadyGenericReplay({mapId:input.action.mapId,frameId:id},gateway),choices=current.binding.readyFrames?.[0].choices??[]
 const previewState=structuredClone(facts.snapshot),actor=previewState.combatants[input.actorId]
 if(!actor)throw Error('bountiful-ready-flow:actual-actor-required')
 const retainedDice=consumeDnd5eBountifulDeferredD20(actor,input.kind,facts.request.originalRolls,choices,[],new Set(facts.request.finalizedDice),facts.request.rollMode?{rollMode:facts.request.rollMode,attackAbility:facts.request.attackAbility}:undefined)
 return {originalReady:{...facts.request,values:retainedDice,finalizedDice:[...new Set([...facts.request.finalizedDice,...choices.map(row=>row.dieIndex)])]},rawDice:facts.request.originalRolls,retainedDice,previewState,receipts:[],hostOriginalD20Replay:current.binding,hostOriginalReadyFrameId:id}
}
