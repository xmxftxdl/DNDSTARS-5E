import type { Dnd5ePluginArea } from '../../store/maps'
import { dnd5eCoreSpellAreaVisual } from './coreSpellAreaVisuals'
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
      : area.coreSpellId === 'cloudkill'
        ? 'toxic-cloud'
      : area.coreSpellId === 'ice-storm'
        ? 'arcane'
      : area.coreSpellId === 'blade-barrier'
        ? 'arcane'
        : undefined
  if (
    area.visual &&
    !(area.sourceKind === 'core-spell' && legacyGenericPreset === area.visual.preset)
  ) return area.visual
  if (area.sourceKind !== 'core-spell' || !area.coreSpellId) return undefined
  return dnd5eCoreSpellAreaVisual(area.coreSpellId)
}
