export interface PlayerVisionToken {
  id: string
  type: string
  characterId?: string
}

export function resolvePlayerVisionSourceTokenIds(input: {
  tokens: readonly PlayerVisionToken[]
  sharePartyVision: boolean
  controlledCharacterIds?: readonly (string | null | undefined)[]
}): string[] {
  const playerTokens = input.tokens.filter((token) => token.type === 'player')
  if (input.sharePartyVision) return playerTokens.map((token) => token.id)
  for (const characterId of input.controlledCharacterIds ?? []) {
    if (!characterId) continue
    const token = playerTokens.find((candidate) => candidate.characterId === characterId)
    if (token) return [token.id]
  }
  return playerTokens.length === 1 ? [playerTokens[0].id] : []
}
