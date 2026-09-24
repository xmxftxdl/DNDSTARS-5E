import { afterEach, describe, expect, it, vi } from 'vitest'
const runtime = vi.hoisted(() => ({ dice: [] as unknown[], spawn: undefined as (() => void) | undefined }))
vi.mock('@3d-dice/dice-box-threejs', () => ({ default: class {
  diceList = runtime.dice
  constructor() { runtime.spawn = () => this.spawnDice() }
  spawnDice() {}
  async initialize() {}
} }))
import { createDiceBox } from './diceEngine'

afterEach(() => vi.unstubAllGlobals())
describe('forced-roll preflight face reader', () => {
  it('uses geometry group spans and the physics pose before forced labels are assigned', async () => {
    const element = () => ({ dataset: {}, style: {}, setAttribute() {}, appendChild() {}, remove() {}, getBoundingClientRect: () => ({ width: 100, height: 100, left: 0, top: 0 }) })
    vi.stubGlobal('document', { createElement: element, head: element(), body: element(), querySelector: () => element() })
    const die = {
      shape: 'd20',
      // The hidden simulation moves the body; the mesh still has its launch pose.
      quaternion: { x: 1, y: 0, z: 0, w: 0 },
      body: { quaternion: { x: 0, y: 0, z: 0, w: 1 } },
      geometry: {
        groups: [{ start: 0, count: 6, materialIndex: 7 }, { start: 6, count: 3, materialIndex: 9 }],
        getAttribute: () => ({ array: [...Array.from({ length: 6 }, () => [0, 0, -1]).flat(), ...Array.from({ length: 3 }, () => [0, 0, 1]).flat()] }),
      },
      // The vendor's groupIndex*9 lookup reads vertex 3 instead of vertex 6.
      getFaceValue: () => ({ value: 6, label: '6', reason: 'natural' }),
    }
    runtime.dice = [die]
    const box = await createDiceBox('#dice')
    runtime.spawn!()
    expect(die.getFaceValue()).toEqual({ value: 8, label: '8', reason: 'natural' })
    // Visible pose and simulated pose are deliberately distinct in preflight.
    expect(box.visibleValues()).toEqual([6])
    runtime.spawn!()
    expect(die.getFaceValue().value).toBe(8)
  })
})
