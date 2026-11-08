
import{readBountifulSpellDamageZeroCollectedSavingLate,readBountifulSpellDamageZeroSavingLateCheckpoint,type BountifulSpellDamageZeroCollectedSavingLate}from'./bountifulSpellDamageZeroSavingLateCheckpoint'
import{readBountifulSpellDamageZeroSavingLateDiceHandle}from'./bountifulSpellDamageZeroSavingLateDice'
import{readBountifulOriginalSource}from'./bountifulLuckPersistentRoomDriver'
import{recordBountifulOriginalAfterDice}from'./bountifulLuckNormalAck'
import{bountifulSpellDamageZeroBonusChoicesAppend}from'./bountifulSpellDamageZeroSavingLateSource'
import{bountifulOriginalParentReceiptId}from'./bountifulLuckPersistentHost'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{captureSecondChancePreparedHostFacts}from'../../pages/maps/secondChancePreparedHostFacts'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import type{BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
type Gateway=Pick<SharedRoomGatewayPort,'publishEvent'|'loadResource'|'saveResourcesAtomically'>
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
/** The collected object alone never permits a continuation. The actual Ready
 * checkpoint, exact private late pool and completed server stamp all participate;
 * the existing native replay and metadata CAS then revalidate the full input. */
export async function persistBountifulSpellDamageZeroSavingLate(input:{action:SharedPlayerActionState;collected:BountifulSpellDamageZeroCollectedSavingLate;dice:object;authorityUnchanged:()=>boolean},gateway:Gateway):Promise<Source>{
 const collected=readBountifulSpellDamageZeroCollectedSavingLate(input.collected),handle=await readBountifulSpellDamageZeroSavingLateDiceHandle(input.dice),native=readBountifulSpellDamageZeroSavingLateCheckpoint(handle.checkpoint),{choice,...facts}=collected;if(!same(facts,native)||!input.authorityUnchanged()||!same(input.action,native.source.prepared.action))throw Error('spell-zero-save-late:actual-same-parent-collected-required')
 const combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)];if(!first||first.consumed||first.originalAdapterId!=='spell'||first.originalCheckpoint?.kind!=='saving-throw'||!first.rawIssuer?.rollId.startsWith('bountiful-spell-damage-zero-original:'))throw Error('spell-zero-save-late:private-original-family-required')
 const original=await readBountifulOriginalSource(first);if(original.resolve!==resolvePreparedDnd5eSpellCast)throw Error('spell-zero-save-late:canonical-spell-required');const source=original.source as Source;
 if(same({...choice,legendaryResistance:choice.legendaryResistance??false},{...native.prefix,legendaryResistance:native.prefix.legendaryResistance??false}))return cloneDnd5eHostTransactionInput(source)
 const candidate={...cloneDnd5eHostTransactionInput(source),hostDamageZeroSavingThrows:native.source.hostDamageZeroSavingThrows.map((record,index)=>index===0?{...record,choice:structuredClone(choice)}:record)};
 if(!bountifulSpellDamageZeroBonusChoicesAppend(Object.getOwnPropertyDescriptor(source,'hostDamageZeroSavingThrows')?.value,candidate.hostDamageZeroSavingThrows))throw Error('spell-zero-save-late:only-collected-bonus-append-supported')
 const late=handle.book.savingLate,expected=[...(choice.bardicInspirationRoll!==undefined?[{purpose:'bardic-inspiration',value:choice.bardicInspirationRoll,effectId:undefined}]:[]),...(choice.optionalBonusDice??[]).map(use=>({purpose:'optional-bonus',effectId:use.effectId,value:use.roll}))];if(!late?.complete||late.slots.length!==expected.length||late.slots.some((slot,index)=>slot.purpose!==expected[index]?.purpose||slot.effectId!==expected[index]?.effectId||slot.count!==1||!slot.raw||!slot.confirmed||!same(slot.confirmed.values,[expected[index]?.value])))throw Error('spell-zero-save-late:completed-confirmed-input-required')
 if(!input.authorityUnchanged())throw Error('spell-zero-save-late:changed-original-authority');const identity={parentId:input.action.id,mapId:input.action.mapId,combatId:native.source.prepared.state.combatId},wire=encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(candidate));await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{sourceKind:'spell-damage-zero-saving-late-v1',phase:'append',...identity,source:wire});
 await recordBountifulOriginalAfterDice({action:input.action,source:candidate,resolve:resolvePreparedDnd5eSpellCast,authorityUnchanged:input.authorityUnchanged},gateway);return candidate
}
