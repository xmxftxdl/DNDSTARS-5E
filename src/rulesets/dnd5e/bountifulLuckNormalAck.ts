import{readDnd5ePluginSpellCompoundAnsweredCompletion,type Dnd5ePluginSpellCompoundAnsweredCompletion}from'./pluginSpellCompoundAnsweredCompletion'
import{readDnd5ePluginSpellCompoundAnsweredQualification,dnd5ePluginSpellCompoundQualifiedResolver,projectDnd5ePluginSpellCompoundQualifiedReplay}from'./pluginSpellCompoundQualification'
import{readDnd5ePluginSpellCompoundPrimaryAnsweredQualification}from'./pluginSpellCompoundPrimaryAnsweredQualification'
import{readDnd5ePluginSpellCompoundNoBOperation,type Dnd5ePluginSpellCompoundNoBOperation}from'./pluginSpellCompoundNoBOperation'
import{resolvePreparedDnd5ePluginSpellCompound}from'./pluginSpellCompoundNative'
import{projectDnd5ePluginSpellSavingAnsweredSessionInput,readDnd5ePluginSpellSavingQualifiedResolver,readDnd5ePluginSpellSavingBeforeQualification}from'./pluginSpellSavingOriginalOperation'
import{readBountifulPluginSpellSavingBefore,projectBountifulPluginSpellSavingBeforeSource}from'../../pages/maps/bountifulPluginSpellSavingBefore'
import{assertBountifulPluginSpellSavingEffectsQualificationCurrent,readBountifulPluginSpellSavingEffectsQualifiedSource,type BountifulPluginSpellSavingEffectsQualification}from'./bountifulPluginSpellSavingEffectsQualification'
import{readDnd5ePluginSpellSavingOriginalQualifiedSource}from'./pluginSpellSavingOriginalOperation'
import{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import{readDnd5ePluginSpellSavingOriginalQualificationCurrent,type Dnd5ePluginSpellSavingOriginalQualification}from'./pluginSpellSavingOriginalOperation'
import type{BountifulDeathAreaCompletedBoundary}from'./bountifulDeathAreaOriginalOperation'
import type{BountifulDeathAreaOriginalBook}from'../../ports/dnd5eDeathAreaOriginalTransport'
import{readBountifulDeathFirstRepeatContinuation,type BountifulDeathFirstRepeatContinuation}from'./bountifulDeathFirstRepeatSavingCollector'
import{readBountifulDeathRepeatContinuation,type BountifulDeathRepeatContinuation}from'./bountifulDeathRepeatSavingCollector'
import{bountifulDeathHasInactiveAreaBoundary}from'./bountifulDeathInactiveAreaBoundary'
import{prepareDnd5eBeginTurn,readDnd5eActualBeginTurnResult}from'./beginTurnAction'
import{assertSpellcastingTargetCompletedOriginalCurrent,completeSpellcastingTargetOriginal,readSpellcastingTargetCompletedOriginal}from'./spellcastingTargetOriginalCompletion'
import{readSpellcastingTargetOriginalContinuation,type SpellcastingTargetOriginalContinuation}from'./spellcastingTargetOriginalContinuation'
import{readBountifulPluginSpellAbilityOriginalContinuation,assertBountifulPluginSpellAbilityOriginalContinuationCurrent,type BountifulPluginSpellAbilityOriginalContinuation,type BountifulPluginSpellAbilityOriginalContinuationGateway}from'./bountifulPluginSpellAbilityOriginalContinuation'
import{completeBountifulPluginSpellAbilityOriginal,readBountifulPluginSpellAbilityCompletedOriginal}from'./bountifulPluginSpellAbilityOriginalCompletion'
import{readBountifulPluginSpellAbilityOriginalQualification,type BountifulPluginSpellAbilityOriginalQualification}from'./bountifulPluginSpellAbilityOriginalBoundary'
import{projectHeadlessInitiativeOrder}from'../../pages/mapsPageHelpers'
import{dnd5eHeadlessTurnKey}from'./headlessCombatEngine'
import{readBountifulActivityOriginalContinuation,assertBountifulActivityOriginalContinuationCurrent,type BountifulActivityOriginalContinuation,type BountifulActivityOriginalContinuationGateway}from'./bountifulActivityOriginalContinuation'
import{completeBountifulActivityOriginal,readBountifulActivityCompletedOriginal}from'./bountifulActivityOriginalCompletion'
import{readBountifulActivityOriginalQualification,type BountifulActivityOriginalQualification}from'./bountifulActivityOriginalQualification'
import{withForcedMovementPresentation}from'../../pages/maps/forcedMovementPresentation'
import {projectDnd5eCombatApplicationStoreState} from '../../pages/maps/combatApplicationStoreProjection'
import {saveBountifulPhase} from './bountifulPhaseCommit'
import {assertBountifulOriginalSceneScope,markBountifulOriginalSceneReactions} from './bountifulOriginalSceneScope'
import {bountifulOriginalScopeMatches} from '../../../shared/bountiful-original-scope.mjs'
import {validateBountifulReadyParents} from '../../../shared/bountiful-ready-parents.mjs'
import {readBountifulSpellOriginalReadyFrame,inspectBountifulSpellOriginalReadyFrame} from './bountifulOriginalReadyFrame'
import {publishBountifulReadyThroughNormalAck,prepareBountifulReadySceneAck} from './bountifulReadyNormalAck'
import type {BountifulReadyParentData} from './bountifulOriginalReadyFrame'
import {assertBountifulEquipmentFinalCost} from './bountifulEquipmentFinalCost'
import {DND5E_CORE_INSPIRATION_RESOURCE_KEY} from '../../lib/d20InterruptPolicy'
import {recordBountifulOriginalFall} from './bountifulLuckFallJournal'
import {assertBountifulAfterDiceSource,bountifulEquipmentInputWithoutTransport,encodeBountifulAfterDiceSource,readBountifulAfterDiceSource,type BountifulContinuationReceipt} from './bountifulLuckAfterDice'
import {createDnd5ePreparedDamageCommitSession} from './damageCommitSession'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {Dnd5eActionResult,Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import type {Dnd5eMapResultPlan} from './mapBridge'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedPlayerActionState,SharedCombatState,SharedPlayerActionAckState} from '../../lib/sharedCombatTypes'
import {publishPlayerActionAckWithSnapshots,type PublishPlayerActionAckInput} from '../../lib/playerActionAckPublish'
import {resolveDnd5ePreparedWithMaterialDamageReactions,type Dnd5eDamageReactionFlowOptions} from './damageReactionFlow'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {captureSecondChancePreparedHostFacts} from '../../pages/maps/secondChancePreparedHostFacts'
import {getRoomSession} from '../../lib/roomSession'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'
import {bountifulOriginalParentReceiptId,actualBountifulResolvers} from './bountifulLuckPersistentHost'
import {bountifulPreparedReplayFacts,decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {readBountifulOriginalSource} from './bountifulLuckPersistentRoomDriver'
import {readBountifulOpportunityPostNativePrefix,readBountifulOpportunityMovementJournal} from './bountifulOpportunityMoveAck'
import {resolvePreparedDnd5eOpportunityPlayerMove} from './opportunityMoveAction'
import {prepareDnd5ePlayerMove,resolvePreparedDnd5ePlayerMove} from './playerMoveAction'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {sameActivityParentData} from '../../pages/maps/postNativeActivityParent'
import {planDnd5eMapResultApplication} from './mapBridge'
import {projectDnd5eHeadlessTurnEconomy} from './turnEconomy'

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'>&Partial<Pick<SharedRoomGatewayPort,'loadBountifulPluginSpellSavingOriginalSource'|'loadBountifulDeathAreaOriginalSource'|'publishEvent'>>&Partial<BountifulActivityOriginalContinuationGateway>&Partial<BountifulPluginSpellAbilityOriginalContinuationGateway>
type Revisioned<T>=T&{_sync?:{revision?:number}}
type Combat=SharedCombatState&{bountifulReadyParents?:Record<string,BountifulReadyParentData>;bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
interface ParentResult{result:Dnd5eActionResult;application?:Dnd5eMapResultPlan}
interface PreparedInput{prepared:{state:Dnd5eHeadlessCombatState;map:BattleMap;characters:readonly Character[];action:{id:string};characterIdByCombatantId:Readonly<Record<string,string>>}}
interface Binding{action:SharedPlayerActionState;sourceState:Dnd5eHeadlessCombatState;characterIdByCombatantId:Readonly<Record<string,string>>;receipts:readonly BountifulOriginalDieReceipt[];readyRecords:readonly BountifulReadyParentData[];resolved:ParentResult;authorityUnchanged:()=>boolean;opportunityContinuationPending?:true;deathTurnCompletion?:DeathTurnCompletion}

interface DeathTurnCompletion{signature:string;round:number;initiativeIndex:number;initiativeOrder:SharedCombatState['initiativeOrder'];refreshedReactions:readonly string[];economies:NonNullable<SharedCombatState['dnd5eTurnEconomyByToken']>}
// Only the fixed current-turn death facade, actually run above Native and Base,
// may sign a completed turn advance. Neither a caller result nor a JSON flag
// can populate this private binding, and deferred Page begin-turn is excluded.
function actualDeathTurnCompletion(source:PreparedInput,resolve:unknown,resolved:ParentResult,combat:Combat):DeathTurnCompletion|undefined{
 if(resolve!==actualBountifulResolvers['death-save']||!resolved.result.ok||!resolved.application)return
 const command=(source as PreparedInput&{command?:{type?:unknown;deferNextTurnStart?:unknown}}).command,state=resolved.result.state,before=source.prepared.state
 if(command?.type!=='death-save-turn'||command.deferNextTurnStart!==false||state.round===before.round&&state.initiativeIndex===before.initiativeIndex)return
 const actorId=state.initiativeOrder[state.initiativeIndex],actor=state.combatants[actorId]
 if(!actor||actor.classState.turnStartResolvedTurnKey!==dnd5eHeadlessTurnKey(state,actorId)||!resolved.result.events.some(e=>e.type==='turn-started'&&e.actorId===actorId&&e.round===state.round))throw Error('bountiful-death-tail:actual-completed-native-begin-required')
 const refreshedReactions=Object.values(state.combatants).filter(actor=>{let spent=-1,started=-1;resolved.result.events.forEach((e,index)=>{if(e.type==='turn-resource-spent'&&e.actorId===actor.id&&e.resource==='reaction')spent=index;if(e.type==='turn-started'&&e.actorId===actor.id)started=index});return actor.turn.reactionAvailable&&spent>=0&&started>spent}).map(a=>a.id)
 const economies=Object.fromEntries(Object.entries(state.combatants).map(([id,a])=>[id,projectDnd5eHeadlessTurnEconomy(id===actorId?createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(state,id),a.speed):(combat.dnd5eTurnEconomyByToken?.[id]??createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(state,id),a.speed)),a.turn,a.speed)]))
 return{signature:JSON.stringify(encodeSecondChanceParentWire(resolved)),round:state.round,initiativeIndex:state.initiativeIndex,initiativeOrder:projectHeadlessInitiativeOrder({current:combat.initiativeOrder,state}),refreshedReactions,economies}
}

const bindings=new WeakMap<SharedPlayerActionState,Binding>()
const deathAreaBindingGateways=new WeakMap<Binding,Gateway>()
const deathDeferredBeginSources=new WeakMap<object,{clock:number|undefined;readClock:()=>number|undefined}>()
const deathDeferredBoundaries=new WeakMap<object,{map:BattleMap;characters:readonly Character[]}>()
const deathActiveAreaBoundaries=new WeakMap<object,{cap:BountifulDeathAreaCompletedBoundary;book:BountifulDeathAreaOriginalBook;state:Dnd5eHeadlessCombatState;events:readonly import('./headlessCombatEngine').Dnd5eCombatEvent[]}>()
const deathAreaPublicationBooks=new WeakMap<Binding,BountifulDeathAreaOriginalBook>()
const deathLocalOriginalCombats=new WeakMap<object,DeathLocalCombat>()
const deathLocalResults=new WeakMap<object,{signature:string;native:ParentResult}>()
const deathLocalProjectedWorld=new WeakMap<object,{map:BattleMap;characters:readonly Character[]}>()
function safeDeathNativeData(value:unknown,seen=new WeakSet<object>()):boolean{
 if(value===null||value===undefined||['string','number','boolean'].includes(typeof value))return true
 if(typeof value!=='object'||seen.has(value))return typeof value==='object'
 seen.add(value);const proto=Object.getPrototypeOf(value),allowed=proto===Object.prototype||proto===null||proto===Array.prototype||proto===Date.prototype||proto===Map.prototype||proto===Set.prototype
 if(!allowed)return false
 for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))){if(!descriptor.enumerable)continue;if(!('value'in descriptor)||!safeDeathNativeData(descriptor.value,seen))return false}
 if(proto===Map.prototype)for(const[k,v]of Map.prototype.entries.call(value)){if(!safeDeathNativeData(k,seen)||!safeDeathNativeData(v,seen))return false}
 if(proto===Set.prototype)for(const v of Set.prototype.values.call(value)){if(!safeDeathNativeData(v,seen))return false}
 return true
}
const deathLocalOriginals=new WeakMap<object,{map:BattleMap;characters:readonly Character[]}>()
const deathLocalPublications=new WeakMap<object,()=>{action:SharedPlayerActionState;beforeCharacters:readonly Character[]}>()
function deathAreaBoundaryInactive(binding:Binding,map:BattleMap,characters:readonly Character[]){const before=binding.sourceState,after=binding.resolved.result.state;if(before.round===after.round&&before.initiativeIndex===after.initiativeIndex)return true;const boundary=(state:Dnd5eHeadlessCombatState,timing:'turn-start'|'turn-end')=>({timing,round:state.round,tokenId:state.initiativeOrder[state.initiativeIndex],turnKey:state.round+':'+(state.initiativeSlotIds?.[state.initiativeIndex]??state.initiativeOrder[state.initiativeIndex])});return bountifulDeathHasInactiveAreaBoundary(map,characters,{boundaries:[boundary(before,'turn-end'),boundary(after,'turn-start')]})}
type DeathLocalCombat=Pick<SharedCombatState,'active'|'mapId'|'combatId'|'round'|'initiativeIndex'|'initiativeOrder'|'dnd5eTurnEconomyByToken'>
type DeathLocalProjection={map:BattleMap;characters:readonly Character[];combat:DeathLocalCombat}
/** Local deferral for this actual death result only; never a dice or world grant. */
export function createBountifulDeathLocalAuthority(input:{action:SharedPlayerActionState;readProjection:()=>DeathLocalProjection;readAnchors:()=>unknown}){
 const session=host(),initial=cloneDnd5eHostTransactionInput(input.readProjection()),anchors=JSON.stringify(input.readAnchors())
 let expected=JSON.stringify(initial),projected=false,deferredStaged=false,material:ParentResult|undefined
 const actual=(binding:Binding|undefined)=>!!binding&&binding.action===input.action&&binding.receipts[0]?.originalAdapterId==='death-save'&&safeDeathNativeData(binding.resolved)&&deathLocalResults.get(binding.resolved)?.signature===JSON.stringify(encodeSecondChanceParentWire(binding.resolved))
 const current=()=>{const now=getRoomSession();return now?.role==='dm'&&now.roomId===session.roomId&&now.memberId===session.memberId&&JSON.stringify(input.readAnchors())===anchors&&JSON.stringify(input.readProjection())===expected&&(!material||bindings.get(input.action)?.resolved===material&&actual(bindings.get(input.action)))}
 const requireNative=(allowDeferred=false)=>{const binding=bindings.get(input.action);if(projected||!binding||binding.authorityUnchanged!==current||!current()||!actual(binding)||!binding.resolved.result.ok||!binding.resolved.application)throw Error('bountiful-death-local:actual-current-death-result-required');const original=deathLocalOriginals.get(binding.resolved);if(!original||JSON.stringify(initial.map)!==JSON.stringify(original.map)||JSON.stringify(initial.characters)!==JSON.stringify(original.characters))throw Error('bountiful-death-local:actual-original-world-required');if(allowDeferred&&JSON.stringify(initial.combat)!==JSON.stringify(deathLocalOriginalCombats.get(binding.resolved)))throw Error('bountiful-death-local:actual-original-combat-required');const state=binding.resolved.result.state;if((state.round!==binding.sourceState.round||state.initiativeIndex!==binding.sourceState.initiativeIndex)&&!binding.deathTurnCompletion&&!allowDeferred)throw Error('bountiful-death-local:deferred-native-begin-pending');return binding}
 const applyProjection=(binding:Binding,apply:(application:Dnd5eMapResultPlan,combat:DeathLocalCombat)=>void)=>{
  const native=deathLocalResults.get(binding.resolved)!.native,application=cloneDnd5eHostTransactionInput(native.application!),state=native.result.state,store=projectDnd5eCombatApplicationStoreState({map:initial.map,characters:initial.characters,application}),economies=binding.deathTurnCompletion?.economies??Object.fromEntries(Object.entries(state.combatants).map(([id,a])=>[id,projectDnd5eHeadlessTurnEconomy(initial.combat.dnd5eTurnEconomyByToken?.[id]??createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(state,id),a.speed),a.turn,a.speed)])),combat:DeathLocalCombat={...initial.combat,round:state.round,initiativeIndex:state.initiativeIndex,initiativeOrder:projectHeadlessInitiativeOrder({current:initial.combat.initiativeOrder,state}),dnd5eTurnEconomyByToken:cloneDnd5eHostTransactionInput(economies)},world=cloneDnd5eHostTransactionInput({map:store.map,characters:store.characters}),next=JSON.stringify({...world,combat});
  apply(application,combat);if(JSON.stringify(input.readAnchors())!==anchors||JSON.stringify(input.readProjection())!==next)throw Error('bountiful-death-local:unexpected-projection');deathLocalProjectedWorld.set(binding.resolved,world);expected=next;material=binding.resolved;projected=true
 }
 const capability={authorityUnchanged:current,
  async captureActiveAreaOrigin(){const binding=requireNative(true),original=deathLocalOriginals.get(binding.resolved)!;if(deathAreaBoundaryInactive(binding,original.map,original.characters))return undefined;return captureBountifulDeathAreaOrigin(input.action)},
  applyNative(apply:(application:Dnd5eMapResultPlan,combat:DeathLocalCombat)=>void){applyProjection(requireNative(),apply)},
  async bindInitialBase(base:Awaited<ReturnType<typeof import('../../pages/maps/settleDnd5eCombatResult').settleDnd5eConcentrationChecks>>){
   const binding=requireNative(true),prior=binding.resolved,record=deathLocalResults.get(prior)!,original=deathLocalOriginals.get(prior)!,pending=deathDeferredBeginSources.get(prior),{readDnd5eCompletedCombatBase}=await import('../../pages/maps/settleDnd5eCombatResult');readDnd5eCompletedCombatBase(prior.result,base);if(!current()||!safeDeathNativeData(base)||!base.result.ok)throw Error('bountiful-death-local:actual-current-initial-Base-required')
   const application=planDnd5eMapResultApplication({state:base.result.state,map:original.map,characters:original.characters,characterIdByCombatantId:binding.characterIdByCombatantId,events:[...base.result.events]}),world=projectDnd5eCombatApplicationStoreState({map:original.map,characters:original.characters,application}),nativeWorld=projectDnd5eCombatApplicationStoreState({map:original.map,characters:original.characters,application:record.native.application!}),baseWorld=projectDnd5eCombatApplicationStoreState({map:nativeWorld.map,characters:nativeWorld.characters,application:base.application})
   if(base.application.geometry||JSON.stringify(world.map)!==JSON.stringify(baseWorld.map)||JSON.stringify(world.characters)!==JSON.stringify(baseWorld.characters))throw Error('bountiful-death-local:additional-initial-Base-world-provenance-required')
   if(binding.deathTurnCompletion&&JSON.stringify(base.result.state)!==JSON.stringify(record.native.result.state))throw Error('bountiful-death-local:additional-recovered-Base-provenance-required')
   const combined={...prior,result:base.result,application};binding.resolved=combined;deathLocalResults.set(combined,{signature:JSON.stringify(encodeSecondChanceParentWire(combined)),native:cloneDnd5eHostTransactionInput(combined)});deathLocalOriginals.set(combined,original);deathLocalOriginalCombats.set(combined,deathLocalOriginalCombats.get(prior)!);if(pending){deathDeferredBeginSources.delete(prior);deathDeferredBeginSources.set(combined,pending)}
   if(binding.deathTurnCompletion){const state=base.result.state;if(JSON.stringify(state)!==JSON.stringify(record.native.result.state))throw Error('bountiful-death-local:additional-recovered-Base-provenance-required');binding.deathTurnCompletion={...binding.deathTurnCompletion,signature:JSON.stringify(encodeSecondChanceParentWire(combined))}}
   return combined
  },
  /** Provisional local application of this private Native result only. The
   * deferred binding remains unpublishable until actual begin and Base finish. */
  stageDeferredNative(apply:(application:Dnd5eMapResultPlan,combat:DeathLocalCombat)=>void){const binding=requireNative(true);if(!deathDeferredBeginSources.has(binding.resolved)||!deathAreaBoundaryInactive(binding,initial.map,initial.characters))throw Error('bountiful-death-local:actual-bounded-deferred-native-required');applyProjection(binding,apply);deferredStaged=true},
  async stageDeferredAreaNative(cap:BountifulDeathAreaCompletedBoundary,apply:(application:Dnd5eMapResultPlan,combat:DeathLocalCombat)=>void){
   const binding=requireNative(true),{readBountifulDeathAreaCompletedBoundary}=await import('./bountifulDeathAreaOriginalOperation'),proof=await readBountifulDeathAreaCompletedBoundary(cap)
   if(!current()||requireNative(true)!==binding||!deathDeferredBeginSources.has(binding.resolved)||proof.operation.origin.parentId!==input.action.id||JSON.stringify(proof.operation.origin.action)!==JSON.stringify(input.action)||JSON.stringify(proof.operation.origin.originalSource)!==JSON.stringify(binding.receipts[0].originalParent))throw Error('bountiful-death-area:exact-current-completed-boundary-required')
   deathActiveAreaBoundaries.set(binding.resolved,{cap,book:proof.book,state:proof.base.result.state,events:proof.base.result.events});applyProjection(binding,apply);deferredStaged=true
  },
  async applyDeferredAreaTurnBoundary(cap:BountifulDeathAreaCompletedBoundary,apply:(world:{map:BattleMap;characters:readonly Character[]})=>void){
   const binding=bindings.get(input.action),record=binding&&deathActiveAreaBoundaries.get(binding.resolved);if(!deferredStaged||!binding||binding.resolved!==material||!current()||!actual(binding)||record?.cap!==cap||deathDeferredBoundaries.has(binding.resolved))throw Error('bountiful-death-area:actual-staged-area-boundary-required')
   const {readBountifulDeathAreaCompletedBoundary}=await import('./bountifulDeathAreaOriginalOperation'),proof=await readBountifulDeathAreaCompletedBoundary(cap);if(!current()||JSON.stringify(proof.book)!==JSON.stringify(record.book)||JSON.stringify(proof.base.result.state)!==JSON.stringify(record.state))throw Error('bountiful-death-area:changed-actual-boundary')
   const world=cloneDnd5eHostTransactionInput({map:proof.boundary.map,characters:proof.boundary.characters}),nextProjection={...JSON.parse(expected),...world};apply(world);if(JSON.stringify(input.readAnchors())!==anchors||JSON.stringify(input.readProjection())!==JSON.stringify(nextProjection))throw Error('bountiful-death-area:unexpected-boundary-projection');expected=JSON.stringify(nextProjection);deathDeferredBoundaries.set(binding.resolved,world);deathAreaPublicationBooks.set(binding,cloneDnd5eHostTransactionInput(proof.book))
  },
  async applyDeferredTurnBoundary(transition:object,apply:(world:{map:BattleMap;characters:readonly Character[]})=>void){
   const binding=bindings.get(input.action);if(!deferredStaged||!binding||binding.resolved!==material||!current()||!actual(binding)||deathDeferredBoundaries.has(binding.resolved))throw Error('bountiful-death-local:actual-staged-boundary-required')
   const helpers=await import('../../pages/maps/persistentAreaTurnBoundary'),fact=helpers.readDnd5eActualPersistentAreaTurnTransition(transition),record=deathLocalResults.get(binding.resolved)!,original=deathLocalOriginals.get(binding.resolved)!,native=record.native,store=projectDnd5eCombatApplicationStoreState({map:original.map,characters:original.characters,application:native.application!}),order=projectHeadlessInitiativeOrder({current:initial.combat.initiativeOrder,state:native.result.state}),previous=helpers.dnd5ePersistentAreaTurnCursor({mapId:initial.map.id,combatId:binding.sourceState.combatId,round:binding.sourceState.round,initiativeIndex:binding.sourceState.initiativeIndex,initiativeOrder:initial.combat.initiativeOrder}),next=helpers.dnd5ePersistentAreaTurnCursor({mapId:initial.map.id,combatId:native.result.state.combatId,round:native.result.state.round,initiativeIndex:native.result.state.initiativeIndex,initiativeOrder:order})
   if(!previous||!next||fact.input.worldMinute!==deathDeferredBeginSources.get(binding.resolved)?.clock||JSON.stringify(fact.input.map)!==JSON.stringify(store.map)||JSON.stringify(fact.input.characters)!==JSON.stringify(store.characters)||JSON.stringify(fact.input.transition)!==JSON.stringify(helpers.planDnd5ePersistentAreaTurnTransition(previous,next))||!bountifulDeathHasInactiveAreaBoundary(store.map,store.characters,fact.input.transition))throw Error('bountiful-death-local:exact-native-turn-boundary-required')
   const expectedBoundary=await helpers.settleDnd5ePersistentAreaTurnTransition({transition:fact.input.transition,map:store.map,characters:store.characters,worldMinute:fact.input.worldMinute,initiativeOrder:order,settleBoundary:async value=>({map:value.map,characters:[...value.characters],logs:[]}),expireBoundary:value=>value.map})
   if(!current()||JSON.stringify(fact.result)!==JSON.stringify(expectedBoundary)||fact.result.events.length||fact.result.initiativeEntries.length||JSON.stringify(fact.result.characters)!==JSON.stringify(store.characters)||JSON.stringify({...fact.result.map,dnd5eActivityTurnClock:store.map.dnd5eActivityTurnClock})!==JSON.stringify({...store.map,dnd5eActivityTurnClock:store.map.dnd5eActivityTurnClock}))throw Error('bountiful-death-local:additional-boundary-provenance-required')
   const world=cloneDnd5eHostTransactionInput({map:fact.result.map,characters:fact.result.characters}),nextProjection={...JSON.parse(expected),...world};apply(world);if(JSON.stringify(input.readAnchors())!==anchors||JSON.stringify(input.readProjection())!==JSON.stringify(nextProjection))throw Error('bountiful-death-local:unexpected-boundary-projection');expected=JSON.stringify(nextProjection);deathDeferredBoundaries.set(binding.resolved,world)
  },
  /** The exact still-current private deferred Native supplies its begin input.
   * This mechanical count is not a dice, choice or publication grant. */
  deferredBeginTurnEconomy(){
   const binding=bindings.get(input.action);if(!deferredStaged||!binding||binding.resolved!==material||!current()||!actual(binding)||!deathDeferredBoundaries.has(binding.resolved))throw Error('bountiful-death-local:actual-staged-begin-economy-required')
   const state=deathActiveAreaBoundaries.get(binding.resolved)?.state??deathLocalResults.get(binding.resolved)!.native.result.state,actorId=state.initiativeOrder[state.initiativeIndex],actor=state.combatants[actorId];if(!actor)throw Error('bountiful-death-local:actual-next-actor-required')
   return projectDnd5eHeadlessTurnEconomy(createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(state,actorId),actor.speed),actor.turn,actor.speed)
  },
  async completeDeferredBegin(native:object,base:Awaited<ReturnType<typeof import('../../pages/maps/settleDnd5eCombatResult').settleDnd5eConcentrationChecks>>,apply:(application:Dnd5eMapResultPlan,combat:DeathLocalCombat)=>void){
   const binding=bindings.get(input.action);if(!deferredStaged||!projected||!binding||binding.resolved!==material||!current()||!actual(binding))throw Error('bountiful-death-local:actual-staged-deferred-native-required')
   const facts=readBountifulDeathActualDeferredBegin(input.action,native),{readDnd5eCompletedCombatBase}=await import('../../pages/maps/settleDnd5eCombatResult');readDnd5eCompletedCombatBase(native,base);if(!current()||!safeDeathNativeData(base)||!base.result.ok)throw Error('bountiful-death-local:actual-current-begin-Base-required')
   // The Base reader is bound to its actual result object. Mechanical readers
   // above return detached facts and cannot issue this continuation by JSON.
   const prior=binding.resolved,record=deathLocalResults.get(prior)!,original=deathLocalOriginals.get(prior)!,state=base.result.state,events=[...record.native.result.events,...(deathActiveAreaBoundaries.get(prior)?.events??[]),...base.result.events],result={...base.result,events},application=planDnd5eMapResultApplication({state,map:original.map,characters:original.characters,characterIdByCombatantId:binding.characterIdByCombatantId,events}),combined={...prior,result,application},nextId=state.initiativeOrder[state.initiativeIndex]
   if(state.combatId!==facts.result.state.combatId||state.round!==facts.result.state.round||state.initiativeIndex!==facts.result.state.initiativeIndex||JSON.stringify(state.initiativeOrder)!==JSON.stringify(facts.result.state.initiativeOrder)||state.combatants[nextId]?.classState.turnStartResolvedTurnKey!==dnd5eHeadlessTurnKey(state,nextId))throw Error('bountiful-death-local:actual-completed-begin-Base-required')
   if(deathActiveAreaBoundaries.has(prior)){const boundary=deathDeferredBoundaries.get(prior);if(!boundary)throw Error('bountiful-death-area:actual-settled-map-required');application.map={...cloneDnd5eHostTransactionInput(boundary.map),tokens:application.map.tokens}}
   const completedStore=projectDnd5eCombatApplicationStoreState({map:original.map,characters:original.characters,application}),beginWorld=deathDeferredBoundaries.get(prior)??projectDnd5eCombatApplicationStoreState({map:original.map,characters:original.characters,application:record.native.application!}),baseStore=projectDnd5eCombatApplicationStoreState({map:beginWorld.map,characters:beginWorld.characters,application:base.application})
   if(base.application.geometry||JSON.stringify({...completedStore.map,dnd5eActivityTurnClock:beginWorld.map.dnd5eActivityTurnClock})!==JSON.stringify(baseStore.map)||JSON.stringify(completedStore.characters)!==JSON.stringify(baseStore.characters))throw Error('bountiful-death-local:additional-Base-world-provenance-required')
   application.map={...application.map,dnd5eActivityTurnClock:beginWorld.map.dnd5eActivityTurnClock}
   const economies=Object.fromEntries(Object.entries(state.combatants).map(([id,a])=>[id,projectDnd5eHeadlessTurnEconomy(id===nextId?createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(state,id),a.speed):(initial.combat.dnd5eTurnEconomyByToken?.[id]??createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(state,id),a.speed)),a.turn,a.speed)])),refreshedReactions=Object.values(state.combatants).filter(actor=>{let spent=-1,started=-1;events.forEach((event,index)=>{if(event.type==='turn-resource-spent'&&event.actorId===actor.id&&event.resource==='reaction')spent=index;if(event.type==='turn-started'&&event.actorId===actor.id)started=index});return actor.turn.reactionAvailable&&spent>=0&&started>spent}).map(actor=>actor.id)
   binding.deathTurnCompletion={signature:JSON.stringify(encodeSecondChanceParentWire(combined)),round:state.round,initiativeIndex:state.initiativeIndex,initiativeOrder:projectHeadlessInitiativeOrder({current:initial.combat.initiativeOrder,state}),economies,refreshedReactions};binding.resolved=combined;deathLocalResults.set(combined,{signature:JSON.stringify(encodeSecondChanceParentWire(combined)),native:cloneDnd5eHostTransactionInput(combined)});deathLocalOriginals.set(combined,original);deathLocalOriginalCombats.set(combined,deathLocalOriginalCombats.get(prior)!);deathDeferredBeginSources.delete(prior);applyProjection(binding,apply);deferredStaged=false;return combined
  }
 }
 deathLocalPublications.set(capability,()=>{requireNative(true);return{action:structuredClone(input.action),beforeCharacters:cloneDnd5eHostTransactionInput(initial.characters)}});return capability
}
/** Mechanical reader for the genuine deferred death and actual existing begin.
 * This does not advance stores, update the private ACK binding, or authorize publication.
 * Dice-bearing/area continuations remain closed until their own provenance is composed. */
