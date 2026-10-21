import { isTorchSizedFlame, type FlameLight } from '../../../shared/flame-light-concealment.mjs'
import type { Dnd5ePluginArea } from '../../store/maps'

/** Limited flame wards do not inherit strong-wind gas dispersal or protected-flame rolls. */
export function areaExtinguishesExposedFlame(area: Dnd5ePluginArea, light: FlameLight): boolean {
  return !area.modeState?.paused && (area.strongWind === true ||
    (area.sourceKind === 'core-spell' && area.coreSpellId === 'gust-of-wind') ||
    (area.extinguishesUnprotectedFlames === 'torch-or-smaller' && isTorchSizedFlame(light)))
}
