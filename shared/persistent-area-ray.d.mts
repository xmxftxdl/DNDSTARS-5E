import type { BattleMap, Dnd5ePluginArea } from '../src/store/maps'
export interface PersistentAreaRayInput {
  map: Pick<BattleMap, 'gridSize' | 'tokens'> & Partial<Pick<BattleMap, 'gridOffsetX' | 'gridOffsetY' | 'feetPerCell' | 'dnd5ePluginAreas'>>;
  from: {x:number;y:number}; to: {x:number;y:number}; fromElevationFeet:number; toElevationFeet:number;
  fromEyeHeightFeet:number; toEyeHeightFeet:number;
  purpose:'opaque-cover'|'vision'|'line-of-effect'|'movement'|'ordinary-projectile'|'ranged-weapon-disadvantage'|'damage-attenuation';
  damageType?:import('../src/rulesets/dnd5e/damageTypes').Dnd5eDamageType;
  overlapsHeight:(area:Dnd5ePluginArea,elevation:number,height:number)=>boolean;
  /** Opt into exact movement intersections for locating a physical projectile impact. */
  exactCellIntersection?:true;
}
export function persistentAreaBlocksRay(input:PersistentAreaRayInput):string|undefined

export function persistentAreaVolumeRayIntersections(input:{map:PersistentAreaRayInput['map'];area:Dnd5ePluginArea;
 from:{x:number;y:number};to:{x:number;y:number};fromElevationFeet:number;toElevationFeet:number}):
 {cell:{col:number;row:number};fromT:number;toT:number;fromElevationFeet:number;toElevationFeet:number}[]
