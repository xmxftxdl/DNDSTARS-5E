import type {EnemyTurnResult} from '../../lib/enemyAi'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {recoverBountifulHostOperation} from './bountifulHostOperationPersistent'
import {bountifulIssuedHostOperation,encodeBountifulHostOperation,type BountifulHostOperationCapability} from './bountifulHostOperation'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'

interface Resume {hasAfterDice:boolean;capability:BountifulHostOperationCapability;signature:string}
const issued=new WeakMap<EnemyTurnResult,Resume>()
/** A native reload resumes the genuine frozen operation. It does not fabricate
 * a SharedPlayerAction or obtain authority from a serialized EnemyTurnResult. */
export async function prepareBountifulNativeMapResume(parentId:string,gateway:Pick<SharedRoomGatewayPort,'loadResource'>){
 const capability=await recoverBountifulHostOperation(parentId,gateway,{includeDamage:true})
 const {source,operation}=bountifulIssuedHostOperation(capability),prepared=source.prepared
 const combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,import('./bountifulLuckReceipt').BountifulOriginalDieReceipt>}>('combat')
 const row=combat?.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',parentId,0])]
 if(!row||row.consumed||JSON.stringify(row.continuation?.source??row.originalParent)!==JSON.stringify(encodeBountifulHostOperation(capability)))throw Error('bountiful-native-resume:stale-issued-source')
 const actions=prepared.resourceKind==='bonus-action'?prepared.monster.bonusActions:prepared.resourceKind==='legendary-action'?prepared.monster.legendaryActions:prepared.monster.actions
 const actionIndex=actions?.findIndex(action=>action.id===prepared.resourceAction.id)
 if(actionIndex==null||actionIndex<0)throw Error('bountiful-native-resume:original-action-unavailable')
 const result:EnemyTurnResult={moved:false,attacked:true,attackerTokenId:operation.actorTokenId,targetTokenId:operation.targetTokenId,actionIndex,monsterResourceKind:prepared.resourceKind,manualAttackRollMode:source.rolls[0]?.mode,attackTargetTokenIds:prepared.attacks.map(entry=>entry.targetToken.id),readiedAttack:prepared.readiedAttack,randomTargetTransactionId:parentId,message:`继续 ${prepared.actorToken.label} 的原攻击。`,...(source.multiattackContinuation?{multiattackStep:{mode:'continue',parentActionId:source.multiattackContinuation.parentActionId,occurrenceIndex:source.multiattackContinuation.occurrenceIndex}}:source.settleAttackCount===1?{multiattackStep:{mode:'start',parentActionId:prepared.resourceAction.id,occurrenceIndex:0}}:{})}
 issued.set(result,{hasAfterDice:!!row.continuation,capability,signature:JSON.stringify(result)})
 return result
}

/** Only the exact locally issued intent can select the native continuation. */
export function bountifulNativeMapResumeFacts(result:EnemyTurnResult){
 const resume=issued.get(result)
 if(!resume)return undefined
 if(JSON.stringify(result)!==resume.signature)throw Error('bountiful-native-resume:changed-issued-intent')
 const facts=bountifulIssuedHostOperation(resume.capability)
 return {...facts,hasAfterDice:resume.hasAfterDice,capability:resume.capability,source:cloneDnd5eHostTransactionInput(facts.source)}
}
