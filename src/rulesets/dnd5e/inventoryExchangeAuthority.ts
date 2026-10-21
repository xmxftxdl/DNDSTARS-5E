import type { Dnd5eActivityAuthorityInput } from './activities/dnd5eActivityCommand'

/** Identity comes from the Host snapshot; a command cannot name another inventory owner. */
export function dnd5eInventoryExchangeOwnerMatchesActor(authority: Dnd5eActivityAuthorityInput): boolean {
  return !!authority.inventoryOwner && authority.actor.id === authority.command.actorId &&
    authority.inventoryOwner.id === (authority.actor.characterId ?? authority.actor.id)
}
