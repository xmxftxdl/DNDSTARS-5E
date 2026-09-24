// ============================================================================
// diceNotation — pure, engine-free notation helpers for @3d-dice/dice-box-threejs
// (T-P2-397). Extracted from the iframe so the forcing logic is unit-testable
// WITHOUT importing the heavy DiceBox engine (kept in diceEngine.ts).
//
// The threejs engine forces a result with the `@` predetermined-roll mechanic:
// `<dice>@v1,v2,...` — ONE `@` separating the dice expression from a comma list
// of per-die target faces. After the dice settle physically the engine relabels
// the up-faces to the targets (real face == reported value), so there is no
// forcedValue-style number/visual split (the bug this migration removes).
//
// d100 caveat (source-verified in the T-P2-395 spike): a LONE d100 is a
// tens-digit die (faces 10..100), so `1d100@57` is NOT representable — the
// engine keeps the natural tens face. An arbitrary percentile must be forced as
// a d100+d10 PAIR: `1d100+1d10@50,7` → 57 (spike AC4c). See percentileNotation.
// ============================================================================

import { MAX_DICE_POOL_COUNT } from './dicePoolLimits'
/** Inclusive die-count clamp shared with the iframe and overlay. */
export const MAX_QTY = MAX_DICE_POOL_COUNT
/** Inclusive sides clamp (matches DiceBoxRollOverlay's `Math.min(100, …)`). */
export const MAX_SIDES = 100

/**
 * Round + clamp a forced face value into [1, sides]. Returns `null` for a
 * non-finite input so callers can drop it (the iframe fills the gap with a
 * random fallback face — randomness stays OUT of this pure module).
 */
export function clampDie(value: unknown, sides: number): number | null {
  // Gap markers (no forced value for this die) must DROP, not coerce. Guard them
  // before Number(): `Number(null)` and `Number('')` are 0, a JS footgun that
  // would otherwise force a real face onto an empty slot.
  if (value == null || value === '') return null
  const rounded = Math.round(Number(value))
  if (!Number.isFinite(rounded)) return null
  return Math.max(1, Math.min(sides, rounded))
}

function clampQty(qty: unknown): number {
  return Math.max(1, Math.min(MAX_QTY, Math.round(Number(qty) || 1)))
}

function clampSides(sides: unknown): number {
  return Math.max(2, Math.min(MAX_SIDES, Math.round(Number(sides) || 6)))
}

/**
 * Sanitize a caller-supplied forced-values list: clamp each to [1, sides], drop
 * non-finite entries, and truncate to at most `qty` (length > qty → trimmed;
 * length < qty → fewer dice forced — see buildNotation).
 */
export function sanitizeForced(values: unknown, qty: number, sides: number): number[] {
  if (!Array.isArray(values)) return []
  return values
    .map((v) => clampDie(v, sides))
    .filter((v): v is number => v != null)
    .slice(0, qty)
}

/** Engine face values: 100 displays 00; 10 on the units die displays 0. */
export function percentileFaces(value: number): number[] {
  const v = clampDie(value, 100) ?? 1
  return [Math.floor((v % 100) / 10) * 10 || 100, v % 10 || 10]
}

export function percentileResults(faces: readonly number[]): number[] {
  const results: number[] = []
  for (let index = 0; index + 1 < faces.length; index += 2) {
    results.push(((faces[index] % 100) + (faces[index + 1] % 10)) || 100)
  }
  return results
}

export function percentileNotation(value: number): string {
  return `1d100+1d10@${percentileFaces(value).join(',')}`
}

/**
 * Build a dice-box-threejs notation string for both code paths:
 *   - no usable forced values → `"{qty}d{sides}"` (a true random NdS roll)
 *   - forced values           → `"{n}d{sides}@v1,v2,…"` where n = forced count
 *     (forcing only the values provided, matching the legacy force-only-provided
 *     behavior; a partial list rolls fewer dice rather than padding).
 * Each d100 uses a tens/units pair, including random rolls and multi-die pools.
 */
export function buildNotation(qty: unknown, sides: unknown, values?: unknown): string {
  const q = clampQty(qty)
  const s = clampSides(sides)
  const forced = sanitizeForced(values, q, s)
  if (s === 100) {
    const pool = Array.from({ length: forced.length || q }, () => '1d100+1d10').join('+')
    return pool + (forced.length ? `@${forced.flatMap(percentileFaces).join(',')}` : '')
  }
  if (forced.length === 0) return `${q}d${s}`
  return `${forced.length}d${s}@${forced.join(',')}`
}
