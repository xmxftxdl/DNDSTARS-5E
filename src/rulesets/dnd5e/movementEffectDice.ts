import {prepareDnd5eEffectRollDice} from './prepareEffectRollDice'
import type {Dnd5eRollDiceRecipe} from './rollDiceModifiers'

/** Collect dice before the existing movement/reaction pipeline, without committing its previews. */
export async function prepareDnd5eMovementEffectDice(input:{
 resolve:(dice:Readonly<Record<string,readonly number[]>>)=>{ok?:boolean;result?:{ok:boolean}};
 roll:(recipe:Dnd5eRollDiceRecipe)=>Promise<readonly number[]|undefined>;
 isCurrent:()=>boolean;
 initialDice?:Readonly<Record<string,readonly number[]>>;
 /** Reuse only requested entries; a shorter path may not consume the full preview ledger. */
 availableDice?:Readonly<Record<string,readonly number[]>>;
}){
 if(!input.isCurrent())return {ok:false as const,reason:'movement-hazard-state-changed'}
 const prepared=await prepareDnd5eEffectRollDice({
  resolve:dice=>{const result=input.resolve({...input.initialDice,...dice});return {ok:result.ok!==false&&result.result?.ok===true}},
  roll:recipe=>!input.isCurrent()?Promise.resolve(undefined):
   Object.hasOwn(input.availableDice??{},recipe.id)?Promise.resolve(input.availableDice![recipe.id]):input.roll(recipe),
 })
 if(!input.isCurrent())return {ok:false as const,reason:'movement-hazard-state-changed'}
 // Non-dice failures (including pending falls/reactions) remain the responsibility
 // of the existing movement resolver. Do not bypass that pipeline.
 if(prepared.status==='ready'||prepared.status==='rejected')return {ok:true as const,rolls:{...input.initialDice,...prepared.rolls}}
 return {ok:false as const,reason:`movement-effect-dice-${prepared.status}`}
}
