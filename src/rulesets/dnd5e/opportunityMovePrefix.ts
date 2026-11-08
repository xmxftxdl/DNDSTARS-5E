import {projectDnd5eCombatApplicationStoreState} from '../../pages/maps/combatApplicationStoreProjection'
import {replayDnd5ePlayerMovePrefix} from './playerMovePrefix'
import {withDnd5ePendingMovementCompletion} from './pendingMovementCompletion'
import {withTokenMovementPresentations} from '../../pages/maps/tokenMovementPresentation'
import {createTokenMovementAnimation,type TokenMovementAnimation} from '../../lib/tokenMovementAnimation'
import {projectDnd5eHeadlessTurnEconomy} from './turnEconomy'
import type {Dnd5eOpportunityPlayerMoveInput} from './opportunityMoveAction'
import type {PreparedDnd5ePlayerMove} from './playerMoveAction'

export interface Dnd5eOpportunityMovePrefixSpec {
 kind:'first-opportunity-prefix-v1'
 position:{x:number;y:number}
 elevationFeet:number
 animation?:TokenMovementAnimation
}
/** Mechanical replay only. This function gives no queue, raw-die, parent,
 * capability or publication authority. The original Host issuer must still
 * validate the complete before-world and the actual current local projection. */
export function replayDnd5eOpportunityMovePrefix(input:Dnd5eOpportunityPlayerMoveInput,prepared:PreparedDnd5ePlayerMove,spec:Dnd5eOpportunityMovePrefixSpec,firstHostNow:number){
 if(spec.kind!=='first-opportunity-prefix-v1')throw Error('opportunity-prefix:known-prefix-kind-required')
 // The first bounded source has no unrecorded hazard/area choice journal.
 // It fails closed rather than pretending that these producers did nothing.
 if(input.map.dnd5eItemAreas?.length||input.map.dnd5ePluginAreas?.length)throw Error('opportunity-prefix:hazard-journal-required')
 const native=replayDnd5ePlayerMovePrefix({originalInput:{action:input.action,map:input.map,characters:input.characters,initiativeOrder:input.initiativeOrder,turnEconomy:input.moverEconomy},prepared,position:spec.position,elevationFeet:spec.elevationFeet,firstHostNow,transactionId:`player-move:${input.action.id}:segment:1`})
 if(!native.resolution.result.ok||!native.resolution.application)throw Error('opportunity-prefix:actual-native-material-required')
 let application=native.resolution.application
 const actor=native.resolution.result.state.combatants[prepared.actorToken.id]
 if(!actor)throw Error('opportunity-prefix:actual-mover-required')
 if(spec.animation){
  const actual=createTokenMovementAnimation({id:`player-move:${input.action.id}:segment:1:${prepared.actorToken.id}`,path:native.prepared.path,finalPosition:spec.position,issuedAt:spec.animation.issuedAt})
  if(!actual||JSON.stringify(actual)!==JSON.stringify(spec.animation))throw Error('opportunity-prefix:canonical-presentation-required')
  application=withTokenMovementPresentations({application,byTokenId:{[prepared.actorToken.id]:actual}})
 }else if(createTokenMovementAnimation({id:`player-move:${input.action.id}:segment:1:${prepared.actorToken.id}`,path:native.prepared.path,finalPosition:spec.position,issuedAt:firstHostNow})){
  throw Error('opportunity-prefix:actual-presentation-required')
 }
 const moved=Math.hypot(prepared.actorToken.x-spec.position.x,prepared.actorToken.y-spec.position.y)>0.001||Math.abs((prepared.actorToken.elevationFeet??0)-spec.elevationFeet)>0.001
 application=withDnd5ePendingMovementCompletion(application,prepared.actorToken.id,`movement-completion:${input.action.id}`,moved)
 const projected=projectDnd5eCombatApplicationStoreState({map:input.map,characters:input.characters,application})
 application={...application,map:projected.map,characters:projected.characters}
 const moverEconomy=projectDnd5eHeadlessTurnEconomy(input.moverEconomy,actor.turn,actor.speed)
 return {...native,application,moverEconomy,turnEconomyByToken:{...input.turnEconomyByToken,[prepared.actorToken.id]:moverEconomy}}
}
