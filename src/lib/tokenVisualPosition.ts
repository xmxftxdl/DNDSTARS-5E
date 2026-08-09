export interface TokenVisualLayerLike {
  batchDraw: () => void
}

export interface TokenVisualNodeLike {
  cancelPositionAnimation?: () => void
  setPositionLocked?: (locked: boolean) => void
  position: (point: { x: number; y: number }) => void
  getPosition?: () => { x: number; y: number }
  getLayer: () => TokenVisualLayerLike | null
}

/** Reads the live rendered position of one of a Token's synchronized layers. */
export function tokenVisualNodesDisplayPosition(
  nodes: Iterable<TokenVisualNodeLike> | undefined,
): { x: number; y: number } | undefined {
  if (!nodes) return undefined
  for (const node of nodes) {
    const point = node.getPosition?.()
    if (point) return { x: point.x, y: point.y }
  }
  return undefined
}

export function setTokenVisualNodesPositionLocked(
  nodes: Iterable<TokenVisualNodeLike>,
  locked: boolean,
): number {
  let count = 0
  for (const node of nodes) {
    node.setPositionLocked?.(locked)
    count += 1
  }
  return count
}

/** Moves every detached visual for one Token in a single presentation frame. */
export function syncTokenVisualNodes(
  nodes: Iterable<TokenVisualNodeLike>,
  point: { x: number; y: number },
): number {
  const layers = new Set<TokenVisualLayerLike>()
  let count = 0
  for (const node of nodes) {
    // A second drag may begin while the previous authoritative movement rAF is
    // still running. Stop it before writing the live pointer position, or the
    // old animation can overwrite this node again on the very next frame.
    node.cancelPositionAnimation?.()
    node.position(point)
    const layer = node.getLayer()
    if (layer) layers.add(layer)
    count += 1
  }
  for (const layer of layers) layer.batchDraw()
  return count
}

/**
 * Commits the final position while detached Token layers are still locked,
 * then releases the lock. This prevents a layer whose React position effect
 * was skipped during dragging from remaining at the drag origin.
 */
export function releaseTokenVisualNodesAtPosition(
  nodes: Iterable<TokenVisualNodeLike>,
  point: { x: number; y: number },
): number {
  const snapshot = Array.from(nodes)
  syncTokenVisualNodes(snapshot, point)
  setTokenVisualNodesPositionLocked(snapshot, false)
  return snapshot.length
}
