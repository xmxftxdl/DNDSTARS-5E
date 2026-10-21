import {normalizeSurfaceDrawing} from '../../../shared/surface-drawing-state.mjs'
export {normalizeSurfaceDrawing}
/** Coordinates and brush width are relative to the selected surface, not pixels. */
export interface SurfaceDrawing {
  version: 1
  strokes: {points: number[]; color: string; width: number}[]
}

export function parseSurfaceDrawing(value: unknown): SurfaceDrawing | undefined {
  if(typeof value!=='string'||value.length>65536)return undefined
  try{return normalizeSurfaceDrawing(JSON.parse(value))}catch{return undefined}
}

