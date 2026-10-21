import type { Character } from '../../types/character'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import { dnd5eCombatantCanSpeakAudibly } from './headlessCombatEngine'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { dnd5ePluginSpellDefinition } from './pluginApi'
import { dnd5eSpellcastingClassIdForSpell } from './spells'
import { dnd5eClassDefinition, type Dnd5eClassId } from './classes'
import { dnd5eCombatantClassLevel } from './headlessCombatPrimitives'
import { dnd5eActivitySpellSlotLevels } from './activitySpellSlots'
import { dnd5ePluginSpellComponentCheck } from './pluginSpellTransaction'
import { dnd5eSpellComponentsAvailable, type Dnd5eSpellComponentCheck } from './spellComponents'
import { dnd5eReactionsPrevented } from './passiveDefenses'
import { dnd5eDamageReactionSpellEntryIssues } from './damageReactionSpellContract'
import { applyDnd5eSpellMaterialConsumption } from './spellMaterials'

/** Preparation only. Material plans still require an atomic character/inventory commit. */
export function prepareDnd5eDamageReactionSpell(input: {
  packageId: string; activity: Dnd5eActivityDefinitionV1; actor: Dnd5eCombatant;
  character?: Character; castingClassId?: Dnd5eClassId; choices?: Readonly<Record<string, string>>;
  event?: 'before-damage' | 'creature-died';
}): { ok: true; spellId: string; castingClassId: Dnd5eClassId; availableCastLevels: readonly number[]; componentCheck: Dnd5eSpellComponentCheck; requiresInventoryWrite: boolean }
  | { ok: false; reason: string } {
  const { activity, actor, character } = input
  if (!character) return { ok: false, reason: 'reaction-spell-character-required' }
  if (activity.legacySource?.kind !== 'spell' || activity.requiresEffectGrant || activity.activation.kind !== 'reaction' ||
      activity.invocation?.kind !== 'triggered' || activity.invocation.event !== (input.event ?? 'before-damage') || activity.invocation.confirmation !== 'actor-choice') return { ok: false, reason: 'reaction-spell-entry-invalid' }
  const spellId = activity.legacySource.id.startsWith(input.packageId + ':') ? activity.legacySource.id : input.packageId + ':' + activity.legacySource.id
  const spell = dnd5ePluginSpellDefinition(spellId)
  if (!spell || spell.ownerPluginId !== input.packageId || spell.castingTime.unit !== 'reaction' || spell.castingTime.value !== 1)
    return { ok: false, reason: 'reaction-spell-definition-invalid' }
  const entryIssues = dnd5eDamageReactionSpellEntryIssues(activity, spell, input.event)
  if (entryIssues.length) return { ok: false, reason: entryIssues[0] }
  if (actor.currentHp <= 0 || !actor.turn.reactionAvailable || dnd5eReactionsPrevented(actor)) return { ok: false, reason: 'reaction-unavailable' }
  const castingClassId = dnd5eSpellcastingClassIdForSpell(character, spell.id, input.castingClassId, spell.classes)
  const definition = castingClassId ? dnd5eClassDefinition(castingClassId) : undefined
  if (!castingClassId || !definition?.spellcasting || dnd5eCombatantClassLevel(actor, castingClassId) < 1)
    return { ok: false, reason: 'spell-not-known-or-prepared' }
  if (actor.wearingUnproficientArmor || (actor.classState.rageTurnsRemaining ?? 0) > 0)
    return { ok: false, reason: 'spellcasting-unavailable' }
  if (actor.classState.wildShapeFormId && (actor.classState.wildShapeMode !== 'wild-shape' || castingClassId !== 'druid' || dnd5eCombatantClassLevel(actor, 'druid') < 18))
    return { ok: false, reason: 'wild-shape-spellcasting-unavailable' }
  const effectiveCharacter = { ...character, conditions: [...actor.conditions, ...(!dnd5eCombatantCanSpeakAudibly(actor) ? ['silenced'] : [])] }
  const componentCheck = dnd5ePluginSpellComponentCheck(effectiveCharacter, spell, castingClassId, { activityChoices: input.choices })
  if (!dnd5eSpellComponentsAvailable(componentCheck)) return { ok: false, reason: 'reaction-spell-components-unavailable' }
  const plan = componentCheck.materialPlan
  let requiresInventoryWrite = plan?.consumptionTiming === 'spell-end'
  if (plan && !requiresInventoryWrite) {
    const settlement = applyDnd5eSpellMaterialConsumption(effectiveCharacter, plan)
    if (!settlement.ok) return { ok: false, reason: 'reaction-spell-materials-unavailable' }
    requiresInventoryWrite = settlement.consumed
  }
  const availableCastLevels = dnd5eActivitySpellSlotLevels(actor, spell.level)
  if (!availableCastLevels.length) return { ok: false, reason: 'class-resource-unavailable' }
  return { ok: true, spellId: spell.id, castingClassId, availableCastLevels, componentCheck, requiresInventoryWrite }
}
