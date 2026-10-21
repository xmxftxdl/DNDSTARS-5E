/** All clauses must match; each clause accepts one of its declared alternatives. */
export interface Dnd5eFeatureChoiceRequirement {
  classId: string
  groupId: string
  anyOf: readonly string[]
}

export function cloneDnd5eFeatureChoiceRequirements(value: unknown, label: string): readonly Dnd5eFeatureChoiceRequirement[] | undefined {
  if (value == null) return undefined
  const id = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9._:/-]{0,159}$/.test(value)
  if (!Array.isArray(value) || value.length < 1 || value.length > 20 || value.some(entry =>
    !entry || !id(entry.classId) || !id(entry.groupId) || !Array.isArray(entry.anyOf) ||
    entry.anyOf.length < 1 || entry.anyOf.length > 32 || entry.anyOf.some((option: unknown) => !id(option)) ||
    new Set(entry.anyOf).size !== entry.anyOf.length)) throw Error(`${label}: invalid class choice requirements`)
  return value.map(entry => ({ classId: entry.classId, groupId: entry.groupId, anyOf: [...entry.anyOf] }))
}
