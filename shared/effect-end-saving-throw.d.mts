import type {Dnd5eActiveEffectInstance} from '../src/rulesets/dnd5e/activeEffects'
import type {AbilityKey} from '../src/lib/dnd'
export interface Dnd5eEffectEndSavingThrow {ability:AbilityKey;dc:number;exhaustionOnFailure:number}
export function validDnd5eEffectEndSavingThrow(value:unknown):value is Dnd5eEffectEndSavingThrow
export function retainDnd5eEndedEffectSavingThrows(before:readonly Dnd5eActiveEffectInstance[],after:readonly Dnd5eActiveEffectInstance[]):Dnd5eActiveEffectInstance[]
