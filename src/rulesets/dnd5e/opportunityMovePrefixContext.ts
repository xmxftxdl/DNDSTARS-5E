import {getRoomSession} from '../../lib/roomSession'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import type {Dnd5eOpportunityPlayerMoveInput} from './opportunityMoveAction'
import type {Dnd5eTurnEconomyCounts} from '../../lib/sharedCombatTypes'

type Input=Omit<Dnd5eOpportunityPlayerMoveInput,'attackerTokenId'|'attackerEconomy'|'originalChoices'>&{
 /** Canonical per-token economies read at the real beginning of this move.
  * This is distinct from the UI's possibly sparse stored economy projection. */
 originalEconomies:Readonly<Record<string,Dnd5eTurnEconomyCounts>>
}
type Context={input:Input;firstHostNow:number;roomId:string;memberId:string;signature:string;readAnchors:()=>unknown;anchors:string}
const issued=new WeakMap<object,Context>()
const signature=(input:Input)=>JSON.stringify(encodeSecondChanceParentWire(input))
/** Captures the real original queued-move callback's before-world. It does not
 * publish or authorize raw dice; the server still independently requires the
 * unchanged original map/characters, pending command and original controller. */
export function captureBountifulOpportunityMovePrefixContext(input:Input,readAnchors:()=>unknown){
 const session=getRoomSession()
 if(session?.role!=='dm'||!session.roomId||!session.memberId||input.action.status!=='pending'||input.action.type!=='move-token')throw Error('opportunity-prefix:actual-host-original-required')
 const context=Object.freeze({}),captured={...cloneDnd5eHostTransactionInput(input),action:input.action}
 issued.set(context,{input:captured,firstHostNow:Date.now(),roomId:session.roomId,memberId:session.memberId,signature:signature(captured),readAnchors,anchors:JSON.stringify(encodeSecondChanceParentWire(readAnchors()))})
 return context
}
export function readBountifulOpportunityMovePrefixContext(context:object){
 const actual=issued.get(context),session=getRoomSession()
 if(!actual||session?.role!=='dm'||session.roomId!==actual.roomId||session.memberId!==actual.memberId||signature(actual.input)!==actual.signature||JSON.stringify(encodeSecondChanceParentWire(actual.readAnchors()))!==actual.anchors)throw Error('opportunity-prefix:exact-original-context-required')
 return {input:{...cloneDnd5eHostTransactionInput(actual.input),action:actual.input.action},firstHostNow:actual.firstHostNow}
}
