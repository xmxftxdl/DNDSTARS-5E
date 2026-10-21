// Host replay freezes command data, but process-local capabilities cannot be
// serialized. Only receipts and symbol slots registered by their issuers survive.
const receipts = new WeakSet<object>()
const slots = new Set<symbol>()
export function registerDnd5eHostReceipt<T extends object>(receipt: T): T {
  receipts.add(receipt)
  return receipt
}
export function registerDnd5eHostReceiptSlot(slot: symbol): void { slots.add(slot) }

export function cloneDnd5eHostTransactionInput<T>(input: T): T {
  const cloned = structuredClone(input)
  const visited = new WeakMap<object, object>()
  const restore = (source: unknown, target: unknown): unknown => {
    if (!source || typeof source !== 'object') return target
    if (receipts.has(source)) return source
    if (!target || typeof target !== 'object') return target
    const prior = visited.get(source)
    if (prior) return prior
    visited.set(source, target)
    if (source instanceof Map && target instanceof Map) {
      const originals = [...source], copies = [...target]
      target.clear()
      originals.forEach(([key, value], index) => target.set(restore(key, copies[index][0]), restore(value, copies[index][1])))
    } else if (source instanceof Set && target instanceof Set) {
      const originals = [...source], copies = [...target]
      target.clear()
      originals.forEach((value, index) => target.add(restore(value, copies[index])))
    } else {
      for (const key of Object.keys(source)) {
        const data = source as Record<string, unknown>, copy = target as Record<string, unknown>
        copy[key] = restore(data[key], copy[key])
      }
      for (const slot of slots) {
        const descriptor = Object.getOwnPropertyDescriptor(source, slot)
        if (descriptor && 'value' in descriptor && receipts.has(descriptor.value)) {
          Object.defineProperty(target, slot, { ...descriptor, value: descriptor.value })
        }
      }
    }
    return target
  }
  return restore(input, cloned) as T
}
