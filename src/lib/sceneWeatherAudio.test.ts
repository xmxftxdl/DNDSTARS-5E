import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  SCENE_CAVE_AMBIENCE_URL,
  SCENE_CAVE_WATER_START_SECONDS,
  sceneWeatherAudioMix,
} from './sceneWeatherAudio'

describe('scene weather audio mix', () => {
  it('keeps non-audible weather silent', () => {
    expect(sceneWeatherAudioMix({
      kind: 'snow', intensity: 1, soundEnabled: true, soundVolume: 1,
    })).toEqual({ audible: false, bedGain: 0, accentGain: 0, rainGain: 0, thunderGain: 0 })
    expect(sceneWeatherAudioMix({
      kind: 'rain', intensity: 1, soundEnabled: false, soundVolume: 1,
    })).toEqual({ audible: false, bedGain: 0, accentGain: 0, rainGain: 0, thunderGain: 0 })
  })

  it('mixes rain conservatively and adds thunder only to storms', () => {
    const rain = sceneWeatherAudioMix({
      kind: 'rain', intensity: 0.6, soundEnabled: true, soundVolume: 0.55,
    })
    const storm = sceneWeatherAudioMix({
      kind: 'thunderstorm', intensity: 0.6, soundEnabled: true, soundVolume: 0.55,
    })
    expect(rain.audible).toBe(true)
    expect(rain.bedGain).toBe(rain.rainGain)
    expect(rain.rainGain).toBeGreaterThan(0)
    expect(rain.thunderGain).toBe(0)
    expect(storm.rainGain).toBeGreaterThan(rain.rainGain)
    expect(storm.thunderGain).toBeGreaterThan(0)
    expect(storm.accentGain).toBe(storm.thunderGain)
  })

  it('provides distinct conservative beds and accents for the expanded weather set', () => {
    for (const kind of ['cave', 'hail', 'blizzard', 'sandstorm', 'wind', 'embers'] as const) {
      const mix = sceneWeatherAudioMix({
        kind, intensity: 0.75, soundEnabled: true, soundVolume: 0.6,
      })
      expect(mix.audible).toBe(true)
      if (kind === 'cave') expect(mix.bedGain).toBe(0)
      else expect(mix.bedGain).toBeGreaterThan(0)
      expect(mix.accentGain).toBeGreaterThan(0)
      expect(mix.bedGain).toBeLessThan(0.06)
      expect(mix.accentGain).toBeLessThan(kind === 'cave' ? 0.35 : 0.1)
      expect(mix.rainGain).toBe(0)
      expect(mix.thunderGain).toBe(0)
    }
  })

  it('keeps the cave bed quiet while leaving its sparse drips clearly audible', () => {
    const cave = sceneWeatherAudioMix({
      kind: 'cave', intensity: 0.75, soundEnabled: true, soundVolume: 0.6,
    })
    const hail = sceneWeatherAudioMix({
      kind: 'hail', intensity: 0.75, soundEnabled: true, soundVolume: 0.6,
    })

    expect(cave.bedGain).toBe(0)
    expect(cave.accentGain).toBeGreaterThan(hail.accentGain * 1.5)
  })

  it('ships the cleaned user-supplied damp-cave water recording', () => {
    expect(SCENE_CAVE_AMBIENCE_URL).toBe('/audio/weather/trickling-water-wet-cave-cleaned.wav')
    expect(SCENE_CAVE_WATER_START_SECONDS).toBe(0)
    const recording = readFileSync(new URL(
      '../../public/audio/weather/trickling-water-wet-cave-cleaned.wav',
      import.meta.url,
    ))
    expect(recording.byteLength).toBeGreaterThan(5_700_000)
  })
})
