import{secondChanceParentScopeMatches,assertSecondChanceSceneScope}from'../pages/maps/secondChanceParentScope'
import{dnd5ePluginFeatureCurrentEnvelopeFullV1,dnd5ePluginFeatureDefinition}from'../rulesets/dnd5e/plugins/pluginContentCatalog'
import{processSecondChanceRequest}from'../pages/maps/processSecondChanceRequest'
import{createPlayerActionEnvelope}from'../lib/playerActionSync'
import type{SharedRoomGatewayPort}from'../ports/sharedRoomGateway'
import{getRoomSession}from'../lib/roomSession'
export interface SecondChanceChoiceContext{attackReceiptId:string;combatId:string;actorTokenId:string;characterId:string;phase:'reaction'|'select-die';featureId:string;diceCount:1|2}
export interface SecondChanceRollContext{attackReceiptId:string;combatId:string;actorTokenId:string;characterId:string;rollRequestId:string;count:number;sides:number;supplementRequestId?:string}
type Command={phase:'reaction';attackReceiptId:string;decision:'use'|'decline'}|{phase:'select-die';attackReceiptId:string;dieIndex:number}|{phase:'roll-result'|'confirm-roll';attackReceiptId:string;rollRequestId:string;value:number}|{phase:'critical-roll-result'|'confirm-critical-roll';attackReceiptId:string;supplementRequestId:string;values:number[]}
export function secondChancePhaseRequestId(attackReceiptId:string,phase:string){
 const identity=JSON.stringify([attackReceiptId,phase]);let first=2166136261,second=2246822519
 for(let index=0;index<identity.length;index++){first=Math.imul(first^identity.charCodeAt(index),16777619);second=Math.imul(second^identity.charCodeAt(index),3266489917)}
 return `second-chance-response:${(first>>>0).toString(36)}${(second>>>0).toString(36)}`
}
/** Runs in the actual responding browser. The append endpoint overwrites every
 * supplied principal with its authenticated room member; the Host receives only
 * an ID and later rereads that persisted, server-stamped request. */