export function readBountifulDeathActualDeferredBegin(action:SharedPlayerActionState,actualBegin:object){
 const binding=bindings.get(action),record=binding?deathLocalResults.get(binding.resolved):undefined,original=binding?deathLocalOriginals.get(binding.resolved):undefined,pending=binding?deathDeferredBeginSources.get(binding.resolved):undefined
 if(!binding||binding.action!==action||binding.receipts[0]?.originalAdapterId!=='death-save'||!record||!original||!pending||!binding.authorityUnchanged()||!safeDeathNativeData(binding.resolved)||record.signature!==JSON.stringify(encodeSecondChanceParentWire(binding.resolved)))throw Error('bountiful-death-begin:actual-current-deferred-native-required')
 const native=record.native;if(!native.result.ok||!native.application)throw Error('bountiful-death-begin:actual-native-application-required')
 const proof=readDnd5eActualBeginTurnResult(actualBegin),state=deathActiveAreaBoundaries.get(binding.resolved)?.state??native.result.state,actorId=state.initiativeOrder[state.initiativeIndex],actor=state.combatants[actorId],store=deathDeferredBoundaries.get(binding.resolved)??projectDnd5eCombatApplicationStoreState({map:original.map,characters:original.characters,application:native.application}),order=projectHeadlessInitiativeOrder({current:action.combatId?binding.sourceState.initiativeOrder.map((id,index)=>({tokenId:id,slotId:binding.sourceState.initiativeSlotIds?.[index]??id,label:binding.sourceState.combatants[id]?.name??id,roll:0,color:'',emoji:''})):[],state})
 if(!actor||pending.clock!==pending.readClock()||proof.input.worldMinute!==pending.clock||proof.input.combatId!==state.combatId||proof.input.round!==state.round||proof.input.initiativeIndex!==state.initiativeIndex||JSON.stringify(proof.input.map)!==JSON.stringify(store.map)||JSON.stringify(proof.input.characters)!==JSON.stringify(store.characters)||JSON.stringify(proof.input.initiativeOrder.map(row=>[row.tokenId,row.slotId]))!==JSON.stringify(order.map(row=>[row.tokenId,row.slotId])))throw Error('bountiful-death-begin:exact-native-projection-required')
 const expectedEconomy=projectDnd5eHeadlessTurnEconomy(createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(state,actorId),actor.speed),actor.turn,actor.speed)
 if(JSON.stringify(proof.input.turnEconomy)!==JSON.stringify(expectedEconomy))throw Error('bountiful-death-begin:exact-native-economy-required')
 const expected=prepareDnd5eBeginTurn({...proof.input,map:store.map,characters:store.characters,turnEconomy:expectedEconomy})
 if(!expected.ok||expected.prepared.alreadyResolved||expected.prepared.turnStartActiveEffectSavingThrows.length||expected.prepared.turnStartActiveEffectPeriodicDamage.length||expected.prepared.turnStartGazeRequirements.length||expected.prepared.monsterRechargeRolls.length||expected.prepared.monsterMechanicRolls.length||!deathAreaBoundaryInactive(binding,store.map,store.characters))throw Error('bountiful-death-begin:additional-continuation-provenance-required')
 for(const key of ['savingThrowCounterattacks','turnStartActiveEffectSavingThrows','turnStartActiveEffectPeriodicDamageRolls','turnStartGazeResolutions','monsterRechargeRolls','monsterMechanicRolls','optionalBonusDice']as const)if((proof.input[key]?.length??0)>0)throw Error('bountiful-death-begin:unexpected-additional-dice')
 if(proof.input.airborneFallDamageRollsByCombatantId&&Object.keys(proof.input.airborneFallDamageRollsByCombatantId).length)throw Error('bountiful-death-begin:unexpected-additional-dice')
 if(!proof.result.ok||!proof.result.events.some(event=>event.type==='turn-started'&&event.actorId===actorId&&event.round===state.round)||proof.result.state.combatants[actorId]?.classState.turnStartResolvedTurnKey!==dnd5eHeadlessTurnKey(state,actorId))throw Error('bountiful-death-begin:actual-completed-begin-required')
 return cloneDnd5eHostTransactionInput({input:proof.input,result:proof.result,signature:proof.signature,originalResultSignature:record.signature})
}

