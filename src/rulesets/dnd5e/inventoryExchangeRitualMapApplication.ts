import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { planDnd5eMapResultApplication } from './mapBridge'
import { settleDnd5eInventoryExchangeRitualV1 } from './activities/dnd5eInventoryExchangeRitualSettlement'

/** Builds the same atomic map/character plan used by plugin room commits.
 * The room adapter must still compare its resource revisions before publishing. */
export function prepareDnd5eInventoryExchangeRitualMapApplication(input:
  Omit<Parameters<typeof settleDnd5eInventoryExchangeRitualV1>[0], 'actorCharacter' | 'inventoryOwner' | 'inventoryRoster' | 'exchangeScene'> & {
    map: BattleMap
    characters: readonly Character[]
    characterIdByCombatantId: Record<string, string>
  }) {
  const tokenIds = new Set(input.map.tokens.map(token => token.id))
  if (tokenIds.size !== input.map.tokens.length || Object.keys(input.state.combatants).some(id => !tokenIds.has(id)))
    return { ok: false as const, reason: 'ritual-map-snapshot-mismatch' }
  const token = input.map.tokens.find(candidate => candidate.id === input.command.actorId)
  const owner = input.characters.find(character => character.id === token?.characterId)
  if (!token || !owner || token.type === 'obstacle' || input.characterIdByCombatantId[input.command.actorId] !== owner.id)
    return { ok: false as const, reason: 'ritual-owner-mismatch' }
  const settled = settleDnd5eInventoryExchangeRitualV1({ ...input, actorCharacter: owner, inventoryOwner: owner,
    inventoryRoster: input.characters, exchangeScene: { map: input.map, actorTokenId: token.id } })
  if (!settled.ok) return settled
  if (settled.outcome !== 'completed') {
    return { ok: true as const, outcome: settled.outcome,
      command: settled.outcome === 'begun' ? settled.command : input.command,
      state: input.state, events: [],
      application: {
        map: input.map,
        characters: input.characters.map(character => character.id === owner.id ? settled.character : character),
        changedCharacterIds: [owner.id], changedTokenIds: [],
        characterPatches: { [owner.id]: { dnd5eInventory: settled.character.dnd5eInventory } },
      },
    }
  }
  const result = settled.resolution.result
  if (!result.ok || !result.inventoryOwner) return { ok: false as const, reason: 'ritual-settlement-rejected' }
  const characters = input.characters.map(character => character.id === owner.id ? result.inventoryOwner! : character)
  const application = planDnd5eMapResultApplication({ state: result.state, map: result.map ?? input.map,
    characters, baselineCharacters: input.characters, characterIdByCombatantId: input.characterIdByCombatantId,
    events: [...result.events] })
  // Inventory is independent of the combat projection; preserve the Host patch.
  application.characters = application.characters.map(character => character.id === owner.id
    ? { ...character, dnd5eInventory: result.inventoryOwner!.dnd5eInventory } : character)
  application.characterPatches = { ...application.characterPatches, [owner.id]: {
    ...application.characterPatches?.[owner.id], dnd5eInventory: result.inventoryOwner.dnd5eInventory,
  } }
  application.changedCharacterIds = [...new Set([...application.changedCharacterIds, owner.id])]
  const previousTokenIds = new Set(input.map.tokens.map(candidate => candidate.id))
  application.changedTokenIds = [...new Set([...application.changedTokenIds,
    ...application.map.tokens.filter(candidate => !previousTokenIds.has(candidate.id)).map(candidate => candidate.id)])]
  return { ok: true as const, outcome: settled.outcome, command: input.command,
    state: result.state, events: result.events, application }
}