export async function submitSecondChanceChoice(input:{mapId:string;context:SecondChanceChoiceContext;optionId:string;round:number;initiativeIndex:number},gateway:Pick<SharedRoomGatewayPort,'appendPlayerActionRequest'>){
 const c=input.context
 if(!c||!c.attackReceiptId||!c.combatId||!c.actorTokenId||!c.characterId||!['reaction','select-die'].includes(c.phase)||![1,2].includes(c.diceCount))throw Error('second-chance-client:invalid-context')
 let command:Command
 if(c.phase==='reaction'){
  if(input.optionId!=='decline'&&input.optionId!==c.featureId)return undefined
  command={attackReceiptId:c.attackReceiptId,phase:'reaction',decision:input.optionId==='decline'?'decline':'use'}
 }else{
  const match=/^die:([01])$/.exec(input.optionId)
  if(!match)return undefined
  const dieIndex=Number(match[1]);if(dieIndex>=c.diceCount)throw Error('second-chance-client:invalid-selection')
  command={attackReceiptId:c.attackReceiptId,phase:'select-die',dieIndex}
 }
 const action=createPlayerActionEnvelope({mapId:input.mapId,combatId:c.combatId,actorOverride:{tokenId:c.actorTokenId,characterId:c.characterId},round:input.round,initiativeIndex:input.initiativeIndex,nextSeq:()=>0,patch:{type:'dnd5e-second-chance',secondChance:command}})
 if(!action)throw Error('second-chance-client:envelope-unavailable')
 action.id=secondChancePhaseRequestId(c.attackReceiptId,c.phase)
 await gateway.appendPlayerActionRequest(action)
 return action.id
}
export async function submitSecondChanceRoll(input:{mapId:string;context:SecondChanceRollContext;values:readonly number[];round:number;initiativeIndex:number},gateway:Pick<SharedRoomGatewayPort,'appendPlayerActionRequest'>){
 const c=input.context
 if(!c||!c.attackReceiptId||!c.combatId||!c.actorTokenId||!c.characterId||!c.rollRequestId||!Number.isSafeInteger(c.count)||c.count<1||c.count>1000||!Number.isSafeInteger(c.sides)||c.sides<2||c.sides>10000||input.values.length!==c.count||input.values.some(value=>!Number.isInteger(value)||value<1||value>c.sides)||!c.supplementRequestId&&(c.count!==1||c.sides!==20))throw Error('second-chance-client:invalid-roll')
 const command:Command=c.supplementRequestId?{phase:'critical-roll-result',attackReceiptId:c.attackReceiptId,supplementRequestId:c.supplementRequestId,values:[...input.values]}:{phase:'roll-result',attackReceiptId:c.attackReceiptId,rollRequestId:c.rollRequestId,value:input.values[0]}
 const action=createPlayerActionEnvelope({mapId:input.mapId,combatId:c.combatId,actorOverride:{tokenId:c.actorTokenId,characterId:c.characterId},round:input.round,initiativeIndex:input.initiativeIndex,nextSeq:()=>0,patch:{type:'dnd5e-second-chance',secondChance:command}})
 if(!action)throw Error('second-chance-client:envelope-unavailable')
 action.id=secondChancePhaseRequestId(c.attackReceiptId,c.supplementRequestId??'roll-result')
 await gateway.appendPlayerActionRequest(action);return action.id
}
export async function submitSecondChanceOwnedDiceResult(input:{mapId:string;combatId?:string;requestId:string;characterId?:string;values:readonly number[];round:number;initiativeIndex:number},gateway:Pick<SharedRoomGatewayPort,'loadResource'|'appendPlayerActionRequest'>){
 const combat=await gateway.loadResource<{mapId:string;combatId?:string;secondChancePrompts?:Array<{attackReceiptId:string;mapId?:string;combatId:string;phase:string;canRespondAsRoller:boolean;rollerTokenId:string;rollerCharacterId?:string;rollRequestId?:string;count?:number;sides?:number;supplementRequestId?:string}>}>('combat')
 if(!input.characterId||!combat)return undefined
 // DiceBox's presentation context may differ from a scene parent. Only the
 // server-projected owned prompt and its exact durable request identify attack.
 const prompt=combat.secondChancePrompts?.find(row=>(row.mapId??combat.mapId)===input.mapId&&(row.combatId===input.combatId||combat.combatId===input.combatId)&&row.canRespondAsRoller&&row.rollerCharacterId===input.characterId&&row.rollRequestId===input.requestId&&['roll','critical-roll'].includes(row.phase))
 if(!prompt)return undefined
 return submitSecondChanceRoll({mapId:input.mapId,context:{attackReceiptId:prompt.attackReceiptId,combatId:prompt.combatId,actorTokenId:prompt.rollerTokenId,characterId:input.characterId,rollRequestId:input.requestId,count:prompt.count??1,sides:prompt.sides??20,supplementRequestId:prompt.supplementRequestId},values:input.values,round:input.round,initiativeIndex:input.initiativeIndex},gateway)
}
/** The actual DM DiceBox final value is a second fact, kept separately from the
 * player's raw faces. Existing legal DM face edits retain explicit DM origin. */
export async function submitSecondChanceHostConfirmation(input:{mapId:string;context:SecondChanceRollContext;values:readonly number[];round:number;initiativeIndex:number},gateway:Pick<SharedRoomGatewayPort,'appendPlayerActionRequest'>){
 const session=getRoomSession(),c=input.context
 if(session?.role!=='dm')throw Error('second-chance-client:host-confirmation-required')
 if(input.values.length!==c.count||input.values.some(value=>!Number.isInteger(value)||value<1||value>c.sides))throw Error('second-chance-client:invalid-confirmation')
 const command:Command=c.supplementRequestId?{phase:'confirm-critical-roll',attackReceiptId:c.attackReceiptId,supplementRequestId:c.supplementRequestId,values:[...input.values]}:{phase:'confirm-roll',attackReceiptId:c.attackReceiptId,rollRequestId:c.rollRequestId,value:input.values[0]}
 const action=createPlayerActionEnvelope({mapId:input.mapId,combatId:c.combatId,actorOverride:{tokenId:c.actorTokenId,characterId:c.characterId},round:input.round,initiativeIndex:input.initiativeIndex,nextSeq:()=>0,patch:{type:'dnd5e-second-chance',secondChance:command}})
 if(!action)throw Error('second-chance-client:envelope-unavailable')
 action.id=secondChancePhaseRequestId(c.attackReceiptId,c.supplementRequestId?`confirm:${c.supplementRequestId}`:'confirm-roll')
 await gateway.appendPlayerActionRequest(action);return action.id
}

