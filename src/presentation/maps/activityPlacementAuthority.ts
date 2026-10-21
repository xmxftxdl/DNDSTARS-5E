/** Snapshot all scene dependencies used to validate a movement destination.
 * Conservatively cancel if the scene changes while a remote picker is open.
 * Capture serialized values so even an in-place update cannot change the baseline.
 */
export interface ActivityPlacementAuthority {
  map: unknown
  characters: unknown
  geometry: unknown
  worldMinute: number | undefined
}

export function captureActivityPlacementAuthority(baseline: ActivityPlacementAuthority, onChanged?: (paths: readonly string[]) => void) {
  const signature = JSON.stringify(baseline)
  return (current: ActivityPlacementAuthority): boolean => {
    const currentSignature = JSON.stringify(current)
    if (currentSignature === signature) return true
    if (onChanged) {
      const paths: string[] = []
      const visit = (before: unknown, after: unknown, path: string, depth: number) => {
        if (paths.length >= 16 || JSON.stringify(before) === JSON.stringify(after)) return
        if (depth >= 8 || !before || !after || typeof before !== 'object' || typeof after !== 'object') {
          paths.push(path); return
        }
        const left = before as Record<string, unknown>, right = after as Record<string, unknown>
        const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])]
        const count = paths.length
        for (const key of keys) visit(left[key], right[key], path ? `${path}.${key}` : key, depth + 1)
        // Property ordering can also change the conservative serialized signature.
        if (paths.length === count) paths.push(path || '$')
      }
      visit(JSON.parse(signature), JSON.parse(currentSignature), '', 0)
      onChanged(paths)
    }
    return false
  }
}
