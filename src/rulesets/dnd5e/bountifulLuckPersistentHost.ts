import{readDnd5ePluginSpellCompoundPrimaryPendingQualification,type Dnd5ePluginSpellCompoundPrimaryPendingQualification}from'./pluginSpellCompoundPrimaryPendingQualification'
import{withActivityAttackOriginalMissing}from'./activities/activityAttackOriginalMissing'
import{readDnd5ePluginSpellSavingCompoundQualification,readDnd5ePluginSpellSavingBeforeQualification,createDnd5ePluginSpellSavingQualifiedD20Session}from'./pluginSpellSavingOriginalOperation'
import{readDnd5ePluginSpellSavingOriginalQualification,type Dnd5ePluginSpellSavingOriginalQualification}from'./pluginSpellSavingOriginalOperation'
import{withActivitySavingOriginalMissing}from'./activities/activitySavingOriginalMissing'
import{readDnd5eSpellcastingBountifulOriginalQualification,type Dnd5eSpellcastingBountifulOriginalQualification}from'./spellcastingBountifulOriginalBoundary'
import{readBountifulOpportunitySequenceOriginalClock,readBountifulOpportunitySequenceOriginalClockPlain}from'./bountifulOpportunitySequenceOriginalClock'
import{resolvePreparedDnd5eDeathSavingTurn}from'./deathSaveTurnAction'
import{withActivityAbilityOriginalMissing}from'./activities/activityAbilityOriginalMissing'
import{readBountifulPluginSpellAbilityOriginalQualification,type BountifulPluginSpellAbilityOriginalQualification}from'./bountifulPluginSpellAbilityOriginalBoundary'
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
import{readBountifulActivityOriginalQualification,type BountifulActivityOriginalQualification}from'./bountifulActivityOriginalQualification'
import{createBountifulActivityOriginalNativePort,withBountifulActivityOriginalNativePort,disposeBountifulActivityOriginalNativePort,resolveBountifulPreparedActivityOriginal}from'./bountifulActivityOriginalPort'
import{loadTempestuousBeforeReplayForOriginal}from'./tempestuousBeforeOriginalPort'
import{withTempestuousBeforePlainOriginalReplay}from'./tempestuousBeforePreparedOriginalReplay'
import{readBountifulSpellDamageZeroOriginalQualification,type BountifulSpellDamageZeroOriginalQualification}from'./bountifulSpellDamageZeroOriginalQualification'
import{withStormCastPreparedOriginalReplay}from'./stormCastPreparedOriginalReplay'
import{loadStormCastReplayForActualPending,type StormCastBountifulOriginalPort}from'./stormCastBountifulOriginalPort'
import{readBountifulDamageZeroOriginalQualification,type BountifulDamageZeroOriginalQualification}from'./bountifulDamageZeroOriginalQualification'
import{readBountifulSequenceOriginalTarget}from'./bountifulOpportunitySequencePostNativeReplay'
import{withBountifulOpportunitySequencePostNativeReplay}from'./bountifulOpportunitySequencePostNativeReplay'
import {resolveDnd5eOpportunityMoveSequenceOriginal} from './opportunityMoveSequence'
import {resolvePreparedDnd5eOpportunityPlayerMove} from './opportunityMoveAction'
import {saveBountifulPhase} from './bountifulPhaseCommit'
import {bountifulUnconsumedParentRows} from '../../../shared/bountiful-parent-retention.mjs'
import {captureBountifulOriginalSceneScope,assertBountifulOriginalSceneScope} from './bountifulOriginalSceneScope'
import {bountifulOriginalScopeMatches} from '../../../shared/bountiful-original-scope.mjs'
import {bountifulNativeOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import {processBountifulEquipmentResponse} from './bountifulEquipmentContinuationHost'
import {bountifulPreparedController,bountifulPreparedOriginalRoller} from './bountifulPreparedController'
import {validateBountifulOriginalParents,validateBountifulLuckCommand} from '../../../shared/bountiful-luck-state.mjs'
import {cloneDnd5eHostTransactionInput} from '../../../src/rulesets/dnd5e/hostTransactionClone'
import {resolvePreparedDnd5eAbilityCheck} from '../../../src/rulesets/dnd5e/abilityCheckAction'
import {resolvePreparedDnd5eEquipmentAttack} from '../../../src/rulesets/dnd5e/equipmentAttackAction'
import {resolvePreparedDnd5eMonsterAttack} from '../../../src/rulesets/dnd5e/monsterAttackAction'
import {resolvePreparedDnd5eOpportunityAttack} from '../../../src/rulesets/dnd5e/opportunityAttackAction'
import {resolvePreparedDnd5eSpellCast} from '../../../src/rulesets/dnd5e/spellAction'
import {resolvePreparedDnd5ePluginSpellCast} from '../../../src/rulesets/dnd5e/pluginSpellTransaction'
import {resolvePreparedDnd5eClassFeature} from '../../../src/rulesets/dnd5e/classFeatureAction'
export const actualBountifulResolvers={'death-save':resolvePreparedDnd5eDeathSavingTurn,'plugin-feature':resolveBountifulPreparedActivityOriginal,'opportunity-move-sequence':resolveDnd5eOpportunityMoveSequenceOriginal,'opportunity-move':resolvePreparedDnd5eOpportunityPlayerMove,'ability-check':resolvePreparedDnd5eAbilityCheck,equipment:resolvePreparedDnd5eEquipmentAttack,monster:resolvePreparedDnd5eMonsterAttack,opportunity:resolvePreparedDnd5eOpportunityAttack,spell:resolvePreparedDnd5eSpellCast,'plugin-spell':resolvePreparedDnd5ePluginSpellCast,'class-feature':resolvePreparedDnd5eClassFeature} as const
import {getRoomSession} from '../../../src/lib/roomSession'
import type {SharedRoomGatewayPort} from '../../../src/ports/sharedRoomGateway'
import type {Character} from '../../../src/types/character'
import type {BattleMap} from '../../../src/store/maps'
import {createDnd5eOriginalD20Session} from '../../../src/rulesets/dnd5e/damageCommitSession'
import {encodeSecondChanceParentWire} from '../../../src/lib/secondChanceParentWire'
import {captureSecondChancePreparedHostFacts} from '../../../src/pages/maps/secondChancePreparedHostFacts'
import type {AllyNaturalOneKind} from './allyNaturalOneCheckpoint'
import {createBountifulOriginalDieReceipt,applyBountifulStampedDieResponse,type BountifulOriginalDieReceipt,type BountifulStampedDieResponse} from './bountifulLuckReceipt'
import type {Dnd5eHeadlessCombatState} from '../../../src/rulesets/dnd5e/headlessCombatEngine'

type Revisioned<T>=T&{_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>&Partial<Pick<SharedRoomGatewayPort,'publishEvent'>>&StormCastBountifulOriginalPort
interface Combat{mapId?:string;combatId?:string;active?:boolean;round?:number;initiativeIndex?:number;dnd5eTurnEconomyByToken?:Record<string,{turnKey:string;reaction:{current:number}}>;bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
interface QueueRow{id:string;type:string;status:string;round:number;initiativeIndex:number;roomMemberId?:string;sourceMode:'dm'|'player';mapId:string;combatId?:string;actorTokenId:string;characterId:string;bountifulLuck?:Omit<BountifulStampedDieResponse,'id'|'roomId'|'mapId'|'combatId'|'roomMemberId'|'sourceMode'|'actorTokenId'|'characterId'>}
const revision=(value:Revisioned<object>)=>{const current=value._sync?.revision;if(!Number.isSafeInteger(current)||current!<0)throw Error('bountiful-parent:revision-required');return current!}
function requireHost(){const session=getRoomSession();if(!session||session.role!=='dm')throw Error('bountiful-parent:host-required');return session}
function hostGuard(session:ReturnType<typeof requireHost>){const current=requireHost();if(current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('bountiful-parent:host-changed')}
export function bountifulOriginalParentReceiptId(parentId:string,occurrence:number){return JSON.stringify(['bountiful-original-parent',parentId,occurrence])}

/** Trusted Maps parent entry. The resolver must be the actual prepared facade,
 * already selected by the Host caller, and no client submission enters here.
 * This records only a pending original-die boundary, never a fabricated outcome. */

/** Shape narrowing only. The opaque replay's issuer remains the authority. */
function hasSequenceReplayAction<T extends{prepared:object}>(source:T):source is T&{prepared:{action:{id:string}}}{
 const prepared=source.prepared
 return 'action'in prepared&&!!prepared.action&&typeof prepared.action==='object'&&'id'in prepared.action&&typeof prepared.action.id==='string'
}

export async function persistBountifulOriginalParent<Input extends {prepared:{state:Dnd5eHeadlessCombatState;map:BattleMap;characters:readonly Character[];characterIdByCombatantId:Record<string,string>}},Result>(input:{nativeLuckyChoiceVersion?:1;parentId:string;source:Input;resolve:(input:Input)=>Result;actorId:string;kind:AllyNaturalOneKind;opportunitySequencePostNativeReplay?:object;damageZeroOriginalQualification?:BountifulDamageZeroOriginalQualification;spellDamageZeroOriginalQualification?:BountifulSpellDamageZeroOriginalQualification;activityOriginalQualification?:BountifulActivityOriginalQualification;pluginSpellAbilityOriginalQualification?:BountifulPluginSpellAbilityOriginalQualification;pluginSpellSavingOriginalQualification?:Dnd5ePluginSpellSavingOriginalQualification;pluginSpellCompoundPrimaryOriginalQualification?:Dnd5ePluginSpellCompoundPrimaryPendingQualification;spellcastingOriginalQualification?:Dnd5eSpellcastingBountifulOriginalQualification},gateway:Gateway){
 const session=requireHost(),prepared=input.source.prepared
 const resolverIdentity:unknown=input.resolve
 const originalAdapterId=Object.entries(actualBountifulResolvers).find(([,resolve])=>resolve===resolverIdentity)?.[0]
 if(!originalAdapterId)throw Error('bountiful-parent:actual-prepared-facade-required')
 if(input.damageZeroOriginalQualification!==undefined&&input.spellDamageZeroOriginalQualification!==undefined)throw Error('bountiful-parent:ambiguous-damage-zero-original')
 const equipmentZero=input.damageZeroOriginalQualification!==undefined?readBountifulDamageZeroOriginalQualification(input.damageZeroOriginalQualification,input.source):undefined
 const spellZero=input.spellDamageZeroOriginalQualification!==undefined?readBountifulSpellDamageZeroOriginalQualification(input.spellDamageZeroOriginalQualification,input.source):undefined
 if(equipmentZero&&(resolverIdentity!==resolvePreparedDnd5eEquipmentAttack||input.kind!=='saving-throw'||input.actorId!==equipmentZero.request.actorId))throw Error('bountiful-parent:actual-damage-zero-original-required')
 if(spellZero&&(resolverIdentity!==resolvePreparedDnd5eSpellCast||input.kind!=='saving-throw'||input.actorId!==spellZero.request.actorId))throw Error('bountiful-parent:actual-spell-damage-zero-original-required')
 const damageZero=equipmentZero??spellZero
 const casterOriginal=input.spellcastingOriginalQualification===undefined?undefined:readDnd5eSpellcastingBountifulOriginalQualification(input.spellcastingOriginalQualification,input.source as unknown as Parameters<typeof readDnd5eSpellcastingBountifulOriginalQualification>[1])
 if(casterOriginal&&(resolverIdentity!==resolvePreparedDnd5eSpellCast||input.kind!=='saving-throw'||input.actorId!==casterOriginal.request.actorId||damageZero||input.activityOriginalQualification!==undefined||input.pluginSpellAbilityOriginalQualification!==undefined||input.opportunitySequencePostNativeReplay!==undefined))throw Error('bountiful-parent:actual-caster-original-required')
 const pluginSpellAbilityOriginal=input.pluginSpellAbilityOriginalQualification===undefined?undefined:readBountifulPluginSpellAbilityOriginalQualification(input.pluginSpellAbilityOriginalQualification,input.source as unknown as Parameters<typeof readBountifulPluginSpellAbilityOriginalQualification>[1])
 if(pluginSpellAbilityOriginal&&(resolverIdentity!==resolvePreparedDnd5ePluginSpellCast||input.kind!=='ability-check'||input.actorId!==pluginSpellAbilityOriginal.request.actorId||damageZero||input.activityOriginalQualification!==undefined||input.opportunitySequencePostNativeReplay!==undefined))throw Error('bountiful-parent:actual-plugin-spell-ability-original-required')
 const pluginSpellSavingOriginal=input.pluginSpellSavingOriginalQualification===undefined?undefined:readDnd5ePluginSpellSavingOriginalQualification(input.pluginSpellSavingOriginalQualification,input.source as unknown as Parameters<typeof readDnd5ePluginSpellSavingOriginalQualification>[1])
 const compoundPrimaryOriginal=input.pluginSpellCompoundPrimaryOriginalQualification===undefined?undefined:readDnd5ePluginSpellCompoundPrimaryPendingQualification(input.pluginSpellCompoundPrimaryOriginalQualification,input.source as unknown as Parameters<typeof readDnd5ePluginSpellCompoundPrimaryPendingQualification>[1])
 if(compoundPrimaryOriginal&&(resolverIdentity!==resolvePreparedDnd5ePluginSpellCast||input.kind!=='attack'||input.actorId!==compoundPrimaryOriginal.request.actorId||damageZero||input.activityOriginalQualification!==undefined||input.pluginSpellAbilityOriginalQualification!==undefined||input.pluginSpellSavingOriginalQualification!==undefined||input.spellcastingOriginalQualification!==undefined||input.opportunitySequencePostNativeReplay!==undefined))throw Error('bountiful-parent:actual-compound-primary-original-required')
 if(pluginSpellSavingOriginal&&(resolverIdentity!==resolvePreparedDnd5ePluginSpellCast||input.kind!=='saving-throw'||input.actorId!==pluginSpellSavingOriginal.request.actorId||damageZero||input.activityOriginalQualification!==undefined||input.pluginSpellAbilityOriginalQualification!==undefined||input.spellcastingOriginalQualification!==undefined||input.opportunitySequencePostNativeReplay!==undefined))throw Error('bountiful-parent:actual-plugin-spell-saving-original-required')
 const activityOriginal=input.activityOriginalQualification===undefined?undefined:readBountifulActivityOriginalQualification(input.activityOriginalQualification,input.source as unknown as Parameters<typeof readBountifulActivityOriginalQualification>[1])
 if(resolverIdentity===resolveBountifulPreparedActivityOriginal&&!activityOriginal||activityOriginal&&(resolverIdentity!==resolveBountifulPreparedActivityOriginal||input.kind!=='ability-check'||input.actorId!==activityOriginal.request.actorId||damageZero||input.opportunitySequencePostNativeReplay!==undefined))throw Error('bountiful-parent:actual-activity-original-required')
 if(input.opportunitySequencePostNativeReplay!==undefined){if(resolverIdentity!==resolveDnd5eOpportunityMoveSequenceOriginal||!hasSequenceReplayAction(input.source))throw Error('bountiful-parent:actual-sequence-post-native-replay-required');withBountifulOpportunitySequencePostNativeReplay(input.source,input.opportunitySequencePostNativeReplay)}
 const [combat,characters,maps,geometry,queue]=await Promise.all([
  gateway.loadResource<Revisioned<Combat>>('combat'),gateway.loadResource<Revisioned<{characters:Character[]}>>('characters'),
  gateway.loadResource<Revisioned<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Revisioned<object>>('map-geometry'),
  gateway.loadResource<Revisioned<{requests:QueueRow[]}>>('player-action-requests')])
 hostGuard(session)
 const original=queue?.requests.find(row=>row.id===input.parentId)
 if(!combat||!characters||!maps||!queue||!original||original.status!=='pending'||original.mapId!==prepared.map.id||original.round!==prepared.state.round||original.initiativeIndex!==prepared.state.initiativeIndex||(combat.active===true?(combat.mapId!==prepared.map.id||combat.combatId!==prepared.state.combatId||original.combatId!==combat.combatId||combat.round!==prepared.state.round||combat.initiativeIndex!==prepared.state.initiativeIndex):(combat.active!==false||original.combatId!==undefined)))throw Error('bountiful-parent:original-room-action-required')
 if(JSON.stringify(maps.maps.find(map=>map.id===prepared.map.id))!==JSON.stringify(prepared.map)||JSON.stringify(characters.characters)!==JSON.stringify(prepared.characters))throw Error('bountiful-parent:stale-original-snapshot')
 if(combat.bountifulOriginalParents&&!validateBountifulOriginalParents(combat.bountifulOriginalParents))throw Error('bountiful-parent:invalid-stored-originals')
 const preparedRoomAction='action'in prepared?prepared.action:undefined
 if(JSON.stringify(preparedRoomAction)!==JSON.stringify(original))throw Error('bountiful-parent:queued-parent-command-mismatch')
 const id=bountifulOriginalParentReceiptId(input.parentId,0),prior=combat.bountifulOriginalParents?.[id]
 if(prior)return structuredClone(prior)
 const authoritativeSource=cloneDnd5eHostTransactionInput(input.source)
 const authoritativeState=authoritativeSource.prepared.state
 for(const actor of Object.values(authoritativeState.combatants)){
  const stored=combat.dnd5eTurnEconomyByToken?.[actor.id]
  const active=authoritativeState.initiativeOrder[authoritativeState.initiativeIndex]===actor.id
  const slot=authoritativeState.initiativeSlotIds?.[authoritativeState.initiativeIndex]??actor.id
  const expected=authoritativeState.combatId+':'+authoritativeState.round+':'+slot
  if(stored&&(!active||stored.turnKey===expected))actor.turn.reactionAvailable=stored.reaction.current>0
 }
 let probeSource=authoritativeSource
 const pluginSpellFormulaOriginal=compoundPrimaryOriginal??pluginSpellSavingOriginal??pluginSpellAbilityOriginal
 if(pluginSpellFormulaOriginal){const clock=pluginSpellFormulaOriginal.effectTimestamp,parent=authoritativeSource.prepared as typeof authoritativeSource.prepared&{action:Parameters<typeof originalD20ReplaySourceKey>[2]};probeSource={...authoritativeSource,hostOriginalD20Replay:{parentId:input.parentId,sourceKey:originalD20ReplaySourceKey(input.parentId,parent.state,parent.action,clock),effectTimestamp:clock,facts:[]}}}
 if(input.opportunitySequencePostNativeReplay!==undefined){if(!hasSequenceReplayAction(authoritativeSource))throw Error('bountiful-parent:actual-sequence-post-native-replay-required');probeSource=withBountifulOpportunitySequencePostNativeReplay(authoritativeSource,input.opportunitySequencePostNativeReplay)}
 const sequenceOriginalClock=readBountifulOpportunitySequenceOriginalClock(probeSource,input.resolve)
  const tempestuousBeforePreparedReplay=await loadTempestuousBeforeReplayForOriginal(authoritativeSource,input.resolve,gateway)
 let observedTimestamp:number|undefined
 const run=()=>{const replay=pluginSpellSavingOriginal&&(readDnd5ePluginSpellSavingBeforeQualification(input.pluginSpellSavingOriginalQualification!)||readDnd5ePluginSpellSavingCompoundQualification(input.pluginSpellSavingOriginalQualification!))?createDnd5ePluginSpellSavingQualifiedD20Session(input.pluginSpellSavingOriginalQualification!,probeSource as unknown as Parameters<typeof createDnd5ePluginSpellSavingQualifiedD20Session>[1],input.actorId)as unknown as ReturnType<typeof createDnd5eOriginalD20Session<Input,Result>>:createDnd5eOriginalD20Session(probeSource,input.resolve,input.actorId,input.kind);try{const pending=replay.run(authoritativeState);observedTimestamp=replay.originalEffectTimestamp();return pending}finally{replay.cancel()}}
 let pending:ReturnType<typeof run>
 if(activityOriginal){const source=authoritativeSource as unknown as Parameters<typeof createBountifulActivityOriginalNativePort>[0],port=createBountifulActivityOriginalNativePort(source,input.activityOriginalQualification!);try{pending=withBountifulActivityOriginalNativePort(port,source,probe=>{probeSource=probe as unknown as Input;return run()})}finally{await disposeBountifulActivityOriginalNativePort(port)}}
 else pending=compoundPrimaryOriginal?withActivityAttackOriginalMissing(run):pluginSpellSavingOriginal?withActivitySavingOriginalMissing(run):pluginSpellAbilityOriginal?withActivityAbilityOriginalMissing(run):tempestuousBeforePreparedReplay?withTempestuousBeforePlainOriginalReplay(authoritativeSource as unknown as Parameters<typeof resolvePreparedDnd5eSpellCast>[0],tempestuousBeforePreparedReplay,run):run()
 let stormEffectTimestamp:number|undefined=tempestuousBeforePreparedReplay?observedTimestamp:undefined
 if(pending.status==='pending-storm-cast'){const proof=await loadStormCastReplayForActualPending(pending,gateway);pending=withStormCastPreparedOriginalReplay(authoritativeSource,proof,()=>{const actual=createDnd5eOriginalD20Session(authoritativeSource,input.resolve,input.actorId,input.kind);try{const result=actual.run(authoritativeState);stormEffectTimestamp=actual.originalEffectTimestamp();return result}finally{actual.cancel()}})}
 if(sequenceOriginalClock&&observedTimestamp!==sequenceOriginalClock.effectTimestamp)throw Error('opportunity-original-clock:actual-session-clock-required')
  if(pending.status!=='pending-ally-natural-one'||pending.occurrence!==0)throw Error('bountiful-parent:actual-original-checkpoint-required')
 const request=pending.request
 if(compoundPrimaryOriginal&&(observedTimestamp!==compoundPrimaryOriginal.effectTimestamp||JSON.stringify(request)!==JSON.stringify(compoundPrimaryOriginal.request)))throw Error('bountiful-parent:exact-compound-primary-original-required')
 if(pluginSpellAbilityOriginal&&(observedTimestamp!==pluginSpellAbilityOriginal.effectTimestamp||JSON.stringify(request)!==JSON.stringify(pluginSpellAbilityOriginal.request)))throw Error('bountiful-parent:exact-plugin-spell-ability-original-required')
 if(casterOriginal&&(observedTimestamp!==casterOriginal.effectTimestamp||JSON.stringify(request)!==JSON.stringify(casterOriginal.request)))throw Error('bountiful-parent:exact-caster-original-required')
 if(pluginSpellSavingOriginal&&(observedTimestamp!==pluginSpellSavingOriginal.effectTimestamp||JSON.stringify(request)!==JSON.stringify(pluginSpellSavingOriginal.request)))throw Error('bountiful-parent:exact-plugin-spell-saving-original-required')
 const rollerController=bountifulPreparedOriginalRoller(prepared,request.actorId,session.memberId)
 const controllers=Object.fromEntries(request.options.map(option=>[option.ownerId,bountifulPreparedController(prepared,option.ownerId,session.memberId)]))
 const sceneScope=await captureBountifulOriginalSceneScope(combat,gateway)
 let concentrationOriginal:ReturnType<typeof readBountifulSequenceOriginalTarget>
 if(input.kind==='saving-throw'&&input.opportunitySequencePostNativeReplay!==undefined&&hasSequenceReplayAction(authoritativeSource)){
  concentrationOriginal=readBountifulSequenceOriginalTarget(authoritativeSource,input.opportunitySequencePostNativeReplay)
  if(concentrationOriginal&&(concentrationOriginal.actorId!==request.actorId||JSON.stringify(concentrationOriginal.raw)!==JSON.stringify(request.originalRolls)))throw Error('bountiful-parent:exact-actual-CON-original-required')
 }
 const receipt=createBountifulOriginalDieReceipt({...((request.nativeLucky&&input.nativeLuckyChoiceVersion===1)?{nativeLuckyChoiceVersion:1 as const}:{}),rawIssuer:compoundPrimaryOriginal?.rawIssuer??casterOriginal?.rawIssuer??pluginSpellSavingOriginal?.rawIssuer??pluginSpellAbilityOriginal?.rawIssuer??activityOriginal?.rawIssuer??damageZero?.rawIssuer??concentrationOriginal?.rawIssuer??bountifulNativeOriginalRawIssuer(authoritativeSource,request),identity:{...(compoundPrimaryOriginal?{effectTimestamp:compoundPrimaryOriginal.effectTimestamp}:casterOriginal?{effectTimestamp:casterOriginal.effectTimestamp}:pluginSpellSavingOriginal?{effectTimestamp:pluginSpellSavingOriginal.effectTimestamp}:pluginSpellAbilityOriginal?{effectTimestamp:pluginSpellAbilityOriginal.effectTimestamp}:activityOriginal?{effectTimestamp:activityOriginal.effectTimestamp}:damageZero?{effectTimestamp:damageZero.effectTimestamp}:sequenceOriginalClock?{effectTimestamp:sequenceOriginalClock.effectTimestamp}:stormEffectTimestamp===undefined?{}:{effectTimestamp:stormEffectTimestamp}),sceneScope,roomId:session.roomId,mapId:prepared.map.id,combatId:prepared.state.combatId,parentId:input.parentId,occurrence:0,round:prepared.state.round,initiativeIndex:prepared.state.initiativeIndex,reactionEconomySignature:JSON.stringify(combat.dnd5eTurnEconomyByToken??{}),roller:rollerController,hostMemberId:session.memberId,revisions:{characters:revision(characters),maps:revision(maps),'map-geometry':geometry?revision(geometry):0,...(sceneScope?{'campaign-time':sceneScope.campaignTimeRevision}:{})}},
  originalCheckpoint:{actorId:input.actorId,kind:input.kind},originalAdapterId,originalRoomAction:{...original},originalParent:encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(readBountifulOpportunitySequenceOriginalClockPlain(authoritativeSource))),request,controllers})
 if(compoundPrimaryOriginal)readDnd5ePluginSpellCompoundPrimaryPendingQualification(input.pluginSpellCompoundPrimaryOriginalQualification!,authoritativeSource as unknown as Parameters<typeof readDnd5ePluginSpellCompoundPrimaryPendingQualification>[1])
 if(casterOriginal)readDnd5eSpellcastingBountifulOriginalQualification(input.spellcastingOriginalQualification!,authoritativeSource as unknown as Parameters<typeof readDnd5eSpellcastingBountifulOriginalQualification>[1])
 if(pluginSpellAbilityOriginal)readBountifulPluginSpellAbilityOriginalQualification(input.pluginSpellAbilityOriginalQualification!,authoritativeSource as unknown as Parameters<typeof readBountifulPluginSpellAbilityOriginalQualification>[1])
 if(pluginSpellSavingOriginal)readDnd5ePluginSpellSavingOriginalQualification(input.pluginSpellSavingOriginalQualification!,authoritativeSource as unknown as Parameters<typeof readDnd5ePluginSpellSavingOriginalQualification>[1])
 hostGuard(session)
 await gateway.publishEvent?.('bountiful-original-mint-dm-to-host',{id,receipt})
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:{...bountifulUnconsumedParentRows(combat.bountifulOriginalParents),[id]:receipt}}}],{transactionId:'bountiful-original-issue:'+id,readRevisions:{...receipt.identity.revisions,'player-action-requests':revision(queue)}})
 hostGuard(session);return receipt
}

