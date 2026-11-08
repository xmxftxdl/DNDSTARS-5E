/** Campaign variant: no distance, propagation, or special-sense bypass. */
export function falseHydraSongIsActive(state) {
  return state?.schemaVersion === 1 && Array.isArray(state.heads) &&
    state.heads.some(head => head.alive === true && Number.isFinite(head.singingThroughTurn) &&
      head.singingThroughTurn >= state.turn)
}

export function falseHydraViewerIsDeafened(...sources) {
  return sources.some(source => {
    if (!source) return false
    if (source.conditions?.some(condition => ['deafened', '耳聋'].includes(String(condition).trim().toLowerCase()))) return true
    return source.activeEffects?.some(effect => !effect.suspendedBy?.length &&
      [effect.standardCondition, effect.legacyCondition].some(condition => condition === 'deafened')) === true
  })
}

/** Apply before location knowledge, truesight, tremorsense, or party sharing. */
export function falseHydraSongConceals(state, ...viewerSources) {
  return falseHydraSongIsActive(state) && !falseHydraViewerIsDeafened(...viewerSources)
}
