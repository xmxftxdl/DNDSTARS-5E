import type { Dnd5eGroveVolume } from '../src/rulesets/dnd5e/druidGroveVolume'
export function groveVolumeOverlaps(volume: Dnd5eGroveVolume | undefined, point: { x: number; y: number }, base: number, height?: number): boolean
export function groveCellVisionSegments(volume: Dnd5eGroveVolume, box: { x: number; y: number; size: number; height?: number }, base: number, height: number): Array<{a:{x:number;y:number};b:{x:number;y:number};baseHeightFeet:number;heightFeet:number}>
export function groveAreaFootprintOverlaps(volume: Dnd5eGroveVolume | undefined, cells: readonly {col:number;row:number}[], map: {gridSize:number;gridOffsetX?:number;gridOffsetY?:number}, position:{x:number;y:number}, halfSize:number, base:number, height:number): boolean
