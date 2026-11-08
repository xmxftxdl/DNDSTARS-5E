import{captureBountifulSpellDamageZeroOriginalPreparation}from'./bountifulSpellDamageZeroOriginalPreparation'
import type{BountifulSpellDamageZeroOriginalParentLoader}from'./bountifulSpellDamageZeroOriginalParentTypes'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{resolveDnd5ePreparedWithMaterialDamageReactions,type Dnd5eDamageReactionFlowOptions}from'./damageReactionFlow'
import{createBountifulSpellDamageZeroOriginalRaw,type BountifulSpellDamageZeroOriginalRawLoader}from'./bountifulSpellDamageZeroOriginalRaw'
import{buildDnd5eSpellDamageZeroOriginalSource,type Dnd5eSpellDamageZeroOriginalOperation}from'./damageZeroSpellOriginalOperation'
import{captureBountifulSpellDamageZeroOriginalQualification}from'./bountifulSpellDamageZeroOriginalQualification'
import{persistBountifulOriginalParent,bountifulOriginalParentReceiptId}from'./bountifulLuckPersistentHost'
import{driveBountifulOriginalParent,readBountifulOriginalSource}from'./bountifulLuckPersistentRoomDriver'
import{resolveBountifulOriginalForNormalAck}from'./bountifulLuckNormalAck'
import type{BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import type{createSpellDamageZeroSavingThrowRoomChoiceDriver}from'../../lib/spellDamageZeroSavingThrowRoomChoices'
type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
type Ports={originalRaw:NonNullable<Parameters<typeof createSpellDamageZeroSavingThrowRoomChoiceDriver>[0]['originalRaw']>;chooseAllyNaturalOne:NonNullable<Dnd5eDamageReactionFlowOptions['chooseAllyNaturalOne']>}
/** Exact native→private dice→persistent original bridge. A suspended probe is
 * abandoned only after real saved decisions are ready; the world result is then
 * recomputed by the existing normal-ACK native/Base authority. */
export function createBountifulSpellDamageZeroOriginalRoomBoundary(input:{action:SharedPlayerActionState;gateway:Gateway;loadOriginal:BountifulSpellDamageZeroOriginalRawLoader;loadOriginalParent?:BountifulSpellDamageZeroOriginalParentLoader;options:(ports:Ports)=>Dnd5eDamageReactionFlowOptions;ui:Parameters<typeof driveBountifulOriginalParent>[2];collectSavingLate?:(source:Source)=>Promise<Source>}){
 const handles=new WeakMap<Dnd5eSpellDamageZeroOriginalOperation,Awaited<ReturnType<typeof createBountifulSpellDamageZeroOriginalRaw>>>(),restarts=new WeakMap<object,Source>();let savedSource:Source|undefined
 const parent=input.action.id,mapId=input.action.mapId,guard=(source:Source)=>{if(source.prepared.action.id!==parent||source.prepared.map.id!==mapId||JSON.stringify(source.prepared.action)!==JSON.stringify(input.action))throw Error('damage-zero-room-boundary:exact-original-action-required')}
 const ports:Ports={originalRaw:{...(input.loadOriginalParent?{prepare:async(operation:Dnd5eSpellDamageZeroOriginalOperation)=>captureBountifulSpellDamageZeroOriginalPreparation(operation,input.gateway,input.loadOriginalParent!)}:{}),create:async(operation,labels)=>{const raw=await createBountifulSpellDamageZeroOriginalRaw(operation,input.gateway,input.loadOriginal,labels,input.loadOriginalParent);handles.set(operation,raw);return raw},onPrefix:async selection=>{if(handles.get(selection.operation)!==selection.handle)throw Error('damage-zero-room-boundary:actual-original-handle-required')}},chooseAllyNaturalOne:async selection=>{
  if(!selection.actualSpellDamageZeroOriginal||selection.request.kind!=='saving-throw'||selection.request.nativeLucky)throw Error('damage-zero-room-boundary:actual-primary-ally-stage-required')
  const completed=buildDnd5eSpellDamageZeroOriginalSource(selection.actualSpellDamageZeroOriginal),operation=completed.operations[0]?.operation,handle=operation&&handles.get(operation);guard(completed.source)
  if(!handle)throw Error('damage-zero-room-boundary:actual-issued-original-required')
  const bound=await captureBountifulSpellDamageZeroOriginalQualification(selection.actualSpellDamageZeroOriginal,handle);guard(bound.source)
  await persistBountifulOriginalParent({parentId:parent,source:bound.source,resolve:resolvePreparedDnd5eSpellCast,actorId:selection.request.actorId,kind:'saving-throw',spellDamageZeroOriginalQualification:bound.qualification},input.gateway)
  await driveBountifulOriginalParent({mapId,parentId:parent},input.gateway,input.ui)
  savedSource=bound.source;const restart=Object.freeze({});restarts.set(restart,bound.source);throw restart
 }}
 const options=()=>input.options(ports)
 const settleSaved=async(source:Source)=>{const next=input.collectSavingLate?await input.collectSavingLate(source):source;guard(next);savedSource=next;return resolveBountifulOriginalForNormalAck({action:input.action,source:next,resolve:resolvePreparedDnd5eSpellCast,options:options()},input.gateway)}
 return{ports,async resolve(source:Source){guard(source)
   const combat=await input.gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(parent,0)]
   if(first){if(first.originalAdapterId!=='spell'||first.originalCheckpoint?.kind!=='saving-throw')throw Error('damage-zero-room-boundary:wrong-original-family');await driveBountifulOriginalParent({mapId,parentId:parent},input.gateway,input.ui);const original=await readBountifulOriginalSource(first,{includeContinuation:true});if(original.resolve!==resolvePreparedDnd5eSpellCast||!Object.hasOwn(original.source,'hostDamageZeroSavingThrows'))throw Error('damage-zero-room-boundary:actual-saved-zero-source-required');const recovered=original.source as Source;guard(recovered);savedSource=recovered;return settleSaved(recovered)}
   try{return await resolveDnd5ePreparedWithMaterialDamageReactions(options(),source,resolvePreparedDnd5eSpellCast)}catch(error){const recovery=error&&typeof error==='object'?restarts.get(error):undefined;if(!recovery)throw error;return settleSaved(recovery)}
  },readSavedSource(){return savedSource?cloneDnd5eHostTransactionInput(savedSource):undefined}}
}
