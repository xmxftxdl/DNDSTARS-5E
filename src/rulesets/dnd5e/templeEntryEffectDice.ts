import {resolveDnd5eHeadlessAction,type Dnd5eAction,type Dnd5eCombatant,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {prepareDnd5eEffectRollDice} from './prepareEffectRollDice'
import type {Dnd5eRollDiceRecipe} from './rollDiceModifiers'

export type TempleEntryEffectDiceRoller=(recipe:Dnd5eRollDiceRecipe,target:Dnd5eCombatant)=>Promise<readonly number[]|undefined>

/** Dice evidence for one entry attempt. Replay always revalidates against the
 * supplied pre-entry state; this is not a trusted replacement state. */
export interface Dnd5eTempleEntryReplay {
 transactionId:string
 action:Extract<Dnd5eAction,{type:'temple-entry-attempt'}>
}

export function replayDnd5eTempleEntry(state:Dnd5eHeadlessCombatState,receipt:Dnd5eTempleEntryReplay){
 return resolveDnd5eHeadlessAction(state,structuredClone(receipt.action),{transactionId:receipt.transactionId})
}

/** Collect current effect dice with one stable transaction identity, without publishing previews. */
export async function resolveDnd5eTempleEntryEffectDice(input:{
 state:Dnd5eHeadlessCombatState;action:Extract<Dnd5eAction,{type:'temple-entry-attempt'}>;
 rollEffectDice?:TempleEntryEffectDiceRoller;isCurrent:()=>boolean;
 transactionId?:string;
}){
 const transactionId=input.transactionId??`temple-entry:${globalThis.crypto.randomUUID()}`
 const prepared=await prepareDnd5eEffectRollDice({
  resolve:effectRollDice=>resolveDnd5eHeadlessAction(input.state,{...input.action,effectRollDice},{transactionId}),
  roll:recipe=>input.isCurrent()&&input.rollEffectDice
   ?input.rollEffectDice(recipe,input.state.combatants[input.action.actorId]):Promise.resolve(undefined),
 })
 if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
 if(prepared.status==='rejected')return prepared.result
 if(prepared.status!=='ready')return {ok:false as const,reason:`temple-entry-effect-dice-${prepared.status}`}
 if(!prepared.result.ok)return prepared.result
 const receipt:Dnd5eTempleEntryReplay={transactionId,action:structuredClone({...input.action,effectRollDice:prepared.rolls})}
 return {...prepared.result,entryReplay:receipt}
}
