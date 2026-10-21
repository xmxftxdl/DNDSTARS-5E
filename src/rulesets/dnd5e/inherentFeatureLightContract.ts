export interface Dnd5eInherentFeatureLight {
  brightRadiusFeet: number
  /** Additional dim light outside the bright radius. */
  dimRadiusFeet: number
  color: string
  disabledByEffectTag?: string
}

export function validDnd5eInherentFeatureLight(value: unknown): value is Dnd5eInherentFeatureLight {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const light = value as Dnd5eInherentFeatureLight
  return Object.keys(value).every(key => ['brightRadiusFeet', 'dimRadiusFeet', 'color', 'disabledByEffectTag'].includes(key)) &&
    [light.brightRadiusFeet, light.dimRadiusFeet].every(n => Number.isInteger(n) && n >= 0 && n <= 10_000) &&
    light.brightRadiusFeet + light.dimRadiusFeet > 0 && /^#[0-9a-f]{6}$/i.test(light.color) &&
    (light.disabledByEffectTag == null || /^[a-z0-9][a-z0-9._:-]{0,159}$/.test(light.disabledByEffectTag))
}

