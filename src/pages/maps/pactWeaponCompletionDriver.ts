import {advancePactWeaponLifecycles}from'./pactWeaponLifecycleDriver'
import{useMapStore}from'../../store/maps'
import{useMapGeometryStore}from'../../store/mapGeometry'
import {appRoomAuthorityScheduler}from'../../lib/roomAuthorityScheduler'
import {useCampaignTimeStore}from'../../store/campaignTime'
import {useCharacterStore}from'../../store/characters'
import {getRoomSession}from'../../lib/roomSession'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import {completeDuePactWeaponRituals,processPactWeaponRequest}from'./pactWeaponRoomRequests'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
export function settlePactWeaponRequest(input:{mapId:string;requestId:string},gateway:Gateway){const session=getRoomSession(),identity=session&&{roomId:session.roomId,memberId:session.memberId};return appRoomAuthorityScheduler.run('pact-request:'+input.requestId,()=>{const now=getRoomSession();if(!identity||now?.roomId!==identity.roomId||now.memberId!==identity.memberId||now.role!=='dm')throw Error('pact-room:queued-host-changed');return processPactWeaponRequest(input,gateway)})}
/** Install on the DM's real scene. Hydration, world changes and character reload
 * wake the existing room authority lane; the persisted clock remains decisive. */
export function installPactWeaponCompletionDriver(input:{mapId:string;gateway:Gateway;onComplete?:()=>Promise<void>;onError:(error:unknown)=>void}){
 const initial=getRoomSession(),identity=initial&&{roomId:initial.roomId,memberId:initial.memberId};let disposed=false,dirty=false,running:Promise<void>|undefined
 const current=()=>{const now=getRoomSession();return !disposed&&identity&&now?.role==='dm'&&now.roomId===identity.roomId&&now.memberId===identity.memberId}
 const wake=()=>{
  if(!current())return Promise.resolve()
  dirty=true
  if(running)return running
  running=(async()=>{while(dirty&&current()){
   dirty=false
   try{const completed=await appRoomAuthorityScheduler.run('pact-completion:'+identity!.roomId+':'+input.mapId,async()=>{if(!current())return 0;const rituals=await completeDuePactWeaponRituals({mapId:input.mapId},input.gateway);if(!current())return 0;const lifecycle=await advancePactWeaponLifecycles(input.gateway);return rituals.length+lifecycle.length});if(completed&&current())await input.onComplete?.()}
   catch(error){if(current())input.onError(error)}
  }})().finally(()=>{running=undefined})
  return running
 }
 const stopClock=useCampaignTimeStore.subscribe((next,previous)=>{if(next.hydratedRoomId!==previous.hydratedRoomId||next.state.worldMinute!==previous.state.worldMinute||next.state.worldSecondRemainder!==previous.state.worldSecondRemainder)void wake()})
 const stopCharacters=useCharacterStore.subscribe((next,previous)=>{if(next.characters!==previous.characters)void wake()})
 const stopMaps=useMapStore.subscribe((next,previous)=>{if(next.maps!==previous.maps)void wake()})
 const stopGeometry=useMapGeometryStore.subscribe((next,previous)=>{if(next.maps!==previous.maps)void wake()})
 void wake()
 return{wake,dispose(){disposed=true;dirty=false;stopClock();stopCharacters();stopMaps();stopGeometry()}}
}
