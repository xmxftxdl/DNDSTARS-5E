class AstralTraceVoicePitchProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'pitchRatio', defaultValue: 1, minValue: 0.5, maxValue: 2, automationRate: 'k-rate' }]
  }

  constructor() {
    super()
    this.bufferLength = 8192
    this.buffers = []
    this.writeIndex = 0
    this.phase = 0
  }

  ensureChannels(count) {
    while (this.buffers.length < count) this.buffers.push(new Float32Array(this.bufferLength))
  }

  readInterpolated(buffer, position) {
    let normalized = position % this.bufferLength
    if (normalized < 0) normalized += this.bufferLength
    const left = Math.floor(normalized)
    const right = (left + 1) % this.bufferLength
    const mix = normalized - left
    return buffer[left] * (1 - mix) + buffer[right] * mix
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0 || !output || output.length === 0) return true
    this.ensureChannels(output.length)
    const pitchRatio = Math.max(0.5, Math.min(2, parameters.pitchRatio[0] || 1))
    const frameCount = output[0].length
    const maxDelay = Math.min(this.bufferLength - 4, Math.max(512, Math.floor(sampleRate * 0.055)))
    const phaseIncrement = Math.abs(1 - pitchRatio) / maxDelay

    for (let frame = 0; frame < frameCount; frame += 1) {
      for (let channel = 0; channel < output.length; channel += 1) {
        const inputChannel = input[Math.min(channel, input.length - 1)]
        this.buffers[channel][this.writeIndex] = inputChannel ? inputChannel[frame] || 0 : 0
      }

      if (Math.abs(1 - pitchRatio) < 0.002) {
        for (let channel = 0; channel < output.length; channel += 1) {
          output[channel][frame] = this.buffers[channel][this.writeIndex]
        }
      } else {
        const phaseA = this.phase
        const phaseB = (this.phase + 0.5) % 1
        const delayA = pitchRatio >= 1 ? maxDelay * (1 - phaseA) : maxDelay * phaseA
        const delayB = pitchRatio >= 1 ? maxDelay * (1 - phaseB) : maxDelay * phaseB
        const windowA = 0.5 - 0.5 * Math.cos(2 * Math.PI * phaseA)
        const windowB = 0.5 - 0.5 * Math.cos(2 * Math.PI * phaseB)
        const normalizer = Math.max(0.001, windowA + windowB)
        for (let channel = 0; channel < output.length; channel += 1) {
          const buffer = this.buffers[channel]
          const sampleA = this.readInterpolated(buffer, this.writeIndex - delayA)
          const sampleB = this.readInterpolated(buffer, this.writeIndex - delayB)
          output[channel][frame] = (sampleA * windowA + sampleB * windowB) / normalizer
        }
        this.phase = (this.phase + phaseIncrement) % 1
      }
      this.writeIndex = (this.writeIndex + 1) % this.bufferLength
    }
    return true
  }
}

registerProcessor('astraltrace-voice-pitch-v1', AstralTraceVoicePitchProcessor)
