import{getRegisteredDnd5eActivity}from'./dnd5eActivityRegistry'
import type{Dnd5eActivityDefinitionV1,Dnd5eActivityChoiceDefinitionV1}from'./dnd5eActivityContracts'
import type{Dnd5eExecuteActivityCommandV1}from'./dnd5eActivityCommand'
import type{SharedCombatInterrupt}from'../../../lib/combatInterruptQueue'
import{isCombatInterruptKind}from'../../../lib/combatInterruptProtocol'
import{dnd5eExecutionEventKey}from'./dnd5eActivityIdentity'
import{registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot}from'../hostTransactionClone'
export interface Dnd5eActivityWorldFactChoice extends Dnd5eActivityChoiceDefinitionV1{dmWorldFact?:{factId:string}}
export type Dnd5eWorldFactActivity=Omit<Dnd5eActivityDefinitionV1,'choices'>&{choices?:readonly Dnd5eActivityWorldFactChoice[]}
export interface Dnd5eActivityWorldFactScope{roomId:string;mapId:string;combatId:string;parentId:string;actorId:string;targetId:string;packageId:string;activityId:string}
export interface Dnd5eActivityWorldFactReceipt{readonly scope:Readonly<Dnd5eActivityWorldFactScope>;readonly definition:string;readonly choiceId:string;readonly factId:string;readonly value:string}
export interface Dnd5eActivityWorldFactPrompt{id:string;transactionId:string;mapId:string;pluginId:string;featureId:string;featureName:string;audience:'dm';prompt:string;options:{id:string;label:string}[];defaultOptionId:string;timeoutMs:number;phase:'before-action';context:Record<string,unknown>}
const issued=new WeakSet<object>(),slot=Symbol('host-activity-world-facts');registerDnd5eHostReceiptSlot(slot)
function canonical(value:unknown):string{const ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,item])=>[k,ordered(item)])):v;return JSON.stringify(ordered(value))}
/** Registration derives automation display phases; compare executable recipe fields separately. */
function recipe(activity:Dnd5eWorldFactActivity){const{automation:_display,...rules}=activity;return canonical(rules)}
export function dnd5eActivityWorldFactChoices(activity:Dnd5eWorldFactActivity){return(activity.choices??[]).filter(choice=>choice.dmWorldFact)}
/** The caller supplies authenticated room transport and the current registered recipe.
 * No returned UI string can substitute for the exact persisted DM answer. */