/** Called by the actual Host DiceBox before opening its final confirmation.
 * Raw faces are an authenticated original-roller fact, never reconstructed from
 * the DM's final edited faces or from the return value of a completed roll. */
export async function recordSecondChanceHostOwnedRawDice(input:{mapId:string;requestId:string;rollerTokenId?:string;values:readonly number[];sides:number;round:number;initiativeIndex:number},gateway:Pick<SharedRoomGatewayPort,'loadResource'|'appendPlayerActionRequest'|'saveResourcesAtomically'>){
 if(!input.requestId.startsWith('second-chance:')&&!input.requestId.startsWith('incoming-critical:'))return undefined
 const session=getRoomSession();if(session?.role!=='dm')throw Error('second-chance-client:host-owned-raw-required')
 const combat=await gateway.loadResource<import('./secondChanceHostState').SecondChanceCombat>('combat')
 const matches=Object.values(combat?.secondChanceAttacks??{}).filter(receipt=>receipt.attack.mapId===input.mapId&&(receipt.rollRequestId===input.requestId||!!receipt.pendingCriticalDiceRequests?.[input.requestId]))
 if(matches.length===0)return undefined
 if(matches.length!==1)throw Error('second-chance-client:ambiguous-owned-raw')
 const receipt=matches[0],attack=receipt.attack
 const feature=dnd5ePluginFeatureDefinition(receipt.featureId)
 if(!dnd5ePluginFeatureCurrentEnvelopeFullV1(receipt.featureId)||feature?.automation!=='full'||feature.declarativeAbility?.automation!=='full'||receipt.featureDefinitionSignature!=null&&JSON.stringify(feature.declarativeAbility)!==receipt.featureDefinitionSignature)throw Error('second-chance-client:owned-raw-source-unavailable')
 if(receipt.hostControllerMemberId!==session.memberId||attack.rollerControllerMemberId!==session.memberId||attack.rollerTokenId!==input.rollerTokenId)return undefined
 const supplement=receipt.pendingCriticalDiceRequests?.[input.requestId],count=supplement?.count??1,sides=supplement?.sides??20
 if(input.sides!==sides||input.values.length!==count||input.values.some(value=>!Number.isInteger(value)||value<1||value>sides))throw Error('second-chance-client:invalid-owned-raw')
 const existing=supplement?receipt.criticalDice?.[supplement.id]:receipt.rollerD20?[receipt.rollerD20.value]:undefined
 if(existing){if(JSON.stringify(existing)!==JSON.stringify(input.values))throw Error('second-chance-client:owned-raw-conflict');return secondChancePhaseRequestId(attack.id,supplement?.id??'roll-result')}
 const context:SecondChanceRollContext={attackReceiptId:attack.id,combatId:attack.combatId,actorTokenId:attack.rollerTokenId,characterId:attack.rollerCharacterId??attack.rollerTokenId,rollRequestId:input.requestId,count,sides,supplementRequestId:supplement?.id}
 const requestId=await submitSecondChanceRoll({mapId:input.mapId,context,values:input.values,round:input.round,initiativeIndex:input.initiativeIndex},gateway)
 // Process only the server-stamped queue record just appended by this Host.
 // The final confirmation endpoint independently requires this locked raw fact.
 await processSecondChanceRequest({mapId:input.mapId,requestId},gateway)
 return requestId
}

/** Before opening the real Host confirmation, consume only the exact raw report
 * already appended by the authenticated original player. The roll event/values
 * never mint a principal; ordinary non-SC dice remain unchanged. */
