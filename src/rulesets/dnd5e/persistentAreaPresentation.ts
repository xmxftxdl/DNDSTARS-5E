import type { Dnd5ePluginArea } from '../../store/maps'
import { getDnd5eCoreSpellAreaDeclaration } from './coreSpellAreas'
import type { Dnd5ePersistentAreaVisual } from './persistentAreaTypes'

type PersistentAreaPresentationSource = Pick<
  Dnd5ePluginArea,
  'sourceKind' | 'coreSpellId' | 'visual'
>

/**
 * Resolve the visual independently of snapshot age. Shared map snapshots used
 * to omit `visual`, while `loadShared` intentionally accepts the authoritative
 * payload without running local-storage migration first.
 */
export function dnd5ePersistentAreaPresentationVisual(
  area: PersistentAreaPresentationSource,
): Dnd5ePersistentAreaVisual | undefined {
  const legacyGenericPreset = area.coreSpellId === 'mage-hand'
    ? 'arcane'
    : area.coreSpellId === 'insect-plague'
      ? 'toxic-cloud'
      : area.coreSpellId === 'blade-barrier'
        ? 'arcane'
        : undefined
  if (
    area.visual &&
    !(area.sourceKind === 'core-spell' && legacyGenericPreset === area.visual.preset)
  ) return area.visual
  if (area.sourceKind !== 'core-spell' || !area.coreSpellId) return undefined
  const visual = getDnd5eCoreSpellAreaDeclaration(area.coreSpellId)?.visual
  return visual ? { ...visual } : undefined
}
