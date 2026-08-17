export const SCENE_WEATHER_KINDS = [
  'none',
  'sunny',
  'cloudy',
  'night',
  'cave',
  'fog',
  'rain',
  'snow',
  'thunderstorm',
  'hail',
  'blizzard',
  'sandstorm',
  'wind',
  'embers',
] as const

export type SceneWeatherKind = (typeof SCENE_WEATHER_KINDS)[number]

export const AUDIBLE_SCENE_WEATHER_KINDS = [
  'cave',
  'rain',
  'thunderstorm',
  'hail',
  'blizzard',
  'sandstorm',
  'wind',
  'embers',
] as const satisfies readonly SceneWeatherKind[]

export type AudibleSceneWeatherKind = (typeof AUDIBLE_SCENE_WEATHER_KINDS)[number]

export function sceneWeatherHasAudio(kind: SceneWeatherKind): kind is AudibleSceneWeatherKind {
  return (AUDIBLE_SCENE_WEATHER_KINDS as readonly SceneWeatherKind[]).includes(kind)
}

export interface SceneWeatherConfig {
  kind: SceneWeatherKind
  /** Visual density and scene tint, from 0 to 1. */
  intensity: number
  /** Horizontal deviation from straight down, in degrees. */
  windAngleDegrees: number
  /** Particle travel multiplier. */
  speed: number
  /** Plays a local ambience bed on each connected client. */
  soundEnabled: boolean
  /** Weather ambience volume before the conservative output limiter. */
  soundVolume: number
}

export const DEFAULT_SCENE_WEATHER: SceneWeatherConfig = {
  kind: 'none',
  intensity: 0.6,
  windAngleDegrees: 10,
  speed: 1,
  soundEnabled: true,
  soundVolume: 0.55,
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function finite(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export interface SceneWeatherFlowVector {
  x: number
  y: number
  unitX: number
  unitY: number
}

export interface SceneWeatherViewportProjection {
  viewportWidth: number
  viewportHeight: number
  mapWidth: number
  mapHeight: number
  viewportX: number
  viewportY: number
  viewportScale: number
}

export interface SunnySceneComposition {
  mapLeft: number
  mapTop: number
  mapRight: number
  mapBottom: number
  sunX: number
  sunY: number
  sunRadius: number
}

/**
 * Projects the uploaded map into viewport pixels and anchors the sunny-weather
 * sun just beyond its upper-right corner. The radius is intentionally based on
 * viewport size rather than world scale, so zooming the map never scales the
 * sun like a token or a map texture.
 */
export function sunnySceneComposition(
  input: SceneWeatherViewportProjection,
): SunnySceneComposition {
  const viewportWidth = Math.max(1, finite(input.viewportWidth, 1))
  const viewportHeight = Math.max(1, finite(input.viewportHeight, 1))
  const mapWidth = Math.max(1, finite(input.mapWidth, 1))
  const mapHeight = Math.max(1, finite(input.mapHeight, 1))
  const viewportScale = Math.max(0.01, finite(input.viewportScale, 1))
  const mapLeft = finite(input.viewportX, 0)
  const mapTop = finite(input.viewportY, 0)
  const mapRight = mapLeft + mapWidth * viewportScale
  const mapBottom = mapTop + mapHeight * viewportScale
  const sunRadius = clamp(Math.min(viewportWidth, viewportHeight) * 0.078, 42, 78)

  return {
    mapLeft,
    mapTop,
    mapRight,
    mapBottom,
    sunX: mapRight + sunRadius * 0.62,
    sunY: mapTop - sunRadius * 0.62,
    sunRadius,
  }
}

/**
 * Converts the configured horizontal deviation from straight down into a real
 * screen-space motion vector. Keeping this shared prevents directional weather
 * from collapsing the entire angle range into a left/right sign check.
 */
export function sceneWeatherFlowVector(
  windAngleDegrees: number,
  magnitude: number,
): SceneWeatherFlowVector {
  const radians = clamp(finite(windAngleDegrees, 0), -70, 70) * Math.PI / 180
  const normalizedMagnitude = Math.max(0, finite(magnitude, 0))
  const unitX = Math.sin(radians)
  const unitY = Math.cos(radians)
  return {
    x: unitX * normalizedMagnitude,
    y: unitY * normalizedMagnitude,
    unitX,
    unitY,
  }
}

export function normalizeSceneWeather(value: unknown): SceneWeatherConfig {
  const source = object(value) ? value : {}
  const kind = SCENE_WEATHER_KINDS.includes(source.kind as SceneWeatherKind)
    ? source.kind as SceneWeatherKind
    : DEFAULT_SCENE_WEATHER.kind
  return {
    kind,
    intensity: clamp(finite(source.intensity, DEFAULT_SCENE_WEATHER.intensity), 0, 1),
    windAngleDegrees: clamp(
      finite(source.windAngleDegrees, DEFAULT_SCENE_WEATHER.windAngleDegrees),
      -70,
      70,
    ),
    speed: clamp(finite(source.speed, DEFAULT_SCENE_WEATHER.speed), 0.35, 2.5),
    soundEnabled: source.soundEnabled !== false,
    soundVolume: clamp(finite(source.soundVolume, DEFAULT_SCENE_WEATHER.soundVolume), 0, 1),
  }
}

export function validateSceneWeather(value: unknown): boolean {
  if (!object(value)) return false
  return SCENE_WEATHER_KINDS.includes(value.kind as SceneWeatherKind) &&
    Number.isFinite(value.intensity) && Number(value.intensity) >= 0 && Number(value.intensity) <= 1 &&
    Number.isFinite(value.windAngleDegrees) && Number(value.windAngleDegrees) >= -70 && Number(value.windAngleDegrees) <= 70 &&
    Number.isFinite(value.speed) && Number(value.speed) >= 0.35 && Number(value.speed) <= 2.5 &&
    (value.soundEnabled == null || typeof value.soundEnabled === 'boolean') &&
    (value.soundVolume == null || (
      Number.isFinite(value.soundVolume) && Number(value.soundVolume) >= 0 && Number(value.soundVolume) <= 1
    ))
}

export function sceneWeatherParticleBudget(input: {
  kind: SceneWeatherKind
  width: number
  height: number
  intensity: number
  qualityScale?: number
}): number {
  if (input.kind === 'none') return 0
  const areaScale = clamp((Math.max(1, input.width) * Math.max(1, input.height)) / (1280 * 720), 0.45, 2)
  const intensityScale = 0.35 + clamp(input.intensity, 0, 1) * 0.65
  const qualityScale = clamp(input.qualityScale ?? 1, 0.2, 1)
  const budget = {
    sunny: { base: 36, maximum: 80 },
    cloudy: { base: 18, maximum: 40 },
    night: { base: 1, maximum: 1 },
    cave: { base: 42, maximum: 90 },
    fog: { base: 22, maximum: 46 },
    snow: { base: 240, maximum: 520 },
    rain: { base: 500, maximum: 980 },
    thunderstorm: { base: 620, maximum: 980 },
    hail: { base: 420, maximum: 800 },
    blizzard: { base: 460, maximum: 900 },
    sandstorm: { base: 360, maximum: 760 },
    wind: { base: 150, maximum: 320 },
    embers: { base: 180, maximum: 380 },
  } satisfies Record<Exclude<SceneWeatherKind, 'none'>, { base: number; maximum: number }>
  const { base, maximum } = budget[input.kind]
  return Math.max(1, Math.min(maximum, Math.round(base * areaScale * intensityScale * qualityScale)))
}

export function sceneWeatherSeed(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
