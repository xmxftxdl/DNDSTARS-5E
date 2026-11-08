import type { Character } from '../../types/character'
import type { Dnd5eClassId } from './classes'
import { applyDnd5eContentBuildChoicesV1 } from './buildChoices'
import { dnd5ePluginSubclassDefinition, registeredDnd5ePluginSubclasses } from './plugins/pluginContentCatalog'

/** The initial class selection needs the same fixed source grants as a later
 * subclass acquisition. Choice groups remain explicit player choices. */
export function applyDnd5eInitialSubclassBuildGrantsV1(character: Character):
  { ok: true; character: Character } | { ok: false; reason: string } {
  const levels = Object.entries(character.dnd5eClassLevels ?? {}).filter(([, level]) => typeof level === 'number' && level > 0)
  if (character.level !== 1 || levels.length !== 1 || levels[0][1] !== 1) return { ok: true, character }
  const classId = levels[0][0] as Dnd5eClassId
  const selected = character.dnd5eClassChoices?.classes?.[classId]?.subclass
  const subclass = selected ? dnd5ePluginSubclassDefinition(selected) : undefined
  const source = subclass?.classId === classId ? subclass : undefined
  const choices = { ...character.dnd5eContentChoices }
  let working = character
  // Editing the initial class must not keep training from its previous
  // registered subclass. Other sources, including feats, remain untouched.
  for (const previous of registeredDnd5ePluginSubclasses()) {
    if (previous.id === source?.id) continue
    const id = `${previous.id}:level-1`
    if (choices[id]) { delete choices[id]; working = { ...working, dnd5eContentChoices: choices } }
  }
  if (!source) return { ok: true, character: working }
  const contentId = `${source.id}:level-1`
  const automatic = source.advancements?.filter(entry => entry.level === 1 && entry.kind === 'build-grant') ?? []
  if (!automatic.length || working.dnd5eContentChoices?.[contentId]) return { ok: true, character: working }
  const built = applyDnd5eContentBuildChoicesV1({ character: working, contentId, advancements: automatic })
  return built.ok ? { ok: true, character: built.character } : built
}
