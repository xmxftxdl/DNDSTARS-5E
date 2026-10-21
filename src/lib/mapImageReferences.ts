import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import type { Dnd5eActiveEffectInstance } from '../rulesets/dnd5e/activeEffects'

/** Shared portraits can outlive their original token through a captured projection. */
export function referencedMapImageIds(maps: readonly BattleMap[], characters: readonly Character[] = []): Set<string> {
  const ids = new Set<string>()
  const add = (id: string | undefined) => { if (id) ids.add(id) }
  const effects = (values: readonly Dnd5eActiveEffectInstance[] | undefined) => {
    for (const effect of values ?? []) for (const target of effect.linkedTargetSnapshots ?? []) add(target.presentation?.tokenPortraitImageId)
  }
  for (const map of maps) {
    add(map.id)
    for (const note of map.viewportNotes ?? []) add(note.imageId)
    for (const token of map.tokens) {
      add(token.portraitImageId); add(token.tokenPortraitImageId)
      add(token.dnd5eSpellEffect?.linkedTargetProjection?.presentation.tokenPortraitImageId)
      effects(token.dnd5eCombatState?.activeEffects)
    }
  }
  for (const character of characters) effects(character.dnd5eCombatState?.activeEffects)
  return ids
}
