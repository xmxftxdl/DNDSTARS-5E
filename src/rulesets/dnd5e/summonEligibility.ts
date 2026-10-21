import { getDnd5eSrdMonster } from './monsters'
import { dnd5eCreatureSubtypeMatches } from './persistentAreaCreatureFilter'
import { dnd5eChallengeRatingValue } from './wildShape'

/** Validate the resolved choice before either Activity authority path spends resources. */
export function dnd5eSummonMatchesDeclaredLimits(proposal: {
  monsterId: string
  maximumChallengeRating?: number
  requiredCreatureSubtype?: string
}): boolean {
  if (proposal.maximumChallengeRating == null && proposal.requiredCreatureSubtype == null) return true
  const monster = getDnd5eSrdMonster(proposal.monsterId)
  if (!monster) return false
  return (proposal.maximumChallengeRating == null ||
    (Number.isFinite(proposal.maximumChallengeRating) && proposal.maximumChallengeRating >= 0 &&
      dnd5eChallengeRatingValue(monster.challenge.rating) <= proposal.maximumChallengeRating)) &&
    (proposal.requiredCreatureSubtype == null ||
      dnd5eCreatureSubtypeMatches(monster.subtypes, proposal.requiredCreatureSubtype))
}
