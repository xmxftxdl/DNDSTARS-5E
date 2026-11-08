import{getRoomSession}from'../../lib/roomSession';
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire';
import{cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone';
import{captureSecondChancePreparedHostFacts}from'./secondChancePreparedHostFacts';
import{restoreBountifulPluginSpellAbilityOriginalCollectorSession}from'./bountifulPluginSpellAbilityOriginalRecovery';
import{readBountifulPluginSpellAbilityOriginalOperation}from'./bountifulPluginSpellAbilityOriginalNative';
import{captureBountifulPluginSpellAbilityOriginalQualification}from'./bountifulPluginSpellAbilityOriginalQualification';
import{readBountifulPluginSpellAbilityOriginalQualification}from'../../rulesets/dnd5e/bountifulPluginSpellAbilityOriginalBoundary';
import{captureBountifulPluginSpellAbilityOriginalContinuation,assertBountifulPluginSpellAbilityOriginalContinuationCurrent,type BountifulPluginSpellAbilityOriginalContinuationGateway}from'../../rulesets/dnd5e/bountifulPluginSpellAbilityOriginalContinuation';
import{createBountifulSpellLocalAuthority,resolveBountifulPluginSpellAbilityOriginalForNormalAck}from'../../rulesets/dnd5e/bountifulLuckNormalAck';
import{beginDnd5eBountifulSpellCharacterPublication,type Dnd5eOpportunityCharacterPublicationScope}from'../../rulesets/dnd5e/opportunityCharacterPublication';
import{bountifulPreparedReplayFacts,type BountifulOriginalDieReceipt}from'../../rulesets/dnd5e/bountifulLuckReceipt';
import{validateBountifulOriginalParents}from'../../../shared/bountiful-luck-state.mjs';
import{resolvePreparedDnd5ePluginSpellCast}from'../../rulesets/dnd5e/pluginSpellTransaction';
import{createDnd5ePreparedDamageCommitSession}from'../../rulesets/dnd5e/damageCommitSession';
import{projectDnd5eCombatApplicationStoreState}from'./combatApplicationStoreProjection';
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes';
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway';
import type{Dnd5eDamageReactionFlowOptions}from'../../rulesets/dnd5e/damageReactionFlow';
import type{BattleMap}from'../../store/maps';
import type{Dnd5eMapResultPlan}from'../../rulesets/dnd5e/mapBridge';
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0];
type Result=ReturnType<typeof resolvePreparedDnd5ePluginSpellCast>;
type LocalInput=Parameters<typeof createBountifulSpellLocalAuthority>[0];
type Boundary={attachReplay:(source:Source)=>Promise<Source>;resolve:(source:Source)=>Promise<Result>};
type Facade=(resolver:(source:Source)=>Result|Promise<Result>,source:Source,map:BattleMap,internalDamageBoundary?:boolean,boundary?:Boundary)=>Promise<Result>;
type Gateway=Parameters<typeof resolveBountifulPluginSpellAbilityOriginalForNormalAck>[1]&BountifulPluginSpellAbilityOriginalContinuationGateway;
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value));
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
// currentRoom is a duplicate transport snapshot, not the Native input graph.
function roomData(value:unknown):unknown{if(value===undefined)return undefined;if(value===null||typeof value==='string'||typeof value==='boolean')return value;if(typeof value==='number'){if(!Number.isFinite(value))throw Error('plugin-spell-initial:invalid-room-input');return value}if(Array.isArray(value))return value.map(v=>v===undefined?null:roomData(v));if(!record(value)||Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw Error('plugin-spell-initial:invalid-room-input');return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,roomData(value[key])]))}
/** UI envelope normalization only. Native always receives the independently
 * authenticated private source; this function cannot issue a source/result. */
