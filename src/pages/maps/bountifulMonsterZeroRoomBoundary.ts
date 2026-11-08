import{captureBountifulMonsterDamageZeroSavingLateCheckpoint,collectBountifulMonsterDamageZeroSavingLate,readBountifulMonsterDamageZeroCollectedSavingLate,type BountifulMonsterDamageZeroSavingLateSelection}from'../../rulesets/dnd5e/bountifulMonsterDamageZeroSavingLateCheckpoint'
import{createBountifulMonsterSavingLateDice,hasActualBountifulMonsterHeldSavingOffer,type BountifulMonsterSavingLateLoader}from'../../rulesets/dnd5e/bountifulMonsterSavingLateDice'
import{completeBountifulMonsterSavingLate,type BountifulMonsterSavingLateCompletion}from'../../rulesets/dnd5e/bountifulMonsterSavingLateCompletion'
import{getRoomSession}from'../../lib/roomSession'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{createMonsterDamageZeroSavingThrowRoomChoiceDriver}from'../../lib/monsterDamageZeroSavingThrowRoomChoices'
import{createDnd5eOriginalD20Session}from'../../rulesets/dnd5e/damageCommitSession'
import{resolvePreparedDnd5eMonsterAttack}from'../../rulesets/dnd5e/monsterAttackAction'
import{captureDnd5eMonsterDamageZeroOriginalOperation,readDnd5eMonsterDamageZeroOriginalOperation,buildDnd5eMonsterDamageZeroOriginalSource,hasActualDnd5eMonsterDamageZeroAllyBoundary,type Dnd5eMonsterDamageZeroOriginalOperation}from'../../rulesets/dnd5e/damageZeroMonsterOriginalOperation'
import{bindDnd5eMonsterDamageZeroOriginalContext}from'../../rulesets/dnd5e/monsterDamageZeroOriginalContext'
import{restoreBountifulMonsterDamageZeroOriginalParent,captureBountifulMonsterDamageZeroOriginalPreparation,type BountifulMonsterDamageZeroOriginalParent}from'../../rulesets/dnd5e/bountifulMonsterDamageZeroOriginalPreparation'
import{createBountifulMonsterDamageZeroOriginalRaw,type BountifulMonsterDamageZeroOriginalRawLoader}from'../../rulesets/dnd5e/bountifulMonsterDamageZeroOriginalRaw'
import{captureBountifulMonsterDamageZeroOriginalQualification}from'../../rulesets/dnd5e/bountifulMonsterDamageZeroOriginalQualification'
import{persistBountifulMonsterZeroOriginal}from'../../rulesets/dnd5e/bountifulMonsterZeroPersistentParent'
import{driveBountifulMonsterZeroOriginal}from'../../rulesets/dnd5e/bountifulMonsterZeroRoomDriver'
import{resolveDnd5ePreparedWithMaterialDamageReactions,type Dnd5eDamageReactionFlowOptions}from'../../rulesets/dnd5e/damageReactionFlow'
import type{BountifulOriginalDieReceipt}from'../../rulesets/dnd5e/bountifulLuckReceipt'
import{prepareBountifulMonsterZeroNativeStage,settleBountifulMonsterZeroNativeStage,publishBountifulMonsterZeroMapResult,type BountifulMonsterZeroPublication}from'./bountifulMonsterZeroPublication'
import{dnd5eHasBountifulOriginalReadySource,dnd5eHeldBardicInspirationDie,dnd5eDarkOnesOwnLuckAvailable,dnd5eSavingThrowRerollFeature}from'../../application/combat/dnd5eCombatRules'
import{dnd5eActiveOptionalBonusDice}from'../../rulesets/dnd5e/activeEffects'
import{projectDnd5eCombatApplicationStoreState}from'./combatApplicationStoreProjection'
import{sameActivityParentData}from'./postNativeActivityParent'
import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import type{SharedCombatState}from'../../lib/sharedCombatTypes'
type Source=Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
type Room=Parameters<typeof createMonsterDamageZeroSavingThrowRoomChoiceDriver>[0]
type NativeStage=Awaited<ReturnType<typeof prepareBountifulMonsterZeroNativeStage>>
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
/** A concrete outer Monster source owns this Room driver. Legacy Native/MM
 * branches stay outside it; the existing Page still runs Native then Base. */
