import{captureArcaneClassSaveCheckpoint,type ArcaneClassSaveInput}from'./arcaneSpellSaveCheckpoint'
import{captureArcaneClassAttackCheckpoint,type ArcaneClassAttackInput}from'./arcanePreparedCheckpoint'
import{captureArcanePluginAttackCheckpoint,readArcanePluginAttackCheckpoint,resumeArcanePluginAttackCheckpoint,resumeArcanePluginAttackShroud,completeArcanePluginAttackCheckpoint,type ArcanePluginAttackCheckpoint}from'./arcanePluginAttackCheckpoint'
import{resolvePreparedDnd5ePluginFeatureAction}from'../../rulesets/dnd5e/pluginFeatureAction'
type ArcanePluginAttackInput=Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0]
import{captureArcaneSpellSaveCheckpoint,readArcaneSpellSaveCheckpoint,resumeArcaneSpellSaveCheckpoint,resumeArcaneSpellSaveShroud,type ArcaneSpellSaveInput,type ArcaneSpellSaveCheckpoint}from'./arcaneSpellSaveCheckpoint'
import{secondChanceParentDefinitionSignature as mechanicalDefinitionSignature}from'../../lib/secondChanceParentSignature'
import{getDnd5eSrdMonster}from'../../rulesets/dnd5e/monsters'
import{bountifulNativePreparedExecutionIdentity}from'../../rulesets/dnd5e/bountifulHostOperation'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{getRoomSession}from'../../lib/roomSession'
import{normalizeCharacter}from'../../store/characters'
import{migrateMapsState}from'../../store/maps'
import{secondChanceCanonicalControllerMemberId}from'../../../shared/second-chance-controller.mjs'
import{dnd5eExecutionEventKey}from'../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import{listRegisteredDnd5eActivityPackages}from'../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import{sameArcaneNativeData as sameActivityParentData}from'./arcaneNativeIdentity'
import{captureArcaneEquipmentCheckpoint,captureArcaneMonsterCheckpoint,captureArcaneSpellAttackCheckpoint,readArcaneEquipmentCheckpoint,resumeArcaneEquipmentCheckpoint,resumeArcaneEquipmentShroud,type ArcaneEquipmentInput,type ArcaneMonsterInput,type ArcaneSpellAttackInput,type ArcanePreparedCheckpoint}from'./arcanePreparedCheckpoint'
import{readSecondChancePreparedOriginalAsync,type SecondChancePreparedOriginal}from'./secondChancePreparedParent'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Revisioned={_sync?:{revision?:number}}
const resources=['maps','characters','combat','map-geometry','campaign-time']as const
function revision(value:Revisioned|null){if(value===null)return 0;const n=value._sync?.revision;if(!Number.isSafeInteger(n)||n!<0)throw Error('arcane-native:original-revision-required');return n!}
function host(){const session=getRoomSession();const guard=()=>{const current=getRoomSession();if(!session||session.role!=='dm'||current?.role!=='dm'||current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('arcane-native:authenticated-host-required')};guard();return{session:session!,guard}}
export interface ArcaneNativeIssuedParent {readonly arcaneNativeIssuedParent:unique symbol}
type Value={originalMonster?:ArcaneMonsterInput['prepared']['monster'];frame:ArcanePreparedCheckpoint|ArcaneSpellSaveCheckpoint|ArcanePluginAttackCheckpoint;record:Record<string,unknown>;dependencies:Record<string,number>}
const parents=new WeakMap<object,Value>()
/** Capture exact room versions BEFORE the real original facade is probed. */
export async function captureArcaneNativeIssuedParent(input:ArcaneEquipmentInput,gateway:Gateway):Promise<ArcaneNativeIssuedParent>{
 const{guard}=host(),journal=await gateway.loadResource<Revisioned&{parents:Record<string,Record<string,unknown>>}>('arcane-native-parents');guard()
 const matches=Object.values(journal?.parents??{}).filter(row=>row.parentTransactionId===input.prepared.action.id&&row.mapId===input.prepared.map.id)
 if(matches.length>1)throw Error('arcane-native:ambiguous-original-parent')
 const existing=matches[0]
 if(existing?.phase==='consumed')throw Error('arcane-native:already-published-parent')
 return captureIssued(input,gateway,existing?existing.hostExecutionNow:Date.now())
}
export async function captureArcaneMonsterIssuedParent(input:{input:ArcaneMonsterInput;hostParentTransactionId:string},gateway:Gateway):Promise<ArcaneNativeIssuedParent>{
 const{guard}=host();if(typeof input.hostParentTransactionId!=='string'||!input.hostParentTransactionId||input.hostParentTransactionId.length>180||input.input.transactionId!==input.hostParentTransactionId)throw Error('arcane-native:original-host-monster-parent-required')
 if(bountifulNativePreparedExecutionIdentity(input.input))throw Error('arcane-native:bountiful-native-joint-required')
 const journal=await gateway.loadResource<Revisioned&{parents:Record<string,Record<string,unknown>>}>('arcane-native-parents');guard();const matches=Object.values(journal?.parents??{}).filter(row=>row.parentTransactionId===input.hostParentTransactionId&&row.mapId===input.input.prepared.map.id)
 if(matches.length>1)throw Error('arcane-native:ambiguous-original-parent');const existing=matches[0];if(existing?.phase==='consumed')throw Error('arcane-native:already-published-parent')
 return captureIssued(input.input,gateway,existing?existing.hostExecutionNow:Date.now(),input.hostParentTransactionId)
}
export async function captureArcaneSpellSaveIssuedParent(input:ArcaneSpellSaveInput,gateway:Gateway):Promise<ArcaneNativeIssuedParent>{
 const{guard}=host(),journal=await gateway.loadResource<Revisioned&{parents:Record<string,Record<string,unknown>>}>('arcane-native-parents');guard();const matches=Object.values(journal?.parents??{}).filter(row=>row.parentTransactionId===input.prepared.action.id&&row.mapId===input.prepared.map.id)
 if(matches.length>1)throw Error('arcane-native:ambiguous-original-parent');const existing=matches[0];if(existing?.phase==='consumed')throw Error('arcane-native:already-published-parent')
 return captureIssued(input,gateway,existing?existing.hostExecutionNow:Date.now(),undefined,true)
}
export async function captureArcaneClassSaveIssuedParent(input:ArcaneClassSaveInput,gateway:Gateway):Promise<ArcaneNativeIssuedParent>{
 const{guard}=host(),journal=await gateway.loadResource<Revisioned&{parents:Record<string,Record<string,unknown>>}>('arcane-native-parents');guard();const matches=Object.values(journal?.parents??{}).filter(row=>row.parentTransactionId===input.prepared.action.id&&row.mapId===input.prepared.map.id)
 if(matches.length>1)throw Error('arcane-native:ambiguous-original-parent');const existing=matches[0];if(existing?.phase==='consumed')throw Error('arcane-native:already-published-parent')
 return captureIssued(input,gateway,existing?existing.hostExecutionNow:Date.now(),undefined,true)
}
export async function captureArcaneSpellAttackIssuedParent(input:ArcaneSpellAttackInput,gateway:Gateway):Promise<ArcaneNativeIssuedParent>{
 const{guard}=host(),journal=await gateway.loadResource<Revisioned&{parents:Record<string,Record<string,unknown>>}>('arcane-native-parents');guard();const matches=Object.values(journal?.parents??{}).filter(row=>row.parentTransactionId===input.prepared.action.id&&row.mapId===input.prepared.map.id)
 if(matches.length>1)throw Error('arcane-native:ambiguous-original-parent');const existing=matches[0];if(existing?.phase==='consumed')throw Error('arcane-native:already-published-parent')
 return captureIssued(input,gateway,existing?existing.hostExecutionNow:Date.now())
}
export async function captureArcaneClassAttackIssuedParent(input:ArcaneClassAttackInput,gateway:Gateway):Promise<ArcaneNativeIssuedParent>{
 const{guard}=host(),journal=await gateway.loadResource<Revisioned&{parents:Record<string,Record<string,unknown>>}>('arcane-native-parents');guard();const matches=Object.values(journal?.parents??{}).filter(row=>row.parentTransactionId===input.prepared.action.id&&row.mapId===input.prepared.map.id)
 if(matches.length>1)throw Error('arcane-native:ambiguous-original-parent');const existing=matches[0];if(existing?.phase==='consumed')throw Error('arcane-native:already-published-parent')
 return captureIssued(input,gateway,existing?existing.hostExecutionNow:Date.now())
}
export async function captureArcanePluginAttackIssuedParent(input:ArcanePluginAttackInput,gateway:Gateway):Promise<ArcaneNativeIssuedParent>{
 const{guard}=host(),journal=await gateway.loadResource<Revisioned&{parents:Record<string,Record<string,unknown>>}>('arcane-native-parents');guard();const matches=Object.values(journal?.parents??{}).filter(row=>row.parentTransactionId===input.prepared.action.id&&row.mapId===input.prepared.map.id)
 if(matches.length>1)throw Error('arcane-native:ambiguous-original-parent');const existing=matches[0];if(existing?.phase==='consumed')throw Error('arcane-native:already-published-parent')
 return captureIssued(input,gateway,existing?existing.hostExecutionNow:Date.now())
}
type ArcaneNativeInput=ArcaneEquipmentInput|ArcaneMonsterInput|ArcaneSpellSaveInput|ArcanePluginAttackInput|ArcaneClassAttackInput
function isMonsterInput(input:ArcaneNativeInput):input is ArcaneMonsterInput{return 'monster'in input.prepared}
function isPluginInput(input:ArcaneNativeInput):input is ArcanePluginAttackInput{return 'feature'in input.prepared}
async function captureIssued(input:ArcaneEquipmentInput|ArcaneMonsterInput|ArcaneSpellSaveInput|ArcanePluginAttackInput|ArcaneClassAttackInput,gateway:Gateway,hostExecutionNow:unknown,hostParentTransactionId?:string,saveSpell=false):Promise<ArcaneNativeIssuedParent>{
 if(typeof hostExecutionNow!=='number'||!Number.isSafeInteger(hostExecutionNow)||hostExecutionNow<=0)throw Error('arcane-native:original-execution-clock-required')
 const{session,guard}=host(),values=await Promise.all(resources.map(name=>gateway.loadResource<Revisioned>(name)));guard()
 const plugin=isPluginInput(input),monster=isMonsterInput(input),spellAttack=!monster&&!saveSpell&&input.prepared.action.type==='dnd5e-spell-cast';if(monster){if(bountifulNativePreparedExecutionIdentity(input))throw Error('arcane-native:bountiful-native-joint-required');if(input.transactionId!==hostParentTransactionId||!hostParentTransactionId||input.prepared.actorToken.characterId||input.prepared.resourceKind!=='action'||input.prepared.readiedAttack||input.prepared.compositeRuntime)throw Error('arcane-native:plain-host-monster-action-required');if(!sameActivityParentData(input.prepared.monster,getDnd5eSrdMonster(input.prepared.monster.id)))throw Error('arcane-native:current-original-monster-source-required')}
 const classSave=saveSpell&&!monster&&!plugin&&input.prepared.action.type==='dnd5e-class-feature'
 const classAttack=!monster&&!plugin&&!saveSpell&&input.prepared.action.type==='dnd5e-class-feature'
 const frame=classAttack?captureArcaneClassAttackCheckpoint(input as ArcaneClassAttackInput,{now:hostExecutionNow}):plugin?captureArcanePluginAttackCheckpoint(input as ArcanePluginAttackInput,{now:hostExecutionNow}):saveSpell?(classSave?captureArcaneClassSaveCheckpoint(input as ArcaneClassSaveInput,{now:hostExecutionNow}):captureArcaneSpellSaveCheckpoint(input as ArcaneSpellSaveInput,{now:hostExecutionNow})):monster?captureArcaneMonsterCheckpoint(input as ArcaneMonsterInput,{now:hostExecutionNow}):spellAttack?captureArcaneSpellAttackCheckpoint(input as ArcaneSpellAttackInput,{now:hostExecutionNow}):captureArcaneEquipmentCheckpoint(input as ArcaneEquipmentInput,{now:hostExecutionNow}),view=plugin?readArcanePluginAttackCheckpoint(frame as ArcanePluginAttackCheckpoint):saveSpell?readArcaneSpellSaveCheckpoint(frame as ArcaneSpellSaveCheckpoint):readArcaneEquipmentCheckpoint(frame as ArcanePreparedCheckpoint),prepared=input.prepared
 const maps=values[0]as(Revisioned&{maps:typeof prepared.map[]})|null,characters=values[1]as(Revisioned&{characters:typeof prepared.characters})|null,combat=values[2]as(Revisioned&{mapId:string;combatId:string})|null,map=maps?.maps.find(row=>row.id===prepared.map.id)
 if(!map||!characters||combat?.mapId!==map.id||combat.combatId!==view.baseline.combatId)throw Error('arcane-native:original-world-scope-mismatch')
 // Room characters cross JSON transport: optional undefined fields are absent on the wire.
 // Keep exact prepared/definition identity separate; no mechanical values are omitted here.
 if(!sameActivityParentData(migrateMapsState({maps:[map]}).maps[0],migrateMapsState({maps:[prepared.map]}).maps[0])||!sameActivityParentData(JSON.parse(JSON.stringify(characters.characters.map(row=>normalizeCharacter(row)))),JSON.parse(JSON.stringify(prepared.characters.map(row=>normalizeCharacter(row))))))throw Error('arcane-native:prepared-world-mismatch')
 const actorId=plugin?readArcanePluginAttackCheckpoint(frame as ArcanePluginAttackCheckpoint).facts.event.actorId:saveSpell?readArcaneSpellSaveCheckpoint(frame as ArcaneSpellSaveCheckpoint).facts.sourceActorId!:readArcaneEquipmentCheckpoint(frame as ArcanePreparedCheckpoint).facts.event.actorId,targetId=plugin?readArcanePluginAttackCheckpoint(frame as ArcanePluginAttackCheckpoint).facts.event.targetId:saveSpell?readArcaneSpellSaveCheckpoint(frame as ArcaneSpellSaveCheckpoint).facts.affectedId:readArcaneEquipmentCheckpoint(frame as ArcanePreparedCheckpoint).facts.event.targetId,targetCharacterId=prepared.characterIdByCombatantId[targetId],character=characters.characters.find(row=>row.id===targetCharacterId),controllerMemberId=secondChanceCanonicalControllerMemberId(character,{roomId:session.roomId,hostMemberId:session.memberId})
 if(!targetCharacterId||!controllerMemberId||!map.tokens.some(t=>t.id===targetId&&t.characterId===targetCharacterId))throw Error('arcane-native:canonical-target-required')
 const dependencies:Record<string,number>=Object.fromEntries(resources.map((name,index)=>[name,revision(values[index])]));let command=monster?undefined:input.prepared.action
 if(command?.sourceMode==='player'){
  const originalCommand=command,queue=await gateway.loadResource<Revisioned&{requests:typeof originalCommand[]}>('player-action-requests');guard();const actual=queue?.requests.find(row=>row.id===originalCommand.id),owner=characters.characters.find(row=>row.id===originalCommand.characterId)
  if(!actual?.roomMemberId||actual.roomMemberId!==owner?.roomMemberId||!sameActivityParentData((saveSpell&&!classSave)||spellAttack?{...actual,targetElevationFeet:actual.targetElevationFeet??actual.dnd5eSpellCast?.targetElevationFeet}:actual,command))throw Error('arcane-native:authenticated-original-command-required');command=actual
  dependencies['player-action-requests']=revision(queue)
 }else if(command&&command.sourceMode!=='dm')throw Error('arcane-native:original-command-required')
 if(command&&(command.mapId!==map.id||command.combatId!==combat.combatId||command.actorTokenId!==actorId||command.targetTokenId!==targetId||command.status!=='pending'))throw Error('arcane-native:original-command-mismatch')
 const parentDefinitionSignature=await mechanicalDefinitionSignature(view.baseline);guard()
 const parentTransactionId=command?.id??hostParentTransactionId;if(!parentTransactionId)throw Error('arcane-native:original-host-parent-required')
 const id=dnd5eExecutionEventKey(JSON.stringify([session.roomId,map.id,combat.combatId,parentTransactionId,actorId,targetId,view.occurrence,view.facts])),record=JSON.parse(JSON.stringify({id,hostExecutionNow,parentDefinitionSignature,phase:'arcane',roomId:session.roomId,hostMemberId:session.memberId,parentTransactionId,mapId:map.id,combatId:combat.combatId,actorId,targetId,targetCharacterId,controllerMemberId,featureId:view.options[0].featureId,occurrence:view.occurrence,dependencies:Object.fromEntries(resources.map(name=>[name,dependencies[name]])),prepared:view.original,...(saveSpell?{checkpointKind:'failed-save',savingThrowFacts:view.facts}:{attackFacts:view.facts}),definitions:structuredClone(listRegisteredDnd5eActivityPackages()),originalRoomAction:command,...(monster?{nativeHostOriginal:{kind:'monster',parentTransactionId,monsterId:input.prepared.monster.id,actionId:input.prepared.resourceAction.id,actorId,targetId}}:{})})) as Record<string,unknown>
 const parent=Object.freeze({})as ArcaneNativeIssuedParent;parents.set(parent,{frame,record,dependencies,...(monster?{originalMonster:structuredClone(input.prepared.monster)}:{})});return parent
}
export async function persistArcaneNativeIssuedParent(parent:ArcaneNativeIssuedParent,gateway:Gateway){
 const{session,guard}=host(),value=parents.get(parent);if(!value)throw Error('arcane-native:issued-parent-brand-required')
 if(value.record.roomId!==session.roomId||value.record.hostMemberId!==session.memberId||!sameActivityParentData(value.record.definitions,JSON.parse(JSON.stringify(listRegisteredDnd5eActivityPackages()))))throw Error('arcane-native:issued-source-changed')
 const journal=await gateway.loadResource<Revisioned&{schemaVersion:1;parents:Record<string,unknown>}>('arcane-native-parents');guard();const id=value.record.id as string,existing=journal?.parents[id]
 if(existing){const row=existing as Record<string,unknown>;for(const[key,expected]of Object.entries(value.record))if(key!=='phase'&&!sameActivityParentData(row[key],expected))throw Error('arcane-native:existing-parent-mismatch:'+key);return structuredClone(row)}
 await gateway.saveResourcesAtomically([{name:'arcane-native-parents',data:{schemaVersion:1,parents:{...journal?.parents,[id]:value.record}},expectedRevision:revision(journal)}],{transactionId:'arcane-native-issue:'+id,readRevisions:value.dependencies});guard();return structuredClone(value.record)
}
/** No JSON or room journal row can manufacture this actual Host-issued handle. */
export function readArcaneNativeIssuedParent(parent:ArcaneNativeIssuedParent){const value=parents.get(parent);if(!value)throw Error('arcane-native:issued-parent-brand-required');if(value.originalMonster&&!sameActivityParentData(value.originalMonster,getDnd5eSrdMonster(value.originalMonster.id)))throw Error('arcane-native:current-original-monster-source-required');return{frame:value.frame,record:structuredClone(value.record),dependencies:{...value.dependencies}}}
type Choice={parentId:string;stage:'arcane'|'shroud';decision:'use'|'decline';targetIds?:string[];authenticatedSubmitterMemberId:string;transport:string}
type Saved=Revisioned&{schemaVersion:1;parents:Record<string,Record<string,unknown>&{phase:string;arcaneChoice?:Choice;shroudChoice?:Choice}>}
/** Fresh recovery reconstructs the genuine original facade and validates all
 * five original worlds. A JSON row alone never becomes the mechanical frame. */
export async function restoreArcaneNativeIssuedParent(id:string,gateway:Gateway){
 const{guard}=host(),journal=await gateway.loadResource<Saved>('arcane-native-parents');guard();const p=journal?.parents[id]
 if(!p||p.phase==='consumed')throw Error('arcane-native:waiting-issued-parent-required')
 const original=p.prepared as SecondChancePreparedOriginal
 if(original?.adapterId==='spell'&&p.checkpointKind==='failed-save'){const restored=await readSecondChancePreparedOriginalAsync(original);guard();const parent=await captureIssued(restored as unknown as ArcaneSpellSaveInput,gateway,p.hostExecutionNow,undefined,true),context=readArcaneNativeIssuedParent(parent);for(const[key,value]of Object.entries(context.record))if(key!=='phase'&&!sameActivityParentData(value,p[key]))throw Error('arcane-native:issued-original-mismatch:'+key);return parent}
 if(original?.adapterId==='spell'&&p.checkpointKind===undefined){const restored=await readSecondChancePreparedOriginalAsync(original);guard();const parent=await captureIssued(restored as unknown as ArcaneSpellAttackInput,gateway,p.hostExecutionNow),context=readArcaneNativeIssuedParent(parent);for(const[key,value]of Object.entries(context.record))if(key!=='phase'&&!sameActivityParentData(value,p[key]))throw Error('arcane-native:issued-original-mismatch:'+key);return parent}
 if(original?.adapterId==='plugin-feature'){const restored=await readSecondChancePreparedOriginalAsync(original);guard();const parent=await captureIssued(restored as unknown as ArcanePluginAttackInput,gateway,p.hostExecutionNow),context=readArcaneNativeIssuedParent(parent);for(const[key,value]of Object.entries(context.record))if(key!=='phase'&&!sameActivityParentData(value,p[key]))throw Error('arcane-native:issued-original-mismatch:'+key);return parent}
 if(original?.adapterId==='class-feature'){const restored=await readSecondChancePreparedOriginalAsync(original);guard();const parent=await captureIssued(restored as unknown as ArcaneClassAttackInput,gateway,p.hostExecutionNow,undefined,p.checkpointKind==='failed-save'),context=readArcaneNativeIssuedParent(parent);for(const[key,value]of Object.entries(context.record))if(key!=='phase'&&!sameActivityParentData(value,p[key]))throw Error('arcane-native:issued-original-mismatch:'+key);return parent}
 if(original?.adapterId==='monster'){if(!p.nativeHostOriginal||p.originalRoomAction!==undefined)throw Error('arcane-native:original-native-host-source-required');const restored=await readSecondChancePreparedOriginalAsync(original);guard();const parent=await captureIssued(restored as unknown as ArcaneMonsterInput,gateway,p.hostExecutionNow,p.parentTransactionId as string),context=readArcaneNativeIssuedParent(parent);for(const[key,value]of Object.entries(context.record))if(key!=='phase'&&!sameActivityParentData(value,p[key]))throw Error('arcane-native:issued-original-mismatch:'+key);return parent}
 if(original?.adapterId!=='equipment')throw Error('arcane-native:actual-equipment-original-required')
 const restored=await readSecondChancePreparedOriginalAsync(original);guard()
 if(typeof restored.d20!=='number'||!Number.isInteger(restored.d20)||restored.d20<1||restored.d20>20)throw Error('arcane-native:original-physical-d20-required')
 if(!Array.isArray(restored.damageRolls))throw Error('arcane-native:original-weapon-dice-required')
 const damageRolls=restored.damageRolls.map((value:unknown)=>{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)throw Error('arcane-native:original-weapon-dice-required');return value})
 const parent=await captureIssued({...restored,d20:restored.d20,damageRolls,prepared:restored.prepared as ArcaneEquipmentInput['prepared']},gateway,p.hostExecutionNow),context=readArcaneNativeIssuedParent(parent)
 for(const[key,value]of Object.entries(context.record))if(key!=='phase'&&!sameActivityParentData(value,p[key]))throw Error('arcane-native:issued-original-mismatch:'+key)
 return parent
}
/** Uses only the server-stamped controller answer. This still does NOT publish
 * HP, concentration results or the original action acknowledgment. */
