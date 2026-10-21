import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot} from '../hostTransactionClone'

export interface Dnd5eActivitySaveFactV1 {id:string;label:string;mode:'advantage'|'disadvantage'}
export type Dnd5eActivitySaveFactsV1=Readonly<Record<string,Readonly<Record<string,boolean>>>>

/** Reattach to the same persisted Host decision after a document reload. */
export function dnd5eActivitySaveFactInterruptIdV1(transactionId:string,activityId:string,targetId:string,factId:string):string{
 return 'activity-save-fact:'+JSON.stringify([transactionId,activityId,targetId,factId])
}
type FactAction={actorId:string;pluginId:string;actionId:string;transactionId?:string;targetId?:string;targetIds?:readonly string[];payload?:unknown}
const authority=Symbol('host-save-facts')
registerDnd5eHostReceiptSlot(authority)
interface Receipt {identity:string;facts:Dnd5eActivitySaveFactsV1}
function identity(action:FactAction):string{
 const payload=action.payload&&typeof action.payload==='object'&&!Array.isArray(action.payload)?action.payload as Record<string,unknown>:undefined
 return JSON.stringify([action.actorId,action.pluginId,action.actionId,action.transactionId,action.targetId,action.targetIds,
  // The UI materializes omitted choices as {} after its rolled-choice phase.
  // These carry the same decision; a nonempty change still invalidates the receipt.
  payload?.activityChoices ?? {},payload?.activityCastLevel])
}
export function dnd5eActivitySaveFactsV1(activity:Dnd5eActivityDefinitionV1):readonly Dnd5eActivitySaveFactV1[]{
 return [...new Map((activity.checks??[]).flatMap(check=>check.kind==='saving-throw'&&check.rollModeByHostFact?
  [[check.rollModeByHostFact.id,check.rollModeByHostFact] as const]:[])).values()]
}
/** Host-only facts are not representable by a JSON player command. */
export function dnd5eHostSaveFactsV1(action:FactAction):Dnd5eActivitySaveFactsV1|undefined{
 const receipt=(action as FactAction&{[authority]?:Receipt})[authority]
 return receipt?.identity===identity(action)?receipt.facts:undefined
}
/** False is a valid factual answer; undefined cancels without granting a receipt. */
export async function collectDnd5eActivitySaveFactsV1(input:{action:FactAction;activity:Dnd5eActivityDefinitionV1;
 targets:readonly {id:string;label:string}[];
 decide:(fact:Dnd5eActivitySaveFactV1,target:{id:string;label:string})=>Promise<boolean|undefined>}):Promise<boolean>{
 delete(input.action as FactAction&{[authority]?:Receipt})[authority]
 const declarations=dnd5eActivitySaveFactsV1(input.activity)
 if(!declarations.length)return true
 if(!input.action.transactionId||!input.targets.length||new Set(input.targets.map(t=>t.id)).size!==input.targets.length)return false
 const before=identity(input.action),facts:Record<string,Record<string,boolean>>={}
 for(const target of input.targets){
  facts[target.id]={}
  for(const fact of declarations){
   const decision=await input.decide(fact,target)
   if(typeof decision!=='boolean'||identity(input.action)!==before)return false
   facts[target.id][fact.id]=decision
  }
 }
 const receipt:Receipt=registerDnd5eHostReceipt(Object.freeze({identity:before,
  facts:Object.freeze(Object.fromEntries(Object.entries(facts).map(([id,values])=>[id,Object.freeze({...values})])))}))
 Object.defineProperty(input.action,authority,{value:receipt,enumerable:true,configurable:true})
 return true
}
