/** Rebase only the confirmed resolution delta; concurrent edits are never overwritten. */
export function mergeConfirmedEffectEndSave<T>(before: T, resolved: T, current: T): T {
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
  const merge = (base: unknown, next: unknown, live: unknown, path: string): unknown => {
    if (equal(base, next)) return live
    if (equal(live, base) || equal(live, next)) return next
    if (object(base) && object(next) && object(live)) {
      const result: Record<string, unknown> = {...live}
      for (const key of new Set([...Object.keys(base), ...Object.keys(next)])) {
        const value = merge(base[key], next[key], live[key], `${path}.${key}`)
        if (value === undefined) delete result[key]; else result[key] = value
      }
      return result
    }
    // Collections of actors/tokens/effects are merged by stable identity, never by index.
    const identified = (value: unknown): value is Array<Record<string, unknown> & {id:string}> =>
      Array.isArray(value) && value.every(row => object(row) && typeof row.id === 'string') &&
      new Set(value.map(row => row.id)).size === value.length
    if (identified(base) && identified(next) && identified(live)) {
      const old = new Map(base.map(row => [row.id,row])), desired = new Map(next.map(row => [row.id,row]))
      const result = live.flatMap(row => {
        if (!old.has(row.id) && !desired.has(row.id)) return [row]
        const value = merge(old.get(row.id), desired.get(row.id), row, `${path}[${row.id}]`)
        return value === undefined ? [] : [value]
      })
      for (const row of next) if (!live.some(value => value.id === row.id)) {
        const value = merge(old.get(row.id),row,undefined,`${path}[${row.id}]`)
        if (value !== undefined) result.push(value)
      }
      return result
    }
    throw Error(`confirmed-effect-end-save-conflict:${path}`)
  }
  return merge(before,resolved,current,'state') as T
}