function actualPageSource(candidate:Source,original:Source):Source{
 const value=cloneDnd5eHostTransactionInput(captureSecondChancePreparedHostFacts(candidate))as Source&Record<string,unknown>,base=cloneDnd5eHostTransactionInput(captureSecondChancePreparedHostFacts(original))as Source&Record<string,unknown>;
 for(const key of Object.keys(value))if(!Object.hasOwn(base,key))throw Error('plugin-spell-initial:unknown-page-input');
 if(typeof value.now!=='number'||!Number.isFinite(value.now))throw Error('plugin-spell-initial:actual-page-clock-required');value.now=base.now;
 if(JSON.stringify(roomData(value.currentRoom))!==JSON.stringify(roomData(base.currentRoom)))throw Error('plugin-spell-initial:changed-page-room');Reflect.deleteProperty(value,'currentRoom');Reflect.deleteProperty(base,'currentRoom');
 const action=value.prepared.activityHeadlessAction as unknown as Record<string,unknown>|undefined,oldAction=base.prepared.activityHeadlessAction as unknown as Record<string,unknown>|undefined;
 if(action&&oldAction&&!Object.hasOwn(oldAction,'disadvantageNegationChoices')&&Object.hasOwn(action,'disadvantageNegationChoices')){const selected=action.disadvantageNegationChoices;if(selected!==undefined&&(!record(selected)||Object.keys(selected).length))throw Error('plugin-spell-initial:unissued-negation-choice');delete action.disadvantageNegationChoices}
 const rolls=value.rolls as unknown as Record<string,unknown>,oldRolls=base.rolls as unknown as Record<string,unknown>,emptyArrays=new Set(['spellDamageDieRerolls','damageRolls','targetRolls','sourceSlotSpellHealingTargets']),unused=new Set(['spellDamageDieRerolls','spellcastingSavingThrows','sourceActionInterruptionReaction','effectRollDice','attackD20','attackD20Second','savingThrowD20','savingThrowD20Second','damageRolls','targetRolls','overchannelSelfDamageRolls','activityRetainedSaveDice','sourceSlotSpellHealingTargets','activityInterruptChoiceId']);
 for(const key of Object.keys(rolls))if(!Object.hasOwn(oldRolls,key)){const v=rolls[key];if(!unused.has(key)||v!==undefined&&!(emptyArrays.has(key)&&Array.isArray(v)&&v.length===0))throw Error('plugin-spell-initial:unissued-late-input');delete rolls[key]}
 const pools=rolls.activityRolls,locked=oldRolls.activityRolls;if(!record(pools)||!record(locked)||Object.keys(pools).length!==Object.keys(locked).length)throw Error('plugin-spell-initial:exact-protected-originals-required');
 for(const[id,saved]of Object.entries(locked)){const live=pools[id];if(!record(saved)||!record(live)||Object.keys(live).some(key=>!['values','modifier','total'].includes(key))||signature(live.values)!==signature(saved.values)||!Array.isArray(live.values)||typeof live.modifier!=='number'||!Number.isFinite(live.modifier)||typeof live.total!=='number'||live.total!==live.values.reduce((sum:number,n:unknown)=>sum+(typeof n==='number'?n:NaN),0)+live.modifier)throw Error('plugin-spell-initial:exact-protected-originals-required');pools[id]=cloneDnd5eHostTransactionInput(saved)}
 if(signature(value)!==signature(base))throw Error('plugin-spell-initial:changed-page-operation');return cloneDnd5eHostTransactionInput(original);
}
/** First bounded initial-cast consumer: a single actual Telekinesis hold contest.
 * This is a routing gate, never a replacement for the private source issuer. */
