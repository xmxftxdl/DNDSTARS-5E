import type { MapGeometryState } from '../../lib/mapGeometry'

/** A persistence timestamp is not a geometry rule change. Keep every actual
 * scene dependency (including expiry records), but ignore redundant saves.
 */
export function attackTeleportGeometryAuthority(geometry: MapGeometryState | undefined) {
  if (!geometry) return undefined
  const { updatedAt: _updatedAt, ...scene } = geometry
  return scene
}
