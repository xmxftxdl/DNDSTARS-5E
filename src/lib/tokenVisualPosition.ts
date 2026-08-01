export interface TokenVisualLayerLike {
  batchDraw: () => void
}

export interface TokenVisualNodeLike {
  cancelPositionAnimation?: () => void
  setPositionLocked?: (locked: boolean) => void
  position: (point: { x: number; y: number }) => void
  getLayer: () => TokenVisualLayerLike | null
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
