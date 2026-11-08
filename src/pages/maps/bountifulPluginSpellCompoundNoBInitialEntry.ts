import{readDnd5ePluginSpellCompoundNoBOperation,type Dnd5ePluginSpellCompoundNoBOperation}from'../../rulesets/dnd5e/pluginSpellCompoundNoBOperation'
import{createBountifulSpellLocalAuthority,resolveBountifulPluginSpellCompoundNoBForNormalAck}from'../../rulesets/dnd5e/bountifulLuckNormalAck'
import{verifyBountifulPluginSpellCompoundPageSource,beginBountifulPluginSpellSavingInitialEntry}from'./bountifulPluginSpellSavingInitialEntry'
import{beginDnd5eBountifulSpellCharacterPublication,type Dnd5eOpportunityCharacterPublicationScope}from'../../rulesets/dnd5e/opportunityCharacterPublication'
import{cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone'
import{projectDnd5eCombatApplicationStoreState}from'./combatApplicationStoreProjection'
import{resolvePreparedDnd5ePluginSpellCast}from'../../rulesets/dnd5e/pluginSpellTransaction'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{getRoomSession}from'../../lib/roomSession'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{Dnd5eDamageReactionFlowOptions}from'../../rulesets/dnd5e/damageReactionFlow'
import type{Dnd5eMapResultPlan}from'../../rulesets/dnd5e/mapBridge'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
type LocalInput=Parameters<typeof createBountifulSpellLocalAuthority>[0]
type Facade=Parameters<Awaited<ReturnType<typeof beginBountifulPluginSpellSavingInitialEntry>>['facade']>[0]
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
/** Same actual Page/Base/provisional publication boundary, with an independently
 * qualified completed no-B Native operation instead of a fabricated receipt. */
export async function beginBountifulPluginSpellCompoundNoBInitialEntry(input:LocalInput&{source:Source;operation:Dnd5ePluginSpellCompoundNoBOperation;gateway:Pick<SharedRoomGatewayPort,'loadResource'|'loadBountifulPluginSpellSavingOriginalSource'>;options:Dnd5eDamageReactionFlowOptions;onPublication:(scope:Dnd5eOpportunityCharacterPublicationScope)=>void;applyReactions:(values:Readonly<Record<string,number>>)=>void}){
 const actual=readDnd5ePluginSpellCompoundNoBOperation(input.operation)
 if(!actual.result?.result.ok||!actual.result.application||actual.request||signature(input.action)!==signature(actual.source.prepared.action)||getRoomSession()?.role!=='dm')throw Error('ice-knife-no-b-entry:actual-completed-parent-required')
 const source=verifyBountifulPluginSpellCompoundPageSource(input.source,actual.source),local=createBountifulSpellLocalAuthority(input),initial=cloneDnd5eHostTransactionInput(input.readProjection());let ended=false,applied=false,resolved:Awaited<ReturnType<typeof resolveBountifulPluginSpellCompoundNoBForNormalAck>>|undefined
 const assertSource=(candidate:Source)=>{if(ended||!local.authorityUnchanged()||getRoomSession()?.role!=='dm')throw Error('ice-knife-no-b-entry:changed-current-parent');readDnd5ePluginSpellCompoundNoBOperation(input.operation);verifyBountifulPluginSpellCompoundPageSource(candidate,source)}
 const preview:typeof resolvePreparedDnd5ePluginSpellCast=candidate=>{assertSource(candidate);return readDnd5ePluginSpellCompoundNoBOperation(input.operation).result!}
 const facade=(ordinary:Facade):Facade=>async(resolver,candidate,map,internalDamageBoundary,boundary)=>{if(resolver!==preview||internalDamageBoundary||boundary||resolved||map.id!==source.prepared.map.id)throw Error('ice-knife-no-b-entry:actual-single-facade-required');assertSource(candidate);return ordinary(resolvePreparedDnd5ePluginSpellCast,candidate,map,false,{attachReplay:async value=>{assertSource(value);return cloneDnd5eHostTransactionInput(source)},resolve:async value=>{assertSource(value);resolved=await resolveBountifulPluginSpellCompoundNoBForNormalAck({action:input.action,operation:input.operation,options:{...input.options,authorityUnchanged:local.authorityUnchanged}},input.gateway);return cloneDnd5eHostTransactionInput(resolved)}})}
 return{source:cloneDnd5eHostTransactionInput(source),preview,facade,apply<T>(proposed:Dnd5eMapResultPlan,apply:(application:Dnd5eMapResultPlan,scope:Dnd5eOpportunityCharacterPublicationScope)=>T):T{if(applied||!resolved?.application)throw Error('ice-knife-no-b-entry:actual-native-before-application');let returned:T|undefined,called=false;local.applyNative((application,reactions)=>{if(signature(projectDnd5eCombatApplicationStoreState({map:initial.map,characters:initial.characters,application}))!==signature(projectDnd5eCombatApplicationStoreState({map:initial.map,characters:initial.characters,application:proposed})))throw Error('ice-knife-no-b-entry:changed-native-postprocessing');const scope=beginDnd5eBountifulSpellCharacterPublication(local);input.onPublication(scope);returned=apply(application,scope);called=true;input.applyReactions(reactions)});if(!called)throw Error('ice-knife-no-b-entry:actual-store-application-required');applied=true;return returned as T},async dispose(){ended=true}}
}
