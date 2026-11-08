import {dnd5ePluginFeatureCurrentEnvelopeFullV1,dnd5ePluginFeatureDefinition} from '../../rulesets/dnd5e/plugins/pluginContentCatalog'
import {secondChanceParentDefinitionSignature} from '../../lib/secondChanceParentSignature'
import {settleDnd5eConcentrationChecks} from './settleDnd5eCombatResult'
import {isSecondChancePostConcentrationChild,readSecondChancePostConcentrationActivityStage} from './secondChancePostConcentrationActivityFrame'
import {readPostNativeActivityStage} from './postNativeActivityParent'
import type {SharedResourceTransactionWrite} from '../../ports/sharedRoomGateway'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {readSecondChancePostNativeFrame,type SecondChancePostNativeFrame} from './secondChancePostNativeBoundary'
import {secondChanceParentGroup} from './secondChanceParentGroup'
import type {SecondChanceCombat} from './secondChanceHostCommit'
import {assertSecondChanceOriginalClockAuthority} from './secondChanceOriginalClockAuthority'
import {listRegisteredDnd5eActivityPackages} from '../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import {sameActivityParentData} from './postNativeActivityParent'
interface Header {schemaVersion:1;roomId:string;hostMemberId:string;parentTransactionId:string;mapId:string;combatId:string;scGroupSignature:string;nativeResultSignature:string;activityDefinitionsSignature:string;dependencies:Record<string,number>}
interface Roll {id:string;ordinal:number;rollerTokenId:string;rollerCharacterId:string;controllerMemberId:string;count:number;sides:number;kind:'d20'|'dice';raw?:{values:number[];authenticatedSubmitterMemberId:string;transport:string};confirmed?:{values:number[];originalValues:number[];authenticatedHostMemberId:string;transport:string}}
interface Parent extends Header {issuedAt:number;id:string;phase:'waiting'|'consumed';requests:Record<string,Roll>}
interface Journal {schemaVersion:1;parents:Record<string,Parent>;_sync?:{revision:number}}
export interface ScBasePrefixRollSession {readonly scBasePrefixRollSession:unique symbol}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'>
type Issue=Omit<Header,'schemaVersion'|'roomId'|'hostMemberId'>&{ordinal:number;rollerTokenId:string;rollerCharacterId:string;count:number;sides:number;kind:'d20'|'dice'}
export interface ScBasePrefixTransport {begin:(input:Omit<Header,'schemaVersion'|'roomId'|'hostMemberId'>)=>Promise<{parentId:string}>;issue:(input:Issue)=>Promise<{parentId:string;requestId:string}>}
const sessions=new WeakMap<ScBasePrefixRollSession,{frame:SecondChancePostNativeFrame;header:Header;mode:'interactive'|'replay';ordinal:number;issuedAt:number}>()
async function digest(value:unknown){const bytes=new TextEncoder().encode(JSON.stringify(value)),result=await globalThis.crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(result)].map(n=>n.toString(16).padStart(2,'0')).join('')}
function guard(frame:SecondChancePostNativeFrame){const native=readSecondChancePostNativeFrame(frame),session=getRoomSession();if(!session||session.role!=='dm'||native.roomId!==session.roomId||native.hostMemberId!==session.memberId||native.phase!=='native-before-base')throw Error('sc-base-prefix:genuine-original-native-frame-required');return native}
async function assertOriginalPrefixSources(frame:SecondChancePostNativeFrame){const native=guard(frame),group=JSON.parse(native.scGroupIdentity) as ReturnType<typeof secondChanceParentGroup>;if(!group.length)throw Error('sc-base-prefix:original-group-required');const assert=()=>{for(const row of group){const feature=dnd5ePluginFeatureDefinition(row.featureId);if(!dnd5ePluginFeatureCurrentEnvelopeFullV1(row.featureId)||feature?.automation!=='full'||feature.declarativeAbility?.automation!=='full'||row.featureDefinitionSignature!=null&&JSON.stringify(feature.declarativeAbility)!==row.featureDefinitionSignature)throw Error('sc-base-prefix:changed-original-source')}};assert();const root=group[0];if(root.parentDefinitionSignature!==undefined&&(!root.parentInput||root.parentDefinitionSignature!==await secondChanceParentDefinitionSignature(root.parentInput.state)))throw Error('sc-base-prefix:changed-parent-definition');guard(frame);assert()}
export async function captureScBasePrefixRollSession(frame:SecondChancePostNativeFrame,gateway:Gateway,mode:'interactive'|'replay',transport:Pick<ScBasePrefixTransport,'begin'>):Promise<ScBasePrefixRollSession>{
 await assertOriginalPrefixSources(frame)
 const native=guard(frame),combat=await gateway.loadResource<SecondChanceCombat>('combat'),group=combat?secondChanceParentGroup(combat,native.parentTransactionId):[]
 if(!group.length||JSON.stringify(group)!==native.scGroupIdentity||group.some(row=>row.parentContinuation?.phase!=='ready'))throw Error('sc-base-prefix:original-group-changed')
 const clock=await assertSecondChanceOriginalClockAuthority(group[0],gateway),dependencies={...native.revisions,'campaign-time':clock}
 const names=['maps','characters','combat','map-geometry','campaign-time'] as const,values=await Promise.all(names.map(name=>gateway.loadResource<{_sync?:{revision?:number}}>(name)))
 if(names.some((name,index)=>(values[index]==null?0:values[index]?._sync?.revision)!==dependencies[name]))throw Error('sc-base-prefix:original-world-changed')
 const header:Header={schemaVersion:1,roomId:native.roomId,hostMemberId:native.hostMemberId,parentTransactionId:native.parentTransactionId,mapId:native.mapId,combatId:native.combatId,scGroupSignature:await digest(JSON.parse(native.scGroupIdentity)),nativeResultSignature:await digest(encodeSecondChanceParentWire(native.result)),activityDefinitionsSignature:await digest(listRegisteredDnd5eActivityPackages()),dependencies};guard(frame)
 const payload={parentTransactionId:header.parentTransactionId,mapId:header.mapId,combatId:header.combatId,scGroupSignature:header.scGroupSignature,nativeResultSignature:header.nativeResultSignature,activityDefinitionsSignature:header.activityDefinitionsSignature,dependencies:header.dependencies}
 if(mode==='interactive')await transport.begin(payload)
 const journal=await gateway.loadResource<Journal>('sc-base-prefix-rolls'),parents=Object.values(journal?.parents??{}).filter(parent=>sameActivityParentData({...parent,id:undefined,phase:undefined,issuedAt:undefined,requests:undefined},{...header,id:undefined,phase:undefined,issuedAt:undefined,requests:undefined}))
 if(parents.length!==1||parents[0].phase!=='waiting'||!Number.isSafeInteger(parents[0].issuedAt))throw Error('sc-base-prefix:server-issued-prefix-required')
 const session=Object.freeze({}) as ScBasePrefixRollSession;sessions.set(session,{frame,header,mode,ordinal:0,issuedAt:parents[0].issuedAt});return session
}
export async function collectScBasePrefixPool(session:ScBasePrefixRollSession,input:{count:number;sides:number;kind:'d20'|'dice';label:string;targetName:string;rollerTokenId:string},gateway:Gateway,transport:Pick<ScBasePrefixTransport,'issue'>,ui:{roll:(owner:{durableRollRequestId:string;rollerTokenId:string;rollerCharacterId:string})=>Promise<readonly number[]>;confirmStored:(values:readonly number[],owner:{durableRollRequestId:string;rollerTokenId:string;rollerCharacterId:string})=>Promise<readonly number[]>}){
 const data=sessions.get(session);if(!data)throw Error('sc-base-prefix:issued-session-required');const native=guard(data.frame),characterId=native.characterIdByCombatantId[input.rollerTokenId]
 if(!characterId||!native.result.state.combatants[input.rollerTokenId])throw Error('sc-base-prefix:actual-base-roller-required')
 const h=data.header,request:Issue={parentTransactionId:h.parentTransactionId,mapId:h.mapId,combatId:h.combatId,scGroupSignature:h.scGroupSignature,nativeResultSignature:h.nativeResultSignature,activityDefinitionsSignature:h.activityDefinitionsSignature,dependencies:h.dependencies,ordinal:data.ordinal,rollerTokenId:input.rollerTokenId,rollerCharacterId:characterId,count:input.count,sides:input.sides,kind:input.kind}
 let requestId:string|undefined
 if(data.mode==='interactive')requestId=(await transport.issue(request)).requestId
 const load=async()=>{guard(data.frame);if(await digest(listRegisteredDnd5eActivityPackages())!==data.header.activityDefinitionsSignature)throw Error('sc-base-prefix:activity-definitions-changed');const journal=await gateway.loadResource<Journal>('sc-base-prefix-rolls');const parents=Object.values(journal?.parents??{}).filter(parent=>sameActivityParentData({...parent,id:undefined,phase:undefined,issuedAt:undefined,requests:undefined},{...data.header,id:undefined,phase:undefined,issuedAt:undefined,requests:undefined}));if(parents.length!==1)throw Error('sc-base-prefix:authenticated-parent-required');const parent=parents[0],roll=Object.values(parent.requests).find(row=>row.ordinal===data.ordinal);if(parent.phase!=='waiting'||!roll||requestId&&roll.id!==requestId||roll.rollerTokenId!==input.rollerTokenId||roll.rollerCharacterId!==characterId||roll.count!==input.count||roll.sides!==input.sides||roll.kind!==input.kind)throw Error('sc-base-prefix:original-roll-slot-required');requestId=roll.id;return roll}
 let saved=await load();const owner={durableRollRequestId:saved.id,rollerTokenId:saved.rollerTokenId,rollerCharacterId:saved.rollerCharacterId}
 if(!saved.confirmed){if(data.mode==='replay')throw Error('sc-base-prefix:original-confirmation-pending');if(saved.raw)await ui.confirmStored(saved.raw.values,owner);else await ui.roll(owner);saved=await load()}
 if(!saved.raw||saved.raw.authenticatedSubmitterMemberId!==saved.controllerMemberId||saved.raw.transport!=='authenticated-room-member'||!saved.confirmed||saved.confirmed.authenticatedHostMemberId!==data.header.hostMemberId||saved.confirmed.transport!=='authenticated-room-host'||!sameActivityParentData(saved.confirmed.originalValues,saved.raw.values))throw Error('sc-base-prefix:authenticated-original-pool-required')
 data.ordinal++;return [...saved.confirmed.values]
}

