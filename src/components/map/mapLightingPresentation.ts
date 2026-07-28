import type { MapGeometryVisionSettings } from '../../lib/mapGeometry'

export type MapAmbientLight = MapGeometryVisionSettings['ambientLight']

export function mapLightingAmbientOpacity(ambientLight: MapAmbientLight, isDM: boolean): number {
  if (ambientLight === 'bright') return 0
  if (ambientLight === 'dim') return isDM ? 0.24 : 0.34
  return isDM ? 0.74 : 0.9
}

/** Alpha removed from the darkness mask so darkvision renders darkness as dim light. */
export function mapLightingDarkvisionCutoutOpacity(
  ambientLight: MapAmbientLight,
  isDM: boolean,
): number {
  if (isDM || ambientLight === 'bright') return 0
  if (ambientLight === 'dim') return 1
  const darknessOpacity = mapLightingAmbientOpacity('darkness', false)
  const dimOpacity = mapLightingAmbientOpacity('dim', false)
  return 1 - dimOpacity / darknessOpacity
}

export function mapLightingShouldRender(
  ambientLight: MapAmbientLight,
  hasMagicalDarkness: boolean,
): boolean {
  return ambientLight !== 'bright' || hasMagicalDarkness
}

export function mapLightingRadiusFromDrag(input: {
  distancePixels: number
  gridSize: number
  feetPerCell: number
}): number {
  if (input.distancePixels < 4) return 20
  return Math.max(5, Math.round(
    input.distancePixels / Math.max(1, input.gridSize) * Math.max(1, input.feetPerCell),
  ))
}

export function mapLightingGlowOpacity(
  band: 'bright' | 'dim',
  ambientLight: MapAmbientLight,
  isDM: boolean,
): number {
  if (ambientLight === 'bright') return band === 'bright' ? 0.05 : 0.025
  if (band === 'bright') return isDM ? 0.18 : 0.14
  return isDM ? 0.09 : 0.07
}
