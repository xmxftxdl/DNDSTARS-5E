/** Explicitly shared display text survives prose reduction; prompts and source metadata do not. */
export const ROOM_SPELL_TEXT_KEYS = new Set(['description', 'summary', 'rulesText', 'higherLevels', 'materialText', 'reactionTrigger'])
export const ROOM_SPELL_TEXT_MAX_LENGTH = 20_000

export function roomSpellTextObjects(bundle) {
  const objects = new WeakSet()
  if (bundle?.manifest?.roomContentText === 'include') {
    const collect = (value, depth = 0) => {
      if (!value || typeof value !== 'object' || depth > 64) return
      objects.add(value)
      for (const [key, entry] of Object.entries(value)) {
        if (key !== 'source' && key !== 'provenance') collect(entry, depth + 1)
      }
    }
    if (bundle.format === 'dndstars5e-content') collect(bundle.content)
    else if (bundle.format === 'dndstars5e-unified-content') collect(bundle.definitions)
    return objects
  }
  if (bundle?.manifest?.roomSpellText !== 'include') return objects
  const addSpell = spell => {
    if (!spell || typeof spell !== 'object') return
    objects.add(spell)
    if (spell.components && typeof spell.components === 'object') objects.add(spell.components)
  }
  if (bundle.format === 'dndstars5e-content') {
    for (const spell of bundle.content?.spells ?? []) {
      addSpell(spell)
    }
  } else if (bundle.format === 'dndstars5e-unified-content') {
    for (const definition of bundle.definitions ?? []) {
      if (definition?.kind !== 'spell') continue
      addSpell(definition)
      addSpell(definition.payload)
    }
  }
  return objects
}