export async function lockSecondChanceRawForHostConfirmation(input:Parameters<typeof recordSecondChanceHostOwnedRawDice>[0],gateway:Parameters<typeof recordSecondChanceHostOwnedRawDice>[1]){
 if(!input.requestId.startsWith('second-chance:')&&!input.requestId.startsWith('incoming-critical:'))return undefined
 const session=getRoomSession();if(session?.role!=='dm')throw Error('second-chance-client:host-raw-required')
 const combat=await gateway.loadResource<import('./secondChanceHostState').SecondChanceCombat>('combat')
 const matches=Object.values(combat?.secondChanceAttacks??{}).filter(receipt=>receipt.rollRequestId===input.requestId||!!receipt.pendingCriticalDiceRequests?.[input.requestId])
 if(!matches.length)return undefined
 if(matches.length!==1)throw Error('second-chance-client:ambiguous-raw')
 const receipt=matches[0],attack=receipt.attack
 if(!combat||!secondChanceParentScopeMatches(combat,receipt,input.mapId)||receipt.hostControllerMemberId!==session.memberId||attack.rollerTokenId!==input.rollerTokenId)throw Error('second-chance-client:raw-parent-required')
 const sourceValid=()=>{const feature=dnd5ePluginFeatureDefinition(receipt.featureId);return dnd5ePluginFeatureCurrentEnvelopeFullV1(receipt.featureId)&&feature?.automation==='full'&&feature.declarativeAbility?.automation==='full'&&(receipt.featureDefinitionSignature==null||JSON.stringify(feature.declarativeAbility)===receipt.featureDefinitionSignature)}
 if(!sourceValid())throw Error('second-chance-client:raw-source-unavailable')
 await assertSecondChanceSceneScope(receipt,combat!,gateway)
 if(attack.rollerControllerMemberId===session.memberId)return recordSecondChanceHostOwnedRawDice(input,gateway)
 const supplement=receipt.pendingCriticalDiceRequests?.[input.requestId],count=supplement?.count??1,sides=supplement?.sides??20
 if(input.sides!==sides||input.values.length!==count||input.values.some(value=>!Number.isInteger(value)||value<1||value>sides))throw Error('second-chance-client:invalid-delegated-raw')
 const requestId=secondChancePhaseRequestId(attack.id,supplement?.id??'roll-result')
 const assertRaw=(current:typeof receipt|undefined)=>{
  const currentSession=getRoomSession();if(currentSession?.role!=='dm'||currentSession.roomId!==session.roomId||currentSession.memberId!==session.memberId||!sourceValid())throw Error('second-chance-client:raw-source-unavailable')
  if(!current||current.attack.id!==attack.id||current.attack.transactionId!==attack.transactionId||current.attack.rollerControllerMemberId!==attack.rollerControllerMemberId||current.attack.rollerTokenId!==input.rollerTokenId||current.hostControllerMemberId!==session.memberId||(!supplement&&current.rollRequestId!==input.requestId)||supplement&&(!current.pendingCriticalDiceRequests?.[supplement.id]||JSON.stringify(current.pendingCriticalDiceRequests[supplement.id])!==JSON.stringify(supplement)))throw Error('second-chance-client:raw-parent-required')
  const raw=supplement?current.criticalDice?.[supplement.id]:current.rollerD20?[current.rollerD20.value]:undefined
  if(!raw||JSON.stringify(raw)!==JSON.stringify(input.values)||!supplement&&(current.rollerD20?.authenticatedMemberId!==attack.rollerControllerMemberId||current.rollerD20.dieIndex!==current.rollerSelection?.dieIndex))throw Error('second-chance-client:delegated-raw-not-locked')
 }
 const existing=supplement?receipt.criticalDice?.[supplement.id]:receipt.rollerD20
 if(existing){assertRaw(receipt);return requestId}
 const queue=await gateway.loadResource<{requests:Array<{id:string;roomMemberId?:string;type:string;sourceMode:string;secondChance?:{attackReceiptId?:string;phase?:string;rollRequestId?:string;supplementRequestId?:string;value?:number;values?:number[]}}>}>('player-action-requests'),report=queue?.requests.find(row=>row.id===requestId),command=report?.secondChance
 if(!report||report.type!=='dnd5e-second-chance'||report.sourceMode!=='player'||report.roomMemberId!==attack.rollerControllerMemberId||command?.attackReceiptId!==attack.id||command.phase!==(supplement?'critical-roll-result':'roll-result')||(supplement?command.supplementRequestId!==supplement.id||JSON.stringify(command.values)!==JSON.stringify(input.values):command.rollRequestId!==input.requestId||command.value!==input.values[0]))throw Error('second-chance-client:authenticated-delegated-report-required')
 await processSecondChanceRequest({mapId:input.mapId,requestId},gateway)
 const updated=await gateway.loadResource<import('./secondChanceHostState').SecondChanceCombat>('combat');assertRaw(updated?.secondChanceAttacks?.[attack.id]);return requestId
}
