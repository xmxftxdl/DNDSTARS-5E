import {bountifulHostOperationReplayContext} from './bountifulHostOperation'
import {readBountifulNativePreparedReplay} from './bountifulNativePreparedRecovery'
import {bountifulOriginalScopeMatches} from '../../../shared/bountiful-original-scope.mjs'
import {assertBountifulOriginalSceneScope,markBountifulOriginalSceneReactions} from './bountifulOriginalSceneScope'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {validateBountifulReadyParents} from '../../../shared/bountiful-ready-parents.mjs'
import type {BountifulReadyParentData} from './bountifulOriginalReadyFrame'
import {restoreSecondChancePreparedHostFactsAsync} from '../../pages/maps/secondChancePreparedHostFacts'
import {originalD20ReplaySourceKey} from './allyNaturalOneCheckpoint'
import {assertBountifulEquipmentFinalCost} from './bountifulEquipmentFinalCost'
import {DND5E_CORE_INSPIRATION_RESOURCE_KEY} from '../../lib/d20InterruptPolicy'
import {readBountifulAfterDiceSource} from './bountifulLuckAfterDice'
import type {SecondChanceCombat,PersistedSecondChanceAttack} from '../../../src/lib/secondChanceHostState'
import type {Dnd5eActionResult} from '../../../src/rulesets/dnd5e/headlessCombatEngine'
import type {Dnd5eMapResultPlan} from '../../../src/rulesets/dnd5e/mapBridge'
import {getRoomSession} from '../../../src/lib/roomSession'
import {readSecondChancePreparedOriginalAsync} from '../../../src/pages/maps/secondChancePreparedParent'
import {encodeSecondChanceParentWire,decodeSecondChanceParentWire} from '../../../src/lib/secondChanceParentWire'
import {captureSecondChancePreparedHostFacts} from '../../../src/pages/maps/secondChancePreparedHostFacts'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'
import {validateOriginalD20ReplayFacts,preparedOriginalD20Replay} from '../../../src/rulesets/dnd5e/allyNaturalOneCheckpoint'
import {bountifulPreparedReplayFacts,decisionFromBountifulOriginalDieReceipt} from '../../../src/rulesets/dnd5e/bountifulLuckReceipt'

/** This computes only the extra combat value for the existing original-parent
 * final CAS. It never publishes a separate cost or manufactures a roll result. */