export async function collectDnd5eActivityWorldFact(input:{principal:'dm'|'player';activity:Dnd5eWorldFactActivity;choiceId:string;scope:Dnd5eActivityWorldFactScope;targetName:string;authorityUnchanged:()=>boolean;load:(id:string)=>Promise<SharedCombatInterrupt|undefined>;finish:(id:string,response:Record<string,unknown>|undefined)=>Promise<void>;choose:(prompt:Dnd5eActivityWorldFactPrompt)=>Promise<string|undefined>}):Promise<Dnd5eActivityWorldFactReceipt>{
 const{scope}=input,registered=getRegisteredDnd5eActivity(scope.packageId,scope.activityId),activity=registered??input.activity,choice=dnd5eActivityWorldFactChoices(activity).find(row=>row.id===input.choiceId)
 if(input.principal!=='dm'||!registered||recipe(registered)!==recipe(input.activity)||!choice?.dmWorldFact||activity.id!==scope.activityId||scope.actorId===scope.targetId||Object.values(scope).some(value=>typeof value!=='string'||!value.length||value.trim()!==value||value.length>500)||!/^[a-z][a-z0-9.-]{0,63}$/.test(choice.dmWorldFact.factId)||!choice.options.length||choice.options.some(row=>row.id==='unknown'))throw Error('activity-world-fact-authority-required')
 const definition=canonical(activity),key=dnd5eExecutionEventKey(canonical({scope,choiceId:choice.id,definition})),binding={schemaVersion:1,factId:choice.dmWorldFact.factId,parentId:scope.parentId,eventId:'activity-world-fact:'+key,occurrence:0,actorId:scope.actorId,targetId:scope.targetId,packageId:scope.packageId,activityId:scope.activityId},guard=()=>{if(!input.authorityUnchanged())throw Error('activity-world-fact-stale')}
 const validate=(row:SharedCombatInterrupt|undefined,id:string):SharedCombatInterrupt=>{const saved=row?.payload.hostWorldFactBinding;if(!row||row.id!==id||!isCombatInterruptKind(row,'plugin-choice')||row.mapId!==scope.mapId||row.transactionId!==scope.parentId||row.payload.audience!=='dm'||row.payload.pluginId!==scope.packageId||row.payload.featureId!==activity.id||!saved||typeof saved!=='object'||Array.isArray(saved)||canonical(saved)!==canonical(binding))throw Error('activity-world-fact-binding-mismatch');return row}
 const settle=async(row:SharedCombatInterrupt)=>{if(row.status==='answered')await input.finish(row.id,row.response);guard();if(row.status!=='answered'&&row.status!=='done')return undefined;const value=row.response?.optionId;if(typeof value!=='string'||!choice.options.some(option=>option.id===value))return undefined;const receipt=Object.freeze({scope:Object.freeze({...scope}),definition,choiceId:choice.id,factId:choice.dmWorldFact!.factId,value});issued.add(receipt);return registerDnd5eHostReceipt(receipt)}
 for(let attempt=0;;attempt++){guard();const id=`host-world-fact:${key}:${attempt}`,prior=await input.load(id);guard();if(prior){const checked=validate(prior,id),receipt=await settle(checked);if(receipt)return receipt;if(['answered','done','rolled-back'].includes(checked.status))continue}
  await input.choose({id,transactionId:scope.parentId,mapId:scope.mapId,pluginId:scope.packageId,featureId:activity.id,featureName:activity.name,audience:'dm',prompt:`${input.targetName}：${choice.label}`,options:[...choice.options.map(option=>({id:option.id,label:option.label})),{id:'unknown',label:'暂未确定，继续等待'}],defaultOptionId:'unknown',timeoutMs:60000,phase:'before-action',context:{hostWorldFactBinding:binding}});guard();const checked=validate(await input.load(id),id),receipt=await settle(checked);if(receipt)return receipt;if(checked.status!=='answered'&&checked.status!=='done')throw Error('activity-world-fact-pending')
 }
}
type PluginAction={actorId:string;pluginId:string;actionId:string;transactionId?:string;targetId?:string;targetIds?:readonly string[];payload?:unknown}
interface Frame{parentId:string;actorId:string;packageId:string;activityId:string;targetIds:readonly string[];choices:Readonly<Record<string,string>>}
interface Bag{scope:Readonly<Dnd5eActivityWorldFactScope>;definition:string;frame:string;receipts:readonly Dnd5eActivityWorldFactReceipt[]}
const actionFrame=(action:PluginAction):Frame=>({parentId:action.transactionId??'',actorId:action.actorId,packageId:action.pluginId,activityId:action.actionId,targetIds:action.targetIds??(action.targetId?[action.targetId]:[]),choices:(action.payload as{activityChoices?:Record<string,string>}|undefined)?.activityChoices??{}})
const commandFrame=(command:Dnd5eExecuteActivityCommandV1):Frame=>({parentId:command.commandId,actorId:command.actorId,packageId:command.packageId,activityId:command.activityId,targetIds:command.targetIds,choices:command.choices??{}})
function authorize(container:object,frame:Frame,activity:Dnd5eWorldFactActivity,scope:Dnd5eActivityWorldFactScope,receipts:readonly Dnd5eActivityWorldFactReceipt[]){
 delete(container as{[slot]?:Bag})[slot];const choices=dnd5eActivityWorldFactChoices(activity);if(!choices.length)return
 if(frame.parentId!==scope.parentId||frame.actorId!==scope.actorId||frame.packageId!==scope.packageId||frame.activityId!==scope.activityId||activity.id!==scope.activityId||frame.targetIds.length!==1||frame.targetIds[0]!==scope.targetId||receipts.length!==choices.length)throw Error('activity-world-fact-receipt-required')
 const current=getRegisteredDnd5eActivity(scope.packageId,scope.activityId);if(!current||recipe(current)!==recipe(activity))throw Error('activity-world-fact-receipt-required');const definition=canonical(current);for(const choice of choices){const found=receipts.filter(receipt=>receipt.choiceId===choice.id);if(found.length!==1||!issued.has(found[0])||found[0].definition!==definition||canonical(found[0].scope)!==canonical(scope)||found[0].factId!==choice.dmWorldFact!.factId||frame.choices[choice.id]!==found[0].value)throw Error('activity-world-fact-receipt-required')}
 const bag=Object.freeze({scope:Object.freeze({...scope}),definition,frame:canonical(frame),receipts:Object.freeze([...receipts])});issued.add(bag);registerDnd5eHostReceipt(bag);Object.defineProperty(container,slot,{value:bag,enumerable:true,configurable:true})
}
function authorized(container:object,frame:Frame,activity:Dnd5eWorldFactActivity,context:{mapId?:string;combatId:string;actorId:string;targetIds:readonly string[]}):boolean{
 if(!dnd5eActivityWorldFactChoices(activity).length)return true;const bag=(container as{[slot]?:Bag})[slot];const current=bag&&getRegisteredDnd5eActivity(bag.scope.packageId,bag.scope.activityId);return !!bag&&!!current&&issued.has(bag)&&bag.definition===canonical(current)&&recipe(activity)===recipe(current)&&bag.frame===canonical(frame)&&bag.scope.mapId===context.mapId&&bag.scope.combatId===context.combatId&&bag.scope.actorId===context.actorId&&context.targetIds.length===1&&context.targetIds[0]===bag.scope.targetId&&bag.receipts.every(receipt=>issued.has(receipt))
}
export function authorizeDnd5eActivityWorldFactAction(action:PluginAction,activity:Dnd5eWorldFactActivity,scope:Dnd5eActivityWorldFactScope,receipts:readonly Dnd5eActivityWorldFactReceipt[]){authorize(action,actionFrame(action),activity,scope,receipts)}
export function authorizeDnd5eActivityWorldFactCommand(command:Dnd5eExecuteActivityCommandV1,activity:Dnd5eWorldFactActivity,scope:Dnd5eActivityWorldFactScope,receipts:readonly Dnd5eActivityWorldFactReceipt[]){authorize(command,commandFrame(command),activity,scope,receipts)}
export function dnd5eActivityWorldFactActionAuthorized(action:PluginAction,activity:Dnd5eWorldFactActivity,context:Parameters<typeof authorized>[3]){return authorized(action,actionFrame(action),activity,context)}
export function dnd5eActivityWorldFactCommandAuthorized(command:Dnd5eExecuteActivityCommandV1,activity:Dnd5eWorldFactActivity,context:Parameters<typeof authorized>[3]){return authorized(command,commandFrame(command),activity,context)}


