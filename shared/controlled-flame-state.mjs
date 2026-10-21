const object = value => value != null && typeof value === 'object' && !Array.isArray(value)
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 200
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

/** Shared browser/server validation. Reject corrupt records instead of silently losing effect ownership. */
export function normalizeControlledFlameState(value) {
  if (!object(value) || !id(value.id) || typeof value.magical !== 'boolean' || typeof value.burning !== 'boolean' ||
    !finite(value.extentFeet, 0.001, 10000) || !finite(value.brightRadiusFeet, 0, 10000) ||
    !finite(value.dimRadiusFeet, 0, 10000) || !color(value.color) || !Array.isArray(value.alterations) || value.alterations.length > 256 ||
    (value.fuelAvailable != null && typeof value.fuelAvailable !== 'boolean') ||
    (value.custody != null && !['unattended', 'carried', 'worn'].includes(value.custody))) return undefined
  const position = value.positionFeet
  if (position != null && (!object(position) || !['x', 'y', 'z'].every(key => finite(position[key], -1000000, 1000000)))) return undefined
  const alterations = [], seen = new Set()
  for (const effect of value.alterations) {
    if (!object(effect) || !id(effect.id) || seen.has(effect.id) || !id(effect.casterId) ||
      !finite(effect.appliedAtWorldMinute, 0, Number.MAX_SAFE_INTEGER - 60) || effect.expiresAtWorldMinute !== effect.appliedAtWorldMinute + 60) return undefined
    seen.add(effect.id)
    const common = { id: effect.id, casterId: effect.casterId, appliedAtWorldMinute: effect.appliedAtWorldMinute, expiresAtWorldMinute: effect.expiresAtWorldMinute }
    if (effect.kind === 'illumination') {
      if (![0.5, 1, 2].includes(effect.multiplier) || (effect.color != null && !color(effect.color))) return undefined
      alterations.push({ ...common, kind: 'illumination', multiplier: effect.multiplier, ...(effect.color != null ? { color: effect.color } : {}) })
    } else if (effect.kind === 'shape') {
      if (typeof effect.shape !== 'string' || !effect.shape.trim() || effect.shape.length > 500) return undefined
      alterations.push({ ...common, kind: 'shape', shape: effect.shape })
    } else return undefined
  }
  return { id: value.id, magical: value.magical, burning: value.burning, extentFeet: value.extentFeet,
    brightRadiusFeet: value.brightRadiusFeet, dimRadiusFeet: value.dimRadiusFeet, color: value.color, alterations,
    ...(position ? { positionFeet: { x: position.x, y: position.y, z: position.z } } : {}),
    ...(value.fuelAvailable != null ? { fuelAvailable: value.fuelAvailable } : {}),
    ...(value.custody != null ? { custody: value.custody } : {}) }
}

/** Project from the original flame every time; never compound previously projected radii. */
export function controlledFlameAppearance(flame, worldMinute) {
  const active = flame.burning ? flame.alterations.filter(effect => effect.expiresAtWorldMinute > worldMinute) : []
  const latest = kind => active.filter(effect => effect.kind === kind)
    .sort((a, b) => a.appliedAtWorldMinute - b.appliedAtWorldMinute).at(-1)
  const illumination = latest('illumination'), shape = latest('shape')
  return { enabled: flame.burning,
    brightRadiusFeet: flame.burning ? flame.brightRadiusFeet * (illumination?.multiplier ?? 1) : 0,
    dimRadiusFeet: flame.burning ? flame.dimRadiusFeet * (illumination?.multiplier ?? 1) : 0,
    color: illumination?.color ?? flame.color, shape: shape?.shape }
}

export function projectControlledFlameLight(light, worldMinute) {
  if (!light?.controlledFlame || !Number.isFinite(worldMinute)) return light
  const flame = normalizeControlledFlameState(light.controlledFlame)
  if (!flame || flame.id !== light.id) return light
  const { shape: _shape, ...appearance } = controlledFlameAppearance(flame, worldMinute)
  return { ...light, ...appearance, enabled: light.enabled && appearance.enabled }
}
