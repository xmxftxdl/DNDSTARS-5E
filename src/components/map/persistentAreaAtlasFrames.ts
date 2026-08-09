const STABLE_PERSISTENT_ATLAS_PRESETS = new Set([
  'cloudkill',
  'darkness',
  'daylight',
  'entangle',
  'moonbeam',
])

/** Persistent effects must not replay their atlas' cast-in or fade-out frames. */
export function persistentAreaAtlasLoopFrames(preset: string): readonly number[] {
  if (STABLE_PERSISTENT_ATLAS_PRESETS.has(preset)) return [8, 9, 10, 11]
  if (preset === 'ice-storm-ground') return [4, 5, 6, 7, 8, 9, 10, 11]
  return [8, 9, 10, 11, 12, 13, 14, 15]
}
