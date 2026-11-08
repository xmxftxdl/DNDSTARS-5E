import {validBountifulHostOperation} from '../../../shared/bountiful-host-operation.mjs'
import type {Character} from '../../types/character'
import type {SecondChanceCombat} from '../../lib/secondChanceHostState'
import {prepareSecondChanceCommit,selectSecondChanceAttackDie} from '../../lib/secondChanceIncomingAttack'
import {spendClassResource} from '../../lib/classResources'
import {decodeSecondChanceParentWire,encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {secondChanceParentDefinitionSignature} from '../../lib/secondChanceParentSignature'
import {validateSecondChanceAttackReceipts} from '../../../shared/second-chance-state.mjs'
import {dnd5eCharacterHasPluginFeature,dnd5ePluginFeatureCurrentEnvelopeFullV1,dnd5ePluginFeatureDefinition} from './plugins/pluginContentCatalog'
import {dnd5eDeclarativeResourceKey} from './plugins/pluginDeclarativeCompiler'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'
import {originalD20ReplaySourceKey} from './allyNaturalOneCheckpoint'
import {decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {bountifulPreparedController} from './bountifulPreparedController'
import type {resolvePreparedDnd5eMonsterAttack} from './monsterAttackAction'

type Source=Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
function fail():never{throw Error('bountiful-native-sc:unproven-cost-delta')}
/** Read-only reconstruction of this native parent's already committed SC costs.
 * This never authorizes another prepared state, source DTO, or character edit. */
export async function assertBountifulNativeSecondChanceCosts(input:{combat:Pick<Partial<SecondChanceCombat>,'secondChanceAttacks'|'bountifulOriginalParents'|'dnd5eTurnEconomyByToken'|'combatId'|'round'>&{_sync?:{revision?:number}};first:BountifulOriginalDieReceipt;source:Source;characters:readonly Character[];characterRevision:number;hostMemberId:string}){
 const {combat,first,source,hostMemberId}=input,parentId=first.identity.parentId
 if(!validBountifulHostOperation(first.originalRoomAction)||!validateSecondChanceAttackReceipts(combat.secondChanceAttacks))fail()
 const operation=first.originalRoomAction
 const group=Object.values(combat.secondChanceAttacks??{}).filter(row=>row.attack.transactionId===parentId).sort((a,b)=>(a.incomingOccurrence??0)-(b.incomingOccurrence??0))
 const identity=(row:typeof group[number])=>JSON.stringify([row.attack.mapId,row.attack.combatId,row.parentInput,row.sceneScope,row.originalRoomAction,row.hostControllerMemberId,row.parentDefinitionSignature])
 if(new Set(group.map(row=>row.incomingOccurrence??0)).size!==group.length||group.some(row=>identity(row)!==identity(group[0])))fail()
 if(!group.length)fail()
 const rows=Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 const effectTimestamp=first.identity.effectTimestamp
 const binding={parentId,sourceKey:originalD20ReplaySourceKey(parentId,source.prepared.state,first.originalRoomAction,effectTimestamp),deferredD20Choices:first.postOriginalD20??[],facts:rows.map(row=>({occurrence:row.identity.occurrence,request:row.request,decision:decisionFromBountifulOriginalDieReceipt(row,row.request)})),...(effectTimestamp===undefined?{}:{effectTimestamp})}
 const replaySource=decodeSecondChanceParentWire(first.continuation?.source??first.originalParent) as Source
 const expectedEnvelope={secondChanceHostOriginalVersion:1,issuedForHostMemberId:hostMemberId,issuedForRoomId:first.identity.roomId,input:{...replaySource,hostOriginalD20Replay:binding},recovery:{bountifulNative:{parentId}}}
 const expectedWire=encodeSecondChanceParentWire(expectedEnvelope)
 let characters=[...source.prepared.characters],economies=JSON.parse(first.identity.reactionEconomySignature) as NonNullable<SecondChanceCombat['dnd5eTurnEconomyByToken']>,paid=0
 for(const receipt of group){
  const {attack,parentInput:parent}=receipt,commit=receipt.committed,decision=receipt.reactionDecision,selection=receipt.rollerSelection,raw=receipt.rollerD20,confirmed=receipt.rollerConfirmation
  if(receipt.sceneScope||receipt.originalRoomAction||!parent?.prepared||parent.prepared.adapterId!=='monster'||!same(parent.prepared.input,expectedWire)||!same(parent.state,source.prepared.state)||!same(parent.characterIdByCombatantId,source.prepared.characterIdByCombatantId)||receipt.hostControllerMemberId!==hostMemberId||receipt.parentDefinitionSignature!==await secondChanceParentDefinitionSignature(source.prepared.state)||attack.mapId!==first.identity.mapId||attack.combatId!==first.identity.combatId||attack.rollerTokenId!==operation.actorTokenId||attack.rollerCharacterId!==first.identity.roller.characterId||attack.rollerControllerMemberId!==first.identity.roller.memberId||receipt.mapRevision!==first.identity.revisions.maps||receipt.geometryRevision!==first.identity.revisions['map-geometry'])fail()
  const owner=characters.find(row=>row.id===attack.targetCharacterId),actor=source.prepared.state.combatants[attack.targetTokenId]
  if(!owner||!actor||source.prepared.characterIdByCombatantId[attack.targetTokenId]!==owner.id||bountifulPreparedController(source.prepared,attack.targetTokenId,hostMemberId).memberId!==attack.targetControllerMemberId)fail()
  if(!economies[attack.targetTokenId]){const fresh=createDnd5eTurnEconomyCounts(`${combat.combatId}:${combat.round}:${attack.targetTokenId}`,actor.speed);fresh.reaction.current=actor.turn.reactionAvailable&&!actor.classState.normalReactionSpentThisTurn&&!actor.classState.sceneReactionSpent?1:0;economies[attack.targetTokenId]=fresh}
  const economy=economies[attack.targetTokenId]
  if(!commit){if(receipt.parentContinuation&&(receipt.parentContinuation.phase!=='ready'||receipt.parentContinuation.transactionId!==parentId||receipt.parentContinuation.characterRevision!==input.characterRevision||receipt.parentContinuation.combatRevision!==combat._sync?.revision||decision?.decision!=='decline'||decision.authenticatedMemberId!==attack.targetControllerMemberId||selection||raw||confirmed))fail();continue}
  if(!commit.confirmation.transaction||receipt.parentContinuation?.phase!=='ready'||receipt.parentContinuation.transactionId!==parentId||receipt.parentContinuation.characterRevision!==input.characterRevision||receipt.parentContinuation.combatRevision!==combat._sync?.revision||!decision||decision.decision!=='use'||decision.authenticatedMemberId!==attack.targetControllerMemberId||!selection||!raw||!confirmed||selection.authenticatedMemberId!==attack.rollerControllerMemberId||raw.authenticatedMemberId!==attack.rollerControllerMemberId||selection.dieIndex!==raw.dieIndex||confirmed.authenticatedMemberId!==hostMemberId||confirmed.rollRequestId!==receipt.rollRequestId||confirmed.rawValue!==raw.value||economy.turnKey!==receipt.turnKey)fail()
  const feature=dnd5ePluginFeatureDefinition(receipt.featureId),ability=feature?.declarativeAbility
  if(!feature||!dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id)||feature.automation!=='full'||ability?.automation!=='full'||ability.mechanic?.kind!=='incoming-hit-attack-die-reroll'||ability.cost?.economy!=='reaction'||ability.cost.resources?.length!==1||!dnd5eCharacterHasPluginFeature(owner,feature.id)||receipt.featureDefinitionSignature!==JSON.stringify(ability))fail()
  const cost=ability.cost.resources[0];if(cost.amount!==1||cost.scope==='core')fail()
  const resourceKey=dnd5eDeclarativeResourceKey(feature.ownerPluginId,cost),pool=owner.classResources?.[resourceKey]
  const expected=prepareSecondChanceCommit({attack,owner:{featureId:feature.id,featureLabel:feature.name,ownerCharacterId:owner.id,ownerName:owner.name,ownerTokenId:attack.targetTokenId,ownedFeatureIds:[feature.id],canSeeRoller:receipt.canSeeRoller,reactionAvailable:receipt.canUseReaction&&economy.reaction.current>0,reactionReserved:receipt.reactionReserved,resourceKey,resourceCurrent:pool?.current??0,resourceMaximum:pool?.max??0},authenticatedReactionMemberId:decision.authenticatedMemberId,decision:'use',selection:selectSecondChanceAttackDie(attack,selection.authenticatedMemberId,selection.dieIndex),hostRerollD20:confirmed.value,now:commit.confirmation.transaction.createdAt})
  if(!same(expected,commit))fail()
  const changed=spendClassResource(owner,resourceKey,1);if(!changed)fail()
  characters=characters.map(row=>row.id===changed.id?changed:row)
  economies={...economies,[attack.targetTokenId]:{...economy,reaction:{...economy.reaction,current:economy.reaction.current-1}}};paid++
 }
 if(input.characterRevision!==first.identity.revisions.characters+paid||!same(characters,input.characters)||!same(economies,combat.dnd5eTurnEconomyByToken))fail()
 return {paid}
}
