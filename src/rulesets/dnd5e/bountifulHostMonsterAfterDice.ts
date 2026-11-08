import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {resolvePreparedDnd5eMonsterAttack} from './monsterAttackAction'
import {recoverBountifulHostOperation,readBountifulHostMonsterOriginalReady} from './bountifulHostOperationPersistent'
import {bountifulIssuedHostOperation} from './bountifulHostOperation'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {bountifulHostPreparedWireSignature} from '../../../shared/bountiful-host-operation.mjs'
import {bountifulMonsterAfterDiceMatches} from '../../../shared/bountiful-monster-after-dice.mjs'
import type {BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {saveBountifulPhase} from './bountifulPhaseCommit'
import {getRoomSession} from '../../lib/roomSession'

type Source=Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
/** A concrete late Monster DiceBox callback. UI preview carries the retained
 * values, while replay retains the authenticated original faces and decisions.
 * It cannot replace prepared state, raw lineage, target or the action source. */
export async function recordBountifulHostMonsterAfterDice(parentId:string,input:Source,gateway:Gateway){
 const cap=await recoverBountifulHostOperation(parentId,gateway),facts=bountifulIssuedHostOperation(cap),ready=await readBountifulHostMonsterOriginalReady(parentId,gateway)
 const source=cloneDnd5eHostTransactionInput(input),host=getRoomSession()
 if(!host||host.role!=='dm'||source.transactionId!==parentId||source.rolls.length!==1||bountifulHostPreparedWireSignature(encodeSecondChanceParentWire({prepared:{...source.prepared}}))!==bountifulHostPreparedWireSignature(encodeSecondChanceParentWire({prepared:{...facts.source.prepared}})))throw Error('bountiful-native-after-dice:changed-original-source')
 const roll=source.rolls[0],values=roll.d20Second===undefined?[roll.d20]:[roll.d20,roll.d20Second]
 if(JSON.stringify(values)!==JSON.stringify(ready.request.values))throw Error('bountiful-native-after-dice:changed-retained-original')
 const original=facts.source.rolls[0]
 source.prepared={...facts.source.prepared}
 source.rolls=[{...roll,d20:original.d20,d20Second:original.d20Second}]
 const wire=encodeSecondChanceParentWire(source),combat=await gateway.loadResource<{_sync?:{revision?:number};bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),id=JSON.stringify(['bountiful-original-parent',parentId,0]),first=combat?.bountifulOriginalParents?.[id]
 if(!combat||!first||first.consumed||!Number.isSafeInteger(combat._sync?.revision)||!bountifulMonsterAfterDiceMatches(first.originalParent,wire))throw Error('bountiful-native-after-dice:unbound-late-source')
 const continuation={hostMemberId:host.memberId,source:wire}
 if(first.continuation){if(JSON.stringify(first.continuation)!==JSON.stringify(continuation))throw Error('bountiful-native-after-dice:after-dice-already-confirmed');return}
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:combat._sync!.revision!,data:{...combat,bountifulOriginalParents:{...combat.bountifulOriginalParents,[id]:{...first,continuation}}}}],{transactionId:'bountiful-native-after-dice:'+parentId,readRevisions:first.identity.revisions})
}
