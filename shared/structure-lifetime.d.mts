export interface StructureLifetime {
 id:string;casterId:string;createdWorldMinute:number;expiresWorldMinute:number|null;entityIds:string[];
 replacementGroup?:string;siteKey?:string;
 objectBoundary?:{points:{x:number;y:number}[];bottomFeet:number;topFeet:number};
 fortressServices?:import('./fortress-services.mjs').FortressServices;
 /** Caster is always authorized; delegates use stable character IDs, or token IDs for unlinked creatures. */
 doorAccess?:{authorizedCreatureIds:string[]};
 templeWard?:import('./temple-ward.mjs').TempleWard;
}
export function normalizeStructureLifetimes(value:unknown):StructureLifetime[]|undefined;