export function createBountifulMonsterZeroRoomBoundary(input:{parentId:string;mapId:string;combatId:string;gateway:Gateway;loadOriginal:BountifulMonsterDamageZeroOriginalRawLoader;loadSavingLate?:BountifulMonsterSavingLateLoader;collectHeldSavingThrow?:(selection:BountifulMonsterDamageZeroSavingLateSelection&{checkpoint:ReturnType<typeof captureBountifulMonsterDamageZeroSavingLateCheckpoint>;dice:Awaited<ReturnType<typeof createBountifulMonsterSavingLateDice>>})=>Promise<BountifulMonsterDamageZeroSavingLateSelection['prefix']>;probeParent:(identity:{parentId:string;mapId:string;combatId:string})=>Promise<BountifulMonsterDamageZeroOriginalParent|undefined>;options:Dnd5eDamageReactionFlowOptions;room:Pick<Room,'choose'|'rollDice'|'collectLateSavingThrow'>;ui:Parameters<typeof driveBountifulMonsterZeroOriginal>[3];onActiveOperation:(operation:Dnd5eMonsterDamageZeroOriginalOperation)=>Promise<void>}){
 const identity={parentId:input.parentId,mapId:input.mapId,combatId:input.combatId},handles=new WeakMap<Dnd5eMonsterDamageZeroOriginalOperation,Awaited<ReturnType<typeof createBountifulMonsterDamageZeroOriginalRaw>>>(),restarts=new WeakSet<object>()
 let nativeStage:NativeStage|undefined,publication:BountifulMonsterZeroPublication|undefined,activeOperation:Dnd5eMonsterDamageZeroOriginalOperation|undefined,finalProjection:ReturnType<typeof projectDnd5eCombatApplicationStoreState>|undefined,finalBase:Awaited<ReturnType<typeof settleBountifulMonsterZeroNativeStage>>['resolved']|undefined
 const unchanged=()=>input.options.authorityUnchanged(),guard=(source:Source)=>{const host=getRoomSession();if(host?.role!=='dm'||!host.roomId||!host.memberId||!unchanged()||source.transactionId!==identity.parentId||source.prepared.map.id!==identity.mapId||source.prepared.state.combatId!==identity.combatId)throw Error('monster-zero-room:actual-current-source-required')}
 const requireParent=async()=>{const parent=await input.probeParent(identity);if(!parent)throw Error('monster-zero-room:protected-class-parent-required');return parent}
 async function activate(operation:Dnd5eMonsterDamageZeroOriginalOperation){activeOperation=operation;await input.onActiveOperation(operation)}
 async function sourceFor(source:Source){
  guard(source);const book=await input.probeParent(identity)
  if(book){if(!same(encodeSecondChanceParentWire(source),book.source))throw Error('monster-zero-room:changed-restored-attack-input');const restored=await restoreBountifulMonsterDamageZeroOriginalParent(identity,requireParent);try{return restored.source}finally{restored.dispose()}}
  if(!dnd5eHasBountifulOriginalReadySource(source.prepared.state))return undefined
  const seed=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eMonsterAttack,source.prepared.targetToken.id,'saving-throw')
  try{const pending=seed.run(source.prepared.state);if(pending.status!=='pending-damage-zero-saving-throw')return undefined;return bindDnd5eMonsterDamageZeroOriginalContext(captureDnd5eMonsterDamageZeroOriginalOperation(pending))}finally{seed.cancel()}
 }
 async function readyNative(){
  const ready=await driveBountifulMonsterZeroOriginal(identity.parentId,input.gateway,input.loadOriginal,input.ui),actor=ready.stage.snapshot.combatants[ready.stage.request.actorId]
  // This new family has not issued any late-saving transport permission. Keep
  // a still-uncovered real option pending instead of silently declining it.
  if(actor&&(dnd5eDarkOnesOwnLuckAvailable(actor)||dnd5eSavingThrowRerollFeature(actor)||dnd5eActiveOptionalBonusDice(actor.classState.activeEffects,'saving-throw').length||(actor.classState.legendaryResistanceUses??0)>0))throw Error('monster-zero-room:actual-saving-late-protocol-required')
  let late:BountifulMonsterSavingLateCompletion|undefined
  if(actor&&dnd5eHeldBardicInspirationDie(actor)){const checkpoint=captureBountifulMonsterDamageZeroSavingLateCheckpoint(ready.stage);if(hasActualBountifulMonsterHeldSavingOffer(checkpoint)){if(!input.loadSavingLate||!input.collectHeldSavingThrow)throw Error('monster-zero-room:actual-saving-late-protocol-required');const dice=await createBountifulMonsterSavingLateDice(checkpoint,input.gateway,input.loadSavingLate),collected=await collectBountifulMonsterDamageZeroSavingLate(checkpoint,selection=>input.collectHeldSavingThrow!({...selection,checkpoint,dice}));await dice.finish();const facts=readBountifulMonsterDamageZeroCollectedSavingLate(collected);if(facts.choice.bardicInspirationRoll!==undefined)late=await completeBountifulMonsterSavingLate(dice,collected,input.gateway)}}
  nativeStage=await prepareBountifulMonsterZeroNativeStage(ready.qualification,ready.originalSource,input.gateway,unchanged,late);return nativeStage.resolved
 }
 return{
  async attachReplay(source:Source){guard(source);return source},
  async resolve(source:Source){
   guard(source);const combat=await input.gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),first=combat?.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',identity.parentId,0])]
   if(first){if(first.originalRoomAction.kind!=='monster-damage-zero-original'||first.originalAdapterId!=='monster')throw Error('monster-zero-room:wrong-original-family');const book=await requireParent();if(!same(encodeSecondChanceParentWire(source),book.source))throw Error('monster-zero-room:changed-restored-attack-input');const restored=await restoreBountifulMonsterDamageZeroOriginalParent(identity,requireParent);try{await activate(restored.operation)}finally{restored.dispose()}return readyNative()}
   const bound=await sourceFor(source);if(!bound)return resolveDnd5ePreparedWithMaterialDamageReactions(input.options,source,resolvePreparedDnd5eMonsterAttack)
   const room=createMonsterDamageZeroSavingThrowRoomChoiceDriver({...input.room,map:bound.prepared.map,characters:()=>bound.prepared.characters,parentTransactionId:()=>identity.parentId,authorityUnchanged:unchanged,originalRaw:{prepare:async operation=>{await activate(operation);return captureBountifulMonsterDamageZeroOriginalPreparation(operation,input.gateway,requireParent)},create:async(operation,labels)=>{const handle=await createBountifulMonsterDamageZeroOriginalRaw(operation,input.gateway,input.loadOriginal,labels);handles.set(operation,handle);return handle},onPrefix:async selection=>{if(handles.get(selection.operation)!==selection.handle)throw Error('monster-zero-room:actual-original-handle-required')}}})
   const options:Dnd5eDamageReactionFlowOptions={...input.options,replayEventBatchId:identity.parentId,chooseDamageZeroSavingThrow:async selection=>{if(!selection.monsterOriginalOperation)throw Error('monster-zero-room:actual-bound-operation-required');return room.chooseDamageZeroSavingThrow({...selection,originalOperation:selection.monsterOriginalOperation})},chooseAllyNaturalOne:async selection=>{
    if(!selection.actualMonsterDamageZeroOriginal||!hasActualDnd5eMonsterDamageZeroAllyBoundary(selection.actualMonsterDamageZeroOriginal))return input.options.chooseAllyNaturalOne?.(selection)
    const completed=buildDnd5eMonsterDamageZeroOriginalSource(selection.actualMonsterDamageZeroOriginal),operation=completed.operations[0]?.operation,handle=operation&&handles.get(operation)
    if(!handle||completed.operations.length!==1)throw Error('monster-zero-room:actual-issued-class-original-required')
    const qualified=await captureBountifulMonsterDamageZeroOriginalQualification(selection.actualMonsterDamageZeroOriginal,handle);await persistBountifulMonsterZeroOriginal(qualified.qualification,qualified.source,input.gateway)
    const signal=Object.freeze({});restarts.add(signal);throw signal
   }}
   try{return await resolveDnd5ePreparedWithMaterialDamageReactions(options,bound,resolvePreparedDnd5eMonsterAttack)}catch(error){if(!error||typeof error!=='object'||!restarts.has(error))throw error;return readyNative()}
  },
  hasNativeStage(){return nativeStage!==undefined},
  async settleBase(base:Parameters<typeof settleBountifulMonsterZeroNativeStage>[1]){if(!nativeStage)throw Error('monster-zero-room:actual-native-stage-required');const before=structuredClone({map:base.map,characters:[...base.characters]}),complete=await settleBountifulMonsterZeroNativeStage(nativeStage.stage,base,input.gateway);publication=complete.publication;finalBase=complete.resolved;finalProjection=projectDnd5eCombatApplicationStoreState({...before,application:complete.resolved.application});return complete.resolved},
  assertFinalProjection(materials:{characters:readonly Character[];map:BattleMap|undefined;combat:SharedCombatState|undefined}){if(!finalProjection||!finalBase||!sameActivityParentData(materials.map,finalProjection.map)||!sameActivityParentData(materials.characters,finalProjection.characters))throw Error('monster-zero-room:unbound-post-base-materials');const actorId=activeOperation?readDnd5eMonsterDamageZeroOriginalOperation(activeOperation).source.prepared.actorToken.id:undefined;for(const actor of Object.values(finalBase.result.state.combatants)){const actual=materials.combat?.dnd5eTurnEconomyByToken?.[actor.id];if(!actual||(actual.reaction.current>0)!==actor.turn.reactionAvailable||actor.id===actorId&&((actual.action.current>0)!==actor.turn.actionAvailable||(actual.bonusAction.current>0)!==actor.turn.bonusActionAvailable))throw Error('monster-zero-room:unbound-post-base-economy')}},
  hasPublication(){return publication!==undefined},
  async publish(){if(!publication)throw Error('monster-zero-room:actual-final-publication-required');return publishBountifulMonsterZeroMapResult(publication,input.gateway)},
  readActiveOperation(){return activeOperation},
 }
}
