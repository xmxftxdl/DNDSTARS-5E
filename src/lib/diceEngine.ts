// ============================================================================
// diceEngine — thin wrapper around @3d-dice/dice-box-threejs (T-P2-396).
//
// The migration's @ predetermined-roll mechanic already collapses forced /
// random / replay into a single roll(notation) call, so this layer deliberately
// does NOT introduce an IDiceEngine-style abstraction. It pins exactly the two
// things the sync layer (T-P2-397/398) will churn on:
//
//   1. onComplete payload shape  → DiceOutcome (values multiset + total + raw)
//   2. exactly-once delivery     → use the roll() Promise as the authority.
//      Some engine builds emit onRollComplete before the forced @ relabel is
//      fully reflected in the returned payload/visual; trusting the Promise
//      avoids that early-result race.
//
// AC3: all dice theming lives in ONE constant (DICE_THEME / DICE_ACCENT) — to
// recolor the dice, edit the constant here and nowhere else.
// ============================================================================
import DiceBox, { type DiceRollResults, type DiceColorset } from '@3d-dice/dice-box-threejs'
import { settledDiceGrid, dicePixelSize } from './diceFrameLayout'
import { diceThrowMotion, type DiceDragSample } from './diceThrowMotion'

// AC3 — single source of truth. Accent parity with the legacy Babylon
// themeColor in public/dice-box-frame.html ('#7c3aed').
export const DICE_ACCENT = '#7c3aed'

// Procedural theme: texture 'none' + sounds off fetch zero files from assetPath
// (source-verified in T-P2-395; see public/assets/dice-threejs/README.md).
export const DICE_THEME: DiceColorset = {
  name: 'arcane-purple',
  foreground: '#f5f3ff',
  background: DICE_ACCENT,
  outline: '#3b0764',
  texture: 'none',
  material: 'glass',
}

export const DICE_ASSET_PATH = '/assets/dice-threejs/'
export const DICE_BASE_SCALE = 76
export const DICE_D4_BASE_SCALE = DICE_BASE_SCALE
export const DICE_D4_LABEL_SCALE = 1.25
export const DICE_D4_THEME: DiceColorset = {
  ...DICE_THEME,
  name: 'arcane-purple-readable-d4',
  foreground: '#ffffff',
  background: '#6d28d9',
  outline: '#16002f',
  material: 'plastic',
}

// AC2 — the pinned payload. `values` is the per-die up-face multiset (removed
// dice excluded, matching the visible faces); `total` is the engine total;
// `raw` is the escape hatch for anything else downstream needs.
export interface DiceOutcome {
  notation: string
  values: number[]
  total: number
  raw: DiceRollResults
}

export interface CreateDiceBoxOptions {
  diceCount?: number
  scale?: number
  dimensions?: { x: number; y: number }
  theme?: DiceColorset
  onComplete?: (outcome: DiceOutcome) => void
}

export interface DiceEngineBox {
  // Resolves with the same DiceOutcome that onComplete receives — exactly once.
  roll(notation: string): Promise<DiceOutcome>
  stage(sides: number, values: number[], dieSides?: number[]): Promise<void>
  reroll(index: number): Promise<number[]>
  grabDie(x: number, y: number): number | null
  moveGrabbedDie(x: number, y: number): void
  releaseDie(throwDie?: boolean): void
  correctVisibleFaces(values: number[]): boolean
  highlightDie(index?: number): void
  visibleValues(): number[]
  arrangeSettledDice(values?: number[]): Promise<void>
  clear(): void
  destroy(): void
}

interface RuntimeVector {
  x: number
  y: number
  z: number
  set?: (x: number, y: number, z: number) => void
  clone?: () => ProjectableVector
}

interface ProjectableVector extends RuntimeVector {
  set: (x: number, y: number, z: number) => ProjectableVector
  project: (camera: unknown) => ProjectableVector
  unproject: (camera: unknown) => ProjectableVector
}

interface RuntimeQuaternion {
  x: number
  y: number
  z: number
  w: number
  set?: (x: number, y: number, z: number, w: number) => void
}

interface RuntimeGeometry {
  dispose?: () => void
  groups?: Array<{ start?: number; count?: number; materialIndex?: number }>
  getAttribute?: (name: string) => { array?: ArrayLike<number> } | undefined
}

interface RuntimeBody {
  position?: RuntimeVector
  quaternion?: RuntimeQuaternion
  velocity?: RuntimeVector
  angularVelocity?: RuntimeVector
}



interface RuntimeDie {
  notation?: { type?: string }
  shape?: string
  geometry?: RuntimeGeometry
  position?: RuntimeVector
  quaternion?: RuntimeQuaternion
  body?: RuntimeBody
  getLastValue?: () => { value?: number; label?: string; reason?: string }
  setLastValue?: (value: { value: number; label: string; reason: string }) => void
  storeRolledValue?: (reason: string) => void
}

