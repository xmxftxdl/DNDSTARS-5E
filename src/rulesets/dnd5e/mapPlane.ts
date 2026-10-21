/** DM-authored scene identity. Missing data never proves that remote scenes
 * share a plane. This describes the scene, not a creature temporarily banished
 * or shifted out of it. */
export function normalizeDnd5eMapPlane(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const plane = value.normalize('NFC').trim()
  return plane && plane.length <= 120 && !/[\u0000-\u001f\u007f]/.test(plane) ? plane : undefined
}

export function dnd5eMapPlaneRelation(
  left: { id: string; dnd5ePlane?: string }, right: { id: string; dnd5ePlane?: string },
): 'same' | 'different' | 'unknown' {
  if (left.id === right.id) return 'same'
  const a = normalizeDnd5eMapPlane(left.dnd5ePlane), b = normalizeDnd5eMapPlane(right.dnd5ePlane)
  if (!a || !b) return 'unknown'
  return a === b ? 'same' : 'different'
}

/** Unknown names are not guessed; a scene already in the Ethereal cannot enter it again. */
export function dnd5eMapEtherealAccess(map: {
  dnd5ePlane?: string; dnd5eEtherealAdjacent?: boolean
}): 'adjacent' | 'unavailable' | 'unknown' {
  const plane = normalizeDnd5eMapPlane(map.dnd5ePlane)?.toLowerCase()
  if (['ethereal', 'ethereal plane', 'border ethereal', 'deep ethereal', '以太', '以太位面', '以太界', '以太边境'].includes(plane ?? '')) return 'unavailable'
  if (typeof map.dnd5eEtherealAdjacent === 'boolean') return map.dnd5eEtherealAdjacent ? 'adjacent' : 'unavailable'
  if (['material', 'material plane', 'prime material', 'prime material plane', '主物质位面', '物质位面', '物质界'].includes(plane ?? '')) return 'adjacent'
  return 'unknown'
}
