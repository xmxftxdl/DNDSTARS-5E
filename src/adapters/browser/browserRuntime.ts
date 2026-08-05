import type { RuntimePort } from '../../ports/runtime'

function randomUnit(): number {
  const crypto = globalThis.crypto
  if (!crypto?.getRandomValues) return Math.random()
  const value = new Uint32Array(1)
  crypto.getRandomValues(value)
  return value[0] / 0x1_0000_0000
}

export const browserRuntime: RuntimePort = {
  now: () => Date.now(),
  integer: (minInclusive, maxInclusive) => {
    const min = Math.ceil(Math.min(minInclusive, maxInclusive))
    const max = Math.floor(Math.max(minInclusive, maxInclusive))
    return min + Math.floor(randomUnit() * (max - min + 1))
  },
  suffix: () => randomUnit().toString(36).slice(2),
  create(prefix) {
    const value = `${this.now()}-${this.suffix()}`
    return prefix ? `${prefix}-${value}` : value
  },
  createNumeric() {
    return this.now() + randomUnit()
  },
}
