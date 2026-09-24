// Persistent effects and saving-throw status must still restore after navigation.
const ONE_SHOT_TYPES = new Set([
  'spell-banner', 'attack-banner', 'kill-streak', 'spell-projectile',
  'spell-area-projectile', 'spell-area-effect', 'spell-target-effect',
  'spell-save-target-effect', 'attack-target-effect',
])

/** Deduplicate transient presentation IDs across both remounts and full reloads. */
export function createCombatPresentationReplayFilter(
  storage: () => Pick<Storage, 'getItem' | 'setItem'> | undefined,
  scope: 'published' | 'received',
) {
  const memory = new Set<string>()
  const key = `astraltrace:combat-presentation:${scope}:v1`
  return (event: unknown): boolean => {
    if (!event || typeof event !== 'object') return true
    const data = event as { type?: unknown; mapId?: unknown; id?: unknown }
    if (typeof data.type !== 'string' || !ONE_SHOT_TYPES.has(data.type) ||
        typeof data.mapId !== 'string' || typeof data.id !== 'string') return true
    const identity = JSON.stringify([data.mapId, data.type, data.id])
    let backend: ReturnType<typeof storage>
    try {
      backend = storage()
      const saved = JSON.parse(backend?.getItem(key) ?? '[]')
      if (Array.isArray(saved)) for (const id of saved) if (typeof id === 'string') memory.add(id)
    } catch { /* In-memory deduplication remains available without storage. */ }
    if (memory.has(identity)) return false
    memory.add(identity)
    while (memory.size > 1000) memory.delete(memory.values().next().value!)
    try { backend?.setItem(key, JSON.stringify([...memory])) } catch { /* Keep memory. */ }
    return true
  }
}