export function readBountifulDeathLocalPublication(capability:object){const read=deathLocalPublications.get(capability);if(!read)throw Error('bountiful-death-local:actual-publication-required');return read()}

const activityOriginalResults=new WeakMap<SharedPlayerActionState,{source:Parameters<typeof completeBountifulActivityOriginal>[0]['source'];resultSignature:string;continuation?:BountifulActivityOriginalContinuation}>()
const casterTargetOriginalResults=new WeakMap<SharedPlayerActionState,{source:Parameters<typeof completeSpellcastingTargetOriginal>[0]['source'];resultSignature:string;continuation:SpellcastingTargetOriginalContinuation}>()
const pluginSpellAbilityOriginalResults=new WeakMap<SharedPlayerActionState,{source:Parameters<typeof completeBountifulPluginSpellAbilityOriginal>[0]['source'];resultSignature:string;continuation?:BountifulPluginSpellAbilityOriginalContinuation}>()
const activityLocalPublications=new WeakMap<object,()=>{action:SharedPlayerActionState;beforeCharacters:readonly Character[]}>()
const spellLocalResults=new WeakMap<object,string>()
const spellLocalOriginals=new WeakMap<object,{map:BattleMap;characters:readonly Character[]}>()
const spellLocalPublications=new WeakMap<object,()=>{action:SharedPlayerActionState;beforeCharacters:readonly Character[]}>()
const equipmentLocalResults=new WeakMap<object,string>()
const equipmentLocalOriginals=new WeakMap<object,{map:BattleMap;characters:readonly Character[]}>()
const equipmentLocalPublications=new WeakMap<object,()=>{action:SharedPlayerActionState;beforeCharacters:readonly Character[]}>()
const revision=(value:Revisioned<object>|null)=>value?._sync?.revision??0
const host=()=>{const value=getRoomSession();if(!value||value.role!=='dm')throw Error('bountiful-ack:host-required');return value}
const rowsFor=(combat:Combat,parentId:string)=>Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
const readyRowsFor=(combat:Combat,parentId:string)=>Object.values(combat.bountifulReadyParents??{}).filter(row=>row.parentId===parentId).sort((a,b)=>(a.request.ordinal??-1)-(b.request.ordinal??-1))

/** Only the already signed same-action equipment result may advance the local
 * presentation stores. Durable source, scene, queue and CAS guards remain in
 * the normal publisher. The independent anchors are never advanced. */
export function createBountifulEquipmentLocalAuthority(input:{action:SharedPlayerActionState;readProjection:()=>{map:BattleMap;characters:readonly Character[];reactionEconomies:Readonly<Record<string,number>>};readAnchors:()=>unknown}){
 const session=host(),initial=cloneDnd5eHostTransactionInput(input.readProjection()),anchors=JSON.stringify(input.readAnchors())
 let expected=JSON.stringify(initial),projected=false,material:ParentResult|undefined
 const current=()=>{const now=getRoomSession();return now?.role==='dm'&&now.roomId===session.roomId&&now.memberId===session.memberId&&JSON.stringify(input.readAnchors())===anchors&&JSON.stringify(input.readProjection())===expected&&(!material||bindings.get(input.action)?.resolved===material&&equipmentLocalResults.get(material)===JSON.stringify(material))}
 const requireNative=()=>{const binding=bindings.get(input.action)
  if(projected||!binding||binding.action!==input.action||binding.authorityUnchanged!==current||!current()||binding.receipts[0]?.originalAdapterId!=='equipment'||!binding.resolved.result.ok||!binding.resolved.application||equipmentLocalResults.get(binding.resolved)!==JSON.stringify(binding.resolved))throw Error('bountiful-equipment-local:actual-current-native-result-required')
  const original=equipmentLocalOriginals.get(binding.resolved)
  if(!original||JSON.stringify(initial.map)!==JSON.stringify(original.map)||JSON.stringify(initial.characters)!==JSON.stringify(original.characters))throw Error('bountiful-equipment-local:actual-original-projection-required')
  return binding}
 const capability={authorityUnchanged:current,applyNative(apply:(application:Dnd5eMapResultPlan,reactionEconomies:Readonly<Record<string,number>>)=>void){
  const binding=requireNative()
  const actualApplication=binding.resolved.application
  if(!actualApplication)throw Error('bountiful-equipment-local:actual-application-required')
  const application=cloneDnd5eHostTransactionInput(actualApplication),store=projectDnd5eCombatApplicationStoreState({map:initial.map,characters:initial.characters,application}),reactions={...initial.reactionEconomies}
  for(const[id,before]of Object.entries(binding.sourceState.combatants)){const after=binding.resolved.result.state.combatants[id];if(after&&before.turn.reactionAvailable!==after.turn.reactionAvailable){if(after.turn.reactionAvailable)throw Error('bountiful-equipment-local:unsupported-reaction-restoration');reactions[id]=0}}
  const next=JSON.stringify({map:store.map,characters:store.characters,reactionEconomies:reactions})
  apply(application,reactions)
  if(JSON.stringify(input.readAnchors())!==anchors||JSON.stringify(input.readProjection())!==next)throw Error('bountiful-equipment-local:unexpected-projection')
  expected=next;material=binding.resolved;projected=true
 }}
 equipmentLocalPublications.set(capability,()=>{requireNative();return{action:structuredClone(input.action),beforeCharacters:cloneDnd5eHostTransactionInput(initial.characters)}})
 return capability
}
export function readBountifulEquipmentLocalPublication(capability:object){const read=equipmentLocalPublications.get(capability);if(!read)throw Error('bountiful-equipment-local:actual-publication-scope-required');return read()}


/** Local projection of this genuine completed Activity only. Initial worker
 * observations, Spell/equipment brands and caller JSON cannot issue this scope. */
export function createBountifulActivityLocalAuthority(input:{action:SharedPlayerActionState;readProjection:()=>{map:BattleMap;characters:readonly Character[];reactionEconomies:Readonly<Record<string,number>>};readAnchors:()=>unknown}){
 const session=host(),initial=cloneDnd5eHostTransactionInput(input.readProjection()),anchors=JSON.stringify(input.readAnchors())
 let expected=JSON.stringify(initial),projected=false,material:ParentResult|undefined
 const actual=()=>{const binding=bindings.get(input.action),original=activityOriginalResults.get(input.action);if(!binding||!original||binding.action!==input.action||binding.receipts[0]?.originalAdapterId!=='plugin-feature'||original.resultSignature!==JSON.stringify(encodeSecondChanceParentWire(binding.resolved)))return false;try{readBountifulActivityCompletedOriginal(binding.resolved,original.source);return true}catch{return false}}
 const current=()=>{const now=getRoomSession();return now?.role==='dm'&&now.roomId===session.roomId&&now.memberId===session.memberId&&JSON.stringify(input.readAnchors())===anchors&&JSON.stringify(input.readProjection())===expected&&(!material||bindings.get(input.action)?.resolved===material&&actual())}
 const requireNative=()=>{const binding=bindings.get(input.action),original=activityOriginalResults.get(input.action);if(projected||!binding||!original||binding.authorityUnchanged!==current||!current()||!actual()||!binding.resolved.result.ok||!binding.resolved.application)throw Error('bountiful-activity-local:actual-current-completed-result-required');if(JSON.stringify(initial.map)!==JSON.stringify(original.source.prepared.map)||JSON.stringify(initial.characters)!==JSON.stringify(original.source.prepared.characters))throw Error('bountiful-activity-local:actual-original-projection-required');return binding}
 const capability={authorityUnchanged:current,applyNative(apply:(application:Dnd5eMapResultPlan,reactionEconomies:Readonly<Record<string,number>>)=>void){const binding=requireNative(),application=cloneDnd5eHostTransactionInput(binding.resolved.application!);const store=projectDnd5eCombatApplicationStoreState({map:initial.map,characters:initial.characters,application}),reactions={...initial.reactionEconomies};for(const[id,before]of Object.entries(binding.sourceState.combatants)){const after=binding.resolved.result.state.combatants[id];if(after&&before.turn.reactionAvailable!==after.turn.reactionAvailable){if(after.turn.reactionAvailable)throw Error('bountiful-activity-local:unsupported-reaction-restoration');reactions[id]=0}}const next=JSON.stringify({map:store.map,characters:store.characters,reactionEconomies:reactions});apply(application,reactions);if(JSON.stringify(input.readAnchors())!==anchors||JSON.stringify(input.readProjection())!==next)throw Error('bountiful-activity-local:unexpected-projection');expected=next;material=binding.resolved;projected=true}}
 activityLocalPublications.set(capability,()=>{requireNative();return{action:structuredClone(input.action),beforeCharacters:cloneDnd5eHostTransactionInput(initial.characters)}});return capability
}
export function readBountifulActivityLocalPublication(capability:object){const read=activityLocalPublications.get(capability);if(!read)throw Error('bountiful-activity-local:actual-publication-scope-required');return read()}

/** Separate actual Spell result brand; equipment and caller JSON remain foreign. */
type SavingBook=Awaited<ReturnType<NonNullable<SharedRoomGatewayPort['loadBountifulPluginSpellSavingOriginalSource']>>>
const savingBookIdentity=(book:SavingBook)=>JSON.stringify(encodeSecondChanceParentWire({schemaVersion:book.schemaVersion,sourceKind:book.sourceKind,parentId:book.parentId,mapId:book.mapId,combatId:book.combatId,roomId:book.roomId,hostMemberId:book.hostMemberId,effectTimestamp:book.effectTimestamp,source:book.source,rows:book.rows,effects:book.effects,effectsAnchor:book.effectsAnchor,...(book.beforeAnchor?{beforeAnchor:book.beforeAnchor}:{})}))
const pluginSpellSavingOriginalResults=new WeakMap<SharedPlayerActionState,{resolved:ParentResult;source:Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0];sourceSignature:string;resultSignature:string;bookSignature:string;qualification:Dnd5ePluginSpellSavingOriginalQualification;effects?:BountifulPluginSpellSavingEffectsQualification}>()
export function createBountifulSpellLocalAuthority(input:{action:SharedPlayerActionState;readProjection:()=>{map:BattleMap;characters:readonly Character[];reactionEconomies:Readonly<Record<string,number>>};readAnchors:()=>unknown;nativeMovementPresentation?:true}){
 const session=host(),initial=cloneDnd5eHostTransactionInput(input.readProjection()),anchors=JSON.stringify(input.readAnchors())
 let expected=JSON.stringify(initial),projected=false,material:ParentResult|undefined
 const current=()=>{const now=getRoomSession();return now?.role==='dm'&&now.roomId===session.roomId&&now.memberId===session.memberId&&JSON.stringify(input.readAnchors())===anchors&&JSON.stringify(input.readProjection())===expected&&(!material||bindings.get(input.action)?.resolved===material&&spellLocalResults.get(material)===JSON.stringify(material))}
 const requireNative=()=>{const binding=bindings.get(input.action)
  if(projected||!binding||binding.action!==input.action||binding.authorityUnchanged!==current||!current()||(binding.receipts[0]?.originalAdapterId!=='spell'&&!(binding.receipts[0]?.originalAdapterId==='plugin-spell'&&(pluginSpellAbilityOriginalResults.has(input.action)||pluginSpellSavingOriginalResults.get(input.action)?.resolved===binding.resolved))&&compoundNoBResults.get(input.action)?.resolved!==binding.resolved&&compoundAnsweredCompletionResults.get(input.action)?.resolved!==binding.resolved)||!binding.resolved.result.ok||!binding.resolved.application||spellLocalResults.get(binding.resolved)!==JSON.stringify(binding.resolved))throw Error('bountiful-spell-local:actual-current-native-result-required')
  const original=spellLocalOriginals.get(binding.resolved)
  if(!original||JSON.stringify(initial.map)!==JSON.stringify(original.map)||JSON.stringify(initial.characters)!==JSON.stringify(original.characters))throw Error('bountiful-spell-local:actual-original-projection-required')
  return binding}
 let presentation:{result:ParentResult;issuedAt:number}|undefined
 const nativeMovementPresentationIssuedAt=()=>{const binding=requireNative();if(input.nativeMovementPresentation!==true)throw Error('bountiful-spell-local:native-movement-presentation-required');if(presentation&&presentation.result!==binding.resolved)throw Error('bountiful-spell-local:changed-native-presentation-result');if(!presentation)presentation={result:binding.resolved,issuedAt:Date.now()+100};return presentation.issuedAt}
 const capability={authorityUnchanged:current,nativeMovementPresentationIssuedAt,applyNative(apply:(application:Dnd5eMapResultPlan,reactionEconomies:Readonly<Record<string,number>>)=>void){
  const binding=requireNative()
  const actualApplication=binding.resolved.application
  if(!actualApplication)throw Error('bountiful-spell-local:actual-application-required')
  // Presentation is derived only from this issued native result and its private
  // current, privately bound presentation clock. Callers cannot submit a path, event, or timestamp.
  const nativeApplication=cloneDnd5eHostTransactionInput(actualApplication),application=input.nativeMovementPresentation===true?withForcedMovementPresentation({application:nativeApplication,beforeMap:initial.map,events:binding.resolved.result.events.filter((event)=>event.type==='moved'),transactionId:input.action.id,issuedAt:nativeMovementPresentationIssuedAt()}):nativeApplication,store=projectDnd5eCombatApplicationStoreState({map:initial.map,characters:initial.characters,application}),reactions={...initial.reactionEconomies}
  for(const[id,before]of Object.entries(binding.sourceState.combatants)){const after=binding.resolved.result.state.combatants[id];if(after&&before.turn.reactionAvailable!==after.turn.reactionAvailable){if(after.turn.reactionAvailable)throw Error('bountiful-spell-local:unsupported-reaction-restoration');reactions[id]=0}}
  const next=JSON.stringify({map:store.map,characters:store.characters,reactionEconomies:reactions})
  apply(application,reactions)
  if(JSON.stringify(input.readAnchors())!==anchors||JSON.stringify(input.readProjection())!==next)throw Error('bountiful-spell-local:unexpected-projection')
  expected=next;material=binding.resolved;projected=true
 }}
 spellLocalPublications.set(capability,()=>{requireNative();return{action:structuredClone(input.action),beforeCharacters:cloneDnd5eHostTransactionInput(initial.characters)}})
 return capability
}
export function readBountifulSpellLocalPublication(capability:object){const read=spellLocalPublications.get(capability);if(!read)throw Error('bountiful-spell-local:actual-publication-scope-required');return read()}


