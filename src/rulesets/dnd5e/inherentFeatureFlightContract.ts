/** A source-owned magical flight speed; does not change the walking speed. */
export interface Dnd5eInherentFeatureFlight {speedFeet:number}
export function validDnd5eInherentFeatureFlight(value:unknown):value is Dnd5eInherentFeatureFlight {
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const flight=value as Dnd5eInherentFeatureFlight
 return Object.keys(value).length===1&&Object.keys(value)[0]==='speedFeet'&&Number.isInteger(flight.speedFeet)&&flight.speedFeet>=1&&flight.speedFeet<=1000
}
