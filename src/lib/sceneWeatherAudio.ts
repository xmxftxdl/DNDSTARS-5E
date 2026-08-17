import {
  sceneWeatherHasAudio,
  sceneWeatherSeed,
  type AudibleSceneWeatherKind,
  type SceneWeatherConfig,
} from './sceneWeather'

export interface SceneWeatherAudioMix {
  audible: boolean
  bedGain: number
  accentGain: number
  /** Backward-compatible diagnostics for the original rain implementation. */
  rainGain: number
  thunderGain: number
}

export interface SceneWeatherAudioHandle {
  setMix: (intensity: number, volume: number) => void
  stop: () => void
}

interface SceneWeatherAudioStartOptions {
  sceneId: string
  kind: AudibleSceneWeatherKind
  intensity: number
  volume: number
}

interface WeatherAudioProfile {
  bedGain: number
  accentGain: number
  highPassHz: number
  lowPassHz: number
  smoothing: number
}

export const SCENE_CAVE_AMBIENCE_URL = '/audio/weather/trickling-water-wet-cave-cleaned.wav'
export const SCENE_CAVE_WATER_START_SECONDS = 0

const WEATHER_AUDIO_PROFILES: Record<AudibleSceneWeatherKind, WeatherAudioProfile> = {
  cave: { bedGain: 0, accentGain: 0.32, highPassHz: 18, lowPassHz: 520, smoothing: 0.012 },
  rain: { bedGain: 0.038, accentGain: 0, highPassHz: 700, lowPassHz: 9_200, smoothing: 0.16 },
  thunderstorm: { bedGain: 0.052, accentGain: 0.16, highPassHz: 420, lowPassHz: 7_600, smoothing: 0.14 },
  hail: { bedGain: 0.018, accentGain: 0.052, highPassHz: 1_150, lowPassHz: 10_800, smoothing: 0.2 },
  blizzard: { bedGain: 0.032, accentGain: 0.042, highPassHz: 65, lowPassHz: 2_500, smoothing: 0.035 },
  sandstorm: { bedGain: 0.03, accentGain: 0.034, highPassHz: 90, lowPassHz: 4_200, smoothing: 0.055 },
  wind: { bedGain: 0.025, accentGain: 0.032, highPassHz: 50, lowPassHz: 2_800, smoothing: 0.03 },
  embers: { bedGain: 0.009, accentGain: 0.026, highPassHz: 380, lowPassHz: 6_800, smoothing: 0.12 },
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum))
}

export function sceneWeatherAudioMix(input: Pick<
  SceneWeatherConfig,
  'kind' | 'intensity' | 'soundEnabled' | 'soundVolume'
>): SceneWeatherAudioMix {
  if (!input.soundEnabled || !sceneWeatherHasAudio(input.kind)) {
    return { audible: false, bedGain: 0, accentGain: 0, rainGain: 0, thunderGain: 0 }
  }
  const intensity = clamp(input.intensity, 0, 1)
  const volume = clamp(input.soundVolume, 0, 1)
  const strength = volume * (0.28 + intensity * 0.72)
  const profile = WEATHER_AUDIO_PROFILES[input.kind]
  const bedGain = strength * profile.bedGain
  const accentGain = strength * profile.accentGain
  return {
    audible: volume > 0,
    bedGain,
    accentGain,
    rainGain: input.kind === 'rain' || input.kind === 'thunderstorm' ? bedGain : 0,
    thunderGain: input.kind === 'thunderstorm' ? accentGain : 0,
  }
}