export async function settleBountifulWithSecondChance(input:{combat:SecondChanceCombat;receipt:PersistedSecondChanceAttack;result:Dnd5eActionResult;application:Dnd5eMapResultPlan;gateway:Pick<SharedRoomGatewayPort,'loadResource'>}){
 const {combat,receipt,result,application}=input,parentId=receipt.attack.transactionId
 const readyCombat:SecondChanceCombat&{bountifulReadyParents?:Record<string,BountifulReadyParentData>}=combat
 const parent=receipt.parentInput
 const rows=Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 const raw=parent?.prepared?decodeSecondChanceParentWire(parent.prepared.input):undefined
 const hasPreparedFacts=!!raw&&typeof raw==='object'&&'hostOriginalD20Replay'in raw
 if(!rows.length&&Object.values(readyCombat.bountifulReadyParents??{}).some(row=>row.parentId===parentId))return undefined
 if(!rows.length&&!hasPreparedFacts&&!parent?.options?.originalD20Replay)return undefined
 const source=parent?.prepared?await readSecondChancePreparedOriginalAsync(parent.prepared):undefined
 const binding=source?preparedOriginalD20Replay(source).binding:parent?.options?.originalD20Replay
 const host=getRoomSession(),first=rows[0],native=bountifulHostOperationReplayContext(source)
 if(!host||host.role!=='dm'||!parent||!source||!parent.prepared||!binding||!first||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||!result.ok||result.state.combatId!==receipt.attack.combatId||application.map.id!==receipt.attack.mapId)throw Error('bountiful-joint:real-original-parent-required')
 if(rows.some((row,index)=>row.identity.occurrence!==index||row.consumed||row.identity.roomId!==host.roomId||row.identity.hostMemberId!==host.memberId||row.identity.mapId!==receipt.attack.mapId||row.identity.combatId!==receipt.attack.combatId||row.originalAdapterId!==parent.prepared!.adapterId||JSON.stringify(row.originalRoomAction)!==JSON.stringify(native?.command??receipt.originalRoomAction)||JSON.stringify(row.originalParent)!==JSON.stringify(first.originalParent)))throw Error('bountiful-joint:wrong-parent-lineage')
 if(!bountifulOriginalScopeMatches(combat,first.identity)||first.identity.revisions.characters!==receipt.characterRevision||first.identity.revisions.maps!==receipt.mapRevision||first.identity.revisions['map-geometry']!==(receipt.geometryRevision??0))throw Error('bountiful-joint:wrong-original-revisions')
 if(first.identity.sceneScope){if(receipt.sceneScope?.kind!=='ordinary-exploration'||receipt.sceneScope.campaignTimeRevision!==first.identity.sceneScope.campaignTimeRevision)throw Error('bountiful-joint:wrong-scene-scope');await assertBountifulOriginalSceneScope(combat,first.identity,input.gateway);markBountifulOriginalSceneReactions({sceneScope:first.identity.sceneScope,roomId:host.roomId,parentId,characterIdByCombatantId:source.prepared.characterIdByCombatantId,result,application})}
 if(native){
  if(native.parentId!==parentId||parent.prepared.adapterId!=='monster'||receipt.originalRoomAction)throw Error('bountiful-joint:wrong-native-lineage')
  const expected=await readBountifulNativePreparedReplay(parentId,input.gateway)
  if(JSON.stringify(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(source)))!==JSON.stringify(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(expected))))throw Error('bountiful-joint:changed-native-parent')
  validateOriginalD20ReplayFacts(binding,parentId,source.prepared.state,native.command)
 }else{
 const {hostOriginalD20Replay:_binding,...original}=source
 void _binding
 const afterDice=await readBountifulAfterDiceSource(first)
 const expectedWire=afterDice?encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(afterDice)):first.originalParent
 if(JSON.stringify(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(original)))!==JSON.stringify(expectedWire)||JSON.stringify(parent.state)!==JSON.stringify(source.prepared.state))throw Error('bountiful-joint:changed-original-input')
 const action='action'in source.prepared?source.prepared.action:undefined
 const expected=bountifulPreparedReplayFacts({parentId,source:{prepared:{...source.prepared,action}},receipts:rows})
 validateOriginalD20ReplayFacts(binding,parentId,source.prepared.state,action)
 if(JSON.stringify(binding)!==JSON.stringify(expected))throw Error('bountiful-joint:changed-authenticated-choices')
 }
 for(const row of rows){
  const decision=decisionFromBountifulOriginalDieReceipt(row,row.request)
  if(!decision||row.request.nativeLucky)continue
  const owner=result.state.combatants[decision.ownerId]
  const event=result.events.some(event=>event.type==='ally-natural-one-rerolled'&&event.actorId===decision.ownerId&&event.targetId===row.request.actorId&&event.featureId===decision.featureId&&event.dieIndex===row.request.dieIndex&&event.replacement===decision.replacement&&JSON.stringify(event.originalValues)===JSON.stringify(row.request.originalRolls))
  const effect=owner?.classState.activeEffects?.some(effect=>effect.source.actorId===owner.id&&effect.source.rulesId===decision.featureId&&effect.definitionId===decision.featureId+':lucky-suppressed'&&effect.tags?.includes('bountiful-luck:racial-lucky-suppressed'))
  if(!owner||owner.turn.reactionAvailable||!event||!effect)throw Error('bountiful-joint:real-reaction-not-applied')
 }
  for(const fact of first.postOriginalD20??[]){
    const actor=result.state.combatants[fact.actorId]
    const character=application.characters.find(row=>row.id===fact.characterId)
    if(!actor||!character||source.prepared.characterIdByCombatantId[fact.actorId]!==fact.characterId)throw Error('bountiful-joint:deferred-cost-not-in-final-snapshot')
    for(const cost of fact.resourceCosts){
      if(cost.resourceKey===DND5E_CORE_INSPIRATION_RESOURCE_KEY){
        if(!Number.isSafeInteger(actor.inspiration)||character.inspiration!==actor.inspiration)throw Error('bountiful-joint:deferred-cost-not-in-final-snapshot')
      }else{
        const expected=actor.classResources[cost.resourceKey],actual=character.classResources?.[cost.resourceKey]
        if(!expected||!actual||actual.current!==expected.current||actual.max!==expected.max)throw Error('bountiful-joint:deferred-cost-not-in-final-snapshot')
      }
    }
  }
 assertBountifulEquipmentFinalCost(first.postOriginalEquipmentD20,application,application)
 const resultWire=encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts({result,application})),parents={...combat.bountifulOriginalParents}
 for(const row of rows){const key=Object.keys(parents).find(key=>parents[key]===row);if(!key)throw Error('bountiful-joint:stored-parent-missing');parents[key]={...row,consumed:{transactionId:parentId,...(row.identity.occurrence===0?{result:resultWire}:{})}}}
 if(!validateBountifulOriginalParents(parents))throw Error('bountiful-joint:invalid-consumed-parent')
 return parents
}

/** The same real SC final CAS also closes raw-ready frames. SC may have paid
 * its independent reaction before this point; validate against its captured
 * original revisions and facade, never a newly supplied prepared.state. */