export async function beginBountifulPluginSpellAbilityInitialEntry(input:{action:SharedPlayerActionState;source:Source;gateway:Gateway;options:Dnd5eDamageReactionFlowOptions;readProjection:LocalInput['readProjection'];readAnchors:LocalInput['readAnchors'];onPublication:(scope:Dnd5eOpportunityCharacterPublicationScope)=>void;applyReactions:(values:Readonly<Record<string,number>>)=>void}){
 const prepared=input.source.prepared;if(prepared.spell.id!=='telekinesis'||prepared.payload.activityChoices?.movement!=='hold'||prepared.activity?.checks?.length!==1||prepared.activity.checks[0].kind!=='opposed-ability-check')return undefined;
 const combat=await input.gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),first=combat?.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',input.action.id,0])];if(!first)return undefined;
 if(!validateBountifulOriginalParents(combat?.bountifulOriginalParents)||first.originalAdapterId!=='plugin-spell'||!first.rawIssuer?.rollId.startsWith('bountiful-plugin-spell-ability-original:')||first.consumed)throw Error('plugin-spell-initial:actual-current-original-required');
 const identity={parentId:input.action.id,mapId:prepared.map.id,combatId:prepared.state.combatId},native=await restoreBountifulPluginSpellAbilityOriginalCollectorSession(identity);let ended=false;
 const dispose=async()=>{if(!ended){ended=true;await native.dispose()}};
 try{
  const stage=native.run();if(stage.status!=='pending-ally-natural-one'||stage.request.nativeLucky)throw Error('plugin-spell-initial:actual-first-original-required');const operation=native.operation(stage),facts=readBountifulPluginSpellAbilityOriginalOperation(operation),source=actualPageSource(input.source,facts.source),qualification=await captureBountifulPluginSpellAbilityOriginalQualification(operation),continuation=await captureBountifulPluginSpellAbilityOriginalContinuation({source,qualification},input.gateway),local=createBountifulSpellLocalAuthority(input),initial=cloneDnd5eHostTransactionInput(input.readProjection()),receipts=Object.values(combat!.bountifulOriginalParents!).filter(row=>row.identity.parentId===input.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence);
  if(signature(input.action)!==signature(source.prepared.action))throw Error('plugin-spell-initial:exact-action-required');
  let resolved:Awaited<ReturnType<typeof resolveBountifulPluginSpellAbilityOriginalForNormalAck>>|undefined,applied=false;
  const replaySource=(candidate:Source)=>{if(ended||!local.authorityUnchanged()||getRoomSession()?.role!=='dm')throw Error('plugin-spell-initial:actual-current-entry-required');readBountifulPluginSpellAbilityOriginalQualification(qualification,source);actualPageSource(candidate,source);return{...source,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts})}};
  const preview:typeof resolvePreparedDnd5ePluginSpellCast=candidate=>{const probe=replaySource(candidate),session=createDnd5ePreparedDamageCommitSession(probe,resolvePreparedDnd5ePluginSpellCast,()=>false);try{const stage=session.run(probe.prepared.state);if(stage.status!=='resolved')throw Error('plugin-spell-initial:unissued-preview-phase:'+stage.status);return stage.result}finally{session.cancel()}};
  const facade=(ordinary:Facade):Facade=>async(resolver,candidate,map,internalDamageBoundary,boundary)=>{
   if(resolver!==preview||internalDamageBoundary||boundary||resolved||map.id!==source.prepared.map.id)throw Error('plugin-spell-initial:actual-single-original-facade-required');replaySource(candidate);
   return ordinary(resolvePreparedDnd5ePluginSpellCast,candidate,map,false,{attachReplay:async value=>{await assertBountifulPluginSpellAbilityOriginalContinuationCurrent(continuation,input.gateway,source);return replaySource(value)},resolve:async value=>{replaySource(value);resolved=await resolveBountifulPluginSpellAbilityOriginalForNormalAck({action:input.action,source,pluginSpellAbilityOriginalQualification:qualification,pluginSpellAbilityOriginalContinuation:continuation,options:{...input.options,authorityUnchanged:local.authorityUnchanged}},input.gateway);if(!resolved.result.ok)throw Error('plugin-spell-initial:actual-native-completion-required');const handoffs=resolved.result.activityHandoffs;if(handoffs&&Object.values(handoffs).some(value=>value!==undefined&&(!Array.isArray(value)||value.length>0)))throw Error('plugin-spell-initial:unissued-room-handoff');return cloneDnd5eHostTransactionInput(resolved)}})
  };
  return{preview,facade,source:cloneDnd5eHostTransactionInput(source),apply<T>(proposed:Dnd5eMapResultPlan,apply:(application:Dnd5eMapResultPlan,scope:Dnd5eOpportunityCharacterPublicationScope)=>T):T{if(applied||!resolved?.application)throw Error('plugin-spell-initial:actual-native-before-application-required');let returned:T|undefined,called=false;local.applyNative((application,reactions)=>{if(signature(projectDnd5eCombatApplicationStoreState({map:initial.map,characters:initial.characters,application}))!==signature(projectDnd5eCombatApplicationStoreState({map:initial.map,characters:initial.characters,application:proposed})))throw Error('plugin-spell-initial:unissued-room-postprocessing');const scope=beginDnd5eBountifulSpellCharacterPublication(local);input.onPublication(scope);returned=apply(application,scope);called=true;input.applyReactions(reactions)});if(!called)throw Error('plugin-spell-initial:actual-store-application-required');applied=true;return returned as T},dispose}
 }catch(error){await dispose();throw error}
}
export type BountifulPluginSpellAbilityInitialFacade=Facade;
export type BountifulPluginSpellAbilityInitialGateway=Gateway&Pick<SharedRoomGatewayPort,'publishEvent'>;
