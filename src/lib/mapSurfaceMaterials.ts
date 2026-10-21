export const MAP_SURFACE_MATERIALS = ['solid', 'sand', 'dust', 'loose-earth', 'gravel', 'stone', 'ice', 'snow', 'earth', 'mud', 'quicksand'] as const
export type MapSurfaceMaterial = typeof MAP_SURFACE_MATERIALS[number]

export function validMapSurfaceMaterials(value: unknown): value is readonly MapSurfaceMaterial[] {
  return Array.isArray(value) && value.length > 0 &&
    new Set(value).size === value.length &&
    value.every(material => typeof material === 'string' && (MAP_SURFACE_MATERIALS as readonly string[]).includes(material))
}