/** Metadata clock comes from the immutable server-issued original prefix. */
export function readScBasePrefixTransactionNow(session:ScBasePrefixRollSession){const data=sessions.get(session);if(!data)throw Error('sc-base-prefix:issued-session-required');guard(data.frame);return data.issuedAt}

export interface ScBasePrefixConsumption {readonly scBasePrefixConsumption:unique symbol}
const consumptions=new WeakMap<ScBasePrefixConsumption,{frame:SecondChancePostNativeFrame;postFrame:SecondChancePostNativeFrame;write:SharedResourceTransactionWrite;readRevisions:Record<string,number>;definitionsSignature:string}>()
/** A post-stage is not accepted merely because a JSON graph was put into a
 * stage factory. Rebuild the real Base prefix from genuine native facts and
 * authenticated original pools, then compare every field of the actual stage. */
export async function prepareScBasePrefixConsumption(session:ScBasePrefixRollSession,postFrame:SecondChancePostNativeFrame,gateway:Gateway):Promise<ScBasePrefixConsumption>{
 const data=sessions.get(session);if(!data)throw Error('sc-base-prefix:issued-session-required');const native=guard(data.frame),expected=readPostNativeActivityStage(readSecondChancePostConcentrationActivityStage(postFrame)),post=readSecondChancePostNativeFrame(postFrame)
 if(!isSecondChancePostConcentrationChild(data.frame,postFrame)||post.phase!=='post-concentration-pre-activities'||post.parentTransactionId!==native.parentTransactionId||post.scGroupIdentity!==native.scGroupIdentity)throw Error('sc-base-prefix:unrelated-post-stage')
 const replay=await captureScBasePrefixRollSession(data.frame,gateway,'replay',{begin:async()=>{throw Error('No late prefix issuance')}}),stop=Error('sc-base-prefix:reconstructed-stage'),unsupported=async()=>{throw Error('sc-base-prefix:additional-choice-authority-required')};let matched=false
 const pool=async(count:number,sides:number,label:string,targetName:string,owner?:{rollerTokenId?:string})=>{if(!owner?.rollerTokenId)throw Error('sc-base-prefix:actual-base-roller-required');return collectScBasePrefixPool(replay,{count,sides,kind:sides===20&&count===1?'d20':'dice',label,targetName,rollerTokenId:owner.rollerTokenId},gateway,{issue:async()=>{throw Error('No replay issuance')}},{roll:unsupported,confirmStored:unsupported})}
 try{await settleDnd5eConcentrationChecks({result:native.result,map:native.map,characters:native.characters,characterIdByCombatantId:native.characterIdByCombatantId,priorApplication:native.application,hostParentTransactionId:native.parentTransactionId,followupTransactionNow:()=>readScBasePrefixTransactionNow(replay),rollD20:async(label,name,owner)=>(await pool(1,20,label,name,owner))[0],rollD4:async(label,name,owner)=>(await pool(1,4,label,name,owner))[0],rollDice:pool,settleActivityTriggers:async request=>{if(!request.stage||!sameActivityParentData(readPostNativeActivityStage(request.stage),expected))throw Error('sc-base-prefix:mechanical-prefix-mismatch');matched=true;throw stop}})}catch(error){if(error!==stop)throw error}
 if(!matched||!isSecondChancePostConcentrationChild(data.frame,postFrame))throw Error('sc-base-prefix:actual-base-stage-required')
 await assertOriginalPrefixSources(data.frame)
 const journal=await gateway.loadResource<Journal>('sc-base-prefix-rolls'),parents=Object.values(journal?.parents??{}).filter(parent=>sameActivityParentData({...parent,id:undefined,phase:undefined,issuedAt:undefined,requests:undefined},{...data.header,id:undefined,phase:undefined,issuedAt:undefined,requests:undefined})),used=sessions.get(replay)!.ordinal
 if(!journal||!Number.isSafeInteger(journal._sync?.revision)||parents.length!==1||parents[0].phase!=='waiting'||Object.keys(parents[0].requests).length!==used||Object.values(parents[0].requests).some(row=>!row.raw||!row.confirmed))throw Error('sc-base-prefix:complete-authenticated-prefix-required')
 const parent=parents[0],ready=Object.freeze({}) as ScBasePrefixConsumption;consumptions.set(ready,{frame:data.frame,postFrame,write:{name:'sc-base-prefix-rolls',expectedRevision:journal._sync!.revision,data:{...journal,parents:{...journal.parents,[parent.id]:{...parent,phase:'consumed'}}}},readRevisions:{...data.header.dependencies},definitionsSignature:data.header.activityDefinitionsSignature});return ready
}
export async function readScBasePrefixConsumption(frame:SecondChancePostNativeFrame,ready:ScBasePrefixConsumption){const value=consumptions.get(ready);guard(frame);if(!value||value.frame!==frame||await digest(listRegisteredDnd5eActivityPackages())!==value.definitionsSignature)throw Error('sc-base-prefix:issued-original-consumption-required');await assertOriginalPrefixSources(frame);if(!isSecondChancePostConcentrationChild(frame,value.postFrame))throw Error('sc-base-prefix:original-child-required');return{originalPostFrame:value.postFrame,write:structuredClone(value.write),readRevisions:{...value.readRevisions}}}
