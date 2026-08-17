import type { Dnd5ePersistentAreaVisual } from './persistentAreaTypes'

/**
 * Lightweight presentation registry. Keep this separate from coreSpellAreas so
 * the map renderer does not pull Headless geometry and settlement code into the
 * visual chunk merely to recover a legacy area's missing visual field.
 */
export const DND5E_CORE_SPELL_AREA_VISUALS: Readonly<Record<string, Dnd5ePersistentAreaVisual>> = {
  'dancing-lights': { preset: 'dancing-lights', intensity: 'strong' },
  'mage-hand': { preset: 'mage-hand', intensity: 'subtle' },
  darkness: { preset: 'darkness', intensity: 'strong' },
  daylight: { preset: 'daylight', intensity: 'subtle' },
  grease: { preset: 'grease', intensity: 'normal' },
  entangle: { preset: 'entangle', intensity: 'normal' },
  'black-tentacles': { preset: 'black-tentacles', intensity: 'strong' },
  'flaming-sphere': { preset: 'flaming-sphere', intensity: 'strong' },
  'spiritual-weapon': { preset: 'spiritual-weapon', intensity: 'normal' },
  'spike-growth': { preset: 'spike-growth', intensity: 'strong' },
  'spirit-guardians': { preset: 'spirit-guardians', intensity: 'normal' },
  moonbeam: { preset: 'moonbeam', intensity: 'strong' },
  'call-lightning': { preset: 'call-lightning', intensity: 'strong' },
  'wall-of-fire': { preset: 'wall-of-fire', intensity: 'strong' },
  'insect-plague': { preset: 'insect-plague', intensity: 'strong' },
  cloudkill: { preset: 'cloudkill', intensity: 'strong' },
  'blade-barrier': { preset: 'blade-barrier', intensity: 'strong' },
  'ice-storm': { preset: 'ice-storm-ground', intensity: 'subtle' },
  'fog-cloud': { preset: 'fog-cloud', intensity: 'normal' },
  web: { preset: 'web', intensity: 'normal' },
  silence: { preset: 'silence', intensity: 'subtle' },
  'sleet-storm': { preset: 'sleet-storm', intensity: 'strong' },
  'stinking-cloud': { preset: 'stinking-cloud', intensity: 'strong' },
  'wind-wall': { preset: 'wind-wall', intensity: 'strong' },
  'wall-of-force': { preset: 'wall-of-force', intensity: 'normal' },
  'wall-of-stone': { preset: 'wall-of-stone', intensity: 'normal' },
  'wall-of-ice': { preset: 'wall-of-ice', intensity: 'strong' },
  'wall-of-thorns': { preset: 'wall-of-thorns', intensity: 'strong' },
}

export function dnd5eCoreSpellAreaVisual(
  spellId: string | undefined,
): Dnd5ePersistentAreaVisual | undefined {
  const visual = spellId ? DND5E_CORE_SPELL_AREA_VISUALS[spellId] : undefined
  return visual ? { ...visual } : undefined
}
