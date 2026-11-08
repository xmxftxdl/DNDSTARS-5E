import{assertArcaneBeforeSecondChanceDecline,type ArcaneBeforeSecondChanceDecline}from'./arcaneBeforeSecondChance'
import{assertArmorBeforeSecondChanceDecline,type ArmorBeforeSecondChanceDecline}from'./armorBeforeSecondChance'
import{captureSecondChanceOriginalClockAuthority}from'./secondChanceOriginalClockAuthority'
import{secondChanceCanonicalControllerMemberId}from'../../../shared/second-chance-controller.mjs'
import{createDnd5eTurnEconomyCounts}from'../../rulesets/dnd5e/turnEconomy'
import{captureSecondChanceOrdinarySceneScope,captureSecondChanceSceneScope,secondChanceParentScopeMatches}from'./secondChanceParentScope'
import{secondChanceParentGroup,activeSecondChanceParentReceipt,secondChanceOccurrence,advanceSecondChanceParentRevisions}from'./secondChanceParentGroup'
import{isSecondChanceAdditionalIncoming,type SecondChanceAdditionalIncoming}from'./secondChanceAdditionalIncoming'
import type{Character}from'../../types/character'
import{migrateMapsState,type BattleMap}from'../../store/maps'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{getRoomSession}from'../../lib/roomSession'
import{normalizeSharedMapGeometry,type SharedMapGeometryState}from'../../lib/mapGeometry'
import{createDnd5eMapCombatSnapshot}from'../../rulesets/dnd5e/mapBridge'
import{createDnd5eDamageCommitSession}from'../../rulesets/dnd5e/damageCommitSession'
import{dnd5eIncomingAttackRerollOptions,type Dnd5eAction}from"../../application/combat/dnd5eCombatRules"
import{dnd5eTargetCriticalThreshold}from'../../rulesets/dnd5e/targetCriticalThreshold'
import{dnd5ePluginFeatureCurrentEnvelopeFullV1,dnd5ePluginFeatureDefinition}from'../../rulesets/dnd5e/plugins/pluginContentCatalog'
import type{PersistedSecondChanceAttack,SecondChanceCombat}from'./secondChanceHostCommit'
import{validateSecondChanceAttackReceipts}from'../../../shared/second-chance-state.mjs'
import{dnd5eHostTransactionHasCapabilities,cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone'
import{readSecondChancePreparedOriginalAsync,createSecondChancePreparedReplayAsync,type SecondChancePreparedOriginal}from'./secondChancePreparedParent'
import{secondChanceParentDefinitionSignature}from'../../lib/secondChanceParentSignature'
type Snapshot<T>=T&{_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
function revision(value:Snapshot<object>|null,name:string){if(!value)return 0;const rev=value._sync?.revision;if(!Number.isSafeInteger(rev)||rev!<0)throw Error(`second-chance-issue:revision-required:${name}`);return rev!}
// Compare the actual client map projection on both sides: persistence omits
// optional empty/false defaults that the real Maps store materializes. All
// supported coordinates, ownership, effects and item facts remain in that view.
function samePreparedMap(left:BattleMap,right:BattleMap){return JSON.stringify(migrateMapsState({maps:[left]}).maps[0])===JSON.stringify(migrateMapsState({maps:[right]}).maps[0])}
// JSON snapshots represent records independently of insertion order. Keep array
// order and every serialized field/value, matching the previous JSON contract.
function samePreparedCharacter(left:Character,right:Character|undefined){
 const ordered=(value:unknown):unknown=>Array.isArray(value)?value.map(ordered):
  value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,row])=>[key,ordered(row)])):value
 return JSON.stringify(ordered(left))===JSON.stringify(ordered(right))
}
/** The parent caller passes its already authorized original action, not a reaction
 * payload. All ability, dice-mode, ownership, visibility, HP and reaction facts
 * are rebuilt from the current persisted room through the genuine map bridge. */
