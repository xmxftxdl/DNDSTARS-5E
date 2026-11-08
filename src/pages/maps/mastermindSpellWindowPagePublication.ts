import type{BattleMap}from'../../store/maps'
import type{Character}from'../../types/character'
import type{SharedCombatState,SharedPlayerActionState,SharedPlayerActionAckState,SharedPlayerActionProcessedState}from'../../lib/sharedCombatTypes'
import{loadSharedResource,saveSharedResourceWithResult,saveSharedResourcesAtomically,publishSharedEvent}from"../../composition/browserSharedRoomResources"
import{getRoomSession}from'../../lib/roomSession'
import{requestSharedMastermindSpellWindow,requestSharedMastermindMisdirection}from"../../composition/browserSharedRoomResources"
import{prepareMastermindSpellWindowPageQueuedAck,type MastermindSpellWindowGateway}from'./mastermindSpellWindowParent'
import{prepareMastermindSpellWindowNativePagePublication,publishMastermindSpellWindowNative}from'./mastermindSpellWindowNativePublication'
import{publishPlayerActionAckWithSnapshots}from'../../lib/playerActionAckPublish'
import{buildPlayerActionAck,buildPlayerActionProcessedState}from'../../lib/playerActionAck'
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'../../rulesets/dnd5e/turnEconomy'
import{dnd5eHeadlessTurnKey}from"../../application/combat/dnd5eCombatRules"
type Doc<T>=T&{_sync?:{revision?:number}}
type Gateway=MastermindSpellWindowGateway&{saveResourcesAtomically:typeof saveSharedResourcesAtomically;publishAck:(ack:SharedPlayerActionAckState)=>Promise<void>}
const gateway:Gateway={session:getRoomSession,loadResource:loadSharedResource,source:requestSharedMastermindSpellWindow,owner:requestSharedMastermindMisdirection,saveResourcesAtomically:saveSharedResourcesAtomically,publishAck:ack=>publishSharedEvent('player-action-dm-to-player',ack)}
/** The real completed Base, not a Page input graph, supplies all world writes. */
export async function publishMastermindSpellWindowPageCompleted(completed:object,action:SharedPlayerActionState,g:Gateway=gateway){
 if(action.sourceMode==='dm'){await publishMastermindSpellWindowNative(await prepareMastermindSpellWindowNativePagePublication(completed,action,g));return true}
 const plan=await prepareMastermindSpellWindowPageQueuedAck(completed,action),[combat,maps,characters,processed,ack]=await Promise.all([g.loadResource<Doc<SharedCombatState>>('combat'),g.loadResource<Doc<{maps:BattleMap[];selectedId?:string}>>('maps'),g.loadResource<Doc<{characters:Character[];selectedId?:string|null}>>('characters'),g.loadResource<Doc<SharedPlayerActionProcessedState>>('player-action-processed'),g.loadResource<Doc<SharedPlayerActionAckState>>('player-action-ack')])
 if(!combat||!maps||!characters||combat._sync?.revision!==plan.expectedRevisions.combat||maps._sync?.revision!==plan.expectedRevisions.maps||characters._sync?.revision!==plan.expectedRevisions.characters)throw Error('spell-window-page-publication:same-canonical-world-required')
 const revision=(doc:Doc<object>|null)=>{const value=doc?._sync?.revision??(doc==null?0:undefined);if(!Number.isSafeInteger(value))throw Error('spell-window-page-publication:canonical-revision-required');return value!},economies={...combat.dnd5eTurnEconomyByToken}
 for(const[id,actor]of Object.entries(plan.result.state.combatants))economies[id]=projectDnd5eHeadlessTurnEconomy(economies[id]??createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(plan.result.state,id),actor.speed),actor.turn,actor.speed)
 const nextAck=buildPlayerActionAck({action,mapId:action.mapId,combatId:action.combatId,status:'accepted',round:combat.round,initiativeIndex:combat.initiativeIndex,appliedAt:plan.publication.issuedAt}),nextProcessed=buildPlayerActionProcessedState({action,current:processed??undefined,updatedAt:plan.publication.issuedAt})
 await publishPlayerActionAckWithSnapshots({ack:nextAck,processed:nextProcessed,expectedRevisions:{...plan.expectedRevisions,'player-action-processed':revision(processed),'player-action-ack':revision(ack)},snapshots:{characters:plan.application.characters,characterSelectedId:characters.selectedId,maps:maps.maps.map(map=>map.id===plan.publication.mapId?plan.application.map:map),mapSelectedId:maps.selectedId,combat:{...combat,dnd5eTurnEconomyByToken:economies},updatedAt:plan.publication.issuedAt},saveSharedResource:saveSharedResourceWithResult,loadSharedResource:g.loadResource,commitSharedResources:g.saveResourcesAtomically,publishAck:g.publishAck});return true
}
