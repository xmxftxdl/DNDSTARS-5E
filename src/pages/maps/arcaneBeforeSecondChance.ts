import{spendClassResource}from'../../lib/classResources'
import{dnd5eDeclarativeResourceKey}from'../../rulesets/dnd5e/plugins/pluginDeclarativeCompiler'
import{readSecondChancePostNativeFrame,readSecondChancePostNativeSettlement,type SecondChancePostNativeFrame,type SecondChancePostNativeSettlement}from'./secondChancePostNativeBoundary'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{getRoomSession}from'../../lib/roomSession'
import{listRegisteredDnd5eActivityPackages}from'../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import{captureArcaneEquipmentCheckpoint,readArcaneEquipmentCheckpoint,type ArcaneEquipmentInput}from'./arcanePreparedCheckpoint'
import{readSecondChancePreparedOriginalAsync}from'./secondChancePreparedParent'
import{validateSecondChanceAttackReceipts}from'../../../shared/second-chance-state.mjs'
import{secondChanceParentGroup}from'./secondChanceParentGroup'
import type{SecondChanceCombat}from'./secondChanceHostCommit'
import{dnd5ePluginFeatureCurrentEnvelopeFullV1,dnd5ePluginFeatureDefinition}from'../../rulesets/dnd5e/plugins/pluginContentCatalog'
import{secondChanceParentDefinitionSignature}from'../../lib/secondChanceParentSignature'
import{normalizeCharacter}from'../../store/characters'
import{migrateMapsState}from'../../store/maps'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{IncomingAttackArmorClassFacts}from'../../rulesets/dnd5e/incomingAttackArmorClassCheckpoint'
import type{SecondChancePreparedOriginal}from'./secondChancePreparedParent'
import{restoreArcaneNativeIssuedParent,readArcaneNativeIssuedParent}from'./arcaneNativeRoomIssuer'
import{sameActivityParentData}from'./postNativeActivityParent'
/** A bound authenticated DECLINE of the earlier Arcane AC window. It grants no SC
 * decision, no AC increase, no world publication and no authority after SC revisions move. */
export interface ArcaneBeforeSecondChanceDecline{readonly arcaneBeforeSecondChanceDecline:unique symbol}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Context={record:Record<string,unknown>;dependencies:Record<string,number>}
const issued=new WeakMap<object,{id:string;context:Context;continued?:{attackReceiptId:string;groupSignature:string};replayed?:boolean}>()
function assertDecline(context:Context){const row=context.record,choice=row.arcaneChoice as{decision?:unknown;authenticatedSubmitterMemberId?:unknown;transport?:unknown}|undefined,prepared=row.prepared as SecondChancePreparedOriginal|undefined;if(row.phase!=='arcane'||row.checkpointKind!==undefined||row.checkpoints!==undefined||prepared?.adapterId!=='equipment'||!['dm','player'].includes((row.originalRoomAction as{sourceMode?:string}|undefined)?.sourceMode??'')||choice?.decision!=='decline'||choice.authenticatedSubmitterMemberId!==row.controllerMemberId||choice.transport!=='authenticated-room-member')throw Error('arcane-before-sc:authenticated-controller-decline-required')}
async function readOriginal(id:string,gateway:Gateway):Promise<Context>{const actual=readArcaneNativeIssuedParent(await restoreArcaneNativeIssuedParent(id,gateway)),journal=await gateway.loadResource<Revisioned&{parents:Record<string,Record<string,unknown>>}>('arcane-native-parents'),row=journal?.parents[id];if(!row)throw Error('arcane-before-sc:issued-original-required');for(const[key,value]of Object.entries(actual.record))if(key!=='phase'&&!sameActivityParentData(row[key],value))throw Error('arcane-before-sc:changed-original-identity');const context={record:structuredClone(row),dependencies:actual.dependencies};assertDecline(context);return context}
export async function captureArcaneBeforeSecondChanceDecline(id:string,gateway:Gateway):Promise<ArcaneBeforeSecondChanceDecline>{const context=await readOriginal(id,gateway),brand=Object.freeze({})as ArcaneBeforeSecondChanceDecline;issued.set(brand,{id,context});return brand}
export function readArcaneBeforeSecondChanceOriginal(brand:ArcaneBeforeSecondChanceDecline){const original=issued.get(brand);if(!original)throw Error('arcane-before-sc:issued-brand-required');return{prepared:structuredClone(original.context.record.prepared)as SecondChancePreparedOriginal,parentTransactionId:original.context.record.parentTransactionId as string,mapId:original.context.record.mapId as string,now:original.context.record.hostExecutionNow as number}}
/** Called only while the real SC issuer's original session is paused at the
 * exact earlier Arcane AC checkpoint. JSON/cross-parent/stale/modified facts fail. */
