import{readStormFuryMovePrefixPlainSource}from'./opportunityMoveSequence'
import{readStormFuryMovePlainOriginalSource}from'./bountifulOpportunitySequencePostNativeReplay'
import{resolveDnd5eOpportunityMoveSequenceOriginal}from'./opportunityMoveSequence'
import{readStormFuryOriginalFamily,readStormFuryOriginalParentId}from'./stormFuryWeaponOriginalOrigin'
import{resolvePreparedDnd5eEquipmentAttack}from'./equipmentAttackAction'
import{resolvePreparedDnd5eOpportunityAttack}from'./opportunityAttackAction'
import{readDnd5eStormFuryOriginalOperation,type Dnd5eStormFuryOriginalOperation}from'./damageCommitSession'
import{resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{dnd5eCombatantHasConcentrationEffect}from'./headlessCombatEngine'
import{dnd5eSavingThrowMode}from'./passiveDefenses'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{captureSecondChancePreparedHostFacts}from'../../pages/maps/secondChancePreparedHostFacts'
import type{StormFurySavingThrow}from'./stormFuryHitCheckpoint'
/** Describes the true mandatory STR frontier after Native has spent the Fury
 * reaction and applied its fixed damage. This is plain data, not a raw grant. */
export function captureStormFurySavingOriginalPreparation(operation:Dnd5eStormFuryOriginalOperation){
 const native=readDnd5eStormFuryOriginalOperation(operation)
 if(native.result.status!=='pending-storm-fury-saving')throw Error('storm-fury-saving:actual-mandatory-saving-phase-required')
 const input=native.input as Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]|Parameters<typeof resolvePreparedDnd5eSpellCast>[0]|Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]|Parameters<typeof resolvePreparedDnd5eOpportunityAttack>[0]|Parameters<typeof resolveDnd5eOpportunityMoveSequenceOriginal>[0],pending=native.result,parentId=pending.parentId,option=pending.request.frame.options.find(o=>o.featureId===pending.request.featureId)
 const family=readStormFuryOriginalFamily(operation)
 if(!option||!family||readStormFuryOriginalParentId(operation)!==parentId||(family==='spell'||family==='equipment')&&('action'in input.prepared?input.prepared.action.id:undefined)!==parentId)throw Error('storm-fury-saving:canonical-original-required')
 const snapshot=pending.snapshot,attacker=snapshot.combatants[option.attackerId],owner=snapshot.combatants[option.ownerId]
 if(!attacker||!owner||owner.turn.reactionAvailable)throw Error('storm-fury-saving:actual-post-reaction-prefix-required')
 return{sourceKind:'storm-fury-saving-v1' as const,phase:'prepare' as const,parentId,mapId:input.prepared.map.id,combatId:input.prepared.state.combatId,frameIndex:pending.request.frame.index,family,source:encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(family==='opportunity-move'?readStormFuryMovePlainOriginalSource(readStormFuryMovePrefixPlainSource(input)):input)),request:pending.request,prefixSignature:JSON.stringify(snapshot),effectTimestamp:pending.effectTimestamp,mode:dnd5eSavingThrowMode(attacker,'str',{sourceActorId:owner.id,sourceCreatureType:owner.creatureType,sourceIsMagical:false}),blessed:dnd5eCombatantHasConcentrationEffect(snapshot,attacker.id,'bless'),baned:dnd5eCombatantHasConcentrationEffect(snapshot,attacker.id,'bane')}
}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const closed=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>record(v)&&Object.keys(v).every(k=>keys.includes(k))
/** A private authenticated HTTP reply must still match the current genuine
 * Native frontier. Caller-supplied clocks, modes and frames cannot replace it. */
export function readStormFurySavingOriginalReply(operation:Dnd5eStormFuryOriginalOperation,reply:unknown):StormFurySavingThrow{
 const current=captureStormFurySavingOriginalPreparation(operation)
 if(!closed(reply,['ok','request','prefixSignature','effectTimestamp','mode','blessed','baned','roll','components'])||reply.ok!==true||JSON.stringify(reply.request)!==JSON.stringify(current.request)||reply.prefixSignature!==current.prefixSignature||reply.effectTimestamp!==current.effectTimestamp||reply.mode!==current.mode||reply.blessed!==current.blessed||reply.baned!==current.baned||!closed(reply.roll,['d20','d20Second','blessRoll','baneRoll'])||!Array.isArray(reply.components))throw Error('storm-fury-saving:exact-current-native-reply-required')
 const expected=[{key:'original',count:current.mode==='normal'?1:2,sides:20},...(current.blessed?[{key:'bless',count:1,sides:4}]:[]),...(current.baned?[{key:'bane',count:1,sides:4}]:[])]
 if(reply.components.length!==expected.length)throw Error('storm-fury-saving:exact-original-components-required')
 const rolls:Record<string,number[]>={}
 for(const[at,spec]of expected.entries()){
  const row:unknown=reply.components[at],requestId='storm-fury-saving:'+JSON.stringify([current.parentId,current.frameIndex,current.request.featureId,spec.key]),faces=(v:unknown):v is number[]=>Array.isArray(v)&&v.length===spec.count&&v.every(n=>Number.isInteger(n)&&n>=1&&n<=spec.sides)
  if(!closed(row,['key','count','sides','requestId','physical','adopted','memberId','adoptedBy'])||row.key!==spec.key||row.count!==spec.count||row.sides!==spec.sides||row.requestId!==requestId||!faces(row.physical)||!faces(row.adopted)||typeof row.memberId!=='string'||!row.memberId||typeof row.adoptedBy!=='string'||!row.adoptedBy)throw Error('storm-fury-saving:exact-original-components-required')
  rolls[spec.key]=row.adopted
 }
 const roll={d20:rolls.original[0],...(current.mode!=='normal'?{d20Second:rolls.original[1]}:{}),...(current.blessed?{blessRoll:rolls.bless[0]}:{}),...(current.baned?{baneRoll:rolls.bane[0]}:{})}
 if(JSON.stringify(reply.roll)!==JSON.stringify(roll))throw Error('storm-fury-saving:exact-host-adoption-required')
 return roll
}
