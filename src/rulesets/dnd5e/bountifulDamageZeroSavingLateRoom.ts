
import{createDnd5eOriginalD20Session}from'./damageCommitSession'
import{resolvePreparedDnd5eEquipmentAttack}from'./equipmentAttackAction'
import{dnd5eHeldBardicInspirationDie}from'./headlessCombatEngine'
import{readBountifulOriginalSource}from'./bountifulLuckPersistentRoomDriver'
import{bountifulOriginalParentReceiptId}from'./bountifulLuckPersistentHost'
import{bountifulPreparedReplayFacts,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{captureBountifulDamageZeroSavingLateCheckpoint,collectBountifulDamageZeroSavingLate,type BountifulDamageZeroSavingLateSelection,type BountifulDamageZeroSavingLateCheckpoint}from'./bountifulDamageZeroSavingLateCheckpoint'
import{createBountifulDamageZeroSavingLateDice,type BountifulDamageZeroSavingLateLoader}from'./bountifulDamageZeroSavingLateDice'
import{persistBountifulDamageZeroSavingLate}from'./bountifulDamageZeroSavingLateContinuation'
import{bountifulDamageZeroBardicChoicesAppend}from'./bountifulDamageZeroSavingLateSource'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
type Source=Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]
export type BountifulDamageZeroSavingLateRoomSelection=BountifulDamageZeroSavingLateSelection&{checkpoint:BountifulDamageZeroSavingLateCheckpoint;dice:Awaited<ReturnType<typeof createBountifulDamageZeroSavingLateDice>>}
type Choice=BountifulDamageZeroSavingLateSelection['prefix']
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
export async function collectBountifulDamageZeroSavingLateOnRoom(input:{action:SharedPlayerActionState;source:Source;loadOriginal:BountifulDamageZeroSavingLateLoader;collect:(selection:BountifulDamageZeroSavingLateRoomSelection)=>Promise<Choice>;authorityUnchanged:()=>boolean},gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>):Promise<Source>{
 // Preserve the old no-held-die path without issuing a new pool or authority.
 const target=input.source.prepared.state.combatants[input.source.prepared.targetToken.id];if(dnd5eHeldBardicInspirationDie(target)===undefined)return input.source
 const combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),parents=combat?.bountifulOriginalParents,first=parents?.[bountifulOriginalParentReceiptId(input.action.id,0)];if(!first||first.consumed||!input.authorityUnchanged())throw Error('damage-zero-save-late-room:current-private-parent-required')
 const original=await readBountifulOriginalSource(first),stored=await readBountifulOriginalSource(first,{includeContinuation:true});if(original.resolve!==resolvePreparedDnd5eEquipmentAttack||stored.resolve!==resolvePreparedDnd5eEquipmentAttack||!same(input.source,stored.source))throw Error('damage-zero-save-late-room:exact-saved-input-required')
 const existing=Object.getOwnPropertyDescriptor(stored.source,'hostDamageZeroSavingThrows')?.value as unknown;
 if(first.continuation&&bountifulDamageZeroBardicChoicesAppend(Object.getOwnPropertyDescriptor(original.source,'hostDamageZeroSavingThrows')?.value,existing)){
  const book=await input.loadOriginal({parentId:input.action.id,mapId:input.action.mapId,combatId:input.source.prepared.state.combatId}),slot=book.savingLate?.slots[0],choice=(existing as readonly{choice?:Choice}[])[0]?.choice;if(!book.savingLate?.complete||book.savingLate.slots.length!==1||slot?.purpose!=='bardic-inspiration'||!same(slot.confirmed?.values,[choice?.bardicInspirationRoll])||!input.authorityUnchanged())throw Error('damage-zero-save-late-room:confirmed-saved-input-required');return stored.source as Source
 }
 const receipts=Object.values(parents!).filter(row=>row.identity.parentId===input.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence),source={...input.source,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source:input.source,receipts})},session=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eEquipmentAttack,first.request.actorId,'saving-throw');
 try{const ready=session.run(source.prepared.state);if(ready.status!=='original-d20-ready')throw Error('damage-zero-save-late-room:actual-saving-ready-required');const checkpoint=captureBountifulDamageZeroSavingLateCheckpoint(ready),dice=await createBountifulDamageZeroSavingLateDice(checkpoint,gateway,input.loadOriginal),collected=await collectBountifulDamageZeroSavingLate(checkpoint,selection=>input.collect({...selection,checkpoint,dice}));await dice.finish();return persistBountifulDamageZeroSavingLate({action:input.action,collected,dice,authorityUnchanged:input.authorityUnchanged},gateway)}finally{session.cancel()}
}
