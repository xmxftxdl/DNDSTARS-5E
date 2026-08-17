import type { Character } from '../../types/character'
import type {
  Dnd5eCombatActionCommand,
  Dnd5eCombatSpellModifier,
} from '../../lib/dnd5eCombatActionDescriptors'
import { resolveDnd5eSpellModifierIntents } from '../../rulesets/dnd5e'

export function resolveDnd5eHotbarSpellCommand(
  character: Character,
  command: Extract<Dnd5eCombatActionCommand, { kind: 'cast-spell' }>,
  slotLevel: number,
  armedModifiers: readonly Dnd5eCombatSpellModifier[],
):
  | { ok: true; command: Extract<Dnd5eCombatActionCommand, { kind: 'cast-spell' }> }
  | { ok: false; reasons: string[] } {
  const resolution = resolveDnd5eSpellModifierIntents({
    character,
    castingClassId: command.castingClassId as Parameters<typeof resolveDnd5eSpellModifierIntents>[0]['castingClassId'],
    spellId: command.spellId,
    slotLevel,
    modifierIds: [...armedModifiers],
  })
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
