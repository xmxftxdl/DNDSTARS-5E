import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ dice: [] as unknown[], swap: vi.fn(), add: vi.fn() }))
vi.mock('@3d-dice/dice-box-threejs', () => ({ default: class {
  diceList = runtime.dice
  swapDiceFace = runtime.swap
  async initialize() {}
  async reroll() { return [] }
  add(notation: string) { return runtime.add(notation) }
} }))

import { createDiceBox } from './diceEngine'
import { buildMapFreeDiceRollPresentation } from '../components/map/mapFreeDiceRoll'

function vector(x = 0, y = 0, z = 0) {
  return { x, y, z, set(a: number, b: number, c: number) { this.x = a; this.y = b; this.z = c }, clone() { return vector(this.x, this.y, this.z) } }
}

function die(physicalValue: number, recordedValue: number) {
  let value = recordedValue
  return {
    shape: 'd6', position: vector(0, 0, 60),
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    body: { position: vector(), velocity: vector(), angularVelocity: vector() },
    geometry: {
      groups: [{ start: 0, count: 3, materialIndex: physicalValue + 1 }],
      getAttribute: () => ({ array: [0, 0, 1, 0, 0, 1, 0, 0, 1] }),
    },
    getLastValue: () => ({ value }),
    setLastValue: (result: { value: number }) => { value = result.value },
  }
}

describe('physical reroll outcome', () => {
  it('appends a pre-generated die without clearing the existing pool', async () => {
    const original = die(6, 6)
    runtime.dice = [original]
    runtime.add.mockImplementation(async (notation: string) => {
      expect(notation).toBe('1d20@18')
      expect(runtime.dice[0]).toBe(original)
      runtime.dice.push(die(18, 18))
      return []
    })
    const box = await createDiceBox('#dice')
    await expect(box.append(20, [6, 18], 1)).resolves.toEqual([6, 18])
    expect(runtime.dice[0]).toBe(original)
    expect(runtime.add).toHaveBeenCalledTimes(1)
  })
  beforeEach(() => {
    runtime.swap.mockClear()
    const element = () => ({ dataset: {}, style: {}, setAttribute() {}, appendChild() {}, remove() {}, getBoundingClientRect: () => ({ width: 100, height: 100, left: 0, top: 0 }) })
    vi.stubGlobal('document', { createElement: element, head: element(), body: element(), querySelector: () => element() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('corrects a d20 showing 5 even when cached history already says 15', async () => {
    const selected = { ...die(5, 15), shape: 'd20' }
    runtime.dice = [selected]
    runtime.swap.mockImplementation((target, value: number) => {
      // Native swap uses recorded history to choose which labels to exchange.
      expect(target.getLastValue().value).toBe(5)
      target.geometry.groups[0].materialIndex = value + 1
    })
    const box = await createDiceBox('#dice')
    expect(box.correctVisibleFaces([15])).toBe(true)
    expect(runtime.swap).toHaveBeenCalledWith(selected, 15)
    expect(box.visibleValues()).toEqual([15])
    expect(selected.getLastValue().value).toBe(15)
    runtime.swap.mockReset()
  })

  it('settles a visible 3 as 3 even if the recorded value was 1, without relabeling the die', async () => {
    const selected = die(3, 1)
    runtime.dice = [selected, die(4, 4), die(6, 6)]
    const box = await createDiceBox('#dice')
    const values = await box.reroll(0)
    expect(values).toEqual([3, 4, 6])
    expect(box.visibleValues()).toEqual([3, 4, 6])
    expect(selected.getLastValue().value).toBe(3)
    expect(runtime.swap).not.toHaveBeenCalled()
    expect(selected.geometry.groups[0].materialIndex).toBe(4)
    const presentation = buildMapFreeDiceRollPresentation({ values, count: 3, sides: 6, bonus: 2, rollerName: 'DM', privateRoll: false })
    expect(presentation.total).toBe(15)
    expect(presentation.logMessage).toContain('3、4、6')
    expect(presentation.logMessage).toContain('= 15')
  })
})