function seededRandom(initialSeed: number): () => number {
  let seed = initialSeed || 1
  return () => {
    seed += 0x6D2B79F5
    let value = seed
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function noiseBuffer(
  context: AudioContext,
  durationSeconds: number,
  random: () => number,
  smoothing = 0.16,
): AudioBuffer {
  const frameCount = Math.max(1, Math.round(context.sampleRate * durationSeconds))
  const buffer = context.createBuffer(1, frameCount, context.sampleRate)
  const data = buffer.getChannelData(0)
  let previous = 0
  for (let index = 0; index < frameCount; index += 1) {
    const white = random() * 2 - 1
    previous = previous * (1 - smoothing) + white * smoothing
    data[index] = white * 0.72 + previous * 0.28
  }
  return buffer
}

function caveWaterLoopBuffer(
  context: AudioContext,
  decodedAudio: AudioBuffer,
): AudioBuffer {
  const sampleRate = decodedAudio.sampleRate
  const startSeconds = Math.min(
    SCENE_CAVE_WATER_START_SECONDS,
    Math.max(0, decodedAudio.duration - 1.5),
  )
  const endSeconds = Math.max(startSeconds + 0.5, decodedAudio.duration - 0.12)
  const startFrame = Math.max(0, Math.floor(startSeconds * sampleRate))
  const endFrame = Math.min(decodedAudio.length, Math.floor(endSeconds * sampleRate))
  const segmentFrames = Math.max(1, endFrame - startFrame)
  const crossfadeFrames = Math.min(
    Math.floor(sampleRate * 0.42),
    Math.max(1, Math.floor(segmentFrames / 4)),
  )
  const outputFrames = Math.max(1, segmentFrames - crossfadeFrames)
  const output = context.createBuffer(
    decodedAudio.numberOfChannels,
    outputFrames,
    sampleRate,
  )

  for (let channel = 0; channel < decodedAudio.numberOfChannels; channel += 1) {
    const source = decodedAudio.getChannelData(channel)
    const target = output.getChannelData(channel)
    for (let index = 0; index < outputFrames; index += 1) {
      if (index >= crossfadeFrames) {
        target[index] = source[startFrame + index] ?? 0
        continue
      }
      const progress = crossfadeFrames <= 1 ? 1 : index / (crossfadeFrames - 1)
      const headGain = Math.sin(progress * Math.PI / 2)
      const tailGain = Math.cos(progress * Math.PI / 2)
      const headSample = source[startFrame + index] ?? 0
      const tailSample = source[endFrame - crossfadeFrames + index] ?? 0
      target[index] = headSample * headGain + tailSample * tailGain
    }
  }
  return output
}

function contextConstructor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  return window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

/**
 * Starts a self-contained procedural weather bed. The conservative gains keep it behind voice,
 * dice, and scene music, while a local AudioContext avoids coupling ambience to Headless state.
 */
export function startSceneWeatherAudio(options: SceneWeatherAudioStartOptions): SceneWeatherAudioHandle | null {
  const AudioContextClass = contextConstructor()
  if (!AudioContextClass) return null
  try {
    const context = new AudioContextClass()
    const random = seededRandom(sceneWeatherSeed(`${options.sceneId}:${options.kind}:audio`))
    const profile = WEATHER_AUDIO_PROFILES[options.kind]
    const master = context.createGain()
    const bedGain = context.createGain()
    const highPass = context.createBiquadFilter()
    const lowPass = context.createBiquadFilter()
    const bedSource = context.createBufferSource()
    const accentBuffer = noiseBuffer(context, 5.2, random, 0.07)
    const caveRecordingGain = options.kind === 'cave' ? context.createGain() : null
    const caveRecordingHighPass = options.kind === 'cave' ? context.createBiquadFilter() : null
    const caveRecordingLowPass = options.kind === 'cave' ? context.createBiquadFilter() : null
    const caveRecordingController = options.kind === 'cave' ? new AbortController() : null
    let currentMix = sceneWeatherAudioMix({
      kind: options.kind,
      intensity: options.intensity,
      soundEnabled: true,
      soundVolume: options.volume,
    })
    let currentIntensity = clamp(options.intensity, 0, 1)
    let accentTimer = 0
    let caveRecordingSource: AudioBufferSourceNode | null = null
    let disposed = false

    master.gain.value = 1
    master.connect(context.destination)
    bedGain.gain.value = currentMix.bedGain
    bedGain.connect(master)
    highPass.type = 'highpass'
    highPass.frequency.value = profile.highPassHz
    highPass.Q.value = 0.35
    lowPass.type = 'lowpass'
    lowPass.frequency.value = profile.lowPassHz
    lowPass.Q.value = 0.2
    highPass.connect(lowPass)
    lowPass.connect(bedGain)
    bedSource.buffer = noiseBuffer(context, 3.2, random, profile.smoothing)
    bedSource.loop = true
    bedSource.connect(highPass)
    bedSource.start()
    if (
      caveRecordingGain &&
      caveRecordingHighPass &&
      caveRecordingLowPass &&
      caveRecordingController
    ) {
      caveRecordingGain.gain.value = Math.min(0.4, currentMix.accentGain * 1.25)
      caveRecordingHighPass.type = 'highpass'
      caveRecordingHighPass.frequency.value = 95
      caveRecordingHighPass.Q.value = 0.42
      caveRecordingLowPass.type = 'lowpass'
      caveRecordingLowPass.frequency.value = 7_200
      caveRecordingLowPass.Q.value = 0.24
      caveRecordingHighPass.connect(caveRecordingLowPass)
      caveRecordingLowPass.connect(caveRecordingGain)
      caveRecordingGain.connect(master)
      void fetch(SCENE_CAVE_AMBIENCE_URL, {
        signal: caveRecordingController.signal,
      }).then((response) => {
        if (!response.ok) throw new Error(`Cave ambience failed: ${response.status}`)
        return response.arrayBuffer()
      }).then((encodedAudio) => context.decodeAudioData(encodedAudio)).then((decodedAudio) => {
        if (disposed || context.state === 'closed') return
        const source = context.createBufferSource()
        source.buffer = caveWaterLoopBuffer(context, decodedAudio)
        source.loop = true
        source.connect(caveRecordingHighPass)
        source.start(0, random() * Math.max(0.1, source.buffer.duration - 0.1))
        caveRecordingSource = source
      }).catch(() => undefined)
    }

    const removeUnlockListeners = () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    const unlock = () => {
      void context.resume().then(removeUnlockListeners).catch(() => undefined)
    }
    const handleVisibility = () => {
      if (context.state === 'closed') return
      if (document.visibilityState === 'hidden') {
        void context.suspend().catch(() => undefined)
      } else {
        void context.resume().catch(() => undefined)
      }
    }
    if (context.state === 'suspended') {
      window.addEventListener('pointerdown', unlock, { passive: true })
      window.addEventListener('keydown', unlock)
      unlock()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const playThunder = () => {
      if (disposed || context.state !== 'running' || currentMix.accentGain <= 0) return
      const now = context.currentTime
      const duration = 3.4 + random() * 1.5
      const rumble = context.createBufferSource()
      const rumbleFilter = context.createBiquadFilter()
      const rumbleGain = context.createGain()
      const sub = context.createOscillator()
      const subGain = context.createGain()
      const panner = typeof context.createStereoPanner === 'function'
        ? context.createStereoPanner()
        : null

      rumble.buffer = noiseBuffer(context, duration, random, 0.035)
      rumbleFilter.type = 'lowpass'
      rumbleFilter.frequency.setValueAtTime(520 + random() * 260, now)
      rumbleFilter.frequency.exponentialRampToValueAtTime(95, now + duration)
      rumbleFilter.Q.value = 0.7
      rumbleGain.gain.setValueAtTime(0.0001, now)
      rumbleGain.gain.exponentialRampToValueAtTime(currentMix.accentGain, now + 0.08 + random() * 0.16)
      rumbleGain.gain.exponentialRampToValueAtTime(currentMix.accentGain * 0.36, now + 1.05)
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      if (panner) {
        panner.pan.value = random() * 1.4 - 0.7
        rumble.connect(rumbleFilter)
        rumbleFilter.connect(rumbleGain)
        rumbleGain.connect(panner)
        panner.connect(master)
      } else {
        rumble.connect(rumbleFilter)
        rumbleFilter.connect(rumbleGain)
        rumbleGain.connect(master)
      }

      sub.type = 'sine'
      sub.frequency.setValueAtTime(48 + random() * 10, now)
      sub.frequency.exponentialRampToValueAtTime(28, now + duration)
      subGain.gain.setValueAtTime(0.0001, now)
      subGain.gain.exponentialRampToValueAtTime(currentMix.accentGain * 0.22, now + 0.16)
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.82)
      sub.connect(subGain)
      subGain.connect(master)
      rumble.start(now)
      rumble.stop(now + duration)
      sub.start(now)
      sub.stop(now + duration)
    }

    const playNoiseAccent = (input: {
      duration: number
      filterType: BiquadFilterType
      frequency: number
      peak: number
      attack?: number
      pan?: number
    }) => {
      if (disposed || context.state !== 'running' || input.peak <= 0) return
      const now = context.currentTime
      const source = context.createBufferSource()
      const filter = context.createBiquadFilter()
      const gain = context.createGain()
      const panner = typeof context.createStereoPanner === 'function'
        ? context.createStereoPanner()
        : null
      const attack = Math.min(input.duration * 0.35, input.attack ?? 0.08)
      source.buffer = accentBuffer
      source.loop = true
      filter.type = input.filterType
      filter.frequency.value = input.frequency
      filter.Q.value = input.filterType === 'bandpass' ? 1.25 : 0.55
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, input.peak), now + attack)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + input.duration)
      source.connect(filter)
      filter.connect(gain)
      if (panner) {
        panner.pan.value = clamp(input.pan ?? random() * 1.5 - 0.75, -1, 1)
        gain.connect(panner)
        panner.connect(master)
      } else {
        gain.connect(master)
      }
      source.start(now, random() * Math.max(0.1, accentBuffer.duration - 0.2))
      source.stop(now + input.duration + 0.02)
    }

    const playWeatherAccent = () => {
      if (currentMix.accentGain <= 0) return
      if (options.kind === 'cave') return
      if (options.kind === 'thunderstorm') {
        playThunder()
        return
      }
      if (options.kind === 'hail') {
        playNoiseAccent({
          duration: 0.035 + random() * 0.055,
          filterType: 'bandpass',
          frequency: 2_200 + random() * 2_600,
          peak: currentMix.accentGain * (0.48 + random() * 0.52),
          attack: 0.006,
        })
        return
      }
      if (options.kind === 'embers') {
        playNoiseAccent({
          duration: 0.025 + random() * 0.065,
          filterType: 'highpass',
          frequency: 1_400 + random() * 2_200,
          peak: currentMix.accentGain * (0.35 + random() * 0.65),
          attack: 0.004,
        })
        return
      }
      const duration = options.kind === 'wind'
        ? 2.4 + random() * 2.2
        : 1.5 + random() * 2
      playNoiseAccent({
        duration,
        filterType: 'lowpass',
        frequency: options.kind === 'sandstorm' ? 1_900 : options.kind === 'blizzard' ? 1_250 : 1_600,
        peak: currentMix.accentGain * (0.55 + random() * 0.45),
        attack: 0.35 + random() * 0.45,
        pan: random() * 1.2 - 0.6,
      })
    }

    const nextAccentDelay = (initial: boolean): number | null => {
      const densityScale = 1.18 - currentIntensity * 0.48
      if (options.kind === 'rain' || options.kind === 'cave') return null
      if (options.kind === 'thunderstorm') {
        return initial ? 1_800 + random() * 2_400 : (7_000 + random() * 8_000) * densityScale
      }
      if (options.kind === 'hail') return (130 + random() * 430) * densityScale
      if (options.kind === 'embers') return (320 + random() * 1_150) * densityScale
      if (options.kind === 'blizzard') return (1_400 + random() * 2_500) * densityScale
      if (options.kind === 'sandstorm') return (1_700 + random() * 3_200) * densityScale
      return (2_300 + random() * 4_100) * densityScale
    }

    const scheduleAccent = (initial = false) => {
      if (disposed) return
      const delay = nextAccentDelay(initial)
      if (delay == null) return
      accentTimer = window.setTimeout(() => {
        playWeatherAccent()
        scheduleAccent(false)
      }, delay)
    }
    scheduleAccent(true)

    return {
      setMix: (intensity, volume) => {
        currentIntensity = clamp(intensity, 0, 1)
        currentMix = sceneWeatherAudioMix({
          kind: options.kind,
          intensity: currentIntensity,
          soundEnabled: true,
          soundVolume: volume,
        })
        if (context.state === 'closed') return
        bedGain.gain.setTargetAtTime(currentMix.bedGain, context.currentTime, 0.18)
        caveRecordingGain?.gain.setTargetAtTime(
          Math.min(0.4, currentMix.accentGain * 1.25),
          context.currentTime,
          0.18,
        )
      },
      stop: () => {
        if (disposed) return
        disposed = true
        window.clearTimeout(accentTimer)
        caveRecordingController?.abort()
        removeUnlockListeners()
        document.removeEventListener('visibilitychange', handleVisibility)
        if (context.state === 'closed') return
        const now = context.currentTime
        master.gain.cancelScheduledValues(now)
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now)
        master.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)
        window.setTimeout(() => {
          try { bedSource.stop() } catch { /* already stopped */ }
          try { caveRecordingSource?.stop() } catch { /* already stopped */ }
          void context.close().catch(() => undefined)
        }, 280)
      },
    }
  } catch {
    return null
  }
}
