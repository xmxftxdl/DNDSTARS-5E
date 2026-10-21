import {MAP_SURFACE_MATERIALS,type MapSurfaceMaterial} from '../../lib/mapSurfaceMaterials'

/** Explicit scene dimensions, independent of the Token's icon footprint. */
export interface Dnd5eMapObjectSurface {
  /** Original surface identity, retained through inventory and subsequent map Tokens. */
  surfaceId?:string
  material:MapSurfaceMaterial
  widthFeet:number
  lengthFeet:number
  heightFeet:number
  rotationDegrees:number
}
export function normalizeDnd5eMapObjectSurface(value:unknown):Dnd5eMapObjectSurface|undefined{
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined
  const raw=value as Record<string,unknown>
  if(Object.keys(raw).some(key=>!['surfaceId','material','widthFeet','lengthFeet','heightFeet','rotationDegrees'].includes(key))||
    (raw.surfaceId != null && (typeof raw.surfaceId !== 'string' || !raw.surfaceId.trim() || raw.surfaceId.length>240 || /[\u0000-\u001f]/.test(raw.surfaceId))) ||
    !(MAP_SURFACE_MATERIALS as readonly unknown[]).includes(raw.material)||
    ![raw.widthFeet,raw.lengthFeet,raw.heightFeet].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=100000)||
    typeof raw.rotationDegrees!=='number'||!Number.isFinite(raw.rotationDegrees)||raw.rotationDegrees<0||raw.rotationDegrees>=360)return undefined
  return {...(typeof raw.surfaceId === 'string' ? {surfaceId:raw.surfaceId} : {}),material:raw.material as MapSurfaceMaterial,widthFeet:raw.widthFeet as number,lengthFeet:raw.lengthFeet as number,
    heightFeet:raw.heightFeet as number,rotationDegrees:raw.rotationDegrees}
}
