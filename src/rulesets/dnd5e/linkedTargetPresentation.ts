import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { getEnemyVisualPresentation } from '../../lib/enemyPool'

import { normalizeDnd5eLinkedTargetPresentation } from './linkedTargetPresentationSchema'
export { normalizeDnd5eLinkedTargetPresentation } from './linkedTargetPresentationSchema'
export type { Dnd5eLinkedTargetPresentation } from './linkedTargetPresentationSchema'

/** Enrich newly captured identities at the authoritative map boundary, once. */
export function captureDnd5eLinkedTargetPresentations(state: Dnd5eHeadlessCombatState, map: BattleMap, characters: readonly Character[]): void {
  for (const owner of Object.values(state.combatants)) {
    for (const controller of owner.classState.activeEffects ?? []) {
      const identity = controller.capturedCreatureIdentity
      if (identity && !identity.presentationCaptured) {
        const tokens = map.tokens.filter(token => token.id === identity.actorId)
        const token = tokens.length === 1 ? tokens[0] : undefined
        const character = token?.characterId ? characters.find(candidate => candidate.id === token.characterId) : undefined
        const imageId = token?.tokenPortraitImageId || token?.portraitImageId
        const catalogPortrait = token?.poolId && !imageId
          ? getEnemyVisualPresentation(token.poolId, token.visualVariantId)?.tokenPortrait
          : undefined
        const presentation = token ? normalizeDnd5eLinkedTargetPresentation({
          emoji: character?.avatar || token.emoji, color: token.color, size: token.size,
          tokenPortrait: token.tokenPortrait || character?.tokenPortrait || character?.portrait || token.portrait || catalogPortrait,
          tokenPortraitImageId: imageId,
          poolId: token.poolId,
        }) : undefined
        // Missing artwork is also final: a later token with the same id must
        // never silently replace the appearance remembered at capture time.
        controller.capturedCreatureIdentity = { ...identity, presentationCaptured: true,
          ...(presentation ? { presentation } : {}) }
      }
      if (!controller.linkedTargetSnapshots?.some(entry => !entry.presentation)) continue
      controller.linkedTargetSnapshots = controller.linkedTargetSnapshots.map(entry => {
        if (entry.presentation) return entry
        const dependant = state.combatants[entry.actorId]?.classState.activeEffects?.find(effect => effect.id === entry.effectId)
        if (dependant?.removal?.sourceLink?.sourceRequiresEffectInstanceId !== controller.id) return entry
        const tokens = map.tokens.filter(token => token.id === entry.actorId)
        if (tokens.length !== 1) return entry
        const token = tokens[0]
        const character = characters.find(candidate => candidate.id === token.characterId)
        const portrait = token.tokenPortrait || character?.tokenPortrait || character?.portrait
        const imageId = token.tokenPortraitImageId || token.portraitImageId
        const presentation = normalizeDnd5eLinkedTargetPresentation({ emoji: character?.avatar || token.emoji, color: token.color, size: token.size,
          ...(portrait ? { tokenPortrait: portrait } : {}),
          ...(imageId ? { tokenPortraitImageId: imageId } : {}),
          ...(token.poolId ? { poolId: token.poolId } : {}) })
        return presentation ? { ...entry, presentation } : entry
      })
    }
  }
}

