import type { Character } from '../../../types/character'
import type { Dnd5eCombatant } from '../headlessCombatEngine'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eCharacterBuildSpellGrantsV1 } from '../buildChoices'

function identityCandidates(packageId: string, id: string): ReadonlySet<string> {
  return new Set([id, `${packageId}:${id}`])
}

function includesIdentity(values: readonly string[] | undefined, candidates: ReadonlySet<string>): boolean {
  return values?.some((value) => candidates.has(value)) === true
}

/**
 * Fail-closed entitlement check for the generic Activity runtime. Legacy
 * source metadata is used only as an ownership binding; execution still uses
 * the Activity recipe and never dispatches back into a legacy resolver.
 */
export function dnd5eCombatantEntitledToActivityV1(input: {
  packageId: string
  activity: Dnd5eActivityDefinitionV1
  combatant: Dnd5eCombatant
  character?: Character
}): boolean {
  const source = input.activity.legacySource
  if (!source) return false
  const candidates = identityCandidates(input.packageId, source.id)
  const featureIds = input.combatant.pluginFeatureIds
  if (
    source.kind === 'feature' || source.kind === 'feat' || source.kind === 'class' ||
    source.kind === 'subclass' || source.kind === 'subclass-ability'
  ) {
    if (includesIdentity(featureIds, candidates)) return true
    if (source.kind === 'feat' && includesIdentity(input.character?.dnd5eFeatIds, candidates)) return true
    if (source.kind === 'class') {
      return Object.entries(input.combatant.classLevels ?? {}).some(([id, level]) =>
        candidates.has(id) && (level ?? 0) > 0)
    }
    if (source.kind === 'subclass') {
      return Object.values(input.combatant.subclassIds ?? {}).some((id) => !!id && candidates.has(id))
    }
    return false
  }
  if (source.kind === 'spell') {
    const selectedSpells = [
      ...Object.values(input.combatant.classSelections).flat(),
      ...Object.values(input.combatant.classSelectionsByClass ?? {}).flatMap((selections) =>
        Object.values(selections ?? {}).flat()),
    ]
    if (includesIdentity(selectedSpells, candidates)) return true
    return dnd5eCharacterBuildSpellGrantsV1(input.character ?? {}).some((grant) =>
      candidates.has(grant.spellId))
  }
  if (source.kind === 'item') {
    return input.character?.dnd5eInventory?.entries.some((entry) => candidates.has(entry.templateId)) === true
  }
  if (source.kind === 'race') {
    return !!input.character && candidates.has(input.character.dnd5eRaceId ?? input.character.race)
  }
  if (source.kind === 'background') {
    return !!input.character && candidates.has(input.character.dnd5eBackgroundId ?? input.character.background)
  }
  if (source.kind === 'monster' || source.kind === 'monster-action') {
    const monsterId = source.kind === 'monster-action' ? source.id.split(':').slice(0, -1).join(':') : source.id
    return !!input.combatant.statBlockId && identityCandidates(input.packageId, monsterId).has(input.combatant.statBlockId)
  }
  // Top-level legacy custom actions are callable only through their owning
  // feature adapter; they are not ambient abilities for every combatant.
  return false
}