/** A read-only ACK plan for this exact native-result issuer. A payload marker,
 * copied action, or metadata-only parent cannot advance an ordinary scene cap.
 * The final publisher independently repeats all resource and cost validation. */
export async function prepareBountifulOriginalSceneAck(action:SharedPlayerActionState,gateway:Gateway){
 const binding=bindings.get(action)
 if(!binding)return prepareBountifulReadySceneAck(action,gateway)
 const first=binding.receipts[0]
 if(!first?.identity.sceneScope)return undefined
 const session=host()
 if(binding.action!==action||!binding.resolved.result.ok||!binding.resolved.application||!binding.authorityUnchanged())throw Error('bountiful-scene-ack:issued-native-result-required')
 const [combat,characters,maps,geometry,queue]=await Promise.all([
  gateway.loadResource<Revisioned<Combat>>('combat'),gateway.loadResource<Revisioned<object>>('characters'),gateway.loadResource<Revisioned<object>>('maps'),gateway.loadResource<Revisioned<object>>('map-geometry'),gateway.loadResource<Revisioned<{requests:unknown[]}>>('player-action-requests')])
 if(!combat||!characters||!maps||!queue||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||
  JSON.stringify(rowsFor(combat,action.id))!==JSON.stringify(binding.receipts)||binding.receipts.some(row=>row.consumed)||
  JSON.stringify(readyRowsFor(combat,action.id))!==JSON.stringify(binding.readyRecords)||binding.readyRecords.length>0&&!validateBountifulReadyParents(combat.bountifulReadyParents)||
  first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId||!bountifulOriginalScopeMatches(combat,first.identity)||
  JSON.stringify(combat.dnd5eTurnEconomyByToken??{})!==first.identity.reactionEconomySignature||JSON.stringify(first.originalRoomAction)!==JSON.stringify(action)||
  !queue.requests.some(row=>JSON.stringify(row)===JSON.stringify(action)))throw Error('bountiful-scene-ack:stale-private-parent')
 await assertBountifulOriginalSceneScope(combat,first.identity,gateway)
 const source=await readBountifulOriginalSource(first,{includeContinuation:true})
 if(JSON.stringify(source.source.prepared.state)!==JSON.stringify(binding.sourceState)||JSON.stringify(source.source.prepared.characterIdByCombatantId)!==JSON.stringify(binding.characterIdByCombatantId))throw Error('bountiful-scene-ack:changed-native-source')
 const reads:Record<string,number>={characters:revision(characters),maps:revision(maps),'map-geometry':revision(geometry),'campaign-time':first.identity.sceneScope.campaignTimeRevision}
 if(Object.entries(first.identity.revisions).some(([name,value])=>reads[name]!==value))throw Error('bountiful-scene-ack:stale-original-resources')
 const current=host()
 if(current.roomId!==session.roomId||current.memberId!==session.memberId||!binding.authorityUnchanged())throw Error('bountiful-scene-ack:stale-host')
 return {expectedRevisions:{...reads,combat:revision(combat),'player-action-requests':revision(queue)},ordinarySceneCombat:structuredClone(combat),roomId:session.roomId}
}

function assertPrivateOriginalReplacement(rows:readonly BountifulOriginalDieReceipt[],source:PreparedInput,action:SharedPlayerActionState){
 const values=source as PreparedInput&Record<string,unknown>
 for(const row of rows){
  if(row.request.actorId!==action.actorTokenId||row.request.kind==='saving-throw')continue
  const decision=decisionFromBountifulOriginalDieReceipt(row,row.request)
  if(!decision&&!row.request.nativeLucky)continue
  const key=row.request.dieIndex===0?'halflingLuckyD20':'halflingLuckyD20Second'
  if(values[key]!==undefined)throw Error('bountiful-after-dice:private-replacement-already-confirmed')
 }
}

/** The WeakMap cannot be populated by a generic success/result constructor.
 * Only invoking a whitelisted real facade over the private original parent
 * signs this exact live room-action object for the later normal ACK. */
async function resolveBountifulOriginalForNormalAckInternal<Input extends PreparedInput,Result extends ParentResult>(input:{action:SharedPlayerActionState;source:Input;resolve:(input:Input)=>Result;options:Dnd5eDamageReactionFlowOptions},gateway:Gateway&Pick<SharedRoomGatewayPort,'saveResourcesAtomically'>,privateOpportunityPrefix=false,privateDeathRepeat?:BountifulDeathRepeatContinuation,privateDeathFirstRepeat?:BountifulDeathFirstRepeatContinuation,privateSavingQualification?:Dnd5ePluginSpellSavingOriginalQualification,privateSavingEffects?:BountifulPluginSpellSavingEffectsQualification):Promise<Result>{
  const session=host(),combat=await gateway.loadResource<Revisioned<Combat>>('combat')
  const first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)]
  if(first?.originalAdapterId==='opportunity-move'&&'stage'in input.source&&input.source.stage==='opportunity')throw Error('bountiful-ack:opportunity-prefix-not-final')
  const resolver:unknown=input.resolve
  const deathClockReader=resolver===actualBountifulResolvers['death-save']?(await import('../../composition/browserSceneClock')).readBrowserSceneWorldMinute:undefined
  if(privateOpportunityPrefix&&(resolver!==resolvePreparedDnd5eOpportunityPlayerMove||first?.originalAdapterId!=='opportunity-move'))throw Error('bountiful-ack:concrete-opportunity-prefix-required')
  if(!combat||!first||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||first.consumed||
    first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId||
    JSON.stringify(input.action)!==JSON.stringify(first.originalRoomAction)||
    !Object.values(actualBountifulResolvers).some(candidate=>candidate===resolver))throw Error('bountiful-ack:real-private-parent-required')
  if(privateDeathRepeat&&(resolver!==actualBountifulResolvers['death-save']||privateOpportunityPrefix))throw Error('bountiful-death-repeat:fixed-original-resolver-required')
  if(privateDeathFirstRepeat&&(privateDeathRepeat||privateOpportunityPrefix||resolver!==actualBountifulResolvers['death-save']||!first.rawIssuer?.rollId.startsWith('bountiful-death-first-repeat-saving:')))throw Error('bountiful-death-first-repeat:fixed-private-original-required')
  const original=await readBountifulOriginalSource(first),continuation=await readBountifulAfterDiceSource(first)
  if(privateSavingQualification&&(privateOpportunityPrefix||privateDeathRepeat||privateDeathFirstRepeat||continuation||resolver!==resolvePreparedDnd5ePluginSpellCast||!first.rawIssuer?.rollId.startsWith('bountiful-plugin-spell-saving-original:')))throw Error('plugin-spell-saving-ack:fixed-private-saving-source-required')
  if(privateSavingEffects&&!privateSavingQualification)throw Error('plugin-spell-saving-ack:actual-original-qualification-required')
  const expected=privateSavingEffects?readBountifulPluginSpellSavingEffectsQualifiedSource(privateSavingEffects,privateSavingQualification!,original.source as unknown as Parameters<typeof readBountifulPluginSpellSavingEffectsQualifiedSource>[2],first):privateSavingQualification?readDnd5ePluginSpellSavingOriginalQualifiedSource(privateSavingQualification,original.source as unknown as Parameters<typeof readDnd5ePluginSpellSavingOriginalQualifiedSource>[1],first):continuation??original.source
  if(JSON.stringify(bountifulEquipmentInputWithoutTransport(first,original.source,Object.fromEntries(Object.entries(input.source))))!==JSON.stringify(expected))throw Error('bountiful-ack:changed-original-input')
  const receipts=rowsFor(combat,input.action.id)
  const readyRecords=readyRowsFor(combat,input.action.id)
  if(readyRecords.length){
    if(!validateBountifulReadyParents(combat.bountifulReadyParents)||readyRecords.some(row=>row.consumed))throw Error('bountiful-ack:invalid-ready-frames')
    for(const row of readyRecords){const frame=await readBountifulSpellOriginalReadyFrame({mapId:input.action.mapId,id:row.id},gateway);const facts=await inspectBountifulSpellOriginalReadyFrame(frame,gateway);if(JSON.stringify(facts.parent)!==JSON.stringify(input.action))throw Error('bountiful-ack:foreign-ready-frame')}
  }
  assertPrivateOriginalReplacement(receipts,input.source,input.action)
  const runtimeSource=privateDeathFirstRepeat?await readBountifulDeathFirstRepeatContinuation(privateDeathFirstRepeat,{source:input.source,receipts,action:input.action})as unknown as Input:privateDeathRepeat?await readBountifulDeathRepeatContinuation(privateDeathRepeat,{source:input.source,receipts,action:input.action})as unknown as Input:input.source
  const plainReplaySource={...runtimeSource,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source:input.source,receipts})},source=privateSavingQualification?projectDnd5ePluginSpellSavingAnsweredSessionInput(privateSavingQualification,plainReplaySource as unknown as Parameters<typeof projectDnd5ePluginSpellSavingAnsweredSessionInput>[1])as unknown as typeof plainReplaySource:plainReplaySource
  if(privateOpportunityPrefix)Object.assign(source,{stage:'opportunity' as const})
  let journalReceipts=structuredClone(receipts)
  const options={...input.options,chooseAfterOriginalFall:input.options.chooseAfterOriginalFall?async (pending:Parameters<NonNullable<Dnd5eDamageReactionFlowOptions['chooseAfterOriginalFall']>>[0])=>{
    const choice=await input.options.chooseAfterOriginalFall!(pending)
    if(choice===undefined)return undefined
    const updated=await recordBountifulOriginalFall({action:input.action,source:input.source,resolve:input.resolve,occurrence:pending.occurrence,request:pending.request,choice,authorityUnchanged:input.options.authorityUnchanged},gateway)
    journalReceipts=journalReceipts.map(row=>row.identity.occurrence===0?updated:row)
    return choice
  }:undefined}
  const qualifiedSavingResolve=privateSavingQualification?readDnd5ePluginSpellSavingQualifiedResolver(privateSavingQualification)as unknown as typeof input.resolve:input.resolve
  const savingBefore=privateSavingQualification?readDnd5ePluginSpellSavingBeforeQualification(privateSavingQualification):undefined
  const resolved=savingBefore?await resolveDnd5ePreparedWithMaterialDamageReactions({...options,enablePluginTempestuousFlight:true,pluginTempestuousEarlyBefore:readBountifulPluginSpellSavingBefore(savingBefore).mechanical,pluginTempestuousOriginalReplay:source.hostOriginalD20Replay},projectBountifulPluginSpellSavingBeforeSource(savingBefore,(({hostOriginalD20Replay:_replay,...plain})=>plain)(source)as unknown as Parameters<typeof projectBountifulPluginSpellSavingBeforeSource>[1])as unknown as Input,qualifiedSavingResolve):await resolveDnd5ePreparedWithMaterialDamageReactions(options,source,qualifiedSavingResolve)
  if(!resolved.result.ok||!resolved.application)throw Error('bountiful-ack:real-parent-not-resolved:'+(resolved.result.ok?'missing-application':resolved.result.reason))
  markBountifulOriginalSceneReactions({sceneScope:first.identity.sceneScope,roomId:session.roomId,parentId:input.action.id,characterIdByCombatantId:input.source.prepared.characterIdByCombatantId,result:resolved.result,application:resolved.application})
  const deathTurnCompletion=actualDeathTurnCompletion(input.source,resolver,resolved,combat)
  bindings.set(input.action,{...(deathTurnCompletion?{deathTurnCompletion}:{}),action:input.action,sourceState:input.source.prepared.state,characterIdByCombatantId:input.source.prepared.characterIdByCombatantId,receipts:structuredClone(journalReceipts),readyRecords:structuredClone(readyRecords),resolved,authorityUnchanged:input.options.authorityUnchanged,...(privateOpportunityPrefix?{opportunityContinuationPending:true as const}:{})})
  if(journalReceipts[0]?.originalAdapterId==='death-save')deathAreaBindingGateways.set(bindings.get(input.action)!,gateway)
  if(resolver===actualBountifulResolvers['death-save']){if(!safeDeathNativeData(resolved))throw Error('bountiful-death-local:plain-native-result-required');deathLocalResults.set(resolved,{signature:JSON.stringify(encodeSecondChanceParentWire(resolved)),native:cloneDnd5eHostTransactionInput(resolved)});deathLocalOriginals.set(resolved,{map:cloneDnd5eHostTransactionInput(input.source.prepared.map),characters:cloneDnd5eHostTransactionInput(input.source.prepared.characters)});deathLocalOriginalCombats.set(resolved,cloneDnd5eHostTransactionInput({active:combat.active,mapId:combat.mapId,combatId:combat.combatId,round:combat.round,initiativeIndex:combat.initiativeIndex,initiativeOrder:combat.initiativeOrder,dnd5eTurnEconomyByToken:combat.dnd5eTurnEconomyByToken}));if((input.source as PreparedInput&{command?:{deferNextTurnStart?:boolean}}).command?.deferNextTurnStart===true&&(resolved.result.state.round!==input.source.prepared.state.round||resolved.result.state.initiativeIndex!==input.source.prepared.state.initiativeIndex))deathDeferredBeginSources.set(resolved,{clock:deathClockReader!(),readClock:deathClockReader!})}
  if(resolver===actualBountifulResolvers.equipment){equipmentLocalResults.set(resolved,JSON.stringify(resolved));equipmentLocalOriginals.set(resolved,{map:cloneDnd5eHostTransactionInput(input.source.prepared.map),characters:cloneDnd5eHostTransactionInput(input.source.prepared.characters)})}
  if(resolver===actualBountifulResolvers.spell){spellLocalResults.set(resolved,JSON.stringify(resolved));spellLocalOriginals.set(resolved,{map:cloneDnd5eHostTransactionInput(input.source.prepared.map),characters:cloneDnd5eHostTransactionInput(input.source.prepared.characters)})}
  return resolved
}
export async function resolveBountifulOriginalForNormalAck<Input extends PreparedInput,Result extends ParentResult>(input:{action:SharedPlayerActionState;source:Input;resolve:(input:Input)=>Result;options:Dnd5eDamageReactionFlowOptions},gateway:Gateway&Pick<SharedRoomGatewayPort,'saveResourcesAtomically'>):Promise<Result>{
 return resolveBountifulOriginalForNormalAckInternal(input,gateway)
}

/** The original source guard above remains unchanged. Only this real same-parent private completion adds its independently adopted end-save input for the fixed death facade. */
export async function resolveBountifulDeathRepeatForNormalAck<Input extends PreparedInput,Result extends ParentResult>(input:{action:SharedPlayerActionState;source:Input;resolve:(input:Input)=>Result;options:Dnd5eDamageReactionFlowOptions;deathRepeatContinuation:BountifulDeathRepeatContinuation},gateway:Gateway&Pick<SharedRoomGatewayPort,'saveResourcesAtomically'>):Promise<Result>{
 if(!input.deathRepeatContinuation)throw Error('bountiful-death-repeat:actual-private-continuation-required')
 return resolveBountifulOriginalForNormalAckInternal(input,gateway,false,input.deathRepeatContinuation)
}
/** This concrete continuation alone may replace the private pending OA result:
 * a genuine Base completion, followed by the real movement facade on that exact
 * state. No externally supplied prepared state/result enters the binding. */
export async function resolveBountifulOpportunityAfterPostNativeForNormalAck(input:{action:SharedPlayerActionState;source:Parameters<typeof resolvePreparedDnd5eOpportunityPlayerMove>[0];postNative:Parameters<typeof readBountifulOpportunityPostNativePrefix>[1];options:Dnd5eDamageReactionFlowOptions},gateway:Gateway&Pick<SharedRoomGatewayPort,'saveResourcesAtomically'>):Promise<ReturnType<typeof resolvePreparedDnd5eOpportunityPlayerMove>>{
 if(input.source.stage==='opportunity')throw Error('bountiful-opportunity-post-native:movement-input-not-recorded')
 const post=readBountifulOpportunityPostNativePrefix(input.action,input.postNative)
 try{
  const prefix=await resolveBountifulOriginalForNormalAckInternal({...input,resolve:resolvePreparedDnd5eOpportunityPlayerMove},gateway,true)
  if(!sameActivityParentData(prefix.result,post.opportunityPrefix.result)||!sameActivityParentData(prefix.application,post.opportunityPrefix.application)||!input.options.authorityUnchanged())throw Error('bountiful-opportunity-post-native:changed-original-prefix')
  const before=post.settlement,actor=before.result.state.combatants[input.action.actorTokenId]
  if(!actor||actor.currentHp<=0)throw Error('bountiful-opportunity-post-native:interrupted-movement-required')
  const parent=input.source.prepared,prepared=prepareDnd5ePlayerMove({action:input.action,map:before.application.map,characters:before.application.characters,initiativeOrder:parent.initiativeOrder,turnEconomy:projectDnd5eHeadlessTurnEconomy(parent.moverEconomy,actor.turn,actor.speed)})
  if(!prepared.ok)throw Error('bountiful-opportunity-post-native:movement-preparation:'+prepared.reason)
  const moved=await resolveDnd5ePreparedWithMaterialDamageReactions(input.options,{...input.source.movement,prepared:{...prepared.prepared,state:cloneDnd5eHostTransactionInput(before.result.state)},transactionId:'player-move:'+input.action.id},resolvePreparedDnd5ePlayerMove)
  if(!moved.result.ok||!moved.application)throw Error('bountiful-opportunity-post-native:movement-resolution-required')
  const result={...moved.result,events:[...before.result.events,...moved.result.events]},application=planDnd5eMapResultApplication({state:result.state,map:parent.map,characters:parent.characters,characterIdByCombatantId:parent.characterIdByCombatantId,events:[...result.events]}),completed={result,application,movementPrepared:moved.prepared??prepared.prepared},binding=bindings.get(input.action)
  if(!binding||!input.options.authorityUnchanged())throw Error('bountiful-opportunity-post-native:original-binding-required')
  binding.resolved=completed
  delete binding.opportunityContinuationPending
  return completed
 }catch(error){bindings.delete(input.action);throw error}
}

