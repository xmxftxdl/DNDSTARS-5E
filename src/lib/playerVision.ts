export interface PlayerVisionToken {
  id: string
  type: string
  characterId?: string
  /** Server-only projection hint. It is recomputed for every player response. */
  viewerControlled?: boolean
  dnd5eSpellEffect?: {
    sourceCharacterId?: string
    shareVisionWithSource?: true
  }
}

export function resolvePlayerVisionSourceTokenIds(input: {
  tokens: readonly PlayerVisionToken[]
  sharePartyVision: boolean
  controlledCharacterIds?: readonly (string | null | undefined)[]
  /** Host-derived temporary sense origins such as a familiar. */
  sharedVisionTokenIds?: readonly string[]
  /** Characters whose own senses are suppressed while using a remote origin. */
  suppressedVisionCharacterIds?: readonly string[]
}): string[] {
  const suppressed = new Set(input.suppressedVisionCharacterIds ?? [])
  const playerTokens = input.tokens.filter((token) =>
    token.type === 'player' && (!token.characterId || !suppressed.has(token.characterId)))
  const sharedEffectTokens = input.tokens.filter((token) =>
    token.dnd5eSpellEffect?.shareVisionWithSource === true &&
    (
      token.viewerControlled === true ||
      (input.controlledCharacterIds ?? []).some((characterId) =>
        !!characterId && characterId === token.dnd5eSpellEffect?.sourceCharacterId)
    )
  )
  const explicitSharedTokens = input.tokens.filter((token) =>
    input.sharedVisionTokenIds?.includes(token.id))
  if (input.sharePartyVision) {
    return [...new Set([
      ...playerTokens.map((token) => token.id),
      ...sharedEffectTokens.map((token) => token.id),
      ...explicitSharedTokens.map((token) => token.id),
    ])]
  }
  const projectedControlledTokens = playerTokens.filter((token) => token.viewerControlled === true)
  const locallyControlledTokens = projectedControlledTokens.length > 0
    ? projectedControlledTokens
    : playerTokens.filter((token) =>
        !!token.characterId && (input.controlledCharacterIds ?? []).includes(token.characterId))
  if (projectedControlledTokens.length > 0 || sharedEffectTokens.length > 0 || explicitSharedTokens.length > 0) {
    return [...new Set([
      ...locallyControlledTokens.map((token) => token.id),
      ...sharedEffectTokens.map((token) => token.id),
      ...explicitSharedTokens.map((token) => token.id),
    ])]
  }
  for (const characterId of input.controlledCharacterIds ?? []) {
    if (!characterId) continue
    const token = playerTokens.find((candidate) => candidate.characterId === characterId)
    if (token) return [token.id]
  }
  return playerTokens.length === 1 ? [playerTokens[0].id] : []
}
