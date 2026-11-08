import type{TempestuousBeforeOriginalPort}from'./tempestuousBeforeOriginalPort'
import{captureDnd5eStormCastOriginalOperation,readDnd5eStormCastOriginalOperation,type Dnd5eStormCastOriginalOperation}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{issueStormCastPreparedOriginalReplay}from'./stormCastPreparedOriginalReplay'
import type{StormCastOriginalPreparationBook,StormCastPreparationIdentity}from'./stormCastOriginalPreparation'
export interface StormCastBountifulOriginalPort extends TempestuousBeforeOriginalPort{loadStormCastOriginalPreparation?:(identity:StormCastPreparationIdentity)=>Promise<StormCastOriginalPreparationBook|undefined>}
/** This exception retains a true native reference; no JSON pending frame can
 * select the new continuation. The normal synchronous driver remains pure. */
export class StormCastOriginalPrefixPending extends Error{
 readonly operation:Dnd5eStormCastOriginalOperation
 constructor(result:object){super('storm-cast-bountiful:actual-native-prefix-pending');this.operation=captureDnd5eStormCastOriginalOperation(result);currentIdentity(this.operation)}
}
function currentIdentity(operation:Dnd5eStormCastOriginalOperation){
 const native=readDnd5eStormCastOriginalOperation(operation),source=native.source as{prepared?:{action?:{id?:string;type?:string;actorTokenId?:string;dnd5eSpellCast?:{spellId?:string}};map?:{id?:string};state?:{combatId?:string}}},p=source.prepared
 if(native.resolve!==resolvePreparedDnd5eSpellCast||p?.action?.type!=='dnd5e-spell-cast'||!p.action.id||!p.map?.id||!p.state?.combatId||native.frame.parentId!==p.action.id||native.frame.actorId!==p.action.actorTokenId||native.frame.spellId!==p.action.dnd5eSpellCast?.spellId)throw Error('storm-cast-bountiful:actual-core-spell-parent-required')
 return{parentId:p.action.id,mapId:p.map.id,combatId:p.state.combatId}
}
/** The native status selects this branch. A private absence is not permission
 * to skip the already observed casting-start prefix. */
export async function loadStormCastReplayForActualPending(result:object,gateway:StormCastBountifulOriginalPort){
 const operation=captureDnd5eStormCastOriginalOperation(result),identity=currentIdentity(operation),load=gateway.loadStormCastOriginalPreparation
 if(typeof load!=='function')throw Error('storm-cast-bountiful:prefix-transport-required')
 return issueStormCastPreparedOriginalReplay(identity,async id=>{const book=await load(id);if(!book)throw Error('storm-cast-bountiful:prepared-owner-prefix-required');return book},gateway.loadTempestuousBeforeOriginalPreparation?async id=>{const book=await gateway.loadTempestuousBeforeOriginalPreparation!(id);if(!book)throw Error('storm-cast-bountiful:tempestuous-parent-required');return book}:undefined,gateway.resolveTempestuousLandingDice?{resolve:gateway.resolveTempestuousLandingDice}:undefined)
}
export async function loadStormCastReplayForPendingException(error:StormCastOriginalPrefixPending,gateway:StormCastBountifulOriginalPort){
 const identity=currentIdentity(error.operation),load=gateway.loadStormCastOriginalPreparation
 if(typeof load!=='function')throw Error('storm-cast-bountiful:prefix-transport-required')
 return issueStormCastPreparedOriginalReplay(identity,async id=>{const book=await load(id);if(!book)throw Error('storm-cast-bountiful:prepared-owner-prefix-required');return book},gateway.loadTempestuousBeforeOriginalPreparation?async id=>{const book=await gateway.loadTempestuousBeforeOriginalPreparation!(id);if(!book)throw Error('storm-cast-bountiful:tempestuous-parent-required');return book}:undefined,gateway.resolveTempestuousLandingDice?{resolve:gateway.resolveTempestuousLandingDice}:undefined)
}
