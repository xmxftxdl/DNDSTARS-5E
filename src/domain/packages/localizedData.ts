/** Resolve build-time text references without interpreting or executing rules. */
export function hydrateLocalizedData(value: unknown, dictionary: Readonly<Record<string, string>>): unknown {
  if (Array.isArray(value)) return value.map(v => hydrateLocalizedData(v,dictionary))
  if (value && typeof value === 'object') {
    const object = value as Record<string,unknown>
    if (Object.keys(object).length === 1 && object.$undefined === true) return undefined
    if (Object.keys(object).length === 1 && typeof object.$text === 'string') {
      if (!Object.hasOwn(dictionary,object.$text)) throw new Error(`localization-key-missing: ${object.$text}`)
      return dictionary[object.$text]
    }
    return Object.fromEntries(Object.entries(object).map(([key,v]) => [key,hydrateLocalizedData(v,dictionary)]))
  }
  return value
}