/** Uses the ordinary ACK's one transaction, after all existing Maps inventory,
 * movement, teleport and other postprocessing has produced its final snapshots.
 * It performs no preliminary characters/maps/cost write. */
export async function publishBountifulOriginalThroughNormalAck(action:SharedPlayerActionState,input:PublishPlayerActionAckInput,gateway:Gateway):Promise<void>{
  if(compoundNoBResults.has(action))return publishCompoundNoBThroughNormalAck(action,input,gateway)
  if(activityOriginalResults.has(action)||pluginSpellAbilityOriginalResults.has(action)||casterTargetOriginalResults.has(action)||compoundAnsweredCompletionResults.has(action))input={...input,ack:structuredClone(input.ack),snapshots:input.snapshots?structuredClone(input.snapshots):undefined,processed:input.processed?structuredClone(input.processed):undefined}
  let activityReadRevisions:Readonly<Record<string,number>>|undefined
  let deathAreaReadRevisions:Readonly<Record<string,number>>|undefined
  const binding=bindings.get(action),session=host(),snapshots=input.snapshots
  const deathRecord=binding?deathLocalResults.get(binding.resolved):undefined,protectedResolved=deathRecord?.native??binding?.resolved
  const answeredCompletion=compoundAnsweredCompletionResults.get(action)
  if(answeredCompletion){
   if(!binding||binding.resolved!==answeredCompletion.resolved||!binding.authorityUnchanged()||compoundAnsweredCompletionSignature(binding.resolved)!==answeredCompletion.resultSignature||!snapshots?.combat||!binding.resolved.result.ok||!binding.resolved.application)throw Error('ice-knife-answered-completion:actual-current-result-required')
   const current=await currentCompoundAnsweredCompletion(answeredCompletion.operation,gateway),source=current.facts.source
   if(compoundAnsweredCompletionSignature(source)!==answeredCompletion.sourceSignature||compoundAnsweredCompletionSignature(current.book)!==answeredCompletion.bookSignature||compoundAnsweredCompletionSignature(binding.receipts)!==compoundAnsweredCompletionSignature(current.witnessed.receipts)||compoundAnsweredCompletionSignature(binding.resolved)!==answeredCompletion.resultSignature)throw Error('ice-knife-answered-completion:changed-private-source-or-prefix')
   const store=projectDnd5eCombatApplicationStoreState({map:source.prepared.map,characters:source.prepared.characters,application:binding.resolved.application}),maps=(current.documents.maps.maps as BattleMap[]).map(map=>map.id===action.mapId?store.map:map)
   if(compoundAnsweredCompletionSignature(snapshots.characters)!==compoundAnsweredCompletionSignature(store.characters)||compoundAnsweredCompletionSignature(snapshots.maps)!==compoundAnsweredCompletionSignature(maps))throw Error('ice-knife-answered-completion:changed-native-world')
   const before=current.documents.combat,economies={...before.dnd5eTurnEconomyByToken,...Object.fromEntries(Object.entries(binding.resolved.result.state.combatants).map(([id,actor])=>[id,projectDnd5eHeadlessTurnEconomy(before.dnd5eTurnEconomyByToken[id],actor.turn,actor.speed)]))},omit=(value:object)=>Object.fromEntries(Object.entries(value).filter(([key])=>!['_sync','updatedAt','dnd5eTurnEconomyByToken'].includes(key)))
   if(compoundAnsweredCompletionSignature(omit(snapshots.combat))!==compoundAnsweredCompletionSignature(omit(before))||compoundAnsweredCompletionSignature(snapshots.combat.dnd5eTurnEconomyByToken)!==compoundAnsweredCompletionSignature(economies))throw Error('ice-knife-answered-completion:changed-native-combat-or-cost')
   activityReadRevisions={...current.reads}
  }
  if(deathRecord&&(!safeDeathNativeData(binding!.resolved)||deathRecord.signature!==JSON.stringify(encodeSecondChanceParentWire(binding!.resolved))))throw Error('bountiful-death-tail:changed-issued-native-result')
  const areaBook=binding&&deathAreaPublicationBooks.get(binding);if(areaBook){const originalGateway=deathAreaBindingGateways.get(binding!);if(!originalGateway?.loadBountifulDeathAreaOriginalSource)throw Error('bountiful-death-area:actual-publication-book-loader-required');const book=await originalGateway.loadBountifulDeathAreaOriginalSource({parentId:action.id,mapId:action.mapId,combatId:action.combatId!});if(JSON.stringify(book)!==JSON.stringify(areaBook)||!binding?.deathTurnCompletion)throw Error('bountiful-death-area:changed-current-publication-book');deathAreaReadRevisions={...book.revisions}}
  const activityOriginal=activityOriginalResults.get(action);if(activityOriginal){if(!binding||!protectedResolved)throw Error('activity-completion:actual-completed-facade-required');readBountifulActivityCompletedOriginal(protectedResolved,activityOriginal.source);if(activityOriginal.continuation){if(!gateway.loadBountifulActivityOriginalSource)throw Error('activity-continuation:private-book-loader-required');activityReadRevisions=(await assertBountifulActivityOriginalContinuationCurrent(activityOriginal.continuation,gateway as BountifulActivityOriginalContinuationGateway,activityOriginal.source,protectedResolved)).readRevisions}if(!binding||JSON.stringify(encodeSecondChanceParentWire(protectedResolved))!==activityOriginal.resultSignature)throw Error('activity-completion:changed-actual-native-result')}
  const pluginSpellAbilityOriginal=pluginSpellAbilityOriginalResults.get(action);if(pluginSpellAbilityOriginal){if(!binding)throw Error('plugin-spell-ability-completion:actual-completed-facade-required');readBountifulPluginSpellAbilityCompletedOriginal(binding.resolved,pluginSpellAbilityOriginal.source);if(pluginSpellAbilityOriginal.continuation){if(!gateway.loadBountifulPluginSpellAbilityOriginalSource)throw Error('plugin-spell-ability-continuation:private-book-loader-required');activityReadRevisions=(await assertBountifulPluginSpellAbilityOriginalContinuationCurrent(pluginSpellAbilityOriginal.continuation,gateway as BountifulPluginSpellAbilityOriginalContinuationGateway,pluginSpellAbilityOriginal.source,binding.resolved)).readRevisions}if(!binding||JSON.stringify(encodeSecondChanceParentWire(binding.resolved))!==pluginSpellAbilityOriginal.resultSignature)throw Error('plugin-spell-ability-completion:changed-actual-native-result')}
  const savingOriginal=pluginSpellSavingOriginalResults.get(action)
  if(savingOriginal){
    const validateSavingFinal=()=>{if(!binding||binding.resolved!==savingOriginal.resolved||JSON.stringify(encodeSecondChanceParentWire(binding.resolved))!==savingOriginal.resultSignature||JSON.stringify(encodeSecondChanceParentWire(savingOriginal.source))!==savingOriginal.sourceSignature)throw Error('plugin-spell-saving-ack:changed-actual-final-source-or-result')}
    validateSavingFinal();if(!gateway.loadBountifulPluginSpellSavingOriginalSource)throw Error('plugin-spell-saving-ack:private-book-loader-required')
    const book=await gateway.loadBountifulPluginSpellSavingOriginalSource({parentId:action.id,mapId:action.mapId,combatId:savingOriginal.source.prepared.state.combatId});validateSavingFinal()
    if(book.effects?.length&&!savingOriginal.effects)throw Error('plugin-spell-saving-ack:actual-effect-qualification-required')
    if(savingOriginal.effects)await assertBountifulPluginSpellSavingEffectsQualificationCurrent(savingOriginal.effects,savingOriginal.qualification,{loadResource:gateway.loadResource.bind(gateway),loadBountifulPluginSpellSavingOriginalSource:gateway.loadBountifulPluginSpellSavingOriginalSource.bind(gateway)},savingOriginal.source)
    validateSavingFinal()
    if(savingBookIdentity(book)!==savingOriginal.bookSignature||!book.scope?.versions||['characters','maps','combat','map-geometry','campaign-time'].some(key=>!Number.isSafeInteger(book.scope.versions[key as keyof typeof book.scope.versions])||book.scope.versions[key as keyof typeof book.scope.versions]<0))throw Error('plugin-spell-saving-ack:changed-current-private-book')
    activityReadRevisions={...activityReadRevisions,...book.scope.versions}
  }
  const casterTargetOriginal=casterTargetOriginalResults.get(action);if(casterTargetOriginal){if(!binding)throw Error('caster-target-ack:actual-completed-facade-required');readSpellcastingTargetCompletedOriginal(binding.resolved,casterTargetOriginal.source);await assertSpellcastingTargetCompletedOriginalCurrent(binding.resolved,casterTargetOriginal.source);if(JSON.stringify(encodeSecondChanceParentWire(binding.resolved))!==casterTargetOriginal.resultSignature)throw Error('caster-target-ack:changed-actual-native-result')}
  if(binding?.opportunityContinuationPending)throw Error('bountiful-ack:opportunity-prefix-not-final')
  if(!binding||!protectedResolved){
    const [combat,ack]=await Promise.all([gateway.loadResource<Combat>('combat'),gateway.loadResource<SharedPlayerActionAckState>('player-action-ack')])
    const receipt=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(action.id,0)]
    if(receipt?.consumed&&combat&&readyRowsFor(combat,action.id).every(row=>row.consumed?.transactionId===action.id)&&receipt.identity.roomId===session.roomId&&receipt.identity.hostMemberId===session.memberId&&JSON.stringify(action)===JSON.stringify(receipt.originalRoomAction)&&validateBountifulOriginalParents(combat?.bountifulOriginalParents)&&ack?.status==='accepted'&&ack.actionId===action.id&&ack.mapId===action.mapId){
      try{await input.publishAck(ack)}catch{/* Durable ACK and consumed parent already committed. */}
      return
    }
    throw Error('bountiful-ack:issued-result-required')
  }
  if(input.ack.status!=='accepted'||input.ack.actionId!==action.id||input.ack.mapId!==action.mapId||!snapshots?.combat||!protectedResolved.result.ok||!protectedResolved.application)throw Error('bountiful-ack:issued-result-required')
  const [combat,characters,maps,geometry,queue]=await Promise.all([
    gateway.loadResource<Revisioned<Combat>>('combat'),gateway.loadResource<Revisioned<object>>('characters'),gateway.loadResource<Revisioned<object>>('maps'),gateway.loadResource<Revisioned<object>>('map-geometry'),gateway.loadResource<Revisioned<{requests:unknown[]}>>('player-action-requests'),
  ])
  const first=binding.receipts[0],current= combat?rowsFor(combat,action.id):[]
  if(!combat||!characters||!maps||!queue||!first||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||
    JSON.stringify(current)!==JSON.stringify(binding.receipts)||current.some(row=>row.consumed)||
    JSON.stringify(readyRowsFor(combat,action.id))!==JSON.stringify(binding.readyRecords)||binding.readyRecords.length>0&&!validateBountifulReadyParents(combat.bountifulReadyParents)||
    first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId||
    !bountifulOriginalScopeMatches(combat,first.identity)||
    JSON.stringify(combat.dnd5eTurnEconomyByToken??{})!==first.identity.reactionEconomySignature||
    !queue.requests.some(row=>JSON.stringify(row)===JSON.stringify(action))||!binding.authorityUnchanged())throw Error('bountiful-ack:stale-parent')
 await assertBountifulOriginalSceneScope(combat,first.identity,gateway)
  const reads:Record<string,number>={characters:revision(characters),maps:revision(maps),'map-geometry':revision(geometry),...(first.identity.sceneScope?{'campaign-time':first.identity.sceneScope.campaignTimeRevision}:{})}
  if(Object.entries(first.identity.revisions).some(([name,value])=>reads[name]!==value))throw Error('bountiful-ack:stale-original-resources')
  const deathTail=binding.deathTurnCompletion
  if(deathTail){
    if(JSON.stringify(encodeSecondChanceParentWire(protectedResolved))!==deathTail.signature)throw Error('bountiful-death-tail:changed-issued-native-result')
    const order=snapshots.combat.initiativeOrder
    if(snapshots.combat.mapId!==combat.mapId||snapshots.combat.combatId!==combat.combatId||snapshots.combat.round!==deathTail.round||snapshots.combat.initiativeIndex!==deathTail.initiativeIndex||JSON.stringify(order)!==JSON.stringify(deathTail.initiativeOrder))throw Error('bountiful-ack:changed-final-boundary')

  }else if(snapshots.combat.mapId!==combat.mapId||snapshots.combat.combatId!==combat.combatId||snapshots.combat.round!==combat.round||snapshots.combat.initiativeIndex!==combat.initiativeIndex)throw Error('bountiful-ack:changed-final-boundary')
  const deathEconomies=deathRecord?(deathTail?.economies??Object.fromEntries(Object.entries(protectedResolved.result.state.combatants).map(([id,a])=>[id,projectDnd5eHeadlessTurnEconomy(combat.dnd5eTurnEconomyByToken?.[id]??createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(protectedResolved.result.state,id),a.speed),a.turn,a.speed)]))):undefined
  if(deathRecord){const expectedWorld=deathLocalProjectedWorld.get(binding.resolved)??protectedResolved.application;if(JSON.stringify(snapshots.characters)!==JSON.stringify(expectedWorld.characters)||JSON.stringify(snapshots.maps.find(m=>m.id===action.mapId))!==JSON.stringify(expectedWorld.map))throw Error('bountiful-death-tail:changed-native-world');for(const[id,expected]of Object.entries(deathEconomies!)){const actual=snapshots.combat.dnd5eTurnEconomyByToken?.[id];if(!actual||actual.action.current!==expected.action.current||actual.bonusAction.current!==expected.bonusAction.current||actual.reaction.current!==expected.reaction.current||actual.movement.current!==expected.movement.current)throw Error('bountiful-death-tail:changed-native-economy')}}
  const economies={...(deathEconomies??snapshots.combat.dnd5eTurnEconomyByToken)}
  for(const receipt of binding.receipts){
    const decision=decisionFromBountifulOriginalDieReceipt(receipt,receipt.request)
    if(!decision||receipt.request.nativeLucky)continue
    const result=protectedResolved.result,owner=result.state.combatants[decision.ownerId]
    const event=result.events.some(row=>row.type==='ally-natural-one-rerolled'&&row.actorId===decision.ownerId&&row.targetId===receipt.request.actorId&&row.featureId===decision.featureId&&row.dieIndex===receipt.request.dieIndex&&row.replacement===decision.replacement&&JSON.stringify(row.originalValues)===JSON.stringify(receipt.request.originalRolls))
    const characterId=binding.characterIdByCombatantId[decision.ownerId]
    const character=characterId?snapshots.characters.find(row=>row.id===characterId):undefined
    const effect=!!owner&&character?.dnd5eCombatState?.activeEffects?.some(row=>row.source.actorId===owner.id&&row.source.rulesId===decision.featureId&&row.definitionId===decision.featureId+':lucky-suppressed'&&row.tags?.includes('bountiful-luck:racial-lucky-suppressed'))
    const refreshed=!!deathTail?.refreshedReactions.includes(decision.ownerId)
    if(!owner||owner.turn.reactionAvailable&&!refreshed||!event||!effect)throw Error('bountiful-ack:real-reaction-not-in-final-snapshot')
    if(first.identity.sceneScope){if(character?.dnd5eCombatState?.sceneReactionSpent?.parentTransactionId!==action.id||character.dnd5eCombatState.sceneReactionSpent.roomId!==session.roomId)throw Error('bountiful-ack:scene-reaction-not-in-final-snapshot');continue}
    const state=binding.sourceState,active=state.initiativeOrder[state.initiativeIndex]===owner.id
    const slot=active?(state.initiativeSlotIds?.[state.initiativeIndex]??owner.id):owner.id
    const economy=economies[owner.id]??createDnd5eTurnEconomyCounts(state.combatId+':'+state.round+':'+slot,owner.speed)
    economies[owner.id]=refreshed?deathTail!.economies[owner.id]:{...economy,reaction:{...economy.reaction,current:0}}
  }
  for(const fact of [...(first.postOriginalD20??[]),...binding.readyRecords.flatMap(row=>row.postReadyD20??[])]){
    const actor=protectedResolved.result.state.combatants[fact.actorId]
    const character=snapshots.characters.find(row=>row.id===fact.characterId)
    if(!actor||!character||binding.characterIdByCombatantId[fact.actorId]!==fact.characterId)throw Error('bountiful-ack:deferred-cost-not-in-final-snapshot')
    for(const cost of fact.resourceCosts){
      if(cost.resourceKey===DND5E_CORE_INSPIRATION_RESOURCE_KEY){
        if(!Number.isSafeInteger(actor.inspiration)||character.inspiration!==actor.inspiration)throw Error('bountiful-ack:deferred-cost-not-in-final-snapshot')
      }else{
        const expected=actor.classResources[cost.resourceKey],actual=character.classResources?.[cost.resourceKey]
        if(!expected||!actual||actual.current!==expected.current||actual.max!==expected.max)throw Error('bountiful-ack:deferred-cost-not-in-final-snapshot')
      }
    }
  }
  const finalMap=snapshots.maps.find(map=>map.id===action.mapId)
  if(!finalMap)throw Error('bountiful-ack:missing-final-map')
  assertBountifulEquipmentFinalCost(first.postOriginalEquipmentD20,protectedResolved.application,{characters:snapshots.characters,map:finalMap})
  const application={...protectedResolved.application,characters:snapshots.characters,map:finalMap}
  const resultWire=encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts({result:protectedResolved.result,application}))
  const parents={...combat.bountifulOriginalParents}
  for(const receipt of binding.receipts)parents[bountifulOriginalParentReceiptId(action.id,receipt.identity.occurrence)]={...receipt,consumed:{transactionId:action.id,...(receipt.identity.occurrence===0?{result:resultWire}:{})}}
  if(!validateBountifulOriginalParents(parents))throw Error('bountiful-ack:invalid-consumed-parent')
  const readyParents={...combat.bountifulReadyParents}
  for(const record of binding.readyRecords)readyParents[record.id]={...record,consumed:{transactionId:action.id}}
  if(binding.readyRecords.length&&!validateBountifulReadyParents(readyParents))throw Error('bountiful-ack:invalid-consumed-ready-frame')
  const currentHost=host()
  if(currentHost.roomId!==session.roomId||currentHost.memberId!==session.memberId||!binding.authorityUnchanged())throw Error('bountiful-ack:stale-host')
  if(activityOriginal){if(!binding||!protectedResolved)throw Error('activity-completion:actual-completed-facade-required');readBountifulActivityCompletedOriginal(protectedResolved,activityOriginal.source)}
  if(pluginSpellAbilityOriginal){readBountifulPluginSpellAbilityCompletedOriginal(binding.resolved,pluginSpellAbilityOriginal.source)}
  if(answeredCompletion&&(compoundAnsweredCompletionSignature(binding.resolved)!==answeredCompletion.resultSignature||!binding.authorityUnchanged()))throw Error('ice-knife-answered-completion:changed-final-issued-result')
  await publishPlayerActionAckWithSnapshots({...input,snapshots:{...snapshots,combat:{...combat,...snapshots.combat,dnd5eTurnEconomyByToken:economies,bountifulOriginalParents:parents,...(binding.readyRecords.length?{bountifulReadyParents:readyParents}:{})}},expectedRevisions:{...input.expectedRevisions,...activityReadRevisions,...reads,combat:revision(combat),'player-action-requests':revision(queue),...deathAreaReadRevisions,...(answeredCompletion?activityReadRevisions:{})}})
  bindings.delete(action);compoundAnsweredCompletionResults.delete(action);pluginSpellSavingOriginalResults.delete(action);activityOriginalResults.delete(action);pluginSpellAbilityOriginalResults.delete(action);casterTargetOriginalResults.delete(action)
}