/** Data witness only. Fresh authority must be reissued from the exact persisted
 * authenticated DM answers; this object never carries a serialized brand. */
export interface Dnd5eActivityWorldFactRecovery {
 readonly scope:Readonly<Dnd5eActivityWorldFactScope>
 readonly definition:string
 readonly choices:readonly{choiceId:string;factId:string;value:string}[]
}
export function captureDnd5eActivityWorldFactRecovery(action:PluginAction,activity:Dnd5eWorldFactActivity,context:Parameters<typeof authorized>[3]):Dnd5eActivityWorldFactRecovery|undefined{
 const bag=(action as PluginAction&{[slot]?:Bag})[slot]
 if(!bag||!authorized(action,actionFrame(action),activity,context))return undefined
 return{scope:structuredClone(bag.scope),definition:bag.definition,choices:bag.receipts.map(r=>({choiceId:r.choiceId,factId:r.factId,value:r.value}))}
}
export async function restoreDnd5eActivityWorldFactRecovery(action:PluginAction,activity:Dnd5eWorldFactActivity,recovery:Dnd5eActivityWorldFactRecovery,context:Parameters<typeof authorized>[3],ports:Pick<Parameters<typeof collectDnd5eActivityWorldFact>[0],'authorityUnchanged'|'load'|'finish'>):Promise<void>{
 const reject=()=>{throw Error('activity-world-fact:recorded-original-required')},current=getRegisteredDnd5eActivity(action.pluginId,action.actionId)
 if(!recovery||Object.keys(recovery).some(k=>!['scope','definition','choices'].includes(k))||!recovery.scope||Object.keys(recovery.scope).sort().join(',')!=='activityId,actorId,combatId,mapId,packageId,parentId,roomId,targetId'||!current||recipe(current)!==recipe(activity)||canonical(current)!==recovery.definition||!Array.isArray(recovery.choices))reject()
 const declared=dnd5eActivityWorldFactChoices(current!),frame=actionFrame(action),scope=recovery.scope
 if(!declared.length||declared.length!==recovery.choices.length||frame.parentId!==scope.parentId||frame.actorId!==scope.actorId||frame.packageId!==scope.packageId||frame.activityId!==scope.activityId||context.mapId!==scope.mapId||context.combatId!==scope.combatId||context.actorId!==scope.actorId||context.targetIds.length!==1||context.targetIds[0]!==scope.targetId)reject()
 const receipts:Dnd5eActivityWorldFactReceipt[]=[]
 for(const choice of declared){const rows=recovery.choices.filter(r=>r.choiceId===choice.id),recorded=rows[0];if(rows.length!==1||Object.keys(recorded).some(k=>!['choiceId','factId','value'].includes(k))||recorded.factId!==choice.dmWorldFact?.factId||!choice.options.some(o=>o.id===recorded.value)||frame.choices[choice.id]!==recorded.value)reject()
  const receipt=await collectDnd5eActivityWorldFact({principal:'dm',activity:current!,choiceId:choice.id,scope,targetName:scope.targetId,...ports,choose:async()=>{throw Error('activity-world-fact:saved-original-answer-required')}})
  if(receipt.value!==recorded.value||receipt.factId!==recorded.factId||receipt.definition!==recovery.definition)reject()
  receipts.push(receipt)
 }
 authorizeDnd5eActivityWorldFactAction(action,current!,scope,receipts)
 if(!authorized(action,actionFrame(action),current!,context))reject()
}
