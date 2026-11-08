import{getRoomSession}from'../../lib/roomSession'
import{readOptionalDnd5eActualDamageZeroOriginalBoundary}from'./damageCommitSession'
import{resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
import{readDnd5eMonsterDamageZeroOriginalContext}from'./monsterDamageZeroOriginalContext'
import{captureDnd5eMonsterDamageZeroOriginalOperation}from'./damageZeroMonsterOriginalOperation'
/** Optional Flow bridge only for the already issued private outer family.
 * Ordinary, non-Host and other native parents retain their previous ports. */
export function captureOptionalBountifulMonsterZeroFlowOperation(result:object){
 const host=getRoomSession();if(host?.role!=='dm'||!host.roomId||!host.memberId)return undefined
 const boundary=readOptionalDnd5eActualDamageZeroOriginalBoundary(result)
 if(!boundary||boundary.resolve!==resolvePreparedDnd5eMonsterAttack||!readDnd5eMonsterDamageZeroOriginalContext(boundary.input))return undefined
 return captureDnd5eMonsterDamageZeroOriginalOperation(result)
}
