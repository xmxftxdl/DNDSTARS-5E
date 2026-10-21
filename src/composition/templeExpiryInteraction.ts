import type {Dnd5eHeadlessCombatState,Dnd5eUnsupportedAirborneFallPreview} from '../rulesets/dnd5e/headlessCombatEngine'
import type {Dnd5eSolidExitFeatherFallChoice} from '../rulesets/dnd5e/solidMaterialExitSettlement'
import type {BattleMap} from '../store/maps'

export interface TempleExpiryInteraction {
 chooseFeatherFall:(state:Dnd5eHeadlessCombatState,falls:readonly Dnd5eUnsupportedAirborneFallPreview[],map:BattleMap,transactionId:string)=>Promise<Dnd5eSolidExitFeatherFallChoice|undefined>
 rollFalls:(falls:readonly Dnd5eUnsupportedAirborneFallPreview[],map:BattleMap)=>Promise<Readonly<Record<string,readonly number[]>>>
}
let interaction:TempleExpiryInteraction|undefined
let activate:(()=>void)|undefined
const listeners=new Set<()=>void>()
const notify=()=>{for(const listener of [...listeners])listener()}
export const getTempleExpiryInteraction=()=>interaction
export function registerTempleExpiryInteraction(value:TempleExpiryInteraction){
 interaction=value;notify()
 return ()=>{if(interaction===value){interaction=undefined;notify()}}
}
export function registerTempleExpiryInteractionActivation(value:()=>void){
 activate=value;notify()
 return ()=>{if(activate===value){activate=undefined;notify()}}
}

/** Open the actual interaction workspace; never invent dice or decline for the player. */
export async function requireTempleExpiryInteraction():Promise<TempleExpiryInteraction>{
 if(interaction)return interaction
 const activation=activate
 if(!activation)throw Error('temple-expiry-host-interaction-unavailable')
 await new Promise<TempleExpiryInteraction>((resolve,reject)=>{
  const finish=(value?:TempleExpiryInteraction)=>{
   clearTimeout(timer);listeners.delete(check)
   if(value)resolve(value);else reject(Error('temple-expiry-host-interaction-unavailable'))
  }
  const check=()=>{
   if(activation!==activate)finish()
   else if(interaction)finish(interaction)
  }
  const timer=setTimeout(()=>finish(),60_000)
  listeners.add(check)
  try{activation();check()}catch{finish()}
 })
 // React can register, clean up and register again in the same mount cycle.
 // No choice has started yet: capture the surviving owner after that cycle.
 if(activate!==activation||!interaction)throw Error('temple-expiry-host-interaction-unavailable')
 return interaction
}
