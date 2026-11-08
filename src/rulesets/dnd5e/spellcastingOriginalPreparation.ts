import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire,decodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{captureSecondChancePreparedHostFacts,restoreSecondChancePreparedHostFactsAsync}from'../../pages/maps/secondChancePreparedHostFacts'
import{readDnd5eSpellcastingOriginalOperation,captureDnd5eSpellcastingOriginalOperation,type Dnd5eSpellcastingOriginalOperation}from'./spellcastingOriginalOperation'
import{createDnd5eNextOriginalD20Session,captureDnd5eStormCastOriginalOperation}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
import{issueStormCastPreparedOriginalReplay,stormCastPreparedOriginalChoice}from'./stormCastPreparedOriginalReplay'
import type{StormCastOriginalPreparationLoader}from'./stormCastOriginalPreparation'
import type{MissingSpellcastingOriginal}from'./missingSpellcastingOriginal'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
export interface SpellcastingOriginalPreparationIdentity{parentId:string;mapId:string;combatId:string;effectId:string}
export interface SpellcastingOriginalPreparationBook extends SpellcastingOriginalPreparationIdentity{
 ok:true;schemaVersion:1;sourceKind:'spellcasting-original-preparation-v1';roomId:string;hostMemberId:string;
 source:ReturnType<typeof encodeSecondChanceParentWire>;requirement:MissingSpellcastingOriginal['requirement'];prefixSignature:string;effectTimestamp:number;earlierStorm:boolean
}
export type SpellcastingOriginalPreparationLoader=(identity:SpellcastingOriginalPreparationIdentity)=>Promise<SpellcastingOriginalPreparationBook>
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
function host(){const s=getRoomSession();if(s?.role!=='dm'||!s.roomId||!s.memberId)throw Error('spellcasting-preparation:actual-host-required');return s}
function check(book:SpellcastingOriginalPreparationBook,id:SpellcastingOriginalPreparationIdentity){const s=host();if(!book?.ok||book.schemaVersion!==1||book.sourceKind!=='spellcasting-original-preparation-v1'||book.roomId!==s.roomId||book.hostMemberId!==s.memberId||!['parentId','mapId','combatId','effectId'].every(key=>book[key as keyof typeof id]===id[key as keyof typeof id])||!Number.isSafeInteger(book.effectTimestamp)||book.effectTimestamp<=0||typeof book.earlierStorm!=='boolean'||book.requirement?.effectId!==id.effectId)throw Error('spellcasting-preparation:exact-current-parent-required')}
function identity(native:ReturnType<typeof readDnd5eSpellcastingOriginalOperation>):SpellcastingOriginalPreparationIdentity{return{parentId:native.source.prepared.action.id,mapId:native.source.prepared.map.id,combatId:native.source.prepared.state.combatId,effectId:native.requirement.effectId}}
/** No physical die or owner decision is issued at this genuine missing-roll boundary. */
export async function captureSpellcastingOriginalPreparation(operation:Dnd5eSpellcastingOriginalOperation,gateway:Pick<SharedRoomGatewayPort,'publishEvent'>,load:SpellcastingOriginalPreparationLoader){
 const s=host(),native=readDnd5eSpellcastingOriginalOperation(operation),id=identity(native),wire=encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(native.source)),payload={sourceKind:'spellcasting-original-preparation-v1',phase:'prepare',...id,source:wire,requirement:native.requirement,prefixSignature:JSON.stringify(native.snapshot),effectTimestamp:native.effectTimestamp,earlierStorm:!!native.stormOperation}
 if(native.source.spellcastingSavingThrows?.length)throw Error('spellcasting-preparation:first-caster-requirement-only')
 await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',payload)
 const current=host(),book=await load(id);check(book,id);if(current.roomId!==s.roomId||current.memberId!==s.memberId||!equal(readDnd5eSpellcastingOriginalOperation(operation),native)||!equal(book.source,wire)||!equal(book.requirement,native.requirement)||book.prefixSignature!==JSON.stringify(native.snapshot)||book.effectTimestamp!==native.effectTimestamp||book.earlierStorm!==!!native.stormOperation)throw Error('spellcasting-preparation:exact-native-source-required');return book
}
/** Recreate the real missing native phase at the protected original clock. No
 * caller snapshot, effect ID, DC or placeholder face is registered as native. */
export async function restoreSpellcastingOriginalPreparation(id:SpellcastingOriginalPreparationIdentity,load:SpellcastingOriginalPreparationLoader,loadStorm?:StormCastOriginalPreparationLoader){
 host();const book=await load(id);check(book,id);const restored=await restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(book.source))as Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
 if(!restored?.prepared||restored.prepared.action.id!==id.parentId||restored.prepared.map.id!==id.mapId||restored.prepared.state.combatId!==id.combatId||!equal(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(restored)),book.source)||restored.spellcastingSavingThrows?.length)throw Error('spellcasting-preparation:exact-restored-source-required')
 const prior=(restored as typeof restored&{hostOriginalD20Replay?:import('./allyNaturalOneCheckpoint').OriginalD20ReplayFacts}).hostOriginalD20Replay,expected={parentId:id.parentId,sourceKey:originalD20ReplaySourceKey(id.parentId,restored.prepared.state,restored.prepared.action,book.effectTimestamp),effectTimestamp:book.effectTimestamp,facts:[]}
 if(prior!==undefined&&!equal(prior,expected))throw Error('spellcasting-preparation:exact-original-clock-required')
 const source={...restored,hostOriginalD20Replay:expected},session=createDnd5eNextOriginalD20Session(source,resolvePreparedDnd5eSpellCast)
 try{let result=session.run(source.prepared.state)
  if(book.earlierStorm){if(result.status!=='pending-storm-cast'||typeof loadStorm!=='function')throw Error('spellcasting-preparation:actual-earlier-storm-required');const token=await issueStormCastPreparedOriginalReplay({parentId:id.parentId,mapId:id.mapId,combatId:id.combatId},loadStorm),choice=stormCastPreparedOriginalChoice(captureDnd5eStormCastOriginalOperation(result),token);result=session.resumeStormCast(source.prepared.state,result.frame,choice)}
  else if(result.status==='pending-storm-cast')throw Error('spellcasting-preparation:unrecorded-earlier-storm')
  if(result.status!=='missing-spellcasting-original')throw Error('spellcasting-preparation:actual-missing-caster-required')
  const operation=captureDnd5eSpellcastingOriginalOperation(result),native=readDnd5eSpellcastingOriginalOperation(operation)
  if(!equal(native.requirement,book.requirement)||JSON.stringify(native.snapshot)!==book.prefixSignature||native.effectTimestamp!==book.effectTimestamp||!!native.stormOperation!==book.earlierStorm)throw Error('spellcasting-preparation:exact-restored-prefix-required')
  return{source,operation,book}
 }finally{session.cancel()}
}