export async function resumeArcaneNativeIssuedParent(parent:ArcaneNativeIssuedParent,gateway:Gateway){
 const{session,guard}=host(),context=readArcaneNativeIssuedParent(parent),id=context.record.id as string
 type Checkpoint=Record<string,unknown>&{id:string;phase:string;arcaneChoice?:Choice;shroudChoice?:Choice}
 let journal=await gateway.loadResource<Saved>('arcane-native-parents');guard();let root=journal?.parents[id]
 if(!root)throw Error('arcane-native:issued-parent-required')
 for(const[key,value]of Object.entries(context.record))if(key!=='phase'&&!sameActivityParentData(value,root[key]))throw Error('arcane-native:issued-original-mismatch:'+key)
 const values=await Promise.all(resources.map(name=>gateway.loadResource<Revisioned>(name)));guard();if(resources.some((name,index)=>revision(values[index])!==context.dependencies[name]))throw Error('arcane-native:original-world-changed')
 const plugin=(root.prepared as SecondChancePreparedOriginal).adapterId==='plugin-feature',save=root.checkpointKind==='failed-save'
 let checkpoint=root as Checkpoint,index=-1
 for(let count=0;count<32;count++){
  const choice=checkpoint.arcaneChoice
  if(!choice)return{status:'pending-owner-choice' as const,parentId:id,...(index>=0?{checkpointId:checkpoint.id}:{})}
  const validate=(answer:Choice,stage:'arcane'|'shroud')=>{if(answer.parentId!==id||answer.stage!==stage||answer.authenticatedSubmitterMemberId!==checkpoint.controllerMemberId||answer.transport!=='authenticated-room-member'||(answer as Choice&{checkpointId?:string}).checkpointId!==(index>=0?checkpoint.id:undefined))throw Error('arcane-native:authenticated-owner-choice-required')}
  validate(choice,'arcane')
  const selected=choice.decision==='use'?{featureId:checkpoint.featureId as string}:undefined
  let native=plugin?resumeArcanePluginAttackCheckpoint(context.frame as ArcanePluginAttackCheckpoint,selected):save?resumeArcaneSpellSaveCheckpoint(context.frame as ArcaneSpellSaveCheckpoint,selected):resumeArcaneEquipmentCheckpoint(context.frame as ArcanePreparedCheckpoint,selected)
  if(native.status==='pending-post-d20-feature-use'){
   if(!checkpoint.shroudChoice){
    if(checkpoint.phase!=='shroud'){
     const next={...checkpoint,phase:'shroud'};root=index<0?{...root,phase:'shroud'}:{...root,checkpoints:(root.checkpoints as Checkpoint[]).map((row,i)=>i===index?next:row)}
     await gateway.saveResourcesAtomically([{name:'arcane-native-parents',expectedRevision:revision(journal),data:{...journal,parents:{...journal!.parents,[id]:root}}}],{transactionId:'arcane-native-shroud-pending:'+id+':'+count,readRevisions:context.dependencies});guard()
    }
    return{status:'pending-shroud-choice' as const,parentId:id,...(index>=0?{checkpointId:checkpoint.id}:{}),request:native.request}
   }
   validate(checkpoint.shroudChoice,'shroud');const entry=native.request.windows.flatMap(window=>window.available).find(entry=>entry.confirmation==='actor-choice');if(!entry)throw Error('arcane-native:actual-shroud-activity-required')
   const shroud=checkpoint.shroudChoice,selection=shroud.decision==='use'?{packageId:entry.packageId,activityId:entry.activity.id,targetIds:shroud.targetIds??[]}:undefined
   native=plugin?resumeArcanePluginAttackShroud(context.frame as ArcanePluginAttackCheckpoint,native,selection):save?resumeArcaneSpellSaveShroud(context.frame as ArcaneSpellSaveCheckpoint,native,selection):resumeArcaneEquipmentShroud(context.frame as ArcanePreparedCheckpoint,native,selection)
  }
  if(native.status!=='pending-incoming-armor-class')return native.status==='resolved'&&plugin?{...native,result:await completeArcanePluginAttackCheckpoint(context.frame as ArcanePluginAttackCheckpoint)}:native
  // Only the original synchronous prepared facade currently supports repeated AC checkpoints.
  if(plugin||save)throw Error('arcane-native:mixed-checkpoint-continuation-required')
  const view=readArcaneEquipmentCheckpoint(context.frame as ArcanePreparedCheckpoint),targetId=view.facts.event.targetId,actorId=view.facts.event.actorId,targetCharacterId=view.context.characterIdByCombatantId[targetId],character=view.context.characters.find(row=>row.id===targetCharacterId),controllerMemberId=secondChanceCanonicalControllerMemberId(character,{roomId:session.roomId,hostMemberId:session.memberId})
  if(!targetCharacterId||!controllerMemberId||!view.options.length)throw Error('arcane-native:canonical-next-checkpoint-required')
  const child={id:dnd5eExecutionEventKey(JSON.stringify([id,view.occurrence,view.facts])),occurrence:view.occurrence,actorId,targetId,targetCharacterId,controllerMemberId,featureId:view.options[0].featureId,attackFacts:JSON.parse(JSON.stringify(view.facts)) as typeof view.facts,phase:'arcane'}
  index++
  const checkpoints=(root.checkpoints??[])as Checkpoint[],existing=checkpoints[index]
  if(existing){for(const[key,value]of Object.entries(child))if(key!=='phase'&&!sameActivityParentData(existing[key],value))throw Error('arcane-native:next-checkpoint-mismatch:'+key);checkpoint=existing;continue}
  if(checkpoints.some(row=>row.id===child.id)||index!==checkpoints.length)throw Error('arcane-native:next-checkpoint-order-required')
  root={...root,checkpoints:[...checkpoints,child]}
  await gateway.saveResourcesAtomically([{name:'arcane-native-parents',expectedRevision:revision(journal),data:{...journal,parents:{...journal!.parents,[id]:root}}}],{transactionId:'arcane-native-next-checkpoint:'+child.id,readRevisions:context.dependencies});guard()
  return{status:'pending-owner-choice' as const,parentId:id,checkpointId:child.id}
 }
 throw Error('arcane-native:checkpoint-limit')
}

export function readArcaneNativeCheckpointContext(parent:ArcaneNativeIssuedParent){const value=readArcaneNativeIssuedParent(parent);if((value.record.prepared as SecondChancePreparedOriginal).adapterId==='plugin-feature'){const view=readArcanePluginAttackCheckpoint(value.frame as ArcanePluginAttackCheckpoint);return{baseline:view.baseline,context:view.context}}if(value.record.checkpointKind==='failed-save'){const view=readArcaneSpellSaveCheckpoint(value.frame as ArcaneSpellSaveCheckpoint);return{baseline:view.baseline,context:view.context}}const view=readArcaneEquipmentCheckpoint(value.frame as ArcanePreparedCheckpoint);return{baseline:view.baseline,context:view.context}}
