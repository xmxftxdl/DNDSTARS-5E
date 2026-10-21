export type TempleHostileType='celestial'|'elemental'|'fey'|'fiend'|'undead';
export interface TempleWard {hostileCreatureTypes:TempleHostileType[];saveDc:number;healingBonus:number;lighting:'none'|'dim'|'bright'}
export const TEMPLE_HOSTILE_TYPES:readonly TempleHostileType[];
export function normalizeTempleWard(value:unknown):TempleWard|undefined;
