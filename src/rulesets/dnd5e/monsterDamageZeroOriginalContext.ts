import{getRoomSession}from'../../lib/roomSession'
import{cloneDnd5eHostTransactionInput,registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot}from'./hostTransactionClone'
import{buildDnd5eMonsterDamageZeroOriginalSource,readDnd5eMonsterDamageZeroOriginalOperation,type Dnd5eMonsterDamageZeroOriginalOperation}from'./damageZeroMonsterOriginalOperation'
import{resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
import{readDnd5eActualOriginalReadyBoundary,readDnd5eActualDamageZeroOriginalBoundary}from'./damageCommitSession'
import{dnd5eHeldBardicInspirationDie}from'./headlessCombatEngine'
import{dnd5eCombatantSavingThrowEffectBonus}from'./concentrationDefense'
import{dnd5eConditionSavingThrowAutomaticallyFails}from'./conditions'
import{previewDnd5eSavingThrowRoll}from'./checks'
import{canBonusDieChangeFailure}from'../../lib/d20InterruptPolicy'
import{isDamageZeroSavingThrowChoice,type DamageZeroSavingThrowChoice}from'./damageZeroSavingThrowCheckpoint'
type Input=Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]
type Command={kind:'monster-damage-zero-original';version:1;parentId:string;mapId:string;combatId:string;actorTokenId:string;targetTokenId:string;actionId:string;frameId:string}
const slot=Symbol('actual-monster-zero-original-context');registerDnd5eHostReceiptSlot(slot)
const issued=new WeakMap<object,{roomId:string;hostMemberId:string;operation:Dnd5eMonsterDamageZeroOriginalOperation;sourceSignature:string;command:Command}>()
const session=()=>{const value=getRoomSession();if(value?.role!=='dm'||!value.roomId||!value.memberId)throw Error('monster-zero-context:actual-host-required');return value}
const signature=(input:unknown)=>JSON.stringify(input&&typeof input==='object'?{...input,hostOriginalD20Replay:undefined}:input)
function bind(operation:Dnd5eMonsterDamageZeroOriginalOperation,source:Input){
 const host=session(),facts=readDnd5eMonsterDamageZeroOriginalOperation(operation),plain=cloneDnd5eHostTransactionInput(source),initialCommand:Command={kind:'monster-damage-zero-original',version:1,parentId:facts.parentId,mapId:facts.source.prepared.map.id,combatId:facts.source.prepared.state.combatId,actorTokenId:facts.source.prepared.actorToken.id,targetTokenId:facts.frame.targetId,actionId:facts.frame.parentId,frameId:facts.frame.id}
 // Only this private factory calls bind, with the real initial input or with
 // choices just recorded by the actual Native Session, never a caller record.
 const prior=Object.getOwnPropertyDescriptor(plain.prepared,slot)?.value,old=prior===undefined?undefined:issued.get(prior),command=old?.command??initialCommand
 if(command.parentId!==facts.parentId||command.actionId!==facts.source.prepared.resourceAction.id||command.actorTokenId!==facts.frame.sourceId||command.targetTokenId!==facts.frame.targetId)throw Error('monster-zero-context:foreign-actual-phase')
 if(prior!==undefined){if(!issued.has(prior))throw Error('monster-zero-context:foreign-context');const descriptors=Object.getOwnPropertyDescriptors(plain.prepared);Reflect.deleteProperty(descriptors,slot);plain.prepared=Object.create(Object.getPrototypeOf(plain.prepared),descriptors)}
 const cap=Object.freeze(registerDnd5eHostReceipt({version:1 as const}));issued.set(cap,{roomId:host.roomId,hostMemberId:host.memberId,operation,sourceSignature:signature(plain),command});Object.defineProperty(plain.prepared,slot,{value:cap,enumerable:false})
 return{...plain,hostOriginalD20Replay:{parentId:facts.parentId,sourceKey:JSON.stringify([facts.parentId,plain.prepared.state,command,facts.effectTimestamp]),effectTimestamp:facts.effectTimestamp,facts:[]}}
}
/** A different Host transaction identity accompanies the unchanged real
 * statblock frame parent. This does not issue raw dice, receipts or a result. */
