import {resolvePreparedDnd5eExplorationMove} from './playerMoveAction'
import {prepareDnd5eEffectRollDice} from './prepareEffectRollDice'
import type {Dnd5eRollDiceRecipe} from './rollDiceModifiers'

/** Resolve against one movement snapshot; previews never publish movement or spend resources. */
export async function settleDnd5eExplorationMoveEffectDice(
 input:Parameters<typeof resolvePreparedDnd5eExplorationMove>[0],
 options:{isCurrent:()=>boolean;roll:(recipe:Dnd5eRollDiceRecipe)=>Promise<readonly number[]|undefined>},
):Promise<ReturnType<typeof resolvePreparedDnd5eExplorationMove>>{
 if(!options.isCurrent())return {ok:false,reason:'movement-hazard-state-changed'}
 const transactionId=input.transactionId??`exploration-entry:${globalThis.crypto.randomUUID()}`
 const prepared=await prepareDnd5eEffectRollDice({
  resolve:effectRollDice=>resolvePreparedDnd5eExplorationMove({...input,transactionId,effectRollDice}),
  roll:recipe=>options.isCurrent()?options.roll(recipe):Promise.resolve(undefined),
 })
 if(!options.isCurrent())return {ok:false,reason:'movement-hazard-state-changed'}
 if(prepared.status==='ready'||prepared.status==='rejected')return prepared.result
 return {ok:false,reason:`movement-effect-dice-${prepared.status}`}
}
