import type {BattleMap} from '../store/maps'
import type {Dnd5eHeadlessCombatState} from '../rulesets/dnd5e/headlessCombatEngine'
import {Dnd5eRelentlessReactionDecisionRequired,withDnd5eRequiredRelentlessReactionBoundary} from '../rulesets/dnd5e/relentlessReactionCheckpoint'
import {resolveDnd5ePreparedWithDamageReactions} from '../rulesets/dnd5e/damageReactionFlow'
import {getTempleExpiryInteraction,requireTempleExpiryInteraction} from './templeExpiryInteraction'
/** Pure preflight first; activate the actual owner interaction workspace only when a real damage event needs it. */
export async function resolveBrowserRelentlessBoundary<Result>(input:{state:Dnd5eHeadlessCombatState;map:BattleMap;resolve:(state:Dnd5eHeadlessCombatState)=>Result}):Promise<Result>{
 try{return withDnd5eRequiredRelentlessReactionBoundary(()=>input.resolve(structuredClone(input.state)))}catch(error){if(!(error instanceof Dnd5eRelentlessReactionDecisionRequired))throw error}
 const owner=getTempleExpiryInteraction()??await requireTempleExpiryInteraction()
 const options=owner.damageReactions?.(input.map)
 if(!options)throw Error('relentless-reaction-selection-unavailable')
 return resolveDnd5ePreparedWithDamageReactions({...options,authorityUnchanged:()=>getTempleExpiryInteraction()===owner&&options.authorityUnchanged()},{prepared:{state:input.state}},value=>input.resolve(value.prepared.state))
}
