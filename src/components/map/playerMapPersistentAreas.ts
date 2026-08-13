import { getDnd5eCoreSpellAreaDeclaration } from '../../rulesets/dnd5e/coreSpellAreas'
import {
  dnd5eSpellcastingClassIdForSpell,
  dnd5eSustainedSpellControlLabel,
  getDnd5eSrdCombatSpell,
} from '../../rulesets/dnd5e'
import type { Dnd5eSustainedSpellControlId } from '../../lib/sharedCombatTypes'
import { dnd5eUtilityProjectionMovementEconomy } from '../../rulesets/dnd5e/utilityProjection'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'

export function playerMapMovablePersistentAreas(map: BattleMap, character: Character) {
  return (map.dnd5ePluginAreas ?? []).flatMap((area) => {
    const movement = area.movement ?? (area.coreSpellId
      ? getDnd5eCoreSpellAreaDeclaration(area.coreSpellId)?.movement
      : undefined)
    return area.sourceKind === 'core-spell' &&
      area.sourceCharacterId === character.id &&
      movement
        ? [{
            id: area.id,
            label: area.label,
            economy: area.coreSpellId
              ? dnd5eUtilityProjectionMovementEconomy(character, area.coreSpellId, movement.economy)
              : movement.economy,
            maximumFeet: movement.maximumFeet,
            coreSpellId: area.coreSpellId,
          }]
        : []
  })
}

export interface PlayerMapSustainedAreaControl {
  areaId: string
  spellId: string
  castingClassId: string
  slotLevel: number
  controlId: Dnd5eSustainedSpellControlId
  label: string
  economy: 'action' | 'bonus-action'
  targeting: 'area' | 'creature'
}

/**
 * Projects reusable spell actions from the authoritative map entity.  Keeping
 * this separate from spellbook availability prevents the UI from recreating a
 * control after its Spiritual Weapon or Call Lightning area has been removed.
 */
export function playerMapSustainedAreaControls(
  map: BattleMap,
  character: Character,
): readonly PlayerMapSustainedAreaControl[] {
  return (map.dnd5ePluginAreas ?? []).flatMap((area) => {
    if (
      area.sourceKind !== 'core-spell' ||
      area.sourceCharacterId !== character.id ||
      !area.coreSpellId ||
      !area.slotLevel
    ) return []
    const spell = getDnd5eSrdCombatSpell(area.coreSpellId)
    const control = spell?.sustainedAttack
    if (!spell || !control || control.origin === 'caster') return []
    const castingClassId = area.castingClassId ??
      dnd5eSpellcastingClassIdForSpell(character, spell.id, undefined, spell.classes)
    if (!castingClassId) return []
    return [{
      areaId: area.id,
      spellId: spell.id,
      castingClassId,
      slotLevel: area.slotLevel,
      controlId: control.id,
      label: dnd5eSustainedSpellControlLabel(control.id),
      economy: control.economy,
      targeting: control.resolution === 'saving-throw' ? 'area' as const : 'creature' as const,
    }]
  })
}
