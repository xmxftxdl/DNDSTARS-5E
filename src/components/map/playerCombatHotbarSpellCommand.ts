import type { Character } from '../../types/character'
import type {
  Dnd5eCombatActionCommand,
  Dnd5eCombatSpellModifier,
} from '../../lib/dnd5eCombatActionDescriptors'
import { resolveDnd5eSpellModifierIntents } from '../../rulesets/dnd5e'
import { dnd5ePluginSpellActivity } from '../../rulesets/dnd5e/pluginSpellTransaction'
import { dnd5ePluginSpellDefinition } from '../../rulesets/dnd5e/plugins/pluginContentCatalog'
import { dnd5ePluginSpellModifierCompatibilityV1 } from '../../rulesets/dnd5e/spellModifierIntents'

export function dnd5eHotbarPluginSpellModifierCompatibility(spellId: string) {
  const pluginSpell = dnd5ePluginSpellDefinition(spellId)
  return pluginSpell
    ? dnd5ePluginSpellModifierCompatibilityV1(
        pluginSpell,
        dnd5ePluginSpellActivity(pluginSpell),
      )
    : undefined
}

export function dnd5eApplicableHotbarSpellModifiers(
  character: Character,
  command: Extract<Dnd5eCombatActionCommand, { kind: 'cast-spell' }>,
  slotLevel: number,
  armedModifiers: readonly Dnd5eCombatSpellModifier[],
): Dnd5eCombatSpellModifier[] {
  const pluginSpell = dnd5eHotbarPluginSpellModifierCompatibility(command.spellId)
  const resolve = (modifierIds: readonly Dnd5eCombatSpellModifier[]) =>
    resolveDnd5eSpellModifierIntents({
      character,
      castingClassId: command.castingClassId as Parameters<typeof resolveDnd5eSpellModifierIntents>[0]['castingClassId'],
      spellId: command.spellId,
      slotLevel,
      modifierIds: [...modifierIds],
      pluginSpell,
    })
  return [...new Set(armedModifiers)].filter((modifierId) => resolve([modifierId]).ok)
}

export function resolveDnd5eHotbarSpellCommand(
  character: Character,
  command: Extract<Dnd5eCombatActionCommand, { kind: 'cast-spell' }>,
  slotLevel: number,
  armedModifiers: readonly Dnd5eCombatSpellModifier[],
):
  | { ok: true; command: Extract<Dnd5eCombatActionCommand, { kind: 'cast-spell' }> }
  | { ok: false; reasons: string[] } {
  const pluginSpell = dnd5eHotbarPluginSpellModifierCompatibility(command.spellId)
  const applicableModifiers = dnd5eApplicableHotbarSpellModifiers(
    character,
    command,
    slotLevel,
    armedModifiers,
  )
  const resolution = resolveDnd5eSpellModifierIntents({
    character,
    castingClassId: command.castingClassId as Parameters<typeof resolveDnd5eSpellModifierIntents>[0]['castingClassId'],
    spellId: command.spellId,
    slotLevel,
    modifierIds: applicableModifiers,
    pluginSpell,
  })
  // A pre-armed modifier applies to the next *eligible* spell. It must not
  // turn every ineligible spell into a dead button. Resolve each intent
  // against this spell, then submit only the compatible subset.
  if (!resolution.ok) return { ok: false, reasons: [...resolution.reasons] }
  return {
    ok: true,
    command: {
      ...command,
      slotLevel,
      options: {
        ...resolution.options,
        autoSubmitOnTargetSelection: !resolution.requiresTargetConfiguration,
      },
    },
  }
}