interface RuntimeDiceBox {
  DiceFactory?: { createGeometry: (shape: string, radius: number, ...args: unknown[]) => RuntimeGeometry }
  setDimensions?: (dimensions?: { x: number; y: number }) => void
  startClickThrow?: (notation: string) => { vectors: unknown[] }
  spawnDice?: (vector: unknown) => void
  last_time?: number
  diceList?: RuntimeDie[]
  swapDiceFace?: (die: RuntimeDie, value: number) => void
  renderer?: { render: (scene: unknown, camera: unknown) => void }
  scene?: unknown
  camera?: unknown
  display?: { containerWidth?: number; containerHeight?: number; currentWidth?: number }
}

interface QuaternionValue {
  x: number
  y: number
  z: number
  w: number
}

interface VectorValue {
  x: number
  y: number
  z: number
}

function groupLocalNormal(
  normals: ArrayLike<number>,
  group: { start?: number; count?: number },
  groupIndex: number,
): VectorValue | undefined {
  const firstVertex = Number.isFinite(group.start)
    ? Math.max(0, Math.round(group.start!))
    : groupIndex * 3
  const vertexCount = Number.isFinite(group.count)
    ? Math.max(1, Math.round(group.count!))
    : 3
  let x = 0
  let y = 0
  let z = 0
  let samples = 0
  for (let vertex = firstVertex; vertex < firstVertex + vertexCount; vertex += 1) {
    const offset = vertex * 3
    if (offset + 2 >= normals.length) break
    const nextX = Number(normals[offset])
    const nextY = Number(normals[offset + 1])
    const nextZ = Number(normals[offset + 2])
    if (![nextX, nextY, nextZ].every(Number.isFinite)) continue
    x += nextX
    y += nextY
    z += nextZ
    samples += 1
  }
  if (samples < 1) return undefined
  const length = Math.hypot(x, y, z)
  if (length < 0.000001) return undefined
  return { x: x / length, y: y / length, z: z / length }
}

function normalizedQuaternion(value: QuaternionValue): QuaternionValue {
  const length = Math.hypot(value.x, value.y, value.z, value.w) || 1
  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
    w: value.w / length,
  }
}

function rotateVector(vector: VectorValue, quaternion: QuaternionValue): VectorValue {
  const tx = 2 * (quaternion.y * vector.z - quaternion.z * vector.y)
  const ty = 2 * (quaternion.z * vector.x - quaternion.x * vector.z)
  const tz = 2 * (quaternion.x * vector.y - quaternion.y * vector.x)
  return {
    x: vector.x + quaternion.w * tx + quaternion.y * tz - quaternion.z * ty,
    y: vector.y + quaternion.w * ty + quaternion.z * tx - quaternion.x * tz,
    z: vector.z + quaternion.w * tz + quaternion.x * ty - quaternion.y * tx,
  }
}

function multiplyQuaternion(left: QuaternionValue, right: QuaternionValue): QuaternionValue {
  return normalizedQuaternion({
    x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
    y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
    z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
  })
}

function uprightTopFaceQuaternion(die: RuntimeDie, targetValue?: number): QuaternionValue {
  const current = normalizedQuaternion({
    x: die.quaternion?.x ?? 0,
    y: die.quaternion?.y ?? 0,
    z: die.quaternion?.z ?? 0,
    w: die.quaternion?.w ?? 1,
  })
  const normals = die.geometry?.getAttribute?.('normal')?.array
  const groups = die.geometry?.groups
  if (!normals || !groups?.length) return current

  let upperNormal: VectorValue | undefined
  let upperLocalNormal: VectorValue | undefined
  const targetMaterial = targetValue == null ? undefined : die.notation?.type === 'd100'
    ? targetValue / 10 : die.shape === 'd10' || die.shape === 'd2' ? targetValue : targetValue + 1
  const hasTargetFace = targetMaterial != null && groups.some(group => group.materialIndex === targetMaterial)
  for (let index = 0; index < groups.length; index += 1) {
    if (groups[index].materialIndex === 0) continue
    if (hasTargetFace && groups[index].materialIndex !== targetMaterial) continue
    const localNormal = groupLocalNormal(normals, groups[index], index)
    if (!localNormal) continue
    const worldNormal = rotateVector(localNormal, current)
    if (!upperNormal || worldNormal.z > upperNormal.z) {
      upperNormal = worldNormal
      upperLocalNormal = localNormal
    }
  }
  if (!upperNormal || !upperLocalNormal) return current

  const length = Math.hypot(upperNormal.x, upperNormal.y, upperNormal.z) || 1
  const from = {
    x: upperNormal.x / length,
    y: upperNormal.y / length,
    z: upperNormal.z / length,
  }
  const correction = from.z < -0.999999
    ? { x: 1, y: 0, z: 0, w: 0 }
    : normalizedQuaternion({
        x: from.y,
        y: -from.x,
        z: 0,
        w: 1 + from.z,
      })
  const leveled = multiplyQuaternion(correction, current)
  const localNormalLength = Math.hypot(
    upperLocalNormal.x,
    upperLocalNormal.y,
    upperLocalNormal.z,
  ) || 1
  const normalizedLocalNormal = {
    x: upperLocalNormal.x / localNormalLength,
    y: upperLocalNormal.y / localNormalLength,
    z: upperLocalNormal.z / localNormalLength,
  }
  const tangentCandidates: VectorValue[] = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ]
  const tangent = tangentCandidates.reduce((best, candidate) => {
    const candidateDot = Math.abs(
      candidate.x * normalizedLocalNormal.x +
      candidate.y * normalizedLocalNormal.y +
      candidate.z * normalizedLocalNormal.z,
    )
    const bestDot = Math.abs(
      best.x * normalizedLocalNormal.x +
      best.y * normalizedLocalNormal.y +
      best.z * normalizedLocalNormal.z,
    )
    return candidateDot < bestDot ? candidate : best
  })
  const worldTangent = rotateVector(tangent, leveled)
  const yaw = Math.atan2(worldTangent.y, worldTangent.x)
  const yawCorrection = {
    x: 0,
    y: 0,
    z: Math.sin(-yaw / 2),
    w: Math.cos(-yaw / 2),
  }
  return multiplyQuaternion(yawCorrection, leveled)
}