export async function issueSecondChanceAttack(input:{arcaneBeforeSecondChance?:ArcaneBeforeSecondChanceDecline;armorBeforeSecondChance?:ArmorBeforeSecondChanceDecline;mapId:string;parentTransactionId:string;action?:Dnd5eAction;state?:import("../../application/combat/dnd5eCombatRules").Dnd5eHeadlessCombatState;nativeContext?:import('../../rulesets/dnd5e/damageReactionFlow').Dnd5eDamageReactionMapContext;preparedOriginal?:SecondChancePreparedOriginal;options?:Parameters<typeof import("../../application/combat/dnd5eCombatRules").resolveDnd5eHeadlessAction>[2];featureId?:string;additionalIncoming?:SecondChanceAdditionalIncoming},gateway:Gateway):Promise<PersistedSecondChanceAttack>{
 const firstNativeIssuedNow=Date.now()
 const session=getRoomSession(),guard=()=>{const current=getRoomSession();if(!session||session.role!=='dm'||current?.roomId!==session.roomId||current.memberId!==session.memberId||current.role!=='dm')throw Error('second-chance-issue:host-room-required')};guard()
 const[characters,maps,combat,rawGeometry,originalClock]=await Promise.all([gateway.loadResource<Snapshot<{characters:Character[]}>>('characters'),gateway.loadResource<Snapshot<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Snapshot<SecondChanceCombat>>('combat'),gateway.loadResource<Snapshot<SharedMapGeometryState>>('map-geometry'),gateway.loadResource<import('../../lib/campaignTime').SharedCampaignTimeState&{_sync?:{revision?:number}}>('campaign-time')]);guard()
 const prepared=input.preparedOriginal?await readSecondChancePreparedOriginalAsync(input.preparedOriginal):undefined
 const map=maps?.maps.find(row=>row.id===input.mapId)
 if(!characters||!maps||!map||!combat||combat.active&&(combat.mapId!==map.id||!combat.combatId)||combat.flowPause||!input.parentTransactionId.trim())throw Error('second-chance-issue:parent-context-unavailable')
 const existing=secondChanceParentGroup(combat,input.parentTransactionId),root=existing[0],additional=input.additionalIncoming
 const freezeNativeClock=!input.preparedOriginal||input.preparedOriginal.adapterId==='spell'
 const nativeOptions=!freezeNativeClock||root&&root.parentInput?.options?.now===undefined?input.options:{...input.options,now:input.options?.now??root?.parentInput?.options?.now??firstNativeIssuedNow}
 if(freezeNativeClock&&nativeOptions?.now!==undefined&&!Number.isSafeInteger(nativeOptions.now))throw Error('second-chance-issue:invalid-native-clock')
 const sceneScope=root?.sceneScope??(combat.active?undefined:prepared&&input.preparedOriginal?.adapterId==='plugin-feature'?await captureSecondChanceSceneScope(prepared,combat,gateway):prepared&&['spell','equipment'].includes(input.preparedOriginal!.adapterId)?await captureSecondChanceOrdinarySceneScope(prepared,combat,gateway):undefined)
 if(!combat.active&&!sceneScope)throw Error('second-chance-issue:parent-context-unavailable')
 if(!!input.action===!!input.preparedOriginal)throw Error('second-chance-issue:exact-original-required')
 if(!validateSecondChanceAttackReceipts(combat.secondChanceAttacks??{}))throw Error('second-chance-issue:invalid-persisted-receipts')
 if(root){
  if(!secondChanceParentScopeMatches(combat,root,input.mapId)||JSON.stringify(root.parentInput?.action)!==JSON.stringify(input.action)||JSON.stringify(root.parentInput?.prepared)!==JSON.stringify(input.preparedOriginal)||JSON.stringify(root.parentInput?.options)!==JSON.stringify(nativeOptions)||JSON.stringify(root.parentInput?.nativeContext)!==JSON.stringify(input.nativeContext)||input.state!==undefined&&JSON.stringify(root.parentInput?.state)!==JSON.stringify(input.state))throw Error('second-chance-issue:parent-identity-mismatch')
  for(const row of existing)if(row.parentContinuation?.phase!=='consumed'){const feature=dnd5ePluginFeatureDefinition(row.featureId);if(!dnd5ePluginFeatureCurrentEnvelopeFullV1(row.featureId)||feature?.automation!=='full'||feature.declarativeAbility?.automation!=='full')throw Error('second-chance-issue:automatic-feature-required')}
  if(!additional)return activeSecondChanceParentReceipt(existing)!
  if(!isSecondChanceAdditionalIncoming(additional)||additional.transactionId!==input.parentTransactionId||!Number.isSafeInteger(additional.occurrence)||additional.occurrence<0)throw Error('second-chance-issue:invalid-additional-checkpoint')
  const prior=existing.find(row=>secondChanceOccurrence(row)===additional.occurrence)
  if(prior)return prior
  if(existing.some(row=>row.parentContinuation?.phase!=='ready'||row.parentContinuation.combatRevision!==revision(combat,'combat')||row.parentContinuation.characterRevision!==revision(characters,'characters'))||additional.occurrence<=secondChanceOccurrence(existing.at(-1)!))throw Error('second-chance-issue:additional-parent-not-ready')
 }else if(additional)throw Error('second-chance-issue:missing-original-parent')
 const normalizedGeometry=rawGeometry?normalizeSharedMapGeometry(rawGeometry):undefined
 if(rawGeometry&&!normalizedGeometry)throw Error('second-chance-issue:geometry-invalid')
 const snapshot=createDnd5eMapCombatSnapshot({map,characters:characters.characters,combatId:sceneScope?prepared!.prepared.state.combatId:combat.combatId!,round:combat.round,initiativeOrder:combat.initiativeOrder,geometry:normalizedGeometry?.maps.find(row=>row.mapId===map.id)??null})
 snapshot.state.initiativeIndex=combat.initiativeIndex
 for(const[id,actor]of Object.entries(snapshot.state.combatants)){const economy=combat.dnd5eTurnEconomyByToken?.[id];if(!economy)continue;if(sceneScope)continue;actor.turn={...actor.turn,actionAvailable:economy.action.current>0,bonusActionAvailable:economy.bonusAction.current>0,reactionAvailable:economy.reaction.current>0,movementRemaining:economy.movement.current,movementSpent:economy.movement.spent}}
 if(input.state){
  if(!input.action||input.state.combatId!==combat.combatId||input.state.round!==combat.round||!input.state.combatants[input.action.actorId])throw Error('second-chance-issue:invalid-original-native-state')
  snapshot.state=cloneDnd5eHostTransactionInput(input.state)
 }
 if(input.nativeContext){
  if(!input.action||input.nativeContext.map.id!==map.id||!input.nativeContext.characters.length||JSON.stringify(input.nativeContext.characterIdByCombatantId)!==JSON.stringify(snapshot.characterIdByCombatantId))throw Error('second-chance-issue:invalid-original-native-context')
 }
 if(prepared){
  const current=prepared.currentCombatState as typeof prepared.prepared.state|undefined??prepared.prepared.state
  const room=prepared.currentRoom as{maps:readonly BattleMap[];characters:readonly Character[]}|undefined
  const originalMap=room?room.maps.filter(row=>row.id===map.id):[prepared.prepared.map],roster=room?.characters??prepared.prepared.characters
  if(!sceneScope&&(current.combatId!==combat.combatId||current.round!==combat.round)||originalMap.length!==1||!samePreparedMap(originalMap[0],map)||roster.some(row=>!samePreparedCharacter(row,characters.characters.find(character=>character.id===row.id))))throw Error('second-chance-issue:stale-prepared-original')
  snapshot.state=current;snapshot.characterIdByCombatantId=prepared.prepared.characterIdByCombatantId
 }
 let pending:{status:'pending-incoming-attack';facts:import('../../rulesets/dnd5e/incomingAttackRerollCheckpoint').IncomingAttackRollFacts;snapshot:typeof snapshot.state;occurrence:number}
 if(additional){pending={status:'pending-incoming-attack',facts:additional.facts,snapshot:additional.snapshot,occurrence:additional.occurrence};snapshot.state=root!.parentInput!.state}
 else{
  const replay=input.preparedOriginal?await createSecondChancePreparedReplayAsync(input.preparedOriginal,nativeOptions?.now===undefined?undefined:{...nativeOptions,transactionId:input.parentTransactionId+':second-chance-prepared'}):createDnd5eDamageCommitSession(snapshot.state,input.action!,()=>false,{...nativeOptions,transactionId:input.parentTransactionId+':second-chance-native'})
  if('originalState'in replay)snapshot.state=replay.originalState
  let result:ReturnType<typeof replay.run>
  try{result=replay.run(snapshot.state)
   if(result.status==='pending-incoming-armor-class'&&input.arcaneBeforeSecondChance){
    await assertArcaneBeforeSecondChanceDecline(input.arcaneBeforeSecondChance,{parentTransactionId:input.parentTransactionId,preparedOriginal:input.preparedOriginal,facts:result.facts,occurrence:result.occurrence,now:nativeOptions?.now},gateway)
    result=replay.resumeIncomingArmorClass(snapshot.state,result.occurrence,result.facts,undefined)
   }
   if(result.status==='pending-incoming-hit-negation'&&input.armorBeforeSecondChance){
    await assertArmorBeforeSecondChanceDecline(input.armorBeforeSecondChance,{parentTransactionId:input.parentTransactionId,preparedOriginal:input.preparedOriginal,facts:result.facts,occurrence:result.occurrence},gateway)
    result=replay.resumeIncomingHitNegation(snapshot.state,result.occurrence,result.facts,undefined)
   }
  }finally{if('dispose'in replay)await replay.dispose()}
  if(result.status!=='pending-incoming-attack')throw Error('second-chance-issue:incoming-hit-not-awaiting-choice')
  pending=result
 } if(dnd5eHostTransactionHasCapabilities([input.action,input.state,input.options,input.nativeContext]))throw Error('second-chance-issue:parent-capability-recovery-required')
 const facts=pending.facts,options=dnd5eIncomingAttackRerollOptions(pending.snapshot,facts.event),option=input.featureId?options.find(row=>row.featureId===input.featureId):options.length===1?options[0]:undefined
 if(!option)throw Error('second-chance-issue:feature-choice-required')
 const ownerId=snapshot.characterIdByCombatantId[facts.event.targetId],owner=characters.characters.find(row=>row.id===ownerId)
 const rollerId=snapshot.characterIdByCombatantId[facts.event.actorId],roller=characters.characters.find(row=>row.id===rollerId)
 const controllerHost={roomId:session!.roomId,hostMemberId:session!.memberId},ownerController=secondChanceCanonicalControllerMemberId(owner,controllerHost),rollerController=roller?secondChanceCanonicalControllerMemberId(roller,controllerHost):session!.memberId
 if(sceneScope&&(owner?.dnd5eCombatState?.sceneReactionSpent||Object.values(combat.secondChanceAttacks??{}).some(row=>row.attack.transactionId!==input.parentTransactionId&&row.attack.targetCharacterId===ownerId&&row.attack.phase==='hit-confirmation'&&row.reactionDecision?.decision==='use')))throw Error('second-chance-issue:scene-reaction-reserved')
 if(!root&&Object.values(combat.secondChanceAttacks??{}).some(row=>row.attack.mapId===input.mapId&&row.parentContinuation?.phase!=='consumed'))throw Error('second-chance-issue:another-parent-pending')
 if(!owner||!ownerController||!rollerController)throw Error('second-chance-issue:controller-identity-unavailable')
 // Maps lazily creates economies only when an actor first takes its turn.
 // A defender may legally react before that first turn. Preserve every existing
 // pool; issue the absent defender pool under the SAME combat CAS as this receipt.
 const economies={...combat.dnd5eTurnEconomyByToken}
 if(!sceneScope&&!economies[facts.event.targetId]){
  const actor=pending.snapshot.combatants[facts.event.targetId]
  const fresh=createDnd5eTurnEconomyCounts(`${combat.combatId}:${combat.round}:${facts.event.targetId}`,actor.speed)
  fresh.reaction.current=actor.turn.reactionAvailable&&!actor.classState.normalReactionSpentThisTurn&&!actor.classState.sceneReactionSpent?1:0
  if(fresh.reaction.current!==1)throw Error('second-chance-issue:reaction-unavailable')
  economies[facts.event.targetId]=fresh
 }
 const id=`second-chance:${input.parentTransactionId}:${pending.occurrence}`
 const previous=combat.secondChanceAttacks?.[id]
 if(previous){if(previous.attack.transactionId!==input.parentTransactionId)throw Error('second-chance-issue:parent-identity-mismatch');return previous}
 const originalClockAuthority=root?root.postNativeClockAuthority:await captureSecondChanceOriginalClockAuthority(originalClock??null)
 const receipt:PersistedSecondChanceAttack={postNativeClockAuthority:originalClockAuthority,sceneScope,incomingOccurrence:pending.occurrence,attack:{schemaVersion:1,id,transactionId:input.parentTransactionId,mapId:map.id,combatId:snapshot.state.combatId,rollerTokenId:facts.event.actorId,rollerCharacterId:rollerId,rollerControllerMemberId:rollerController,targetTokenId:facts.event.targetId,targetCharacterId:owner.id,targetControllerMemberId:ownerController,dice:[...facts.dice],mode:facts.mode,modifier:facts.modifier,armorClass:facts.event.armorClass,criticalThreshold:dnd5eTargetCriticalThreshold(pending.snapshot.combatants[facts.event.targetId].classState.activeEffects,facts.event.actorId,facts.criticalThreshold),forceHit:facts.forceHit,automaticCritical:facts.automaticCritical,phase:'hit-confirmation'},featureId:option.featureId,characterRevision:revision(characters,'characters'),mapRevision:revision(maps,'maps'),geometryRevision:revision(rawGeometry,'map-geometry'),turnKey:sceneScope?`scene-reaction:${sceneScope.roomId}:${owner.id}`:economies[facts.event.targetId].turnKey,canSeeRoller:true,canUseReaction:true,reactionReserved:false,parentInput:root?.parentInput??{state:snapshot.state,nativeContext:structuredClone(input.nativeContext),action:structuredClone(input.action),prepared:structuredClone(input.preparedOriginal),options:structuredClone(nativeOptions),characterIdByCombatantId:snapshot.characterIdByCombatantId}}
 const nextAttacks={...combat.secondChanceAttacks,[id]:receipt}
 receipt.featureDefinitionSignature=JSON.stringify(dnd5ePluginFeatureDefinition(option.featureId)?.declarativeAbility)
 receipt.hostControllerMemberId=root?root.hostControllerMemberId:session!.memberId
 receipt.parentDefinitionSignature=root?.parentDefinitionSignature??await secondChanceParentDefinitionSignature(snapshot.state);guard()
 const queue=await gateway.loadResource<{requests:import('../../lib/sharedCombatTypes').SharedPlayerActionState[]}>('player-action-requests');guard()
 const originalRoomAction=queue?.requests.find(row=>row.id===input.parentTransactionId&&row.mapId===input.mapId&&(sceneScope?row.combatId===(prepared?.prepared as unknown as{action?:{combatId?:string}}).action?.combatId:row.combatId===combat.combatId))
 if(root?.originalRoomAction||originalRoomAction)receipt.originalRoomAction=structuredClone(root?.originalRoomAction??originalRoomAction!)
 if(!validateSecondChanceAttackReceipts(nextAttacks))throw Error('second-chance-issue:invalid-persisted-receipts')
 guard();await gateway.saveResourcesAtomically([{name:'combat',expectedRevision:revision(combat,'combat'),data:advanceSecondChanceParentRevisions({...combat,...(!sceneScope?{dnd5eTurnEconomyByToken:economies}:{}),secondChanceAttacks:nextAttacks},input.parentTransactionId,revision(combat,'combat')+1)}],{transactionId:`second-chance-issue:${id}`,readRevisions:{characters:receipt.characterRevision,maps:receipt.mapRevision,'map-geometry':receipt.geometryRevision!,...(sceneScope?{'campaign-time':sceneScope.campaignTimeRevision}:!root&&originalClockAuthority?{'campaign-time':originalClockAuthority.revision}:{})},undoLabel:'原攻击等待花开二度反应'});guard();return receipt
}
