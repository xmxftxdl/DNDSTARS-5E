import{captureDnd5ePluginSubclassEnvelopeRegistrationV1}from'./plugins/pluginContentCatalog'
import type{PreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import{prepareDnd5ePluginSpellCast,resolvePreparedDnd5ePluginSpellCast,dnd5ePluginSpellActivity}from'./pluginSpellTransaction'
import type{PreparedDnd5ePluginFeatureAction}from'./pluginFeatureAction'
import{prepareDnd5ePluginFeatureAction,resolvePreparedDnd5ePluginFeatureAction}from'./pluginFeatureAction'
import{getRegisteredDnd5eActivity}from'./activities/dnd5eActivityRegistry'
import{captureDnd5eSourceEnvelopeAutomationV1}from'./activities/dnd5eUnifiedContentRegistry'
import{dnd5ePluginSpellDefinition,dnd5ePluginFeatureDefinition}from'./plugins/pluginContentCatalog'
import{dnd5eCombatantSoulOfDeceitFeatureId,type Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
import type{Dnd5eActivityDefinitionV1}from'./activities/dnd5eActivityContracts'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'

type Prepared=PreparedDnd5ePluginSpellCast|PreparedDnd5ePluginFeatureAction
type Kind='spell'|'feature'
export interface Dnd5eMagicTruthPreparedParent<K extends Kind=Kind>{readonly kind:'magic-truth-prepared-parent';readonly sourceKind:K}
const produced=new WeakMap<object,object>()
/** A wrapper around the real mechanical preparation factory, not a public
 * issuer accepting a prepared JSON object. Capture checks the exact exported
 * native factory identity, so wrapping a caller's fake factory grants nothing. */
export function wrapDnd5eMagicTruthPreparedFactory<A extends unknown[],R>(factory:(...args:A)=>R):(...args:A)=>R{
 const wrapped=(...args:A):R=>{const result=factory(...args);if(result&&typeof result==='object'&&'ok'in result&&result.ok===true&&'prepared'in result&&result.prepared&&typeof result.prepared==='object')produced.set(result.prepared,wrapped);return result}
 return wrapped
}
const ordered=(value:unknown):unknown=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,v])=>[key,ordered(v)])):value
const signature=(value:unknown)=>JSON.stringify(ordered(value))
type Row={kind:Kind;prepared:Prepared;preparedSignature:string;activity:Dnd5eActivityDefinitionV1;activitySignature:string;parentId:string;actorId:string;ownerId:string;packageId:string;operationId:string;featureId:string;sourceCurrent:()=>boolean;ownerCurrent:()=>boolean}
const nativeResults=new WeakMap<object,{frame:object;row:Row;signature:string;native:ReturnType<typeof resolvePreparedDnd5ePluginSpellCast>|Awaited<ReturnType<typeof resolvePreparedDnd5ePluginFeatureAction>>}>();
const rows=new WeakMap<object,Row>(),active=new Map<string,{row:Row;chosen:boolean}>()
const key=(row:Pick<Row,'parentId'|'actorId'|'ownerId'|'packageId'|'operationId'|'prepared'|'activity'>)=>signature([row.prepared.state.mapId??null,row.prepared.state.combatId,row.parentId,row.actorId,row.ownerId,row.packageId,row.activity.id,row.operationId])
function recipe(activity:Dnd5eActivityDefinitionV1){const{automation:_display,...body}=activity;return signature(body)}
function envelope(packageId:string,kind:'spell'|'feature'|'feat'|'class'|'subclass',id:string){const local=id.startsWith(packageId+':')?id.slice(packageId.length+1):id,capture=kind==='subclass'?captureDnd5ePluginSubclassEnvelopeRegistrationV1(packageId,id):captureDnd5eSourceEnvelopeAutomationV1(packageId,kind,local);if(!capture||capture()?.level!=='full')throw Error('magic-truth:current-full-source-required');return()=>capture()?.level==='full'}
function assertCurrent(row:Row){const current=getRegisteredDnd5eActivity(row.packageId,row.activity.id),owner=row.prepared.state.combatants[row.ownerId];if(signature(row.prepared)!==row.preparedSignature||!current||recipe(current)!==row.activitySignature||!row.sourceCurrent()||!row.ownerCurrent()||!owner||dnd5eCombatantSoulOfDeceitFeatureId(owner)!==row.featureId)throw Error('magic-truth:original-or-source-changed')}
export function captureDnd5eMagicTruthPreparedParent(prepared:PreparedDnd5ePluginSpellCast):Dnd5eMagicTruthPreparedParent<'spell'>|undefined
export function captureDnd5eMagicTruthPreparedParent(prepared:PreparedDnd5ePluginFeatureAction):Dnd5eMagicTruthPreparedParent<'feature'>|undefined
export function captureDnd5eMagicTruthPreparedParent(prepared:Prepared):Dnd5eMagicTruthPreparedParent|undefined{
 const factory=produced.get(prepared);if(factory!==prepareDnd5ePluginSpellCast&&factory!==prepareDnd5ePluginFeatureAction)throw Error('magic-truth:actual-prepared-parent-required')
 const spell='spell'in prepared?prepared.spell:undefined,feature='feature'in prepared?prepared.feature:undefined,kind:Kind=spell?'spell':'feature',packageId=spell?.ownerPluginId??feature!.ownerPluginId,activity=spell?dnd5ePluginSpellActivity(spell):getRegisteredDnd5eActivity(packageId,'headlessAction'in prepared?prepared.headlessAction.actionId:'')
 const purposes=activity?.outcomes.flatMap(outcome=>outcome.operations.filter(operation=>operation.kind==='manual-adjudication'&&operation.purpose==='magical-truth-detection'))??[]
 if(!purposes.length)return undefined
 if(!activity||purposes.length!==1||activity.legacySource?.magical!==true||activity.target.kind!=='creature'||activity.target.count!==1||prepared.targetTokens.length!==1)throw Error('magic-truth:single-current-magical-recipe-required')
 const ownerId=prepared.targetTokens[0].id,owner=prepared.state.combatants[ownerId],featureId=owner&&dnd5eCombatantSoulOfDeceitFeatureId(owner);if(!featureId)return undefined
 const ownerDefinition=dnd5ePluginFeatureDefinition(featureId);if(!ownerDefinition?.sourceSubclassId)throw Error('magic-truth:current-native-Soul-source-required')
 const ownerCurrent=envelope(ownerDefinition.ownerPluginId,'subclass',ownerDefinition.sourceSubclassId),ownerSignature=signature(ownerDefinition),sourceDefinition=spell??dnd5ePluginFeatureDefinition(feature!.id);if(!sourceDefinition||sourceDefinition.ownerPluginId!==packageId)throw Error('magic-truth:current-native-source-required');const sourceSignature=signature(sourceDefinition)
 const sourceEnvelope=spell?envelope(packageId,'spell',spell.id):feature?.sourceSubclassId?envelope(packageId,'subclass',feature.sourceSubclassId):feature?.sourceClassId?envelope(packageId,'class',feature.sourceClassId):envelope(packageId,feature?.sourceFeatId?'feat':'feature',feature?.sourceFeatId??feature!.id)
 const row:Row={kind,prepared,preparedSignature:signature(prepared),activity:cloneDnd5eHostTransactionInput(activity),activitySignature:recipe(activity),parentId:prepared.action.id,actorId:prepared.actorToken.id,ownerId,packageId,operationId:purposes[0].id,featureId,sourceCurrent:()=>sourceEnvelope()&&signature(spell?dnd5ePluginSpellDefinition(spell.id):dnd5ePluginFeatureDefinition(feature!.id))===sourceSignature,ownerCurrent:()=>ownerCurrent()&&signature(dnd5ePluginFeatureDefinition(featureId))===ownerSignature}
 const frame=Object.freeze({kind:'magic-truth-prepared-parent' as const,sourceKind:kind});rows.set(frame,row);assertCurrent(row);return frame
}
export function readDnd5eMagicTruthPreparedParent(frame:object){const row=rows.get(frame);if(!row)throw Error('magic-truth:issued-parent-required');assertCurrent(row);return{sourceKind:row.kind,parentId:row.parentId,mapId:row.prepared.state.mapId,combatId:row.prepared.state.combatId,actorId:row.actorId,ownerId:row.ownerId,actorCharacterId:row.prepared.actor.id,ownerCharacterId:row.prepared.characterIdByCombatantId[row.ownerId],packageId:row.packageId,activityId:row.activity.id,operationId:row.operationId,featureId:row.featureId}}
function rowFor(frame:object,kind:Kind){const row=rows.get(frame);if(!row||row.kind!==kind)throw Error('magic-truth:issued-parent-required');assertCurrent(row);return row}
function verifyInput(row:Row,input:{prepared:Prepared;currentRoom?:{maps:readonly unknown[];characters:readonly unknown[]}}){assertCurrent(row);if(signature(input.prepared)!==row.preparedSignature)throw Error('magic-truth:same-original-prepared-required');if(input.currentRoom&&(signature(input.currentRoom.maps.find(map=>map&&typeof map==='object'&&'id'in map&&map.id===row.prepared.map.id))!==signature(row.prepared.map)||signature(input.currentRoom.characters)!==signature(row.prepared.characters)))throw Error('magic-truth:current-world-changed')}
async function scoped<T>(row:Row,chosen:boolean,operation:()=>T|Promise<T>){if(typeof chosen!=='boolean')throw Error('magic-truth:owner-choice-required');assertCurrent(row);const id=key(row);if(active.has(id))throw Error('magic-truth:original-already-active');const entry={row,chosen};active.set(id,entry);try{return await operation()}finally{if(active.get(id)!==entry)throw Error('magic-truth:scope-corrupt');active.delete(id)}}
function scopedSpell<T>(row:Row,chosen:boolean,operation:()=>T):T{if(typeof chosen!=='boolean')throw Error('magic-truth:owner-choice-required');assertCurrent(row);const id=key(row);if(active.has(id))throw Error('magic-truth:original-already-active');const entry={row,chosen};active.set(id,entry);try{return operation()}finally{if(active.get(id)!==entry)throw Error('magic-truth:scope-corrupt');active.delete(id)}}
/** Pure Host-native mechanical boundary. A room adapter must first obtain the
 * exact authenticated canonical owner's answer; this function does not assert
 * that an arbitrary caller boolean came from room transport. */