/** Persists the Host-confirmed damage continuation without committing HP, costs
 * or ACK. Its only differences from the private original are concrete, late
 * damage dice; the original roller/d20 and all choice facts stay immutable. */
export async function recordBountifulOriginalAfterDice<Input extends PreparedInput,Result extends ParentResult>(input:{action:SharedPlayerActionState;source:Input;resolve:(input:Input)=>Result;authorityUnchanged:()=>boolean;rollCursor?:number},gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>){
 const session=host(),[combat,characters,maps,geometry,queue]=await Promise.all([
  gateway.loadResource<Revisioned<Combat>>('combat'),gateway.loadResource<Revisioned<object>>('characters'),gateway.loadResource<Revisioned<object>>('maps'),gateway.loadResource<Revisioned<object>>('map-geometry'),gateway.loadResource<Revisioned<{requests:unknown[]}>>('player-action-requests')])
 const first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)] as BountifulContinuationReceipt|undefined
 const rows=combat?rowsFor(combat,input.action.id):[]
 const resolverIdentity:unknown=input.resolve
 if(!combat||!characters||!maps||!queue||!first||first.consumed||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||!input.authorityUnchanged()||
 first.identity.hostMemberId!==session.memberId||first.identity.roomId!==session.roomId||!bountifulOriginalScopeMatches(combat,first.identity)||JSON.stringify(combat.dnd5eTurnEconomyByToken??{})!==first.identity.reactionEconomySignature||!queue.requests.some(row=>JSON.stringify(row)===JSON.stringify(input.action))||JSON.stringify(input.action)!==JSON.stringify(first.originalRoomAction)||!Object.values(actualBountifulResolvers).some(resolve=>resolve===resolverIdentity))throw Error('bountiful-after-dice:private-host-parent-required')
 await assertBountifulOriginalSceneScope(combat,first.identity,gateway)
 const actualReads:Record<string,number>={characters:revision(characters),maps:revision(maps),'map-geometry':revision(geometry),...(first.identity.sceneScope?{'campaign-time':first.identity.sceneScope.campaignTimeRevision}:{})}
 if(Object.entries(first.identity.revisions).some(([key,value])=>actualReads[key]!==value))throw Error('bountiful-after-dice:stale-original-resources')
 for(const receipt of rows)decisionFromBountifulOriginalDieReceipt(receipt,receipt.request)
 assertPrivateOriginalReplacement(rows,input.source,input.action)
 const original=await readBountifulOriginalSource(first,{includeContinuation:true})
 const concreteSource=bountifulEquipmentInputWithoutTransport(first,original.source,input.source as Input&Record<string,unknown>)
 try{assertBountifulAfterDiceSource(first.originalAdapterId,original.source,concreteSource)}catch(error){if(first.continuation)throw Error('bountiful-after-dice:already-confirmed');throw error}
 if(input.rollCursor!==undefined&&(!Number.isSafeInteger(input.rollCursor)||input.rollCursor<(first.continuation?.rollCursor??0)||input.rollCursor>100000))throw Error('bountiful-after-dice:invalid-roll-cursor')
 const cursor=input.rollCursor??first.continuation?.rollCursor
 const continuation={hostMemberId:session.memberId,source:encodeBountifulAfterDiceSource(concreteSource),...(first.continuation?.afterOriginalFalls?{afterOriginalFalls:structuredClone(first.continuation.afterOriginalFalls)}:{}),...(cursor!==undefined?{rollCursor:cursor}:{})}
 if(first.continuation&&JSON.stringify(first.continuation)===JSON.stringify(continuation))return
 const source={...input.source,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source:input.source,receipts:rows})}
 const replay=createDnd5ePreparedDamageCommitSession(source,input.resolve,()=>false)
 let result:ReturnType<typeof replay.run>
 try{result=replay.run(source.prepared.state)}finally{replay.cancel()}
 if(result.status==='rejected'||result.status==='pending-ally-natural-one'||result.status==='resolved'&&(!result.result.result.ok||!result.result.application))throw Error('bountiful-after-dice:real-continuation-rejected')
 const parents={...combat.bountifulOriginalParents,[bountifulOriginalParentReceiptId(input.action.id,0)]:{...first,continuation}}
 if(!validateBountifulOriginalParents(parents))throw Error('bountiful-after-dice:invalid-continuation')
 if(host().memberId!==session.memberId||host().roomId!==session.roomId||!input.authorityUnchanged())throw Error('bountiful-after-dice:stale-host')
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:parents}}],{transactionId:'bountiful-after-dice:'+input.action.id,readRevisions:{...actualReads,'player-action-requests':revision(queue)}})
}

/** Routes an accepted action through Bountiful only when this exact queued
 * parent has a private original-die receipt. All other ACKs retain their
 * established publisher, including ordinary rejection/cancellation. */
export async function publishBountifulOrOrdinaryPlayerActionAck(action:SharedPlayerActionState,input:PublishPlayerActionAckInput,gateway:Gateway){
 if(input.ack.status!=='accepted')return publishPlayerActionAckWithSnapshots(input)
 const combat=await gateway.loadResource<Combat>('combat')
 if(!combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(action.id,0)]){
  if(Object.values(combat?.bountifulReadyParents??{}).some(row=>row.parentId===action.id))return publishBountifulReadyThroughNormalAck(action,input,gateway)
  return publishPlayerActionAckWithSnapshots(input)
 }
 return publishBountifulOriginalThroughNormalAck(action,input,gateway)
}

/** Only the actual hazard completion can advance this original binding's
 * protected dice journal. Every other receipt/source/cost byte stays fixed. */
export async function refreshBountifulOpportunityMovementJournal(action:SharedPlayerActionState,material:object,gateway:Gateway){
 const binding=bindings.get(action),session=host()
 if(!binding||binding.opportunityContinuationPending||!binding.authorityUnchanged())throw Error('bountiful-opportunity-journal:actual-parent-binding-required')
 const completed=readBountifulOpportunityMovementJournal(action,material,binding.resolved),combat=await gateway.loadResource<Revisioned<Combat>>('combat')
 if(!combat||!validateBountifulOriginalParents(combat.bountifulOriginalParents))throw Error('bountiful-opportunity-journal:protected-current-journal-required')
 const current=rowsFor(combat,action.id),before=binding.receipts,withoutJournal=(row:BountifulOriginalDieReceipt)=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='opportunitySettlementRolls'))
 if(current.length!==before.length||current.some((row,index)=>row.consumed||JSON.stringify(index===0?withoutJournal(row):row)!==JSON.stringify(index===0?withoutJournal(before[index]):before[index]))||current[0]?.originalAdapterId!=='opportunity-move'||current[0]?.identity.hostMemberId!==session.memberId||current[0]?.identity.roomId!==session.roomId)throw Error('bountiful-opportunity-journal:changed-original-parent')
 const prior=before[0].opportunitySettlementRolls??[],next=current[0].opportunitySettlementRolls??[]
 if(JSON.stringify(prior.filter(row=>row.spec.phase!=='movement-hazards'))!==JSON.stringify(next.filter(row=>row.spec.phase!=='movement-hazards'))||JSON.stringify(next.filter(row=>row.spec.phase==='movement-hazards'))!==JSON.stringify(completed))throw Error('bountiful-opportunity-journal:changed-nonhazard-journal')
 if(!binding.authorityUnchanged())throw Error('bountiful-opportunity-journal:stale-parent')
 binding.receipts=structuredClone(current)
}

/** Activity's real async facade, never its initial probe worker, supplies the
 * final application. Existing normal5 publisher and all its guards remain. */
export async function resolveBountifulActivityOriginalForNormalAck(input:{action:SharedPlayerActionState;source:Parameters<typeof completeBountifulActivityOriginal>[0]['source'];activityOriginalQualification:BountifulActivityOriginalQualification;activityOriginalContinuation?:BountifulActivityOriginalContinuation;options:Dnd5eDamageReactionFlowOptions},gateway:Gateway&Pick<SharedRoomGatewayPort,'saveResourcesAtomically'>){
 const session=host(),combat=await gateway.loadResource<Revisioned<Combat>>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)];if(!combat||!first||first.originalAdapterId!=='plugin-feature'||first.consumed||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId||JSON.stringify(input.action)!==JSON.stringify(first.originalRoomAction)||!input.options.authorityUnchanged())throw Error('bountiful-ack:real-private-parent-required');
 const facts=readBountifulActivityOriginalQualification(input.activityOriginalQualification,input.source),original=await readBountifulOriginalSource(first);const completeSource=input.activityOriginalContinuation?readBountifulActivityOriginalContinuation(input.activityOriginalContinuation,input.source,first,input.activityOriginalQualification).source:original.source;if(input.activityOriginalContinuation){if(!gateway.loadBountifulActivityOriginalSource)throw Error('activity-continuation:private-book-loader-required');await assertBountifulActivityOriginalContinuationCurrent(input.activityOriginalContinuation,gateway as BountifulActivityOriginalContinuationGateway,input.source)}if(first.continuation||JSON.stringify(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(input.source)))!==JSON.stringify(input.activityOriginalContinuation?encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(completeSource)):first.originalParent)||JSON.stringify(completeSource)!==JSON.stringify(input.source)||JSON.stringify(facts.rawIssuer)!==JSON.stringify(first.rawIssuer)||facts.effectTimestamp!==first.identity.effectTimestamp)throw Error('bountiful-ack:changed-original-input');
 const receipts=rowsFor(combat,input.action.id),readyRecords=readyRowsFor(combat,input.action.id);if(readyRecords.length||receipts.some(row=>row.consumed))throw Error('activity-completion:unsupported-original-continuation');for(const row of receipts)decisionFromBountifulOriginalDieReceipt(row,row.request);
 const resolved=await completeBountifulActivityOriginal({source:input.source,activityOriginalQualification:input.activityOriginalQualification,receipts,options:input.options});if(!resolved.result.ok||!resolved.application)throw Error('bountiful-ack:real-parent-not-resolved:'+(resolved.result.ok?'missing-application':resolved.result.reason));readBountifulActivityOriginalQualification(input.activityOriginalQualification,input.source);if(!input.options.authorityUnchanged())throw Error('bountiful-ack:stale-parent');bindings.set(input.action,{action:input.action,sourceState:cloneDnd5eHostTransactionInput(input.source.prepared.state),characterIdByCombatantId:{...input.source.prepared.characterIdByCombatantId},receipts:structuredClone(receipts),readyRecords:[],resolved,authorityUnchanged:input.options.authorityUnchanged});activityOriginalResults.set(input.action,{source:input.source,resultSignature:JSON.stringify(encodeSecondChanceParentWire(resolved)),...(input.activityOriginalContinuation?{continuation:input.activityOriginalContinuation}:{})});return resolved
}

/** Initial plugin Spell full-source proof has its own fixed facade and private book. */
export async function resolveBountifulPluginSpellAbilityOriginalForNormalAck(input:{action:SharedPlayerActionState;source:Parameters<typeof completeBountifulPluginSpellAbilityOriginal>[0]['source'];pluginSpellAbilityOriginalQualification:BountifulPluginSpellAbilityOriginalQualification;pluginSpellAbilityOriginalContinuation?:BountifulPluginSpellAbilityOriginalContinuation;options:Dnd5eDamageReactionFlowOptions},gateway:Gateway&Pick<SharedRoomGatewayPort,'saveResourcesAtomically'>){
 const session=host(),combat=await gateway.loadResource<Revisioned<Combat>>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)];if(!combat||!first||first.originalAdapterId!=='plugin-spell'||first.consumed||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId||JSON.stringify(input.action)!==JSON.stringify(first.originalRoomAction)||!input.options.authorityUnchanged())throw Error('bountiful-ack:real-private-parent-required');
 const facts=readBountifulPluginSpellAbilityOriginalQualification(input.pluginSpellAbilityOriginalQualification,input.source),original=await readBountifulOriginalSource(first);const completeSource=input.pluginSpellAbilityOriginalContinuation?readBountifulPluginSpellAbilityOriginalContinuation(input.pluginSpellAbilityOriginalContinuation,input.source,first,input.pluginSpellAbilityOriginalQualification).source:original.source;if(input.pluginSpellAbilityOriginalContinuation){if(!gateway.loadBountifulPluginSpellAbilityOriginalSource)throw Error('plugin-spell-ability-continuation:private-book-loader-required');await assertBountifulPluginSpellAbilityOriginalContinuationCurrent(input.pluginSpellAbilityOriginalContinuation,gateway as BountifulPluginSpellAbilityOriginalContinuationGateway,input.source)}if(first.continuation||JSON.stringify(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(input.source)))!==JSON.stringify(input.pluginSpellAbilityOriginalContinuation?encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(completeSource)):first.originalParent)||JSON.stringify(completeSource)!==JSON.stringify(input.source)||JSON.stringify(facts.rawIssuer)!==JSON.stringify(first.rawIssuer)||facts.effectTimestamp!==first.identity.effectTimestamp)throw Error('bountiful-ack:changed-original-input');
 const receipts=rowsFor(combat,input.action.id),readyRecords=readyRowsFor(combat,input.action.id);if(readyRecords.length||receipts.some(row=>row.consumed))throw Error('plugin-spell-ability-completion:unsupported-original-continuation');for(const row of receipts)decisionFromBountifulOriginalDieReceipt(row,row.request);
 const resolved=await completeBountifulPluginSpellAbilityOriginal({source:input.source,pluginSpellAbilityOriginalQualification:input.pluginSpellAbilityOriginalQualification,receipts,options:input.options});if(!resolved.result.ok||!resolved.application)throw Error('bountiful-ack:real-parent-not-resolved:'+(resolved.result.ok?'missing-application':resolved.result.reason));readBountifulPluginSpellAbilityOriginalQualification(input.pluginSpellAbilityOriginalQualification,input.source);if(!input.options.authorityUnchanged())throw Error('bountiful-ack:stale-parent');bindings.set(input.action,{action:input.action,sourceState:cloneDnd5eHostTransactionInput(input.source.prepared.state),characterIdByCombatantId:{...input.source.prepared.characterIdByCombatantId},receipts:structuredClone(receipts),readyRecords:[],resolved,authorityUnchanged:input.options.authorityUnchanged});pluginSpellAbilityOriginalResults.set(input.action,{source:input.source,resultSignature:JSON.stringify(encodeSecondChanceParentWire(resolved)),...(input.pluginSpellAbilityOriginalContinuation?{continuation:input.pluginSpellAbilityOriginalContinuation}:{})});spellLocalResults.set(resolved,JSON.stringify(resolved));spellLocalOriginals.set(resolved,{map:cloneDnd5eHostTransactionInput(input.source.prepared.map),characters:cloneDnd5eHostTransactionInput(input.source.prepared.characters)});return resolved
}

