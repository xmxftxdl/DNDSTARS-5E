import type {Character} from '../../types/character'
import type {PreparedDnd5eEquipmentAttack} from './equipmentAttackAction'
import {resolvePreparedDnd5eEquipmentAttack} from './equipmentAttackAction'
import type {OriginalD20Ready} from './allyNaturalOneCheckpoint'
import type {BountifulEquipmentD20Receipt} from './bountifulEquipmentD20Receipt'
import {selectionFromBountifulEquipmentD20Receipt} from './bountifulEquipmentD20Receipt'
import {resolveBountifulEquipmentD20Selection} from './bountifulEquipmentD20Mechanics'
import {validateBountifulEquipmentD20Receipt,bountifulEquipmentD20ReceiptComplete} from '../../../shared/bountiful-equipment-d20.mjs'

interface Frame{prepared:PreparedDnd5eEquipmentAttack;receipt:BountifulEquipmentD20Receipt;ordinal:number;visited:boolean;character?:Character}
let active:Frame|undefined
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
function isEquipmentInput(value:unknown):value is Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]{
 if(!value||typeof value!=='object'||!('prepared'in value)||!value.prepared||typeof value.prepared!=='object')return false
 const prepared=value.prepared
 return ['state','action','actor','actorToken','characters','profile','map','characterIdByCombatantId'].every(key=>key in prepared)
}
export function withBountifulEquipmentInputReplay<T>(input:unknown,resolver:unknown,receipt:BountifulEquipmentD20Receipt|undefined,run:()=>T):T{
 if(!receipt)return run()
 if(resolver!==resolvePreparedDnd5eEquipmentAttack||!isEquipmentInput(input))throw Error('bountiful-equipment-replay:actual-equipment-facade-required')
 return withBountifulEquipmentReplay(input.prepared,receipt,run)
}

/** Synchronous, nested-safe scope entered only by the prepared replay session
 * after its actual equipment resolver and original source binding are checked.
 * It never spans the asynchronous player-choice phase. */
export function withBountifulEquipmentReplay<T>(prepared:PreparedDnd5eEquipmentAttack,receipt:BountifulEquipmentD20Receipt,run:()=>T):T{
 if(!validateBountifulEquipmentD20Receipt(receipt)||!bountifulEquipmentD20ReceiptComplete(receipt)||receipt.identity.parentId!==prepared.action.id||receipt.ready.actorId!==prepared.actorToken.id)throw Error('bountiful-equipment-replay:completed-bound-choice-required')
 const prior=active,frame:Frame={prepared,receipt:structuredClone(receipt),ordinal:0,visited:false};active=frame
 try{const result=run();if(!frame.visited)throw Error('bountiful-equipment-replay:original-die-not-consumed');return result}finally{active=prior}
}

/** Called after original BL/native/generic choices have each been validated.
 * Only the exact remaining original die can consume the real item mechanic. */
export function visitBountifulEquipmentReady(request:OriginalD20Ready):{values:readonly number[];finalizedDice:readonly number[]}|undefined{
 const frame=active
 if(!frame)return undefined
 const ready={...request,ordinal:frame.ordinal++}
 if(ready.ordinal!==frame.receipt.identity.readyOrdinal)return undefined
 if(frame.visited||!same(ready,frame.receipt.ready))throw Error('bountiful-equipment-replay:changed-original-stage')
 frame.visited=true
 const selection=selectionFromBountifulEquipmentD20Receipt(frame.receipt)
 if(!selection)return {values:[...ready.values],finalizedDice:[...ready.finalizedDice]}
 const actual=resolveBountifulEquipmentD20Selection({prepared:frame.prepared,ready,selection})
 frame.character=actual.character
 return {values:actual.values,finalizedDice:[...new Set([...ready.finalizedDice,selection.dieIndex])].sort((a,b)=>a-b)}
}

/** The actual equipment facade consumes ammunition/throws from this unpublished
 * character, so its ordinary result plan carries both costs in one final CAS. */
export function bountifulEquipmentCostCharacter(prepared:PreparedDnd5eEquipmentAttack):Character{
 const frame=active
 if(!frame)return prepared.actor
 if(!frame.visited||!same(prepared.action,frame.prepared.action)||!same(prepared.actor,frame.prepared.actor)||!same(prepared.profile,frame.prepared.profile)||!same(prepared.map,frame.prepared.map))throw Error('bountiful-equipment-replay:changed-material-source')
 return frame.character??prepared.actor
}
