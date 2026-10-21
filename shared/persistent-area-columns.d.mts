import type { Dnd5ePluginArea } from '../src/store/maps'
export function persistentAreaHeightSlices(area: Dnd5ePluginArea): Dnd5ePluginArea[]
export function validPersistentAreaColumns(value: unknown): boolean

export function subtractPersistentAreaColumnBand(area:Dnd5ePluginArea,cells:readonly {col:number;row:number}[],bottom:number,top:number):Dnd5ePluginArea|undefined
