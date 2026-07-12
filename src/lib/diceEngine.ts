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
export const DICE_D4_BASE_SCALE = 78
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
  clear(): void
  destroy(): void
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

  type RuntimeDie = {
    getLastValue?: () => { value?: number; label?: string; reason?: string }
    setLastValue?: (value: { value: number; label: string; reason: string }) => void
  }
  type RuntimeDiceBox = {
    diceList?: RuntimeDie[]
    swapDiceFace?: (die: RuntimeDie, value: number) => void
    renderer?: { render: (scene: unknown, camera: unknown) => void }
    scene?: unknown
    camera?: unknown
  }
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
        if (!die || !Number.isFinite(target) || current?.value === target) continue
        runtimeBox.swapDiceFace(die, target)
        die.setLastValue?.({ value: target, label: String(target), reason: 'forced' })
        changed = true
      }
      if (changed && runtimeBox.renderer && runtimeBox.scene && runtimeBox.camera) {
        runtimeBox.renderer.render(runtimeBox.scene, runtimeBox.camera)
      }
      return changed
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