function d4SettledFaceValue(die: RuntimeDie): number | undefined {
  if (die.shape !== 'd4') return undefined
  const normals = die.geometry?.getAttribute?.('normal')?.array
  const groups = die.geometry?.groups
  if (!normals || !groups?.length) return undefined
  const sourceQuaternion = die.body?.quaternion ?? die.quaternion
  const quaternion = normalizedQuaternion({
    x: sourceQuaternion?.x ?? 0,
    y: sourceQuaternion?.y ?? 0,
    z: sourceQuaternion?.z ?? 0,
    w: sourceQuaternion?.w ?? 1,
  })
  let lowestZ = Number.POSITIVE_INFINITY
  let value: number | undefined
  for (let index = 0; index < groups.length; index += 1) {
    const materialIndex = groups[index].materialIndex
    if (!materialIndex) continue
    const localNormal = groupLocalNormal(normals, groups[index], index)
    if (!localNormal) continue
    const worldNormal = rotateVector(localNormal, quaternion)
    if (worldNormal.z < lowestZ) {
      lowestZ = worldNormal.z
      value = materialIndex - 1
    }
  }
  return value != null && value >= 1 && value <= 4 ? value : undefined
}

function physicalDieValue(die: RuntimeDie): number | undefined {
  if (die.shape === 'd4') return d4SettledFaceValue(die)
  const normals = die.geometry?.getAttribute?.('normal')?.array
  const groups = die.geometry?.groups
  if (!normals || !groups || !die.quaternion) return undefined
  let highest = -Infinity
  let materialIndex: number | undefined
  for (let index = 0; index < groups.length; index += 1) {
    if (!groups[index].materialIndex) continue
    const normal = groupLocalNormal(normals, groups[index], index)
    if (!normal) continue
    const world = rotateVector(normal, normalizedQuaternion(die.quaternion))
    if (world.z > highest) {
      highest = world.z
      materialIndex = groups[index].materialIndex
    }
  }
  if (materialIndex == null) return undefined
  const value = die.shape === 'd10' || die.shape === 'd2' ? materialIndex : materialIndex - 1
  return die.notation?.type === 'd100' ? value * 10 : value
}

function d4ResultQuaternion(die: RuntimeDie, targetValue: number | undefined): QuaternionValue {
  const current = normalizedQuaternion({
    x: die.quaternion?.x ?? 0,
    y: die.quaternion?.y ?? 0,
    z: die.quaternion?.z ?? 0,
    w: die.quaternion?.w ?? 1,
  })
  if (die.shape !== 'd4' || targetValue == null) return current
  const normals = die.geometry?.getAttribute?.('normal')?.array
  const groups = die.geometry?.groups
  if (!normals || !groups?.length) return current
  const groupIndex = groups.findIndex((group) => group.materialIndex === targetValue + 1)
  if (groupIndex < 0) return current
  const localNormal = groupLocalNormal(normals, groups[groupIndex], groupIndex)
  if (!localNormal) return current
  const worldNormal = rotateVector(localNormal, current)
  const length = Math.hypot(worldNormal.x, worldNormal.y, worldNormal.z) || 1
  const from = {
    x: worldNormal.x / length,
    y: worldNormal.y / length,
    z: worldNormal.z / length,
  }
  const to = { x: 0, y: 0, z: -1 }
  const dot = Math.max(-1, Math.min(1, from.x * to.x + from.y * to.y + from.z * to.z))
  let correction: QuaternionValue
  if (dot < -0.999999) {
    correction = { x: 1, y: 0, z: 0, w: 0 }
  } else {
    correction = normalizedQuaternion({
      x: from.y * to.z - from.z * to.y,
      y: from.z * to.x - from.x * to.z,
      z: from.x * to.y - from.y * to.x,
      w: 1 + dot,
    })
  }
  return multiplyQuaternion(correction, current)
}

function settledQuaternion(die: RuntimeDie, targetValue: number | undefined): QuaternionValue {
  if (die.shape === 'd4') return d4ResultQuaternion(die, targetValue)
  return uprightTopFaceQuaternion(die, targetValue)
}

