import type { SceneAudioCue } from './sceneOrchestration'

type PlayableSceneCue = Exclude<SceneAudioCue, 'none'>

const CUE_NOTES: Readonly<Record<PlayableSceneCue, readonly number[]>> = {
  discovery: [392, 523.25, 659.25],
  danger: [110, 103.83, 98],
  door: [146.83, 110],
  mystery: [220, 261.63, 311.13],
  victory: [261.63, 329.63, 392, 523.25],
}

/** Small built-in cues keep scene packages self-contained and avoid remote media URLs. */
export function playSceneAudioCue(cue: PlayableSceneCue): void {
  if (typeof window === 'undefined') return
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return
  try {
    const context = new AudioContextClass()
    const gain = context.createGain()
    const now = context.currentTime
    const notes = CUE_NOTES[cue]
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(cue === 'danger' ? 0.075 : 0.045, now + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.55, notes.length * 0.22))
    gain.connect(context.destination)
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      oscillator.type = cue === 'danger' || cue === 'door' ? 'triangle' : 'sine'
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.17)
      oscillator.connect(gain)
      oscillator.start(now + index * 0.17)
      oscillator.stop(now + index * 0.17 + 0.32)
    })
    window.setTimeout(() => void context.close(), 1_800)
  } catch {
    // Browsers can block audio until the user interacts; scene execution must continue safely.
  }
}
