import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ box: null as unknown }))
vi.mock('@3d-dice/dice-box-threejs', () => ({ default: class {
  camera = { zoom: 1, fov: 20, position: { z: 1200 }, updateProjectionMatrix: vi.fn() }
  scene = {}
  display = { containerWidth: 400, containerHeight: 600 }
  frames: number[] = []
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
  setDimensions() {
    this.camera = { ...this.camera, zoom: 1 }
    this.renderer.render()
  }
} }))
import { createDiceBox } from './diceEngine'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

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