export async function assertArcaneBeforeSecondChanceDecline(brand:ArcaneBeforeSecondChanceDecline,input:{parentTransactionId:string;preparedOriginal?:SecondChancePreparedOriginal;facts:IncomingAttackArmorClassFacts;occurrence:number;now?:number},gateway:Gateway){
 const original=issued.get(brand);if(!original)throw Error('arcane-before-sc:issued-brand-required')
 const continuation=original.continued?await readContinued(original.id,original.continued.attackReceiptId,gateway):undefined;if(continuation&&continuation.groupSignature!==original.continued!.groupSignature)throw Error('arcane-before-sc:changed-sc-group');const current=continuation?.context??await readOriginal(original.id,gateway);assertDecline(current)
 const row=current.record;if(!sameActivityParentData(current,original.context)||row.parentTransactionId!==input.parentTransactionId||row.hostExecutionNow!==input.now||!input.preparedOriginal||!sameActivityParentData(row.prepared,input.preparedOriginal)||!sameActivityParentData(row.attackFacts,input.facts)||row.occurrence!==input.occurrence)throw Error('arcane-before-sc:original-checkpoint-mismatch')
 original.replayed=true
}

type Revisioned={_sync?:{revision?:number}}
function rev(value:Revisioned|null){if(value===null)return 0;const n=value._sync?.revision;if(!Number.isSafeInteger(n)||n!<0)throw Error('arcane-before-sc:revision-required');return n!}
async function readContinued(id:string,attackReceiptId:string,gateway:Gateway){
 const session=getRoomSession();if(!session||session.role!=='dm')throw Error('arcane-before-sc:authenticated-host-required')
 const names=['maps','characters','combat','map-geometry','campaign-time']as const,values=await Promise.all(names.map(name=>gateway.loadResource<Revisioned>(name))),journal=await gateway.loadResource<Revisioned&{parents:Record<string,Context['record']>}>('arcane-native-parents')
 if(getRoomSession()?.roomId!==session.roomId||getRoomSession()?.memberId!==session.memberId||getRoomSession()?.role!=='dm')throw Error('arcane-before-sc:authenticated-host-required')
 const row=journal?.parents[id],combat=values[2]as(Revisioned&SecondChanceCombat)|null,receipt=combat?.secondChanceAttacks?.[attackReceiptId]
 if(!row||row.phase!=='arcane'||row.roomId!==session.roomId||row.hostMemberId!==session.memberId||!combat||!receipt||!validateSecondChanceAttackReceipts(combat.secondChanceAttacks))throw Error('arcane-before-sc:current-original-parent-required')
 const group=secondChanceParentGroup(combat,receipt.attack.transactionId),continuation=receipt.parentContinuation,dependencies=Object.fromEntries(names.map((name,index)=>[name,rev(values[index])]))
 // One genuine original occurrence only. A committed SC cost is reconstructed
 // through its actual resource function, never accepted as an arbitrary new world.
 if(group.length!==1||receipt.sceneScope||(!receipt.committed&&receipt.reactionDecision?.decision!=='decline')||continuation?.phase!=='ready')throw Error('arcane-before-sc:one-ready-combat-sc-required')
 if(receipt.parentInput?.options?.now!==row.hostExecutionNow)throw Error('arcane-before-sc:changed-original-clock');
 if(receipt.attack.transactionId!==row.parentTransactionId||receipt.attack.mapId!==row.mapId||receipt.attack.combatId!==row.combatId||combat.mapId!==row.mapId||combat.combatId!==row.combatId||continuation.transactionId!==row.parentTransactionId||continuation.characterRevision!==dependencies.characters||continuation.combatRevision!==dependencies.combat)throw Error('arcane-before-sc:changed-sc-scope')
 const prior=row.dependencies as Record<string,number>
 if(['maps','map-geometry','campaign-time'].some(name=>prior[name]!==dependencies[name])||dependencies.characters!==prior.characters+(receipt.committed?1:0)||receipt.mapRevision!==dependencies.maps||receipt.characterRevision!==prior.characters||receipt.geometryRevision!==dependencies['map-geometry'])throw Error('arcane-before-sc:changed-original-world')
 const feature=dnd5ePluginFeatureDefinition(receipt.featureId)
 if(!dnd5ePluginFeatureCurrentEnvelopeFullV1(receipt.featureId)||feature?.automation!=='full'||feature.declarativeAbility?.automation!=='full'||receipt.featureDefinitionSignature!==JSON.stringify(feature.declarativeAbility)||!receipt.parentInput||receipt.parentDefinitionSignature!==await secondChanceParentDefinitionSignature(receipt.parentInput.state)||!sameActivityParentData(receipt.parentInput.prepared,row.prepared))throw Error('arcane-before-sc:changed-original-source')
 if(!sameActivityParentData(row.definitions,JSON.parse(JSON.stringify(listRegisteredDnd5eActivityPackages()))))throw Error('arcane-before-sc:changed-original-source')
 const original=row.prepared as SecondChancePreparedOriginal,prepared=await readSecondChancePreparedOriginalAsync(original),mechanical=readArcaneEquipmentCheckpoint(captureArcaneEquipmentCheckpoint(prepared as unknown as ArcaneEquipmentInput,{now:row.hostExecutionNow as number})),maps=values[0]as Revisioned&{maps:typeof prepared.prepared.map[]},characters=values[1]as Revisioned&{characters:typeof prepared.prepared.characters}
 const map=maps.maps.find(item=>item.id===row.mapId),normal=(data:unknown)=>JSON.parse(JSON.stringify(data))
 let expectedCharacters=prepared.prepared.characters
 if(receipt.committed){const decision=receipt.reactionDecision,selection=receipt.rollerSelection,raw=receipt.rollerD20,confirmed=receipt.rollerConfirmation,cost=feature.declarativeAbility!.cost?.resources?.[0],economy=combat.dnd5eTurnEconomyByToken?.[receipt.attack.targetTokenId];if(decision?.decision!=='use'||decision.authenticatedMemberId!==receipt.attack.targetControllerMemberId||!selection||!raw||selection.authenticatedMemberId!==receipt.attack.rollerControllerMemberId||raw.authenticatedMemberId!==selection.authenticatedMemberId||raw.dieIndex!==selection.dieIndex||!confirmed||confirmed.authenticatedMemberId!==session.memberId||confirmed.rawValue!==raw.value||confirmed.rollRequestId!==receipt.rollRequestId||!cost||cost.amount!==1||economy?.turnKey!==receipt.turnKey||economy.reaction.current!==0)throw Error('arcane-before-sc:actual-committed-sc-cost-required');const owner=expectedCharacters.find(item=>item.id===receipt.attack.targetCharacterId),changed=owner&&spendClassResource(owner,dnd5eDeclarativeResourceKey(feature.ownerPluginId,cost),1);if(!changed)throw Error('arcane-before-sc:actual-committed-sc-cost-required');expectedCharacters=expectedCharacters.map(item=>item.id===changed.id?changed:item)}
 if(!map||!sameActivityParentData(migrateMapsState({maps:[map]}).maps[0],migrateMapsState({maps:[prepared.prepared.map]}).maps[0])||!sameActivityParentData(normal(characters.characters.map(item=>normalizeCharacter(item))),normal(expectedCharacters.map(item=>normalizeCharacter(item))))||!sameActivityParentData(row.attackFacts,mechanical.facts)||row.occurrence!==mechanical.occurrence||!mechanical.options.some(item=>item.featureId===row.featureId)||row.targetId!==receipt.attack.targetTokenId||row.controllerMemberId!==receipt.attack.targetControllerMemberId)throw Error('arcane-before-sc:changed-original-checkpoint')
 const context={record:structuredClone(row),dependencies};assertDecline(context);return{context,groupSignature:JSON.stringify(group),journalRevision:rev(journal)}
}
export async function captureArcaneBeforeSecondChanceContinuation(id:string,attackReceiptId:string,gateway:Gateway):Promise<ArcaneBeforeSecondChanceDecline>{const current=await readContinued(id,attackReceiptId,gateway),brand=Object.freeze({})as ArcaneBeforeSecondChanceDecline;issued.set(brand,{id,context:current.context,continued:{attackReceiptId,groupSignature:current.groupSignature}});return brand}

