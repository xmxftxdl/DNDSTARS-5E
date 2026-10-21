const kinds = new Set(['attack', 'ability-check', 'saving-throw', 'concentration-save'])
const sides = new Set([4, 6, 8, 10, 12, 20])

export function normalizeDnd5eRollDiceModifiers(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 16) return undefined
  const result = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
      Object.keys(entry).some(key => !['count', 'sides', 'direction', 'appliesTo'].includes(key)) ||
      !Number.isInteger(entry.count) || entry.count < 1 || entry.count > 10 || !sides.has(entry.sides) ||
      !['add', 'subtract'].includes(entry.direction) || !Array.isArray(entry.appliesTo) ||
      entry.appliesTo.length === 0 || entry.appliesTo.length > 4 ||
      entry.appliesTo.some(kind => typeof kind !== 'string' || !kinds.has(kind)) ||
      new Set(entry.appliesTo).size !== entry.appliesTo.length) return undefined
    result.push({count: entry.count, sides: entry.sides, direction: entry.direction, appliesTo: [...entry.appliesTo]})
  }
  return result
}
