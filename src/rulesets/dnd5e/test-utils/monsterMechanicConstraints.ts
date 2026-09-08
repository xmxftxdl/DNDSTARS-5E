type Constraints = typeof import('../monsterMultiattackConstraints')

/** Keep catalog keyed constraints when testing a cloned, isolated sub-rule. */
export function monsterMechanicConstraints(original: Constraints): Constraints {
  const sourceId = (id: string) => id.startsWith('test:mechanic:')
    ? id.replace('test:mechanic:', 'srd-5.1:') : id
  return {
    ...original,
    dnd5eMonsterMultiattackConstraint: (id, action) =>
      original.dnd5eMonsterMultiattackConstraint(sourceId(id), action),
    dnd5eMonsterMultiattackOccurrenceConstraint: (id, action, occurrence) =>
      original.dnd5eMonsterMultiattackOccurrenceConstraint(sourceId(id), action, occurrence),
    dnd5eMonsterMultiattackSupportsSingleTarget: (id, action) =>
      original.dnd5eMonsterMultiattackSupportsSingleTarget(sourceId(id), action),
  }
}
