export function normalizeDeletedMapIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id =>
    typeof id === 'string' && id.trim().length > 0 && id.length <= 256))].sort() : []
}

/** Derive deletion evidence from committed server state, never a caller's invented IDs. */
export function mergeMapsDeletionHistory(current, incoming) {
  if (!incoming || !Array.isArray(incoming.maps)) return incoming
  const live = new Set(incoming.maps.map(map => map?.id))
  const deletedMapIds = normalizeDeletedMapIds([
    ...normalizeDeletedMapIds(current?.deletedMapIds),
    ...(Array.isArray(current?.maps) ? current.maps.flatMap(map =>
      typeof map?.id === 'string' && !live.has(map.id) ? [map.id] : []) : []),
  ])
  const { deletedMapIds: ignored, ...rest } = incoming
  void ignored
  return deletedMapIds.length ? { ...rest, deletedMapIds } : rest
}