export async function settleBountifulReadyWithSecondChance(input:{combat:SecondChanceCombat;receipt:PersistedSecondChanceAttack;result:Dnd5eActionResult;application:Dnd5eMapResultPlan;gateway:Pick<SharedRoomGatewayPort,'loadResource'>}){
 const {combat,receipt,result,application}=input,parentId=receipt.attack.transactionId
 const readyCombat:SecondChanceCombat&{bountifulReadyParents?:Record<string,BountifulReadyParentData>}=combat
 const records=Object.values(readyCombat.bountifulReadyParents??{}).filter(row=>row.parentId===parentId).sort((a,b)=>(a.request.ordinal??-1)-(b.request.ordinal??-1))
 if(!records.length)return undefined
 const parent=receipt.parentInput,host=getRoomSession()
 if(!host||host.role!=='dm'||!parent?.prepared||parent.prepared.adapterId!=='spell'||!result.ok||!validateBountifulReadyParents(readyCombat.bountifulReadyParents)||result.state.combatId!==receipt.attack.combatId||application.map.id!==receipt.attack.mapId)throw Error('bountiful-ready-joint:actual-spell-parent-required')
 for(const record of records){
  if(record.consumed||record.roomId!==host.roomId||record.hostMemberId!==host.memberId||record.mapId!==receipt.attack.mapId||record.combatId!==receipt.attack.combatId||!bountifulOriginalScopeMatches(combat,{mapId:record.mapId,combatId:record.combatId,round:record.round,initiativeIndex:record.initiativeIndex,sceneScope:record.sceneScope})||record.versions.characters!==receipt.characterRevision||record.versions.maps!==receipt.mapRevision||record.versions['map-geometry']!==(receipt.geometryRevision??0)||JSON.stringify(record.originalRoomAction)!==JSON.stringify(receipt.originalRoomAction))throw Error('bountiful-ready-joint:wrong-ready-lineage')
 }
 const source=await readSecondChancePreparedOriginalAsync(parent.prepared),binding=preparedOriginalD20Replay(source).binding
 if(!binding||JSON.stringify(parent.state)!==JSON.stringify(source.prepared.state))throw Error('bountiful-ready-joint:actual-replay-required')
 for(const record of records){if(!record.sceneScope)continue;if(receipt.sceneScope?.kind!=='ordinary-exploration'||receipt.sceneScope.campaignTimeRevision!==record.sceneScope.campaignTimeRevision)throw Error('bountiful-ready-joint:wrong-scene-scope');await assertBountifulOriginalSceneScope(combat,{...record,revisions:record.versions},input.gateway);markBountifulOriginalSceneReactions({sceneScope:record.sceneScope,roomId:host.roomId,parentId,characterIdByCombatantId:source.prepared.characterIdByCombatantId,result,application})}
 const last=records.at(-1)!
 const expected=await restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(last.continuation?.source??last.source))
 const omitReplay=(value:object)=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='hostOriginalD20Replay'))
 if(!expected||typeof expected!=='object'||JSON.stringify(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(omitReplay(source))))!==JSON.stringify(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(omitReplay(expected)))))throw Error('bountiful-ready-joint:changed-ready-source')
 const action='action'in source.prepared?source.prepared.action:undefined
 validateOriginalD20ReplayFacts(binding,parentId,source.prepared.state,action)
 const readyFrames=records.map(row=>({frameId:row.id,request:row.request,choices:row.postReadyD20??[]}))
 if(JSON.stringify(binding.readyFrames)!==JSON.stringify(readyFrames))throw Error('bountiful-ready-joint:changed-authenticated-ready-choices')
 const natural=Object.values(combat.bountifulOriginalParents??{}).some(row=>row.identity.parentId===parentId)
 if(!natural&&(binding.facts.length||binding.sourceKey!==originalD20ReplaySourceKey(parentId,source.prepared.state,action)||Object.keys(binding).some(key=>!['parentId','sourceKey','facts','readyFrames'].includes(key))))throw Error('bountiful-ready-joint:foreign-ready-replay')
 for(const fact of records.flatMap(row=>row.postReadyD20??[])){
  const actor=result.state.combatants[fact.actorId],character=application.characters.find(row=>row.id===fact.characterId)
  if(!actor||!character||source.prepared.characterIdByCombatantId[fact.actorId]!==fact.characterId)throw Error('bountiful-ready-joint:final-cost-required')
  for(const cost of fact.resourceCosts){
   if(cost.resourceKey===DND5E_CORE_INSPIRATION_RESOURCE_KEY){if(!Number.isSafeInteger(actor.inspiration)||character.inspiration!==actor.inspiration)throw Error('bountiful-ready-joint:final-cost-required')}
   else{const expected=actor.classResources[cost.resourceKey],actual=character.classResources?.[cost.resourceKey];if(!expected||!actual||expected.current!==actual.current||expected.max!==actual.max)throw Error('bountiful-ready-joint:final-cost-required')}
  }
 }
 const parents={...readyCombat.bountifulReadyParents}
 for(const record of records)parents[record.id]={...record,consumed:{transactionId:parentId}}
 if(!validateBountifulReadyParents(parents))throw Error('bountiful-ready-joint:invalid-consumed-frames')
 return parents
}
