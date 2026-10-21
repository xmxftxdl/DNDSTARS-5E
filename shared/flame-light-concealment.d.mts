import type { Dnd5ePluginArea } from '../src/store/maps'
export interface FlameLight { sourceKind?: string; flame?: boolean; flameProtected?: boolean; flameSize?: 'torch-or-smaller' | 'larger' }
export interface FlameLightPoint { x: number; y: number; elevationFeet?: number }
export function isFlameLight(light: FlameLight | undefined): boolean
export function isFlameProtected(light: FlameLight | undefined): boolean
export function flameLightConcealed(input: {
  areas?: readonly Dnd5ePluginArea[]; light?: FlameLight; source: FlameLightPoint; observer: FlameLightPoint;
  contains: (area: Dnd5ePluginArea, point: FlameLightPoint) => boolean;
}): boolean

export function isTorchSizedFlame(light: FlameLight | undefined): boolean
