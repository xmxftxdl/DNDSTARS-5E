/** Local Host cache for replaying an unfinished action after a refresh. */
export interface DicePoolCheckpoint { sides: number; values: number[]; confirmed: boolean }
const key = 'astraltrace:host-dice-pools:v1'
const memory = new Map<string, DicePoolCheckpoint>()
const limit = 500
function validRecord(value: unknown): value is DicePoolCheckpoint {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<DicePoolCheckpoint>
  return Number.isInteger(record.sides) && record.sides! >= 2 && record.sides! <= 100 &&
    typeof record.confirmed === 'boolean' && Array.isArray(record.values) &&
    record.values.length > 0 && record.values.every(n => Number.isInteger(n) && n >= 1 && n <= record.sides!)
}
function storedRecords(): Record<string, DicePoolCheckpoint> {
  const raw: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? '{}')
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => validRecord(value)))
}
export function readDicePoolCheckpoint(id: string, count: number, sides: number): DicePoolCheckpoint | undefined {
  let value = memory.get(id)
  try { value = storedRecords()[id] ?? value } catch { /* Memory fallback. */ }
  if (!validRecord(value) || value.sides !== sides || value.values.length !== count) return
  return { ...value, values: [...value.values] }
}
export function writeDicePoolCheckpoint(id: string, sides: number, values: number[], confirmed = false): void {
  const record = { sides, values: [...values], confirmed }
  if (!validRecord(record)) throw new Error('Invalid dice checkpoint')
  const previous = readDicePoolCheckpoint(id, values.length, sides)
  if (previous?.confirmed && !confirmed) return
  // Refresh insertion order when a pending transaction is updated.
  memory.delete(id)
  memory.set(id, record)
  if (memory.size > limit) memory.delete(memory.keys().next().value!)
  try {
    const records = storedRecords()
    delete records[id]
    records[id] = record
    window.sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(Object.entries(records).slice(-limit))))
  } catch { /* Memory fallback. */ }
}