import { dnd5ePersistentAreaPresentationVisual } from '../../rulesets/dnd5e/persistentAreaPresentation'
import type { Dnd5ePluginArea } from '../../store/maps'

type PersistentAreaRenderPresetSource = Pick<
  Dnd5ePluginArea,
  'sourceKind' | 'coreSpellId' | 'visual'
>

/**
 * Magic Circle was historically persisted with the generic `arcane` visual.
 * Resolve it by spell identity so both existing and newly-created areas receive
 * the dedicated animated ward without changing their authoritative snapshot.
 */
export function dnd5ePersistentAreaRenderPreset(
  area: PersistentAreaRenderPresetSource,
): string {
  if (area.coreSpellId === 'magic-circle') return 'magic-circle'
  return dnd5ePersistentAreaPresentationVisual(area)?.preset ?? ''
}
