import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ box: null as unknown }))
vi.mock('@3d-dice/dice-box-threejs', () => ({ default: class {
  camera = { zoom: 1, fov: 20, position: { z: 1200 }, updateProjectionMatrix: vi.fn() }
  scene = {}
  display = { containerWidth: 400, containerHeight: 600 }
  frames: number[] = []
  dimensionsSeen: unknown[] = []
  renderer = { render: () => { this.frames.push(this.camera.zoom) } }
  diceList: unknown[] = []
  DiceFactory = { createGeometry: (shape: string, radius: number) => {
    const extent = radius * Number(shape.slice(1)) / 6
    return { getAttribute: (name: string) => name === 'position'
      ? { array: [-extent, -extent, -extent, extent, extent, extent] }
      : undefined }
  } }
  constructor() { state.box = this }
  async initialize() {}
  setDimensions(dimensions?: { x: number; y: number }) {
    this.dimensionsSeen.push(dimensions)
    this.camera = { ...this.camera, zoom: 1 }
    this.renderer.render()
  }
} }))
import { createDiceBox } from './diceEngine'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it.each([true, false])('does not lock dice to zero pixels when hidden (initially hidden: %s)', async (initiallyHidden) => {
  const element = { clientWidth: initiallyHidden ? 0 : 340, clientHeight: initiallyHidden ? 0 : 400 }
  const node = () => ({ dataset: {}, style: {}, setAttribute: vi.fn(), appendChild: vi.fn() })
  vi.stubGlobal('document', { createElement: node, head: node(), body: node() })
  await createDiceBox(element as HTMLElement, { diceCount: 1, dimensions: { x: 340, y: 400 } })
  const box = state.box as { camera: { zoom: number }; setDimensions: () => void }
  element.clientWidth = 340
  element.clientHeight = 400
  box.setDimensions()
  const visibleZoom = box.camera.zoom
  expect(visibleZoom).toBeGreaterThan(0)
  element.clientWidth = 0
  element.clientHeight = 0
  box.setDimensions()
  element.clientWidth = 340
  element.clientHeight = 400
  box.setDimensions()
  expect(box.camera.zoom).toBe(visibleZoom)
})

it.each([1, 2, 20])('keeps collision walls fixed when a %i-die tray shrinks and grows', async (diceCount) => {
  const element = { clientWidth: 340, clientHeight: 400 } as HTMLElement
  const node = () => ({ dataset: {}, style: {}, setAttribute: vi.fn(), appendChild: vi.fn() })
  vi.stubGlobal('document', { createElement: node, head: node(), body: node() })
  const dimensions = { x: 420, y: 480 }
  await createDiceBox(element, { diceCount, dimensions })
  const box = state.box as {
    setDimensions: (dimensions: { x: number; y: number }) => void;
    dimensionsSeen: unknown[];
  }
  for (const size of [{ x: 250, y: 300 }, { x: 800, y: 900 }, { x: 340, y: 400 }]) {
    box.setDimensions(size)
  }
  expect(box.dimensionsSeen).toEqual([dimensions, dimensions, dimensions])
})

it('normalizes each die geometry before display and never changes zoom during gathering or resize rendering', async () => {
  const element = { clientWidth: 400, clientHeight: 600 } as HTMLElement
  const node = () => ({ dataset: {}, style: {}, setAttribute: vi.fn(), appendChild: vi.fn() })
  vi.stubGlobal('document', { createElement: node, head: node(), body: node() })
  const engine = await createDiceBox(element, { diceCount: 6 })
  const box = state.box as {
    camera: { zoom: number }; frames: number[]; diceList: unknown[];
    DiceFactory: { createGeometry: (shape: string, radius: number) => { getAttribute: (name: string) => { array: number[] } } };
    setDimensions: () => void;
  }
  const shapes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']
  const vector = () => ({ x: 0, y: 0, z: 1, set(x: number, y: number, z: number) { Object.assign(this, { x, y, z }) } })
  box.diceList = shapes.map(shape => {
    const geometry = box.DiceFactory.createGeometry(shape, 76)
    const vertices = geometry.getAttribute('position').array
    const width = vertices[3] - vertices[0]
    expect(shape === 'd6' ? Math.hypot(width, width) : width).toBeCloseTo(shape === 'd20' ? 152 * 1.1 : 152)
    return { shape, geometry, position: vector(), quaternion: { x: 0, y: 0, z: 0, w: 1 } }
  })
  const initialZoom = box.camera.zoom
  vi.spyOn(performance, 'now').mockReturnValue(0)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(400); return 1 })
  await engine.arrangeSettledDice()
  box.setDimensions()
  expect(box.frames.length).toBeGreaterThan(1)
  expect(box.frames.every(zoom => zoom === initialZoom)).toBe(true)
  expect(box.camera.zoom).toBe(initialZoom)
})
