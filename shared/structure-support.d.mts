interface StructureSupportContext {
  map: {gridSize:number;feetPerCell?:number;width:number;height:number};
  geometry?: unknown;
  creatureWidthFeet:number;
}
export function structureStairStepElevation(input: StructureSupportContext & {from:{x:number;y:number};to:{x:number;y:number};fromElevationFeet:number}):number|undefined;
export function structureSupportingElevation(input: StructureSupportContext & {position:{x:number;y:number};elevationFeet:number;terrainElevationFeet:number}):number;
