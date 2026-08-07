import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client'
import {
  type VoiceChangerSelection,
  voiceChangerParameters,
} from './voiceChanger'

const PITCH_WORKLET_NAME = 'astraltrace-voice-pitch-v1'
const loadedWorkletContexts = new WeakSet<AudioContext>()

function workletUrl(): string {
  return new URL(`${import.meta.env.BASE_URL}audio/astraltrace-voice-pitch-worklet.js`, window.location.origin).href
}

async function ensurePitchWorklet(context: AudioContext): Promise<boolean> {
  if (!context.audioWorklet) return false
  if (loadedWorkletContexts.has(context)) return true
  try {
    await context.audioWorklet.addModule(workletUrl())
    loadedWorkletContexts.add(context)
    return true
  } catch {
    return false
  }
}

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(2048)
  const strength = Math.max(0, amount) * 120
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index * 2) / (curve.length - 1) - 1
    curve[index] = strength <= 0
      ? x
      : ((3 + strength) * x * 20 * Math.PI / 180) / (Math.PI + strength * Math.abs(x))
  }
  return curve
}

function reverbImpulse(context: AudioContext, seconds = 1.6): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds))
  const impulse = context.createBuffer(2, length, context.sampleRate)
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel)
    for (let index = 0; index < length; index += 1) {
      const decay = (1 - index / length) ** 2.4
      data[index] = (Math.random() * 2 - 1) * decay
    }
  }
  return impulse
}

function setSmooth(param: AudioParam, value: number, context: AudioContext) {
  param.cancelScheduledValues(context.currentTime)
  param.setTargetAtTime(value, context.currentTime, 0.025)
}

/**
 * Host-owned microphone processor. Imported plugin data never reaches this graph.
 * The original microphone track remains the source; LiveKit publishes processedTrack.
 */
export class AstralTraceVoiceChangerProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  readonly name = 'astraltrace-npc-voice-changer-v1'
  processedTrack?: MediaStreamTrack

  private selection: VoiceChangerSelection
  private context?: AudioContext
  private highpass?: BiquadFilterNode
  private lowpass?: BiquadFilterNode
  private lowShelf?: BiquadFilterNode
  private highShelf?: BiquadFilterNode
  private pitch?: AudioWorkletNode
  private shaper?: WaveShaperNode
  private tremolo?: GainNode
  private tremoloDepth?: GainNode
  private tremoloOscillator?: OscillatorNode
  private dry?: GainNode
  private echo?: DelayNode
  private echoFeedback?: GainNode
  private echoMix?: GainNode
  private reverbMix?: GainNode
  private master?: GainNode
  private nodes: AudioNode[] = []

  constructor(selection: VoiceChangerSelection) {
    this.selection = selection
  }

  setSelection(selection: VoiceChangerSelection) {
    this.selection = selection
    this.applySelection()
  }

  async init(options: AudioProcessorOptions): Promise<void> {
    await this.createGraph(options)
  }

  async restart(options: AudioProcessorOptions): Promise<void> {
    await this.destroy()
    await this.createGraph(options)
  }

  private async createGraph(options: AudioProcessorOptions) {
    const context = options.audioContext
    this.context = context
    const source = context.createMediaStreamSource(new MediaStream([options.track]))
    const destination = context.createMediaStreamDestination()
    const highpass = context.createBiquadFilter()
    highpass.type = 'highpass'
    const lowpass = context.createBiquadFilter()
    lowpass.type = 'lowpass'
    const lowShelf = context.createBiquadFilter()
    lowShelf.type = 'lowshelf'
    lowShelf.frequency.value = 250
    const highShelf = context.createBiquadFilter()
    highShelf.type = 'highshelf'
    highShelf.frequency.value = 2_600
    const shaper = context.createWaveShaper()
    shaper.oversample = '2x'
    const tremolo = context.createGain()
    const tremoloDepth = context.createGain()
    const tremoloOscillator = context.createOscillator()
    tremoloOscillator.type = 'sine'
    tremoloOscillator.connect(tremoloDepth).connect(tremolo.gain)
    tremoloOscillator.start()
    const dry = context.createGain()
    const echo = context.createDelay(0.8)
    const echoFeedback = context.createGain()
    const echoMix = context.createGain()
    const reverb = context.createConvolver()
    reverb.buffer = reverbImpulse(context)
    const reverbMix = context.createGain()
    const master = context.createGain()
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -8
    compressor.knee.value = 12
    compressor.ratio.value = 8
    compressor.attack.value = 0.004
    compressor.release.value = 0.18

    source.connect(highpass).connect(lowpass).connect(lowShelf).connect(highShelf)
    let processedInput: AudioNode = highShelf
    if (await ensurePitchWorklet(context)) {
      const pitch = new AudioWorkletNode(context, PITCH_WORKLET_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      })
      highShelf.connect(pitch)
      processedInput = pitch
      this.pitch = pitch
      this.nodes.push(pitch)
    }
    processedInput.connect(shaper).connect(tremolo)
    tremolo.connect(dry).connect(master)
    tremolo.connect(echo)
    echo.connect(echoFeedback).connect(echo)
    echo.connect(echoMix).connect(master)
    tremolo.connect(reverb).connect(reverbMix).connect(master)
    master.connect(compressor).connect(destination)

    this.highpass = highpass
    this.lowpass = lowpass
    this.lowShelf = lowShelf
    this.highShelf = highShelf
    this.shaper = shaper
    this.tremolo = tremolo
    this.tremoloDepth = tremoloDepth
    this.tremoloOscillator = tremoloOscillator
    this.dry = dry
    this.echo = echo
    this.echoFeedback = echoFeedback
    this.echoMix = echoMix
    this.reverbMix = reverbMix
    this.master = master
    this.nodes.push(source, highpass, lowpass, lowShelf, highShelf, shaper, tremolo, tremoloDepth, dry, echo, echoFeedback, echoMix, reverb, reverbMix, master, compressor, destination)
    this.processedTrack = destination.stream.getAudioTracks()[0]
    this.applySelection()
  }

  private applySelection() {
    const context = this.context
    if (!context) return
    const parameters = voiceChangerParameters(this.selection)
    if (this.pitch) setSmooth(this.pitch.parameters.get('pitchRatio')!, parameters.pitchRatio, context)
    if (this.highpass) setSmooth(this.highpass.frequency, parameters.highpassHz, context)
    if (this.lowpass) setSmooth(this.lowpass.frequency, parameters.lowpassHz, context)
    if (this.lowShelf) setSmooth(this.lowShelf.gain, parameters.lowShelfDb, context)
    if (this.highShelf) setSmooth(this.highShelf.gain, parameters.highShelfDb, context)
    if (this.shaper) this.shaper.curve = distortionCurve(parameters.drive)
    if (this.tremolo) setSmooth(this.tremolo.gain, 1 - parameters.tremoloDepth / 2, context)
    if (this.tremoloDepth) setSmooth(this.tremoloDepth.gain, parameters.tremoloDepth / 2, context)
    if (this.tremoloOscillator) setSmooth(this.tremoloOscillator.frequency, Math.max(0.01, parameters.tremoloRateHz), context)
    if (this.dry) setSmooth(this.dry.gain, Math.max(0.45, 1 - parameters.reverbMix * 0.45), context)
    if (this.echo) setSmooth(this.echo.delayTime, parameters.echoSeconds, context)
    if (this.echoFeedback) setSmooth(this.echoFeedback.gain, parameters.echoFeedback, context)
    if (this.echoMix) setSmooth(this.echoMix.gain, parameters.echoSeconds > 0 ? 0.35 : 0, context)
    if (this.reverbMix) setSmooth(this.reverbMix.gain, parameters.reverbMix, context)
    if (this.master) setSmooth(this.master.gain, parameters.outputGain, context)
  }

  async destroy(): Promise<void> {
    try {
      this.tremoloOscillator?.stop()
    } catch {
      // Oscillator may already have stopped during a LiveKit track restart.
    }
    for (const node of this.nodes) {
      try {
        node.disconnect()
      } catch {
        // Disconnected WebAudio nodes are safe to ignore during teardown.
      }
    }
    this.processedTrack?.stop()
    this.processedTrack = undefined
    this.context = undefined
    this.pitch = undefined
    this.tremoloOscillator = undefined
    this.nodes = []
  }
}
