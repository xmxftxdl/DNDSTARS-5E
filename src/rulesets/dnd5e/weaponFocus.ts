/** Class-scoped focus grants are bound to a concrete Host inventory instance. */
export function validWeaponFocusClassIds(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 32 &&
    value.every(id => typeof id === 'string' && /^[a-z0-9][a-z0-9._:-]{0,99}$/.test(id)) &&
    new Set(value).size === value.length
}
