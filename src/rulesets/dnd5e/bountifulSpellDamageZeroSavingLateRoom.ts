
import{createDnd5eOriginalD20Session}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{dnd5eActiveOptionalBonusDice}from'./activeEffects'
import{dnd5eHeldBardicInspirationDie}from'./headlessCombatEngine'
import{readBountifulOriginalSource}from'./bountifulLuckPersistentRoomDriver'
import{bountifulOriginalParentReceiptId}from'./bountifulLuckPersistentHost'
import{bountifulPreparedReplayFacts,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{captureBountifulSpellDamageZeroSavingLateCheckpoint,collectBountifulSpellDamageZeroSavingLate,type BountifulSpellDamageZeroSavingLateSelection,type BountifulSpellDamageZeroSavingLateCheckpoint}from'./bountifulSpellDamageZeroSavingLateCheckpoint'
import{createBountifulSpellDamageZeroSavingLateDice,type BountifulSpellDamageZeroSavingLateLoader}from'./bountifulSpellDamageZeroSavingLateDice'
import{persistBountifulSpellDamageZeroSavingLate}from'./bountifulSpellDamageZeroSavingLateContinuation'
import{bountifulSpellDamageZeroBonusChoicesAppend}from'./bountifulSpellDamageZeroSavingLateSource'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
export type BountifulSpellDamageZeroSavingLateRoomSelection=BountifulSpellDamageZeroSavingLateSelection&{checkpoint:BountifulSpellDamageZeroSavingLateCheckpoint;dice:Awaited<ReturnType<typeof createBountifulSpellDamageZeroSavingLateDice>>}
type Choice=BountifulSpellDamageZeroSavingLateSelection['prefix']
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
export async function collectBountifulSpellDamageZeroSavingLateOnRoom(input:{action:SharedPlayerActionState;source:Source;loadOriginal:BountifulSpellDamageZeroSavingLateLoader;collect:(selection:BountifulSpellDamageZeroSavingLateRoomSelection)=>Promise<Choice>;authorityUnchanged:()=>boolean},gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>):Promise<Source>{
 // Preserve the old no-held-die path without issuing a new pool or authority.
 const target=input.source.prepared.state.combatants[input.source.prepared.targetToken.id];if(dnd5eHeldBardicInspirationDie(target)===undefined&&!dnd5eActiveOptionalBonusDice(target.classState.activeEffects,'saving-throw').some(e=>!e.modifiers?.optionalBonusDie?.boundTargetSource))return input.source
 const combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),parents=combat?.bountifulOriginalParents,first=parents?.[bountifulOriginalParentReceiptId(input.action.id,0)];if(!first||first.consumed||!input.authorityUnchanged())throw Error('damage-zero-save-late-room:current-private-parent-required')
 const original=await readBountifulOriginalSource(first),stored=await readBountifulOriginalSource(first,{includeContinuation:true});if(original.resolve!==resolvePreparedDnd5eSpellCast||stored.resolve!==resolvePreparedDnd5eSpellCast||!same(input.source,stored.source))throw Error('damage-zero-save-late-room:exact-saved-input-required')
 const existing=Object.getOwnPropertyDescriptor(stored.source,'hostDamageZeroSavingThrows')?.value as unknown;
 if(first.continuation&&bountifulSpellDamageZeroBonusChoicesAppend(Object.getOwnPropertyDescriptor(original.source,'hostDamageZeroSavingThrows')?.value,existing)){
  const book=await input.loadOriginal({parentId:input.action.id,mapId:input.action.mapId,combatId:input.source.prepared.state.combatId}),choice=(existing as readonly{choice?:Choice}[])[0]?.choice,expected=[...(choice?.bardicInspirationRoll!==undefined?[{purpose:'bardic-inspiration',value:choice.bardicInspirationRoll,effectId:undefined}]:[]),...(choice?.optionalBonusDice??[]).map(use=>({purpose:'optional-bonus',effectId:use.effectId,value:use.roll}))];if(!book.savingLate?.complete||book.savingLate.slots.length!==expected.length||book.savingLate.slots.some((slot,index)=>slot.purpose!==expected[index]?.purpose||slot.effectId!==expected[index]?.effectId||!same(slot.confirmed?.values,[expected[index]?.value]))||!input.authorityUnchanged())throw Error('damage-zero-save-late-room:confirmed-saved-input-required');return stored.source as Source
 }
 const receipts=Object.values(parents!).filter(row=>row.identity.parentId===input.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence),source={...input.source,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source:input.source,receipts})},session=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eSpellCast,first.request.actorId,'saving-throw');
 try{const ready=session.run(source.prepared.state);if(ready.status!=='original-d20-ready')throw Error('damage-zero-save-late-room:actual-saving-ready-required');const checkpoint=captureBountifulSpellDamageZeroSavingLateCheckpoint(ready),dice=await createBountifulSpellDamageZeroSavingLateDice(checkpoint,gateway,input.loadOriginal),collected=await collectBountifulSpellDamageZeroSavingLate(checkpoint,selection=>input.collect({...selection,checkpoint,dice}));await dice.finish();return persistBountifulSpellDamageZeroSavingLate({action:input.action,collected,dice,authorityUnchanged:input.authorityUnchanged},gateway)}finally{session.cancel()}
}
