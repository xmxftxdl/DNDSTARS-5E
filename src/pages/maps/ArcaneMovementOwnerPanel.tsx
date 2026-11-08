import type{ArcaneNativeOwnerRequest}from'../../../shared/arcane-native-parent.mjs'
import type{Dnd5eHeadlessCombatState}from"../../application/combat/dnd5eCombatRules"
import{requestSharedArcaneMovement}from"../../composition/browserSharedRoomResources"
import ArcaneNativeOwnerPanel from'./ArcaneNativeOwnerPanel'
const api=async<T,>(operation:'requests'|'choice',input?:unknown):Promise<T>=>requestSharedArcaneMovement(operation,input===undefined?{}:input as Record<string,unknown>)
export default function ArcaneMovementOwnerPanel({mapId,state}:{mapId:string;state:(request?:ArcaneNativeOwnerRequest)=>Dnd5eHeadlessCombatState}){return <ArcaneNativeOwnerPanel mapId={mapId} state={state} requestApi={api} regionLabel="移动豁免反应"/>}
