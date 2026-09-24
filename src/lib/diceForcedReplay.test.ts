import { afterEach, describe, expect, it, vi } from 'vitest'
import { installForcedDiceReplay, type ForcedReplayRuntime } from './diceForcedReplay'
afterEach(() => vi.unstubAllGlobals())
function setup(forced = true) {
  const callbacks: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.push(callback); return callbacks.length })
  vi.stubGlobal('performance', { now: () => 0 })
  const vector = () => ({ x: 0, y: 0, z: 0 })
  const quaternion = () => ({ ...vector(), w: 1 })
  const die = { position: vector(), quaternion: quaternion(), body: { position: vector(), quaternion: quaternion(), velocity: vector(), angularVelocity: vector(), type: 4 }, storeRolledValue: vi.fn() }
  const painted: number[] = []
  const step = vi.fn(() => { die.body.position.x += 10 })
  const nativeAnimation = vi.fn()
  const box: ForcedReplayRuntime = { diceList: [die], world: { step }, framerate: 1 / 60,
    notationVectors: { result: forced ? [8] : [] },
    simulateThrow() { this.world.step(this.framerate); this.world.step(this.framerate) },
    animateThrow: nativeAnimation, renderer: { render() { painted.push(die.position.x) } },
    scene: {}, camera: {}, running: 123, rolling: true, animstate: '',
  }
  const align = vi.fn(() => { expect(die.position.x).toBe(20); box.renderer.render({}, {}) })
  installForcedDiceReplay(box, align)
  return { box, callbacks, painted, step, nativeAnimation, align, die }
}
describe('forced dice trajectory replay', () => {
  it('aligns before first paint and replays the one simulated path without resimulating', () => {
    const s = setup()
    s.box.simulateThrow()
    const complete = vi.fn()
    s.box.animateThrow(123, complete)
    expect(s.align).toHaveBeenCalledWith([8])
    expect(s.painted).toEqual([])
    s.callbacks.shift()!(-0.5)
    s.callbacks.shift()!(17)
    s.callbacks.shift()!(34)
    expect(s.painted).toEqual([0, 10, 20])
    expect(s.step).toHaveBeenCalledTimes(2)
    expect(s.nativeAnimation).not.toHaveBeenCalled()
    expect(complete).toHaveBeenCalledTimes(1)
    expect(s.box.rolling).toBe(false)
  })
  it('does not complete or paint an interrupted old throw', () => {
    const s = setup(); s.box.simulateThrow(); const complete = vi.fn()
    s.box.animateThrow(123, complete); s.box.running = false
    s.callbacks.shift()!(100)
    expect(s.painted).toEqual([]); expect(complete).not.toHaveBeenCalled()
  })
  it('leaves unforced physical throws and manual rerolls on the native path', () => {
    const s = setup(false); s.box.simulateThrow(); s.box.animateThrow(123)
    expect(s.nativeAnimation).toHaveBeenCalledTimes(1)
    expect(s.align).not.toHaveBeenCalled()
  })
})
