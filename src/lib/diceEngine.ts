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
import { settledDiceGrid } from './diceFrameLayout'

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
  scale?: number
  dimensions?: { x: number; y: number }
  theme?: DiceColorset
  onComplete?: (outcome: DiceOutcome) => void
}

export interface DiceEngineBox {
  // Resolves with the same DiceOutcome that onComplete receives — exactly once.
  roll(notation: string): Promise<DiceOutcome>
  correctVisibleFaces(values: number[]): boolean
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
}

interface RuntimeQuaternion {
  x: number
  y: number
  z: number
  w: number
  set?: (x: number, y: number, z: number, w: number) => void
}

interface RuntimeGeometry {
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
  shape?: string
  geometry?: RuntimeGeometry
  position?: RuntimeVector
  quaternion?: RuntimeQuaternion
  body?: RuntimeBody
  getLastValue?: () => { value?: number; label?: string; reason?: string }
  setLastValue?: (value: { value: number; label: string; reason: string }) => void
}

interface RuntimeDiceBox {
  diceList?: RuntimeDie[]
  swapDiceFace?: (die: RuntimeDie, value: number) => void
  renderer?: { render: (scene: unknown, camera: unknown) => void }
  scene?: unknown
  camera?: unknown
  display?: { containerWidth?: number; containerHeight?: number }
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

function uprightTopFaceQuaternion(die: RuntimeDie): QuaternionValue {
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
  for (let index = 0; index < groups.length; index += 1) {
    if (groups[index].materialIndex === 0) continue
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
  return uprightTopFaceQuaternion(die)
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

  return {
    roll(notation: string): Promise<DiceOutcome> {
      if (pending) {
        return Promise.reject(new Error('diceEngine: a roll is already in flight'))
      }
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
        const physicalValue = d4SettledFaceValue(die)
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
        die.setLastValue?.({ value: target, label: String(target), reason: 'forced' })
        changed = true
      }
      if (changed && runtimeBox.renderer && runtimeBox.scene && runtimeBox.camera) {
        runtimeBox.renderer.render(runtimeBox.scene, runtimeBox.camera)
      }
      return changed
    },
    visibleValues(): number[] {
      return (runtimeBox.diceList ?? []).map((die) =>
        d4SettledFaceValue(die) ?? Number(die.getLastValue?.().value),
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
      const grid = settledDiceGrid(dice.length, tableWidth, tableHeight)
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
      box.clearDice()
    },
    destroy() {
      pending = null
      box.clearDice()
    },
  }
}
