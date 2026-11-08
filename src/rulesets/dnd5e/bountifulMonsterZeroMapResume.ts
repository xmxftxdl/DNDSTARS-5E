import{getRoomSession}from'../../lib/roomSession'
import type{EnemyTurnResult}from'../../lib/enemyAi'
import{decodeSecondChanceParentWire,encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{restoreBountifulMonsterDamageZeroOriginalParent,type BountifulMonsterDamageZeroOriginalParentLoader}from'./bountifulMonsterDamageZeroOriginalPreparation'
import{readDnd5eMonsterDamageZeroOriginalOperation,type Dnd5eMonsterDamageZeroOriginalOperation}from'./damageZeroMonsterOriginalOperation'
import type{resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
type Source=Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]
type Identity={parentId:string;mapId:string;combatId:string}
const issued=new WeakMap<object,{roomId:string;memberId:string;identity:Identity;operation:Dnd5eMonsterDamageZeroOriginalOperation;source:Source;signature:string;sourceSignature:string}>()
/** The input is an identity discovered by the authenticated private reader.
 * Plain saved inputs are replayed by Native before a local resume intent exists.
 * It is never a statblock attack-natural1 capability or a Shared action. */
export async function prepareBountifulMonsterZeroMapResume(identity:Identity,load:BountifulMonsterDamageZeroOriginalParentLoader){
 const host=getRoomSession();if(host?.role!=='dm'||!host.roomId||!host.memberId)throw Error('monster-zero-resume:actual-host-required')
 const restored=await restoreBountifulMonsterDamageZeroOriginalParent(identity,load)
 try{
  const source=decodeSecondChanceParentWire(restored.parent.source)as Source,prepared=source.prepared,actions=prepared.resourceKind==='bonus-action'?prepared.monster.bonusActions:prepared.resourceKind==='legendary-action'?prepared.monster.legendaryActions:prepared.monster.actions,actionIndex=actions?.findIndex(action=>action.id===prepared.resourceAction.id)
  if(source.transactionId!==identity.parentId||actionIndex===undefined||actionIndex<0||prepared.attacks.length!==1||source.rolls.length!==1)throw Error('monster-zero-resume:actual-single-original-required')
  const result:EnemyTurnResult={moved:false,attacked:true,attackerTokenId:prepared.actorToken.id,targetTokenId:prepared.targetToken.id,actionIndex,monsterResourceKind:prepared.resourceKind,manualAttackRollMode:source.rolls[0].mode,attackTargetTokenIds:prepared.attacks.map(attack=>attack.targetToken.id),readiedAttack:prepared.readiedAttack,randomTargetTransactionId:identity.parentId,message:`继续 ${prepared.actorToken.label} 的原豁免。`,...(source.multiattackContinuation?{multiattackStep:{mode:'continue',parentActionId:source.multiattackContinuation.parentActionId,occurrenceIndex:source.multiattackContinuation.occurrenceIndex}}:source.settleAttackCount===1?{multiattackStep:{mode:'start',parentActionId:prepared.resourceAction.id,occurrenceIndex:0}}:{})}
  issued.set(result,{roomId:host.roomId,memberId:host.memberId,identity:{...identity},operation:restored.operation,source,signature:JSON.stringify(result),sourceSignature:JSON.stringify(restored.parent.source)});return result
 }finally{restored.dispose()}
}
export function readBountifulMonsterZeroMapResume(result:EnemyTurnResult){
 const proof=issued.get(result);if(!proof)return undefined
 const host=getRoomSession(),native=readDnd5eMonsterDamageZeroOriginalOperation(proof.operation)
 if(host?.role!=='dm'||host.roomId!==proof.roomId||host.memberId!==proof.memberId||JSON.stringify(result)!==proof.signature||native.parentId!==proof.identity.parentId||JSON.stringify(encodeSecondChanceParentWire(proof.source))!==proof.sourceSignature)throw Error('monster-zero-resume:changed-actual-intent')
 return{...proof.identity,operation:proof.operation,source:cloneDnd5eHostTransactionInput(proof.source)}
}