/** Independent caster-first/target-later completion. The stored original parent
 * remains plain; no generic after-dice target allowance is introduced. */
export async function resolveSpellcastingTargetOriginalForNormalAck(input:Parameters<typeof completeSpellcastingTargetOriginal>[0]&{action:SharedPlayerActionState},gateway:Gateway&Pick<SharedRoomGatewayPort,'saveResourcesAtomically'>){
 const session=host(),combat=await gateway.loadResource<Revisioned<Combat>>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)];if(!combat||!first||first.originalAdapterId!=='spell'||first.consumed||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId||JSON.stringify(input.action)!==JSON.stringify(first.originalRoomAction)||!input.options.authorityUnchanged())throw Error('caster-target-ack:actual-private-parent-required')
 const continuation=await readSpellcastingTargetOriginalContinuation(input.continuation)
 if(JSON.stringify(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(continuation.initial)))!==JSON.stringify(first.originalParent)||JSON.stringify(continuation.rawIssuer)!==JSON.stringify(first.rawIssuer)||continuation.effectTimestamp!==first.identity.effectTimestamp)throw Error('caster-target-ack:changed-initial-original')
 const receipts=rowsFor(combat,input.action.id),readyRecords=readyRowsFor(combat,input.action.id),exactLaterPrefix=receipts.length===2&&continuation.authenticatedCasterPrefix!==undefined&&JSON.stringify(receipts)===JSON.stringify(continuation.authenticatedCasterPrefix);if((receipts.length!==1&&!exactLaterPrefix)||readyRecords.length||receipts.some(row=>row.consumed)||first.continuation||first.postOriginalD20?.length||first.postOriginalEquipmentD20!==undefined)throw Error('caster-target-ack:unsupported-later-original-prefix');for(const row of receipts)decisionFromBountifulOriginalDieReceipt(row,row.request)
 const resolved=await completeSpellcastingTargetOriginal(input);if(!resolved.result.ok||!resolved.application)throw Error('caster-target-ack:real-parent-not-resolved:'+(resolved.result.ok?'missing-application':resolved.result.reason));readSpellcastingTargetCompletedOriginal(resolved,input.source);await readSpellcastingTargetOriginalContinuation(input.continuation);if(!input.options.authorityUnchanged())throw Error('caster-target-ack:stale-parent')
 bindings.set(input.action,{action:input.action,sourceState:cloneDnd5eHostTransactionInput(input.source.prepared.state),characterIdByCombatantId:{...input.source.prepared.characterIdByCombatantId},receipts:structuredClone(receipts),readyRecords:[],resolved,authorityUnchanged:input.options.authorityUnchanged});casterTargetOriginalResults.set(input.action,{source:cloneDnd5eHostTransactionInput(input.source),resultSignature:JSON.stringify(encodeSecondChanceParentWire(resolved)),continuation:input.continuation});spellLocalResults.set(resolved,JSON.stringify(resolved));spellLocalOriginals.set(resolved,{map:cloneDnd5eHostTransactionInput(input.source.prepared.map),characters:cloneDnd5eHostTransactionInput(input.source.prepared.characters)});return resolved
}

/** Only a current complete first-non1/end-original Native continuation supplies
 * the later physical pool. The source and all real receipts stay unchanged. */
export async function resolveBountifulDeathFirstRepeatForNormalAck<Input extends PreparedInput,Result extends ParentResult>(input:{action:SharedPlayerActionState;source:Input;resolve:(input:Input)=>Result;options:Dnd5eDamageReactionFlowOptions;deathFirstRepeatContinuation:BountifulDeathFirstRepeatContinuation},gateway:Gateway&Pick<SharedRoomGatewayPort,'saveResourcesAtomically'>):Promise<Result>{if(!input.deathFirstRepeatContinuation)throw Error('bountiful-death-first-repeat:actual-private-continuation-required');return resolveBountifulOriginalForNormalAckInternal(input,gateway,false,undefined,input.deathFirstRepeatContinuation)}

/** A fixed genuine saving qualification and the current authenticated private
 * book precede Native/Base. This does not accept a caller result or grant an
 * additional after-dice source family. */
export async function resolveBountifulPluginSpellSavingOriginalForNormalAck(input:{action:SharedPlayerActionState;source:Parameters<typeof import('./pluginSpellTransaction').resolvePreparedDnd5ePluginSpellCast>[0];qualification:Dnd5ePluginSpellSavingOriginalQualification;effects?:BountifulPluginSpellSavingEffectsQualification;options:Dnd5eDamageReactionFlowOptions},gateway:Gateway&Pick<SharedRoomGatewayPort,'saveResourcesAtomically'|'loadBountifulPluginSpellSavingOriginalSource'>){
 if(!gateway.loadBountifulPluginSpellSavingOriginalSource)throw Error('plugin-spell-saving-ack:private-book-loader-required')
 const book=await gateway.loadBountifulPluginSpellSavingOriginalSource({parentId:input.action.id,mapId:input.action.mapId,combatId:input.source.prepared.state.combatId}),effectSource=input.effects?await assertBountifulPluginSpellSavingEffectsQualificationCurrent(input.effects,input.qualification,{...gateway,loadBountifulPluginSpellSavingOriginalSource:gateway.loadBountifulPluginSpellSavingOriginalSource},input.source):undefined,facts=readDnd5ePluginSpellSavingOriginalQualificationCurrent(input.qualification,effectSource?.originalSource??input.source,book)
 if(book.effects?.length&&!input.effects)throw Error('plugin-spell-saving-ack:actual-effect-qualification-required')
 if(JSON.stringify(encodeSecondChanceParentWire(input.action))!==JSON.stringify(encodeSecondChanceParentWire(facts.source.prepared.action))||facts.request.nativeLucky||facts.request.kind!=='saving-throw')throw Error('plugin-spell-saving-ack:exact-actual-saving-parent-required')
 const sourceSignature=JSON.stringify(encodeSecondChanceParentWire(input.source))
 const resolved=await resolveBountifulOriginalForNormalAckInternal({...input,resolve:resolvePreparedDnd5ePluginSpellCast},gateway,false,undefined,undefined,input.qualification,input.effects)
 if(JSON.stringify(encodeSecondChanceParentWire(input.source))!==sourceSignature){bindings.delete(input.action);throw Error('plugin-spell-saving-ack:changed-native-source-during-completion')}
 if(!resolved.result.ok||!resolved.application)throw Error('plugin-spell-saving-ack:actual-native-completion-required')
 spellLocalResults.set(resolved,JSON.stringify(resolved));spellLocalOriginals.set(resolved,{map:cloneDnd5eHostTransactionInput(input.source.prepared.map),characters:cloneDnd5eHostTransactionInput(input.source.prepared.characters)});pluginSpellSavingOriginalResults.set(input.action,{resolved,source:input.source,sourceSignature,resultSignature:JSON.stringify(encodeSecondChanceParentWire(resolved)),bookSignature:savingBookIdentity(book),qualification:input.qualification,...(input.effects?{effects:input.effects}:{})})
 return resolved
}

/** Mechanical source of this already-authenticated deferred Death only.
 * It cannot supply raw dice, settle an area, stage a caller world or publish. */
declare const deathAreaOriginBrand:unique symbol
export type BountifulDeathAreaOrigin={readonly[deathAreaOriginBrand]:true}
type DeathAreaOriginFacts={parentId:string;mapId:string;combatId:string;effectTimestamp:number;worldMinute:number|undefined;action:SharedPlayerActionState;originalSource:BountifulOriginalDieReceipt['originalParent'];receipts:readonly BountifulOriginalDieReceipt[];state:Dnd5eHeadlessCombatState;map:BattleMap;characters:readonly Character[];characterIdByCombatantId:Readonly<Record<string,string>>;initiativeOrder:SharedCombatState['initiativeOrder'];transition:import('../../pages/maps/persistentAreaTurnBoundary').Dnd5ePersistentAreaTurnTransition}
const deathAreaOrigins=new WeakMap<object,{action:SharedPlayerActionState;binding:Binding;resolved:ParentResult;signature:string;actionSignature:string;roomId:string;memberId:string;facts:DeathAreaOriginFacts}>()
export async function captureBountifulDeathAreaOrigin(action:SharedPlayerActionState):Promise<BountifulDeathAreaOrigin>{
 const session=host(),binding=bindings.get(action),record=binding&&deathLocalResults.get(binding.resolved),original=binding&&deathLocalOriginals.get(binding.resolved),pending=binding&&deathDeferredBeginSources.get(binding.resolved),combat=binding&&deathLocalOriginalCombats.get(binding.resolved)
 if(!binding||binding.action!==action||binding.receipts[0]?.originalAdapterId!=='death-save'||!record||!original||!pending||!combat||pending.clock!==pending.readClock()||!binding.authorityUnchanged()||!safeDeathNativeData(binding.resolved)||record.signature!==JSON.stringify(encodeSecondChanceParentWire(binding.resolved))||!record.native.result.ok||!record.native.application||deathAreaBoundaryInactive(binding,original.map,original.characters))throw Error('death-area-origin:actual-active-deferred-death-required')
 const effectTimestamp=binding.receipts[0].identity.effectTimestamp;if(typeof effectTimestamp!=='number'||!Number.isFinite(effectTimestamp)||effectTimestamp<=0)throw Error('death-area-origin:actual-original-clock-required')
 const helpers=await import('../../pages/maps/persistentAreaTurnBoundary'),native=record.native,store=projectDnd5eCombatApplicationStoreState({map:original.map,characters:original.characters,application:native.application!}),state=native.result.state,order=projectHeadlessInitiativeOrder({current:combat.initiativeOrder,state}),previous=helpers.dnd5ePersistentAreaTurnCursor({mapId:original.map.id,combatId:binding.sourceState.combatId,round:binding.sourceState.round,initiativeIndex:binding.sourceState.initiativeIndex,initiativeOrder:combat.initiativeOrder}),next=helpers.dnd5ePersistentAreaTurnCursor({mapId:original.map.id,combatId:state.combatId,round:state.round,initiativeIndex:state.initiativeIndex,initiativeOrder:order})
 if(!previous||!next||bindings.get(action)!==binding||deathLocalResults.get(binding.resolved)!==record||deathDeferredBeginSources.get(binding.resolved)!==pending||record.signature!==JSON.stringify(encodeSecondChanceParentWire(binding.resolved))||!binding.authorityUnchanged()||pending.clock!==pending.readClock())throw Error('death-area-origin:unchanged-deferred-cursor-required')
 const facts:DeathAreaOriginFacts=cloneDnd5eHostTransactionInput({parentId:action.id,mapId:original.map.id,combatId:state.combatId,effectTimestamp,worldMinute:pending.clock,action,originalSource:binding.receipts[0].originalParent,receipts:binding.receipts,state,map:store.map,characters:store.characters,characterIdByCombatantId:binding.characterIdByCombatantId,initiativeOrder:order,transition:helpers.planDnd5ePersistentAreaTurnTransition(previous,next)}),cap=Object.freeze({})as BountifulDeathAreaOrigin
 deathAreaOrigins.set(cap,{action,binding,resolved:binding.resolved,signature:record.signature,actionSignature:JSON.stringify(action),roomId:session.roomId,memberId:session.memberId,facts});return cap
}
export function readBountifulDeathAreaOrigin(cap:BountifulDeathAreaOrigin){const row=deathAreaOrigins.get(cap),session=host(),binding=row&&bindings.get(row.action),pending=binding&&deathDeferredBeginSources.get(binding.resolved),record=binding&&deathLocalResults.get(binding.resolved);if(!row||session.roomId!==row.roomId||session.memberId!==row.memberId||binding!==row.binding||binding.resolved!==row.resolved||!pending||!record||pending.clock!==pending.readClock()||!binding.authorityUnchanged()||JSON.stringify(row.action)!==row.actionSignature||record.signature!==row.signature||record.signature!==JSON.stringify(encodeSecondChanceParentWire(binding.resolved)))throw Error('death-area-origin:actual-current-origin-required');return cloneDnd5eHostTransactionInput(row.facts)}
export function cancelBountifulDeathAreaOrigin(cap:BountifulDeathAreaOrigin){return deathAreaOrigins.delete(cap)}

/** Re-reads the new family's authenticated server book through the gateway
 * captured by the actual original Death resolver. There is no public setter. */
export async function loadBountifulDeathAreaOriginBook(cap:BountifulDeathAreaOrigin){
 const before=readBountifulDeathAreaOrigin(cap),row=deathAreaOrigins.get(cap)!,gateway=deathAreaBindingGateways.get(row.binding)
 if(!gateway?.loadBountifulDeathAreaOriginalSource)throw Error('death-area-origin:actual-private-book-loader-required')
 const book=await gateway.loadBountifulDeathAreaOriginalSource({parentId:before.parentId,mapId:before.mapId,combatId:before.combatId}),after=readBountifulDeathAreaOrigin(cap)
 if(JSON.stringify(before)!==JSON.stringify(after)||book.ok!==true||book.present!==true||book.parentId!==before.parentId||book.mapId!==before.mapId||book.combatId!==before.combatId||book.roomId!==row.roomId||book.hostMemberId!==row.memberId||book.effectTimestamp!==before.effectTimestamp||JSON.stringify(book.originalSource)!==JSON.stringify(before.originalSource)||!Array.isArray(book.originalRows)||book.originalRows.length!==before.receipts.length||book.originalRows.some((receipt,index)=>{const original=before.receipts[index];return JSON.stringify(receipt.identity)!==JSON.stringify(original.identity)||JSON.stringify(receipt.request)!==JSON.stringify(original.request)||JSON.stringify(receipt.ownerDecisions)!==JSON.stringify(original.ownerDecisions)||JSON.stringify(receipt.rawReroll)!==JSON.stringify(original.rawReroll)||JSON.stringify(receipt.hostReroll)!==JSON.stringify(original.hostReroll)}))throw Error('death-area-origin:exact-authenticated-original-book-required')
 return cloneDnd5eHostTransactionInput(book)
}

/** Only this genuine original's captured gateway can submit its family input
 * command. Fields describing state/source/specification are never accepted. */
export async function publishBountifulDeathAreaOriginInput(cap:BountifulDeathAreaOrigin,input:{phase:'register'}|{phase:'host-raw';pool:'saving'|'damage';rawValues:readonly number[]}|{phase:'confirm';pool:'saving'|'damage';rawValues:readonly number[];values:readonly number[]}){
 const facts=readBountifulDeathAreaOrigin(cap),row=deathAreaOrigins.get(cap)!,gateway=deathAreaBindingGateways.get(row.binding)
 if(!gateway?.publishEvent||!input||Reflect.ownKeys(input).some(k=>!['phase','pool','rawValues','values'].includes(String(k))))throw Error('death-area-origin:actual-captured-input-port-required')
 const common={sourceKind:'death-area-original-v1',parentId:facts.parentId,mapId:facts.mapId,combatId:facts.combatId}
 if(input.phase==='register'){if(Reflect.ownKeys(input).length!==1)throw Error('death-area-origin:closed-register-input-required');await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{...common,phase:'register'})}
 else{const book=await loadBountifulDeathAreaOriginBook(cap);if(!['saving','damage'].includes(input.pool))throw Error('death-area-origin:actual-family-pool-required');await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{...common,...input,requestId:book.requestId})}
 readBountifulDeathAreaOrigin(cap)
}

