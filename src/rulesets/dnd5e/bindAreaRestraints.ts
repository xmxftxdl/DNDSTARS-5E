import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eActiveEffectInstance } from './activeEffects'
import { tokenOccupiedCellsAt } from '../../lib/gridCombat'

/** Bind only declared restraints belonging to this source and occupying this instance. */
export function bindDnd5eAreaRestraints(input: {
  map: BattleMap; characters: readonly Character[]; area: Dnd5ePluginArea; effectIds: readonly string[]
}): { map: BattleMap; characters: readonly Character[]; changedTokenIds: string[]; changedCharacterIds: string[] } {
  const keys = new Set(input.area.cells.map(cell => `${cell.col}:${cell.row}`))
  const changedTokenIds: string[] = [], changedCharacterIds: string[] = []
  let characters = input.characters
  const tokens = input.map.tokens.map(token => {
    if (!tokenOccupiedCellsAt(token, input.map, token).some(cell => keys.has(`${cell.col}:${cell.row}`))) return token
    const character = token.characterId && !token.dnd5eSimulacrum
      ? characters.find(candidate => candidate.id === token.characterId) : undefined
    const combat = character?.dnd5eCombatState ?? token.dnd5eCombatState
    let changed = false
    const activeEffects = combat?.activeEffects?.map((effect): Dnd5eActiveEffectInstance => {
      if (effect.standardCondition !== 'restrained' || effect.source.actorId !== input.area.sourceTokenId ||
        effect.source.rulesId !== (input.area.coreSpellId ?? `${input.area.pluginId}:${input.area.featureId}`) ||
        effect.areaLifetime || !input.effectIds.some(id => effect.definitionId === `activity:${effect.source.rulesId}:${id}`)) return effect
      changed = true
      const legacyTag = `persistent-area:${input.area.id}`
      const tags = [...(effect.tags ?? []).filter(tag => !tag.startsWith('persistent-area:'))]
      // Long runtime IDs belong in areaLifetime, not the bounded legacy tag field.
      if (/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(legacyTag)) tags.push(legacyTag)
      return { ...effect, tags: tags.length ? tags : undefined,
        areaLifetime: { mapId: input.map.id, areaId: input.area.id, sourceActorId: input.area.sourceTokenId } }
    })
    if (!changed) return token
    const dnd5eCombatState = { ...combat, activeEffects }
    changedTokenIds.push(token.id)
    if (character) {
      changedCharacterIds.push(character.id)
      characters = characters.map(candidate => candidate.id === character.id ? { ...candidate, dnd5eCombatState } : candidate)
    }
    return { ...token, dnd5eCombatState }
  })
  return { map: changedTokenIds.length ? { ...input.map, tokens } : input.map, characters, changedTokenIds, changedCharacterIds }
}
