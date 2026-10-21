import type { Dnd5ePhysicalFlame } from '../src/rulesets/dnd5e/controlledFlame'
export function normalizeControlledFlameState(value: unknown): Dnd5ePhysicalFlame | undefined
export function controlledFlameAppearance(flame: Dnd5ePhysicalFlame, worldMinute: number): { enabled: boolean; brightRadiusFeet: number; dimRadiusFeet: number; color: string; shape?: string }
export function projectControlledFlameLight<T>(light: T, worldMinute: number | null): T
