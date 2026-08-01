export interface LatestTokenMovePreviewTracker {
  begin: (tokenId: string) => number
  complete: (tokenId: string, generation: number) => boolean
  isPending: (tokenId: string) => boolean
}

/**
 * Tracks direct room moves without locking the Token against another drag.
 * Completing an older queued save must never release a newer drag preview.
 */
export function createLatestTokenMovePreviewTracker(): LatestTokenMovePreviewTracker {
  let nextGeneration = 0
  const latestGenerationByToken = new Map<string, number>()

  return {
    begin(tokenId) {
      const generation = ++nextGeneration
      latestGenerationByToken.set(tokenId, generation)
      return generation
    },
    complete(tokenId, generation) {
      if (latestGenerationByToken.get(tokenId) !== generation) return false
      latestGenerationByToken.delete(tokenId)
      return true
    },
    isPending(tokenId) {
      return latestGenerationByToken.has(tokenId)
    },
  }
}
