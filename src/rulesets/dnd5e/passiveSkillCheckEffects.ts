import type { Character } from '../../types/character'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from './activeEffects'
import { runtimeDnd5ePluginFeatures, dnd5eCharacterHasPluginFeature } from './plugins/pluginContentCatalog'

const prefix = 'passive-skill-checks:'
/** Rebuild from current entitlement; persisted copies cannot outlive level/subclass ownership. */
export function dnd5ePassiveSkillCheckEffects(character: Character, effects: readonly Dnd5eActiveEffectInstance[] | undefined) {
  const persisted = normalizeDnd5eActiveEffects(effects).filter(effect => !effect.tags?.some(tag => tag.startsWith(prefix)))
  const projected = runtimeDnd5ePluginFeatures().flatMap(feature => {
    const ability = feature.declarativeAbility
    const mechanic = ability?.mechanic
    if (feature.automation === 'manual' || ability?.automation !== 'full' || ability.trigger.kind !== 'passive' ||
      mechanic?.kind !== 'passive-skill-checks' || !dnd5eCharacterHasPluginFeature(character, feature.id)) return []
    const tag = `${prefix}${feature.id}`
    return [createDnd5eMechanicalEffect({ id: tag, definitionId: tag, label: feature.name, targetId: character.id,
      appliedAt: 0, source: { kind: 'feature', rulesId: feature.id, actorId: character.id, characterId: character.id },
      duration: { type: 'permanent' }, tags: [tag], modifiers: {
        minimumSkillCheckD20: mechanic.minimumSkillCheckD20,
        skillCheckAdvantagesWithinHalfSpeed: mechanic.skillCheckAdvantagesWithinHalfSpeed,
      },
    })]
  })
  return [...persisted, ...projected]
}
