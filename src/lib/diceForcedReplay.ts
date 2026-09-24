interface Vector { x: number; y: number; z: number }
interface Quaternion extends Vector { w: number }
interface Die {
  position: Vector
  quaternion: Quaternion
  body: { position: Vector; quaternion: Quaternion; velocity: Vector; angularVelocity: Vector; type: number }
  storeRolledValue(reason: string): void
}
export interface ForcedReplayRuntime {
  diceList: Die[]
  notationVectors?: { result?: number[] }
  world: { step: (dt: number) => void }
  framerate: number
  simulateThrow: () => void
  animateThrow: (id: number, complete?: () => void) => void
  renderer: { render: (scene: unknown, camera: unknown) => void }
  scene: unknown
  camera: unknown
  running: number | boolean
  rolling: boolean
  animstate: string
}
type Frame = Float64Array

/** Replay one simulated trajectory; never run a second divergent simulation. */
export function installForcedDiceReplay(box: ForcedReplayRuntime, align: (values: number[]) => void) {
  if (!box.simulateThrow || !box.animateThrow || !box.world) return
  const simulate = box.simulateThrow
  const animate = box.animateThrow
  let recorded: { frames: Frame[]; types: number[]; values: number[] } | undefined
  const capture = () => new Float64Array(box.diceList.flatMap(die => {
    const { position: p, quaternion: q } = die.body
    return [p.x, p.y, p.z, q.x, q.y, q.z, q.w]
  }))
  const apply = (frame: Frame) => box.diceList.forEach((die, index) => {
    const offset = index * 7
    for (const target of [die.position, die.body.position]) {
      Object.assign(target, { x: frame[offset], y: frame[offset + 1], z: frame[offset + 2] })
    }
    for (const target of [die.quaternion, die.body.quaternion]) {
      Object.assign(target, { x: frame[offset + 3], y: frame[offset + 4], z: frame[offset + 5], w: frame[offset + 6] })
    }
    Object.assign(die.body.velocity, { x: 0, y: 0, z: 0 })
    Object.assign(die.body.angularVelocity, { x: 0, y: 0, z: 0 })
  })
  box.simulateThrow = function () {
    recorded = undefined
    const values = box.notationVectors?.result
    if (!values?.length) return simulate.call(box)
    const frames = [capture()]
    const step = box.world.step
    box.world.step = function (dt) { step.call(box.world, dt); frames.push(capture()) }
    try {
      simulate.call(box)
      recorded = { frames, types: box.diceList.map(die => die.body.type), values: [...values] }
    } finally { box.world.step = step }
  }
  box.animateThrow = function (id, complete) {
    const replay = recorded
    recorded = undefined
    if (!replay) return animate.call(box, id, complete)
    const { frames, values, types } = replay
    const render = box.renderer.render
    // Map the result labels against the trajectory's terminal pose before any
    // visible frame. Restore the launch pose before rendering starts.
    box.renderer.render = () => {}
    try {
      apply(frames[frames.length - 1])
      align(values)
      apply(frames[0])
    } finally { box.renderer.render = render }
    box.diceList.forEach((die, index) => { die.body.type = types[index] })
    box.animstate = 'throw'
    const startedAt = performance.now()
    const tick = (now: number) => {
      if (box.running !== id) return
      const index = Math.min(frames.length - 1, Math.max(0, Math.floor((now - startedAt) / (box.framerate * 1000))))
      apply(frames[index])
      render.call(box.renderer, box.scene, box.camera)
      if (index < frames.length - 1) { requestAnimationFrame(tick); return }
      box.diceList.forEach(die => die.storeRolledValue('forced'))
      box.rolling = false
      box.running = false
      box.animstate = 'afterthrow'
      complete?.call(box)
    }
    requestAnimationFrame(tick)
  }
}
