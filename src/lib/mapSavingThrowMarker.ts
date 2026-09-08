import { tokenDisplayRadius } from './gridCombat'

export interface MapSavingThrowMarkerMetricsInput {
  gridSize: number
  tokenSize?: number
  viewScale: number
  builtinGrid?: boolean
}

/** Keeps the save marker attached to the Token at every map zoom level. */
export function mapSavingThrowMarkerDiameter(input: MapSavingThrowMarkerMetricsInput): number {
  const tokenScreenDiameter = tokenDisplayRadius(
    input.gridSize,
    input.tokenSize,
    input.builtinGrid,
  ) * 2 * Math.max(0.01, input.viewScale)
  const screenGap = Math.min(8, Math.max(3, tokenScreenDiameter * 0.12))
  return Math.max(12, tokenScreenDiameter + screenGap)
}

export function mapSavingThrowMarkerUsesCompactLabel(diameter: number): boolean {
  return diameter < 56
}
