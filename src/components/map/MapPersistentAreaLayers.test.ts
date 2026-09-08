import { describe, expect, it } from 'vitest'
import { persistentAreaAtlasLoopFrames } from './persistentAreaAtlasFrames'

describe('persistent area sprite atlas loops', () => {
  it('keeps Darkness on fully formed sustain frames instead of replaying its fade-out', () => {
    expect(persistentAreaAtlasLoopFrames('darkness')).toEqual([8, 9, 10, 11])
  })

  it('keeps other fade-out atlases on stable sustain frames', () => {
    for (const preset of [
      'cloudkill', 'stinking-cloud', 'daylight', 'entangle', 'moonbeam',
      'fog-cloud', 'sleet-storm', 'wind-wall', 'wall-of-force', 'wall-of-stone',
      'wall-of-ice', 'wall-of-thorns',
    ]) {
      expect(persistentAreaAtlasLoopFrames(preset)).toEqual([8, 9, 10, 11])
    }
    expect(persistentAreaAtlasLoopFrames('spirit-guardians')).toEqual([
      8, 9, 10, 11, 12, 13, 14, 15,
    ])
  })
})
