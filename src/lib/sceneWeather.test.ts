import { describe, expect, it } from 'vitest'
import {
  AUDIBLE_SCENE_WEATHER_KINDS,
  DEFAULT_SCENE_WEATHER,
  normalizeSceneWeather,
  sceneWeatherFlowVector,
  sceneWeatherHasAudio,
  sceneWeatherParticleBudget,
  sceneWeatherSeed,
  sunnySceneComposition,
  validateSceneWeather,
} from './sceneWeather'

describe('scene weather', () => {
  it('normalizes legacy and out-of-range values safely', () => {
    expect(normalizeSceneWeather(undefined)).toEqual(DEFAULT_SCENE_WEATHER)
    expect(normalizeSceneWeather({
      kind: 'thunderstorm', intensity: 3, windAngleDegrees: -120, speed: 9,
    })).toEqual({
      kind: 'thunderstorm', intensity: 1, windAngleDegrees: -70, speed: 2.5,
      soundEnabled: true, soundVolume: 0.55,
    })
  })

  it('strictly validates shared weather declarations', () => {
    expect(validateSceneWeather({
      kind: 'snow', intensity: 0.65, windAngleDegrees: 12, speed: 0.8,
    })).toBe(true)
    for (const kind of ['sunny', 'cloudy', 'night', 'cave', 'hail', 'blizzard', 'sandstorm', 'wind', 'embers'] as const) {
      expect(validateSceneWeather({
        kind, intensity: 0.65, windAngleDegrees: 12, speed: 0.8,
      })).toBe(true)
    }
    expect(validateSceneWeather({
      kind: 'acid-rain', intensity: 0.65, windAngleDegrees: 12, speed: 0.8,
    })).toBe(false)
    expect(normalizeSceneWeather({
      kind: 'rain', intensity: 0.65, windAngleDegrees: 12, speed: 0.8,
      soundEnabled: false, soundVolume: 4,
    })).toMatchObject({ soundEnabled: false, soundVolume: 1 })
  })

  it('keeps adaptive particle counts bounded and deterministic', () => {
    expect(sceneWeatherParticleBudget({
      kind: 'rain', width: 1280, height: 720, intensity: 1,
    })).toBe(500)
    expect(sceneWeatherParticleBudget({
      kind: 'rain', width: 1280, height: 720, intensity: 1, qualityScale: 0.2,
    })).toBe(100)
    expect(sceneWeatherParticleBudget({
      kind: 'fog', width: 8000, height: 8000, intensity: 1,
    })).toBeLessThanOrEqual(46)
    expect(sceneWeatherSeed('scene-1:rain')).toBe(sceneWeatherSeed('scene-1:rain'))
  })

  it('exposes audio only for weather with an implemented ambience profile', () => {
    expect(AUDIBLE_SCENE_WEATHER_KINDS).toEqual([
      'cave', 'rain', 'thunderstorm', 'hail', 'blizzard', 'sandstorm', 'wind', 'embers',
    ])
    expect(sceneWeatherHasAudio('cave')).toBe(true)
    expect(sceneWeatherHasAudio('blizzard')).toBe(true)
    expect(sceneWeatherHasAudio('night')).toBe(false)
    expect(sceneWeatherHasAudio('fog')).toBe(false)
    expect(sceneWeatherHasAudio('snow')).toBe(false)
  })

  it('uses weather-specific bounded particle budgets', () => {
    const counts = Object.fromEntries(
      (['sunny', 'cloudy', 'night', 'cave', 'hail', 'blizzard', 'sandstorm', 'wind', 'embers'] as const).map((kind) => [
        kind,
        sceneWeatherParticleBudget({ kind, width: 1280, height: 720, intensity: 1 }),
      ]),
    )
    expect(counts).toEqual({
      sunny: 36, cloudy: 18, night: 1, cave: 42,
      hail: 420, blizzard: 460, sandstorm: 360, wind: 150, embers: 180,
    })
    expect(sceneWeatherParticleBudget({
      kind: 'blizzard', width: 8_000, height: 8_000, intensity: 1,
    })).toBeLessThanOrEqual(900)
  })

  it('turns the full wind angle into a continuous motion vector', () => {
    const straight = sceneWeatherFlowVector(0, 100)
    const thirty = sceneWeatherFlowVector(30, 100)
    const sixty = sceneWeatherFlowVector(60, 100)
    const reverseSixty = sceneWeatherFlowVector(-60, 100)

    expect(straight.x).toBeCloseTo(0)
    expect(straight.y).toBeCloseTo(100)
    expect(thirty.x).toBeCloseTo(50)
    expect(thirty.y).toBeCloseTo(86.6025, 3)
    expect(sixty.x).toBeCloseTo(86.6025, 3)
    expect(sixty.y).toBeCloseTo(50)
    expect(reverseSixty.x).toBeCloseTo(-sixty.x)
    expect(reverseSixty.y).toBeCloseTo(sixty.y)
    expect(Math.hypot(sixty.x, sixty.y)).toBeCloseTo(100)
  })

  it('anchors the sunny-weather sun outside the scaled map without scaling the sun', () => {
    const fitted = sunnySceneComposition({
      viewportWidth: 1_280,
      viewportHeight: 720,
      mapWidth: 1_000,
      mapHeight: 600,
      viewportX: 90,
      viewportY: 60,
      viewportScale: 1,
    })
    const zoomedOut = sunnySceneComposition({
      viewportWidth: 1_280,
      viewportHeight: 720,
      mapWidth: 1_000,
      mapHeight: 600,
      viewportX: 240,
      viewportY: 150,
      viewportScale: 0.65,
    })

    expect(fitted.sunX).toBeGreaterThan(fitted.mapRight)
    expect(fitted.sunY).toBeLessThan(fitted.mapTop)
    expect(zoomedOut.sunX).toBeGreaterThan(zoomedOut.mapRight)
    expect(zoomedOut.sunY).toBeLessThan(zoomedOut.mapTop)
    expect(zoomedOut.sunRadius).toBe(fitted.sunRadius)
    expect(zoomedOut.mapRight - zoomedOut.mapLeft).toBe(650)
  })
})