/** Reloads the server-stamped append queue by request ID; there is deliberately
 * no principal or result argument. This stage writes choices only: HP, reactions,
 * and Lucky suspension remain unchanged until the real parent final CAS. */
export async function processBountifulOriginalResponse(input:{mapId:string;requestId:string},gateway:Gateway){
 const session=requireHost()
 const [combat,queue]=await Promise.all([gateway.loadResource<Revisioned<Combat>>('combat'),gateway.loadResource<Revisioned<{requests:QueueRow[]}>>('player-action-requests')]);hostGuard(session)
 const row=queue?.requests.find(row=>row.id===input.requestId),command=row?.bountifulLuck
 if(combat&&queue&&row?.status==='done'&&!!row.roomMemberId&&row.type==='dnd5e-bountiful-luck'&&row.mapId===input.mapId&&command&&validateBountifulLuckCommand(command)&&validateBountifulOriginalParents(combat.bountifulOriginalParents??{})){
  const prior=combat.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(command.parentId,command.occurrence)],identity=prior?.identity,c=command.command
  if(prior&&identity&&identity.roomId===session.roomId&&identity.hostMemberId===session.memberId&&identity.mapId===row.mapId&&identity.combatId===row.combatId&&prior.processedRequestIds.includes(row.id)){
   const roller=identity.roller,rollerMatches=row.roomMemberId===roller.memberId&&row.actorTokenId===roller.tokenId&&row.characterId===roller.characterId&&(roller.kind!=='host-token'||row.sourceMode==='dm'),validMode=(row.sourceMode==='player'||row.sourceMode==='dm'&&row.roomMemberId===identity.hostMemberId)
   const matched=c.phase==='native-lucky'?rollerMatches&&prior.nativeLuckyChoiceVersion===1&&prior.nativeLuckyDecision!==undefined&&prior.nativeLuckyDecision.memberId===row.roomMemberId&&prior.nativeLuckyDecision.decision===c.decision:c.phase==='reaction'?prior.ownerDecisions.some(d=>d.ownerId===c.ownerId&&d.featureId===c.featureId&&d.memberId===row.roomMemberId&&d.decision===c.decision)&&row.actorTokenId===c.ownerId&&row.characterId===prior.controllers[c.ownerId]?.characterId:c.phase==='roll'?rollerMatches&&prior.rawReroll!==undefined&&prior.rawReroll.memberId===row.roomMemberId&&prior.rawReroll.requestId===c.rollRequestId&&prior.rawReroll.value===c.value:c.phase==='confirm'?row.sourceMode==='dm'&&row.roomMemberId===identity.hostMemberId&&row.actorTokenId===roller.tokenId&&row.characterId===roller.characterId&&prior.hostReroll!==undefined&&prior.hostReroll.memberId===row.roomMemberId&&prior.hostReroll.requestId===c.rollRequestId&&prior.hostReroll.rawValue===c.rawValue&&prior.hostReroll.value===c.value:false
   if(validMode&&matched){hostGuard(session);return structuredClone(prior)}
  }
  throw Error('bountiful-parent:authenticated-response-required')
 }
 if(!combat||!queue||!row||!validateBountifulOriginalParents(combat.bountifulOriginalParents??{})||row.type!=='dnd5e-bountiful-luck'||row.status!=='pending'||row.mapId!==input.mapId||!row.roomMemberId||!command||!validateBountifulLuckCommand(command))throw Error('bountiful-parent:authenticated-response-required')
 if(command.command.phase.startsWith('equipment-'))return (await processBountifulEquipmentResponse({mapId:input.mapId,parentId:command.parentId,requestId:input.requestId},gateway)).parent
 const id=bountifulOriginalParentReceiptId(command.parentId,command.occurrence),receipt=combat.bountifulOriginalParents?.[id]
 if(!receipt||receipt.identity.roomId!==session.roomId||receipt.identity.hostMemberId!==session.memberId||!bountifulOriginalScopeMatches(combat,receipt.identity)||receipt.identity.reactionEconomySignature!==JSON.stringify(combat.dnd5eTurnEconomyByToken??{})||!queue.requests.some(original=>original.id===receipt.identity.parentId&&original.status==='pending'&&original.mapId===input.mapId&&JSON.stringify(original)===JSON.stringify(receipt.originalRoomAction)))throw Error('bountiful-parent:stored-parent-required')
 await assertBountifulOriginalSceneScope(combat,receipt.identity,gateway)
 if(row.combatId!==receipt.identity.combatId)throw Error('bountiful-parent:foreign-response-scope')
 if(command.command.phase!=='native-lucky'&&command.command.phase!=='reaction'&&command.command.phase!=='roll'&&command.command.phase!=='confirm')throw Error('bountiful-parent:invalid-response-shape')
 const next=applyBountifulStampedDieResponse(receipt,{...command,command:command.command,id:row.id,roomId:session.roomId,mapId:row.mapId,combatId:row.combatId!,roomMemberId:row.roomMemberId,sourceMode:row.sourceMode,actorTokenId:row.actorTokenId,characterId:row.characterId})
 hostGuard(session)
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:{...combat.bountifulOriginalParents,[id]:next}}},{name:'player-action-requests',expectedRevision:revision(queue),data:{...queue,requests:queue.requests.map(request=>request.id===row.id?{...request,status:'done'}:request)}}],{transactionId:'bountiful-original-response:'+row.id,readRevisions:receipt.identity.revisions})
 hostGuard(session);return next
}
