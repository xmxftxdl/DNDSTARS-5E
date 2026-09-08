import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

/**
 * Spells whose rules outcome is primarily an interaction with an ordinary
 * map/inventory object.  The VTT deliberately does not mutate that ordinary
 * target object: the player spends the selected spell slot, while an
 * explicitly consumed spell component is still settled by Host authority,
 * and describes the result to the DM over the room's voice channel.
 *
 * Keep this list Host-owned.  A player must not be able to downgrade an
 * arbitrary damage/control spell to the narrative resource-only protocol.
 */
const DND5E_NARRATIVE_OBJECT_SPELL_IDS = new Set([
  'animate-dead',
  'animate-objects',
  'arcane-lock',
  'arcanists-magic-aura',
  'clone',
  'continual-flame',
  // The spell creates a doorway on a scenery surface and requires semantic
  // cross-scene destination/door state. Under the voice-narrative object
  // policy, Host validates the cast and spends the slot without inventing a
  // creature target or mutating map objects.
  'demiplane',
  'fabricate',
  'glyph-of-warding',
  'heat-metal',
  'identify',
  'instant-summons',
  'illusory-script',
  'knock',
  'light',
  'locate-object',
  'magic-jar',
  'magic-mouth',
  'magic-weapon',
  'mending',
  'passwall',
  'purify-food-and-drink',
  'remove-curse',
  'secret-chest',
  'sequester',
  'shillelagh',
  'stone-shape',
])

/**
 * Fully automated creature spells that also have a printed ordinary-object
 * branch. Their normal hotbar cast must stay on the creature/combat route,
 * while the explicit object alternative follows the table's voice-narrative
 * policy and settles only the selected slot/material cost.
 */
const DND5E_NARRATIVE_OBJECT_ALTERNATIVE_SPELL_IDS = new Set([
  'disintegrate',
])

/**
 * Scene-scale environmental spells whose choices cannot be truthfully
 * represented by a creature target or a generic map template.  The Host still
 * validates the cast transaction, while the table establishes the real water,
 * geometry and outcome through voice / DM narration.
 */
const DND5E_NARRATIVE_ENVIRONMENT_SPELL_IDS = new Set([
  'control-water',
  'control-weather',
])

/**
 * Open-ended questions and conversations whose actual words already belong in
 * the room voice channel.  These spells have no deterministic target/effect
 * result for the VTT to approve: Host authority validates the cast and settles
 * slots, consumed materials and ritual time without interrupting the DM with a
 * second form.
 */
const DND5E_NARRATIVE_CONVERSATION_SPELL_IDS = new Set([
  'augury',
  'commune',
  'commune-with-nature',
  'divination',
  'speak-with-animals',
  'speak-with-dead',
])

/**
 * Open-ended spells whose physical detail remains table narration, but whose
 * combat cost is fully deterministic. They skip targeting and DM approval,
 * while still spending their printed action economy in combat.
 */
const DND5E_ACTION_ONLY_NARRATIVE_SPELL_IDS = new Set([
  'prestidigitation',
])

function dnd5eActivityOperationInteractsWithObject(
  operation: Dnd5eActivityDefinitionV1['outcomes'][number]['operations'][number],
): boolean {
  if (
    operation.kind === 'modify-map-object-lock' ||
    operation.kind === 'enchant-map-object-light' ||
    operation.kind === 'identify-inventory-item' ||
    operation.kind === 'purify-inventory-item' ||
    operation.kind === 'purify-map-consumables' ||
    operation.kind === 'break-inventory-item-attunement'
  ) return true
  if (operation.kind === 'create-persistent-area') {
    return operation.mappedObjectEnchantment != null ||
      operation.blocking?.suppressesMappedBarriers === true
  }
  if (operation.kind === 'establish-spell-authority') {
    return operation.requiresSelectedInventoryItem === true ||
      operation.recordKind === 'linked-planar-object' ||
      operation.recordKind === 'soul-vessel' ||
      operation.recordKind === 'clone-receptacle'
  }
  return operation.kind === 'transition-spell-authority' &&
    operation.recordKind === 'linked-planar-object'
}

export function dnd5eSpellUsesNarrativeObjectResolution(
  spellId: string | undefined,
  activity?: Dnd5eActivityDefinitionV1,
): boolean {
  return (!!spellId && DND5E_NARRATIVE_OBJECT_SPELL_IDS.has(spellId)) ||
    activity?.outcomes.some((outcome) =>
      outcome.operations.some(dnd5eActivityOperationInteractsWithObject),
    ) === true
}

export function dnd5eSpellSupportsNarrativeObjectAlternative(
  spellId: string | undefined,
): boolean {
  return !!spellId && DND5E_NARRATIVE_OBJECT_ALTERNATIVE_SPELL_IDS.has(spellId)
}

export function dnd5eSpellUsesNarrativeResolution(
  spellId: string | undefined,
  activity?: Dnd5eActivityDefinitionV1,
): boolean {
  return dnd5eSpellUsesActionOnlyNarrativeResolution(spellId) ||
    dnd5eSpellUsesNarrativeObjectResolution(spellId, activity) ||
    dnd5eSpellUsesNarrativeEnvironmentResolution(spellId) ||
    dnd5eSpellUsesNarrativeConversationResolution(spellId)
}

export function dnd5eSpellUsesActionOnlyNarrativeResolution(
  spellId: string | undefined,
): boolean {
  return !!spellId && DND5E_ACTION_ONLY_NARRATIVE_SPELL_IDS.has(spellId)
}

export function dnd5eSpellUsesNarrativeEnvironmentResolution(
  spellId: string | undefined,
): boolean {
  return !!spellId && DND5E_NARRATIVE_ENVIRONMENT_SPELL_IDS.has(spellId)
}

export function dnd5eSpellUsesNarrativeConversationResolution(
  spellId: string | undefined,
): boolean {
  return !!spellId && DND5E_NARRATIVE_CONVERSATION_SPELL_IDS.has(spellId)
}
