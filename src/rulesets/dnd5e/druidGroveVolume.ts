export interface Dnd5eGroveVolume {
  minX: number; minY: number; widthPixels: number; baseElevationFeet: number; heightFeet: number;
  excludedStructures: Array<{ points: Array<{ x: number; y: number }>; baseElevationFeet: number; heightFeet: number }>
}
export interface Dnd5eGroveDispelTarget {
  areaId: string; label: string; volume: Dnd5eGroveVolume
}
export function normalizeDnd5eGroveDispelTargets(value: unknown): Dnd5eGroveDispelTarget[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.slice(0, 1024).flatMap(v => {
    const volume = normalizeDnd5eGroveVolume(v?.volume)
    return volume && typeof v.areaId === 'string' && v.areaId.length > 0 && v.areaId.length <= 256 &&
      typeof v.label === 'string' && v.label.length <= 512 ? [{ areaId: v.areaId, label: v.label, volume }] : []
  })
}

export function normalizeDnd5eGroveVolume(value: unknown): Dnd5eGroveVolume | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const v = value as Dnd5eGroveVolume
  if (![v.minX, v.minY, v.widthPixels, v.baseElevationFeet, v.heightFeet].every(Number.isFinite) ||
    v.widthPixels <= 0 || v.minX < 0 || v.minY < 0 || v.heightFeet < 30 || v.heightFeet > 90 ||
    !Array.isArray(v.excludedStructures) || v.excludedStructures.length > 1024 || v.excludedStructures.some(s => !s ||
      !Number.isFinite(s.baseElevationFeet) || !Number.isFinite(s.heightFeet) || s.heightFeet <= 0 || !Array.isArray(s.points) ||
      s.points.length < 3 || s.points.length > 4096 || s.points.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)))) return undefined
  return { minX: v.minX, minY: v.minY, widthPixels: v.widthPixels, baseElevationFeet: v.baseElevationFeet, heightFeet: v.heightFeet,
    excludedStructures: v.excludedStructures.map(s => ({ baseElevationFeet: s.baseElevationFeet, heightFeet: s.heightFeet, points: s.points.map(p => ({ x: p.x, y: p.y })) })) }
}
