
import{readBountifulDamageZeroCollectedSavingLate,readBountifulDamageZeroSavingLateCheckpoint,type BountifulDamageZeroCollectedSavingLate}from'./bountifulDamageZeroSavingLateCheckpoint'
import{readBountifulDamageZeroSavingLateDiceHandle}from'./bountifulDamageZeroSavingLateDice'
import{readBountifulOriginalSource}from'./bountifulLuckPersistentRoomDriver'
import{recordBountifulOriginalAfterDice}from'./bountifulLuckNormalAck'
import{bountifulDamageZeroBardicChoicesAppend}from'./bountifulDamageZeroSavingLateSource'
import{bountifulOriginalParentReceiptId}from'./bountifulLuckPersistentHost'
import{resolvePreparedDnd5eEquipmentAttack}from'./equipmentAttackAction'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{captureSecondChancePreparedHostFacts}from'../../pages/maps/secondChancePreparedHostFacts'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import type{BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
type Source=Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]
type Gateway=Pick<SharedRoomGatewayPort,'publishEvent'|'loadResource'|'saveResourcesAtomically'>
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
/** The collected object alone never permits a continuation. The actual Ready
 * checkpoint, exact private late pool and completed server stamp all participate;
 * the existing native replay and metadata CAS then revalidate the full input. */
export async function persistBountifulDamageZeroSavingLate(input:{action:SharedPlayerActionState;collected:BountifulDamageZeroCollectedSavingLate;dice:object;authorityUnchanged:()=>boolean},gateway:Gateway):Promise<Source>{
 const collected=readBountifulDamageZeroCollectedSavingLate(input.collected),handle=await readBountifulDamageZeroSavingLateDiceHandle(input.dice),native=readBountifulDamageZeroSavingLateCheckpoint(handle.checkpoint),{choice,...facts}=collected;if(!same(facts,native)||!input.authorityUnchanged()||!same(input.action,native.source.prepared.action))throw Error('damage-zero-save-late:actual-same-parent-collected-required')
 const combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)];if(!first||first.consumed||first.originalAdapterId!=='equipment'||first.originalCheckpoint?.kind!=='saving-throw'||!first.rawIssuer?.rollId.startsWith('bountiful-damage-zero-original:'))throw Error('damage-zero-save-late:private-original-family-required')
 const original=await readBountifulOriginalSource(first);if(original.resolve!==resolvePreparedDnd5eEquipmentAttack)throw Error('damage-zero-save-late:canonical-equipment-required');const source=original.source as Source;
 if(same({...choice,legendaryResistance:choice.legendaryResistance??false},{...native.prefix,legendaryResistance:native.prefix.legendaryResistance??false}))return cloneDnd5eHostTransactionInput(source)
 const candidate={...cloneDnd5eHostTransactionInput(source),hostDamageZeroSavingThrows:native.source.hostDamageZeroSavingThrows.map((record,index)=>index===0?{...record,choice:structuredClone(choice)}:record)};
 if(!bountifulDamageZeroBardicChoicesAppend(Object.getOwnPropertyDescriptor(source,'hostDamageZeroSavingThrows')?.value,candidate.hostDamageZeroSavingThrows))throw Error('damage-zero-save-late:only-collected-bardic-append-supported')
 const late=handle.book.savingLate,slot=late?.slots[0];if(!late?.complete||late.slots.length!==1||slot?.purpose!=='bardic-inspiration'||slot.count!==1||!slot.raw||!slot.confirmed||!same(slot.confirmed.values,[choice.bardicInspirationRoll]))throw Error('damage-zero-save-late:completed-confirmed-input-required')
 if(!input.authorityUnchanged())throw Error('damage-zero-save-late:changed-original-authority');const identity={parentId:input.action.id,mapId:input.action.mapId,combatId:native.source.prepared.state.combatId},wire=encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(candidate));await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{sourceKind:'damage-zero-saving-late-v1',phase:'append',...identity,source:wire});
 await recordBountifulOriginalAfterDice({action:input.action,source:candidate,resolve:resolvePreparedDnd5eEquipmentAttack,authorityUnchanged:input.authorityUnchanged},gateway);return candidate
}