export async function withDnd5eMagicTruthSpellProduction<T>(frame:Dnd5eMagicTruthPreparedParent<'spell'>,chosen:boolean,operation:(prepared:PreparedDnd5ePluginSpellCast,resolve:(input:Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0])=>ReturnType<typeof resolvePreparedDnd5ePluginSpellCast>)=>Promise<T>){const row=rowFor(frame,'spell');return operation(cloneDnd5eHostTransactionInput(row.prepared as PreparedDnd5ePluginSpellCast),input=>{verifyInput(row,input);const result=scopedSpell(row,chosen,()=>resolvePreparedDnd5ePluginSpellCast(input));if(result.result.ok&&result.application)nativeResults.set(result,{frame,row,signature:signature(result),native:result});return result})}
export async function withDnd5eMagicTruthFeatureProduction<T>(frame:Dnd5eMagicTruthPreparedParent<'feature'>,chosen:boolean,operation:(prepared:PreparedDnd5ePluginFeatureAction,resolve:(input:Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0])=>ReturnType<typeof resolvePreparedDnd5ePluginFeatureAction>)=>Promise<T>){const row=rowFor(frame,'feature');return operation(cloneDnd5eHostTransactionInput(row.prepared as PreparedDnd5ePluginFeatureAction),async input=>{verifyInput(row,input);const result=await scoped(row,chosen,()=>resolvePreparedDnd5ePluginFeatureAction(input));if(result.result.ok&&result.application)nativeResults.set(result,{frame,row,signature:signature(result),native:result});return result})}
/** Called only by the actual registered Activity compiler at this operation. */
export function currentDnd5eMagicTruthAppearance(input:{state:Dnd5eHeadlessCombatState;parentId:string;actorId:string;ownerId:string;packageId:string;activity:Dnd5eActivityDefinitionV1;operationId:string}):'ordinary'|'pending'|'truthful'{
 const owner=input.state.combatants[input.ownerId];if(!owner||!dnd5eCombatantSoulOfDeceitFeatureId(owner))return'ordinary'
 const id=signature([input.state.mapId??null,input.state.combatId,input.parentId,input.actorId,input.ownerId,input.packageId,input.activity.id,input.operationId]),entry=active.get(id);if(!entry)return'pending';assertCurrent(entry.row);if(recipe(input.activity)!==entry.row.activitySignature||input.state.round!==entry.row.prepared.state.round||input.state.initiativeIndex!==entry.row.prepared.state.initiativeIndex)throw Error('magic-truth:original-or-source-changed');return entry.chosen?'truthful':'ordinary'
}

/** A detached description of an already issued real preparation. This does not
 * issue a parent when serialized, nor authenticate an owner's answer. */
export function readDnd5eMagicTruthOriginal(frame:object){const row=rows.get(frame);if(!row)throw Error('magic-truth:issued-parent-required');assertCurrent(row);return{...readDnd5eMagicTruthPreparedParent(frame),source:{kind:row.kind,id:'spell'in row.prepared?row.prepared.spell.id:row.prepared.feature.id,packageId:row.packageId,activityId:row.activity.id,operationId:row.operationId,signature:row.activitySignature,ownerFeatureId:row.featureId},worldMinute:row.prepared.state.mapMagicDetection?.worldMinute,action:cloneDnd5eHostTransactionInput(row.prepared.action),map:cloneDnd5eHostTransactionInput(row.prepared.map),characters:cloneDnd5eHostTransactionInput(row.prepared.characters)}}
export function readDnd5eMagicTruthNativeResult(frame:object,result:object){const bound=nativeResults.get(result);if(!bound||bound.frame!==frame||bound.signature!==signature(result))throw Error('magic-truth:actual-native-result-required');assertCurrent(bound.row);return bound.native}
