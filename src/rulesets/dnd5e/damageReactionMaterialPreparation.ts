import type { Character } from '../../types/character'
import { applyDnd5eSpellMaterialConsumption, type Dnd5eSpellMaterialConsumptionPlan } from './spellMaterials'
import { reserveDnd5eSpellMaterials, dnd5eSpellMaterialEscrowBinding } from './spellMaterialEscrow'

export interface Dnd5ePreparedMaterialContext {
  characters?: readonly Character[]
  actor?: { id: string }
  spellMaterialPlan?: Dnd5eSpellMaterialConsumptionPlan
  action?: { id: string }
  spell?: { id: string }
}

/** Reserve the primary cast's cost in a private replay baseline. The primary
 * resolver still settles its own original plan; no store or input is mutated. */
export function prepareDnd5eDamageReactionMaterialCharacters(
  characters: Readonly<Record<string, Character>>, prepared: Dnd5ePreparedMaterialContext,
): Readonly<Record<string, Character>> {
  const roster = Object.fromEntries(Object.entries(characters).map(([tokenId, character]) =>
    [tokenId, structuredClone(prepared.characters?.find(candidate => candidate.id === character.id) ?? character)]))
  const plan = prepared.spellMaterialPlan
  if (!plan) return roster
  const actor = prepared.characters?.find(character => character.id === prepared.actor?.id)
  if (!actor) throw new Error('damage-reaction-primary-material-owner-required')
  if (plan.consumptionTiming === 'spell-end' && (!prepared.action?.id || !prepared.spell?.id))
    throw new Error('damage-reaction-primary-material-binding-required')
  const settled = plan.consumptionTiming === 'spell-end'
    ? reserveDnd5eSpellMaterials(actor, plan, dnd5eSpellMaterialEscrowBinding(prepared.action!.id, prepared.spell!.id))
    : applyDnd5eSpellMaterialConsumption(actor, plan)
  if (!settled.ok) throw new Error(`damage-reaction-primary-${settled.reason}`)
  return Object.fromEntries(Object.entries(roster).map(([tokenId, character]) =>
    [tokenId, character.id === actor.id ? structuredClone(settled.character) : character]))
}