function geometryBounds(
  die: RuntimeDie,
  quaternion: QuaternionValue,
): { width: number; height: number; restingZ: number } {
  const vertices = die.geometry?.getAttribute?.('position')?.array
  if (!vertices || vertices.length < 3) {
    return { width: 120, height: 120, restingZ: Math.max(1, die.position?.z ?? 60) }
  }
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  for (let index = 0; index + 2 < vertices.length; index += 3) {
    const point = rotateVector({
      x: Number(vertices[index]),
      y: Number(vertices[index + 1]),
      z: Number(vertices[index + 2]),
    }, quaternion)
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
    minZ = Math.min(minZ, point.z)
  }
  return {
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    restingZ: Math.max(1, -minZ + 1),
  }
}

function slerpQuaternion(
  from: QuaternionValue,
  rawTo: QuaternionValue,
  ratio: number,
): QuaternionValue {
  let to = rawTo
  let cosine = from.x * to.x + from.y * to.y + from.z * to.z + from.w * to.w
  if (cosine < 0) {
    cosine = -cosine
    to = { x: -to.x, y: -to.y, z: -to.z, w: -to.w }
  }
  if (cosine > 0.9995) {
    return normalizedQuaternion({
      x: from.x + (to.x - from.x) * ratio,
      y: from.y + (to.y - from.y) * ratio,
      z: from.z + (to.z - from.z) * ratio,
      w: from.w + (to.w - from.w) * ratio,
    })
  }
  const angle = Math.acos(Math.max(-1, Math.min(1, cosine)))
  const sinAngle = Math.sin(angle)
  const fromWeight = Math.sin((1 - ratio) * angle) / sinAngle
  const toWeight = Math.sin(ratio * angle) / sinAngle
  return {
    x: from.x * fromWeight + to.x * toWeight,
    y: from.y * fromWeight + to.y * toWeight,
    z: from.z * fromWeight + to.z * toWeight,
    w: from.w * fromWeight + to.w * toWeight,
  }
}

function toOutcome(notation: string, raw: DiceRollResults): DiceOutcome {
  const values = raw.sets.flatMap((s) =>
    s.rolls.filter((d) => d.reason !== 'remove').map((d) => d.value),
  )
  return { notation, values, total: raw.total, raw }
}

/**
 * Construct + initialize a themed dice box and return a minimal handle. Rolls
 * are serialized: the engine owns a single physics world, and its global
 * onRollComplete would cross-talk between overlapping calls, so a second roll
 * while one is in flight rejects rather than corrupting delivery.
 */
