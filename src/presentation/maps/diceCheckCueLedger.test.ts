import { expect, it } from 'vitest'
import { createDiceCheckCueLedger } from './diceCheckCueLedger'
const preview = { id: 'preview-1', rollId: 'roll-1', values: [15, 3], mode: 'disadvantage' as const, kind: 'attack' as const, actorName: '法师', targetName: '目标', success: false, provisional: true }
function memoryStorage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}
it('does not replay a pending preview after refresh even if its delivery ID changes', () => {
  const storage = memoryStorage()
  expect(createDiceCheckCueLedger(storage)(preview)).toBe(true)
  expect(createDiceCheckCueLedger(storage)({ ...preview, id: 'new-delivery' })).toBe(false)
})
it('persists suppressed final outcomes and permits corrected or new rolls', () => {
  const storage = memoryStorage()
  createDiceCheckCueLedger(storage)(preview)
  const restored = createDiceCheckCueLedger(storage)
  const final = { id: 'final-1', rollId: preview.rollId, values: preview.values, mode: preview.mode, kind: preview.kind, actorName: preview.actorName, targetName: preview.targetName, success: false }
  expect(restored(final)).toBe(false)
  expect(createDiceCheckCueLedger(storage)(final)).toBe(false)
  expect(restored({ ...preview, id: 'correction', values: [19, 18], success: true })).toBe(true)
  expect(restored({ ...preview, id: 'next-roll', rollId: 'roll-2' })).toBe(true)
})
it('deduplicates in memory when storage is unavailable', () => {
  const accept = createDiceCheckCueLedger({ getItem() { throw Error() }, setItem() { throw Error() } })
  expect(accept(preview)).toBe(true)
  expect(accept(preview)).toBe(false)
})
