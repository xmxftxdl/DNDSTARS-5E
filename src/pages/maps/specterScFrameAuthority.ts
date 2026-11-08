import type {SecondChancePostNativeFrame} from './secondChancePostNativeBoundary'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {Dnd5eActionResult} from "../../application/combat/dnd5eCombatRules"
import type {Dnd5eMapResultPlan} from '../../rulesets/dnd5e/mapBridge'
import {getRoomSession} from '../../lib/roomSession'
export interface SpecterScFrameView {
 readonly phase:'post-concentration-pre-activities'
 readonly roomId:string;readonly hostMemberId:string;readonly mapId:string;readonly combatId:string;readonly parentTransactionId:string
 readonly scGroupIdentity:string
 readonly revisions:Readonly<{maps:number;characters:number;combat:number;'map-geometry'?:number;'campaign-time'?:number}>
 readonly result:Extract<Dnd5eActionResult,{ok:true}>;readonly application:Dnd5eMapResultPlan
 readonly map:BattleMap;readonly characters:readonly Character[];readonly characterIdByCombatantId:Readonly<Record<string,string>>
 readonly originalRoomAction?:SharedPlayerActionState
 readonly stage:import('./postNativeActivityParent').PostNativeActivityStage
}
export interface SpecterScParentBinding {schemaVersion:1;groupIdentity:string}
type Scope={roomId:string;hostMemberId:string;mapId:string;combatId:string;parentTransactionId:string}
const active=new Map<string,SecondChancePostNativeFrame>()
const key=(value:Scope)=>JSON.stringify([value.roomId,value.hostMemberId,value.mapId,value.combatId,value.parentTransactionId])
function host(view:Scope){const session=getRoomSession();if(session?.role!=='dm'||session.roomId!==view.roomId||session.memberId!==view.hostMemberId)throw Error('specter-sc:authenticated-host-scope-required')}
export async function readSpecterScFrame(frame:SecondChancePostNativeFrame):Promise<SpecterScFrameView>{
 // The fixed SC module alone owns the issuer and its WeakMap. Never emulate it
 // from persisted JSON, a fake room command, or an author-controlled reader.
 const boundary=await import('./secondChancePostNativeBoundary')
 const view=await boundary.readSecondChancePostNativeFrame(frame)
 host(view)
 if(view.phase!=='post-concentration-pre-activities'||view.map.id!==view.mapId||view.application.map.id!==view.mapId||view.result.state.combatId!==view.combatId||!view.scGroupIdentity)throw Error('specter-sc:wrong-native-phase-or-scope')
 for(const name of ['maps','characters','combat','map-geometry','campaign-time'] as const)if(!Number.isSafeInteger(view.revisions[name])||view.revisions[name]!<0)throw Error('specter-sc:complete-authorized-revision-vector-required')
 const port=await import('./secondChancePostConcentrationActivityFrame')
 const stage=port.readSecondChancePostConcentrationActivityStage(frame)
 return {...view,phase:'post-concentration-pre-activities',stage}
}
export async function withSpecterScFrame<T>(frame:SecondChancePostNativeFrame,run:(view:SpecterScFrameView)=>Promise<T>):Promise<T>{
 const view=await readSpecterScFrame(frame),scope=key(view)
 if(active.has(scope))throw Error('specter-sc:concurrent-frame-not-authorized')
 active.set(scope,frame)
 try{return await run(view)}finally{if(active.get(scope)===frame)active.delete(scope)}
}
export async function requireActiveSpecterScFrame(frame:SecondChancePostNativeFrame):Promise<SpecterScFrameView>{const view=await readSpecterScFrame(frame);if(active.get(key(view))!==frame)throw Error('specter-sc:frame-not-active');return view}
export async function readActiveSpecterScParent(scope:Scope&{scParent?:SpecterScParentBinding}):Promise<SpecterScFrameView>{
 const frame=active.get(key(scope));if(!frame||scope.scParent?.schemaVersion!==1)throw Error('specter-sc:issued-active-frame-required')
 const view=await readSpecterScFrame(frame)
 if(view.scGroupIdentity!==scope.scParent.groupIdentity)throw Error('specter-sc:changed-original-receipt-group')
 return view
}