/** Dedicated area Own input; the original captured gateway is the only transport and no caller decision/spec/source is accepted. */
export async function publishBountifulDeathAreaOwnInput(cap:BountifulDeathAreaOrigin,input:{phase:'register'|'choice'}|{phase:'host-raw';rawValues:readonly number[]}|{phase:'confirm';rawValues:readonly number[];values:readonly number[]}){const facts=readBountifulDeathAreaOrigin(cap),row=deathAreaOrigins.get(cap)!,gateway=deathAreaBindingGateways.get(row.binding);if(!gateway?.publishEvent||!input||Reflect.ownKeys(input).some(k=>!['phase','rawValues','values'].includes(String(k))))throw Error('death-area-own:actual-captured-input-port-required');const common={sourceKind:'death-area-own-v1',parentId:facts.parentId,mapId:facts.mapId,combatId:facts.combatId};if(input.phase==='register'){if(Reflect.ownKeys(input).length!==1)throw Error('death-area-own:closed-register-required');await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{...common,phase:'register'})}else{const book=await loadBountifulDeathAreaOriginBook(cap);if(!book.own)throw Error('death-area-own:actual-issued-book-required');await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{...common,...input,requestId:book.own.requestId})}readBountifulDeathAreaOrigin(cap)}
// Independent one-slot compound completion without a B event. No original
// receipt is created, consumed, or inferred by this branch.
const compoundNoBResults=new WeakMap<SharedPlayerActionState,{operation:Dnd5ePluginSpellCompoundNoBOperation;resolved:ParentResult;sourceSignature:string;resultSignature:string;bookSignature:string}>()
const compoundNoBNames=['characters','maps','combat','map-geometry','campaign-time','player-action-requests','player-action-processed','player-action-ack']as const
const compoundNoBSignature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
async function currentCompoundNoB(operation:Dnd5ePluginSpellCompoundNoBOperation,gateway:Gateway){
 const facts=readDnd5ePluginSpellCompoundNoBOperation(operation),session=host(),p=facts.source.prepared
 if(!facts.result?.result.ok||!facts.result.application||facts.request||!gateway.loadBountifulPluginSpellSavingOriginalSource)throw Error('ice-knife-no-b:actual-completed-native-required')
 const book=await gateway.loadBountifulPluginSpellSavingOriginalSource({parentId:p.action.id,mapId:p.map.id,combatId:p.state.combatId}),dependency=book.compoundNoBDependencies
 if(compoundNoBSignature(book)!==compoundNoBSignature(facts.book)||book.roomId!==session.roomId||book.hostMemberId!==session.memberId||!dependency||compoundNoBNames.some(name=>!Number.isSafeInteger(dependency.versions[name])||dependency.versions[name]<0||!Object.hasOwn(dependency.documents,name)))throw Error('ice-knife-no-b:exact-private-eight-document-book-required')
 const loaded=await Promise.all(compoundNoBNames.map(name=>gateway.loadResource<Record<string,unknown>>(name))),documents=Object.fromEntries(compoundNoBNames.map((name,index)=>[name,loaded[index]??null]))as Record<typeof compoundNoBNames[number],any>
 for(const name of compoundNoBNames)if(compoundNoBSignature(documents[name])!==compoundNoBSignature(dependency.documents[name])||(documents[name]?._sync?.revision??0)!==dependency.versions[name])throw Error('ice-knife-no-b:changed-original-document:'+name)
 const queue=documents['player-action-requests'],parents=Object.values(documents.combat?.bountifulOriginalParents??{})as BountifulOriginalDieReceipt[]
 if(!queue||Object.keys(queue).some(key=>!['_sync','updatedAt','requests','mapId','combatId'].includes(key))||queue.mapId!==undefined&&queue.mapId!==p.map.id||queue.combatId!==undefined&&queue.combatId!==p.state.combatId||!Array.isArray(queue.requests)||queue.requests.filter((row:SharedPlayerActionState)=>row.id===p.action.id).length!==1||!queue.requests.some((row:SharedPlayerActionState)=>compoundNoBSignature(row)===compoundNoBSignature(p.action))||queue.requests.some((row:SharedPlayerActionState)=>row.type==='dnd5e-bountiful-luck'&&row.bountifulLuck?.parentId===p.action.id)||parents.some(row=>row.identity.parentId===p.action.id))throw Error('ice-knife-no-b:original-queue-without-b-required')
 readDnd5ePluginSpellCompoundNoBOperation(operation)
 return{facts,book,documents,reads:{...dependency.versions}}
}
export async function resolveBountifulPluginSpellCompoundNoBForNormalAck(input:{action:SharedPlayerActionState;operation:Dnd5ePluginSpellCompoundNoBOperation;options:Dnd5eDamageReactionFlowOptions},gateway:Gateway){
 const current=await currentCompoundNoB(input.operation,gateway),source=current.facts.source
 if(compoundNoBSignature(input.action)!==compoundNoBSignature(source.prepared.action)||!input.options.authorityUnchanged()||bindings.has(input.action))throw Error('ice-knife-no-b:actual-current-parent-required')
 const resolved=await resolveDnd5ePreparedWithMaterialDamageReactions(input.options,source,resolvePreparedDnd5ePluginSpellCompound)
 if(!resolved.result.ok||!resolved.application||compoundNoBSignature(resolved)!==compoundNoBSignature(current.facts.result)||!input.options.authorityUnchanged())throw Error('ice-knife-no-b:unchanged-real-native-base-required')
 await currentCompoundNoB(input.operation,gateway)
 bindings.set(input.action,{action:input.action,sourceState:cloneDnd5eHostTransactionInput(source.prepared.state),characterIdByCombatantId:{...source.prepared.characterIdByCombatantId},receipts:[],readyRecords:[],resolved,authorityUnchanged:input.options.authorityUnchanged})
 compoundNoBResults.set(input.action,{operation:input.operation,resolved,sourceSignature:compoundNoBSignature(source),resultSignature:compoundNoBSignature(resolved),bookSignature:compoundNoBSignature(current.book)})
 spellLocalResults.set(resolved,JSON.stringify(resolved));spellLocalOriginals.set(resolved,{map:cloneDnd5eHostTransactionInput(source.prepared.map),characters:cloneDnd5eHostTransactionInput(source.prepared.characters)})
 return resolved
}
async function publishCompoundNoBThroughNormalAck(action:SharedPlayerActionState,input:PublishPlayerActionAckInput,gateway:Gateway){
 const record=compoundNoBResults.get(action),binding=bindings.get(action),snapshots=input.snapshots
 if(!record||!binding||binding.action!==action||binding.resolved!==record.resolved||binding.receipts.length||binding.readyRecords.length||!binding.authorityUnchanged()||compoundNoBSignature(record.resolved)!==record.resultSignature||!snapshots?.combat||input.ack.actionId!==action.id||input.ack.mapId!==action.mapId||input.ack.status!=='accepted')throw Error('ice-knife-no-b:actual-issued-final-required')
 const current=await currentCompoundNoB(record.operation,gateway),source=current.facts.source
 if(compoundNoBSignature(source)!==record.sourceSignature||compoundNoBSignature(current.book)!==record.bookSignature||!record.resolved.application)throw Error('ice-knife-no-b:changed-issued-source-or-book')
 const store=projectDnd5eCombatApplicationStoreState({map:source.prepared.map,characters:source.prepared.characters,application:record.resolved.application}),oldMaps=current.documents.maps.maps as BattleMap[],maps=oldMaps.map(map=>map.id===action.mapId?store.map:map)
 if(compoundNoBSignature(snapshots.characters)!==compoundNoBSignature(store.characters)||compoundNoBSignature(snapshots.maps)!==compoundNoBSignature(maps))throw Error('ice-knife-no-b:changed-native-world')
 const before=current.documents.combat,economies={...before.dnd5eTurnEconomyByToken,...Object.fromEntries(Object.entries(record.resolved.result.state.combatants).map(([id,actor])=>[id,projectDnd5eHeadlessTurnEconomy(before.dnd5eTurnEconomyByToken[id],actor.turn,actor.speed)]))},omit=(value:object)=>Object.fromEntries(Object.entries(value).filter(([key])=>!['_sync','updatedAt','dnd5eTurnEconomyByToken'].includes(key)))
 if(compoundNoBSignature(omit(snapshots.combat))!==compoundNoBSignature(omit(before))||compoundNoBSignature(snapshots.combat.dnd5eTurnEconomyByToken)!==compoundNoBSignature(economies))throw Error('ice-knife-no-b:changed-native-combat-or-cost')
 const prior=current.documents['player-action-processed']?.actionIds??[],expected=[...new Set([...prior,action.id])]
 if(compoundNoBSignature(input.processed?.actionIds)!==compoundNoBSignature(expected)||!binding.authorityUnchanged())throw Error('ice-knife-no-b:changed-native-processed-parent')
 await publishPlayerActionAckWithSnapshots({...input,expectedRevisions:{...input.expectedRevisions,...current.reads}})
 bindings.delete(action);compoundNoBResults.delete(action)
}

const compoundAnsweredCompletionResults=new WeakMap<SharedPlayerActionState,{operation:Dnd5ePluginSpellCompoundAnsweredCompletion;resolved:ParentResult;sourceSignature:string;resultSignature:string;bookSignature:string;retainedCombat:Revisioned<Combat>}>()
const compoundAnsweredCompletionNames=['characters','maps','combat','map-geometry','campaign-time','player-action-requests','player-action-processed','player-action-ack']as const
const compoundAnsweredCompletionSignature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
async function currentCompoundAnsweredCompletion(operation:Dnd5ePluginSpellCompoundAnsweredCompletion,gateway:Gateway){
 const facts=readDnd5ePluginSpellCompoundAnsweredCompletion(operation),session=host(),p=facts.source.prepared
 if(!facts.result?.result.ok||!facts.result.application||facts.request||!gateway.loadBountifulPluginSpellSavingOriginalSource)throw Error('ice-knife-answered-completion:actual-completed-native-required')
 const book=await gateway.loadBountifulPluginSpellSavingOriginalSource({parentId:p.action.id,mapId:p.map.id,combatId:p.state.combatId}),dependency=book.compoundNoBDependencies
 if(compoundAnsweredCompletionSignature(book)!==compoundAnsweredCompletionSignature(facts.book)||book.roomId!==session.roomId||book.hostMemberId!==session.memberId||!dependency||compoundAnsweredCompletionNames.some(name=>!Number.isSafeInteger(dependency.versions[name])||dependency.versions[name]<0||!Object.hasOwn(dependency.documents,name)))throw Error('ice-knife-answered-completion:exact-private-eight-document-book-required')
 const loaded=await Promise.all(compoundAnsweredCompletionNames.map(name=>gateway.loadResource<Record<string,unknown>>(name))),documents=Object.fromEntries(compoundAnsweredCompletionNames.map((name,index)=>[name,loaded[index]??null]))as Record<typeof compoundAnsweredCompletionNames[number],any>
 for(const name of compoundAnsweredCompletionNames)if(compoundAnsweredCompletionSignature(documents[name])!==compoundAnsweredCompletionSignature(dependency.documents[name])||(documents[name]?._sync?.revision??0)!==dependency.versions[name])throw Error('ice-knife-answered-completion:changed-original-document:'+name)
 const answered=readDnd5ePluginSpellCompoundAnsweredQualification(facts.qualification);if(!answered)throw Error('ice-knife-answered-completion:live-primary-required');const witnessed=readDnd5ePluginSpellCompoundPrimaryAnsweredQualification(answered)
 const queue=documents['player-action-requests'],parents=Object.values(documents.combat?.bountifulOriginalParents??{})as BountifulOriginalDieReceipt[]
 if(!queue||Object.keys(queue).some(key=>!['_sync','updatedAt','requests','mapId','combatId'].includes(key))||queue.mapId!==undefined&&queue.mapId!==p.map.id||queue.combatId!==undefined&&queue.combatId!==p.state.combatId||!Array.isArray(queue.requests)||queue.requests.filter((row:SharedPlayerActionState)=>row.id===p.action.id).length!==1||!queue.requests.some((row:SharedPlayerActionState)=>compoundAnsweredCompletionSignature(row)===compoundAnsweredCompletionSignature(p.action))||queue.requests.some((row:SharedPlayerActionState)=>row.type==='dnd5e-bountiful-luck'&&row.bountifulLuck?.parentId===p.action.id&&(row.status!=='done'||!witnessed.receipts.some(receipt=>receipt.processedRequestIds.includes(row.id))))||compoundAnsweredCompletionSignature(parents.filter(row=>row.identity.parentId===p.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence))!==compoundAnsweredCompletionSignature(witnessed.receipts))throw Error('ice-knife-answered-completion:original-queue-without-b-required')
 readDnd5ePluginSpellCompoundAnsweredCompletion(operation)
 return{facts,book,documents,witnessed,reads:{...dependency.versions}}
}
export async function resolveBountifulPluginSpellCompoundAnsweredCompletionForNormalAck(input:{action:SharedPlayerActionState;operation:Dnd5ePluginSpellCompoundAnsweredCompletion;options:Dnd5eDamageReactionFlowOptions},gateway:Gateway){
 const current=await currentCompoundAnsweredCompletion(input.operation,gateway),source=current.facts.source
 if(compoundAnsweredCompletionSignature(input.action)!==compoundAnsweredCompletionSignature(source.prepared.action)||!input.options.authorityUnchanged()||bindings.has(input.action))throw Error('ice-knife-answered-completion:actual-current-parent-required')
 const native=projectDnd5ePluginSpellCompoundQualifiedReplay(current.facts.qualification,source),resolved=await resolveDnd5ePreparedWithMaterialDamageReactions(input.options,native,dnd5ePluginSpellCompoundQualifiedResolver(current.facts.qualification))
 if(!resolved.result.ok||!resolved.application||compoundAnsweredCompletionSignature(resolved)!==compoundAnsweredCompletionSignature(current.facts.result)||!input.options.authorityUnchanged())throw Error('ice-knife-answered-completion:unchanged-real-native-base-required')
 await currentCompoundAnsweredCompletion(input.operation,gateway)
 bindings.set(input.action,{action:input.action,sourceState:cloneDnd5eHostTransactionInput(source.prepared.state),characterIdByCombatantId:{...source.prepared.characterIdByCombatantId},receipts:structuredClone(current.witnessed.receipts),readyRecords:[],resolved,authorityUnchanged:input.options.authorityUnchanged})
 compoundAnsweredCompletionResults.set(input.action,{operation:input.operation,resolved,sourceSignature:compoundAnsweredCompletionSignature(source),resultSignature:compoundAnsweredCompletionSignature(resolved),bookSignature:compoundAnsweredCompletionSignature(current.book),retainedCombat:cloneDnd5eHostTransactionInput(current.documents.combat)})
 spellLocalResults.set(resolved,JSON.stringify(resolved));spellLocalOriginals.set(resolved,{map:cloneDnd5eHostTransactionInput(source.prepared.map),characters:cloneDnd5eHostTransactionInput(source.prepared.characters)})
 return resolved
}

/** Only this genuinely completed answered parent may carry its protected combat
 * envelope into the actual Main snapshot. Unknown or real values stay intact
 * for the unchanged full NormalAck guard; this grants no dice or publication. */
export function projectBountifulPluginSpellCompoundAnsweredCombatSnapshot<T extends SharedCombatState>(action:SharedPlayerActionState,proposed:T):T{
 const record=compoundAnsweredCompletionResults.get(action);if(!record)return proposed
 const binding=bindings.get(action),facts=readDnd5ePluginSpellCompoundAnsweredCompletion(record.operation),session=host(),first=binding?.receipts[0]
 if(!binding||binding.action!==action||binding.resolved!==record.resolved||!binding.authorityUnchanged()||!binding.resolved.result.ok||!first||session.roomId!==first.identity.roomId||session.memberId!==first.identity.hostMemberId||compoundAnsweredCompletionSignature(action)!==compoundAnsweredCompletionSignature(facts.source.prepared.action)||compoundAnsweredCompletionSignature(facts.source)!==record.sourceSignature||compoundAnsweredCompletionSignature(facts.book)!==record.bookSignature||compoundAnsweredCompletionSignature(binding.resolved)!==record.resultSignature)throw Error('ice-knife-answered-snapshot:actual-live-bound-parent-required')
 const before=record.retainedCombat;if(!before||before.mapId!==action.mapId||before.combatId!==action.combatId||!before.dnd5eTurnEconomyByToken)throw Error('ice-knife-answered-snapshot:actual-retained-combat-required')
 const projected=cloneDnd5eHostTransactionInput(proposed),omitOwnUndefined=(value:object|undefined,key:string,expected:object|undefined)=>{if(!value||!expected||Object.hasOwn(expected,key))return;const descriptor=Object.getOwnPropertyDescriptor(value,key);if(descriptor&&'value'in descriptor&&descriptor.value===undefined)Reflect.deleteProperty(value,key)}
 for(const key of ['campaignRoundClock','bountifulOriginalParents']as const)if(!Object.hasOwn(projected,key)&&Object.hasOwn(before,key))Reflect.set(projected,key,cloneDnd5eHostTransactionInput(Reflect.get(before,key)))
 omitOwnUndefined(projected,'flowPause',before);omitOwnUndefined(projected.monsterControl,'controlledTokenId',before.monsterControl)
 const expected={...before.dnd5eTurnEconomyByToken,...Object.fromEntries(Object.entries(binding.resolved.result.state.combatants).map(([id,actor])=>[id,projectDnd5eHeadlessTurnEconomy(before.dnd5eTurnEconomyByToken![id],actor.turn,actor.speed)]))}
 for(const[id,economy]of Object.entries(expected))omitOwnUndefined(projected.dnd5eTurnEconomyByToken?.[id],'usedOncePerTurnKeys',economy)
 return projected
}