export function bindDnd5eMonsterDamageZeroOriginalContext(operation:Dnd5eMonsterDamageZeroOriginalOperation){const facts=readDnd5eMonsterDamageZeroOriginalOperation(operation);return bind(operation,facts.source)}
export function bindDnd5eMonsterDamageZeroCompletedContext(result:object){const actual=buildDnd5eMonsterDamageZeroOriginalSource(result);if(actual.operations.length!==1)throw Error('monster-zero-context:single-actual-phase-required');return bind(actual.operations[0].operation,actual.source)}
export function readDnd5eMonsterDamageZeroOriginalContext(input:unknown):{parentId:string;command:Command}|undefined{
 if(!input||typeof input!=='object'||!('prepared'in input)||!input.prepared||typeof input.prepared!=='object')return undefined
 const cap=Object.getOwnPropertyDescriptor(input.prepared,slot)?.value;if(cap===undefined)return undefined
 const host=session(),facts=issued.get(cap);if(!facts||facts.roomId!==host.roomId||facts.hostMemberId!==host.memberId)throw Error('monster-zero-context:exact-current-context-required');const operation=readDnd5eMonsterDamageZeroOriginalOperation(facts.operation)
 const replay='hostOriginalD20Replay'in input?input.hostOriginalD20Replay:undefined
 if(replay!==undefined){const value=replay as {parentId?:unknown;effectTimestamp?:unknown;sourceKey?:unknown};if(!value||typeof value!=='object'||value.parentId!==facts.command.parentId||value.effectTimestamp!==operation.effectTimestamp||value.sourceKey!==JSON.stringify([facts.command.parentId,(input.prepared as Input['prepared']).state,facts.command,operation.effectTimestamp]))throw Error('monster-zero-context:private-original-clock-required')}
 if(signature(input)!==facts.sourceSignature)throw Error('monster-zero-context:changed-actual-source')
 return{parentId:facts.command.parentId,command:structuredClone(facts.command)}
}
/** Strip only this genuinely issued private slot from a trusted source clone.
 * A forged symbol or a JSON clone cannot select this original family. */
export function stripDnd5eMonsterDamageZeroOriginalContext(input:unknown){if(!readDnd5eMonsterDamageZeroOriginalContext(input))return false;const value=input as Input,descriptors=Object.getOwnPropertyDescriptors(value.prepared);Reflect.deleteProperty(descriptors,slot);value.prepared=Object.create(Object.getPrototypeOf(value.prepared),descriptors);return true}

/** Mechanical input lineage only. The current actual OriginalReady and its
 * genuine held die permit this narrow input derivation, never raw or World.
 * Private original/late books and independent adoption remain mandatory. */
export function deriveDnd5eMonsterDamageZeroHeldSavingInput(result:object,choice:DamageZeroSavingThrowChoice){
 const ready=readDnd5eActualOriginalReadyBoundary(result),lineage=readDnd5eActualDamageZeroOriginalBoundary(result),completed=buildDnd5eMonsterDamageZeroOriginalSource(result),record=completed.operations[0],context=readDnd5eMonsterDamageZeroOriginalContext(ready.input)
 if(ready.resolve!==resolvePreparedDnd5eMonsterAttack||lineage.resolve!==resolvePreparedDnd5eMonsterAttack||ready.request.kind!=='saving-throw'||completed.operations.length!==1||!record?.choice||!context||context.parentId!==record.frame.parentId||ready.request.actorId!==record.frame.targetId||ready.snapshot.combatants[record.frame.targetId]?.currentHp!==0||JSON.stringify(record.choice.rolls)!==JSON.stringify(ready.request.originalRolls))throw Error('monster-zero-held:actual-original-ready-required')
 const original=readDnd5eMonsterDamageZeroOriginalOperation(record.operation),held=dnd5eHeldBardicInspirationDie(ready.snapshot.combatants[record.frame.targetId]),prefix=record.choice,allowed=['frameId','featureId','rolls','blessRoll','baneRoll','legendaryResistance','bardicInspirationRoll']
 if(original.effectTimestamp!==lineage.effectTimestamp||original.parentId!==context.parentId||original.prefixSignature!==record.prefixSignature||JSON.stringify(original.frame)!==JSON.stringify(record.frame)||!held||prefix.bardicInspirationRoll!==undefined||!choice||Object.keys(choice).some(key=>!allowed.includes(key))||!isDamageZeroSavingThrowChoice(record.frame,choice)||choice.legendaryResistance===true||['frameId','featureId','rolls','blessRoll','baneRoll'].some(key=>JSON.stringify(choice[key as keyof DamageZeroSavingThrowChoice])!==JSON.stringify(prefix[key as keyof typeof prefix]))||choice.bardicInspirationRoll!==undefined&&(!Number.isInteger(choice.bardicInspirationRoll)||choice.bardicInspirationRoll<1||choice.bardicInspirationRoll>held))throw Error('monster-zero-held:locked-genuine-held-input-required')
 const target=ready.snapshot.combatants[record.frame.targetId],preview=previewDnd5eSavingThrowRoll({rolls:ready.request.values,mode:record.frame.mode,modifier:record.frame.baseModifier+dnd5eCombatantSavingThrowEffectBonus(target,record.frame.ability)+(prefix.blessRoll??0)-(prefix.baneRoll??0),dc:record.frame.dc})
 if(choice.bardicInspirationRoll!==undefined&&!canBonusDieChangeFailure({success:preview.success&&!dnd5eConditionSavingThrowAutomaticallyFails(target,record.frame.ability),currentTotal:preview.roll.total,targetNumber:record.frame.dc,dieSides:held}))throw Error('monster-zero-held:actual-bardic-offer-required')
 const source=bindDnd5eMonsterDamageZeroCompletedContext(result),candidate={...cloneDnd5eHostTransactionInput(source),hostDamageZeroSavingThrows:completed.source.hostDamageZeroSavingThrows.map((row,index)=>index===0?{...row,choice:structuredClone(choice)}:row)}
 return bind(record.operation,candidate) as ReturnType<typeof bind>&Pick<typeof candidate,'hostDamageZeroSavingThrows'>
}
