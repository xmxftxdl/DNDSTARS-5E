export interface StructureStairPath {
  schemaVersion: 1;
  widthFeet: number;
  widthMapUnits?: number;
  thicknessInches?: number;
  points: { x: number; y: number; elevationFeet: number }[];
}
export function normalizeStructureStairPath(value: unknown): StructureStairPath | undefined;
export function structureStairRayHit(path: StructureStairPath, scale: number,
  from: {x:number;y:number;elevationFeet:number}, to: {x:number;y:number;elevationFeet:number}, bodyHeightFeet?:number): number | undefined;
export function structureStairBodyHit(path: StructureStairPath, scale: number,
  from: {x:number;y:number;elevationFeet:number}, to: {x:number;y:number;elevationFeet:number}, halfWidthMapUnits:number,heightFeet:number): number | undefined;
