import {validBountifulHostOperation} from '../../../shared/bountiful-host-operation.mjs'
import {recoverBountifulHostOperation,readBountifulHostMonsterOriginalReady} from './bountifulHostOperationPersistent'
import {bountifulNativeExtraDiceRoute,bountifulIssuedHostOperation} from './bountifulHostOperation'
import {saveBountifulPhase} from './bountifulPhaseCommit'
import {assertBountifulOriginalSceneScope} from './bountifulOriginalSceneScope'
import {bountifulOriginalScopeMatches} from '../../../shared/bountiful-original-scope.mjs'
import {bountifulOriginalRawForActor} from './bountifulSpellTargetRaw'
import type {D20ChoiceRerollInterruptContribution} from '../../lib/combatInterruptQueue'
import {validateBountifulD20ParentFollowup} from '../../../shared/bountiful-d20-host-gate.mjs'
import {consumeDnd5eBountifulDeferredD20} from './bountifulDeferredD20Mechanics'
import {DND5E_CORE_INSPIRATION_RESOURCE_KEY} from '../../lib/d20InterruptPolicy'
import {bountifulOriginalRollIssuerMode} from './bountifulOriginalRawIssuer'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedCombatState} from '../../lib/sharedCombatTypes'
import type {Character} from '../../types/character'
import {getRoomSession} from '../../lib/roomSession'
import {COMBAT_INTERRUPT_RESOURCE,finishCombatInterrupt,type SharedCombatInterruptQueueState} from '../../lib/combatInterruptQueue'
import {isCombatInterruptKind,type RollConfirmationInterruptResponse} from '../../lib/combatInterruptProtocol'
import {durableD20RollId,settleD20RollConfirmation} from '../../lib/rollConfirmation'
import {dnd5eCoreInspirationChoiceRerollOption} from '../../lib/d20InterruptPolicy'
import {dnd5eD20ChoiceRerollFeaturesForCharacter} from './pluginApi'
import {readBountifulOriginalSource} from './bountifulLuckPersistentRoomDriver'
import {resumeBountifulOriginalParent} from './bountifulLuckPersistedReplay'
import {bountifulOriginalParentReceiptId} from './bountifulLuckPersistentHost'
import {decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'
import {validateBountifulDeferredD20Choices} from '../../../shared/bountiful-deferred-d20.mjs'

export interface BountifulDeferredD20Scope{parentId:string;sourceOccurrence:number;dieIndex:number}
export interface BountifulDeferredD20Choice extends BountifulDeferredD20Scope{
 schemaVersion:1;kind:'choice-reroll';readyOrdinal:number;actorId:string;characterId:string;rawRollId:string
 interruptId:string;contributionId:string;originalValue:number;selectedValue:number
 rerollValues:readonly number[];selectedIndex:number
 selectionPolicy:'owner-chooses'|'highest'|'lowest'|'must-use-latest'
 featureId:string;resourceCosts:readonly {resourceKey:string;amount:number}[]
}
/** Mechanical fields shared by two separately authenticated origins. A ready
 * frame is not a natural-one receipt and never has a sourceOccurrence. */
export type BountifulMechanicalD20Choice=Omit<BountifulDeferredD20Choice,'sourceOccurrence'>
export type BountifulReadyD20Choice=BountifulMechanicalD20Choice&{readyFrameId:string}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Snapshot<T>=T&{_sync?:{revision?:number}}
type Combat=SharedCombatState&{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
export function bountifulDeferredD20RequestId(parentId:string,rawRollId:string,sourceOccurrence:number,dieIndex:number){
 if(!parentId||parentId.length>500||!rawRollId||rawRollId.length>1000||!Number.isSafeInteger(sourceOccurrence)||sourceOccurrence<0||!Number.isSafeInteger(dieIndex)||dieIndex<0||dieIndex>1)throw Error('bountiful-followup:invalid-request-lineage')
 return JSON.stringify(['bountiful-parent-d20-followup',parentId,sourceOccurrence,rawRollId,dieIndex])
}
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right)
const revision=(value:Snapshot<object>|null)=>value?._sync?.revision??0
const host=()=>{const value=getRoomSession();if(!value||value.role!=='dm')throw Error('bountiful-followup:host-required');return value}

/** Only the real generic d20 committer enters here, by existing request IDs.
 * Read the actual completed BL source and actual persisted reroll contribution.
 * This journals the choice and closes its prompt; no character cost or HP is
 * published until the original parent's final ACK consumes this exact fact. */
export async function deferBountifulD20Choice(input:{mapId:string;interruptId:string;acceptedContributionId:string;now?:number;deferToParent:BountifulDeferredD20Scope},gateway:Gateway):Promise<RollConfirmationInterruptResponse>{
 const session=host(),scope=input.deferToParent
 if(!scope.parentId||!Number.isSafeInteger(scope.sourceOccurrence)||scope.sourceOccurrence<0||scope.sourceOccurrence>511||!Number.isSafeInteger(scope.dieIndex)||scope.dieIndex<0||scope.dieIndex>1)throw Error('bountiful-followup:invalid-scope')
 const [combat,characters,maps,geometry,requests,queue]=await Promise.all([
  gateway.loadResource<Snapshot<Combat>>('combat'),gateway.loadResource<Snapshot<{characters:Character[]}>>('characters'),
  gateway.loadResource<Snapshot<object>>('maps'),gateway.loadResource<Snapshot<object>>('map-geometry'),
  gateway.loadResource<Snapshot<{requests:unknown[]}>>('player-action-requests'),gateway.loadResource<Snapshot<SharedCombatInterruptQueueState>>(COMBAT_INTERRUPT_RESOURCE)])
 const current=host();if(current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('bountiful-followup:host-changed')
 const first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(scope.parentId,0)]
 const nativeCapability=first&&!first.consumed&&validBountifulHostOperation(first.originalRoomAction)?await recoverBountifulHostOperation(scope.parentId,gateway):undefined
 const nativeOriginal=nativeCapability?bountifulIssuedHostOperation(nativeCapability):undefined
 if(first?.consumed||nativeOriginal&&first?.postOriginalD20?.some(row=>row.interruptId===input.interruptId&&row.contributionId===input.acceptedContributionId)){
  const prompt=queue?.interrupts.find(row=>row.id===input.interruptId)
  const fact=first.postOriginalD20?.find(row=>row.interruptId===input.interruptId&&row.contributionId===input.acceptedContributionId)
  const origin=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(scope.parentId,scope.sourceOccurrence)]
  const ack=await gateway.loadResource<import('../../lib/sharedCombatTypes').SharedPlayerActionAckState>('player-action-ack')
  const currentHost=host()
  const nativeCompleted=validBountifulHostOperation(first.originalRoomAction)&&first.consumed?.transactionId===scope.parentId&&Object.values(combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===scope.parentId).every(row=>row.consumed?.transactionId===scope.parentId&&same(row.consumed.result,first.consumed?.result))
  const completionEvidence=!!nativeOriginal||nativeCompleted||!!ack&&ack.status==='accepted'&&ack.actionId===scope.parentId&&ack.mapId===input.mapId&&ack.combatId===first.originalRoomAction.combatId
  if(currentHost.roomId!==session.roomId||currentHost.memberId!==session.memberId||first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId||first.identity.mapId!==input.mapId||!validateBountifulOriginalParents(combat?.bountifulOriginalParents)||!origin||!fact||fact.parentId!==scope.parentId||fact.sourceOccurrence!==scope.sourceOccurrence||fact.dieIndex!==scope.dieIndex||fact.actorId!==origin.request.actorId||fact.characterId!==origin.identity.roller.characterId||!queue||queue.mapId!==input.mapId||!prompt||!isCombatInterruptKind(prompt,'roll-confirmation')||prompt.status!=='done'||prompt.actorCharId!==fact.characterId||prompt.payload.rollId!==bountifulDeferredD20RequestId(scope.parentId,fact.rawRollId,scope.sourceOccurrence,scope.dieIndex)||prompt.payload.bountifulParent?.parentId!==scope.parentId||prompt.payload.bountifulParent.rawRollId!==fact.rawRollId||prompt.payload.bountifulParent.sourceOccurrence!==scope.sourceOccurrence||prompt.payload.bountifulParent.dieIndex!==scope.dieIndex||!completionEvidence)throw Error('bountiful-followup:completed-parent-evidence-required')
  const response=prompt.response,choice=response?.choiceReroll
  if(!response||response.acceptedContributionId!==fact.contributionId||response.finalValue!==fact.selectedValue||!choice||choice.characterId!==fact.characterId||choice.featureId!==fact.featureId||choice.originalValue!==fact.originalValue||choice.selectedValue!==fact.selectedValue||choice.selectedIndex!==fact.selectedIndex||choice.selectionPolicy!==fact.selectionPolicy||!same(choice.rerollValues,fact.rerollValues)||!same(choice.resourceCosts,fact.resourceCosts))throw Error('bountiful-followup:changed-completed-choice')
  return structuredClone(response)
 }

 if(!combat||!characters||!maps||!requests||!queue||queue.mapId!==input.mapId||!first||first.consumed||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||
  first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId||first.identity.mapId!==input.mapId||!bountifulOriginalScopeMatches(combat,first.identity)||
  !same(combat.dnd5eTurnEconomyByToken??{},JSON.parse(first.identity.reactionEconomySignature))||!(nativeOriginal||requests.requests.some(row=>same(row,first.originalRoomAction))))throw Error('bountiful-followup:real-private-parent-required')
 await assertBountifulOriginalSceneScope(combat,first.identity,gateway)
 const reads:Record<string,number>={characters:revision(characters),maps:revision(maps),'map-geometry':revision(geometry),...(first.identity.sceneScope?{'campaign-time':first.identity.sceneScope.campaignTimeRevision}:{})}
 if(Object.entries(first.identity.revisions).some(([key,value])=>reads[key]!==value))throw Error('bountiful-followup:stale-original-resources')
 const rows=Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===scope.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 const origin=rows.find(row=>row.identity.occurrence===scope.sourceOccurrence)
 if(!origin||scope.dieIndex>=origin.request.originalRolls.length)throw Error('bountiful-followup:original-die-required')
 for(const row of rows){
  const decision=decisionFromBountifulOriginalDieReceipt(row,row.request)
  if(row.request.actorId===origin.request.actorId&&row.request.dieIndex===scope.dieIndex&&(decision||row.request.nativeLucky))throw Error('bountiful-followup:original-die-already-replaced')
 }
 const ordinaryOriginal=nativeOriginal?undefined:await readBountifulOriginalSource(first,{includeContinuation:true})
 const originalSource=nativeOriginal?.source??ordinaryOriginal?.source
 if(!originalSource)throw Error('bountiful-followup:real-private-parent-required')
 const scopedRaw=first.originalAdapterId==='spell'?bountifulOriginalRawForActor(originalSource,origin.request.actorId,origin.request.kind,origin.request.originalRolls):undefined
 const ordinaryRaw=ordinaryOriginal?.source
 const rawRollId=nativeOriginal?.operation.rawRollId??scopedRaw?.hostOriginalRollId??ordinaryRaw?.hostOriginalRollId,cursor=nativeOriginal?.operation.rawCursor??scopedRaw?.hostOriginalDiceCursor??ordinaryRaw?.hostOriginalDiceCursor
 if(typeof rawRollId!=='string'||!Number.isSafeInteger(cursor)||typeof cursor!=='number'||cursor<1)throw Error('bountiful-followup:host-raw-lineage-required')
 const minted=durableD20RollId({mapId:input.mapId,sourceMode:nativeOriginal?'dm':scopedRaw?.hostOriginalRollIssuerMode??bountifulOriginalRollIssuerMode(originalSource),transactionId:scope.parentId,occurrenceIndex:cursor-1})
 if(rawRollId!==minted&&rawRollId!==minted+':pool:'+origin.request.originalRolls.length+'d20')throw Error('bountiful-followup:foreign-raw-lineage')
 const ready=nativeOriginal?await readBountifulHostMonsterOriginalReady(scope.parentId,gateway):ordinaryOriginal?resumeBountifulOriginalParent({...ordinaryOriginal,parentId:scope.parentId,actorId:origin.request.actorId,kind:origin.request.kind,receipts:rows}):undefined
 if(!ready||ready.status!=='original-d20-ready'||ready.request.actorId!==origin.request.actorId||ready.request.kind!==origin.request.kind)throw Error('bountiful-followup:original-decision-not-ready')
 // The actual resolver, not UI or the number of dice, supplies the mode and
 // attack ability. An independent original die remains eligible; confirmed
 // BL/native replacements were rejected above by their exact die index.
 const rollMode=ready.request.rollMode??(ready.request.values.length===1?'normal':undefined)
 if(!rollMode||ready.request.values.length!==(rollMode==='normal'?1:2)||scope.dieIndex>=ready.request.values.length)throw Error('bountiful-followup:actual-roll-mode-required')
 if(ready.request.finalizedDice.includes(scope.dieIndex))throw Error('bountiful-followup:original-die-already-replaced')
 const prompt=queue.interrupts.find(row=>row.id===input.interruptId)
 if(!prompt||!isCombatInterruptKind(prompt,'roll-confirmation')||prompt.status==='rolled-back'||prompt.actorCharId!==origin.identity.roller.characterId||(prompt.payload.bountifulParent
    ?prompt.payload.bountifulParent.parentId!==scope.parentId||prompt.payload.bountifulParent.sourceOccurrence!==scope.sourceOccurrence||prompt.payload.bountifulParent.dieIndex!==scope.dieIndex||prompt.payload.bountifulParent.rawRollId!==rawRollId||prompt.payload.rollId!==bountifulDeferredD20RequestId(scope.parentId,rawRollId,scope.sourceOccurrence,scope.dieIndex)
    :prompt.payload.rollId!==rawRollId+':0')||prompt.transactionId!=='d20-confirmation:'+prompt.payload.rollId||prompt.payload.originalValue!==ready.request.values[scope.dieIndex])throw Error('bountiful-followup:authenticated-original-request-required')
 const contribution=prompt.contributions?.find(row=>row.id===input.acceptedContributionId)
 if(!contribution||contribution.kind!=='choice-reroll'||contribution.decision!=='use'||contribution.characterId!==origin.identity.roller.characterId)throw Error('bountiful-followup:authenticated-contribution-required')
 const response=settleD20RollConfirmation(prompt,contribution.id,prompt.status==='done'?prompt.updatedAt:input.now??Date.now(),undefined,undefined,undefined,contribution.selectedIndex)
 const selected=response.choiceReroll,owner=characters.characters.find(row=>row.id===contribution.characterId)
 if(!selected||!owner||selected.scope!=='self-roll'||selected.selectedIndex===undefined||!selected.rerollValues||!selected.selectionPolicy)throw Error('bountiful-followup:actual-reroll-required')
 const core=dnd5eCoreInspirationChoiceRerollOption(owner,origin.request.actorId,rollMode)
 const plugin=dnd5eD20ChoiceRerollFeaturesForCharacter(owner,origin.request.kind,'self-roll',prompt.payload.originalValue,{rollMode,attackAbility:ready.request.attackAbility}).find(row=>row.feature.id===contribution.featureId&&row.feature.declarativeAbility?.automation==='full')
 const eligible=core?.featureId===contribution.featureId?core:plugin?{featureId:plugin.feature.id,resourceCosts:plugin.resourceCosts,additionalDice:plugin.additionalDice,selectionPolicy:plugin.selectionPolicy}:undefined
 if(!eligible||!same(eligible.resourceCosts,selected.resourceCosts)||(eligible.additionalDice??1)!==selected.rerollValues.length||(eligible.selectionPolicy??'owner-chooses')!==selected.selectionPolicy)throw Error('bountiful-followup:current-source-or-cost-unavailable')
 const fact:BountifulDeferredD20Choice={schemaVersion:1,kind:'choice-reroll',...scope,readyOrdinal:ready.request.ordinal??-1,actorId:origin.request.actorId,characterId:owner.id,rawRollId,interruptId:prompt.id,contributionId:contribution.id,originalValue:selected.originalValue,selectedValue:selected.selectedValue,rerollValues:[...selected.rerollValues],selectedIndex:selected.selectedIndex,selectionPolicy:selected.selectionPolicy,featureId:contribution.featureId,resourceCosts:selected.resourceCosts.map(cost=>({...cost}))}
 const previous=first.postOriginalD20??[],prior=previous.find(row=>row.interruptId===prompt.id)
 if(prior){if(!same(prior,fact)||prompt.status!=='done'||!same(prompt.response,response))throw Error('bountiful-followup:changed-confirmed-choice');return response}
 if(first.postOriginalEquipmentD20||first.postOriginalCursor)throw Error('bountiful-followup:equipment-stage-already-open')
 if(prompt.status==='done')throw Error('bountiful-followup:already-settled-outside-parent')
 if(previous.some(row=>row.actorId===fact.actorId&&row.dieIndex===fact.dieIndex))throw Error('bountiful-followup:original-die-already-replaced')
 const facts=[...previous,fact]
 if(!validateBountifulDeferredD20Choices(facts,scope.parentId))throw Error('bountiful-followup:invalid-private-facts')
 const parents={...combat.bountifulOriginalParents,[bountifulOriginalParentReceiptId(scope.parentId,0)]:{...first,postOriginalD20:facts}}
 if(!validateBountifulOriginalParents(parents))throw Error('bountiful-followup:invalid-parent')
 const nextQueue=finishCombatInterrupt(queue,prompt.id,response,input.now??Date.now());if(!nextQueue)throw Error('bountiful-followup:request-retired')
 const last=host();if(last.roomId!==session.roomId||last.memberId!==session.memberId)throw Error('bountiful-followup:host-changed')
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:parents}},{name:COMBAT_INTERRUPT_RESOURCE,expectedRevision:revision(queue),data:nextQueue}],{transactionId:'bountiful-deferred-d20:'+prompt.id,readRevisions:{...reads,'player-action-requests':revision(requests)}})
 return response
}

