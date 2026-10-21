import type { Dnd5eMapResultPlan } from './mapBridge'
import type { Dnd5eReactionMaterialChange } from './damageReactionMaterialLedger'

/** Merge trusted replay output before the existing atomic map/character publish.
 * Reject competing inventory/equipment changes rather than overwrite them.
 * No stores or network are touched; callers must keep original room revisions. */
export function mergeDnd5eReactionMaterialsIntoMapPlan(
  application: Dnd5eMapResultPlan,
  changes: readonly Dnd5eReactionMaterialChange[],
): Dnd5eMapResultPlan {
  if (!changes.length) return application
  const byId = new Map(changes.map(change => [change.characterId, change]))
  if (byId.size !== changes.length) throw new Error('reaction-material-duplicate-owner')
  for (const change of changes) {
    const matches = application.characters.filter(character => character.id === change.characterId)
    if (matches.length !== 1) throw new Error('reaction-material-owner-missing')
    const character = matches[0]
    if ((character.dnd5eInventory?.revision ?? 0) !== change.expectedInventoryRevision ||
        JSON.stringify(character.dnd5eInventory) !== JSON.stringify(change.beforeInventory) ||
        JSON.stringify(character.equipment) !== JSON.stringify(change.beforeEquipment)) throw new Error('reaction-material-application-conflict')
  }
  const characterPatches = { ...application.characterPatches }
  const characters = application.characters.map(character => {
    const change = byId.get(character.id)
    if (!change) return character
    const patch = { dnd5eInventory: structuredClone(change.inventory), equipment: structuredClone(change.equipment) }
    characterPatches[character.id] = { ...characterPatches[character.id], ...patch }
    return { ...character, ...patch }
  })
  return { ...application, characters, characterPatches,
    changedCharacterIds: [...new Set([...application.changedCharacterIds, ...byId.keys()])] }
}
