import{getRoomSession}from'../../lib/roomSession'
import{normalizeSharedCampaignTime,type SharedCampaignTimeState}from'../../lib/campaignTime'
import{getRegisteredDnd5eActivity}from'../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import{resolveDnd5eActivityInvocationV1}from'../../rulesets/dnd5e/activities/dnd5eActivityInvocation'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{PersistedSecondChanceAttack,SecondChanceCombat}from'./secondChanceHostCommit'
import{readSecondChancePreparedOriginalAsync,type SecondChancePreparedInput}from'./secondChancePreparedParent'
export interface SecondChanceSceneScope{kind:'rest'|'ordinary-exploration';combatBoundary?:string;roomId:string;hostMemberId:string;campaignTimeRevision:number;campaignTimeSignature:string;sourceCombatId?:string;sourceMapId?:string}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'>
async function clockSignature(clock:SharedCampaignTimeState|null){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(clock==null?null:normalizeSharedCampaignTime(clock))));return'sha256:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}
export function secondChanceParentScopeMatches(combat:SecondChanceCombat,receipt:Pick<PersistedSecondChanceAttack,'attack'|'sceneScope'>,mapId:string):boolean{
 const scene=receipt.sceneScope
 return receipt.attack.mapId===mapId&&(scene?combat.active===false&&combat.combatId===scene.sourceCombatId&&combat.mapId===scene.sourceMapId&&(scene.kind!=='ordinary-exploration'||scene.combatBoundary===secondChanceOrdinaryCombatBoundary(combat)):combat.mapId===mapId&&combat.combatId===receipt.attack.combatId)
}
/** Actual inactive public boundary; generated scratch combat identities never reset a reaction. */
export function secondChanceOrdinaryCombatBoundary(combat:SecondChanceCombat):string{
 const ordered=(value:unknown):unknown=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,row])=>[key,ordered(row)])):value
 return JSON.stringify(ordered({active:combat.active,mapId:combat.mapId,combatId:combat.combatId,round:combat.round,initiativeIndex:combat.initiativeIndex,initiativeOrder:combat.initiativeOrder,dnd5eTurnEconomyByToken:combat.dnd5eTurnEconomyByToken}))
}
async function requireOrdinaryOriginal(input:SecondChancePreparedInput,gateway:Gateway){
 const action=(input.prepared as unknown as {action?:import('../../lib/sharedCombatTypes').SharedPlayerActionState}).action
 if(!action||action.combatId?.trim()||!['dnd5e-spell-cast','dnd5e-weapon-attack'].includes(action.type))throw Error('second-chance-scene:ordinary-original-required')
 const queue=await gateway.loadResource<{requests:import('../../lib/sharedCombatTypes').SharedPlayerActionState[]}>('player-action-requests'),current=queue?.requests.find(row=>row.id===action.id)
 const mechanical=(row:import('../../lib/sharedCombatTypes').SharedPlayerActionState)=>Object.fromEntries(Object.entries(row).filter(([key])=>!['roomMemberId','authorityContext','updatedAt','status','seq'].includes(key)))
 if(!current||!current.roomMemberId||current.sourceMode!=='player'||JSON.stringify(mechanical(current))!==JSON.stringify(mechanical(action)))throw Error('second-chance-scene:authenticated-original-required')
 return current
}
export async function captureSecondChanceOrdinarySceneScope(input:SecondChancePreparedInput,combat:SecondChanceCombat,gateway:Gateway):Promise<SecondChanceSceneScope>{
 const host=getRoomSession();if(host?.role!=='dm'||combat.active!==false)throw Error('second-chance-scene:inactive-host-required')
 await requireOrdinaryOriginal(input,gateway)
 const raw=await gateway.loadResource<SharedCampaignTimeState&{_sync?:{revision?:number}}>('campaign-time'),revision=raw==null?0:raw._sync?.revision
 if(!Number.isSafeInteger(revision)||revision!<0)throw Error('second-chance-scene:clock-revision-required')
 return{kind:'ordinary-exploration',roomId:host.roomId,hostMemberId:host.memberId,combatBoundary:secondChanceOrdinaryCombatBoundary(combat),campaignTimeRevision:revision!,campaignTimeSignature:await clockSignature(raw??null),sourceCombatId:combat.combatId,sourceMapId:combat.mapId}
}
export function secondChanceRestAuthority(input:SecondChancePreparedInput){
 const original=input as unknown as Parameters<typeof import('../../rulesets/dnd5e/pluginFeatureAction').resolvePreparedDnd5ePluginFeatureAction>[0]
 const action=original.prepared.headlessAction,activity=action&&getRegisteredDnd5eActivity(action.pluginId,action.actionId),invocation=activity&&resolveDnd5eActivityInvocationV1(activity)
 if(!original.restAuthority||!activity||invocation?.kind!=='triggered'||!['short-rest-started','long-rest-started','short-rest-complete','long-rest-complete'].includes(invocation.event))throw Error('second-chance-scene:original-rest-authority-required')
 return original.restAuthority
}
export async function captureSecondChanceSceneScope(input:SecondChancePreparedInput,combat:SecondChanceCombat,gateway:Gateway):Promise<SecondChanceSceneScope>{
 const host=getRoomSession();if(!host||host.role!=='dm'||combat.active)throw Error('second-chance-scene:host-room-required')
 const authority=secondChanceRestAuthority(input),raw=await gateway.loadResource<SharedCampaignTimeState&{_sync?:{revision?:number}}>('campaign-time'),revision=raw?._sync?.revision
 if(!raw||!Number.isSafeInteger(revision)||revision!<0||JSON.stringify(normalizeSharedCampaignTime(raw))!==JSON.stringify(normalizeSharedCampaignTime(authority.clock)))throw Error('second-chance-scene:stale-rest-clock')
 return{kind:'rest',roomId:host.roomId,hostMemberId:host.memberId,campaignTimeRevision:revision!,campaignTimeSignature:await clockSignature(raw),sourceCombatId:combat.combatId,sourceMapId:combat.mapId}
}
export async function assertSecondChanceSceneScope(receipt:PersistedSecondChanceAttack,combat:SecondChanceCombat,gateway:Gateway):Promise<Record<string,number>>{
 const scene=receipt.sceneScope;if(!scene)return{}
 const host=getRoomSession();if(!host||host.role!=='dm'||host.roomId!==scene.roomId||host.memberId!==scene.hostMemberId||!secondChanceParentScopeMatches(combat,receipt,receipt.attack.mapId)||receipt.hostControllerMemberId!==host.memberId||!receipt.parentInput?.prepared||scene.kind==='rest'&&receipt.parentInput.prepared.adapterId!=='plugin-feature'||scene.kind==='ordinary-exploration'&&!['spell','equipment'].includes(receipt.parentInput.prepared.adapterId))throw Error('second-chance-scene:host-room-required')
 if(receipt.parentContinuation?.phase==='consumed')return{}
 const original=await readSecondChancePreparedOriginalAsync(receipt.parentInput.prepared),authority=scene.kind==='rest'?secondChanceRestAuthority(original):undefined
 if(scene.kind==='ordinary-exploration')await requireOrdinaryOriginal(original,gateway)
 const raw=await gateway.loadResource<SharedCampaignTimeState&{_sync?:{revision?:number}}>('campaign-time')
 if((raw==null?0:raw._sync?.revision)!==scene.campaignTimeRevision||await clockSignature(raw??null)!==scene.campaignTimeSignature||authority&&await clockSignature(authority.clock)!==scene.campaignTimeSignature)throw Error('second-chance-scene:stale-rest-clock')
 const characters=await gateway.loadResource<{_sync?:{revision?:number}}>('characters'),characterRevision=receipt.parentContinuation?.characterRevision??receipt.characterRevision
 if(characters?._sync?.revision!==characterRevision)throw Error('second-chance-scene:stale-character-state')
 return{'campaign-time':scene.campaignTimeRevision,characters:characterRevision,maps:receipt.mapRevision,...(scene.kind==='ordinary-exploration'?{'map-geometry':receipt.geometryRevision??0}:{})}
}