export async function createDiceBox(
  container: string | HTMLElement,
  options: CreateDiceBoxOptions = {},
): Promise<DiceEngineBox> {
  const { scale = DICE_BASE_SCALE, dimensions, theme = DICE_THEME, onComplete } = options

  // Per-roll delivery slot. The Promise result is authoritative; the token
  // guards reject paths against a stale source from a prior roll.
  let pending: { token: number; notation: string; settle: (o: DiceOutcome) => void } | null = null
  let seq = 0

  const deliver = (raw: DiceRollResults | undefined) => {
    if (!pending || raw == null) return
    const { notation, settle } = pending
    pending = null // dedup: first source through wins
    const outcome = toOutcome(notation, raw)
    onComplete?.(outcome)
    settle(outcome)
  }

  const box = new DiceBox(container, {
    assetPath: DICE_ASSET_PATH,
    dimensions,
    theme_customColorset: theme,
    theme_material: theme.material ?? 'glass',
    baseScale: scale,
    gravity_multiplier: 400,
    light_intensity: 0.9,
    shadows: true,
    sounds: false,
  })

  await box.initialize?.()

  const runtimeBox = box as unknown as RuntimeDiceBox
  let grabbed: { index: number; position: ProjectableVector; quaternion: QuaternionValue; heldSince: number; depth: number; offsetX: number; offsetY: number; radius: number; samples: DiceDragSample[] } | null = null
  let rerolling = false
  let released: { index: number; motion: ReturnType<typeof diceThrowMotion> } | null = null
  // Screen-space cue: never modify a skin's material, emissive map, or geometry.
  const adoptedMarker = document.createElement('div')
  adoptedMarker.dataset.diceAdoptedMarker = 'true'
  adoptedMarker.setAttribute('aria-hidden', 'true')
  adoptedMarker.className = 'dice-adopted-aura'
  adoptedMarker.style.display = 'none'
  const adoptedStyle = document.createElement('style')
  adoptedStyle.textContent = `
    .dice-adopted-aura { position:fixed; pointer-events:none; z-index:20; }
    .dice-adopted-aura::before, .dice-adopted-aura::after { content:''; position:absolute; inset:0; border-radius:45%; }
    .dice-adopted-aura::before {
      background:radial-gradient(ellipse,transparent 42%,rgba(255,222,125,.42) 62%,rgba(255,181,65,.14) 73%,transparent 86%);
      filter:blur(3px); animation:dice-aura-breathe 3.2s ease-in-out infinite;
    }
    .dice-adopted-aura::after {
      background:conic-gradient(from 25deg,transparent 0deg 25deg,#fff2b3 44deg,transparent 64deg 140deg,#f7c767 167deg,transparent 190deg 269deg,#fff4c7 300deg,transparent 325deg);
      mask-image:radial-gradient(ellipse,transparent 53%,#000 66%,transparent 77%);
      opacity:.65; filter:blur(2px); animation:dice-aura-drift 9s linear infinite;
    }
    .dice-adopted-aura i { position:absolute; width:3px; height:3px; border-radius:50%; background:#fff7d6;
      box-shadow:0 0 5px 2px #ffdf8b88; animation:dice-aura-spark 2.8s ease-in-out infinite; }
    .dice-adopted-aura i:nth-child(1) { left:17%; top:22%; }
    .dice-adopted-aura i:nth-child(2) { right:13%; top:40%; animation-delay:-.9s; }
    .dice-adopted-aura i:nth-child(3) { left:36%; bottom:10%; animation-delay:-1.8s; }
    @keyframes dice-aura-breathe { 0%,100% {opacity:.65;transform:scale(.97)} 50% {opacity:1;transform:scale(1.04)} }
    @keyframes dice-aura-drift { to {transform:rotate(360deg)} }
    @keyframes dice-aura-spark { 0%,100% {opacity:.2;transform:translateY(3px) scale(.7)} 50% {opacity:.9;transform:translateY(-3px) scale(1)} }
    @media (prefers-reduced-motion:reduce) { .dice-adopted-aura::before,.dice-adopted-aura::after,.dice-adopted-aura i { animation:none; } }
  `
  document.head.appendChild(adoptedStyle)
  for (let index = 0; index < 3; index++) adoptedMarker.appendChild(document.createElement('i'))
  document.body.appendChild(adoptedMarker)
  let adoptedDieIndex: number | undefined
  const updateAdoptedMarker = () => {
    const die = adoptedDieIndex == null ? undefined : runtimeBox.diceList?.[adoptedDieIndex]
    const point = die?.position?.clone?.()
    const element = typeof container === 'string' ? document.querySelector(container) : container
    if (!die?.position || !point || !runtimeBox.camera || !element) { adoptedMarker.style.display = 'none'; return }
    const rect = element.getBoundingClientRect()
    const bounds = geometryBounds(die, normalizedQuaternion(die.quaternion ?? { x:0, y:0, z:0, w:1 }))
    let top = Infinity, left = Infinity, bottom = -Infinity, right = -Infinity
    for (const x of [-1,1]) for (const y of [-1,1]) for (const z of [-1,1]) {
      point.set(die.position.x + x*bounds.width/2, die.position.y + y*bounds.height/2,
        die.position.z + z*bounds.height/2).project(runtimeBox.camera)
      const screenX = (point.x+1)*rect.width/2
      const screenY = (1-point.y)*rect.height/2
      top = Math.min(top, screenY); bottom = Math.max(bottom, screenY)
      left = Math.min(left, screenX); right = Math.max(right, screenX)
    }
    const padding = Math.max(10, (right-left)*.18)
    adoptedMarker.style.left = `${rect.left + left - padding}px`
    adoptedMarker.style.top = `${rect.top + top - padding}px`
    adoptedMarker.style.width = `${right-left+padding*2}px`
    adoptedMarker.style.height = `${bottom-top+padding*2}px`
    adoptedMarker.style.display = 'block'
  }
  const hideAdoptedMarker = () => { adoptedDieIndex = undefined; adoptedMarker.style.display = 'none' }
  const renderScene = () => {
    updateAdoptedMarker()
    if (runtimeBox.scene && runtimeBox.camera) runtimeBox.renderer?.render(runtimeBox.scene, runtimeBox.camera)
  }
  // Normalize geometry AND its physics shape before any mesh is spawned.
  // A shared camera cannot normalize mixed dice by measuring the first die.
  const worldDiameter = scale * 2
  const factory = runtimeBox.DiceFactory
  if (factory) {
    const createGeometry = factory.createGeometry
    factory.createGeometry = function (shape, radius, ...args) {
      const probe = createGeometry.call(this, shape, radius, ...args)
      const die: RuntimeDie = { shape, geometry: probe }
      // D4 must be measured resting on a face, not in its factory orientation.
      const bounds = geometryBounds(die, settledQuaternion(die, 1))
      // A square's side is not its visual diameter: matching that side to a
      // polyhedron's full outline makes D6 occupy a much larger footprint.
      const footprintDiameter = shape === 'd6'
        ? Math.hypot(bounds.width, bounds.height)
        : Math.max(bounds.width, bounds.height)
      const factor = worldDiameter / footprintDiameter * (shape === 'd20' ? 1.1 : 1)
      probe.dispose?.()
      return createGeometry.call(this, shape, radius * factor, ...args)
    }
  }
  let fixedPixelSize: number | undefined
  const calibrateCamera = () => {
    const element = typeof container === 'string' ? document.querySelector(container) : container
    const camera = runtimeBox.camera as {
      zoom?: number; fov?: number; position?: { z: number }; updateProjectionMatrix?: () => void
    } | undefined
    if (!element || !camera?.position || !camera.updateProjectionMatrix || !camera.fov) return
    const available = dicePixelSize(options.diceCount ?? 1, element.clientWidth, element.clientHeight)
    // A confirmation panel may resize the viewport: never grow a settled pool.
    fixedPixelSize = Math.min(fixedPixelSize ?? available, available)
    const pixelsAtZoomOne = worldDiameter * element.clientHeight /
      (2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360))
    if (!(pixelsAtZoomOne > 0)) return
    camera.zoom = fixedPixelSize / pixelsAtZoomOne
    camera.updateProjectionMatrix()
  }
  calibrateCamera()
  const setDimensions = runtimeBox.setDimensions
  if (setDimensions) runtimeBox.setDimensions = function (dimensions) {
    // The vendor renders inside setDimensions. Suppress that intermediate
    // frame until the replacement camera has the same pixel calibration.
    const renderer = runtimeBox.renderer
    const render = renderer?.render
    if (renderer) renderer.render = () => {}
    try {
      // A room log can shrink the canvas during a throw. Preserve the large
      // pool's physics floor instead of rebuilding its walls through the dice.
      const floor = (options.diceCount ?? 1) > 12 ? options.dimensions : undefined
      setDimensions.call(runtimeBox, floor ? {
        x: Math.max(dimensions?.x ?? 0, floor.x),
        y: Math.max(dimensions?.y ?? 0, floor.y),
      } : dimensions)
      calibrateCamera()
    } finally {
      if (renderer && render) renderer.render = render
    }
    renderScene()
  }

  return {
    async stage(this: DiceEngineBox, sides, values, dieSides) {
      if (pending || rerolling) throw new Error('Dice are busy')
      hideAdoptedMarker()
      const existing = runtimeBox.diceList ?? []
      if (existing.length === values.length && existing.every((die, index) =>
        (die.notation?.type ?? die.shape) === `d${dieSides?.[index] ?? sides}`)) {
        this.correctVisibleFaces(values)
        await this.arrangeSettledDice(values)
        this.correctVisibleFaces(values)
        return
      }
      box.clearDice()
      const vectors = runtimeBox.startClickThrow?.(dieSides?.length === values.length ? dieSides.map(die => `1d${die}`).join('+') : `${values.length}d${sides}`)?.vectors ?? []
      for (const vector of vectors) runtimeBox.spawnDice?.(vector)
      for (const die of runtimeBox.diceList ?? []) {
        die.position?.set?.(0, 0, 0)
        die.quaternion?.set?.(0, 0, 0, 1)
        die.body?.position?.set?.(0, 0, 0)
        die.body?.quaternion?.set?.(0, 0, 0, 1)
        die.body?.velocity?.set?.(0, 0, 0)
        die.body?.angularVelocity?.set?.(0, 0, 0)
        die.storeRolledValue?.('staged')
      }
      this.correctVisibleFaces(values)
      await this.arrangeSettledDice(values)
      this.correctVisibleFaces(values)
    },
    grabDie(x, y) {
      if (pending || rerolling || grabbed || !runtimeBox.camera) return null
      const dice = runtimeBox.diceList ?? []
      let hit: { index: number; distance: number; center: ProjectableVector } | null = null
      dice.forEach((die, index) => {
        const center = die.position?.clone?.().project(runtimeBox.camera)
        if (!center || !die.position) return
        const bounds = geometryBounds(die, normalizedQuaternion(die.quaternion ?? { x: 0, y: 0, z: 0, w: 1 }))
        const edge = die.position.clone?.().set(die.position.x + bounds.width / 2, die.position.y + bounds.height / 2, die.position.z).project(runtimeBox.camera)
        if (!edge) return
        const dx = (x - center.x) / Math.max(0.025, Math.abs(edge.x - center.x))
        const dy = (y - center.y) / Math.max(0.025, Math.abs(edge.y - center.y))
        const distance = dx * dx + dy * dy
        if (distance <= 1.4 && (!hit || distance < hit.distance)) hit = { index, distance, center }
      })
      const selected = hit as { index: number; distance: number; center: ProjectableVector } | null
      if (!selected) return null
      const position = dice[selected.index].position!.clone!()
      const bounds = geometryBounds(dice[selected.index], normalizedQuaternion(dice[selected.index].quaternion ?? { x: 0, y: 0, z: 0, w: 1 }))
      const radius = Math.max(bounds.width, bounds.height) / 2
      const lifted = position.clone!().set(position.x, position.y, position.z + Math.max(90, radius * 1.5)).project(runtimeBox.camera)
      released = null
      grabbed = { index: selected.index, position, quaternion: normalizedQuaternion(dice[selected.index].quaternion ?? { x: 0, y: 0, z: 0, w: 1 }), heldSince: performance.now(), depth: lifted.z, offsetX: selected.center.x - x, offsetY: selected.center.y - y, radius, samples: [] }
      return selected.index
    },
    moveGrabbedDie(x, y) {
      if (!grabbed) return
      const position = grabbed.position.clone!().set(Math.max(-0.9, Math.min(0.9, x + grabbed.offsetX)), Math.max(-0.9, Math.min(0.9, y + grabbed.offsetY)), grabbed.depth).unproject(runtimeBox.camera)
      runtimeBox.diceList?.[grabbed.index].position?.set?.(position.x, position.y, position.z)
      const time = performance.now()
      // A lifted die rests at a slight angle in the hand. On release this same
      // pose hits the felt and tumbles, instead of spinning around its center.
      const heldQuaternion = multiplyQuaternion(normalizedQuaternion({ x: 0.2, y: -0.16, z: 0.04, w: 1 }), grabbed.quaternion)
      const quaternion = slerpQuaternion(grabbed.quaternion, heldQuaternion, Math.min(1, (time - grabbed.heldSince) / 90))
      runtimeBox.diceList?.[grabbed.index].quaternion?.set?.(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
      grabbed.samples = [...grabbed.samples.filter((sample) => time - sample.time <= 120), { x: position.x, y: position.y, time }]
      renderScene()
    },
    releaseDie(throwDie = false) {
      if (!grabbed) return
      const { index, position } = grabbed
      if (throwDie) {
        released = { index, motion: diceThrowMotion(grabbed.samples, performance.now(), grabbed.radius) }
      } else {
        runtimeBox.diceList?.[index].position?.set?.(position.x, position.y, position.z)
        const quaternion = grabbed.quaternion
        runtimeBox.diceList?.[index].quaternion?.set?.(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
        released = null
      }
      grabbed = null
      renderScene()
    },
    async reroll(index) {
      if (pending || rerolling || !Number.isInteger(index) || !runtimeBox.diceList?.[index]) throw new Error('Invalid or busy dice reroll')
      rerolling = true
      const die = runtimeBox.diceList[index]
      const position = die.position?.clone?.()
      const quaternion = normalizedQuaternion(die.quaternion ?? { x: 0, y: 0, z: 0, w: 1 })
      const launch = released?.index === index ? released.motion : {
        velocity: { x: 150, y: 80, z: 450 }, angularVelocity: { x: -3, y: 5, z: 1 },
      }
      if (position && released?.index !== index) position.z += 90
      released = null
      try {
        // Native reroll retains the previous animation timestamp. Reset it so
        // an idle tray does not simulate every second since the last throw.
        runtimeBox.last_time = 0
        const result = box.reroll([index])
        // Native reroll starts with a fixed vertical kick. Replace that first
        // step before the browser paints, using the actual release pose/motion.
        if (position) {
          die.body?.position?.set?.(position.x, position.y, position.z)
          die.position?.set?.(position.x, position.y, position.z)
        }
        die.body?.quaternion?.set?.(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
        die.quaternion?.set?.(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
        die.body?.velocity?.set?.(launch.velocity.x, launch.velocity.y, launch.velocity.z)
        die.body?.angularVelocity?.set?.(launch.angularVelocity.x, launch.angularVelocity.y, launch.angularVelocity.z)
        renderScene()
        await result
        return (runtimeBox.diceList ?? []).map((item) => {
          const value = physicalDieValue(item) ?? Number(item.getLastValue?.().value)
          item.setLastValue?.({ value, label: String(value), reason: 'reroll' })
          return value
        })
      } finally {
        rerolling = false
      }
    },
    roll(notation: string): Promise<DiceOutcome> {
      if (pending || rerolling) {
        return Promise.reject(new Error('diceEngine: a roll is already in flight'))
      }
      hideAdoptedMarker()
      const token = ++seq
      return new Promise<DiceOutcome>((resolve, reject) => {
        pending = { token, notation, settle: resolve }
        // box.roll() returns undefined for malformed /
        // empty notation (the engine returns no Promise in that branch); guard it.
        box.clearDice()
        Promise.resolve(box.roll(notation))
          .then((raw) => {
            if (raw == null) {
              if (pending?.token === token) {
                pending = null
                reject(
                  new Error(`diceEngine: roll('${notation}') produced no result (malformed notation?)`),
                )
              }
              return
            }
            deliver(raw)
          })
          .catch((e) => {
            if (pending?.token === token) {
              pending = null
              reject(e instanceof Error ? e : new Error(String(e)))
            }
          })
      })
    },
    correctVisibleFaces(values: number[]): boolean {
      const dice = runtimeBox.diceList
      if (!dice || typeof runtimeBox.swapDiceFace !== 'function') return false
      let changed = false
      for (let index = 0; index < values.length; index += 1) {
        const die = dice[index]
        const target = Math.round(values[index])
        const current = die?.getLastValue?.()
        if (!die || !Number.isFinite(target)) continue
        const physicalValue = physicalDieValue(die)
        const currentValue = physicalValue ?? current?.value
        if (currentValue === target) {
          if (current?.value !== target) {
            die.setLastValue?.({ value: target, label: String(target), reason: 'forced' })
          }
          continue
        }
        if (physicalValue != null && current?.value !== physicalValue) {
          die.setLastValue?.({
            value: physicalValue,
            label: String(physicalValue),
            reason: current?.reason ?? 'natural',
          })
        }
        runtimeBox.swapDiceFace(die, target)
        // Material swaps clear the native result history; seed it before
        // replacing the last entry so subsequent grabs still see every die.
        if (die.getLastValue?.().value == null) die.storeRolledValue?.('forced')
        die.setLastValue?.({ value: target, label: String(target), reason: 'forced' })
        changed = true
      }
      if (changed && runtimeBox.renderer && runtimeBox.scene && runtimeBox.camera) {
        runtimeBox.renderer.render(runtimeBox.scene, runtimeBox.camera)
      }
      return changed
    },
    highlightDie(index) {
      adoptedDieIndex = index
      updateAdoptedMarker()
    },
    visibleValues(): number[] {
      return (runtimeBox.diceList ?? []).map((die) =>
        physicalDieValue(die) ?? Number(die.getLastValue?.().value),
      ).filter((value) => Number.isFinite(value))
    },
    arrangeSettledDice(values: number[] = []): Promise<void> {
      const dice = runtimeBox.diceList?.filter((die) =>
        die.position && die.quaternion && die.geometry,
      ) ?? []
      // A single die still needs the same gather/straighten pass. Skipping it
      // used to leave secret d20s at their random flight endpoint and could
      // open the confirmation drawer while the die was visibly leaning.
      if (dice.length < 1) return Promise.resolve()

      const tableWidth = Math.max(320, runtimeBox.display?.containerWidth ?? 680)
      const tableHeight = Math.max(260, runtimeBox.display?.containerHeight ?? 420)
      const element = typeof container === 'string' ? document.querySelector(container) : container
      const grid = settledDiceGrid(dice.length, element?.clientWidth || tableWidth, element?.clientHeight || tableHeight)
      const targets = dice.map((die, index) => {
        const targetValue = Number.isFinite(values[index]) ? Math.round(values[index]) : undefined
        const quaternion = settledQuaternion(die, targetValue)
        const bounds = geometryBounds(die, quaternion)
        return { die, grid: grid[index], quaternion, bounds }
      })
      const dieWidth = Math.max(...targets.map((target) => target.bounds.width))
      const dieHeight = Math.max(...targets.map((target) => target.bounds.height))
      const columnSpan = Math.max(...grid.map((point) => point.columnOffset)) -
        Math.min(...grid.map((point) => point.columnOffset))
      const rowSpan = Math.max(...grid.map((point) => point.rowOffset)) -
        Math.min(...grid.map((point) => point.rowOffset))
      const naturalSpacingX = dieWidth * 1.24
      const naturalSpacingY = dieHeight * 1.24
      const spacingX = columnSpan > 0
        ? Math.min(
            naturalSpacingX,
            Math.max(dieWidth * 1.05, (tableWidth * 1.65 - dieWidth) / columnSpan),
          )
        : 0
      const spacingY = rowSpan > 0
        ? Math.min(
            naturalSpacingY,
            Math.max(dieHeight * 1.05, (tableHeight * 1.65 - dieHeight) / rowSpan),
          )
        : 0
      const transitions = targets.map((target) => ({
        ...target,
        fromPosition: {
          x: target.die.position?.x ?? 0,
          y: target.die.position?.y ?? 0,
          z: target.die.position?.z ?? target.bounds.restingZ,
        },
        fromQuaternion: normalizedQuaternion({
          x: target.die.quaternion?.x ?? 0,
          y: target.die.quaternion?.y ?? 0,
          z: target.die.quaternion?.z ?? 0,
          w: target.die.quaternion?.w ?? 1,
        }),
        toPosition: {
          x: target.grid.columnOffset * spacingX,
          y: target.grid.rowOffset * spacingY,
          z: target.bounds.restingZ,
        },
      }))

      return new Promise((resolve) => {
        const durationMs = 320
        const startedAt = performance.now()
        const render = (now: number) => {
          const rawRatio = Math.max(0, Math.min(1, (now - startedAt) / durationMs))
          const ratio = 1 - Math.pow(1 - rawRatio, 3)
          for (const transition of transitions) {
            const position = {
              x: transition.fromPosition.x +
                (transition.toPosition.x - transition.fromPosition.x) * ratio,
              y: transition.fromPosition.y +
                (transition.toPosition.y - transition.fromPosition.y) * ratio,
              z: transition.fromPosition.z +
                (transition.toPosition.z - transition.fromPosition.z) * ratio,
            }
            const quaternion = slerpQuaternion(
              transition.fromQuaternion,
              transition.quaternion,
              ratio,
            )
            transition.die.position?.set?.(position.x, position.y, position.z)
            transition.die.quaternion?.set?.(
              quaternion.x,
              quaternion.y,
              quaternion.z,
              quaternion.w,
            )
            transition.die.body?.position?.set?.(position.x, position.y, position.z)
            transition.die.body?.quaternion?.set?.(
              quaternion.x,
              quaternion.y,
              quaternion.z,
              quaternion.w,
            )
            transition.die.body?.velocity?.set?.(0, 0, 0)
            transition.die.body?.angularVelocity?.set?.(0, 0, 0)
          }
          if (runtimeBox.renderer && runtimeBox.scene && runtimeBox.camera) {
            runtimeBox.renderer.render(runtimeBox.scene, runtimeBox.camera)
          }
          if (rawRatio < 1) {
            requestAnimationFrame(render)
            return
          }
          for (const transition of transitions) {
            const { die, toPosition, quaternion } = transition
            die.body?.position?.set?.(toPosition.x, toPosition.y, toPosition.z)
            die.body?.quaternion?.set?.(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
            die.body?.velocity?.set?.(0, 0, 0)
            die.body?.angularVelocity?.set?.(0, 0, 0)
          }
          resolve()
        }
        requestAnimationFrame(render)
      })
    },
    clear() {
      hideAdoptedMarker()
      box.clearDice()
    },
    destroy() {
      adoptedMarker.remove()
      adoptedStyle.remove()
      pending = null
      box.clearDice()
    },
  }
}