/** Called only after the real Host locks this actual generic prompt as rolling.
 * All authority is reread from the protected private parent and queue. The UI
 * snapshot is compared, never adopted as an issuer or replacement state. */
export async function prepareBountifulDeferredExtraD20(input:{mapId:string;interruptId:string;acceptedContributionId:string;expectedContribution:D20ChoiceRerollInterruptContribution},gateway:Gateway){
 const session=host(),firstQueue=await gateway.loadResource<Snapshot<SharedCombatInterruptQueueState>>(COMBAT_INTERRUPT_RESOURCE)
 const firstPrompt=firstQueue?.interrupts.find(row=>row.id===input.interruptId)
 if(!firstPrompt||firstQueue?.mapId!==input.mapId||!isCombatInterruptKind(firstPrompt,'roll-confirmation')||!firstPrompt.payload.bountifulParent||!validateBountifulD20ParentFollowup(firstPrompt.payload.bountifulParent,firstPrompt.payload.rollId))throw Error('bountiful-followup:actual-bound-prompt-required')
 const scope=firstPrompt.payload.bountifulParent
 if(!scope.parentId||!Number.isSafeInteger(scope.sourceOccurrence)||scope.sourceOccurrence<0||scope.sourceOccurrence>511||!Number.isSafeInteger(scope.dieIndex)||scope.dieIndex<0||scope.dieIndex>1)throw Error('bountiful-followup:invalid-scope')
 const [combat,characters,maps,geometry,requests,queue]=await Promise.all([
  gateway.loadResource<Snapshot<Combat>>('combat'),gateway.loadResource<Snapshot<{characters:Character[]}>>('characters'),
  gateway.loadResource<Snapshot<object>>('maps'),gateway.loadResource<Snapshot<object>>('map-geometry'),
  gateway.loadResource<Snapshot<{requests:unknown[]}>>('player-action-requests'),gateway.loadResource<Snapshot<SharedCombatInterruptQueueState>>(COMBAT_INTERRUPT_RESOURCE)])
 const current=host();
 if(current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('bountiful-followup:host-changed')
 const first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(scope.parentId,0)]
 const nativeCapability=first&&!first.consumed&&validBountifulHostOperation(first.originalRoomAction)?await recoverBountifulHostOperation(scope.parentId,gateway):undefined
 const nativeOriginal=nativeCapability?bountifulIssuedHostOperation(nativeCapability):undefined
 if(first?.consumed)throw Error('bountiful-followup:completed-parent-cannot-request-dice')
 if(!combat||!characters||!maps||!requests||!queue||queue.mapId!==input.mapId||!first||first.consumed||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||
  first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId||first.identity.mapId!==input.mapId||!bountifulOriginalScopeMatches(combat,first.identity)||
  !same(combat.dnd5eTurnEconomyByToken??{},JSON.parse(first.identity.reactionEconomySignature))||!(nativeOriginal||requests.requests.some(row=>same(row,first.originalRoomAction))))throw Error('bountiful-followup:real-private-parent-required')
 await assertBountifulOriginalSceneScope(combat,first.identity,gateway)
 const reads:Record<string,number>={characters:revision(characters),maps:revision(maps),'map-geometry':revision(geometry),...(first.identity.sceneScope?{'campaign-time':first.identity.sceneScope.campaignTimeRevision}:{})}
 if(Object.entries(first.identity.revisions).some(([key,value])=>reads[key]!==value))throw Error('bountiful-followup:stale-original-resources')
 const rows=Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===scope.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 const origin=rows.find(row=>row.identity.occurrence===scope.sourceOccurrence)
 if(!origin||scope.dieIndex>=origin.request.originalRolls.length)throw Error('bountiful-followup:original-die-required')
 for(const row of rows){
  const decision=decisionFromBountifulOriginalDieReceipt(row,row.request)
  if(row.request.actorId===origin.request.actorId&&row.request.dieIndex===scope.dieIndex&&(decision||row.request.nativeLucky))throw Error('bountiful-followup:original-die-already-replaced')
 }
 const ordinaryOriginal=nativeOriginal?undefined:await readBountifulOriginalSource(first,{includeContinuation:true})
 const originalSource=nativeOriginal?.source??ordinaryOriginal?.source
 if(!originalSource)throw Error('bountiful-followup:real-private-parent-required')
 const scopedRaw=first.originalAdapterId==='spell'?bountifulOriginalRawForActor(originalSource,origin.request.actorId,origin.request.kind,origin.request.originalRolls):undefined
 const ordinaryRaw=ordinaryOriginal?.source
 const rawRollId=nativeOriginal?.operation.rawRollId??scopedRaw?.hostOriginalRollId??ordinaryRaw?.hostOriginalRollId,cursor=nativeOriginal?.operation.rawCursor??scopedRaw?.hostOriginalDiceCursor??ordinaryRaw?.hostOriginalDiceCursor
 if(typeof rawRollId!=='string'||!Number.isSafeInteger(cursor)||typeof cursor!=='number'||cursor<1)throw Error('bountiful-followup:host-raw-lineage-required')
 const minted=durableD20RollId({mapId:input.mapId,sourceMode:nativeOriginal?'dm':scopedRaw?.hostOriginalRollIssuerMode??bountifulOriginalRollIssuerMode(originalSource),transactionId:scope.parentId,occurrenceIndex:cursor-1})
 if(rawRollId!==minted&&rawRollId!==minted+':pool:'+origin.request.originalRolls.length+'d20')throw Error('bountiful-followup:foreign-raw-lineage')
 const ready=nativeOriginal?await readBountifulHostMonsterOriginalReady(scope.parentId,gateway):ordinaryOriginal?resumeBountifulOriginalParent({...ordinaryOriginal,parentId:scope.parentId,actorId:origin.request.actorId,kind:origin.request.kind,receipts:rows}):undefined
 if(!ready||ready.status!=='original-d20-ready'||ready.request.actorId!==origin.request.actorId||ready.request.kind!==origin.request.kind)throw Error('bountiful-followup:original-decision-not-ready')
 const rollMode=ready.request.rollMode??(ready.request.values.length===1?'normal':undefined)
 if(!rollMode||ready.request.values.length!==(rollMode==='normal'?1:2)||scope.dieIndex>=ready.request.values.length)throw Error('bountiful-followup:actual-roll-mode-required')
 if(ready.request.finalizedDice.includes(scope.dieIndex))throw Error('bountiful-followup:original-die-already-replaced')
 const prompt=queue.interrupts.find(row=>row.id===input.interruptId)
 if(!prompt||!isCombatInterruptKind(prompt,'roll-confirmation')||prompt.status==='rolled-back'||prompt.actorCharId!==origin.identity.roller.characterId||(prompt.payload.bountifulParent
    ?prompt.payload.bountifulParent.parentId!==scope.parentId||prompt.payload.bountifulParent.sourceOccurrence!==scope.sourceOccurrence||prompt.payload.bountifulParent.dieIndex!==scope.dieIndex||prompt.payload.bountifulParent.rawRollId!==rawRollId||prompt.payload.rollId!==bountifulDeferredD20RequestId(scope.parentId,rawRollId,scope.sourceOccurrence,scope.dieIndex)
    :prompt.payload.rollId!==rawRollId+':0')||prompt.transactionId!=='d20-confirmation:'+prompt.payload.rollId||prompt.payload.originalValue!==ready.request.values[scope.dieIndex])throw Error('bountiful-followup:authenticated-original-request-required')
 const contribution=prompt.contributions?.find(row=>row.id===input.acceptedContributionId)
 if(!contribution||contribution.kind!=='choice-reroll'||contribution.decision!=='use'||contribution.characterId!==origin.identity.roller.characterId)throw Error('bountiful-followup:authenticated-contribution-required')
 if(prompt.id!=='roll-confirmation:'+prompt.payload.rollId||prompt.mapId!==input.mapId||prompt.phase!=='after-roll'||prompt.status!=='rolling'||prompt.payload.rollOptions!==undefined||!same(contribution,input.expectedContribution)||contribution.id!==prompt.id+':'+contribution.characterId+':choice-reroll'||!same(firstPrompt.payload,prompt.payload))throw Error('bountiful-followup:locked-accepted-contribution-required')
 if(first.postOriginalEquipmentD20||first.postOriginalCursor||(first.postOriginalD20??[]).some(row=>row.actorId===origin.request.actorId&&row.readyOrdinal===ready.request.ordinal&&row.dieIndex===scope.dieIndex))throw Error('bountiful-followup:original-die-already-finalized')
 const currentMaps='maps'in maps&&Array.isArray(maps.maps)?maps.maps:[]
 const currentMap=currentMaps.find(row=>!!row&&typeof row==='object'&&'id'in row&&row.id===input.mapId)
 if(!same(originalSource.prepared.characters,characters.characters)||!same(originalSource.prepared.map,currentMap))throw Error('bountiful-followup:stale-original-materials')
 const owner=characters.characters.find(row=>row.id===contribution.characterId)
 if(!owner)throw Error('bountiful-followup:actual-original-owner-required')
 const core=dnd5eCoreInspirationChoiceRerollOption(owner,origin.request.actorId,rollMode)
 const plugin=dnd5eD20ChoiceRerollFeaturesForCharacter(owner,origin.request.kind,'self-roll',prompt.payload.originalValue,{rollMode,attackAbility:ready.request.attackAbility}).find(row=>row.feature.id===contribution.featureId&&row.feature.declarativeAbility?.automation==='full')
 const eligible=core?.featureId===contribution.featureId?core:plugin?{featureId:plugin.feature.id,featureLabel:plugin.feature.name,resourceCosts:plugin.resourceCosts,additionalDice:plugin.additionalDice,selectionPolicy:plugin.selectionPolicy}:undefined
 const offered=prompt.payload.eligibleModifiers?.find(row=>row.characterId===owner.id&&row.featureId===contribution.featureId&&row.modifierKind==='choice-reroll'&&row.rerollScope==='self-roll')
 if(!eligible||!offered||offered.featureLabel!==contribution.featureLabel||eligible.featureLabel!==contribution.featureLabel||!same(eligible.resourceCosts,offered.resourceCosts)||(eligible.additionalDice??1)!==(offered.additionalDice??1)||(eligible.selectionPolicy??'owner-chooses')!==(offered.selectionPolicy??'owner-chooses'))throw Error('bountiful-followup:current-source-or-scope-unavailable')
 const actor=structuredClone(ready.snapshot.combatants[origin.request.actorId])
 consumeDnd5eBountifulDeferredD20(actor,origin.request.kind,ready.request.values,(first.postOriginalD20??[]).filter(row=>row.readyOrdinal===ready.request.ordinal),[],new Set(ready.request.finalizedDice),{rollMode,attackAbility:ready.request.attackAbility})
 if(!eligible.resourceCosts?.length||eligible.resourceCosts.some(cost=>!Number.isSafeInteger(cost.amount)||cost.amount<1||(cost.resourceKey===DND5E_CORE_INSPIRATION_RESOURCE_KEY?(actor.inspiration??0)<cost.amount:(actor.classResources[cost.resourceKey]?.current??0)<cost.amount)))throw Error('bountiful-followup:current-cost-unavailable')
 const signature=JSON.stringify([first.identity,scope,prompt.id,prompt.payload.originalValue,origin.request.kind,ready.request.ordinal,contribution,eligible])
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature)),hex=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
 const finalHost=host();if(finalHost.roomId!==session.roomId||finalHost.memberId!==session.memberId)throw Error('bountiful-followup:host-changed')
 const rollRequestId=(nativeOriginal?'bountiful-native-parent-extra-d20:':'bountiful-parent-extra-d20:')+hex
 return {rollRequestId,count:eligible.additionalDice??1,rollerCharacterId:owner.id,...(nativeCapability?{nativeDiceRoute:bountifulNativeExtraDiceRoute(nativeCapability,rollRequestId)}:{})}
}
