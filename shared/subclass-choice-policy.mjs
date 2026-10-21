/** Extract only policies from the Host-installed declarative package. */
export function subclassChoicePoliciesFromPackage(packageValue) {
  const packageId = packageValue?.manifest?.id
  if (typeof packageId !== 'string') return []
  const subclasses = packageValue?.format === 'dndstars5e-unified-content'
    ? (packageValue.definitions ?? []).filter(definition => definition?.kind === 'subclass').map(definition => definition.payload)
    : packageValue?.content?.subclasses ?? packageValue?.subclasses
  if (!Array.isArray(subclasses)) return []
  return subclasses.flatMap(subclass => {
    if (typeof subclass?.id !== 'string' || typeof subclass.classId !== 'string') return []
    const subclassId = subclass.id.startsWith(`${packageId}:`) ? subclass.id : `${packageId}:${subclass.id}`
    return (Array.isArray(subclass.choiceGroups) ? subclass.choiceGroups : []).flatMap(group =>
      typeof group?.replaceOnClassLevelGain === 'boolean' && typeof group.id === 'string'
        ? [{ classId: subclass.classId, subclassId, key: `${subclassId}/${group.id}`,
            maxSelections: group.maxSelections ?? 1, replaceOnClassLevelGain: group.replaceOnClassLevelGain,
            options: (group.options ?? []).map(option => option.id) }]
        : [])
  })
}

/** Preserve an established selection unless this exact class gains a level. */
export function preserveSubclassLevelChoices(target, source, policies, advancedClassId) {
  for (const policy of policies ?? []) {
    const previous = source?.dnd5eClassChoices?.classes?.[policy.classId]
    const selected = previous?.selections?.[policy.key]
    if (previous?.subclass !== policy.subclassId || !Array.isArray(selected) || !selected.length) continue
    const proposed = target?.dnd5eClassChoices?.classes?.[policy.classId]
    const values = proposed?.selections?.[policy.key]
    const legalReplacement = policy.replaceOnClassLevelGain !== false && advancedClassId === policy.classId && proposed?.subclass === policy.subclassId &&
      Array.isArray(values) && values.length === selected.length && values.length <= policy.maxSelections &&
      new Set(values).size === values.length && values.every(value => policy.options.includes(value))
    if (legalReplacement) continue
    target.dnd5eClassChoices = structuredClone(target.dnd5eClassChoices ?? {})
    target.dnd5eClassChoices.classes ??= {}
    const current = target.dnd5eClassChoices.classes[policy.classId] ??= {}
    current.subclass = previous.subclass
    current.selections ??= {}
    current.selections[policy.key] = [...selected]
  }
  return target
}
