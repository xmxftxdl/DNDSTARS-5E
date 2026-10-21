import type { Character } from '../../types/character'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from './activeEffects'
import { registeredDnd5ePluginFeatures, dnd5eCharacterHasPluginFeature } from './plugins/pluginContentCatalog'

const prefix = 'feature-light:'
/** Reconstruct from current entitlement, retaining the user's separate off marker across reloads. */
export function dnd5eInherentFeatureLightEffects(character: Character | undefined, effects: readonly Dnd5eActiveEffectInstance[] | undefined) {
  const persisted = normalizeDnd5eActiveEffects(effects).filter(effect => !effect.tags?.some(tag => tag.startsWith(prefix)))
  if (!character) return persisted
  const projected = registeredDnd5ePluginFeatures().flatMap(feature => {
    const light = feature.staticModifiers?.inherentLight
    if (!light || feature.automation === 'manual' || !dnd5eCharacterHasPluginFeature(character, feature.id) ||
      (light.disabledByEffectTag && persisted.some(effect => effect.tags?.includes(light.disabledByEffectTag!)))) return []
    const tag = `${prefix}${feature.id}`
    return [createDnd5eMechanicalEffect({ id: tag, definitionId: tag, label: feature.name, targetId: character.id,
      appliedAt: 0, source: { kind: 'feature', rulesId: feature.id, actorId: character.id, characterId: character.id, magical: true },
      duration: { type: 'permanent' }, tags: [tag], modifiers: { emittedLight: {
        brightRadiusFeet: light.brightRadiusFeet, dimRadiusFeet: light.dimRadiusFeet, color: light.color,
      } },
    })]
  })
  return [...persisted, ...projected]
}