export async function prepareArcaneBeforeSecondChanceConsumption(brand:ArcaneBeforeSecondChanceDecline,frame:SecondChancePostNativeFrame,gateway:Gateway,settlement?:SecondChancePostNativeSettlement){
 const original=issued.get(brand);if(!original?.continued||!original.replayed)throw Error('arcane-before-sc:actual-sc-replay-required')
 const view=readSecondChancePostNativeFrame(frame),current=await readContinued(original.id,original.continued.attackReceiptId,gateway)
 if(view.phase!=='native-before-base'||view.parentTransactionId!==current.context.record.parentTransactionId||view.roomId!==current.context.record.roomId||view.hostMemberId!==current.context.record.hostMemberId||view.mapId!==current.context.record.mapId||view.combatId!==current.context.record.combatId||view.scGroupIdentity!==original.continued.groupSignature||current.groupSignature!==original.continued.groupSignature||!sameActivityParentData(current.context,original.context)||['maps','characters','combat','map-geometry'].some(name=>view.revisions[name as keyof typeof view.revisions]!==current.context.dependencies[name])||view.revisions['campaign-time']!=null&&view.revisions['campaign-time']!==current.context.dependencies['campaign-time'])throw Error('arcane-before-sc:changed-original-sc-frame')
 const journal=await gateway.loadResource<Revisioned&{schemaVersion:1;parents:Record<string,Context['record']>}>('arcane-native-parents')
 if(!journal||rev(journal)!==current.journalRevision||!sameActivityParentData(journal.parents[original.id],current.context.record))throw Error('arcane-before-sc:changed-original-journal')
 const completed=settlement?readSecondChancePostNativeSettlement(frame,settlement):view
 return{journalWrite:{name:'arcane-native-parents',expectedRevision:current.journalRevision,data:{...journal,parents:{...journal.parents,[original.id]:{...current.context.record,phase:'consumed',completed:encodeSecondChanceParentWire({result:completed.result,application:completed.application})}}}},readRevisions:current.context.dependencies}
}
