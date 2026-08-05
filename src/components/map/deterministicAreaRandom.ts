export function areaSeed(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

export function nextAreaRandom(seed: number): readonly [number, number] {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return [next, next / 4294967296] as const
}
