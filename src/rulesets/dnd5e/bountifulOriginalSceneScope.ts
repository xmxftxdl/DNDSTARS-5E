import {bountifulOriginalScopeMatches,bountifulSceneClockSignature,bountifulSceneCombatBoundary} from '../../../shared/bountiful-original-scope.mjs'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {BountifulOriginalParentIdentity} from './bountifulLuckReceipt'
export interface BountifulOriginalSceneScope {kind:'ordinary-scene';combatBoundary:string;campaignTimeSignature:string;campaignTimeRevision:number}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'>
export async function captureBountifulOriginalSceneScope(combat:{active?:boolean},gateway:Gateway):Promise<BountifulOriginalSceneScope|undefined>{
 if(combat.active===true)return undefined
 const session=getRoomSession();if(session?.role!=='dm'||combat.active!==false)throw Error('bountiful-scene:inactive-host-required')
 const clock=await gateway.loadResource<{_sync?:{revision?:number}}>('campaign-time'),revision=clock?._sync?.revision??0
 if(!Number.isSafeInteger(revision)||revision<0)throw Error('bountiful-scene:clock-revision-required')
 return{kind:'ordinary-scene',combatBoundary:bountifulSceneCombatBoundary(combat),campaignTimeSignature:bountifulSceneClockSignature(clock),campaignTimeRevision:revision}
}
export async function assertBountifulOriginalSceneScope(combat:unknown,identity:Pick<BountifulOriginalParentIdentity,'mapId'|'combatId'|'round'|'initiativeIndex'|'sceneScope'|'revisions'>,gateway:Gateway){
 if(!bountifulOriginalScopeMatches(combat,identity))throw Error('bountiful-scene:changed-combat-boundary')
 const scene=identity.sceneScope;if(!scene)return
 const clock=await gateway.loadResource<{_sync?:{revision?:number}}>('campaign-time')
 if((clock?._sync?.revision??0)!==scene.campaignTimeRevision||bountifulSceneClockSignature(clock)!==scene.campaignTimeSignature||identity.revisions['campaign-time']!==scene.campaignTimeRevision)throw Error('bountiful-scene:changed-clock')
}

/** Metadata is derived solely from the completed real native result's reaction
 * events. The caller retains its original-parent private ACK capability. */
export function markBountifulOriginalSceneReactions(input:{sceneScope:BountifulOriginalSceneScope|undefined;roomId:string;parentId:string;characterIdByCombatantId:Readonly<Record<string,string>>;result:import('./headlessCombatEngine').Dnd5eActionResult;application:import('./mapBridge').Dnd5eMapResultPlan}){
 if(!input.sceneScope)return
 const spent=new Map<string,{schemaVersion:1;roomId:string;parentTransactionId:string}>()
 for(const event of input.result.events){if(event.type!=='turn-resource-spent'||event.resource!=='reaction')continue
  const actor=input.result.state.combatants[event.actorId],characterId=input.characterIdByCombatantId[event.actorId]
  if(!actor||!characterId||actor.turn.reactionAvailable)throw Error('bountiful-scene:real-reaction-required')
  const marker={schemaVersion:1 as const,roomId:input.roomId,parentTransactionId:input.parentId};actor.classState.sceneReactionSpent=marker;spent.set(characterId,marker)
 }
 input.application.characters=input.application.characters.map(character=>{const marker=spent.get(character.id);return marker?{...character,dnd5eCombatState:{...character.dnd5eCombatState,sceneReactionSpent:marker}}:character})
}
