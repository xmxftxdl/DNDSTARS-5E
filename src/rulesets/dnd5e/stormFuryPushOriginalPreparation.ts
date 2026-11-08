import{readStormFuryMovePrefixPlainSource}from'./opportunityMoveSequence'
import{readStormFuryMovePlainOriginalSource}from'./bountifulOpportunitySequencePostNativeReplay'
import{resolveDnd5eOpportunityMoveSequenceOriginal}from'./opportunityMoveSequence'
import{readStormFuryOriginalFamily,readStormFuryOriginalParentId}from'./stormFuryWeaponOriginalOrigin'
import{resolvePreparedDnd5eEquipmentAttack}from'./equipmentAttackAction'
import{resolvePreparedDnd5eOpportunityAttack}from'./opportunityAttackAction'
import{readDnd5eStormFuryOriginalOperation,type Dnd5eStormFuryOriginalOperation}from'./damageCommitSession'
import{resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{captureSecondChancePreparedHostFacts}from'../../pages/maps/secondChancePreparedHostFacts'
/** Only the actual failed-save Native phase can describe this optional push.
 * No caller success flag, source DTO or coordinate registers an operation. */
export function captureStormFuryPushOriginalPreparation(operation:Dnd5eStormFuryOriginalOperation){
 const native=readDnd5eStormFuryOriginalOperation(operation)
 if(native.result.status!=='pending-storm-fury-push')throw Error('storm-fury-push:actual-failed-saving-phase-required')
 const input=native.input as Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]|Parameters<typeof resolvePreparedDnd5eSpellCast>[0]|Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]|Parameters<typeof resolvePreparedDnd5eOpportunityAttack>[0]|Parameters<typeof resolveDnd5eOpportunityMoveSequenceOriginal>[0],pending=native.result,parentId=pending.parentId,family=readStormFuryOriginalFamily(operation)
 if(!family||readStormFuryOriginalParentId(operation)!==parentId||(family==='spell'||family==='equipment')&&('action'in input.prepared?input.prepared.action.id:undefined)!==parentId)throw Error('storm-fury-push:canonical-original-required')
 return{sourceKind:'storm-fury-push-v1' as const,phase:'prepare' as const,parentId,mapId:input.prepared.map.id,combatId:input.prepared.state.combatId,frameIndex:pending.request.frame.index,family,source:encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(family==='opportunity-move'?readStormFuryMovePlainOriginalSource(readStormFuryMovePrefixPlainSource(input)):input)),request:pending.request,prefixSignature:JSON.stringify(pending.snapshot),effectTimestamp:pending.effectTimestamp}
}
