/** Source provenance is explicit; unknown custom light is not assumed to be fire. */
export function isFlameLight(light) {
  return light?.flame === true || (light?.flame !== false && ['torch', 'candle', 'lamp', 'hooded-lantern'].includes(light?.sourceKind))
}

/** Explicit protection supports enclosed custom fires; old lamp presets keep their default. */
export function isFlameProtected(light) {
  return light?.flameProtected ?? ['lamp', 'hooded-lantern'].includes(light?.sourceKind)
}

/** A source inside any ward cannot illuminate or be observed from outside that ward. */
export function flameLightConcealed({ areas, light, source, observer, contains }) {
  if (!isFlameLight(light)) return false
  return (areas ?? []).some(area => area.concealsFlameLightFromOutside === true &&
    contains(area, source) && !contains(area, observer))
}

/** Physical flame size is independent of illumination radius. Unknown custom fire is not assumed small. */
export function isTorchSizedFlame(light) {
  if (!isFlameLight(light)) return false
  if (light.flameSize != null) return light.flameSize === 'torch-or-smaller'
  return ['torch', 'candle', 'lamp', 'hooded-lantern'].includes(light.sourceKind)
}
