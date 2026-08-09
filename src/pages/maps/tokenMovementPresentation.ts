import type { TokenMovementAnimation } from '../../lib/tokenMovementAnimation'
import type { Dnd5eMapResultPlan } from '../../rulesets/dnd5e'

export type TokenMovementPresentation = TokenMovementAnimation | null

/**
 * Adds authoritative movement presentation metadata to both representations
 * carried by a Headless result. Entity commits prefer `tokenPatches` over the
 * full map Token, so decorating only `map.tokens` makes the final coordinates
 * jump immediately and drops the path line on every client.
 *
 * `null` explicitly clears an older animation for an instant placement.
 */
export function withTokenMovementPresentations(input: {
  application: Dnd5eMapResultPlan
  byTokenId: Readonly<Record<string, TokenMovementPresentation>>
}): Dnd5eMapResultPlan {
  const changedTokenIds = new Set(input.application.changedTokenIds)
  const entries = Object.entries(input.byTokenId)
    .filter(([tokenId]) => changedTokenIds.has(tokenId))
  if (entries.length === 0) return input.application

  const presentationByTokenId = new Map(entries)
  const tokens = input.application.map.tokens.map((token) => {
    if (!presentationByTokenId.has(token.id)) return token
    const presentation = presentationByTokenId.get(token.id)
    return {
      ...token,
      movementAnimation: presentation ?? undefined,
    }
  })
  const tokenPatches = input.application.tokenPatches
    ? { ...input.application.tokenPatches }
    : undefined
  if (tokenPatches) {
    for (const [tokenId, presentation] of entries) {
      // A missing patch deliberately tells the commit coordinator to apply the
      // complete map Token. Creating an animation-only patch here would then
      // discard its new x/y, HP or state fields.
      if (!Object.prototype.hasOwnProperty.call(tokenPatches, tokenId)) continue
      tokenPatches[tokenId] = {
        ...tokenPatches[tokenId],
        movementAnimation: presentation ?? undefined,
      }
    }
  }

  return {
    ...input.application,
    map: { ...input.application.map, tokens },
    ...(tokenPatches ? { tokenPatches } : {}),
  }
}
