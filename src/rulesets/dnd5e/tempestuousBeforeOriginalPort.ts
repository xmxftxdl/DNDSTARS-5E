import type{Dnd5eTempestuousLandingOriginalOperation}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{dnd5eAvailableTempestuousSpellFlight}from'./headlessCombatEngine'
import{issueTempestuousBeforePreparedOriginalReplay,assertTempestuousBeforePreparedOriginalReplaySource}from'./tempestuousBeforePreparedOriginalReplay'
import type{TempestuousBeforePreparationIdentity,TempestuousBeforeOriginalPreparationBook}from'./tempestuousBeforeOriginalPreparation'
export interface TempestuousBeforeOriginalPort{
 resolveTempestuousLandingDice?:(operation:Dnd5eTempestuousLandingOriginalOperation)=>Promise<readonly number[]>
 loadTempestuousBeforeOriginalPreparation?:(identity:TempestuousBeforePreparationIdentity)=>Promise<TempestuousBeforeOriginalPreparationBook|undefined>
 /** In-memory expectation only. It cannot be serialized as source or authority. */
 tempestuousBeforePreparedReplay?:object
}
/** Optional only when no known prefix and no protected book exists. A stale,
 * rejected, unanswered or known-but-untransported original never falls back. */
export async function loadTempestuousBeforeReplayForOriginal(source:{prepared:unknown},resolve:unknown,gateway:TempestuousBeforeOriginalPort){
 const expected=gateway.tempestuousBeforePreparedReplay,core=source as Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
 if(resolve!==resolvePreparedDnd5eSpellCast){if(expected!==undefined)throw Error('tempestuous-original:actual-core-spell-required');return undefined}
 const p=core.prepared;if(!p?.action?.id||p.action.type!=='dnd5e-spell-cast'||!p.map?.id||!p.state?.combatId){if(expected!==undefined)throw Error('tempestuous-original:actual-core-spell-required');return undefined}
 if(expected!==undefined)assertTempestuousBeforePreparedOriginalReplaySource(core,expected)
 const load=gateway.loadTempestuousBeforeOriginalPreparation;if(!load){if(expected!==undefined)throw Error('tempestuous-original:prefix-transport-required');return undefined}
 if(expected===undefined&&!dnd5eAvailableTempestuousSpellFlight(p.state,p.actorToken.id).length)return undefined
 const identity={parentId:p.action.id,mapId:p.map.id,combatId:p.state.combatId},book=await load(identity)
 if(!book){if(expected!==undefined)throw Error('tempestuous-original:private-owner-prefix-required');return undefined}
 const token=await issueTempestuousBeforePreparedOriginalReplay(identity,async id=>{const current=await load(id);if(!current)throw Error('tempestuous-original:private-owner-prefix-required');return current},gateway.resolveTempestuousLandingDice?{resolve:gateway.resolveTempestuousLandingDice}:undefined);assertTempestuousBeforePreparedOriginalReplaySource(core,token);return token
}
