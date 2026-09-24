import type { DiceCheckPresentation } from './diceCheckPresentation'

export type DmDiceMode = DiceCheckPresentation['mode']
export const dmDiceModes = [
  { value: 'advantage', label: '优势' },
  { value: 'normal', label: '正常' },
  { value: 'disadvantage', label: '劣势' },
] as const

export function dmAdoptedDie(values: readonly number[], mode: DmDiceMode): number {
  return mode === 'normal' ? values[0]! : mode === 'advantage' ? Math.max(...values) : Math.min(...values)
}

/** The suspended caller already prepared its roll mode. Submit the DM's adopted
 * face through the existing face-override contract, for each original slot, so
 * that caller cannot select a different face again. Keep actual rolled faces
 * separately in the presentation and DM adjudication log. */
export function dmConfirmedFaces(values: number[], mode: DmDiceMode, originalMode: DmDiceMode, originalCount: number): number[] {
  if (mode === originalMode) return values.slice(0, originalCount)
  return Array.from({ length: originalCount }, () => dmAdoptedDie(values, mode))
}

export function createDmDiceModeSelection(initial: readonly number[], initialMode: DmDiceMode, supplement: (retained: number[], mode: DmDiceMode) => Promise<number>) {
  const pool = [...initial]
  let mode = initialMode
  return {
    async change(next: DmDiceMode, draft: readonly number[]) {
      draft.forEach((face, index) => { pool[index] = face })
      if (next !== 'normal' && pool.length < 2) pool.push(await supplement([...pool], next))
      mode = next
      return { mode, values: mode === 'normal' ? pool.slice(0, 1) : [...pool] }
    },
  }
}
