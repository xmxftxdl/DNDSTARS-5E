import{readStormFuryMovePrefixPlainSource}from'./opportunityMoveSequence'
import{readStormFuryMovePlainOriginalSource}from'./bountifulOpportunitySequencePostNativeReplay'
import{resolveDnd5eOpportunityMoveSequenceOriginal}from'./opportunityMoveSequence'
import{readStormFuryOriginalFamily,readStormFuryOriginalParentId,readStormFuryHostEquipmentOriginal}from'./stormFuryWeaponOriginalOrigin'
import{resolvePreparedDnd5eEquipmentAttack}from'./equipmentAttackAction'
import{resolvePreparedDnd5eOpportunityAttack}from'./opportunityAttackAction'
import{readDnd5eStormFuryOriginalOperation,type Dnd5eStormFuryOriginalOperation}from'./damageCommitSession'
import{resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{captureSecondChancePreparedHostFacts}from'../../pages/maps/secondChancePreparedHostFacts'
/** Plain original data only. The operation remains live and private; this DTO
 * cannot be used as a Native operation, owner answer, raw issuer or commit. */
export function captureStormFuryOriginalPreparation(operation:Dnd5eStormFuryOriginalOperation){
 const native=readDnd5eStormFuryOriginalOperation(operation)
 if(native.result.status!=='pending-storm-fury-owner')throw Error('storm-fury-preparation:actual-owner-phase-required')
 const input=native.input as Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]|Parameters<typeof resolvePreparedDnd5eSpellCast>[0]|Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]|Parameters<typeof resolvePreparedDnd5eOpportunityAttack>[0]|Parameters<typeof resolveDnd5eOpportunityMoveSequenceOriginal>[0],parentId=native.result.parentId
 const family=readStormFuryOriginalFamily(operation)
 if(readStormFuryOriginalParentId(operation)!==parentId)throw Error('storm-fury-preparation:exact-original-transaction-required')
 if(!family||(family==='spell'||family==='equipment')&&('action'in input.prepared?input.prepared.action.id:undefined)!==parentId)throw Error('storm-fury-preparation:canonical-original-required')
 const source=encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(family==='opportunity-move'?readStormFuryMovePlainOriginalSource(readStormFuryMovePrefixPlainSource(input)):input)),frame=native.result.frame
 return{sourceKind:'storm-fury-original-v1' as const,phase:'prepare' as const,parentId,mapId:input.prepared.map.id,combatId:input.prepared.state.combatId,frameIndex:frame.index,family,source,frame,prefixSignature:JSON.stringify(native.result.snapshot),effectTimestamp:native.result.effectTimestamp,...(family==='equipment'&&readStormFuryHostEquipmentOriginal(operation)?{hostEquipmentOrigin:readStormFuryHostEquipmentOriginal(operation)}:{})}
}
