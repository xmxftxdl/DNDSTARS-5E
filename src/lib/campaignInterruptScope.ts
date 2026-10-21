import type {SharedCombatInterruptQueueState} from './combatInterruptQueue'
import {isCombatInterruptKind} from './combatInterruptProtocol'

/** A campaign clock can expire a structure on a map that nobody is viewing. */
export function campaignVisibleInterruptQueue(queue:SharedCombatInterruptQueueState|null|undefined,viewedMapId:string){
 if(!queue||queue.mapId===viewedMapId)return queue
 // Only campaign expiry choices are room-wide. Do not expose unrelated combat
 // prompts from another map or resolve them through that map's viewer.
 const interrupts=queue.interrupts.filter(interrupt=>
  isCombatInterruptKind(interrupt,'plugin-choice')&&
  interrupt.transactionId?.startsWith('temple-expiry:')&&
  interrupt.payload.featureId==='spell:feather-fall')
 return interrupts.length?{...queue,interrupts}:undefined
}
