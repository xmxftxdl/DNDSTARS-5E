import{readDnd5eMonsterDamageZeroOriginalOperation}from'./damageZeroMonsterOriginalOperation'
type Current={mapId?:string;combatId?:string;parentId?:string|null;round:number;initiativeIndex:number}
/** A render deferral only. Only the actual still-current Native operation can
 * suspend a background save; this grants no result or publication permission. */
export function bountifulMonsterZeroCombatRenderPending(operation:object|null|undefined,current:Current){
 if(operation==null)return false
 const actual=readDnd5eMonsterDamageZeroOriginalOperation(operation as Parameters<typeof readDnd5eMonsterDamageZeroOriginalOperation>[0]),source=actual.source,prepared=source.prepared
 return source.transactionId===current.parentId&&prepared.map.id===current.mapId&&prepared.state.combatId===current.combatId&&prepared.state.round===current.round&&prepared.state.initiativeIndex===current.initiativeIndex
}
